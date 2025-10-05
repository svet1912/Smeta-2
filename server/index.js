import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pino from 'pino-http';
import { query } from './database.js';
import { config } from './config.js';
import { authMiddleware } from './middleware/auth.js';
import { observeRequestDuration, metricsEndpoint, activeConnections as activeConnectionsGauge } from './metrics.js';
import { cacheGetOrSet, cacheInvalidateByPrefix, getCacheStats } from './cache/cache.js';
import { isRedisAvailable, getRedisStats } from './cache/redisClient.js';
import { createLead, getLeadsStats, leadRateLimit, initializeLeadsTable } from './controllers/leadController.js';

dotenv.config();

console.log('🚀 Запуск исправленного сервера...');

const app = express();
const PORT = config.port;

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
    // Обновляем метрику при завершении соединения
    activeConnectionsGauge.set(activeConnections.size);
  });

  res.on('close', () => {
    activeConnections.delete(connectionId);
    // Обновляем метрику при закрытии соединения
    activeConnectionsGauge.set(activeConnections.size);
  });

  next();
});

// Быстрый неблокирующий логгер
app.use(
  pino({
    level: process.env.LOG_LEVEL || 'info',
    // кореллируем запросы — полезно для трассировки
    genReqId: (req, res) => `${Date.now()}-${Math.random().toString(16).slice(2)}`
  })
);

// Сжатие ответов (gzip/br) — экономия трафика и TTFB
app.use(compression());

// Эффективные ETag (силён на справочниках, неизменяемых ресурсах)
app.set('etag', 'strong');

// Keep-Alive (поддержка длительных TCP-сессий)
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  next();
});

// Rate limiting (мягкий лимит на /api)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 300, // до 300 запросов с IP в окно
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Превышен лимит запросов',
    retryAfter: '15 минут'
  }
});

// Блок на слишком тяжёлые запросы (защита без влияния на UX)
app.use((req, res, next) => {
  // мягкая санитация параметров
  const limit = Number(req.query.limit || 50);

  if (limit > 3000) {
    // Увеличено для справочников (works: 540, materials: 1448)
    return res.status(400).json({ error: 'Limit too large. Maximum allowed: 3000' });
  }
  next();
});

