// Advanced Database Pool Manager - Phase 3 Step 1
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { smartCacheGetOrSet } from '../cache/smartCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '.env');
dotenv.config({ path: envPath });

const { Pool } = pg;

// Advanced Pool Configuration
const POOL_CONFIG = {
  // Connection settings
  connectionString: process.env.DATABASE_URL,
  
  // Pool size optimization
  max: parseInt(process.env.DB_POOL_MAX) || 20, // максимум соединений
  min: parseInt(process.env.DB_POOL_MIN) || 2,  // минимум соединений
  
  // Timeout configurations
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000, // 30 секунд
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000, // 5 секунд
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000, // 60 секунд
  
  // Query timeouts
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT) || 30000, // 30 секунд
  query_timeout: parseInt(process.env.DB_QUERY_TIMEOUT) || 30000, // 30 секунд
  
  // Keep-alive for long connections
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  
  // SSL configuration
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

/**
 * Advanced Database Pool Manager
 */
class DatabasePoolManager {
  constructor() {
    this.pool = null;
    this.stats = {
      totalConnections: 0,
      idleConnections: 0,
      waitingClients: 0,
      queriesExecuted: 0,
      queryErrors: 0,
      averageQueryTime: 0,
      connectionErrors: 0,
      lastConnectionTime: null,
      poolCreatedAt: new Date().toISOString()
    };
    this.queryHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Инициализация пула соединений
   */
  async initialize() {
    if (this.pool) {
      console.log('🔄 Database pool уже инициализирован');
      return this.pool;
    }

    try {
      console.log('🚀 Инициализация Advanced Database Pool...');
      
      this.pool = new Pool(POOL_CONFIG);

      // Настройка event handlers
      this.setupEventHandlers();

      // Тестовое соединение
      await this.testConnection();

      console.log('✅ Advanced Database Pool успешно инициализирован');
      console.log(`📊 Pool конфигурация: min=${POOL_CONFIG.min}, max=${POOL_CONFIG.max}`);
      
      return this.pool;
    } catch (error) {
      console.error('❌ Ошибка инициализации Database Pool:', error.message);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий пула
   */
  setupEventHandlers() {
    // Новое соединение
    this.pool.on('connect', (client) => {
      this.stats.totalConnections++;
      this.stats.lastConnectionTime = new Date().toISOString();
      console.log(`🔗 Новое соединение с БД (всего: ${this.stats.totalConnections})`);
    });

    // Ошибка соединения
    this.pool.on('error', (err, client) => {
      this.stats.connectionErrors++;
      console.error('❌ Ошибка соединения с БД:', err.message);
    });

    // Удаление соединения
    this.pool.on('remove', (client) => {
      console.log('🗑️ Соединение удалено из пула');
    });

    // Получение соединения
    this.pool.on('acquire', (client) => {
      console.log('🔒 Соединение взято из пула');
    });

    // Возврат соединения
    this.pool.on('release', (err, client) => {
      if (err) {
        console.error('⚠️ Ошибка при возврате соединения:', err.message);
      }
    });
  }

  /**
   * Тестирование соединения
   */
  async testConnection() {
    const startTime = Date.now();
    try {
      const result = await this.pool.query('SELECT NOW() as current_time, version() as db_version');
      const duration = Date.now() - startTime;
      
      console.log('✅ Тестовое соединение успешно:', result.rows[0].current_time);
      console.log(`⚡ Время подключения: ${duration}ms`);
      console.log(`🐘 PostgreSQL версия: ${result.rows[0].db_version.split(' ')[1]}`);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Тестовое соединение неудачно:', error.message);
      throw error;
    }
  }

  /**
   * Выполнение запроса с мониторингом производительности
   */
  async query(text, params = [], options = {}) {
    const {
      useCache = false,
      cacheTTL = 300,
      cacheKey = null,
      dependencies = [],
      timeout = 30000
    } = options;

    // Если включено кэширование
    if (useCache && cacheKey) {
      try {
        return await smartCacheGetOrSet(
          `db:${cacheKey}`,
          cacheTTL,
          async () => await this._executeQuery(text, params, timeout),
          { dependencies, metadata: { type: 'database-query' } }
        );
      } catch (cacheError) {
        console.warn('⚠️ Cache error, executing direct query:', cacheError.message);
        return await this._executeQuery(text, params, timeout);
      }
    }

    return await this._executeQuery(text, params, timeout);
  }

  /**
   * Внутренний метод выполнения запроса
   */
  async _executeQuery(text, params = [], timeout = 30000) {
    if (!this.pool) {
      await this.initialize();
    }

    const startTime = Date.now();
    const queryId = Math.random().toString(36).substr(2, 9);

    try {
      console.log(`🔍 Query [${queryId}]: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      
      // Выполняем запрос с таймаутом
      const client = await this.pool.connect();
      
      try {
        // Устанавливаем таймаут для запроса
        await client.query('SET statement_timeout = $1', [timeout]);
        
        const result = await client.query(text, params);
        const duration = Date.now() - startTime;

        // Обновляем статистику
        this.updateQueryStats(duration, false);
        this.addToHistory(text, params, duration, result.rowCount, queryId);

        console.log(`✅ Query [${queryId}] completed: ${duration}ms, ${result.rowCount} rows`);
        
        return result;
      } finally {
        client.release();
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateQueryStats(duration, true);
      this.addToHistory(text, params, duration, 0, queryId, error.message);

      console.error(`❌ Query [${queryId}] failed after ${duration}ms:`, error.message);
      throw error;
    }
  }

  /**
   * Выполнение транзакции
   */
  async transaction(callback) {
    if (!this.pool) {
      await this.initialize();
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      
      console.log('✅ Транзакция успешно завершена');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Транзакция отменена:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Обновление статистики запросов
   */
  updateQueryStats(duration, isError) {
    this.stats.queriesExecuted++;
    if (isError) {
      this.stats.queryErrors++;
    }

    // Обновляем среднее время выполнения
    const totalQueries = this.stats.queriesExecuted;
    this.stats.averageQueryTime = (this.stats.averageQueryTime * (totalQueries - 1) + duration) / totalQueries;
  }

  /**
   * Добавление в историю запросов
   */
  addToHistory(query, params, duration, rowCount, queryId, error = null) {
    const historyEntry = {
      id: queryId,
      query: query.substring(0, 200), // первые 200 символов
      params: params ? params.slice(0, 5) : [], // первые 5 параметров
      duration,
      rowCount,
      error,
      timestamp: new Date().toISOString()
    };

    this.queryHistory.unshift(historyEntry);
    
    // Ограничиваем размер истории
    if (this.queryHistory.length > this.maxHistorySize) {
      this.queryHistory = this.queryHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Получение статистики пула
   */
  getPoolStats() {
    const poolStats = {
      // Текущее состояние пула
      totalCount: this.pool?.totalCount || 0,
      idleCount: this.pool?.idleCount || 0,
      waitingCount: this.pool?.waitingCount || 0,
      
      // Накопленная статистика
      ...this.stats,
      
      // Рассчитанные метрики
      errorRate: this.stats.queriesExecuted > 0 
        ? ((this.stats.queryErrors / this.stats.queriesExecuted) * 100).toFixed(2) + '%'
        : '0%',
      
      queriesPerSecond: this.stats.queriesExecuted > 0
        ? (this.stats.queriesExecuted / ((Date.now() - new Date(this.stats.poolCreatedAt).getTime()) / 1000)).toFixed(2)
        : '0',

      // История последних запросов
      recentQueries: this.queryHistory.slice(0, 10)
    };

    return poolStats;
  }

  /**
   * Получение медленных запросов
   */
  getSlowQueries(minDuration = 1000) {
    return this.queryHistory.filter(query => query.duration >= minDuration);
  }

  /**
   * Закрытие пула соединений
   */
  async close() {
    if (this.pool) {
      console.log('🔒 Закрытие Database Pool...');
      await this.pool.end();
      this.pool = null;
      console.log('✅ Database Pool закрыт');
    }
  }

  /**
   * Проверка здоровья пула
   */
  async healthCheck() {
    try {
      const startTime = Date.now();
      const result = await this.query('SELECT 1 as health_check');
      const duration = Date.now() - startTime;

      return {
        status: 'healthy',
        connectionTime: duration,
        timestamp: new Date().toISOString(),
        poolStats: this.getPoolStats()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
        poolStats: this.getPoolStats()
      };
    }
  }
}

// Глобальный экземпляр менеджера пула
const databaseManager = new DatabasePoolManager();

/**
 * Получение экземпляра менеджера базы данных
 */
export function getDatabaseManager() {
  return databaseManager;
}

/**
 * Быстрый доступ к выполнению запросов (обратная совместимость)
 */
export async function query(text, params, options) {
  return await databaseManager.query(text, params, options);
}

/**
 * Инициализация базы данных
 */
export async function initializeDatabase() {
  return await databaseManager.initialize();
}

/**
 * Выполнение транзакции
 */
export async function transaction(callback) {
  return await databaseManager.transaction(callback);
}

/**
 * Закрытие соединений
 */
export async function closeDatabase() {
  return await databaseManager.close();
}

// Инициализируем автоматически при импорте
initializeDatabase().catch(error => {
  console.error('❌ Ошибка автоинициализации Database Pool:', error.message);
});

export default databaseManager;