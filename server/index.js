import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query } from './database.js';
import { config } from './config.js';
import { tenantContextMiddleware, requireRole, getCurrentUser } from './middleware/tenantContext.js';

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
  
  res.on('finish', () => {
    activeConnections.delete(connectionId);
  });
  
  res.on('close', () => {
    activeConnections.delete(connectionId);
  });
  
  next();
});

// Middleware
app.use(cors({
  origin: true, // Временно разрешаем все origins для отладки
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.static('.'));

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
      await query(`ALTER TABLE construction_projects ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES auth_users(id) ON DELETE SET NULL`);
      await query(`ALTER TABLE construction_projects ADD COLUMN IF NOT EXISTS tenant_id UUID`);
      await query(`ALTER TABLE construction_projects ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft'`);
      
      // Добавление недостающих полей в auth_users для полного профиля
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)`);
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS position VARCHAR(255)`);
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS location VARCHAR(255)`);
      await query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS bio TEXT`);
      
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
      { name: 'object_parameters.update', resource: 'object_parameters', action: 'update', description: 'Редактирование параметров объектов' },
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
      await query(`
        INSERT INTO permissions (name, resource, action, description)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (name) DO NOTHING
      `, [permission.name, permission.resource, permission.action, permission.description]);
    }

    // Создание базовых ролей
    const roles = [
      {
        name: 'super_admin',
        description: 'Суперадминистратор - полный доступ ко всем функциям системы',
        permissions: permissions.map(p => p.name) // Все разрешения
      },
      {
        name: 'admin',
        description: 'Администратор - управление проектами и пользователями',
        permissions: [
          'projects.manage', 'estimates.create', 'estimates.read', 'estimates.update', 'estimates.export',
          'materials.create', 'materials.read', 'materials.update', 'works.create', 'works.read', 'works.update',
          'object_parameters.create', 'object_parameters.read', 'object_parameters.update',
          'users.read', 'users.update'
        ]
      },
      {
        name: 'project_manager',
        description: 'Менеджер проектов - управление проектами и сметами',
        permissions: [
          'projects.create', 'projects.read', 'projects.update', 'estimates.create', 'estimates.read', 
          'estimates.update', 'estimates.export', 'materials.read', 'works.read',
          'object_parameters.create', 'object_parameters.read', 'object_parameters.update'
        ]
      },
      {
        name: 'estimator',
        description: 'Сметчик - создание и редактирование смет',
        permissions: [
          'projects.read', 'estimates.create', 'estimates.read', 'estimates.update', 'estimates.export',
          'materials.read', 'works.read', 'object_parameters.read'
        ]
      },
      {
        name: 'viewer',
        description: 'Наблюдатель - только просмотр данных',
        permissions: [
          'projects.read', 'estimates.read', 'materials.read', 'works.read', 'object_parameters.read'
        ]
      }
    ];

    // Добавление ролей
    for (const role of roles) {
      const roleResult = await query(`
        INSERT INTO user_roles (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
        RETURNING id
      `, [role.name, role.description]);

      const roleId = roleResult.rows[0].id;

      // Добавление разрешений к роли
      for (const permissionName of role.permissions) {
        const permissionResult = await query('SELECT id FROM permissions WHERE name = $1', [permissionName]);
        if (permissionResult.rows.length > 0) {
          const permissionId = permissionResult.rows[0].id;
          await query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [roleId, permissionId]);
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
      const userResult = await query(`
        INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
        VALUES ($1, $2, $3, $4, $5, true, true)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [userData.email, hashedPassword, userData.firstname, userData.lastname, userData.company]);

      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Назначение роли пользователю
        const roleResult = await query('SELECT id FROM user_roles WHERE name = $1', [userData.role]);
        if (roleResult.rows.length > 0) {
          const roleId = roleResult.rows[0].id;
          await query(`
            INSERT INTO user_role_assignments (user_id, role_id, is_active)
            VALUES ($1, $2, true)
            ON CONFLICT (user_id, role_id, tenant_id) DO NOTHING
          `, [userId, roleId]);
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
    const result = await query(`
      INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, true, false)
      RETURNING id, email, firstname, lastname, company, created_at
    `, [userData.email, userData.passwordHash, userData.firstname, userData.lastname, userData.company || null]);
    return result.rows[0];
  } catch (error) {
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
    const result = await query(`
      SELECT id, email, password_hash, firstname, lastname, company, is_active, email_verified, created_at
      FROM auth_users 
      WHERE email = $1
    `, [email]);
    return result.rows[0] || null;
  } catch (error) {
    console.log('⚠️ БД недоступна, ищем в локальном хранилище');
    return localUsers.find(user => user.email === email) || null;
  }
}

async function updateLastLogin(userId) {
  try {
    await query('UPDATE auth_users SET last_login = NOW() WHERE id = $1', [userId]);
  } catch (error) {
    console.log('⚠️ БД недоступна, пропускаем обновление last_login');
    const user = localUsers.find(u => u.id === userId);
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

    // Генерация JWT токена
    const token = jwt.sign(
      { 
        userId: newUser.id, 
        email: newUser.email,
        firstname: newUser.firstname,
        lastname: newUser.lastname 
      },
  config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Сохранение сессии (хешируем токен для безопасности)
    try {
      const tokenHash = await bcrypt.hash(token, 10);
      await query(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES ($1, $2, NOW() + INTERVAL '24 hours', $3, $4)
      `, [
        newUser.id, 
        tokenHash, 
        req.headers['user-agent'] || '', 
        req.ip || req.connection.remoteAddress
      ]);
    } catch (error) {
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

    // Генерация JWT токена
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname 
      },
  config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Сохранение сессии
    try {
      const tokenHash = await bcrypt.hash(token, 10);
      await query(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES ($1, $2, NOW() + INTERVAL '24 hours', $3, $4)
      `, [
        user.id, 
        tokenHash, 
        req.headers['user-agent'] || '', 
        req.ip || req.connection.remoteAddress
      ]);
    } catch (error) {
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Токен авторизации не предоставлен' 
      });
    }

    const token = authHeader.substring(7);
  const decoded = jwt.verify(token, config.jwtSecret);
    
    // Удаление активных сессий пользователя
    await query('DELETE FROM user_sessions WHERE user_id = $1', [decoded.userId]);

    res.json({
      success: true,
      message: 'Успешный выход из системы'
    });

  } catch (error) {
    console.error('❌ Ошибка выхода:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Внутренняя ошибка сервера' 
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
    const result = await query(`
      SELECT id, email, firstname, lastname, company, phone, position, location, bio, 
             is_active, email_verified, last_login, created_at
      FROM auth_users 
      WHERE id = $1 AND is_active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Пользователь не найден или заблокирован' 
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
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
app.get('/api/users', async (req, res) => {
  try {
    const result = await query('SELECT * FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения пользователей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание нового пользователя
app.post('/api/users', async (req, res) => {
  try {
    const { name, email } = req.body;
    const result = await query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
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

// Получение всех работ с их связями
app.get('/api/works', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        w.*,
        p.name as phase_name,
        s.name as stage_name,
        ss.name as substage_name
      FROM works_ref w
      LEFT JOIN phases p ON w.phase_id = p.id
      LEFT JOIN stages s ON w.stage_id = s.id  
      LEFT JOIN substages ss ON w.substage_id = ss.id
      ORDER BY w.sort_order, w.id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения работ:', error);
    res.status(500).json({ error: 'Ошибка получения работ' });
  }
});

// Получение всех материалов
app.get('/api/materials', async (req, res) => {
  try {
    const result = await query('SELECT * FROM materials ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения материалов:', error);
    res.status(500).json({ error: 'Ошибка получения материалов' });
  }
});

// Создание нового материала
app.post('/api/materials', async (req, res) => {
  try {
    const { id, name, image_url, item_url, unit, unit_price, expenditure, weight } = req.body;
    const result = await query(
      'INSERT INTO materials (id, name, image_url, item_url, unit, unit_price, expenditure, weight) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [id, name, image_url, item_url, unit, unit_price, expenditure, weight]
    );
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
    const result = await query(`
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
    `, [workId]);
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
    const result = await query(`
      INSERT INTO work_materials (work_id, material_id, consumption_per_work_unit, waste_coeff)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (work_id, material_id)
      DO UPDATE SET
        consumption_per_work_unit = EXCLUDED.consumption_per_work_unit,
        waste_coeff = EXCLUDED.waste_coeff,
        updated_at = now()
      RETURNING *
    `, [workId, material_id, consumption_per_work_unit, waste_coeff]);
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
    const result = await query(`
      UPDATE work_materials
      SET consumption_per_work_unit = $1, waste_coeff = $2, updated_at = now()
      WHERE work_id = $3 AND material_id = $4
      RETURNING *
    `, [consumption_per_work_unit, waste_coeff, workId, materialId]);
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
    const result = await query(`
      DELETE FROM work_materials
      WHERE work_id = $1 AND material_id = $2
      RETURNING *
    `, [workId, materialId]);
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
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
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

// ==============================|| ПРОЕКТЫ API ||============================== //

// Простая проверка аутентификации без мультитенантности
const simpleAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Требуется авторизация',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Недействительный токен',
      code: 'INVALID_TOKEN'
    });
  }
};

// Обновление профиля пользователя
app.put('/api/auth/profile', simpleAuth, async (req, res) => {
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
    const result = await query(`
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
    `, [firstname, lastname, company, phone, position, location, bio, userId]);

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

// Получение параметров объекта по ID проекта
app.get('/api/projects/:projectId/object-parameters', simpleAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    const result = await query(`
      SELECT op.*, 
             au.firstname || ' ' || au.lastname as created_by_name
      FROM object_parameters op
      LEFT JOIN auth_users au ON op.user_id = au.id
      WHERE op.project_id = $1
      ORDER BY op.created_at DESC
      LIMIT 1
    `, [projectId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Параметры объекта не найдены' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения параметров объекта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание/обновление параметров объекта
app.post('/api/projects/:projectId/object-parameters', simpleAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const {
      buildingType, constructionCategory, floorsAboveGround, floorsBelowGround,
      heightAboveGround, heightBelowGround, totalArea, buildingArea,
      estimatedCost, constructionComplexity, seismicZone, windLoad, snowLoad,
      soilConditions, groundwaterLevel, climateZone
    } = req.body;
    
    // Проверяем существование проекта
    const projectExists = await query('SELECT id FROM construction_projects WHERE id = $1', [projectId]);
    if (projectExists.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Создаем ограничение уникальности для project_id если его нет
    await query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'object_parameters_project_id_unique') THEN
          ALTER TABLE object_parameters ADD CONSTRAINT object_parameters_project_id_unique UNIQUE (project_id);
        END IF;
      END $$;
    `);
    
    const result = await query(`
      INSERT INTO object_parameters (
        project_id, building_type, construction_category, floors_above_ground, floors_below_ground,
        height_above_ground, height_below_ground, total_area, building_area, estimated_cost,
        construction_complexity, seismic_zone, wind_load, snow_load, soil_conditions,
        groundwater_level, climate_zone, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      ON CONFLICT (project_id) DO UPDATE SET
        building_type = EXCLUDED.building_type,
        construction_category = EXCLUDED.construction_category,
        floors_above_ground = EXCLUDED.floors_above_ground,
        floors_below_ground = EXCLUDED.floors_below_ground,
        height_above_ground = EXCLUDED.height_above_ground,
        height_below_ground = EXCLUDED.height_below_ground,
        total_area = EXCLUDED.total_area,
        building_area = EXCLUDED.building_area,
        estimated_cost = EXCLUDED.estimated_cost,
        construction_complexity = EXCLUDED.construction_complexity,
        seismic_zone = EXCLUDED.seismic_zone,
        wind_load = EXCLUDED.wind_load,
        snow_load = EXCLUDED.snow_load,
        soil_conditions = EXCLUDED.soil_conditions,
        groundwater_level = EXCLUDED.groundwater_level,
        climate_zone = EXCLUDED.climate_zone,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [
      projectId, buildingType, constructionCategory, floorsAboveGround, floorsBelowGround,
      heightAboveGround, heightBelowGround, totalArea, buildingArea, estimatedCost,
      constructionComplexity, seismicZone, windLoad, snowLoad, soilConditions,
      groundwaterLevel, climateZone, userId
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Параметры объекта сохранены',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания параметров объекта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение помещений проекта
app.get('/api/object-parameters/:objectParamsId/rooms', simpleAuth, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    
    const result = await query(`
      SELECT pr.*, 
             au.firstname || ' ' || au.lastname as created_by_name
      FROM project_rooms pr
      LEFT JOIN auth_users au ON pr.user_id = au.id
      WHERE pr.object_parameters_id = $1
      ORDER BY pr.sort_order, pr.id
    `, [objectParamsId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения помещений:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание помещения
app.post('/api/object-parameters/:objectParamsId/rooms', simpleAuth, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const { roomName, area, height, volume, finishClass, purpose, sortOrder = 0 } = req.body;
    
    if (!roomName) {
      return res.status(400).json({ error: 'Название помещения обязательно' });
    }
    
    const result = await query(`
      INSERT INTO project_rooms (
        object_parameters_id, room_name, area, height, volume, 
        finish_class, purpose, sort_order, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [objectParamsId, roomName, area, height, volume, finishClass, purpose, sortOrder, userId]);
    
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

// Обновление помещения
app.put('/api/rooms/:roomId', simpleAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { roomName, area, height, volume, finishClass, purpose, sortOrder } = req.body;
    
    const result = await query(`
      UPDATE project_rooms SET
        room_name = $1, area = $2, height = $3, volume = $4,
        finish_class = $5, purpose = $6, sort_order = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING *
    `, [roomName, area, height, volume, finishClass, purpose, sortOrder, roomId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Помещение не найдено' });
    }
    
    res.json({
      success: true,
      message: 'Помещение обновлено',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления помещения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление помещения
app.delete('/api/rooms/:roomId', simpleAuth, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const result = await query('DELETE FROM project_rooms WHERE id = $1 RETURNING *', [roomId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Помещение не найдено' });
    }
    
    res.json({
      success: true,
      message: 'Помещение удалено'
    });
  } catch (error) {
    console.error('Ошибка удаления помещения:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// ==============================|| CONSTRUCTIVE ELEMENTS API ||============================== //

// Получение конструктивных элементов объекта
app.get('/api/object-parameters/:objectParamsId/constructive-elements', simpleAuth, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    
    const result = await query(`
      SELECT ce.*, 
             au.firstname || ' ' || au.lastname as created_by_name
      FROM constructive_elements ce
      LEFT JOIN auth_users au ON ce.user_id = au.id
      WHERE ce.object_parameters_id = $1
      ORDER BY ce.element_type, ce.id
    `, [objectParamsId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения конструктивных элементов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание конструктивного элемента
app.post('/api/object-parameters/:objectParamsId/constructive-elements', simpleAuth, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const { elementType, material, characteristics, quantity, unit, notes } = req.body;
    
    if (!elementType) {
      return res.status(400).json({ error: 'Тип конструктивного элемента обязателен' });
    }
    
    const result = await query(`
      INSERT INTO constructive_elements (
        object_parameters_id, element_type, material, characteristics, 
        quantity, unit, notes, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [objectParamsId, elementType, material, characteristics, quantity, unit, notes, userId]);
    
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
app.put('/api/constructive-elements/:elementId', simpleAuth, async (req, res) => {
  try {
    const { elementId } = req.params;
    const { elementType, material, characteristics, quantity, unit, notes } = req.body;
    
    const result = await query(`
      UPDATE constructive_elements SET
        element_type = $1, material = $2, characteristics = $3, 
        quantity = $4, unit = $5, notes = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *
    `, [elementType, material, characteristics, quantity, unit, notes, elementId]);
    
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
app.delete('/api/constructive-elements/:elementId', simpleAuth, async (req, res) => {
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
app.get('/api/object-parameters/:objectParamsId/engineering-systems', simpleAuth, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    
    const result = await query(`
      SELECT es.*, 
             au.firstname || ' ' || au.lastname as created_by_name
      FROM engineering_systems es
      LEFT JOIN auth_users au ON es.user_id = au.id
      WHERE es.object_parameters_id = $1
      ORDER BY es.system_type, es.id
    `, [objectParamsId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения инженерных систем:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание инженерной системы
app.post('/api/object-parameters/:objectParamsId/engineering-systems', simpleAuth, async (req, res) => {
  try {
    const { objectParamsId } = req.params;
    const userId = req.user.userId || req.user.id || req.user.sub;
    const { systemType, characteristics, capacity, efficiency, notes } = req.body;
    
    if (!systemType) {
      return res.status(400).json({ error: 'Тип инженерной системы обязателен' });
    }
    
    const result = await query(`
      INSERT INTO engineering_systems (
        object_parameters_id, system_type, characteristics, 
        capacity, efficiency, notes, user_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [objectParamsId, systemType, characteristics, capacity, efficiency, notes, userId]);
    
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
app.put('/api/engineering-systems/:systemId', simpleAuth, async (req, res) => {
  try {
    const { systemId } = req.params;
    const { systemType, characteristics, capacity, efficiency, notes } = req.body;
    
    const result = await query(`
      UPDATE engineering_systems SET
        system_type = $1, characteristics = $2, capacity = $3, 
        efficiency = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `, [systemType, characteristics, capacity, efficiency, notes, systemId]);
    
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
app.delete('/api/engineering-systems/:systemId', simpleAuth, async (req, res) => {
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
app.get('/api/roles', simpleAuth, async (req, res) => {
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
app.get('/api/users/:userId/roles', simpleAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await query(`
      SELECT ur.*, ura.assigned_at, ura.expires_at,
             assigner.firstname || ' ' || assigner.lastname as assigned_by_name
      FROM user_roles ur
      JOIN user_role_assignments ura ON ur.id = ura.role_id
      LEFT JOIN auth_users assigner ON ura.assigned_by = assigner.id
      WHERE ura.user_id = $1 AND ura.is_active = true
      ORDER BY ura.assigned_at DESC
    `, [userId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения ролей пользователя:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Получение всех проектов (с аутентификацией)
app.get('/api/projects', simpleAuth, async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        cp.*,
        au.firstname || ' ' || au.lastname as created_by_name,
        au.email as created_by_email
      FROM construction_projects cp
      LEFT JOIN auth_users au ON cp.user_id = au.id
      ORDER BY cp.created_at DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения проектов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Создание нового проекта (с аутентификацией)
app.post('/api/projects', simpleAuth, async (req, res) => {
  try {
    const { customerName, objectAddress, contractorName, contractNumber, deadline } = req.body;
    const userId = req.user.userId || req.user.id || req.user.sub; // Поддержка разных форматов токенов
    
    console.log('🔍 Данные пользователя из токена:', req.user);
    console.log('🔍 ID пользователя для сохранения:', userId);
    
    // Валидация обязательных полей
    if (!customerName || !objectAddress || !contractorName || !contractNumber || !deadline) {
      return res.status(400).json({ error: 'Все поля обязательны для заполнения' });
    }
    
    const result = await query(`
      INSERT INTO construction_projects (
        customer_name, object_address, contractor_name, contract_number, deadline,
        user_id, status
      ) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `, [customerName, objectAddress, contractorName, contractNumber, deadline, userId, 'draft']);
    
    console.log(`✅ Проект создан пользователем ID: ${userId}`);
    
    res.status(201).json({
      success: true,
      message: 'Проект успешно создан',
      project: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка создания проекта:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Проект с таким номером договора уже существует' });
    } else {
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  }
});

// Получение проекта по ID (с аутентификацией)
app.get('/api/projects/:id', simpleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await query(`
      SELECT 
        cp.*,
        au.firstname || ' ' || au.lastname as created_by_name,
        au.email as created_by_email
      FROM construction_projects cp
      LEFT JOIN auth_users au ON cp.user_id = au.id
      WHERE cp.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения проекта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Обновление проекта (с аутентификацией)
app.put('/api/projects/:id', simpleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { customerName, objectAddress, contractorName, contractNumber, deadline, status } = req.body;
    const userId = req.user.id || req.user.sub;
    
    // Проверяем существование проекта
    const existingProject = await query(`
      SELECT user_id FROM construction_projects WHERE id = $1
    `, [id]);
    
    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Проверка прав: только создатель может редактировать (можно расширить логику)
    const project = existingProject.rows[0];
    if (project.user_id && project.user_id !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для редактирования проекта' });
    }
    
    const result = await query(`
      UPDATE construction_projects 
      SET customer_name = $1, object_address = $2, contractor_name = $3, 
          contract_number = $4, deadline = $5, status = COALESCE($6, status), 
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 
      RETURNING *
    `, [customerName, objectAddress, contractorName, contractNumber, deadline, status, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    res.json({
      success: true,
      message: 'Проект успешно обновлен',
      project: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка обновления проекта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Удаление проекта (с аутентификацией)
app.delete('/api/projects/:id', simpleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.sub;
    
    // Проверяем существование проекта
    const existingProject = await query(`
      SELECT user_id FROM construction_projects WHERE id = $1
    `, [id]);
    
    if (existingProject.rows.length === 0) {
      return res.status(404).json({ error: 'Проект не найден' });
    }
    
    // Проверка прав: только создатель может удалять (можно расширить логику)
    const project = existingProject.rows[0];
    if (project.user_id && project.user_id !== userId) {
      return res.status(403).json({ error: 'Недостаточно прав для удаления проекта' });
    }
    
    const result = await query('DELETE FROM construction_projects WHERE id = $1 RETURNING *', [id]);
    
    console.log(`🗑️ Проект ${id} удален пользователем ID: ${userId}`);
    
    res.json({
      success: true,
      message: 'Проект успешно удален'
    });
  } catch (error) {
    console.error('Ошибка удаления проекта:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для смет заказчика
// Получить все сметы заказчика
app.get('/api/customer-estimates', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';
    
    let query_text = `
      SELECT 
        ce.*,
        cp.name as project_name,
        u.username as creator_name,
        COUNT(cei.id) as items_count,
        COALESCE(SUM(cei.total_cost), 0) as total_estimate_cost
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN auth_users u ON ce.user_id = u.id
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
      GROUP BY ce.id, cp.name, u.username
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
app.get('/api/customer-estimates/:id', simpleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';
    
    let query_text = `
      SELECT 
        ce.*,
        cp.name as project_name,
        u.username as creator_name
      FROM customer_estimates ce
      LEFT JOIN construction_projects cp ON ce.project_id = cp.id
      LEFT JOIN auth_users u ON ce.user_id = u.id
      WHERE ce.id = $1
    `;
    
    const params = [id];
    
    // Роли viewer и estimator видят только свои сметы
    if (userRole === 'viewer' || userRole === 'estimator') {
      query_text += ' AND ce.user_id = $2';
      params.push(userId);
    }
    
    const result = await query(query_text, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка получения сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Создать новую смету заказчика
app.post('/api/customer-estimates', simpleAuth, async (req, res) => {
  try {
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';
    const { project_id, name, description, coefficients, status = 'draft' } = req.body;
    
    // Проверяем роль пользователя
    if (!['super_admin', 'admin', 'project_manager', 'estimator'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для создания сметы' });
    }
    
    // Проверяем существование проекта
    const projectCheck = await query(
      'SELECT id FROM construction_projects WHERE id = $1',
      [project_id]
    );
    
    if (projectCheck.rows.length === 0) {
      return res.status(400).json({ message: 'Проект не найден' });
    }
    
    const result = await query(`
      INSERT INTO customer_estimates (
        project_id, user_id, name, description,
        coefficients, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [project_id, userId, name, description, 
        JSON.stringify(coefficients), status]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка создания сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Обновить смету заказчика
app.put('/api/customer-estimates/:id', simpleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';
    const { name, description, coefficients, status } = req.body;
    
    // Проверяем существование сметы и права доступа
    let checkQuery = 'SELECT * FROM customer_estimates WHERE id = $1';
    const checkParams = [id];
    
    if (userRole === 'viewer' || userRole === 'estimator') {
      checkQuery += ' AND user_id = $2';
      checkParams.push(userId);
    }
    
    const existingEstimate = await query(checkQuery, checkParams);
    
    if (existingEstimate.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    // Viewer не может редактировать
    if (userRole === 'viewer') {
      return res.status(403).json({ message: 'Недостаточно прав для редактирования' });
    }
    
    const result = await query(`
      UPDATE customer_estimates 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          coefficients = COALESCE($3, coefficients),
          status = COALESCE($4, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `, [name, description, coefficients ? JSON.stringify(coefficients) : null, 
        status, id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка обновления сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Удалить смету заказчика
app.delete('/api/customer-estimates/:id', simpleAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role || 'viewer';
    
    // Проверяем права доступа
    if (!['super_admin', 'admin', 'project_manager'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для удаления сметы' });
    }
    
    const result = await query(
      'DELETE FROM customer_estimates WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена' });
    }
    
    res.json({ message: 'Смета успешно удалена' });
  } catch (error) {
    console.error('Ошибка удаления сметы заказчика:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Получить элементы сметы
app.get('/api/customer-estimates/:estimateId/items', simpleAuth, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';
    
    // Проверяем доступ к смете
    let checkQuery = 'SELECT id FROM customer_estimates WHERE id = $1';
    const checkParams = [estimateId];
    
    if (userRole === 'viewer' || userRole === 'estimator') {
      checkQuery += ' AND user_id = $2';
      checkParams.push(userId);
    }
    
    const estimateCheck = await query(checkQuery, checkParams);
    
    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    const result = await query(`
      SELECT * FROM customer_estimate_items 
      WHERE estimate_id = $1 
      ORDER BY position ASC, created_at ASC
    `, [estimateId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения элементов сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Добавить элемент в смету
app.post('/api/customer-estimates/:estimateId/items', simpleAuth, async (req, res) => {
  try {
    const { estimateId } = req.params;
    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role || 'viewer';
    
    const {
      item_type, reference_id, custom_name, unit, quantity,
      unit_price, total_cost, position, metadata
    } = req.body;
    
    // Проверяем права и существование сметы
    if (!['super_admin', 'admin', 'project_manager', 'estimator'].includes(userRole)) {
      return res.status(403).json({ message: 'Недостаточно прав для добавления элементов' });
    }
    
    let checkQuery = 'SELECT id FROM customer_estimates WHERE id = $1';
    const checkParams = [estimateId];
    
    if (userRole === 'estimator') {
      checkQuery += ' AND user_id = $2';
      checkParams.push(userId);
    }
    
    const estimateCheck = await query(checkQuery, checkParams);
    
    if (estimateCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Смета не найдена или нет прав доступа' });
    }
    
    const result = await query(`
      INSERT INTO customer_estimate_items (
        estimate_id, item_type, reference_id, custom_name,
        unit, quantity, unit_price, total_cost, position, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [estimateId, item_type, reference_id, custom_name,
        unit, quantity, unit_price, total_cost, position,
        metadata ? JSON.stringify(metadata) : null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления элемента сметы:', error);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Запуск сервера
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api/test`);
  console.log(`🌐 Внешний доступ через порт: ${PORT}`);
  
  // Простая проверка подключения без создания таблиц
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Подключение к базе данных проверено:', result.rows[0].current_time);
    
    // Инициализируем таблицы только после успешного подключения
    setTimeout(() => initializeTables().catch(err => console.log('⚠️ Пропускаем инициализацию БД')), 1000);
  } catch (error) {
    console.log('⚠️  Будем работать без базы данных (статические данные)');
    console.log('❌ Ошибка подключения:', error.message);
  }
});

export default app;