// Middleware
const allowedOrigins = new Set([
  'http://localhost:4174', // vite preview
  'http://localhost:3000', // dev
  'http://localhost:5173', // vite dev
  'http://127.0.0.1:4174' // local preview
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin (например, мобильные приложения)
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
      } else {
        console.log('⚠️ CORS blocked origin:', origin);
        callback(null, true); // Временно разрешаем все для отладки
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Строго ограничим размер JSON (защита от больших payload)
app.use(express.json({ limit: '1mb' }));
app.use(express.static('.'));

// Rate limiting применяем к API эндпоинтам
app.use('/api', apiLimiter);

// Prometheus метрики
app.use(observeRequestDuration);

// ============ УТИЛИТАРНЫЕ ФУНКЦИИ КЕШИРОВАНИЯ ============

function setCatalogCache(res) {
  // публичный кеш 5 минут, можно отдавать «протухшее» ещё 60 сек пока обновляем
  res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=60');
}

function setLastModified(res, lastUpdated) {
  // lastUpdated — ISO строка или Date
  res.setHeader('Last-Modified', new Date(lastUpdated).toUTCString());
}

function withCatalogCache(handler) {
  return async (req, res, next) => {
    try {
      setCatalogCache(res);
      await handler(req, res, next);
    } catch (e) {
      next(e);
    }
  };
}

// Проверка на изменения для 304 Not Modified
function checkNotModified(req, res, lastUpdated) {
  if (req.headers['if-modified-since']) {
    const clientTime = new Date(req.headers['if-modified-since']);
    const serverTime = new Date(lastUpdated);
    if (clientTime >= serverTime) {
      res.status(304).end();
      return true;
    }
  }
  return false;
}

// ============ API ENDPOINTS ============

// Простой тест endpoint без БД
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Backend сервер работает',
    port: PORT,
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

// Middleware для логирования всех запросов
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - ${req.ip}`);
  next();
});

console.log('🔧 Настроена расширенная CORS политика');

// Функция для инициализации таблиц
async function initializeTables() {
  try {
    // Создание таблицы пользователей для авторизации
    await query(`
      CREATE TABLE IF NOT EXISTS auth_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        firstname VARCHAR(255) NOT NULL,
        lastname VARCHAR(255) NOT NULL,
        company VARCHAR(255),
        phone VARCHAR(20),
        position VARCHAR(255),
        location VARCHAR(255),
        bio TEXT,
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы сессий/токенов
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        user_agent TEXT,
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание индексов для производительности
    await query(`
      CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
    `);

    // Создание таблицы пользователей (старая таблица для совместимости)
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы заказов
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        tracking_no BIGINT NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INTEGER NOT NULL,
        status INTEGER DEFAULT 0,
        amount DECIMAL(10,2) NOT NULL,
        user_id INTEGER REFERENCES auth_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы статистики
    await query(`
      CREATE TABLE IF NOT EXISTS statistics (
        id SERIAL PRIMARY KEY,
        metric_name VARCHAR(255) NOT NULL,
        metric_value INTEGER NOT NULL,
        percentage DECIMAL(5,2),
        extra_value INTEGER,
        is_loss BOOLEAN DEFAULT FALSE,
        color VARCHAR(50) DEFAULT 'primary',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы связей работ и материалов
    await query(`
      CREATE TABLE IF NOT EXISTS work_materials (
        work_id VARCHAR(50) NOT NULL,
        material_id VARCHAR(50) NOT NULL,
        consumption_per_work_unit DECIMAL(10,6),
        waste_coeff DECIMAL(5,3) DEFAULT 1.000,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (work_id, material_id),
        FOREIGN KEY (work_id) REFERENCES works_ref(id) ON DELETE CASCADE,
        FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      );
    `);

    // Создание таблицы проектов строительных смет
    await query(`
      CREATE TABLE IF NOT EXISTS construction_projects (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        object_address TEXT NOT NULL,
        contractor_name VARCHAR(255) NOT NULL,
        contract_number VARCHAR(100) NOT NULL,
        deadline DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы ролей пользователей
    await query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        permissions JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы связи пользователей и ролей (многие ко многим)
    await query(`
      CREATE TABLE IF NOT EXISTS user_role_assignments (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE CASCADE,
        role_id INTEGER REFERENCES user_roles(id) ON DELETE CASCADE,
        tenant_id UUID,
        assigned_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        UNIQUE(user_id, role_id, tenant_id)
      );
    `);

    // Создание таблицы параметров объектов (связанных с проектами)
    await query(`
      CREATE TABLE IF NOT EXISTS object_parameters (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES construction_projects(id) ON DELETE CASCADE,
        building_type VARCHAR(255),
        construction_category INTEGER,
        floors_above_ground INTEGER,
        floors_below_ground INTEGER,
        height_above_ground DECIMAL(10,2),
        height_below_ground DECIMAL(10,2),
        total_area DECIMAL(12,2),
        building_area DECIMAL(12,2),
        estimated_cost DECIMAL(15,2),
        construction_complexity VARCHAR(100),
        seismic_zone INTEGER,
        wind_load INTEGER,
        snow_load INTEGER,
        soil_conditions VARCHAR(255),
        groundwater_level DECIMAL(10,2),
        climate_zone VARCHAR(100),
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы помещений проекта
    await query(`
      CREATE TABLE IF NOT EXISTS project_rooms (
        id SERIAL PRIMARY KEY,
        object_parameters_id INTEGER REFERENCES object_parameters(id) ON DELETE CASCADE,
        room_name VARCHAR(255) NOT NULL,
        area DECIMAL(10,2),
        height DECIMAL(8,2),
        volume DECIMAL(12,2),
        finish_class VARCHAR(100),
        purpose VARCHAR(255),
        sort_order INTEGER DEFAULT 0,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы конструктивных элементов
    await query(`
      CREATE TABLE IF NOT EXISTS constructive_elements (
        id SERIAL PRIMARY KEY,
        object_parameters_id INTEGER REFERENCES object_parameters(id) ON DELETE CASCADE,
        element_type VARCHAR(100) NOT NULL, -- foundation, walls, roof, etc.
        material VARCHAR(255),
        characteristics TEXT,
        quantity DECIMAL(12,2),
        unit VARCHAR(50),
        notes TEXT,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы инженерных систем
    await query(`
      CREATE TABLE IF NOT EXISTS engineering_systems (
        id SERIAL PRIMARY KEY,
        object_parameters_id INTEGER REFERENCES object_parameters(id) ON DELETE CASCADE,
        system_type VARCHAR(100) NOT NULL, -- heating, ventilation, electrical, etc.
        characteristics TEXT,
        capacity VARCHAR(255),
        efficiency VARCHAR(100),
        notes TEXT,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблиц смет заказчика
    await query(`
      CREATE TABLE IF NOT EXISTS customer_estimates (
        id SERIAL PRIMARY KEY,
        project_id INTEGER REFERENCES construction_projects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL DEFAULT 'Смета заказчика',
        description TEXT,
        version INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'draft',
        total_amount DECIMAL(15,2) DEFAULT 0,
        work_coefficient DECIMAL(8,3) DEFAULT 1.000,
        material_coefficient DECIMAL(8,3) DEFAULT 1.000,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        approved_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS customer_estimate_items (
        id SERIAL PRIMARY KEY,
        estimate_id INTEGER REFERENCES customer_estimates(id) ON DELETE CASCADE,
        item_type VARCHAR(20) NOT NULL,
        reference_id VARCHAR(50),
        name TEXT NOT NULL,
        unit VARCHAR(50),
        quantity DECIMAL(12,3) NOT NULL,
        unit_price DECIMAL(12,2) NOT NULL,
        original_unit_price DECIMAL(12,2),
        total_amount DECIMAL(15,2) NOT NULL,
        sort_order INTEGER DEFAULT 0,
        notes TEXT,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS customer_estimate_history (
        id SERIAL PRIMARY KEY,
        estimate_id INTEGER REFERENCES customer_estimates(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        changes JSONB,
        old_values JSONB,
        new_values JSONB,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS customer_estimate_templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        template_data JSONB NOT NULL,
        is_public BOOLEAN DEFAULT false,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы истории изменений (аудит)
    await query(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        table_name VARCHAR(100) NOT NULL,
        record_id INTEGER NOT NULL,
        action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
        old_values JSONB,
        new_values JSONB,
        user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        tenant_id UUID,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы разрешений для детального контроля доступа
    await query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        resource VARCHAR(100) NOT NULL, -- projects, estimates, materials, etc.
        action VARCHAR(50) NOT NULL, -- create, read, update, delete, manage, etc.
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Создание таблицы связи ролей и разрешений
    await query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER REFERENCES user_roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        granted_by INTEGER REFERENCES auth_users(id) ON DELETE SET NULL,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(role_id, permission_id)
      );
    `);

    // Добавление полей для мультитенантности (если их нет)
    try {
      await query(
        `ALTER TABLE construction_projects ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL`
      );
      await query(`ALTER TABLE construction_projects ADD COLUMN IF NOT EXISTS tenant_id UUID`);
      await query(`ALTER TABLE construction_projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft'`);

      // Добавление недостающих полей в auth_users для полного профиля
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS position VARCHAR(255)`);
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS location VARCHAR(255)`);
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS bio TEXT`);

      // Добавление полей для окон и порталов в таблицу project_rooms
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS perimeter DECIMAL(10,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS prostenki DECIMAL(10,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS doors_count INTEGER DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS window1_width DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS window1_height DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS window2_width DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS window2_height DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS window3_width DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS window3_height DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS portal1_width DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS portal1_height DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS portal2_width DECIMAL(8,2) DEFAULT 0`);
      await query(`ALTER TABLE project_rooms ADD COLUMN IF NOT EXISTS portal2_height DECIMAL(8,2) DEFAULT 0`);

      // Создание индексов для многопользовательской системы
      await query(`CREATE INDEX IF NOT EXISTS idx_construction_projects_tenant ON construction_projects(tenant_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_construction_projects_user_tenant ON construction_projects(user_id, tenant_id)`);
    } catch (error) {
      console.log('ℹ️ Поля мультитенантности уже существуют или ошибка:', error.message);
    }

    // Создание индексов для производительности
    await query(`
      CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_work_materials_work_id ON work_materials(work_id);
      CREATE INDEX IF NOT EXISTS idx_work_materials_material_id ON work_materials(material_id);
      CREATE INDEX IF NOT EXISTS idx_work_materials_work_material ON work_materials(work_id, material_id);
      CREATE INDEX IF NOT EXISTS idx_works_ref_sort_order ON works_ref(sort_order);
      CREATE INDEX IF NOT EXISTS idx_works_ref_id ON works_ref(id);
      CREATE INDEX IF NOT EXISTS idx_works_ref_name ON works_ref(name);
      CREATE INDEX IF NOT EXISTS idx_materials_id ON materials(id);
      CREATE INDEX IF NOT EXISTS idx_materials_name ON materials(name);
      CREATE INDEX IF NOT EXISTS idx_materials_unit_price ON materials(unit_price);
      
      -- Индексы для многопользовательской системы и ролей
      CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role_id);
      CREATE INDEX IF NOT EXISTS idx_user_role_assignments_tenant ON user_role_assignments(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_user_role_assignments_active ON user_role_assignments(is_active);
      CREATE INDEX IF NOT EXISTS idx_user_role_assignments_expires ON user_role_assignments(expires_at);
      
      -- Индексы для параметров объектов
      CREATE INDEX IF NOT EXISTS idx_object_parameters_project ON object_parameters(project_id);
      CREATE INDEX IF NOT EXISTS idx_object_parameters_user_tenant ON object_parameters(user_id, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_project_rooms_object_params ON project_rooms(object_parameters_id);
      CREATE INDEX IF NOT EXISTS idx_project_rooms_user_tenant ON project_rooms(user_id, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_constructive_elements_object_params ON constructive_elements(object_parameters_id);
      CREATE INDEX IF NOT EXISTS idx_engineering_systems_object_params ON engineering_systems(object_parameters_id);
      
      -- Индексы для системы разрешений
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
      CREATE INDEX IF NOT EXISTS idx_permissions_resource_action ON permissions(resource, action);
      
      -- Индексы для смет заказчика
      CREATE INDEX IF NOT EXISTS idx_customer_estimates_project ON customer_estimates(project_id);
      CREATE INDEX IF NOT EXISTS idx_customer_estimates_user_tenant ON customer_estimates(user_id, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_customer_estimates_status ON customer_estimates(status);
      CREATE INDEX IF NOT EXISTS idx_customer_estimate_items_estimate ON customer_estimate_items(estimate_id);
      CREATE INDEX IF NOT EXISTS idx_customer_estimate_items_type ON customer_estimate_items(item_type);
      CREATE INDEX IF NOT EXISTS idx_customer_estimate_items_reference ON customer_estimate_items(reference_id);
      CREATE INDEX IF NOT EXISTS idx_customer_estimate_history_estimate ON customer_estimate_history(estimate_id);
      CREATE INDEX IF NOT EXISTS idx_customer_estimate_history_action ON customer_estimate_history(action);
      CREATE INDEX IF NOT EXISTS idx_customer_estimate_templates_user_tenant ON customer_estimate_templates(user_id, tenant_id);
      
      -- Индексы для аудита
      CREATE INDEX IF NOT EXISTS idx_audit_log_table_record ON audit_log(table_name, record_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_tenant ON audit_log(user_id, tenant_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    `);

    // Инициализация базовых ролей и разрешений
    await initializeRolesAndPermissions();

    // Вставка демонстрационных данных если таблицы пустые
    const userCount = await query('SELECT COUNT(*) FROM auth_users');
    if (parseInt(userCount.rows[0].count) === 0) {
      await insertDemoAuthData();
    }

    const orderCount = await query('SELECT COUNT(*) FROM orders');
    if (parseInt(orderCount.rows[0].count) === 0) {
      await insertDemoData();
    }

    // Инициализация таблицы лид-формы
    await initializeLeadsTable();
  } catch (error) {
    console.error('❌ Ошибка при инициализации таблиц (БД недоступна):', error.message);
    console.log('⚠️ Работаем без базы данных - используем локальное хранилище');
  }
}

// Функция инициализации ролей и разрешений
async function initializeRolesAndPermissions() {
  try {
    // Проверяем, есть ли уже разрешения
    const permissionCount = await query('SELECT COUNT(*) FROM permissions');
    if (parseInt(permissionCount.rows[0].count) > 0) {
      console.log('✅ Разрешения уже инициализированы');
      return;
    }

    console.log('🔧 Инициализация системы ролей и разрешений...');

    // Создание базовых разрешений
    const permissions = [
      // Проекты
      { name: 'projects.create', resource: 'projects', action: 'create', description: 'Создание новых проектов' },
      { name: 'projects.read', resource: 'projects', action: 'read', description: 'Просмотр проектов' },
      { name: 'projects.update', resource: 'projects', action: 'update', description: 'Редактирование проектов' },
      { name: 'projects.delete', resource: 'projects', action: 'delete', description: 'Удаление проектов' },
      { name: 'projects.manage', resource: 'projects', action: 'manage', description: 'Полное управление проектами' },

      // Сметы
      { name: 'estimates.create', resource: 'estimates', action: 'create', description: 'Создание смет' },
      { name: 'estimates.read', resource: 'estimates', action: 'read', description: 'Просмотр смет' },
      { name: 'estimates.update', resource: 'estimates', action: 'update', description: 'Редактирование смет' },
      { name: 'estimates.delete', resource: 'estimates', action: 'delete', description: 'Удаление смет' },
      { name: 'estimates.export', resource: 'estimates', action: 'export', description: 'Экспорт смет' },

      // Материалы
      { name: 'materials.create', resource: 'materials', action: 'create', description: 'Добавление материалов' },
      { name: 'materials.read', resource: 'materials', action: 'read', description: 'Просмотр справочника материалов' },
      { name: 'materials.update', resource: 'materials', action: 'update', description: 'Редактирование материалов' },
      { name: 'materials.delete', resource: 'materials', action: 'delete', description: 'Удаление материалов' },

      // Работы
      { name: 'works.create', resource: 'works', action: 'create', description: 'Добавление работ' },
      { name: 'works.read', resource: 'works', action: 'read', description: 'Просмотр справочника работ' },
      { name: 'works.update', resource: 'works', action: 'update', description: 'Редактирование работ' },
      { name: 'works.delete', resource: 'works', action: 'delete', description: 'Удаление работ' },

      // Параметры объектов
      { name: 'object_parameters.create', resource: 'object_parameters', action: 'create', description: 'Создание параметров объектов' },
      { name: 'object_parameters.read', resource: 'object_parameters', action: 'read', description: 'Просмотр параметров объектов' },
      {
        name: 'object_parameters.update',
        resource: 'object_parameters',
        action: 'update',
        description: 'Редактирование параметров объектов'
      },
      { name: 'object_parameters.delete', resource: 'object_parameters', action: 'delete', description: 'Удаление параметров объектов' },

      // Пользователи и роли (для администраторов)
      { name: 'users.create', resource: 'users', action: 'create', description: 'Создание пользователей' },
      { name: 'users.read', resource: 'users', action: 'read', description: 'Просмотр пользователей' },
      { name: 'users.update', resource: 'users', action: 'update', description: 'Редактирование пользователей' },
      { name: 'users.delete', resource: 'users', action: 'delete', description: 'Удаление пользователей' },
      { name: 'users.manage_roles', resource: 'users', action: 'manage_roles', description: 'Управление ролями пользователей' },

      // Системное администрирование
      { name: 'system.audit', resource: 'system', action: 'audit', description: 'Просмотр логов аудита' },
      { name: 'system.backup', resource: 'system', action: 'backup', description: 'Создание резервных копий' },
      { name: 'system.settings', resource: 'system', action: 'settings', description: 'Управление системными настройками' }
    ];

    // Добавление разрешений
    for (const permission of permissions) {
      await query(
        `
        INSERT INTO permissions (name, resource, action, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `,
        [permission.name, permission.resource, permission.action, permission.description]
      );
    }

    // Создание базовых ролей
    const roles = [
      {
        name: 'super_admin',
        description: 'Суперадминистратор - полный доступ ко всем функциям системы',
        permissions: permissions.map((p) => p.name) // Все разрешения
      },
      {
        name: 'admin',
        description: 'Администратор - управление проектами и пользователями',
        permissions: [
          'projects.manage',
          'estimates.create',
          'estimates.read',
          'estimates.update',
          'estimates.export',
          'materials.create',
          'materials.read',
          'materials.update',
          'works.create',
          'works.read',
          'works.update',
          'object_parameters.create',
          'object_parameters.read',
          'object_parameters.update',
          'users.read',
          'users.update'
        ]
      },
      {
        name: 'project_manager',
        description: 'Менеджер проектов - управление проектами и сметами',
        permissions: [
          'projects.create',
          'projects.read',
          'projects.update',
          'estimates.create',
          'estimates.read',
          'estimates.update',
          'estimates.export',
          'materials.read',
          'works.read',
          'object_parameters.create',
          'object_parameters.read',
          'object_parameters.update'
        ]
      },
      {
        name: 'estimator',
        description: 'Сметчик - создание и редактирование смет',
        permissions: [
          'projects.read',
          'estimates.create',
          'estimates.read',
          'estimates.update',
          'estimates.export',
          'materials.read',
          'works.read',
          'object_parameters.read'
        ]
      },
      {
        name: 'viewer',
        description: 'Наблюдатель - только просмотр данных',
        permissions: ['projects.read', 'estimates.read', 'materials.read', 'works.read', 'object_parameters.read']
      }
    ];

    // Добавление ролей
    for (const role of roles) {
      const roleResult = await query(
        `
        INSERT INTO user_roles (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      `,
        [role.name, role.description]
      );

      const roleId = roleResult.rows[0].id;

      // Добавление разрешений к роли
      for (const permissionName of role.permissions) {
        const permissionResult = await query('SELECT id FROM permissions WHERE name = $1', [permissionName]);
        if (permissionResult.rows.length > 0) {
          const permissionId = permissionResult.rows[0].id;
          await query(
            `
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `,
            [roleId, permissionId]
          );
        }
      }
    }

    console.log('✅ Система ролей и разрешений инициализирована');
    console.log('🏷️ Созданные роли: super_admin, admin, project_manager, estimator, viewer');
  } catch (error) {
    console.error('❌ Ошибка при инициализации ролей и разрешений:', error);
  }
}

// Функция для вставки демонстрационных данных авторизации
async function insertDemoAuthData() {
  try {
    const salt = await bcrypt.genSalt(config.bcryptRounds);
    const hashedPassword = await bcrypt.hash('password123', salt);

    // Создание демонстрационных пользователей
    const users = [
      { email: 'admin@smeta360.ru', firstname: 'Супер', lastname: 'Админ', company: 'СМЕТА 360°', role: 'super_admin' },
      { email: 'manager@smeta360.ru', firstname: 'Иван', lastname: 'Менеджеров', company: 'СМЕТА 360°', role: 'project_manager' },
      { email: 'estimator@smeta360.ru', firstname: 'Петр', lastname: 'Сметчиков', company: 'СМЕТА 360°', role: 'estimator' },
      { email: 'viewer@smeta360.ru', firstname: 'Анна', lastname: 'Просмотрова', company: 'СМЕТА 360°', role: 'viewer' }
    ];

    for (const userData of users) {
      // Создание пользователя
      const userResult = await query(
        `
        INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, true, true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `,
        [userData.email, hashedPassword, userData.firstname, userData.lastname, userData.company]
      );

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;

        // Назначение роли пользователю
        const roleResult = await query('SELECT id FROM user_roles WHERE name = $1', [userData.role]);
        if (roleResult.rows.length > 0) {
          const roleId = roleResult.rows[0].id;
          await query(
            `
            INSERT INTO user_role_assignments (user_id, role_id, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING
          `,
            [userId, roleId]
          );
        }
      }
    }

    console.log('✅ Демонстрационные пользователи с ролями созданы');
    console.log('🔑 Тестовые аккаунты:');
    console.log('   admin@smeta360.ru / password123 (Суперадмин)');
    console.log('   manager@smeta360.ru / password123 (Менеджер проектов)');
    console.log('   estimator@smeta360.ru / password123 (Сметчик)');
    console.log('   viewer@smeta360.ru / password123 (Наблюдатель)');
  } catch (error) {
    console.error('❌ Ошибка при вставке демо-данных авторизации:', error);
  }
}

// Функция для вставки демонстрационных данных
async function insertDemoData() {
  try {
    // Данные пользователей
    await query(`
      INSERT INTO users (name, email) VALUES
      ('Иван Иванов', 'ivan@example.com'),
      ('Мария Петрова', 'maria@example.com'),
      ('Алексей Сидоров', 'alexey@example.com');
    `);

    // Данные заказов
    await query(`
      INSERT INTO orders (tracking_no, product_name, quantity, status, amount) VALUES
      (84564564, 'Объектив камеры', 40, 2, 40570.00),
      (98764564, 'Ноутбук', 300, 0, 180139.00),
      (98756325, 'Мобильный телефон', 355, 1, 90989.00),
      (98652366, 'Телефон', 50, 1, 10239.00),
      (13286564, 'Компьютерные аксессуары', 100, 1, 83348.00),
      (86739658, 'Телевизор', 99, 0, 410780.00),
      (13256498, 'Клавиатура', 125, 2, 70999.00),
      (98753263, 'Мышь', 89, 2, 10570.00);
    `);

    // Данные статистики
    await query(`
      INSERT INTO statistics (metric_name, metric_value, percentage, extra_value, is_loss, color) VALUES
      ('Всего просмотров', 442236, 59.3, 35000, false, 'primary'),
      ('Всего пользователей', 78250, 70.5, 8900, false, 'primary'),
      ('Всего заказов', 18800, 27.4, 1943, true, 'warning'),
      ('Всего продаж', 35078, 27.4, 20395, true, 'warning');
    `);

    // Демо-данные связей работа-материал
    await query(`
      INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff) VALUES
      ('w.1', 'm.1', 2.5, 1.05),
      ('w.1', 'm.2', 0.8, 1.10),
      ('w.10', 'm.3', 1.2, 1.08),
      ('w.10', 'm.4', 0.5, 1.15),
      ('w.100', 'm.1', 3.0, 1.05),
      ('w.100', 'm.5', 1.5, 1.12),
      ('w.101', 'm.2', 1.8, 1.10),
      ('w.101', 'm.6', 0.9, 1.20)
      ON CONFLICT (work_id, material_id) DO NOTHING;
    `);

    console.log('✅ Демонстрационные данные добавлены');
  } catch (error) {
    console.error('❌ Ошибка при добавлении демонстрационных данных:', error);
  }
}

// Локальное хранилище пользователей (fallback для тестирования без БД)
let localUsers = [];
let userIdCounter = 1;

// Функция для работы с пользователями (с fallback на локальное хранилище)
async function createUser(userData) {
  try {
    const result = await query(
      `
      INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, true, false)
      RETURNING id, email, firstname, lastname, company, created_at
    `,
      [userData.email, userData.passwordHash, userData.firstname, userData.lastname, userData.company || null]
    );
    return result.rows[0];
  } catch {
    console.log('⚠️ БД недоступна, используем локальное хранилище');
    const newUser = {
      id: userIdCounter++,
      email: userData.email,
      firstname: userData.firstname,
      lastname: userData.lastname,
      company: userData.company,
      created_at: new Date()
    };
    localUsers.push({
      ...newUser,
      password_hash: userData.passwordHash,
      is_active: true,
      email_verified: false,
      last_login: null
    });
    return newUser;
  }
}

async function findUserByEmail(email) {
  try {
    const result = await query(
      `
      SELECT id, email, password_hash, firstname, lastname, company, is_active, email_verified, created_at
      FROM auth_users 
      WHERE email = $1
    `,
      [email]
    );
    return result.rows[0] || null;
  } catch {
    console.log('⚠️ БД недоступна, ищем в локальном хранилище');
    return localUsers.find((user) => user.email === email) || null;
  }
}

async function updateLastLogin(userId) {
  try {
    await query('UPDATE auth_users SET last_login = NOW() WHERE id = $1', [userId]);
  } catch {
    console.log('⚠️ БД недоступна, пропускаем обновление last_login');
    const user = localUsers.find((u) => u.id === userId);
    if (user) user.last_login = new Date();
  }
}

// ============ API МАРШРУТЫ АВТОРИЗАЦИИ ============

// Регистрация пользователя
app.post('/api/auth/register', async (req, res) => {
  console.log('🔍 POST /api/auth/register - получен запрос:', req.body);
  try {
    const { firstname, lastname, email, company, password } = req.body;

    // Валидация входных данных
    if (!firstname || !lastname || !email || !password) {
      console.log('❌ Валидация не пройдена: отсутствуют обязательные поля');
      return res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
      });
    }

    // Проверка формата email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат email адреса'
      });
    }

    // Проверка длины пароля
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Пароль должен содержать минимум 6 символов'
      });
    }

    // Проверка существования пользователя
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }

    // Хеширование пароля
    const salt = await bcrypt.genSalt(config.bcryptRounds);
    const passwordHash = await bcrypt.hash(password, salt);

    // Создание пользователя
    const newUser = await createUser({
      email,
      passwordHash,
      firstname,
      lastname,
      company
    });

    // Для новых пользователей создаем дефолтный tenant или используем существующий
    let newUserTenantId = null;

    // Генерация JWT токена с дефолтной ролью и tenant
    const token = jwt.sign(
      {
        userId: newUser.id,
        email: newUser.email,
        firstname: newUser.firstname,
        lastname: newUser.lastname,
        role: 'estimator', // Дефолтная роль для новых пользователей
        tenantId: newUserTenantId // null для новых пользователей без tenant
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Сохранение сессии (хешируем токен для безопасности)
    try {
      const tokenHash = await bcrypt.hash(token, 10);
      await query(
        `
        INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES ($1, $2, NOW() + INTERVAL '24 hours', $3, $4)
      `,
        [newUser.id, tokenHash, req.headers['user-agent'] || '', req.ip || req.connection.remoteAddress]
      );
    } catch {
      console.log('⚠️ БД недоступна, пропускаем сохранение сессии');
    }

    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: {
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          firstname: newUser.firstname,
          lastname: newUser.lastname,
          company: newUser.company,
          createdAt: newUser.created_at
        }
      }
    });

    console.log('✅ Регистрация успешна для:', email);
  } catch (error) {
    console.error('❌ Ошибка регистрации:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Вход пользователя
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email и пароль обязательны для заполнения'
      });
    }

    // Поиск пользователя
    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    // Проверка активности аккаунта
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Аккаунт заблокирован. Обратитесь к администратору'
      });
    }

    // Проверка пароля
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }

    // Обновление времени последнего входа
    await updateLastLogin(user.id);

    // Получаем роль пользователя
    let userRole = 'estimator'; // По умолчанию
    try {
      const roleResult = await query(
        `
        SELECT ur.name as role_name
        FROM user_role_assignments ura
        JOIN user_roles ur ON ur.id = ura.role_id
        WHERE ura.user_id = $1 AND ura.is_active = true
        ORDER BY ura.assigned_at DESC
        LIMIT 1
      `,
        [user.id]
      );

      if (roleResult.rows.length > 0) {
        userRole = roleResult.rows[0].role_name;
      }
    } catch {
      console.log('⚠️ Не удалось получить роль, используем estimator');
    }

    // Получаем tenant_id пользователя из user_tenants
    let userTenantId = null;
    try {
      const tenantResult = await query(
        `
        SELECT tenant_id FROM user_tenants 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      `,
        [user.id]
      );

      userTenantId = tenantResult.rows.length > 0 ? tenantResult.rows[0].tenant_id : null;
    } catch (error) {
      console.log('⚠️ Не удалось получить tenant_id пользователя:', error.message);
    }

    // Генерация JWT токена с ролью и tenantId
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: userRole, // Добавляем роль в токен
        tenantId: userTenantId // Реальный tenant_id из user_tenants
      },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Сохранение сессии
    try {
      const tokenHash = await bcrypt.hash(token, 10);
      await query(
        `
        INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES ($1, $2, NOW() + INTERVAL '24 hours', $3, $4)
      `,
        [user.id, tokenHash, req.headers['user-agent'] || '', req.ip || req.connection.remoteAddress]
      );
    } catch {
      console.log('⚠️ БД недоступна, пропускаем сохранение сессии');
    }

    res.json({
      success: true,
      message: 'Успешный вход в систему',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          company: user.company,
          emailVerified: user.email_verified,
          createdAt: user.created_at
        }
      }
    });
  } catch (error) {
    console.error('❌ Ошибка входа:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Выход пользователя (удаление сессии)
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    // Если нет токена, все равно возвращаем успех (пользователь хочет выйти)
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('⚠️ Logout без токена - возвращаем успех');
      return res.json({
        success: true,
        message: 'Успешный выход из системы'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, config.jwtSecret);

      // Удаление активных сессий пользователя
      await query('DELETE FROM user_sessions WHERE user_id = $1', [decoded.userId]);
      console.log(`🔐 Logout пользователя: ${decoded.email || decoded.userId}`);
    } catch (tokenError) {
      // Если токен невалиден или истек, все равно возвращаем успех
      console.log('⚠️ Невалидный токен при logout, но возвращаем успех:', tokenError.message);
    }

    res.json({
      success: true,
      message: 'Успешный выход из системы'
    });
  } catch (error) {
    console.error('❌ Ошибка выхода:', error);
    // Даже при ошибке возвращаем успех - важно чтобы frontend мог выйти
    res.json({
      success: true,
      message: 'Успешный выход из системы'
    });
  }
});

