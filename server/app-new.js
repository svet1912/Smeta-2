/**
 * Новый основной файл сервера с исправленной архитектурой
 * Заменяет монолитный index.js и дублирующий app.js
 */
import express from 'express';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino-http';
import dotenv from 'dotenv';

import { config } from './config.js';
import { query } from './database.js';
import { metricsEndpoint } from './metrics.js';
import { cacheGetOrSet, cacheInvalidateByPrefix, getCacheStats } from './cache/cache.js';
import { getRedis, isRedisAvailable, getRedisStats } from './cache/redisClient.js';

// Импорт роутеров
import apiRouter from './routes/index.js';

dotenv.config();

const app = express();
const PORT = config.port;

console.log('🚀 Запуск нового сервера с исправленной архитектурой...');

// ============ MIDDLEWARE ============

// CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:4173', 'http://localhost:4174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 1000, // лимит запросов
  message: {
    error: 'Слишком много запросов, попробуйте позже',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Logging
app.use(pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  } : undefined
}));

// ============ CACHE MIDDLEWARE ============

/**
 * Middleware для кэширования каталогов
 */
function withCatalogCache(handler) {
  return async (req, res, next) => {
    try {
      // Проверяем, включено ли кэширование
      const cacheEnabled = process.env.CACHE_ENABLED === 'true';
      const cacheMaterials = process.env.CACHE_MATERIALS === 'true';
      const cacheWorks = process.env.CACHE_WORKS === 'true';

      if (!cacheEnabled) {
        return handler(req, res, next);
      }

      // Определяем тип кэша
      const isMaterials = req.path.includes('/materials');
      const isWorks = req.path.includes('/works');
      
      if ((isMaterials && !cacheMaterials) || (isWorks && !cacheWorks)) {
        return handler(req, res, next);
      }

      // Генерируем ключ кэша
      const cacheKey = `catalog:${req.path}:${JSON.stringify(req.query)}`;
      
      // Пытаемся получить из кэша
      const cached = await cacheGetOrSet(cacheKey, async () => {
        // Если нет в кэше, выполняем оригинальный handler
        return new Promise((resolve, reject) => {
          const originalSend = res.json;
          let responseData = null;
          
          res.json = function(data) {
            responseData = data;
            return originalSend.call(this, data);
          };
          
          handler(req, res, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve(responseData);
            }
          });
        });
      });

      if (cached) {
        // Устанавливаем заголовки кэша
        res.set({
          'Cache-Control': 'public, max-age=600', // 10 минут
          'ETag': `"${Buffer.from(JSON.stringify(cached)).toString('base64').slice(0, 16)}"`,
          'Vary': 'Accept-Encoding'
        });
        
        return res.json(cached);
      }
      
      next();
    } catch (error) {
      console.error('❌ Ошибка кэширования:', error);
      next();
    }
  };
}

// ============ ROUTES ============

// API routes
app.use('/api', apiRouter);

// Prometheus metrics
app.get('/metrics', metricsEndpoint);

// ============ CACHE MANAGEMENT ============

// Статистика кэша
app.get('/api/cache/stats', async (req, res) => {
  try {
    const cacheStats = getCacheStats();
    const redisAvailable = await isRedisAvailable();
    const redisStats = await getRedisStats();
    
    res.json({
      cache: cacheStats,
      redis: {
        available: redisAvailable,
        ...redisStats
      },
      config: {
        enabled: process.env.CACHE_ENABLED === 'true',
        materials: process.env.CACHE_MATERIALS === 'true',
        works: process.env.CACHE_WORKS === 'true',
        ttl_materials: process.env.CACHE_TTL_MATERIALS,
        ttl_works: process.env.CACHE_TTL_WORKS
      }
    });
  } catch (error) {
    console.error('Ошибка получения статистики кэша:', error);
    res.status(500).json({ error: 'Ошибка получения статистики кэша' });
  }
});

// Очистка кэша
app.delete('/api/cache', async (req, res) => {
  try {
    await cacheInvalidateByPrefix('');
    res.json({ message: 'Кэш полностью очищен' });
  } catch (error) {
    console.error('Ошибка очистки кэша:', error);
    res.status(500).json({ error: 'Ошибка очистки кэша' });
  }
});

// ============ ERROR HANDLING ============

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Маршрут не найден',
    code: 'ROUTE_NOT_FOUND',
    path: req.originalUrl
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('❌ Необработанная ошибка:', error);
  
  res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    code: 'INTERNAL_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
});

// ============ DATABASE INITIALIZATION ============

async function initializeTables() {
  try {
    console.log('🚀 Инициализация таблиц базы данных...');
    
    // Создание таблиц (упрощенная версия)
    const tables = [
      // Auth tables
      `CREATE TABLE IF NOT EXISTS auth_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        firstname VARCHAR(100),
        lastname VARCHAR(100),
        company VARCHAR(255),
        phone VARCHAR(20),
        position VARCHAR(100),
        location VARCHAR(255),
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // Statistics table
      `CREATE TABLE IF NOT EXISTS statistics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC,
        metric_unit VARCHAR(50),
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const tableSQL of tables) {
      await query(tableSQL);
    }
    
    console.log('✅ Таблицы инициализированы');
  } catch (error) {
    console.error('❌ Ошибка инициализации таблиц:', error);
  }
}

// Добавляем функцию инициализации как метод app для тестов
app.initializeTables = initializeTables;

export default app;
