/**
 * System Routes
 * Системные маршруты для мониторинга и управления
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { query } from '../database.js';
import { metricsEndpoint } from '../metrics.js';
import { getCacheStats } from '../cache/cache.js';

const router = express.Router();

// ============ PUBLIC SYSTEM ROUTES ============
// Эти маршруты не требуют авторизации

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend сервер работает',
    port: process.env.PORT || 3001,
    timestamp: new Date().toISOString()
  });
});

// Database health check
router.get('/health/db', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as db_version');
    res.json({
      status: 'connected',
      database_time: result.rows[0].current_time,
      db_version: result.rows[0].db_version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint
router.get('/test', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as database_time');
    res.json({
      message: 'API работает!',
      database_time: result.rows[0].database_time,
      status: 'connected'
    });
  } catch (error) {
    res.status(500).json({
      message: 'API работает, но БД недоступна',
      error: error.message,
      status: 'disconnected'
    });
  }
});

// Metrics endpoint
router.get('/metrics', metricsEndpoint);

// ============ PROTECTED SYSTEM ROUTES ============
// Применяем middleware авторизации только к защищенным маршрутам
router.use('/admin', authMiddleware);

// Cache statistics
router.get('/admin/cache/stats', async (req, res) => {
  try {
    const { default: queryOptimizer } = await import('../services/queryOptimizer.js');
    const queryCacheStats = queryOptimizer.getCacheStats();

    // Также получаем статистику Redis кэша если доступен
    let redisStats = null;
    try {
      redisStats = await getCacheStats();
    } catch (error) {
      console.warn('Redis кэш недоступен:', error.message);
    }

    res.json({
      queryCache: queryCacheStats,
      redisCache: redisStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Ошибка получения статистики кеша',
      message: error.message
    });
  }
});

// Cache management
router.delete('/admin/cache', async (req, res) => {
  try {
    const { default: queryOptimizer } = await import('../services/queryOptimizer.js');

    // Очищаем кэш запросов
    queryOptimizer.clearCache();

    // TODO: Очистка Redis кэша если доступен

    res.json({
      message: 'Кеш очищен',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Ошибка очистки кеша',
      message: error.message
    });
  }
});

// Statistics
router.get('/admin/statistics', async (req, res) => {
  try {
    // TODO: Реализовать получение статистики
    res.json({
      message: 'Статистика будет реализована',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Ошибка получения статистики',
      message: error.message
    });
  }
});

export default router;
