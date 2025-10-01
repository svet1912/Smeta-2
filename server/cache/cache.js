import { getRedis } from './redisClient.js';

const ns = 'smeta360'; // неймспейс ключей
const v = 'v1';        // версия схемы ключей для инвалидации

// Метрики кэша
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0
};

export function getCacheStats() {
  return { ...cacheStats };
}

export function resetCacheStats() {
  cacheStats = { hits: 0, misses: 0, errors: 0, sets: 0 };
}

/**
 * Универсальная функция получения данных с кэшированием
 * @param {string} key - ключ кэша
 * @param {number} ttlSec - время жизни в секундах
 * @param {Function} producer - функция получения данных
 * @param {Object} options - опции
 * @param {boolean} options.skip - пропустить кэш
 * @returns {Promise<any>} данные
 */
export async function cacheGetOrSet(key, ttlSec, producer, { skip = false } = {}) {
  const redis = getRedis();
  const fullKey = `${ns}:${v}:${key}`;

  // Фоллбэк - если Redis недоступен или кэш отключен
  if (!redis || skip) {
    console.log(`🔄 Cache SKIP для ключа: ${key}`);
    const result = await producer();
    return result;
  }

  // Защита от "штампа" (cache stampede) примитивной блокировкой
  const lockKey = `${fullKey}:lock`;
  const lockTtlMs = 2000;

  try {
    // Попробуем сразу взять из кэша
    const hit = await redis.get(fullKey);
    if (hit) {
      cacheStats.hits++;
      console.log(`✅ Cache HIT для ключа: ${key}`);
      return JSON.parse(hit);
    }

    cacheStats.misses++;
    console.log(`❌ Cache MISS для ключа: ${key}`);

    // Берём простую блокировку, чтобы толпа не пошла в БД
    const gotLock = await redis.set(lockKey, '1', 'PX', lockTtlMs, 'NX');
    
    if (!gotLock) {
      // Подождём немного и попробуем ещё раз достать из кэша
      console.log(`⏳ Ожидание разблокировки для ключа: ${key}`);
      await new Promise(r => setTimeout(r, 150));
      
      const retry = await redis.get(fullKey);
      if (retry) {
        cacheStats.hits++;
        console.log(`✅ Cache HIT после ожидания для ключа: ${key}`);
        return JSON.parse(retry);
      }
    }

    try {
      // Получаем данные из источника
      console.log(`🔄 Загрузка данных для ключа: ${key}`);
      const data = await producer();
      
      // Сохраняем в кэш
      await redis.set(fullKey, JSON.stringify(data), 'EX', ttlSec);
      cacheStats.sets++;
      console.log(`💾 Cache SET для ключа: ${key}, TTL: ${ttlSec}s`);
      
      return data;
    } finally {
      // Освободим блокировку
      await redis.del(lockKey).catch(() => {});
    }

  } catch (error) {
    cacheStats.errors++;
    console.warn(`⚠️ Cache ERROR для ключа ${key}:`, error.message);
    
    // При ошибке кэша - fallback к прямому вызову
    return await producer();
  }
}

/**
 * Инвалидация кэша по префиксу ключей
 * @param {string} prefix - префикс для поиска ключей
 */
export async function cacheInvalidateByPrefix(prefix) {
  const redis = getRedis();
  if (!redis) {
    console.log(`🚫 Cache invalidation SKIP (Redis недоступен): ${prefix}`);
    return;
  }

  try {
    const pattern = `${ns}:${v}:${prefix}*`;
    console.log(`🗑️ Cache invalidation для паттерна: ${pattern}`);

    // Используем SCAN для безопасного поиска ключей
    const stream = redis.scanStream({ 
      match: pattern, 
      count: 200 
    });

    const pipeline = redis.pipeline();
    let deletedCount = 0;

    await new Promise((resolve, reject) => {
      stream.on('data', (keys) => {
        if (keys.length > 0) {
          keys.forEach(k => {
            pipeline.del(k);
            deletedCount++;
          });
        }
      });
      
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    if (deletedCount > 0) {
      await pipeline.exec();
      console.log(`✅ Cache invalidated: ${deletedCount} ключей удалено для паттерна ${pattern}`);
    } else {
      console.log(`ℹ️ Cache invalidation: ключей не найдено для паттерна ${pattern}`);
    }

  } catch (error) {
    console.warn(`⚠️ Cache invalidation ERROR для префикса ${prefix}:`, error.message);
  }
}

/**
 * Полная очистка кэша приложения
 */
export async function cacheClearAll() {
  return cacheInvalidateByPrefix('');
}

/**
 * Получение информации о ключах кэша
 * @param {string} prefix - префикс для поиска
 * @returns {Promise<Array>} список ключей
 */
export async function getCacheKeys(prefix = '') {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const pattern = `${ns}:${v}:${prefix}*`;
    const keys = [];
    
    const stream = redis.scanStream({ 
      match: pattern, 
      count: 100 
    });

    await new Promise((resolve) => {
      stream.on('data', (foundKeys) => {
        keys.push(...foundKeys);
      });
      stream.on('end', resolve);
    });

    return keys;
  } catch (error) {
    console.warn('⚠️ Ошибка получения ключей кэша:', error.message);
    return [];
  }
}