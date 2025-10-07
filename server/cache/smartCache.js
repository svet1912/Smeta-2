// Enhanced Smart Cache с dependency tracking и analytics
import { getRedis } from './redisClient.js';

const ns = 'smeta360'; // namespace ключей
const v = 'v2'; // версия схемы ключей для smart cache
const depNs = 'deps'; // namespace для dependencies

// Расширенные метрики кэша
let cacheStats = {
  hits: 0,
  misses: 0,
  errors: 0,
  sets: 0,
  invalidations: 0,
  warmingHits: 0,
  dependencyInvalidations: 0,
  totalKeys: 0,
  averageLatency: 0,
  hitRate: 0
};

/**
 * Smart Cache класс с dependency tracking
 */
class SmartCache {
  constructor(redis) {
    this.redis = redis;
    this.namespace = `${ns}:${v}`;
    this.depsNamespace = `${this.namespace}:${depNs}`;
  }

  /**
   * Расширенная функция сохранения с зависимостями
   * @param {string} key - ключ кэша
   * @param {any} value - значение
   * @param {number} ttl - время жизни в секундах
   * @param {string[]} dependencies - массив зависимостей
   * @param {Object} metadata - дополнительные метаданные
   */
  async set(key, value, ttl = 300, dependencies = [], metadata = {}) {
    if (!this.redis) return;

    const fullKey = `${this.namespace}:${key}`;
    const startTime = Date.now();

    try {
      // Создаем объект для сохранения
      const cacheObject = {
        data: value,
        metadata: {
          ...metadata,
          cachedAt: new Date().toISOString(),
          dependencies,
          ttl,
          originalKey: key
        }
      };

      // Сохраняем основные данные
      await this.redis.setex(fullKey, ttl, JSON.stringify(cacheObject));

      // Сохраняем зависимости
      if (dependencies.length > 0) {
        await this._saveDependencies(key, dependencies, ttl);
      }

      cacheStats.sets++;
      cacheStats.totalKeys++;

      const latency = Date.now() - startTime;
      this._updateAverageLatency(latency);

      console.log(`💾 SmartCache SET: ${key}, TTL: ${ttl}s, deps: [${dependencies.join(', ')}]`);
    } catch (error) {
      cacheStats.errors++;
      console.error(`❌ SmartCache SET error for ${key}:`, error.message);
    }
  }

  /**
   * Получение данных с расширенной информацией
   * @param {string} key - ключ кэша
   * @returns {Promise<{data: any, metadata: Object} | null>}
   */
  async get(key) {
    if (!this.redis) return null;

    const fullKey = `${this.namespace}:${key}`;
    const startTime = Date.now();

    try {
      const cached = await this.redis.get(fullKey);

      const latency = Date.now() - startTime;
      this._updateAverageLatency(latency);

      if (cached) {
        cacheStats.hits++;
        this._updateHitRate();

        const cacheObject = JSON.parse(cached);
        console.log(`✅ SmartCache HIT: ${key} (cached at: ${cacheObject.metadata.cachedAt})`);

        return cacheObject;
      } else {
        cacheStats.misses++;
        this._updateHitRate();
        console.log(`❌ SmartCache MISS: ${key}`);
        return null;
      }
    } catch (error) {
      cacheStats.errors++;
      console.error(`❌ SmartCache GET error for ${key}:`, error.message);
      return null;
    }
  }

  /**
   * Smart invalidation по зависимостям
   * @param {string} dependency - имя зависимости
   */
  async invalidateByDependency(dependency) {
    if (!this.redis) return;

    try {
      const depKey = `${this.depsNamespace}:${dependency}`;
      const dependentKeys = await this.redis.smembers(depKey);

      if (dependentKeys.length > 0) {
        console.log(`🗑️ SmartCache invalidating ${dependentKeys.length} keys for dependency: ${dependency}`);

        // Удаляем зависимые ключи
        const pipeline = this.redis.pipeline();

        dependentKeys.forEach((key) => {
          pipeline.del(`${this.namespace}:${key}`);
        });

        // Удаляем саму зависимость
        pipeline.del(depKey);

        await pipeline.exec();

        cacheStats.invalidations++;
        cacheStats.dependencyInvalidations++;
        cacheStats.totalKeys = Math.max(0, cacheStats.totalKeys - dependentKeys.length);

        console.log(`✅ SmartCache invalidated ${dependentKeys.length} keys for dependency: ${dependency}`);
      } else {
        console.log(`ℹ️ SmartCache: no keys found for dependency: ${dependency}`);
      }
    } catch (error) {
      cacheStats.errors++;
      console.error(`❌ SmartCache invalidation error for dependency ${dependency}:`, error.message);
    }
  }

  /**
   * Cache warming - предварительная загрузка критических данных
   * @param {Array} warmingTasks - массив задач для warming
   */
  async warm(warmingTasks) {
    if (!this.redis) return;

    console.log(`🔥 SmartCache warming started: ${warmingTasks.length} tasks`);

    for (const task of warmingTasks) {
      try {
        const { key, producer, ttl = 300, dependencies = [] } = task;

        // Проверяем, есть ли уже данные в кэше
        const existing = await this.get(key);
        if (existing) {
          cacheStats.warmingHits++;
          console.log(`♨️ SmartCache warming skipped (exists): ${key}`);
          continue;
        }

        // Загружаем данные
        console.log(`♨️ SmartCache warming: ${key}`);
        const data = await producer();

        // Сохраняем с меткой warming
        await this.set(key, data, ttl, dependencies, { warmed: true });
      } catch (error) {
        console.error(`❌ SmartCache warming error for ${task.key}:`, error.message);
      }
    }

    console.log(`✅ SmartCache warming completed`);
  }

