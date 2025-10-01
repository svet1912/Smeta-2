import Redis from 'ioredis';

let redis = null;

export function getRedis() {
  if (redis) return redis;
  
  try {
    if (process.env.CACHE_ENABLED === 'true' && process.env.REDIS_URL) {
      console.log('🚀 Инициализация Redis клиента...');
      
      redis = new Redis(process.env.REDIS_URL, {
        lazyConnect: true,           // подключение по требованию
        maxRetriesPerRequest: 2,     // максимум 2 попытки для запроса
        enableAutoPipelining: true,  // автоматическое группирование команд
        reconnectOnError: () => true, // переподключение при ошибках
        retryDelayOnFailover: 100,   // задержка при failover
        connectTimeout: 2000,        // таймаут подключения 2 сек
        commandTimeout: 1000         // таймаут команды 1 сек
      });

      // Обработка событий Redis
      redis.on('connect', () => {
        console.log('✅ Redis подключен');
      });

      redis.on('ready', () => {
        console.log('🎯 Redis готов к работе');
      });

      redis.on('error', (error) => {
        console.warn('⚠️ Redis error:', error.message);
        // Не падаем, если Redis недоступен - работаем в fallback режиме
      });

      redis.on('close', () => {
        console.log('🔌 Redis соединение закрыто');
      });

      redis.on('reconnecting', () => {
        console.log('🔄 Redis переподключение...');
      });

    } else {
      console.log('❌ Redis кэш отключен (CACHE_ENABLED=false или REDIS_URL не указан)');
    }
  } catch (error) {
    console.warn('❌ Redis init failed:', error.message);
    redis = null;
  }

  return redis;
}

// Проверка доступности Redis
export async function isRedisAvailable() {
  const client = getRedis();
  if (!client) return false;
  
  try {
    await client.ping();
    return true;
  } catch (error) {
    console.warn('⚠️ Redis недоступен:', error.message);
    return false;
  }
}

// Получение статистики Redis
export async function getRedisStats() {
  const client = getRedis();
  if (!client) return null;

  try {
    const info = await client.info('memory');
    const keyspace = await client.info('keyspace');
    return {
      status: 'connected',
      memory: info,
      keyspace: keyspace
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message
    };
  }
}

export default redis;