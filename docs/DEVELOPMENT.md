# 🛠️ Руководство по разработке SMETA360

> Техническая документация для разработчиков проекта SMETA360

---

## 📋 Оглавление

1. [Архитектура системы](#архитектура-системы)
2. [Настройка окружения](#настройка-окружения)
3. [Стандарты кода](#стандарты-кода)
4. [API Гайдлайны](#api-гайдлайны)
5. [База данных](#база-данных)
6. [Тестирование](#тестирование)
7. [Деплой](#деплой)
8. [Безопасность](#безопасность)

---

## 🏗️ Архитектура системы

### Общая схема

```mermaid
graph TB
    subgraph "Client Layer"
        A[React App] --> B[Vite Dev Server]
        A --> C[Material-UI Components]
        A --> D[Ant Design Components]
    end
    
    subgraph "API Layer"
        E[Express Server] --> F[JWT Middleware]
        E --> G[Tenant Context]
        E --> H[CORS Middleware]
    end
    
    subgraph "Data Layer"
        I[PostgreSQL] --> J[Connection Pool]
        I --> K[RLS Policies]
        I --> L[Indexes]
    end
    
    A --> E
    E --> I
```

### Структура модулей

#### Frontend (React)

```
src/
├── api/                 # HTTP клиенты для backend
├── components/          # Переиспользуемые UI компоненты  
├── pages/              # Страницы приложения
├── routes/             # Маршрутизация
├── hooks/              # Custom React hooks
├── contexts/           # React Context providers
├── utils/              # Утилитарные функции
└── assets/             # Статические ресурсы
```

#### Backend (Node.js)

```
server/
├── index.js            # Главный файл сервера (ТРЕБУЕТ РЕФАКТОРИНГА)
├── config.js           # Конфигурация приложения
├── database.js         # Подключение к PostgreSQL
├── controllers/        # API контроллеры (частично)
├── middleware/         # Express middleware
├── services/           # Бизнес логика
└── utils/              # Серверные утилиты
```

---

## ⚙️ Настройка окружения

### Системные требования

```bash
Node.js: >= 18.0.0
PostgreSQL: >= 12.0
Git: >= 2.0
Yarn: 4.9.1 (предпочтительно)
```

### Переменные окружения

#### `server/.env`

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Authentication  
JWT_SECRET=your-256-bit-secret-key-here
BCRYPT_SALT_ROUNDS=10

# Server
PORT=3001
NODE_ENV=development

# Security (опционально)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Генерация безопасного JWT секрета

```bash
# Используйте один из методов:
openssl rand -base64 32
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Development Setup

```bash
# 1. Установка зависимостей
npm install --legacy-peer-deps
cd server && npm install

# 2. Настройка базы данных
createdb smeta360_dev
psql smeta360_dev -f create_works_ref_database.sql

# 3. Запуск development серверов
npm run dev  # Запускает и frontend и backend
```

---

## 📝 Стандарты кода

### ESLint конфигурация

Проект использует настроенный ESLint с правилами:

```javascript
// eslint.config.mjs
export default [
  {
    rules: {
      'react/prop-types': 'off',           # PropTypes опциональны
      'no-console': 'off',                 # console.log разрешен
      'no-unused-vars': ['error', {        # Строгая проверка unused vars
        vars: 'all',
        args: 'none'
      }],
      'prettier/prettier': 'warn'          # Prettier интеграция
    }
  }
];
```

### Соглашения по именованию

#### Files & Folders

```bash
# React компоненты: PascalCase
src/components/UserProfile.jsx
src/pages/ProjectDashboard.jsx

# Hooks: camelCase с use префиксом
src/hooks/useDebounce.js
src/hooks/useAuth.js

# Утилиты: camelCase
src/utils/formatCurrency.js
src/utils/validateEmail.js

# API модули: camelCase
src/api/authService.js
src/api/projectsApi.js
```

#### Variables & Functions

```javascript
// ✅ Good
const userProfile = {};
const calculateTotalPrice = () => {};
const API_BASE_URL = 'https://api.example.com';

// ❌ Bad  
const UserProfile = {};        // Should be object, not component
const Calculate_Price = () => {}; // No underscores
const apiBaseUrl = 'https://...'; // Constants should be UPPERCASE
```

### Структура компонентов

```jsx
// components/ExampleComponent.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types'; // Опционально, но рекомендуется

// ==============================|| EXAMPLE COMPONENT ||============================== //

const ExampleComponent = ({ title, data, onUpdate }) => {
  // 1. Hooks
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 2. Effects
  useEffect(() => {
    // Side effects
  }, []);

  // 3. Event handlers
  const handleSubmit = async (event) => {
    event.preventDefault();
    // Handle logic
  };

  // 4. Render helpers
  const renderContent = () => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    return <div>{data}</div>;
  };

  // 5. Main render
  return (
    <div>
      <h2>{title}</h2>
      {renderContent()}
    </div>
  );
};

// PropTypes (рекомендуется для больших компонентов)
ExampleComponent.propTypes = {
  title: PropTypes.string.isRequired,
  data: PropTypes.array,
  onUpdate: PropTypes.func
};

export default ExampleComponent;
```

---

## 🔌 API Гайдлайны

### REST API соглашения

#### URL структура

```http
# ✅ Good
GET    /api/projects              # Коллекция
GET    /api/projects/123          # Элемент
POST   /api/projects              # Создание
PUT    /api/projects/123          # Обновление
DELETE /api/projects/123          # Удаление

# Nested resources
GET    /api/projects/123/estimates
POST   /api/projects/123/estimates

# Query parameters для фильтрации
GET    /api/materials?category=concrete&limit=50
```

#### Response форматы

```javascript
// ✅ Success Response
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Example Project",
    "created_at": "2025-09-28T12:00:00Z"
  },
  "message": "Project created successfully"
}

// ✅ Collection Response  
{
  "success": true,
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50,
    "pages": 3
  }
}

// ✅ Error Response
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Email is required",
    "password": "Password must be at least 8 characters"
  }
}
```

#### HTTP Status Codes

```javascript
// Используйте стандартные коды
200 OK          // Успешный запрос
201 Created     // Ресурс создан
204 No Content  // Успешное удаление
400 Bad Request // Ошибка валидации
401 Unauthorized // Не авторизован
403 Forbidden   // Нет прав доступа
404 Not Found   // Ресурс не найден
409 Conflict    // Конфликт (дублирование)
422 Unprocessable Entity // Ошибка бизнес-логики
500 Internal Server Error // Серверная ошибка
```

### Middleware разработка

#### Создание нового middleware

```javascript
// server/middleware/example.js
export function exampleMiddleware(req, res, next) {
  try {
    // 1. Валидация входных данных
    if (!req.headers.authorization) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
    }

    // 2. Основная логика
    const token = extractToken(req.headers.authorization);
    
    // 3. Установка контекста
    req.context = { token };
    
    // 4. Передача управления
    next();
  } catch (error) {
    console.error('Example middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'MIDDLEWARE_ERROR'
    });
  }
}
```

---

## 🗄️ База данных

### Миграции

```sql
-- migrations/001_create_users.sql
-- Description: Create users table with authentication fields
-- Author: Developer Name
-- Date: 2025-09-28

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  firstname VARCHAR(100),
  lastname VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- RLS Policy (если используется мультитенантность)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
