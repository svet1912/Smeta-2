import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino-http';
import { query } from './database.js';
import { observeRequestDuration, metricsEndpoint, activeConnections as activeConnectionsGauge } from './metrics.js';

dotenv.config();

console.log('🚀 Запуск исправленного сервера...');

const app = express();

// Ограничение одновременных соединений
const activeConnections = new Set();
const MAX_CONNECTIONS = 10;

// Middleware для ограничения соединений
app.use((req, res, next) => {
  if (activeConnections.size >= MAX_CONNECTIONS) {
    console.log(`⚠️ Отклоняем запрос - превышен лимит (${activeConnections.size}/${MAX_CONNECTIONS})`);
    return res.status(503).json({ error: 'Сервер перегружен, попробуйте позже' });
  }

  const connectionId = Math.random().toString(36).substr(2, 9);
  activeConnections.add(connectionId);

  req.connectionId = connectionId;
  console.log(`📨 ${req.method} ${req.path} [${connectionId}] (${activeConnections.size}/${MAX_CONNECTIONS})`);

  // Обновляем метрику активных соединений
  activeConnectionsGauge.set(activeConnections.size);

  res.on('finish', () => {
    activeConnections.delete(connectionId);
    activeConnectionsGauge.set(activeConnections.size);
  });

  res.on('close', () => {
    activeConnections.delete(connectionId);
    activeConnectionsGauge.set(activeConnections.size);
  });

  next();
});

// Быстрый неблокирующий логгер
app.use(
  pino({
    level: process.env.LOG_LEVEL || 'info',
    genReqId: (req, res) => `${Date.now()}-${Math.random().toString(16).slice(2)}`
  })
);

// Сжатие ответов (gzip/br)
app.use(compression());

// Эффективные ETag
app.set('etag', 'strong');

// Keep-Alive
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Превышен лимит запросов',
    retryAfter: '15 минут'
  }
});

// Блок на слишком тяжёлые запросы
app.use((req, res, next) => {
  const limit = Number(req.query.limit || 50);
  if (limit > 200) {
    return res.status(400).json({ error: 'Limit too large. Maximum allowed: 200' });
  }
  next();
});

// CORS
app.use(
  cors({
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// JSON parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.static('.'));

// Rate limiting для API
app.use('/api', apiLimiter);

// Prometheus метрики
app.use(observeRequestDuration);

console.log('🔧 Настроена расширенная CORS политика');

// Health endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend сервер работает',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const result = await query('SELECT 1 as ok');
    res.json({ db: 'up', result: result.rows[0].ok });
  } catch (e) {
    res.status(503).json({ db: 'down', error: e.message });
  }
});

// Prometheus метрики endpoint
app.get('/metrics', metricsEndpoint);

// Импорт контроллеров для лид-формы
import { createLead, getLeadsStats, leadRateLimit, initializeLeadsTable } from './controllers/leadController.js';

// Лид-форма endpoints
app.post('/api/lead', leadRateLimit, createLead);
app.get('/api/leads/stats', getLeadsStats);

// Инициализация всех остальных маршрутов и таблиц
// (весь остальной код из server/index.js...)
// Для краткости добавлю только несколько ключевых эндпоинтов

// API маршруты
app.get('/api/statistics', async (req, res) => {
  try {
    const result = await query('SELECT * FROM statistics ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const result = await query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Инициализация таблиц при старте
app.initializeTables = async function () {
  console.log('🔄 Инициализация таблиц...');

  // Инициализируем таблицу для заявок
  await initializeLeadsTable();

  // Здесь будет код инициализации из оригинального файла
};

// Экспортируем приложение для тестов
export default app;