  /**
   * Получение аналитики кэша
   */
  async getAnalytics() {
    const analytics = {
      ...cacheStats,
      timestamp: new Date().toISOString()
    };

    if (this.redis) {
      try {
        // Получаем информацию о Redis
        const info = await this.redis.info('memory');
        const memoryLines = info.split('\r\n');

        const usedMemory = memoryLines.find((line) => line.startsWith('used_memory:'));
        const maxMemory = memoryLines.find((line) => line.startsWith('maxmemory:'));

        analytics.redis = {
          usedMemory: usedMemory ? usedMemory.split(':')[1] : 'unknown',
          maxMemory: maxMemory ? maxMemory.split(':')[1] : 'unknown'
        };

        // Считаем количество ключей нашего namespace
        const keys = await this._getOurKeys();
        analytics.actualKeys = keys.length;
      } catch (error) {
        console.error('❌ Error getting cache analytics:', error.message);
      }
    }

    return analytics;
  }

  /**
   * Очистка устаревших зависимостей
   */
  async cleanupStaleData() {
    if (!this.redis) return;

    try {
      console.log('🧹 SmartCache cleanup started...');

      // Получаем все ключи зависимостей
      const depKeys = await this.redis.keys(`${this.depsNamespace}:*`);
      let cleanedCount = 0;

      for (const depKey of depKeys) {
        const dependentKeys = await this.redis.smembers(depKey);
        const existingKeys = [];

        // Проверяем, какие зависимые ключи еще существуют
        for (const key of dependentKeys) {
          const exists = await this.redis.exists(`${this.namespace}:${key}`);
          if (exists) {
            existingKeys.push(key);
          }
        }

        // Если нет существующих ключей, удаляем зависимость
        if (existingKeys.length === 0) {
          await this.redis.del(depKey);
          cleanedCount++;
        } else if (existingKeys.length < dependentKeys.length) {
          // Обновляем зависимость с актуальным списком
          await this.redis.del(depKey);
          if (existingKeys.length > 0) {
            await this.redis.sadd(depKey, ...existingKeys);
          }
        }
      }

      console.log(`✅ SmartCache cleanup completed: ${cleanedCount} stale dependencies removed`);
    } catch (error) {
      console.error('❌ SmartCache cleanup error:', error.message);
    }
  }

  // Приватные методы

  async _saveDependencies(key, dependencies, ttl) {
    const pipeline = this.redis.pipeline();

    dependencies.forEach((dep) => {
      const depKey = `${this.depsNamespace}:${dep}`;
      pipeline.sadd(depKey, key);
      pipeline.expire(depKey, ttl + 300); // зависимости живут дольше на 5 минут
    });

    await pipeline.exec();
  }

  async _getOurKeys() {
    const keys = [];
    const stream = this.redis.scanStream({
      match: `${this.namespace}:*`,
      count: 100
    });

    return new Promise((resolve) => {
      stream.on('data', (foundKeys) => {
        keys.push(...foundKeys);
      });
      stream.on('end', () => resolve(keys));
    });
  }

  _updateAverageLatency(newLatency) {
    const totalOps = cacheStats.hits + cacheStats.misses + cacheStats.sets;
    if (totalOps === 1) {
      cacheStats.averageLatency = newLatency;
    } else {
      cacheStats.averageLatency = (cacheStats.averageLatency * (totalOps - 1) + newLatency) / totalOps;
    }
  }

  _updateHitRate() {
    const total = cacheStats.hits + cacheStats.misses;
    cacheStats.hitRate = total > 0 ? ((cacheStats.hits / total) * 100).toFixed(2) : 0;
  }
}

// Глобальный экземпляр Smart Cache
let smartCacheInstance = null;

/**
 * Получение экземпляра Smart Cache
 */
function getSmartCache() {
  if (!smartCacheInstance) {
    const redis = getRedis();
    smartCacheInstance = new SmartCache(redis);
  }
  return smartCacheInstance;
}

/**
 * Wrapper для обратной совместимости с существующим кодом
 */
export async function smartCacheGetOrSet(key, ttlSec, producer, options = {}) {
  const { skip = false, dependencies = [], metadata = {}, warming = false } = options;

  if (skip) {
    console.log(`🔄 SmartCache SKIP для ключа: ${key}`);
    return await producer();
  }

  const cache = getSmartCache();

  // Сначала пытаемся получить из кэша
  const cached = await cache.get(key);
  if (cached) {
    return cached.data;
  }

  // Если нет в кэше, получаем данные и сохраняем
  const data = await producer();
  await cache.set(key, data, ttlSec, dependencies, { ...metadata, warming });

  return data;
}

/**
 * Инвалидация по зависимостям
 */
export async function smartCacheInvalidate(dependency) {
  const cache = getSmartCache();
  await cache.invalidateByDependency(dependency);
}

/**
 * Cache warming
 */
export async function smartCacheWarm(tasks) {
  const cache = getSmartCache();
  await cache.warm(tasks);
}

/**
 * Аналитика кэша
 */
export async function getSmartCacheAnalytics() {
  const cache = getSmartCache();
  return await cache.getAnalytics();
}

/**
 * Очистка устаревших данных
 */
export async function cleanupSmartCache() {
  const cache = getSmartCache();
  await cache.cleanupStaleData();
}

/**
 * Получение статистики (обратная совместимость)
 */
export function getSmartCacheStats() {
  return { ...cacheStats };
}

export { SmartCache, getSmartCache };