```

### Database запросы

#### Паттерны для безопасных запросов

```javascript
// ✅ Good - Параметризованные запросы
const getUserById = async (id) => {
  const result = await query(
    'SELECT id, email, firstname FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
};

// ✅ Good - Транзакции для связанных операций
const createProjectWithEstimate = async (projectData, estimateData) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const projectResult = await client.query(
      'INSERT INTO projects (name, description) VALUES ($1, $2) RETURNING id',
      [projectData.name, projectData.description]
    );
    
    const estimateResult = await client.query(
      'INSERT INTO estimates (project_id, total) VALUES ($1, $2)',
      [projectResult.rows[0].id, estimateData.total]
    );
    
    await client.query('COMMIT');
    return { project: projectResult.rows[0], estimate: estimateResult.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ❌ Bad - SQL injection vulnerability
const getBadUser = async (email) => {
  // НИКОГДА НЕ ДЕЛАЙТЕ ТАК!
  const query = `SELECT * FROM users WHERE email = '${email}'`;
  return await db.query(query);
};
```

### Индексирование

```sql
-- Основные индексы для производительности

-- Аутентификация
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Бизнес данные  
CREATE INDEX idx_projects_user_id ON construction_projects(user_id);
CREATE INDEX idx_materials_name ON materials USING gin(to_tsvector('russian', name));
CREATE INDEX idx_works_ref_name ON works_ref USING gin(to_tsvector('russian', name));

-- Composite индексы для сложных запросов
CREATE INDEX idx_estimates_project_date ON estimates(project_id, created_at DESC);
```

---

## 🧪 Тестирование

### Настройка тестовой среды

#### Frontend тесты (Vitest)

```javascript
// vitest.config.js
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
      ]
    }
  }
});
```

#### Backend тесты (Jest)

```javascript
// server/jest.config.js
export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['./test/setup.js'],
  testMatch: ['**/__tests__/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/test/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### Паттерны тестирования

#### Unit тесты

```javascript
// tests/unit/utils/formatCurrency.test.js
import { formatCurrency } from '../../../src/utils/formatCurrency';

describe('formatCurrency', () => {
  test('should format positive numbers correctly', () => {
    expect(formatCurrency(1234.56)).toBe('1,234.56 ₽');
  });

  test('should handle zero', () => {
    expect(formatCurrency(0)).toBe('0.00 ₽');
  });

  test('should handle negative numbers', () => {
    expect(formatCurrency(-500)).toBe('-500.00 ₽');
  });

  test('should throw on invalid input', () => {
    expect(() => formatCurrency('invalid')).toThrow('Invalid number');
  });
});
```

#### Integration тесты

```javascript
// tests/integration/auth.test.js
import request from 'supertest';
import app from '../../server/index.js';

describe('POST /api/auth/login', () => {
  test('should return token for valid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });

  test('should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'wrongpassword'
      });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
```

#### E2E тесты (Cypress)

```javascript
// cypress/e2e/auth-flow.cy.js
describe('User Authentication', () => {
  it('should complete login flow', () => {
    cy.visit('/login');
    
    cy.get('[data-testid=email-input]').type('test@example.com');
    cy.get('[data-testid=password-input]').type('password123');
    cy.get('[data-testid=login-button]').click();
    
    cy.url().should('include', '/dashboard');
    cy.get('[data-testid=user-menu]').should('be.visible');
  });

  it('should show error for invalid credentials', () => {
    cy.visit('/login');
    
    cy.get('[data-testid=email-input]').type('test@example.com');
    cy.get('[data-testid=password-input]').type('wrongpassword');
    cy.get('[data-testid=login-button]').click();
    
    cy.get('[data-testid=error-message]').should('contain', 'Неверный email или пароль');
  });
});
```

---

## 🚀 Деплой

### Environment конфигурации

#### Production .env

```env
# Production Database
DATABASE_URL=postgresql://prod_user:secure_password@prod-host:5432/smeta360_prod

# Strong Security
JWT_SECRET=your-super-secure-256-bit-production-secret
BCRYPT_SALT_ROUNDS=12

# Production Settings
NODE_ENV=production
PORT=3001

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100   # 100 requests per window

# Logging
LOG_LEVEL=error
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3001
USER node

CMD ["node", "server/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=smeta360
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## 🔒 Безопасность

### Чек-лист безопасности

#### Authentication & Authorization

```javascript
// ✅ Secure JWT implementation
const jwt = require('jsonwebtoken');

const createSecureToken = (user, tenantId) => {
  return jwt.sign(
    {
      sub: user.id,           // Subject
      email: user.email,
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),  // Issued at
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',       // Short expiration
      issuer: 'smeta360-api', // Issuer
      algorithm: 'HS256'      // Secure algorithm
    }
  );
};