// Проверка токена и получение информации о пользователе
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Токен авторизации не предоставлен'
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwtSecret);

    // Получение актуальной информации о пользователе
    const result = await query(
      `
      SELECT id, email, firstname, lastname, company, phone, position, location, bio, 
             is_active, email_verified, last_login, created_at
      FROM auth_users 
      WHERE id = $1 AND is_active = true
    `,
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден или заблокирован'
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        company: user.company,
        phone: user.phone,
        position: user.position,
        location: user.location,
        bio: user.bio,
        emailVerified: user.email_verified,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Недействительный токен'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Токен истек'
      });
    }

    console.error('❌ Ошибка проверки токена:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// ============ API МАРШРУТЫ ДАННЫХ ============

// API маршруты

// Получение статистики для dashboard
app.get('/api/statistics', async (req, res) => {
  try {
    const result = await query('SELECT * FROM statistics ORDER BY id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение заказов
app.get('/api/orders', async (req, res) => {
  try {
    const result = await query(`
      SELECT * FROM orders 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения заказов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение пользователей
// OLD API - закомментировано, используется новый API ниже
// app.get('/api/users', async (req, res) => {
//   try {
//     const result = await query('SELECT * FROM users ORDER BY created_at DESC');
//     res.json(result.rows);
//   } catch (error) {
//     console.error('Ошибка получения пользователей:', error);
//     res.status(500).json({ error: 'Ошибка сервера' });
//   }
// });

// Создание нового пользователя
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await query('INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *', [name, email]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание нового заказа
app.post('/api/orders', async (req, res) => {
  try {
    const { tracking_no, product_name, quantity, status, amount } = req.body;
    const result = await query(
      'INSERT INTO orders (tracking_no, product_name, quantity, status, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [tracking_no, product_name, quantity, status, amount]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==============================|| WORKS REF API ||============================== //

// Получение всех фаз
app.get('/api/phases', async (req, res) => {
  try {
    const result = await query('SELECT * FROM phases ORDER BY sort_order, id');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения фаз:', error);
    res.status(500).json({ error: 'Ошибка получения фаз' });
  }
});

// Получение всех работ с их связями (с кешированием Redis)
app.get(
  '/api/works',
  withCatalogCache(async (req, res) => {
    try {
      // Параметры запроса для ключа кэша
      const search = req.query.search?.trim().toLowerCase() || '';
      const page = Number(req.query.page || 1);
      const limit = Math.min(Number(req.query.limit || 50), 3000); // Увеличено для полной загрузки справочников

      // Настройки кэша
      const ttl = Number(process.env.CACHE_TTL_WORKS || 600);
      const useCache = process.env.CACHE_ENABLED === 'true' && process.env.CACHE_WORKS === 'true';

      // Уникальный ключ кэша
      const key = `works:q=${encodeURIComponent(search)}:p=${page}:l=${limit}`;

      const data = await cacheGetOrSet(
        key,
        ttl,
        async () => {
          console.log('🔄 Загрузка работ из базы данных...');

          // Получаем дату последнего изменения
          const lastModResult = await query(`
          SELECT COALESCE(MAX(updated_at), MAX(created_at)) as last_updated 
          FROM works_ref
        `);
          const lastUpdated = lastModResult.rows[0]?.last_updated || new Date();

          // Основной запрос с поиском
          let whereClause = '';
          let params = [];
          let paramIndex = 1;

          if (search) {
            whereClause = `WHERE w.name ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
          }

          const offset = (page - 1) * limit;
          const result = await query(
            `
          SELECT 
            w.*,
            p.name as phase_name,
            s.name as stage_name,
            ss.name as substage_name
          FROM works_ref w
          LEFT JOIN phases p ON w.phase_id = p.id
          LEFT JOIN stages s ON w.stage_id = s.id  
          LEFT JOIN substages ss ON w.substage_id = ss.id
          ${whereClause}
          ORDER BY w.sort_order, w.id
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
            [...params, limit, offset]
          );

          // Подсчёт общего количества
          const countResult = await query(
            `
          SELECT COUNT(*) as total 
          FROM works_ref w ${whereClause}
        `,
            params
          );

          return {
            data: result.rows,
            pagination: {
              page,
              limit,
              total: parseInt(countResult.rows[0].total),
              totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
            },
            lastUpdated: lastUpdated
          };
        },
        { skip: !useCache }
      );

      setLastModified(res, data.lastUpdated);

      if (checkNotModified(req, res, data.lastUpdated)) {
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Ошибка получения работ:', error);
      res.status(500).json({ error: 'Ошибка получения работ' });
    }
  })
);

// Получение всех материалов (с кешированием Redis)
app.get(
  '/api/materials',
  withCatalogCache(async (req, res) => {
    try {
      // Параметры запроса для ключа кэша
      const search = req.query.search?.trim().toLowerCase() || '';
      const page = Number(req.query.page || 1);
      const limit = Math.min(Number(req.query.limit || 50), 3000); // Увеличено для полной загрузки справочников

      // Настройки кэша из переменных окружения
      const ttl = Number(process.env.CACHE_TTL_MATERIALS || 600);
      const useCache = process.env.CACHE_ENABLED === 'true' && process.env.CACHE_MATERIALS === 'true';

      // Уникальный ключ кэша учитывающий параметры запроса
      const key = `materials:q=${encodeURIComponent(search)}:p=${page}:l=${limit}`;

      const data = await cacheGetOrSet(
        key,
        ttl,
        async () => {
          // Producer function - выполняется только при cache miss
          console.log('🔄 Загрузка материалов из базы данных...');

          // Получаем дату последнего изменения для Last-Modified
          const lastModResult = await query(`
          SELECT COALESCE(MAX(updated_at), MAX(created_at)) as last_updated 
          FROM materials
        `);
          const lastUpdated = lastModResult.rows[0]?.last_updated || new Date();

          // Основной запрос с поиском и пагинацией
          let whereClause = '';
          let params = [];
          let paramIndex = 1;

          if (search) {
            whereClause = `WHERE name ILIKE $${paramIndex}`;
            params.push(`%${search}%`);
            paramIndex++;
          }

          const offset = (page - 1) * limit;
          const result = await query(
            `
          SELECT * FROM materials 
          ${whereClause}
          ORDER BY name 
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `,
            [...params, limit, offset]
          );

          // Подсчёт общего количества для пагинации
          const countResult = await query(
            `
          SELECT COUNT(*) as total FROM materials ${whereClause}
        `,
            params
          );

          return {
            data: result.rows,
            pagination: {
              page,
              limit,
              total: parseInt(countResult.rows[0].total),
              totalPages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
            },
            lastUpdated: lastUpdated
          };
        },
        { skip: !useCache }
      );

      // Устанавливаем заголовки кэширования и Last-Modified
      setLastModified(res, data.lastUpdated);

      // Проверяем If-Modified-Since для 304 Not Modified
      if (checkNotModified(req, res, data.lastUpdated)) {
        return;
      }

      res.json(data);
    } catch (error) {
      console.error('Ошибка получения материалов:', error);
      res.status(500).json({ error: 'Ошибка получения материалов' });
    }
  })
);

// Создание нового материала
app.post('/api/materials', async (req, res) => {
  try {
    const { id, name, image_url, item_url, unit, unit_price, expenditure, weight } = req.body;
    const result = await query(
      'INSERT INTO materials (id, name, image_url, item_url, unit, unit_price, expenditure, weight) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [id, name, image_url, item_url, unit, unit_price, expenditure, weight]
    );

    // Инвалидируем кэш материалов после успешного создания
    cacheInvalidateByPrefix('materials:').catch((err) => console.warn('⚠️ Ошибка инвалидации кэша материалов:', err.message));

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания материала:', error);
    res.status(500).json({ error: 'Ошибка создания материала' });
  }
});

// Обновление материала
app.put('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, image_url, item_url, unit, unit_price, expenditure, weight } = req.body;
    const result = await query(
      'UPDATE materials SET name = $1, image_url = $2, item_url = $3, unit = $4, unit_price = $5, expenditure = $6, weight = $7, updated_at = now() WHERE id = $8 RETURNING *',
      [name, image_url, item_url, unit, unit_price, expenditure, weight, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    // Инвалидируем кэш материалов после успешного обновления
    cacheInvalidateByPrefix('materials:').catch((err) => console.warn('⚠️ Ошибка инвалидации кэша материалов:', err.message));

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления материала:', error);
    res.status(500).json({ error: 'Ошибка обновления материала' });
  }
});

// Удаление материала
app.delete('/api/materials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await query('DELETE FROM materials WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Материал не найден' });
    }
    res.json({ message: 'Материал удален' });
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    res.status(500).json({ error: 'Ошибка удаления материала' });
  }
});

// Создание новой работы
app.post('/api/works', async (req, res) => {
  try {
    const { id, name, phase_id, stage_id, substage_id, unit, unit_price } = req.body;
    const result = await query(
      'INSERT INTO works_ref (id, name, phase_id, stage_id, substage_id, unit, unit_price) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [id, name, phase_id, stage_id, substage_id, unit, unit_price]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания работы:', error);
    res.status(500).json({ error: 'Ошибка создания работы' });
  }
});

// ==============================|| WORK MATERIALS API ||============================== //

// Получение материалов для работы
app.get('/api/works/:workId/materials', async (req, res) => {
  try {
    const { workId } = req.params;
    const result = await query(
      `
      SELECT
        wm.*,
        m.name as material_name,
        m.unit as material_unit,
        m.unit_price as material_unit_price,
        (wm.consumption_per_work_unit * wm.waste_coeff) as total_consumption,
        ((wm.consumption_per_work_unit * wm.waste_coeff) * m.unit_price) as material_cost_per_work_unit
      FROM work_materials wm
      JOIN materials m ON wm.material_id = m.id
      WHERE wm.work_id = $1
      ORDER BY m.name
    `,
      [workId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения материалов для работы:', error);
    res.status(500).json({ error: 'Ошибка получения материалов для работы' });
  }
});

// Добавление материала к работе
app.post('/api/works/:workId/materials', async (req, res) => {
  try {
    const { workId } = req.params;
    const { material_id, consumption_per_work_unit, waste_coeff = 1.0 } = req.body;
    const result = await query(
      `
      INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (work_id, material_id)
      DO UPDATE SET
        consumption_per_work_unit = EXCLUDED.consumption_per_work_unit,
        waste_coeff = EXCLUDED.waste_coeff,
        updated_at = now()
      RETURNING *
    `,
      [workId, material_id, consumption_per_work_unit, waste_coeff]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления материала к работе:', error);
    res.status(500).json({ error: 'Ошибка добавления материала к работе' });
  }
});

// Обновление связи работа-материал
app.put('/api/works/:workId/materials/:materialId', async (req, res) => {
  try {
    const { workId, materialId } = req.params;
    const { consumption_per_work_unit, waste_coeff = 1.0 } = req.body;
    const result = await query(
      `
      UPDATE work_materials
      SET consumption_per_work_unit = $1, waste_coeff = $2, updated_at = now()
      WHERE work_id = $3 AND material_id = $4
      RETURNING *
    `,
      [consumption_per_work_unit, waste_coeff, workId, materialId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Связь работа-материал не найдена' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления связи работа-материал:', error);
    res.status(500).json({ error: 'Ошибка обновления связи работа-материал' });
  }
});

// Удаление связи работа-материал
app.delete('/api/works/:workId/materials/:materialId', async (req, res) => {
  try {
    const { workId, materialId } = req.params;
    const result = await query(
      `
      DELETE FROM work_materials
      WHERE work_id = $1 AND material_id = $2
      RETURNING *
    `,
      [workId, materialId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Связь работа-материал не найдена' });
    }
    res.json({ message: 'Связь работа-материал удалена' });
  } catch (error) {
    console.error('Ошибка удаления связи работа-материал:', error);
    res.status(500).json({ error: 'Ошибка удаления связи работа-материал' });
  }
});

// Получение всех связей работа-материал
app.get('/api/work-materials', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        wm.*,
        w.name as work_name,
        w.unit as work_unit,
        w.unit_price as work_unit_price,
        m.name as material_name,
        m.unit as material_unit,
        m.unit_price as material_unit_price,
        m.image_url as material_image_url,
        m.item_url as material_item_url,
        (wm.consumption_per_work_unit * wm.waste_coeff) as total_consumption,
        ((wm.consumption_per_work_unit * wm.waste_coeff) * m.unit_price) as material_cost_per_work_unit
      FROM work_materials wm
      JOIN works_ref w ON wm.work_id = w.id
      JOIN materials m ON wm.material_id = m.id
      ORDER BY w.sort_order, w.id, m.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения связей работа-материал:', error);
    res.status(500).json({ error: 'Ошибка получения связей работа-материал' });
  }
});

// Простое кэширование для API
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 минут

// Оптимизированный endpoint для загрузки всех данных сметы одним запросом
app.get('/api/estimate-data', async (req, res) => {
  try {
    const cacheKey = 'estimate-data';
    const cached = cache.get(cacheKey);

    // Проверяем кэш
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('📦 Возвращаем данные из кэша');
      return res.json({
        success: true,
        data: cached.data,
        meta: {
          ...cached.meta,
          cached: true,
          cacheAge: Date.now() - cached.timestamp
        }
      });
    }

    console.log('🚀 Загрузка оптимизированных данных сметы...');
    const startTime = Date.now();

    // Загружаем все данные одним запросом с оптимизированными полями
    const result = await query(`
      SELECT
        -- Данные работ
        w.id as work_id,
        w.name as work_name,
        w.unit as work_unit,
        w.unit_price as work_unit_price,
        w.sort_order as work_sort_order,
        
        -- Данные материалов
        m.id as material_id,
        m.name as material_name,
        m.unit as material_unit,
        m.unit_price as material_unit_price,
        m.image_url as material_image_url,
        m.item_url as material_item_url,
        
        -- Связи работа-материал
        wm.consumption_per_work_unit,
        wm.waste_coeff,
        (wm.consumption_per_work_unit * wm.waste_coeff) as total_consumption,
        ((wm.consumption_per_work_unit * wm.waste_coeff) * m.unit_price) as material_cost_per_work_unit
      FROM work_materials wm
      JOIN works_ref w ON wm.work_id = w.id
      JOIN materials m ON wm.material_id = m.id
      ORDER BY w.sort_order, w.id, m.id
    `);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`✅ Оптимизированный запрос выполнен за ${duration}ms (${result.rows.length} записей)`);

    const responseData = {
      success: true,
      data: result.rows,
      meta: {
        count: result.rows.length,
        duration: duration,
        timestamp: new Date().toISOString(),
        cached: false
      }
    };

    // Сохраняем в кэш
    cache.set(cacheKey, {
      data: result.rows,
      meta: responseData.meta,
      timestamp: Date.now()
    });

    res.json(responseData);
  } catch (error) {
    console.error('Ошибка получения оптимизированных данных сметы:', error);
    res.status(500).json({
      success: false,
      error: 'Ошибка получения данных сметы',
      details: error.message
    });
  }
});

// Тестовый маршрут
app.get('/api/test', async (req, res) => {
  try {
    const result = await query('SELECT NOW() as current_time');
    res.json({
      message: 'API работает!',
      database_time: result.rows[0].current_time,
      status: 'connected'
    });
  } catch (error) {
    console.error('Ошибка тестового запроса:', error);
    res.status(500).json({ error: 'Ошибка подключения к базе данных' });
  }
});

// ==============================|| ЛИДФОРМА API ||============================== //

// Лид-форма endpoints
app.post('/api/lead', leadRateLimit, createLead);
app.get('/api/leads/stats', getLeadsStats);

// Временный эндпоинт для инициализации таблицы лидов
app.post('/api/init-leads', async (req, res) => {
  try {
    await initializeLeadsTable();
    res.json({ success: true, message: 'Таблица лидов инициализирована' });
  } catch (error) {
    console.error('Ошибка инициализации таблицы лидов:', error);
    res.status(500).json({ error: 'Ошибка инициализации' });
  }
});

// ==============================|| ПРОЕКТЫ API ||============================== //

// authMiddleware удален - используется унифицированный authMiddleware

// Обновление профиля пользователя
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.sub;
    const { firstname, lastname, company, phone, position, location, bio } = req.body;

    // Валидация обязательных полей
    if (!firstname || !lastname) {
      return res.status(400).json({
        success: false,
        message: 'Имя и фамилия обязательны для заполнения'
      });
    }

    // Обновление профиля в базе данных
    const result = await query(
      `
      UPDATE auth_users 
      SET 
        firstname = $1,
        lastname = $2,
        company = $3,
        phone = $4,
        position = $5,
        location = $6,
        bio = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND is_active = true
      RETURNING id, email, firstname, lastname, company, phone, position, location, bio, created_at, updated_at
    `,
      [firstname, lastname, company, phone, position, location, bio, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Пользователь не найден или заблокирован'
      });
    }

    const updatedUser = result.rows[0];

    console.log(`📝 Профиль пользователя ${userId} обновлен`);

    res.json({
      success: true,
      message: 'Профиль успешно обновлен',
      data: {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstname: updatedUser.firstname,
          lastname: updatedUser.lastname,
          company: updatedUser.company,
          phone: updatedUser.phone,
          position: updatedUser.position,
          location: updatedUser.location,
          bio: updatedUser.bio,
          createdAt: updatedUser.created_at,
          updatedAt: updatedUser.updated_at
        }
      }
    });
  } catch (error) {
    console.error('❌ Ошибка обновления профиля:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// ==============================|| OBJECT PARAMETERS API ||============================== //

// 🔹 ШАГ 4 - Object Parameters API
// Получение параметров объекта по ID проекта (1:1 связь с проектом)
app.get('/api/projects/:id/object-parameters', authMiddleware, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;

    console.log(`📋 GET /api/projects/${projectId}/object-parameters [user=${userId}]`);

    // Проверяем существование проекта и наследуем tenant_id
    const projectCheck = await query(
      `
      SELECT id, tenant_id FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2
    `,
      [projectId, req.user.tenantId]
    );

    if (projectCheck.rows.length === 0) {
      console.log(`❌ Проект ${projectId} не найден или не принадлежит тенанту ${req.user.tenantId}`);
      return res.status(403).json({
        error: 'Проект не найден или отсутствует доступ',
        code: 'PROJECT_NOT_ACCESSIBLE'
      });
    }

    const projectTenantId = projectCheck.rows[0].tenant_id;

    // Получаем параметры объекта (1:1 связь с проектом)
    const result = await query(
      `
      SELECT 
        op.*,
        cp.customer_name as project_name,
        au.firstname || ' ' || au.lastname as created_by_name
      FROM object_parameters op
      LEFT JOIN construction_projects cp ON op.project_id = cp.id
      LEFT JOIN auth_users au ON op.user_id = au.id
      WHERE op.project_id = $1 AND op.tenant_id = $2
    `,
      [projectId, projectTenantId]
    );

    if (result.rows.length === 0) {
      console.log(`❌ Параметры объекта для проекта ${projectId} не найдены`);
      return res.status(404).json({
        error: 'Параметры объекта не найдены',
        code: 'OBJECT_PARAMETERS_NOT_FOUND'
      });
    }

    console.log(`✅ Найдены параметры объекта для проекта ${projectId}`);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Ошибка получения параметров объекта:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
});

// Создание/обновление параметров объекта (Idempotent Upsert)
app.put('/api/projects/:id/object-parameters', authMiddleware, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;

    console.log(`📝 PUT /api/projects/${projectId}/object-parameters [user=${userId}]`);
    console.log(`📦 Request body:`, req.body);

    // Валидация входных данных
    const {
      building_type,
      construction_category,
      floors_above_ground,
      floors_below_ground,
      height_above_ground,
      height_below_ground,
      total_area,
      building_area,
      estimated_cost,
      construction_complexity,
      seismic_zone,
      wind_load,
      snow_load,
      soil_conditions,
      groundwater_level,
      climate_zone
    } = req.body;

    // Строгая валидация обязательных полей
    if (!building_type || typeof building_type !== 'string') {
      return res.status(400).json({
        error: 'Поле building_type обязательно и должно быть строкой',
        code: 'VALIDATION_ERROR',
        field: 'building_type'
      });
    }

    if (
      construction_category !== undefined &&
      (!Number.isInteger(construction_category) || construction_category < 1 || construction_category > 5)
    ) {
      return res.status(400).json({
        error: 'Поле construction_category должно быть числом от 1 до 5',
        code: 'VALIDATION_ERROR',
        field: 'construction_category'
      });
    }

    // Проверяем существование проекта и получаем tenant_id (tenant inheritance)
    const projectCheck = await query(
      `
      SELECT id, tenant_id FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2
    `,
      [projectId, req.user.tenantId]
    );

    if (projectCheck.rows.length === 0) {
      console.log(`❌ Проект ${projectId} не найден или не принадлежит тенанту ${req.user.tenantId}`);
      return res.status(403).json({
        error: 'Проект не найден или отсутствует доступ',
        code: 'PROJECT_NOT_ACCESSIBLE'
      });
    }

    const projectTenantId = projectCheck.rows[0].tenant_id;
    console.log(`✅ Проект ${projectId} найден, tenant: ${projectTenantId}`);

    // Idempotent Upsert: проверяем существуют ли параметры
    const existingParams = await query(
      `
      SELECT id FROM object_parameters 
      WHERE project_id = $1 AND tenant_id = $2
    `,
      [projectId, projectTenantId]
    );

    let result;

    if (existingParams.rows.length > 0) {
      // Обновляем существующие параметры (UPDATE часть upsert)
      console.log(`🔄 Обновление существующих параметров объекта для проекта ${projectId}`);

      result = await query(
        `
        UPDATE object_parameters SET
          building_type = $3,
          construction_category = $4,
          floors_above_ground = $5,
          floors_below_ground = $6,
          height_above_ground = $7,
          height_below_ground = $8,
          total_area = $9,
          building_area = $10,
          estimated_cost = $11,
          construction_complexity = $12,
          seismic_zone = $13,
          wind_load = $14,
          snow_load = $15,
          soil_conditions = $16,
          groundwater_level = $17,
          climate_zone = $18,
          updated_at = CURRENT_TIMESTAMP
        WHERE project_id = $1 AND tenant_id = $2
        RETURNING *, 'updated' as operation
      `,
        [
          projectId,
          projectTenantId,
          building_type,
          construction_category || null,
          floors_above_ground || null,
          floors_below_ground || null,
          height_above_ground || null,
          height_below_ground || null,
          total_area || null,
          building_area || null,
          estimated_cost || null,
          construction_complexity || null,
          seismic_zone || null,
          wind_load || null,
          snow_load || null,
          soil_conditions || null,
          groundwater_level || null,
          climate_zone || null
        ]
      );
    } else {
      // Создаем новые параметры (INSERT часть upsert)
      console.log(`➕ Создание новых параметров объекта для проекта ${projectId}`);

      result = await query(
        `
        INSERT INTO object_parameters (
          project_id, building_type, construction_category, floors_above_ground, 
          floors_below_ground, height_above_ground, height_below_ground, total_area, 
          building_area, estimated_cost, construction_complexity, seismic_zone, 
          wind_load, snow_load, soil_conditions, groundwater_level, climate_zone,
          user_id, tenant_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *, 'created' as operation
      `,
        [
          projectId,
          building_type,
          construction_category || null,
          floors_above_ground || null,
          floors_below_ground || null,
          height_above_ground || null,
          height_below_ground || null,
          total_area || null,
          building_area || null,
          estimated_cost || null,
          construction_complexity || null,
          seismic_zone || null,
          wind_load || null,
          snow_load || null,
          soil_conditions || null,
          groundwater_level || null,
          climate_zone || null,
          userId,
          projectTenantId
        ]
      );
    }

    const objectParams = result.rows[0];
    const operation = objectParams.operation;
    delete objectParams.operation;

    console.log(`✅ Параметры объекта ${operation === 'created' ? 'созданы' : 'обновлены'} для проекта ${projectId}`);

    res.status(operation === 'created' ? 201 : 200).json({
      success: true,
      message: `Параметры объекта ${operation === 'created' ? 'созданы' : 'обновлены'}`,
      operation: operation,
      data: objectParams
    });
  } catch (error) {
    console.error('❌ Ошибка создания/обновления параметров объекта:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

// ==============================|| PROJECT ROOMS API ||============================== //

// Создание помещения проекта
app.post('/api/object-parameters/:objectParamsId/rooms', authMiddleware, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const tenantId = req.user.tenantId || 'default-tenant';

    const {
      roomName,
      area,
      height,
      volume,
      finishClass,
      purpose,
      sortOrder,
      perimeter,
      prostenki,
      doorsCount,
      window1Width,
      window1Height,
      window2Width,
      window2Height,
      window3Width,
      window3Height,
      portal1Width,
      portal1Height,
      portal2Width,
      portal2Height
    } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: 'Название помещения обязательно' });
    }

    console.log('🏠 POST /api/object-parameters/:objectParamsId/rooms');
    console.log(`   📋 Данные:`, {
      objectParamsId,
      tenantId: `${tenantId?.substring(0, 8)}...`,
      body: req.body
    });

    // Проверяем существование object_parameters
    const objectParamsCheck = await query(
      `
      SELECT id FROM object_parameters 
      WHERE id = $1 AND tenant_id = $2
    `,
      [objectParamsId, tenantId]
    );

    console.log(`   🔍 Проверка object_parameters: найдено ${objectParamsCheck.rows.length} записей`);

    if (objectParamsCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Параметры объекта не найдены',
        code: 'OBJECT_PARAMETERS_NOT_FOUND'
      });
    }

    const result = await query(
      `
      INSERT INTO project_rooms (
        object_parameters_id, room_name, area, height, volume, finish_class, purpose, sort_order,
        perimeter, prostenki, doors_count,
        window1_width, window1_height, window2_width, window2_height, window3_width, window3_height,
        portal1_width, portal1_height, portal2_width, portal2_height,
        user_id, tenant_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `,
      [
        objectParamsId,
        roomName,
        area,
        height,
        volume,
        finishClass,
        purpose,
        sortOrder,
        perimeter,
        prostenki,
        doorsCount,
        window1Width,
        window1Height,
        window2Width,
        window2Height,
        window3Width,
        window3Height,
        portal1Width,
        portal1Height,
        portal2Width,
        portal2Height,
        userId,
        tenantId
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Помещение добавлено',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания помещения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение помещений для параметров объекта
app.get('/api/object-parameters/:objectParamsId/rooms', authMiddleware, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const tenantId = req.user.tenantId || 'default-tenant';

    const result = await query(
      `
      SELECT * FROM project_rooms 
      WHERE object_parameters_id = $1 AND tenant_id = $2
      ORDER BY sort_order, room_name
    `,
      [objectParamsId, tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения помещений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление помещения
app.put('/api/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const tenantId = req.user.tenantId || 'default-tenant';

    console.log(`📝 PUT /api/rooms/${roomId} [user=${userId}]`);
    console.log(`📦 Request body:`, req.body);

    const {
      roomName,
      area,
      height,
      volume,
      finishClass,
      purpose,
      sortOrder,
      perimeter,
      prostenki,
      doorsCount,
      window1Width,
      window1Height,
      window2Width,
      window2Height,
      window3Width,
      window3Height,
      portal1Width,
      portal1Height,
      portal2Width,
      portal2Height
    } = req.body;

    const result = await query(
      `
      UPDATE project_rooms SET
        room_name = $2,
        area = $3,
        height = $4,
        volume = $5,
        finish_class = $6,
        purpose = $7,
        sort_order = $8,
        perimeter = $9,
        prostenki = $10,
        doors_count = $11,
        window1_width = $12,
        window1_height = $13,
        window2_width = $14,
        window2_height = $15,
        window3_width = $16,
        window3_height = $17,
        portal1_width = $18,
        portal1_height = $19,
        portal2_width = $20,
        portal2_height = $21,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $22
      RETURNING *
      `,
      [
        roomId,
        roomName,
        area,
        height,
        volume,
        finishClass,
        purpose,
        sortOrder,
        perimeter,
        prostenki,
        doorsCount,
        window1Width,
        window1Height,
        window2Width,
        window2Height,
        window3Width,
        window3Height,
        portal1Width,
        portal1Height,
        portal2Width,
        portal2Height,
        tenantId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Помещение не найдено',
        code: 'ROOM_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Помещение обновлено',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка обновления помещения:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

// Удаление помещения
app.delete('/api/rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const tenantId = req.user.tenantId || 'default-tenant';

    console.log(`🗑️ DELETE /api/rooms/${roomId} [user=${userId}]`);

    const result = await query(
      `
      DELETE FROM project_rooms 
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
      `,
      [roomId, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Помещение не найдено',
        code: 'ROOM_NOT_FOUND'
      });
    }

    res.json({
      success: true,
      message: 'Помещение удалено',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка удаления помещения:', error);
    res.status(500).json({
      error: 'Ошибка сервера',
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message
    });
  }
});

// ==============================|| STEP 5: MATERIALS / WORKS / WORK-MATERIALS API ||============================== //

// 🔹 ШАГ 5.1 — Works API (Справочник работ)
// GET /api/works - получить все работы с фильтрацией
app.get('/api/works', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0, search = '', phase_id = '', stage_id = '', substage_id = '' } = req.query;

    console.log(`📋 GET /api/works - получение справочника работ`);

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Поиск по названию
    if (search) {
      whereConditions.push(`w.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Фильтр по фазе
    if (phase_id) {
      whereConditions.push(`w.phase_id = $${paramIndex}`);
      params.push(phase_id);
      paramIndex++;
    }

    // Фильтр по стадии
    if (stage_id) {
      whereConditions.push(`w.stage_id = $${paramIndex}`);
      params.push(stage_id);
      paramIndex++;
    }

    // Фильтр по подстадии
    if (substage_id) {
      whereConditions.push(`w.substage_id = $${paramIndex}`);
      params.push(substage_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Получаем общее количество
    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM works_ref w
      ${whereClause}
    `,
      params
    );

    // Добавляем лимит и оффсет
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    // Получаем данные с пагинацией
    const result = await query(
      `
      SELECT 
        w.*,
        COALESCE(w.phase_name, w.phase_id::text) as phase_name,
        COALESCE(w.stage_name, w.stage_id) as stage_name,
        COALESCE(w.substage_name, w.substage_id) as substage_name
      FROM works_ref w
      ${whereClause}
      ORDER BY w.sort_order, w.id
      LIMIT $${paramIndex - 1} OFFSET $${paramIndex}
    `,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    console.log(`📊 Найдено работ: ${result.rows.length}/${total} (page ${Math.floor(offset / limit) + 1}/${totalPages})`);

    res.json({
      data: result.rows,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения справочника работ:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/works/:id - получить работу по ID
app.get('/api/works/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📋 GET /api/works/${id} - получение работы`);

    const result = await query(
      `
      SELECT 
        w.*,
        COALESCE(p.name, w.phase_id::text) as phase_name,
        COALESCE(s.name, w.stage_id) as stage_name,
        COALESCE(ss.name, w.substage_id) as substage_name
      FROM works_ref w
      LEFT JOIN phases p ON w.phase_id = p.id::text
      LEFT JOIN stages s ON w.stage_id = s.id
      LEFT JOIN substages ss ON w.substage_id = ss.id
      WHERE w.id = $1
    `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    console.log(`✅ Работа найдена: ${result.rows[0].name}`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка получения работы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/works/:id/materials - получить материалы для работы
app.get('/api/works/:id/materials', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    console.log(`📋 GET /api/works/${id}/materials - получение материалов для работы`);

    // Проверим существование работы
    const workCheck = await query('SELECT id, name FROM works_ref WHERE id = $1', [id]);
    if (workCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Работа не найдена' });
    }

    // Получаем материалы для работы с учетом tenant overrides
    const result = await query(
      `
      SELECT 
        wm.work_id,
        wm.material_id,
        wm.consumption_per_work_unit,
        wm.waste_coeff,
        wm.created_at as link_created_at,
        wm.updated_at as link_updated_at,
        
        -- Информация о работе
        w.name as work_name,
        w.unit as work_unit,
        w.unit_price as work_unit_price,
        
        -- Информация о материале (приоритет: tenant > global)
        COALESCE(mt.name, mg.name) as material_name,
        COALESCE(mt.unit, mg.unit) as material_unit,
        COALESCE(mt.unit_price, mg.unit_price) as material_unit_price,
        COALESCE(mt.image_url, mg.image_url) as material_image_url,
        COALESCE(mt.item_url, mg.item_url) as material_item_url,
        CASE 
          WHEN mt.id IS NOT NULL THEN 'tenant'
          ELSE 'global'
        END as material_source,
        
        -- Расчетные поля
        (wm.consumption_per_work_unit * wm.waste_coeff) as total_consumption,
        (COALESCE(mt.unit_price, mg.unit_price)::decimal * wm.consumption_per_work_unit * wm.waste_coeff) as material_cost_per_work_unit
        
      FROM work_materials wm
      LEFT JOIN works_ref w ON wm.work_id = w.id
      LEFT JOIN materials mg ON wm.material_id = mg.id AND mg.tenant_id IS NULL  -- Глобальный материал
      LEFT JOIN materials mt ON wm.material_id = mt.id AND mt.tenant_id = $2     -- Tenant override
      WHERE wm.work_id = $1
      ORDER BY mg.name, mt.name
    `,
      [id, tenantId]
    );

    console.log(`📊 Найдено материалов для работы ${workCheck.rows[0].name}: ${result.rows.length}`);

    res.json({
      success: true,
      work: workCheck.rows[0],
      materials_count: result.rows.length,
      data: result.rows
    });
  } catch (error) {
    console.error('❌ Ошибка получения материалов для работы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🔹 ШАГ 5.2 — Materials API (Справочник материалов с tenant overrides)
// GET /api/materials - получить материалы (global + tenant)
app.get('/api/materials', authMiddleware, async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      search = '',
      source = 'all' // 'global', 'tenant', 'all'
    } = req.query;

    const tenantId = req.user.tenantId;

    console.log(`📋 GET /api/materials - получение справочника материалов (source: ${source})`);

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Поиск по названию
    if (search) {
      whereConditions.push(`m.name ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Фильтр по источнику
    if (source === 'global') {
      whereConditions.push('m.tenant_id IS NULL');
    } else if (source === 'tenant') {
      whereConditions.push(`m.tenant_id = $${paramIndex}`);
      params.push(tenantId);
      paramIndex++;
    } else {
      // source = 'all' - показываем global + tenant
      whereConditions.push(`(m.tenant_id IS NULL OR m.tenant_id = $${paramIndex})`);
      params.push(tenantId);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Получаем общее количество
    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM materials m
      ${whereClause}
    `,
      params
    );

    // Добавляем лимит и оффсет
    params.push(parseInt(limit));
    params.push(parseInt(offset));

    // Получаем данные с пагинацией
    const result = await query(
      `
      SELECT 
        m.*,
        CASE 
          WHEN m.tenant_id IS NULL THEN 'global'
          ELSE 'tenant'
        END as source
      FROM materials m
      ${whereClause}
      ORDER BY m.name, m.id
      LIMIT $${paramIndex - 1} OFFSET $${paramIndex}
    `,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    console.log(`📊 Найдено материалов: ${result.rows.length}/${total} (page ${Math.floor(offset / limit) + 1}/${totalPages})`);

    res.json({
      data: result.rows,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: total,
        totalPages: totalPages
      },
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Ошибка получения справочника материалов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// GET /api/materials/:id - получить материал по ID
app.get('/api/materials/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user.tenantId;

    console.log(`📋 GET /api/materials/${id} - получение материала`);

    // Приоритет: tenant override > global
    const result = await query(
      `
      SELECT 
        m.*,
        CASE 
          WHEN m.tenant_id IS NULL THEN 'global'
          ELSE 'tenant'
        END as source
      FROM materials m
      WHERE m.id = $1 
        AND (m.tenant_id IS NULL OR m.tenant_id = $2)
      ORDER BY m.tenant_id NULLS LAST
      LIMIT 1
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Материал не найден' });
    }

    console.log(`✅ Материал найден: ${result.rows[0].name} (${result.rows[0].source})`);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка получения материала:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/materials - создать tenant override материала
app.post('/api/materials', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    // eslint-disable-next-line no-unused-vars
    const userId = req.user.userId || req.user.id;

    const {
      base_material_id, // ID глобального материала для override
      name,
      unit,
      unit_price,
      image_url,
      item_url,
      expenditure,
      weight
    } = req.body;

    console.log(`📝 POST /api/materials - создание tenant override материала`);

    // Валидация обязательных полей
    if (!base_material_id) {
      return res.status(400).json({ error: 'base_material_id обязателен для tenant override' });
    }

    if (!name || !unit || !unit_price) {
      return res.status(400).json({ error: 'Название, единица измерения и цена обязательны' });
    }

    // Проверяем существование базового материала
    const baseCheck = await query(
      `
      SELECT id, name FROM materials 
      WHERE id = $1 AND tenant_id IS NULL
    `,
      [base_material_id]
    );

    if (baseCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Базовый материал не найден в глобальном справочнике' });
    }

    // Проверяем, нет ли уже override для этого tenant
    const existingOverride = await query(
      `
      SELECT id FROM materials 
      WHERE id = $1 AND tenant_id = $2
    `,
      [base_material_id, tenantId]
    );

    if (existingOverride.rows.length > 0) {
      return res.status(409).json({
        error: 'Tenant override для этого материала уже существует',
        existing_id: existingOverride.rows[0].id
      });
    }

    // Создаем tenant override (используем тот же ID)
    const result = await query(
      `
      INSERT INTO materials (
        id, name, unit, unit_price, image_url, item_url, 
        expenditure, weight, tenant_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `,
      [
        base_material_id, // Тот же ID что и у базового материала
        name,
        unit,
        parseFloat(unit_price),
        image_url || null,
        item_url || null,
        expenditure ? parseFloat(expenditure) : null,
        weight ? parseFloat(weight) : null,
        tenantId
      ]
    );

    console.log(`✅ Tenant override создан: ${result.rows[0].name} (tenant: ${tenantId})`);

    res.status(201).json({
      success: true,
      message: 'Tenant override материала создан',
      base_material: baseCheck.rows[0],
      data: {
        ...result.rows[0],
        source: 'tenant'
      }
    });
  } catch (error) {
    console.error('❌ Ошибка создания tenant override материала:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// 🔹 ШАГ 5.3 — Work-Materials API (Связи работ-материалов)
// GET /api/work-materials - получить все связи работ-материалов
app.get('/api/work-materials', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0, work_id = '', material_id = '' } = req.query;

    const tenantId = req.user.tenantId;

    console.log(`📋 GET /api/work-materials - получение связей работ-материалов`);

    let whereConditions = [];
    let params = [];
    let paramIndex = 1;

    // Фильтр по работе
    if (work_id) {
      whereConditions.push(`wm.work_id = $${paramIndex}`);
      params.push(work_id);
      paramIndex++;
    }

    // Фильтр по материалу
    if (material_id) {
      whereConditions.push(`wm.material_id = $${paramIndex}`);
      params.push(material_id);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Получаем общее количество
    const countResult = await query(
      `
      SELECT COUNT(*) as total
      FROM work_materials wm
      ${whereClause}
    `,
      params
    );

    // Добавляем лимит и оффсет
    params.push(parseInt(limit));
    params.push(parseInt(offset));
    params.push(tenantId); // Для tenant override материалов

    // Получаем данные с JOIN
    const result = await query(
      `
      SELECT 
        wm.*,
        
        -- Информация о работе
        w.name as work_name,
        w.unit as work_unit,
        w.unit_price as work_unit_price,
        
        -- Информация о материале (приоритет: tenant > global)  
        COALESCE(mt.name, mg.name) as material_name,
        COALESCE(mt.unit, mg.unit) as material_unit,
        COALESCE(mt.unit_price, mg.unit_price) as material_unit_price,
        COALESCE(mt.image_url, mg.image_url) as material_image_url,
        COALESCE(mt.item_url, mg.item_url) as material_item_url,
        CASE 
          WHEN mt.id IS NOT NULL THEN 'tenant'
          ELSE 'global'
        END as material_source,
        
        -- Расчетные поля
        (wm.consumption_per_work_unit * wm.waste_coeff) as total_consumption,
        (COALESCE(mt.unit_price, mg.unit_price)::decimal * wm.consumption_per_work_unit * wm.waste_coeff) as material_cost_per_work_unit
        
      FROM work_materials wm
      LEFT JOIN works_ref w ON wm.work_id = w.id
      LEFT JOIN materials mg ON wm.material_id = mg.id AND mg.tenant_id IS NULL  -- Глобальный материал
      LEFT JOIN materials mt ON wm.material_id = mt.id AND mt.tenant_id = $${paramIndex}     -- Tenant override
      ${whereClause}
      ORDER BY w.name, mg.name, mt.name
      LIMIT $${paramIndex - 2} OFFSET $${paramIndex - 1}
    `,
      params
    );

    const total = parseInt(countResult.rows[0].total);
    const totalPages = Math.ceil(total / limit);

    console.log(
      `📊 Найдено связей работ-материалов: ${result.rows.length}/${total} (page ${Math.floor(offset / limit) + 1}/${totalPages})`
    );

    res.json({
      data: result.rows,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit: parseInt(limit),
        total: total,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('❌ Ошибка получения связей работ-материалов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /api/work-materials/bulk - массовое создание связей работ-материалов
app.post('/api/work-materials/bulk', authMiddleware, async (req, res) => {
  try {
    const { relations } = req.body;

    console.log(`📝 POST /api/work-materials/bulk - массовое создание связей`);

    if (!Array.isArray(relations) || relations.length === 0) {
      return res.status(400).json({ error: 'Массив relations обязателен и не должен быть пустым' });
    }

    // Валидация каждой связи
    for (let i = 0; i < relations.length; i++) {
      const rel = relations[i];
      if (!rel.work_id || !rel.material_id || !rel.consumption_per_work_unit) {
        return res.status(400).json({
          error: `Связь ${i}: work_id, material_id и consumption_per_work_unit обязательны`
        });
      }
    }

    const results = [];
    const errors = [];

    // Обрабатываем каждую связь
    for (let i = 0; i < relations.length; i++) {
      try {
        const { work_id, material_id, consumption_per_work_unit, waste_coeff = 1.0 } = relations[i];

        // Проверяем существование работы
        const workCheck = await query('SELECT id FROM works_ref WHERE id = $1', [work_id]);
        if (workCheck.rows.length === 0) {
          errors.push({ index: i, error: `Работа ${work_id} не найдена` });
          continue;
        }

        // Проверяем существование материала (глобального)
        const materialCheck = await query('SELECT id FROM materials WHERE id = $1 AND tenant_id IS NULL', [material_id]);
        if (materialCheck.rows.length === 0) {
          errors.push({ index: i, error: `Материал ${material_id} не найден в глобальном справочнике` });
          continue;
        }

        // Создаем или обновляем связь (UPSERT)
        const result = await query(
          `
          INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff, created_at, updated_at)
          VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT (work_id, material_id) 
          DO UPDATE SET
            consumption_per_work_unit = EXCLUDED.consumption_per_work_unit,
            waste_coeff = EXCLUDED.waste_coeff,
            updated_at = CURRENT_TIMESTAMP
          RETURNING *, 
            CASE WHEN xmax = 0 THEN 'created' ELSE 'updated' END as operation
        `,
          [work_id, material_id, parseFloat(consumption_per_work_unit), parseFloat(waste_coeff)]
        );

        results.push({
          index: i,
          operation: result.rows[0].operation,
          data: result.rows[0]
        });
      } catch (error) {
        errors.push({
          index: i,
          error: error.message
        });
      }
    }

    console.log(`✅ Обработано связей: ${results.length} успешно, ${errors.length} ошибок`);

    res.status(errors.length > 0 ? 207 : 201).json({
      // 207 Multi-Status
      success: errors.length === 0,
      message: `Обработано: ${results.length} успешно, ${errors.length} ошибок`,
      results: results,
      errors: errors,
      summary: {
        total: relations.length,
        created: results.filter((r) => r.operation === 'created').length,
        updated: results.filter((r) => r.operation === 'updated').length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('❌ Ошибка массового создания связей работ-материалов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==============================|| CONSTRUCTIVE ELEMENTS API ||============================== //

// Получение конструктивных элементов объекта
app.get('/api/object-parameters/:objectParamsId/constructive-elements', authMiddleware, async (req, res) => {
  try {
    const { objectParamsId } = req.params;

    const result = await query(
      `
      SELECT ce.*, 
             au.firstname || ' ' || au.lastname as created_by_name
      FROM constructive_elements ce
      LEFT JOIN auth_users au ON ce.user_id = au.id
      WHERE ce.object_parameters_id = $1
      ORDER BY ce.element_type, ce.id
    `,
      [objectParamsId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения конструктивных элементов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание конструктивного элемента
app.post('/api/object-parameters/:objectParamsId/constructive-elements', authMiddleware, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const { elementType, material, characteristics, quantity, unit, notes } = req.body;

    if (!elementType) {
      return res.status(400).json({ error: 'Тип конструктивного элемента обязателен' });
    }

    // Убираем tenant_id - поле nullable
    const result = await query(
      `
      INSERT INTO constructive_elements (
        object_parameters_id, element_type, material, characteristics, 
        quantity, unit, notes, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [objectParamsId, elementType, material, characteristics, quantity, unit, notes, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Конструктивный элемент добавлен',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания конструктивного элемента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление конструктивного элемента
app.put('/api/constructive-elements/:elementId', authMiddleware, async (req, res) => {
  try {
    const { elementId } = req.params;
    const { elementType, material, characteristics, quantity, unit, notes } = req.body;

    const result = await query(
      `
      UPDATE constructive_elements SET
        element_type = $1, material = $2, characteristics = $3, 
        quantity = $4, unit = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `,
      [elementType, material, characteristics, quantity, unit, notes, elementId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Конструктивный элемент не найден' });
    }

    res.json({
      success: true,
      message: 'Конструктивный элемент обновлен',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления конструктивного элемента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление конструктивного элемента
app.delete('/api/constructive-elements/:elementId', authMiddleware, async (req, res) => {
  try {
    const { elementId } = req.params;

    const result = await query('DELETE FROM constructive_elements WHERE id = $1 RETURNING *', [elementId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Конструктивный элемент не найден' });
    }

    res.json({
      success: true,
      message: 'Конструктивный элемент удален'
    });
  } catch (error) {
    console.error('Ошибка удаления конструктивного элемента:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==============================|| ENGINEERING SYSTEMS API ||============================== //

// Получение инженерных систем объекта
app.get('/api/object-parameters/:objectParamsId/engineering-systems', authMiddleware, async (req, res) => {
  try {
    const { objectParamsId } = req.params;

    const result = await query(
      `
      SELECT es.*, 
             au.firstname || ' ' || au.lastname as created_by_name
      FROM engineering_systems es
      LEFT JOIN auth_users au ON es.user_id = au.id
      WHERE es.object_parameters_id = $1
      ORDER BY es.system_type, es.id
    `,
      [objectParamsId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения инженерных систем:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание инженерной системы
app.post('/api/object-parameters/:objectParamsId/engineering-systems', authMiddleware, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const { systemType, characteristics, capacity, efficiency, notes } = req.body;

    if (!systemType) {
      return res.status(400).json({ error: 'Тип инженерной системы обязателен' });
    }

    // Убираем tenant_id - поле nullable
    const result = await query(
      `
      INSERT INTO engineering_systems (
        object_parameters_id, system_type, characteristics, 
        capacity, efficiency, notes, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [objectParamsId, systemType, characteristics, capacity, efficiency, notes, userId]
    );

    res.status(201).json({
      success: true,
      message: 'Инженерная система добавлена',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания инженерной системы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление инженерной системы
app.put('/api/engineering-systems/:systemId', authMiddleware, async (req, res) => {
  try {
    const { systemId } = req.params;
    const { systemType, characteristics, capacity, efficiency, notes } = req.body;

    const result = await query(
      `
      UPDATE engineering_systems SET
        system_type = $1, characteristics = $2, capacity = $3, 
        efficiency = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `,
      [systemType, characteristics, capacity, efficiency, notes, systemId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Инженерная система не найдена' });
    }

    res.json({
      success: true,
      message: 'Инженерная система обновлена',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления инженерной системы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление инженерной системы
app.delete('/api/engineering-systems/:systemId', authMiddleware, async (req, res) => {
  try {
    const { systemId } = req.params;

    const result = await query('DELETE FROM engineering_systems WHERE id = $1 RETURNING *', [systemId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Инженерная система не найдена' });
    }

    res.json({
      success: true,
      message: 'Инженерная система удалена'
    });
  } catch (error) {
    console.error('Ошибка удаления инженерной системы:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==============================|| ROLES API ||============================== //

// Получение всех ролей
app.get('/api/roles', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT ur.*, 
             COUNT(ura.user_id) as users_count
      FROM user_roles ur
      LEFT JOIN user_role_assignments ura ON ur.id = ura.role_id AND ura.is_active = true
      WHERE ur.is_active = true
      GROUP BY ur.id
      ORDER BY ur.name
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения ролей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение ролей пользователя
app.get('/api/users/:userId/roles', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await query(
      `
      SELECT ur.*, ura.assigned_at, ura.expires_at,
             assigner.firstname || ' ' || assigner.lastname as assigned_by_name
      FROM user_roles ur
      JOIN user_role_assignments ura ON ur.id = ura.role_id
      LEFT JOIN auth_users assigner ON ura.assigned_by = assigner.id
      WHERE ura.user_id = $1 AND ura.is_active = true
      ORDER BY ura.assigned_at DESC
    `,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения ролей пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Назначение роли пользователю
app.post('/api/users/:userId/roles', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleId } = req.body;
    const assignerId = req.user?.id; // ID того, кто назначает роль

    // Проверяем, существует ли пользователь
    const userResult = await query('SELECT id FROM auth_users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем, существует ли роль
    const roleResult = await query('SELECT id, name FROM user_roles WHERE id = $1 AND is_active = true', [roleId]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Роль не найдена' });
    }

    // Назначаем роль (или обновляем если уже есть)
    const assignmentResult = await query(
      `
      INSERT INTO user_role_assignments (user_id, role_id, assigned_by, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (user_id, role_id, tenant_id) 
      DO UPDATE SET is_active = true, assigned_by = $3, assigned_at = CURRENT_TIMESTAMP
      RETURNING *
    `,
      [userId, roleId, assignerId]
    );

    res.json({
      success: true,
      message: `Роль "${roleResult.rows[0].name}" назначена пользователю`,
      assignment: assignmentResult.rows[0]
    });
  } catch (error) {
    console.error('Ошибка назначения роли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Отзыв роли у пользователя
app.delete('/api/users/:userId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    const result = await query(
      `
      UPDATE user_role_assignments 
      SET is_active = false 
      WHERE user_id = $1 AND role_id = $2
      RETURNING *
    `,
      [userId, roleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Назначение роли не найдено' });
    }

    res.json({
      success: true,
      message: 'Роль отозвана у пользователя'
    });
  } catch (error) {
    console.error('Ошибка отзыва роли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение всех пользователей (для админов) - ОТКЛЮЧЕНО - используется версия с roles массивом ниже
/*
app.get('/api/users', authMiddleware, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        au.id, 
        au.email, 
        au.firstname, 
        au.lastname, 
        au.company, 
        au.is_active,
        au.created_at,
        au.last_login,
        COUNT(ura.id) as roles_count,
        STRING_AGG(ur.name, ', ') as role_names
      FROM auth_users au
      LEFT JOIN user_role_assignments ura ON au.id = ura.user_id AND ura.is_active = true
      LEFT JOIN user_roles ur ON ura.role_id = ur.id
      WHERE au.is_active = true
      GROUP BY au.id
      ORDER BY au.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
*/

// Удаление роли у пользователя
app.delete('/api/users/:userId/roles/:roleId', authMiddleware, async (req, res) => {
  try {
    const { userId, roleId } = req.params;

    // Проверяем права на удаление роли (только админы и суперадмины)
    // TODO: добавить проверку ролей

    const result = await query(
      `
      UPDATE user_role_assignments 
      SET is_active = false, 
          assigned_by = $1, 
          assigned_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND role_id = $3 AND is_active = true
      RETURNING *
    `,
      [req.user?.id, userId, roleId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Назначение роли не найдено' });
    }

    res.json({
      success: true,
      message: 'Роль отозвана'
    });
  } catch (error) {
    console.error('Ошибка отзыва роли:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение всех пользователей с их ролями (только для админов)
app.get('/api/users', authMiddleware, async (req, res) => {
  console.log('🔥 USING NEW API ENDPOINT WITH ROLES ARRAY');
  try {
    const usersResult = await query(`
      SELECT 
        au.id,
        au.email,
        au.firstname,
        au.lastname,
        au.company,
        au.phone,
        au.position,
        au.location,
        au.is_active,
        au.email_verified,
        au.created_at,
        au.updated_at
      FROM auth_users au
      WHERE au.id != 0  -- исключаем системных пользователей
      ORDER BY au.created_at DESC
    `);

    // Для каждого пользователя получаем его роли
    for (const user of usersResult.rows) {
      const rolesResult = await query(
        `
        SELECT ur.id, ur.name, ur.description, ura.assigned_at
        FROM user_roles ur
        JOIN user_role_assignments ura ON ur.id = ura.role_id
        WHERE ura.user_id = $1 AND ura.is_active = true
        ORDER BY ura.assigned_at DESC
      `,
        [user.id]
      );

      user.roles = rolesResult.rows;
    }

    res.json(usersResult.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение всех проектов с пагинацией и поиском (целевая модель)
app.get('/api/projects', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const { search, offset = 0, limit = 20, sort = 'created_at', order = 'desc' } = req.query;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    console.log(`📋 Запрос проектов для тенанта: ${tenantId.substring(0, 8)}...`);

    // Валидация параметров
    const validSortFields = ['created_at', 'deadline', 'project_code', 'customer_name'];
    const validOrder = ['asc', 'desc'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = validOrder.includes(order.toLowerCase()) ? order.toUpperCase() : 'DESC';
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // ограничение 1-100
    const offsetNum = Math.max(parseInt(offset) || 0, 0);

    // Построение WHERE условий
    let whereConditions = ['cp.tenant_id = $1'];
    let params = [tenantId];
    let paramIndex = 2;

    if (search) {
      whereConditions.push(`(
        cp.customer_name ILIKE $${paramIndex} OR 
        cp.object_address ILIKE $${paramIndex} OR 
        cp.contract_number ILIKE $${paramIndex} OR 
        cp.project_code ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Запрос общего количества (для пагинации)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM construction_projects cp
      WHERE ${whereClause}
    `;

    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Основной запрос с пагинацией
    const dataQuery = `
      SELECT 
        cp.id,
        cp.customer_name,
        cp.object_address,
        cp.contractor_name,
        cp.contract_number,
        cp.deadline,
        cp.project_code,
        cp.status,
        cp.tenant_id,
        cp.created_at,
        cp.updated_at,
        au.firstname || ' ' || au.lastname as created_by_name,
        au.email as created_by_email
      FROM construction_projects cp
      LEFT JOIN auth_users au ON cp.user_id = au.id
      WHERE ${whereClause}
      ORDER BY cp.${sortField} ${sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limitNum, offsetNum);
    const result = await query(dataQuery, params);

    console.log(`📊 Найдено проектов: ${result.rows.length}/${total} (offset: ${offsetNum}, limit: ${limitNum})`);

    res.json({
      items: result.rows,
      total,
      offset: offsetNum,
      limit: limitNum,
      hasMore: offsetNum + limitNum < total
    });
  } catch (error) {
    console.error('❌ Ошибка получения проектов:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Создание нового проекта (целевая модель)
app.post('/api/projects', authMiddleware, async (req, res) => {
  try {
    const { customerName, objectAddress, contractorName, contractNumber, deadline, projectCode } = req.body;
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Валидация обязательных полей
    if (!customerName || !objectAddress || !contractorName || !contractNumber || !deadline) {
      return res.status(400).json({
        error: 'Обязательные поля: customerName, objectAddress, contractorName, contractNumber, deadline',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Валидация projectCode если передан
    if (projectCode && (typeof projectCode !== 'string' || projectCode.length > 50)) {
      return res.status(400).json({
        error: 'projectCode должен быть строкой до 50 символов',
        code: 'INVALID_PROJECT_CODE'
      });
    }

    console.log(`🔍 Создание проекта для тенанта: ${tenantId.substring(0, 8)}...`);

    const result = await query(
      `
      INSERT INTO construction_projects (
        customer_name, object_address, contractor_name, contract_number, deadline,
        project_code, tenant_id, user_id, status, created_at, updated_at
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) 
      RETURNING 
        id, customer_name, object_address, contractor_name, contract_number, 
        deadline, project_code, status, tenant_id, created_at, updated_at
    `,
      [customerName, objectAddress, contractorName, contractNumber, deadline, projectCode, tenantId, userId, 'draft']
    );

    console.log(`✅ Проект создан: ID=${result.rows[0].id}, код=${projectCode || 'нет'}, тенант=${tenantId.substring(0, 8)}...`);

    res.status(201).json({
      success: true,
      message: 'Проект успешно создан',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка создания проекта:', error);

    if (error.code === '23505') {
      // Уникальное нарушение - проверяем какое именно
      if (error.constraint && error.constraint.includes('tenant_code')) {
        return res.status(409).json({
          error: 'Проект с таким кодом уже существует в данном тенанте',
          code: 'PROJECT_CODE_CONFLICT'
        });
      } else {
        return res.status(409).json({
          error: 'Проект с такими данными уже существует',
          code: 'DUPLICATE_PROJECT'
        });
      }
    }

    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Получение проекта по ID (целевая модель)
app.get('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    const result = await query(
      `
      SELECT 
        cp.id,
        cp.customer_name,
        cp.object_address,
        cp.contractor_name,
        cp.contract_number,
        cp.deadline,
        cp.project_code,
        cp.status,
        cp.tenant_id,
        cp.created_at,
        cp.updated_at,
        au.firstname || ' ' || au.lastname as created_by_name,
        au.email as created_by_email
      FROM construction_projects cp
      LEFT JOIN auth_users au ON cp.user_id = au.id
      WHERE cp.id = $1 AND cp.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      // Проверяем, существует ли проект вообще
      const existsCheck = await query('SELECT id FROM construction_projects WHERE id = $1', [id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к проекту другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Проект не найден',
          code: 'PROJECT_NOT_FOUND'
        });
      }
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Ошибка получения проекта:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Обновление проекта (целевая модель)
app.put('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, objectAddress, contractorName, contractNumber, deadline, projectCode, status } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Проверяем существование проекта в текущем тенанте
    const existingProject = await query(
      `
      SELECT id, project_code FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existingProject.rows.length === 0) {
      // Проверяем, существует ли проект вообще
      const existsCheck = await query('SELECT id FROM construction_projects WHERE id = $1', [id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к проекту другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Проект не найден',
          code: 'PROJECT_NOT_FOUND'
        });
      }
    }

    // Валидация статуса
    const validStatuses = ['draft', 'active', 'archived'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Недопустимый статус. Разрешены: draft, active, archived',
        code: 'INVALID_STATUS'
      });
    }

    // Валидация projectCode если передан
    if (projectCode !== undefined && (typeof projectCode !== 'string' || projectCode.length > 50)) {
      return res.status(400).json({
        error: 'projectCode должен быть строкой до 50 символов',
        code: 'INVALID_PROJECT_CODE'
      });
    }

    const result = await query(
      `
      UPDATE construction_projects 
      SET 
        customer_name = COALESCE($1, customer_name),
        object_address = COALESCE($2, object_address),
        contractor_name = COALESCE($3, contractor_name),
        contract_number = COALESCE($4, contract_number),
        deadline = COALESCE($5, deadline),
        project_code = COALESCE($6, project_code),
        status = COALESCE($7, status),
        updated_at = NOW()
      WHERE id = $8 AND tenant_id = $9
      RETURNING 
        id, customer_name, object_address, contractor_name, contract_number, 
        deadline, project_code, status, tenant_id, created_at, updated_at
    `,
      [customerName, objectAddress, contractorName, contractNumber, deadline, projectCode, status, id, tenantId]
    );

    console.log(`✅ Проект ${id} обновлен в тенанте ${tenantId.substring(0, 8)}...`);

    res.json({
      success: true,
      message: 'Проект успешно обновлен',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка обновления проекта:', error);

    if (error.code === '23505' && error.constraint && error.constraint.includes('tenant_code')) {
      return res.status(409).json({
        error: 'Проект с таким кодом уже существует в данном тенанте',
        code: 'PROJECT_CODE_CONFLICT'
      });
    }

    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Удаление проекта (целевая модель)
app.delete('/api/projects/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Проверяем существование проекта в текущем тенанте
    const existingProject = await query(
      `
      SELECT id FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existingProject.rows.length === 0) {
      // Проверяем, существует ли проект вообще
      const existsCheck = await query('SELECT id FROM construction_projects WHERE id = $1', [id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к проекту другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Проект не найден',
          code: 'PROJECT_NOT_FOUND'
        });
      }
    }

    // Удаляем проект (только в пределах текущего тенанта)
    const result = await query(
      `
      DELETE FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, customer_name, project_code
    `,
      [id, tenantId]
    );

    console.log(`🗑️ Проект ${id} удален из тенанта ${tenantId.substring(0, 8)}...`);

    res.json({
      success: true,
      message: 'Проект успешно удален',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка удаления проекта:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// =======================
// ESTIMATES API (Шаг 2) - Целевая модель
// =======================

// Получение списка смет (целевая модель)
app.get('/api/estimates', authMiddleware, async (req, res) => {
  try {
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Параметры пагинации
    const offset = parseInt(req.query.offset) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200); // Максимум 200 записей

    // Параметры сортировки
    const sortField = req.query.sort || 'created_at';
    const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // Валидация поля сортировки
    const allowedSortFields = ['created_at', 'estimate_number', 'name'];
    const finalSortField = allowedSortFields.includes(sortField) ? sortField : 'created_at';

    // Фильтр по проекту
    const projectId = req.query.project_id;

    // Поиск по номеру и названию
    const search = req.query.search;

    let whereConditions = ['e.tenant_id = $1'];
    let queryParams = [tenantId];
    let paramCount = 1;

    // Фильтр по проекту
    if (projectId) {
      paramCount++;
      whereConditions.push(`e.project_id = $${paramCount}`);
      queryParams.push(projectId);
    }

    // Поиск
    if (search && search.trim()) {
      paramCount++;
      whereConditions.push(`(
        e.estimate_number ILIKE $${paramCount} OR 
        e.name ILIKE $${paramCount}
      )`);
      queryParams.push(`%${search.trim()}%`);
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Запрос общего количества
    const countQuery = `
      SELECT COUNT(*) as total
      FROM customer_estimates e
      INNER JOIN construction_projects p ON e.project_id = p.id
      ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Основной запрос с пагинацией
    const dataQuery = `
      SELECT 
        e.id,
        e.project_id,
        e.name,
        e.estimate_number,
        e.version,
        e.status,
        e.currency,
        e.total_amount,
        e.notes,
        e.created_at,
        e.updated_at,
        p.customer_name as project_name,
        p.project_code
      FROM customer_estimates e
      INNER JOIN construction_projects p ON e.project_id = p.id
      ${whereClause}
      ORDER BY e.${finalSortField} ${sortOrder}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset);

    const dataResult = await query(dataQuery, queryParams);

    console.log(`📋 Возвращено смет: ${dataResult.rows.length} из ${total} (tenant: ${tenantId.substring(0, 8)}...)`);

    res.json({
      items: dataResult.rows,
      total,
      offset,
      limit,
      hasMore: offset + dataResult.rows.length < total
    });
  } catch (error) {
    console.error('❌ Ошибка получения списка смет:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Создание новой сметы (целевая модель)
app.post('/api/estimates', authMiddleware, async (req, res) => {
  try {
    const { project_id, estimate_number, name, version, currency, notes } = req.body;
    const tenantId = req.user?.tenantId;
    const userId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Валидация обязательных полей
    if (!project_id || !estimate_number || !name) {
      return res.status(400).json({
        error: 'Отсутствуют обязательные поля: project_id, estimate_number, name',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Проверяем принадлежность проекта текущему тенанту
    const projectCheck = await query(
      `
      SELECT id FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2
    `,
      [project_id, tenantId]
    );

    if (projectCheck.rows.length === 0) {
      // Проверяем, существует ли проект вообще
      const existsCheck = await query('SELECT id FROM construction_projects WHERE id = $1', [project_id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к проекту другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Проект не найден',
          code: 'PROJECT_NOT_FOUND'
        });
      }
    }

    // Проверяем уникальность estimate_number в рамках проекта
    const duplicateCheck = await query(
      `
      SELECT id FROM customer_estimates 
      WHERE project_id = $1 AND estimate_number = $2
    `,
      [project_id, estimate_number]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Номер сметы уже существует в данном проекте',
        code: 'ESTIMATE_NUMBER_CONFLICT'
      });
    }

    // Создаем смету
    const result = await query(
      `
      INSERT INTO customer_estimates (
        project_id, estimate_number, name, version, 
        currency, notes, user_id, tenant_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [project_id, estimate_number, name, version || 1, currency || 'RUB', notes || null, userId, tenantId]
    );

    console.log(`✅ Смета создана: ${estimate_number} в проекте ${project_id} (tenant: ${tenantId.substring(0, 8)}...)`);

    res.status(201).json({
      success: true,
      message: 'Смета успешно создана',
      estimate: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка создания сметы:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Получение одной сметы (целевая модель)
app.get('/api/estimates/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Получаем смету с проверкой принадлежности тенанту
    const result = await query(
      `
      SELECT 
        e.*,
        p.customer_name as project_name,
        p.project_code,
        u.username as created_by_username
      FROM customer_estimates e
      INNER JOIN construction_projects p ON e.project_id = p.id
      LEFT JOIN auth_users u ON e.user_id = u.id
      WHERE e.id = $1 AND e.tenant_id = $2
    `,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      // Проверяем, существует ли смета вообще
      const existsCheck = await query('SELECT id FROM customer_estimates WHERE id = $1', [id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к смете другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Смета не найдена',
          code: 'ESTIMATE_NOT_FOUND'
        });
      }
    }

    console.log(`📄 Смета ${id} запрошена (tenant: ${tenantId.substring(0, 8)}...)`);

    res.json({
      success: true,
      estimate: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка получения сметы:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Обновление сметы (целевая модель)
app.put('/api/estimates/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { estimate_number, name, version, currency, status, notes } = req.body;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Проверяем существование сметы в текущем тенанте
    const existingEstimate = await query(
      `
      SELECT id, project_id, estimate_number FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existingEstimate.rows.length === 0) {
      // Проверяем, существует ли смета вообще
      const existsCheck = await query('SELECT id FROM customer_estimates WHERE id = $1', [id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к смете другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Смета не найдена',
          code: 'ESTIMATE_NOT_FOUND'
        });
      }
    }

    const currentEstimate = existingEstimate.rows[0];

    // Валидация статуса (если передан)
    if (status && !['draft', 'active', 'archived'].includes(status)) {
      return res.status(400).json({
        error: 'Некорректный статус. Допустимые значения: draft, active, archived',
        code: 'INVALID_STATUS'
      });
    }

    // Если изменяется estimate_number, проверяем уникальность
    if (estimate_number && estimate_number !== currentEstimate.estimate_number) {
      const duplicateCheck = await query(
        `
        SELECT id FROM customer_estimates 
        WHERE project_id = $1 AND estimate_number = $2 AND id != $3
      `,
        [currentEstimate.project_id, estimate_number, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Номер сметы уже существует в данном проекте',
          code: 'ESTIMATE_NUMBER_CONFLICT'
        });
      }
    }

    // Формируем поля для обновления
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    if (estimate_number !== undefined) {
      paramCount++;
      updateFields.push(`estimate_number = $${paramCount}`);
      updateValues.push(estimate_number);
    }

    if (name !== undefined) {
      paramCount++;
      updateFields.push(`name = $${paramCount}`);
      updateValues.push(name);
    }

    if (version !== undefined) {
      paramCount++;
      updateFields.push(`version = $${paramCount}`);
      updateValues.push(version);
    }

    if (currency !== undefined) {
      paramCount++;
      updateFields.push(`currency = $${paramCount}`);
      updateValues.push(currency);
    }

    if (status !== undefined) {
      paramCount++;
      updateFields.push(`status = $${paramCount}`);
      updateValues.push(status);
    }

    if (notes !== undefined) {
      paramCount++;
      updateFields.push(`notes = $${paramCount}`);
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Нет полей для обновления',
        code: 'NO_UPDATE_FIELDS'
      });
    }

    // Добавляем updated_at
    paramCount++;
    updateFields.push(`updated_at = $${paramCount}`);
    updateValues.push(new Date());

    // Добавляем условие WHERE
    paramCount++;
    updateValues.push(id);
    paramCount++;
    updateValues.push(tenantId);

    const updateQuery = `
      UPDATE customer_estimates 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount - 1} AND tenant_id = $${paramCount}
      RETURNING *
    `;

    const result = await query(updateQuery, updateValues);

    console.log(`✏️ Смета ${id} обновлена (tenant: ${tenantId.substring(0, 8)}...)`);

    res.json({
      success: true,
      message: 'Смета успешно обновлена',
      estimate: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка обновления сметы:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Удаление сметы (целевая модель)
app.delete('/api/estimates/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      return res.status(401).json({
        error: 'Контекст тенанта не установлен',
        code: 'MISSING_TENANT_CONTEXT'
      });
    }

    // Проверяем существование сметы в текущем тенанте
    const existingEstimate = await query(
      `
      SELECT id, estimate_number, name FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existingEstimate.rows.length === 0) {
      // Проверяем, существует ли смета вообще
      const existsCheck = await query('SELECT id FROM customer_estimates WHERE id = $1', [id]);

      if (existsCheck.rows.length > 0) {
        return res.status(403).json({
          error: 'Доступ к смете другого тенанта запрещен',
          code: 'FOREIGN_TENANT'
        });
      } else {
        return res.status(404).json({
          error: 'Смета не найдена',
          code: 'ESTIMATE_NOT_FOUND'
        });
      }
    }

    // Удаляем смету (каскадное удаление позаботится о связанных данных)
    const result = await query(
      `
      DELETE FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, estimate_number, name
    `,
      [id, tenantId]
    );

    console.log(`🗑️ Смета ${id} удалена из тенанта ${tenantId.substring(0, 8)}...`);

    res.json({
      success: true,
      message: 'Смета успешно удалена',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка удаления сметы:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// API для смет заказчика
// Получить все сметы заказчика
// GET /api/customer-estimates - Получить список смет заказчика
app.get('/api/customer-estimates', authMiddleware, async (req, res) => {
  try {
    console.log('📨 GET /api/customer-estimates [' + req.requestId + ']');
    console.log('📨 GET /api/customer-estimates - ' + req.ip);

    const tenantId = req.user.tenantId;
    const { project_id, status, search, offset = 0, limit = 20, sort = 'created_at', order = 'desc' } = req.query;

    // Валидация параметров сортировки
    const allowedSortFields = ['created_at', 'status', 'name', 'updated_at'];
    const allowedOrderValues = ['asc', 'desc'];

    const sortField = allowedSortFields.includes(sort) ? sort : 'created_at';
    const orderDirection = allowedOrderValues.includes(order?.toLowerCase()) ? order.toUpperCase() : 'DESC';

    let queryText = `
      SELECT 
        ce.*,
        cp.customer_name as project_customer_name,
        cp.object_address as project_address,
        COUNT(cei.id) as items_count,
        COALESCE(SUM(cei.total_amount), 0) as calculated_total
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN customer_estimate_items cei ON ce.id = cei.estimate_id
      WHERE ce.tenant_id = $1
    `;

    const params = [tenantId];
    let paramIndex = 1;

    // Фильтр по проекту
    if (project_id) {
      paramIndex++;
      queryText += ` AND ce.project_id = $${paramIndex}`;
      params.push(project_id);
    }

    // Фильтр по статусу
    if (status) {
      paramIndex++;
      queryText += ` AND ce.status = $${paramIndex}`;
      params.push(status);
    }

    // Поиск по имени клиента или названию сметы
    if (search) {
      paramIndex++;
      queryText += ` AND (ce.customer_name ILIKE $${paramIndex} OR ce.name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    queryText += `
      GROUP BY ce.id, cp.customer_name, cp.object_address
      ORDER BY ce.${sortField} ${orderDirection}
      LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
    `;

    params.push(parseInt(limit), parseInt(offset));

    console.log('🔍 Выполняем запрос смет для тенанта:', tenantId);
    const result = await query(queryText, params);

    // Получаем общее количество записей
    let countQuery = `
      SELECT COUNT(*) as total
      FROM customer_estimates ce
      WHERE ce.tenant_id = $1
    `;

    const countParams = [tenantId];
    let countParamIndex = 1;

    if (project_id) {
      countParamIndex++;
      countQuery += ` AND ce.project_id = $${countParamIndex}`;
      countParams.push(project_id);
    }

    if (status) {
      countParamIndex++;
      countQuery += ` AND ce.status = $${countParamIndex}`;
      countParams.push(status);
    }

    if (search) {
      countParamIndex++;
      countQuery += ` AND (ce.customer_name ILIKE $${countParamIndex} OR ce.name ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    console.log('� Найдено смет заказчика:', result.rows.length, 'из', total);

    res.json({
      items: result.rows,
      total: total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('❌ Ошибка получения смет заказчика:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// СТАРАЯ ВЕРСИЯ С УСЛОВИЯМИ
app.get('/api/customer-estimates-old', async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';

    let query_text = `
      SELECT 
        ce.*,
        COUNT(cei.id) as items_count,
        COALESCE(SUM(cei.total_amount), 0) as total_estimate_cost
      FROM customer_estimates ce
      LEFT JOIN customer_estimate_items cei ON ce.id = cei.estimate_id
      WHERE 1=1
    `;

    const params = [];

    // Роли viewer и estimator видят только свои сметы
    if (userRole === 'viewer' || userRole === 'estimator') {
      query_text += ' AND ce.user_id = $1';
      params.push(userId);
    }

    query_text += `
      GROUP BY ce.id
      ORDER BY ce.created_at DESC
    `;

    const result = await query(query_text, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения смет заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить смету заказчика по ID
// GET /api/customer-estimates/:id - Получить смету заказчика по ID
app.get('/api/customer-estimates/:id', authMiddleware, async (req, res) => {
  try {
    console.log('📨 GET /api/customer-estimates/:id [' + req.requestId + ']');
    console.log('📨 GET /api/customer-estimates/:id - ' + req.ip);

    const { id } = req.params;
    const tenantId = req.user.tenantId;

    console.log('🔍 Поиск сметы заказчика:', id, 'для тенанта:', tenantId);

    const queryText = `
      SELECT 
        ce.*,
        cp.customer_name as project_customer_name,
        cp.object_address as project_address,
        cp.project_name,
        COUNT(cei.id) as items_count,
        COALESCE(SUM(cei.total_amount), 0) as calculated_total
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN customer_estimate_items cei ON ce.id = cei.estimate_id
      WHERE ce.id = $1 AND ce.tenant_id = $2
      GROUP BY ce.id, cp.customer_name, cp.object_address, cp.project_name
    `;

    const result = await query(queryText, [id, tenantId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена',
        code: 'NOT_FOUND'
      });
    }

    console.log('✅ Смета заказчика найдена:', result.rows[0].name);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Ошибка получения сметы заказчика:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// POST /api/customer-estimates - Создать новую смету заказчика
app.post('/api/customer-estimates', authMiddleware, async (req, res) => {
  try {
    console.log('📨 POST /api/customer-estimates [' + req.requestId + ']');
    console.log('📨 POST /api/customer-estimates - ' + req.ip);

    const { project_id, customer_name, estimate_name, description, status = 'draft' } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenantId;

    // Валидация обязательных полей
    if (!project_id || !estimate_name) {
      return res.status(400).json({
        error: 'Отсутствуют обязательные поля: project_id, estimate_name',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // Проверяем, что проект принадлежит текущему тенанту
    const projectCheck = await query(
      `
      SELECT id, tenant_id FROM construction_projects 
      WHERE id = $1 AND tenant_id = $2
    `,
      [project_id, tenantId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(403).json({
        error: 'Проект не принадлежит текущему тенанту',
        code: 'FOREIGN_TENANT'
      });
    }

    // Проверяем уникальность estimate_name в рамках проекта
    const duplicateCheck = await query(
      `
      SELECT id FROM customer_estimates 
      WHERE project_id = $1 AND name = $2 AND tenant_id = $3
    `,
      [project_id, estimate_name, tenantId]
    );

    if (duplicateCheck.rows.length > 0) {
      return res.status(409).json({
        error: 'Смета с таким именем уже существует в проекте',
        code: 'CUSTOMER_ESTIMATE_CONFLICT'
      });
    }

    console.log('� Создание сметы заказчика для проекта:', project_id, 'тенант:', tenantId);

    // Генерируем уникальный номер сметы
    const estimateNumber = `EST-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Создаем смету с tenant_id из проекта
    const result = await query(
      `
      INSERT INTO customer_estimates (
        project_id, name, description, status, 
        customer_name, user_id, tenant_id,
        total_amount, work_coefficient, material_coefficient, version, estimate_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `,
      [project_id, estimate_name, description, status, customer_name || 'Заказчик', userId, tenantId, 0, 1.0, 1.0, 1, estimateNumber]
    );

    console.log('✅ Смета заказчика создана:', result.rows[0].id);

    res.status(201).json({
      success: true,
      message: 'Смета заказчика успешно создана',
      estimate: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка создания сметы заказчика:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// PUT /api/customer-estimates/:id - Обновить смету заказчика
app.put('/api/customer-estimates/:id', authMiddleware, async (req, res) => {
  try {
    console.log('📨 PUT /api/customer-estimates/:id [' + req.requestId + ']');
    console.log('📨 PUT /api/customer-estimates/:id - ' + req.ip);

    const { id } = req.params;
    const tenantId = req.user.tenantId;
    const { customer_name, estimate_name, description, status } = req.body;

    console.log('🔍 Обновление сметы заказчика:', id, 'для тенанта:', tenantId);

    // Проверяем существование сметы в текущем тенанте
    const existingEstimate = await query(
      `
      SELECT id, project_id, name, tenant_id FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existingEstimate.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена',
        code: 'NOT_FOUND'
      });
    }

    const currentEstimate = existingEstimate.rows[0];

    // Если изменяется название, проверяем уникальность в рамках проекта
    if (estimate_name && estimate_name !== currentEstimate.name) {
      const duplicateCheck = await query(
        `
        SELECT id FROM customer_estimates 
        WHERE project_id = $1 AND name = $2 AND tenant_id = $3 AND id != $4
      `,
        [currentEstimate.project_id, estimate_name, tenantId, id]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Смета с таким именем уже существует в проекте',
          code: 'CUSTOMER_ESTIMATE_CONFLICT'
        });
      }
    }

    // Обновляем только разрешенные поля (НЕ project_id, НЕ tenant_id)
    const result = await query(
      `
      UPDATE customer_estimates 
      SET 
        customer_name = COALESCE($1, customer_name),
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND tenant_id = $6
      RETURNING *
    `,
      [customer_name, estimate_name, description, status, id, tenantId]
    );

    console.log('✅ Смета заказчика обновлена:', result.rows[0].name);

    res.json({
      success: true,
      message: 'Смета заказчика успешно обновлена',
      estimate: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка обновления сметы заказчика:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// DELETE /api/customer-estimates/:id - Удалить смету заказчика
app.delete('/api/customer-estimates/:id', authMiddleware, async (req, res) => {
  try {
    console.log('📨 DELETE /api/customer-estimates/:id [' + req.requestId + ']');
    console.log('📨 DELETE /api/customer-estimates/:id - ' + req.ip);

    const { id } = req.params;
    const tenantId = req.user.tenantId;

    console.log('🗑️ Удаление сметы заказчика:', id, 'для тенанта:', tenantId);

    // Проверяем существование сметы перед удалением
    const existsCheck = await query(
      `
      SELECT id, name, project_id FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [id, tenantId]
    );

    if (existsCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена',
        code: 'NOT_FOUND'
      });
    }

    const estimateName = existsCheck.rows[0].name;

    // Удаляем смету (каскадно удалятся связанные записи)
    const result = await query(
      `
      DELETE FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, name
    `,
      [id, tenantId]
    );

    console.log('🗑️ Смета заказчика удалена:', estimateName);

    res.json({
      success: true,
      message: 'Смета заказчика успешно удалена',
      deleted: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Ошибка удаления сметы заказчика:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
});

// Получить элементы сметы
app.get('/api/customer-estimates/:estimateId/items', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const tenantId = req.user.tenantId;

    console.log('📨 GET /api/customer-estimates/:estimateId/items [' + req.requestId + ']');
    console.log('Получение элементов сметы для ID:', estimateId, 'тенант:', tenantId?.substring(0, 8) + '...');

    // Проверяем существование сметы в рамках текущего тенанта
    const estimateCheck = await query(
      `
      SELECT id FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [estimateId, tenantId]
    );

    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена или не принадлежит текущему тенанту',
        code: 'ESTIMATE_NOT_FOUND'
      });
    }

    const result = await query(
      `
      SELECT * FROM customer_estimate_items 
      WHERE estimate_id = $1 
      ORDER BY sort_order ASC, created_at ASC
    `,
      [estimateId]
    );

    console.log(`Найдено ${result.rows.length} элементов для сметы ${estimateId}`);
    res.json({
      success: true,
      items: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка получения элементов сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Добавить элемент в смету
app.post('/api/customer-estimates/:estimateId/items', authMiddleware, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const tenantId = req.user.tenantId;

    console.log('📨 POST /api/customer-estimates/:estimateId/items [' + req.requestId + ']');
    console.log('Добавление элемента в смету ID:', estimateId, 'тенант:', tenantId?.substring(0, 8) + '...');

    // Проверяем, что смета принадлежит текущему тенанту
    const estimateOwnership = await query(
      `
      SELECT id FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [estimateId, tenantId]
    );

    if (estimateOwnership.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена или не принадлежит текущему тенанту',
        code: 'ESTIMATE_NOT_FOUND'
      });
    }

    const { item_type, reference_id, name, unit, quantity, unit_price, total_amount, sort_order } = req.body;

    console.log('Получены данные для добавления:', { item_type, reference_id, name, unit, quantity, unit_price, total_amount, sort_order });

    // Проверяем существование сметы
    const estimateCheck = await query('SELECT id FROM customer_estimates WHERE id = $1', [estimateId]);

    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена' });
    }

    const result = await query(
      `
      INSERT INTO customer_estimate_items (
        estimate_id, item_type, reference_id, name,
        unit, quantity, unit_price, total_amount, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
      [estimateId, item_type, reference_id, name, unit, quantity, unit_price, total_amount, sort_order || 0]
    );

    console.log('Элемент успешно добавлен:', result.rows[0].id);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновить элемент сметы
app.put('/api/customer-estimates/:estimateId/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const { estimateId, itemId } = req.params;
    const tenantId = req.user.tenantId;

    console.log('📨 PUT /api/customer-estimates/:estimateId/items/:itemId [' + req.requestId + ']');
    console.log('Обновление элемента', itemId, 'в смете', estimateId, 'тенант:', tenantId?.substring(0, 8) + '...');

    // Проверяем, что смета принадлежит текущему тенанту
    const estimateOwnership = await query(
      `
      SELECT id FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [estimateId, tenantId]
    );

    if (estimateOwnership.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена или не принадлежит текущему тенанту',
        code: 'ESTIMATE_NOT_FOUND'
      });
    }

    const { item_type, reference_id, unit, quantity, unit_price, sort_order } = req.body;

    const result = await query(
      `
      UPDATE customer_estimate_items 
      SET item_type = $1, reference_id = $2, name = $3,
          unit = $4, quantity = $5, unit_price = $6, total_amount = $7,
          sort_order = $8, updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND estimate_id = $10
      RETURNING *
    `,
      [item_type, reference_id, custom_name, unit, quantity, unit_price, total_cost, sort_order || 0, itemId, estimateId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Элемент сметы не найден' });
    }

    console.log('Элемент успешно обновлен:', result.rows[0].id);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Удалить элемент сметы
app.delete('/api/customer-estimates/:estimateId/items/:itemId', authMiddleware, async (req, res) => {
  try {
    const { estimateId, itemId } = req.params;
    const tenantId = req.user.tenantId;

    console.log('📨 DELETE /api/customer-estimates/:estimateId/items/:itemId [' + req.requestId + ']');
    console.log('Удаление элемента', itemId, 'из сметы', estimateId, 'тенант:', tenantId?.substring(0, 8) + '...');

    // Проверяем, что смета принадлежит текущему тенанту
    const estimateOwnership = await query(
      `
      SELECT id FROM customer_estimates 
      WHERE id = $1 AND tenant_id = $2
    `,
      [estimateId, tenantId]
    );

    if (estimateOwnership.rows.length === 0) {
      return res.status(404).json({
        error: 'Смета не найдена или не принадлежит текущему тенанту',
        code: 'ESTIMATE_NOT_FOUND'
      });
    }

    const result = await query('DELETE FROM customer_estimate_items WHERE id = $1 AND estimate_id = $2 RETURNING *', [itemId, estimateId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Элемент сметы не найден' });
    }

    console.log('Элемент успешно удален:', result.rows[0].id);
    res.json({ message: 'Элемент сметы успешно удален' });
  } catch (error) {
    console.error('Ошибка удаления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Prometheus метрики эндпоинт
app.get('/metrics', metricsEndpoint);

// ============ CACHE MONITORING ENDPOINTS ============

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

// Для запуска сервера используйте start.js

// Добавляем функцию инициализации как метод app для тестов
app.initializeTables = initializeTables;

export default app;
