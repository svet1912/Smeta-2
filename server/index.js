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
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002', 'file://'],
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
    `);

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

// Функция для вставки демонстрационных данных авторизации
async function insertDemoAuthData() {
  try {
  const salt = await bcrypt.genSalt(config.bcryptRounds);
    const hashedPassword = await bcrypt.hash('password123', salt);

    await query(`
      INSERT INTO auth_users (email, password_hash, firstname, lastname, company, is_active, email_verified)
      VALUES 
        ('admin@mantis.ru', $1, 'Админ', 'Система', 'Mantis Admin', true, true),
        ('user@mantis.ru', $2, 'Иван', 'Иванов', 'ОО Иванов и К°', true, true),
        ('demo@mantis.ru', $3, 'Демо', 'Пользователь', 'Демо Компания', true, false)
    `, [hashedPassword, hashedPassword, hashedPassword]);

    console.log('✅ Демонстрационные данные авторизации вставлены');
    console.log('🔑 Тестовые аккаунты:');
    console.log('   admin@mantis.ru / password123');
    console.log('   user@mantis.ru / password123');
    console.log('   demo@mantis.ru / password123');
    
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

// Запуск сервера
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api/test`);
  
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