// ✅ Rate limiting
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                    // 5 attempts per window
  message: {
    error: 'Too many login attempts',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use('/api/auth/login', authLimiter);
```

#### Input Validation

```javascript
// ✅ Input sanitization with express-validator
const { body, validationResult } = require('express-validator');

const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least 8 characters with uppercase, lowercase and number'),
  
  body('firstname')
    .trim()
    .isLength({ min: 2, max: 50 })
    .matches(/^[a-zA-Zа-яё\s]+$/u)
    .withMessage('First name must be 2-50 characters, letters only'),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.mapped()
      });
    }
    next();
  }
];

app.post('/api/auth/register', validateRegistration, registerController);
```

#### Security Headers

```javascript
// ✅ Security headers middleware
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Аудит зависимостей

```bash
# Регулярная проверка уязвимостей
npm audit
npm audit fix

# Автоматизированная проверка в CI/CD
npm audit --audit-level=moderate

# Обновление зависимостей
npx npm-check-updates -u
npm install
```

---

## 📊 Мониторинг и логирование

### Structured Logging

```javascript
// utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Usage
logger.info('User authenticated', { userId: 123, tenantId: 'tenant-1' });
logger.error('Database connection failed', { error: error.message });
```

### Health Check endpoints

```javascript
// Health check implementation
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

app.get('/api/health/db', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      status: 'OK',
      database: 'Connected'
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: error.message
    });
  }
});
```

---

## 🤝 Workflow и процессы

### Git Workflow

```bash
# Feature development
git checkout -b feature/user-authentication
git commit -m "feat: add JWT token validation middleware"
git commit -m "test: add unit tests for auth middleware"
git commit -m "docs: update API documentation for auth endpoints"

# Commit message conventions
feat: новая функциональность
fix: исправление бага
docs: изменения в документации
style: форматирование кода
refactor: рефакторинг без изменения функциональности
test: добавление тестов
chore: изменения в build процессе или вспомогательных инструментах
```

### Code Review Checklist

- [ ] **Функциональность:** Код решает поставленную задачу
- [ ] **Безопасность:** Нет SQL injection, XSS, других уязвимостей
- [ ] **Производительность:** Нет N+1 запросов, оптимальные алгоритмы
- [ ] **Тестирование:** Покрытие критической логики тестами
- [ ] **Читаемость:** Понятные названия, комментарии где нужно
- [ ] **Архитектура:** Соответствие существующим паттернам
- [ ] **Документация:** Обновлена если нужно

---

*Документация обновлена: 28 сентября 2025*  
*Версия: 1.0*