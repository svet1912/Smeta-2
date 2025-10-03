/**
 * Refactored Express Application
 * Модульная архитектура вместо монолитного index.js
 */
import express from 'express';
import compression from 'compression';
import { config } from './config.js';

// Middleware
import { corsMiddleware } from './middleware/cors.js';
import { loggingMiddleware } from './middleware/logging.js';
import { generalRateLimit } from './middleware/rateLimiting.js';
import { connectionLimiter } from './middleware/connectionLimiter.js';
import { metricsEndpoint } from './metrics.js';

// Routes
import apiRouter from './routes/index.js';

// Services
import databaseService from './services/databaseService.js';

console.log('🚀 Запуск рефакторенного сервера...');

const app = express();

// ============ MIDDLEWARE SETUP ============

// Compression
app.use(compression());

// CORS
app.use(corsMiddleware);

// Logging
app.use(loggingMiddleware);

// Connection limiting
app.use(connectionLimiter);

// Rate limiting
app.use('/api', generalRateLimit);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============ ROUTES SETUP ============

// Prometheus metrics endpoint
app.get('/metrics', metricsEndpoint);

// API routes
app.use('/api', apiRouter);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await databaseService.healthCheck();
    res.json({
      status: 'OK',
      message: 'Backend сервер работает',
      port: config.port,
      timestamp: new Date().toISOString(),
      database: dbHealth
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Ошибка сервера',
      error: error.message
    });
  }
});

// ============ ERROR HANDLING ============

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Global error handler:', err);
  
  res.status(err.status || 500).json({
    error: 'Внутренняя ошибка сервера',
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: err.message })
  });
});

// ============ DATABASE INITIALIZATION ============

// Добавляем функцию инициализации для тестов
app.initializeTables = async () => {
  try {
    await databaseService.initializeTables();
    console.log('✅ База данных инициализирована');
  } catch (error) {
    console.error('❌ Ошибка инициализации БД:', error);
    throw error;
  }
};

export default app;
