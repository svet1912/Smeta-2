# Smeta360-2 - Полная документация проекта

## 📋 Обзор проекта

**Smeta360-2** - это веб-приложение для расчета строительных смет, построенное на современном стеке технологий. Система предоставляет комплексные инструменты для управления проектами, расчетов стоимости работ и материалов, а также ведения справочников.

### 🎯 Основные возможности

- **Расчет смет**: Автоматический расчет стоимости строительных работ и материалов
- **Справочники**: Управление работами, материалами, фазами и стадиями
- **Управление проектами**: Создание и ведение строительных проектов
- **Многопользовательская система**: Поддержка нескольких тенантов и ролевой модели
- **Аналитика**: Статистика по лидам и проектам
- **API**: RESTful API для интеграции с внешними системами

## 🏗️ Архитектура системы

### Frontend (React + Vite)
```
src/
├── components/          # Переиспользуемые компоненты
├── contexts/           # React Context (Auth)
├── hooks/              # Кастомные хуки
├── pages/              # Страницы приложения
├── sections/           # Секции страниц
├── api/                # API клиенты
├── utils/              # Утилиты
└── App.jsx             # Главный компонент
```

### Backend (Node.js + Express)
```
server/
├── controllers/        # Контроллеры API
├── middleware/         # Middleware (auth, cors, logging)
├── routes/             # Маршруты API
├── services/           # Бизнес-логика
├── database.js         # Подключение к БД
├── config.js           # Конфигурация
└── start-refactored.js # Точка входа
```

## 🗄️ База данных Neon PostgreSQL 17.5

**Миграция завершена:** 7 октября 2025  
**Статус:** Production Ready на Neon Cloud

### Характеристики Neon PostgreSQL:
- **Хост:** ep-blue-voice-agwnve0m-pooler.c-2.eu-central-1.aws.neon.tech
- **Регион:** EU Central (Frankfurt) 
- **Размер:** 16.46 MB
- **Версия:** PostgreSQL 17.5
- **Особенности:** Auto-scaling, Connection pooling, Branching, Point-in-time recovery
- **Экономия:** $240+/год (переход с Aiven на Neon Free Tier)

### Схема базы данных

#### 🔐 Таблицы аутентификации и пользователей

**`auth_users`** - Основная таблица пользователей
```sql
CREATE TABLE auth_users (
    id SERIAL PRIMARY KEY,
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);
```

**`user_sessions`** - Сессии пользователей (JWT токены)
```sql
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`user_roles`** - Роли в системе
```sql
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    permissions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`user_role_assignments`** - Назначение ролей пользователям
```sql
CREATE TABLE user_role_assignments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_users(id),
    role_id INTEGER REFERENCES user_roles(id),
    tenant_id UUID,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 🏢 Мультитенантность

**`tenants`** - Тенанты (компании/организации)
```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255),
    settings JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`user_tenants`** - Связь пользователей с тенантами
```sql
CREATE TABLE user_tenants (
    user_id INTEGER REFERENCES auth_users(id),
    tenant_id UUID REFERENCES tenants(id),
    role VARCHAR(50) DEFAULT 'viewer',
    is_current BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, tenant_id)
);
```

#### 📊 Справочники и каталоги

**`materials`** - Материалы (1448 записей)
```sql
CREATE TABLE materials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    image_url TEXT,
    item_url TEXT,
    unit VARCHAR(50),
    unit_price DECIMAL(10,2),
    category VARCHAR(100),
    supplier VARCHAR(255),
    description TEXT,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`works_ref`** - Справочник работ (540 записей)
```sql
CREATE TABLE works_ref (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    unit VARCHAR(50),
    unit_price DECIMAL(10,2),
    sort_order INTEGER DEFAULT 0,
    phase_id INTEGER REFERENCES phases(id),
    stage_id INTEGER REFERENCES stages(id),
    substage_id INTEGER REFERENCES substages(id),
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`phases`** - Фазы строительства (540 записей)
```sql
CREATE TABLE phases (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`stages`** - Стадии работ
```sql
CREATE TABLE stages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    phase_id INTEGER REFERENCES phases(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`substages`** - Подстадии работ
```sql
CREATE TABLE substages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sort_order INTEGER DEFAULT 0,
    stage_id INTEGER REFERENCES stages(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`work_materials`** - Связь работ с материалами (1425 записей)
```sql
CREATE TABLE work_materials (
    id SERIAL PRIMARY KEY,
    work_id INTEGER REFERENCES works_ref(id),
    material_id INTEGER REFERENCES materials(id),
    quantity DECIMAL(10,4) DEFAULT 1.0,
    unit VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 🏗️ Проекты и сметы

**`construction_projects`** - Строительные проекты
```sql
CREATE TABLE construction_projects (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    object_address TEXT NOT NULL,
    contractor_name VARCHAR(255) NOT NULL,
    contract_number VARCHAR(100) NOT NULL,
    deadline DATE,
    status VARCHAR(50) DEFAULT 'active',
    user_id INTEGER REFERENCES auth_users(id),
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`customer_estimates`** - Сметы заказчиков
```sql
CREATE TABLE customer_estimates (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id),
    estimate_name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'draft',
    created_by INTEGER REFERENCES auth_users(id),
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`customer_estimate_items`** - Позиции смет
```sql
CREATE TABLE customer_estimate_items (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER REFERENCES customer_estimates(id),
    work_id INTEGER REFERENCES works_ref(id),
    material_id INTEGER REFERENCES materials(id),
    quantity DECIMAL(10,4) NOT NULL,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 🏠 Объекты и помещения

**`object_parameters`** - Параметры объектов
```sql
CREATE TABLE object_parameters (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id),
    parameter_name VARCHAR(255) NOT NULL,
    parameter_value VARCHAR(500),
    unit VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`project_rooms`** - Помещения проектов
```sql
CREATE TABLE project_rooms (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id),
    room_name VARCHAR(255) NOT NULL,
    room_type VARCHAR(100),
    area DECIMAL(10,2),
    volume DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`constructive_elements`** - Конструктивные элементы
```sql
CREATE TABLE constructive_elements (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id),
    element_name VARCHAR(255) NOT NULL,
    element_type VARCHAR(100),
    dimensions TEXT,
    material_id INTEGER REFERENCES materials(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`engineering_systems`** - Инженерные системы
```sql
CREATE TABLE engineering_systems (
    id SERIAL PRIMARY KEY,
    project_id INTEGER REFERENCES construction_projects(id),
    system_name VARCHAR(255) NOT NULL,
    system_type VARCHAR(100),
    specifications TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 📈 Аналитика и лиды

**`leads`** - Заявки/лиды
```sql
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    project_type VARCHAR(100),
    budget DECIMAL(15,2),
    message TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    page_path VARCHAR(500),
    env_name VARCHAR(100),
    consent BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`statistics`** - Статистика системы
```sql
CREATE TABLE statistics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2),
    metric_type VARCHAR(50),
    date_recorded DATE DEFAULT CURRENT_DATE,
    tenant_id UUID REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**`audit_log`** - Лог аудита
```sql
CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES auth_users(id),
    tenant_id UUID REFERENCES tenants(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INTEGER,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 📊 Статистика базы данных (актуальная после миграции на Neon)

| Таблица | Записей | Описание |
|---------|---------|----------|
| `materials` | 1,448 | Материалы и комплектующие |
| `works_ref` | 540 | Справочник строительных работ |
| `work_materials` | 1,425 | Связи работ с материалами |
| `phases` | 540 | Фазы строительства |
| `stages` | ~200 | Стадии работ |
| `substages` | ~100 | Подстадии работ |
| `leads` | ~50 | Заявки и лиды |
| `auth_users` | 3+ | Пользователи системы |
| `tenants` | 3+ | Тенанты |
| **Всего таблиц** | **49** | **Полная схема в Neon** |
| **Общий размер БД** | **16.46 MB** | **Оптимизированная структура** |

## 🔌 API Endpoints

### 🔐 Аутентификация (`/api/auth`)

| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| POST | `/login` | Вход в систему | ❌ |
| POST | `/logout` | Выход из системы | ✅ |
| POST | `/refresh` | Обновление токена | ❌ |
| GET | `/me` | Информация о пользователе | ✅ |
| GET | `/tenants` | Список тенантов пользователя | ✅ |
| POST | `/switch-tenant` | Смена тенанта | ✅ |

### 📋 Справочники (`/api`)

#### Материалы
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/materials` | Список материалов | ❌ |
| POST | `/materials` | Создание материала | ✅ |
| PUT | `/materials/:id` | Обновление материала | ✅ |
| DELETE | `/materials/:id` | Удаление материала | ✅ |

#### Работы
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/works` | Список работ | ❌ |
| POST | `/works` | Создание работы | ✅ |
| GET | `/works/:workId/materials` | Материалы работы | ✅ |
| POST | `/works/:workId/materials` | Добавление материала к работе | ✅ |
| PUT | `/works/:workId/materials/:materialId` | Обновление связи | ✅ |
| DELETE | `/works/:workId/materials/:materialId` | Удаление связи | ✅ |

#### Фазы
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/phases` | Список фаз | ❌ |

#### Материалы работ
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/work-materials` | Связи работ и материалов | ❌ |

### 📊 Проекты и сметы (`/api`)

#### Проекты
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/projects` | Список проектов пользователя | ✅ |
| POST | `/projects` | Создание проекта | ✅ |
| GET | `/projects/:id` | Детали проекта | ✅ |
| PUT | `/projects/:id` | Обновление проекта | ✅ |
| DELETE | `/projects/:id` | Удаление проекта | ✅ |

#### Параметры объектов
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/projects/:projectId/parameters` | Параметры объекта | ✅ |
| POST | `/projects/:projectId/parameters` | Создание параметра | ✅ |
| PUT | `/projects/:projectId/parameters/:id` | Обновление параметра | ✅ |
| DELETE | `/projects/:projectId/parameters/:id` | Удаление параметра | ✅ |

#### Помещения
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/projects/:projectId/rooms` | Помещения проекта | ✅ |
| POST | `/projects/:projectId/rooms` | Создание помещения | ✅ |
| PUT | `/projects/:projectId/rooms/:id` | Обновление помещения | ✅ |
| DELETE | `/projects/:projectId/rooms/:id` | Удаление помещения | ✅ |

#### Конструктивные элементы
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/projects/:projectId/elements` | Элементы проекта | ✅ |
| POST | `/projects/:projectId/elements` | Создание элемента | ✅ |
| PUT | `/projects/:projectId/elements/:id` | Обновление элемента | ✅ |
| DELETE | `/projects/:projectId/elements/:id` | Удаление элемента | ✅ |

#### Инженерные системы
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/projects/:projectId/systems` | Системы проекта | ✅ |
| POST | `/projects/:projectId/systems` | Создание системы | ✅ |
| PUT | `/projects/:projectId/systems/:id` | Обновление системы | ✅ |
| DELETE | `/projects/:projectId/systems/:id` | Удаление системы | ✅ |

#### Сметы заказчиков
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/customer-estimates` | Список смет | ✅ |
| POST | `/customer-estimates` | Создание сметы | ✅ |
| GET | `/customer-estimates/:id` | Детали сметы | ✅ |
| PUT | `/customer-estimates/:id` | Обновление сметы | ✅ |
| DELETE | `/customer-estimates/:id` | Удаление сметы | ✅ |
| GET | `/customer-estimates/:id/items` | Позиции сметы | ✅ |
| POST | `/customer-estimates/:id/items` | Добавление позиции | ✅ |
| PUT | `/customer-estimates/:id/items/:itemId` | Обновление позиции | ✅ |
| DELETE | `/customer-estimates/:id/items/:itemId` | Удаление позиции | ✅ |

### 📈 Лиды и аналитика (`/api/leads`)

| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/leads` | Список заявок | ❌ |
| POST | `/leads` | Создание заявки | ❌ |
| GET | `/leads/stats` | Статистика заявок | ❌ |

### 🔧 Системные endpoints (`/api`)

| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/health` | Проверка здоровья сервера | ❌ |
| GET | `/metrics` | Метрики Prometheus | ❌ |

#### Административные endpoints
| Метод | Endpoint | Описание | Требует авторизации |
|-------|----------|----------|-------------------|
| GET | `/admin/cache/stats` | Статистика кэша | ✅ |
| DELETE | `/admin/cache` | Очистка кэша | ✅ |
| GET | `/admin/statistics` | Системная статистика | ✅ |

## 🔒 Безопасность

### Аутентификация
- **JWT токены** с access/refresh механизмом
- **Токены хранятся в localStorage** (известный риск XSS)
- **Время жизни access токена**: 15 минут
- **Время жизни refresh токена**: 7 дней
- **Ротация токенов** при обновлении

### Авторизация
- **5 уровней ролей**:
  - `super_admin` - Супер администратор
  - `admin` - Администратор
  - `project_manager` - Менеджер проектов
  - `estimator` - Сметчик
  - `viewer` - Просмотр

### Мультитенантность
- **Row Level Security (RLS)** в PostgreSQL
- **Изоляция данных** по tenant_id
- **Контекст пользователя** устанавливается в БД сессии

### Rate Limiting
- **Общий лимит**: 1000 запросов в 15 минут
- **Авторизация**: 5 запросов в 15 минут
- **Лиды**: 10 запросов в 15 минут
- **Мутации**: 100 запросов в 15 минут

## ⚡ Производительность

### Backend оптимизации
- **Connection pooling** для PostgreSQL
- **Кэширование запросов** через Redis
- **Индексы БД** для быстрого поиска
- **Медленные запросы** логируются (>1000ms)
- **Compression** для HTTP ответов

### Frontend оптимизации
- **Code splitting** с Vite
- **Lazy loading** компонентов
- **Virtualized lists** для больших списков
- **Image optimization** с lazy loading
- **Preloading** критических ресурсов

### Мониторинг
- **Prometheus метрики** на `/metrics`
- **Pino HTTP логирование**
- **Health checks** на `/health`
- **Метрики производительности** запросов

## 🚀 Развертывание

### Требования
- **Node.js** 18+
- **PostgreSQL** - Neon Cloud (мигрировано 7 октября 2025)
- **Redis** (опционально для кэширования)

### Переменные окружения (обновлено для Neon)
```bash
# База данных (Neon PostgreSQL 17.5)
DATABASE_URL=postgresql://neondb_owner:***@ep-blue-voice-agwnve0m-pooler.c-2.eu-central-1.aws.neon.tech/neondb?sslmode=require
DATABASE_SSLMODE=require
DATABASE_SSL=true

# JWT секреты (автогенерируются если не указаны)
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret

# Сервер
PORT=3001
NODE_ENV=production

# Кэширование
CACHE_ENABLED=true
REDIS_URL=redis://localhost:6379
```

### Команды запуска
```bash
# Backend
cd server && npm install
npm run start

# Frontend
npm install
npm run build
npm run preview
```

## 📝 Технический стек

### Frontend
- **React 18** - UI библиотека
- **Vite** - Сборщик и dev сервер
- **Material-UI** - UI компоненты
- **Ant Design** - Дополнительные компоненты
- **React Router** - Маршрутизация
- **TanStack Query** - Управление состоянием
- **Framer Motion** - Анимации

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **Neon PostgreSQL 17.5** - Современная база данных с auto-scaling
- **Redis** - Кэширование (опционально)
- **JWT** - Аутентификация
- **bcrypt** - Хэширование паролей
- **Pino** - Логирование
- **Prometheus** - Метрики

### DevOps
- **GitHub Actions** - CI/CD
- **Neon Cloud** - PostgreSQL хостинг (миграция 7 октября 2025)
- **Vercel** - Frontend/API деплой
- **Docker** - Контейнеризация (планируется)

## 🔄 Workflow разработки

### Git Flow
- **main** - Продакшн ветка
- **develop** - Разработка
- **feature/*** - Функциональные ветки
- **hotfix/*** - Критические исправления

### Тестирование
- **Vitest** - Unit тесты (backend)
- **Playwright** - E2E тесты
- **Contract Tests** - Zod валидация
- **Cache Tests** - Тестирование кэша

## 📈 Метрики и KPI

### Производительность
- **Время загрузки страниц** < 2 сек
- **API response time** < 500ms
- **Database query time** < 1000ms
- **Bundle size** < 2MB

### Бизнес метрики
- **Количество активных пользователей**
- **Количество созданных смет**
- **Конверсия лидов**
- **Время выполнения расчетов**

## 🛠️ Известные проблемы и TODO

### Архитектурные проблемы
- ✅ **Решено**: Монолитный index.js (3,147 строк) → модульная архитектура
- ✅ **Решено**: Дублирование middleware → унифицированная система
- ✅ **Решено**: Отсутствие централизованного роутинга → модульные роуты

### Проблемы безопасности
- ⚠️ **Частично решено**: JWT токены в localStorage (XSS риск)
- ✅ **Решено**: Отсутствие rate limiting → настроен
- ✅ **Решено**: Слабые секреты → автогенерация

### Проблемы производительности
- ✅ **Решено**: Медленная загрузка → оптимизация запросов
- ✅ **Решено**: Отсутствие lazy loading → реализован
- ✅ **Решено**: Неоптимизированные запросы → кэширование

### TODO
- [ ] Миграция на httpOnly cookies для JWT
- [ ] Добавление Docker контейнеризации
- [ ] Расширение тестового покрытия
- [ ] Добавление WebSocket для real-time уведомлений
- [ ] Интеграция с внешними API поставщиков материалов

## 📞 Поддержка

### Контакты
- **Email**: kiy026@yandex.ru
- **Telegram**: @username
- **GitHub**: https://github.com/IYK026/Smeta360-2

### Документация API
- **Swagger/OpenAPI**: http://localhost:3001/api-docs (планируется)
- **Postman Collection**: доступна в репозитории

## 🔄 Схемы взаимодействия компонентов

### 1. Архитектурная диаграмма системы

```
┌─────────────────────────────────────────────────────────────────┐
│                        Smeta360-2 System                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    HTTP/HTTPS    ┌─────────────────────┐   │
│  │   Frontend      │◄─────────────────►│    Backend API      │   │
│  │   (React)       │   REST API       │   (Node.js)        │   │
│  │   Port: 3000    │                  │   Port: 3001       │   │
│  └─────────────────┘                  └─────────────────────┘   │
│           │                                    │                 │
│           │                                    │                 │
│           │                                    ▼                 │
│           │                          ┌─────────────────────┐     │
│           │                          │   Middleware Layer  │     │
│           │                          │                     │     │
│           │                          │ • Auth              │     │
│           │                          │ • CORS              │     │
│           │                          │ • Rate Limiting     │     │
│           │                          │ • Logging           │     │
│           │                          └─────────────────────┘     │
│           │                                    │                 │
│           │                                    ▼                 │
│           │                          ┌─────────────────────┐     │
│           │                          │   Router Layer      │     │
│           │                          │                     │     │
│           │                          │ • /api/auth         │     │
│           │                          │ • /api/materials    │     │
│           │                          │ • /api/works        │     │
│           │                          │ • /api/projects     │     │
│           │                          │ • /api/leads        │     │
│           │                          └─────────────────────┘     │
│           │                                    │                 │
│           │                                    ▼                 │
│           │                          ┌─────────────────────┐     │
│           │                          │   Controller Layer  │     │
│           │                          │                     │     │
│           │                          │ • authController    │     │
│           │                          │ • catalogController │     │
│           │                          │ • projectController │     │
│           │                          │ • leadController    │     │
│           │                          └─────────────────────┘     │
│           │                                    │                 │
│           │                                    ▼                 │
│           │                          ┌─────────────────────┐     │
│           │                          │   Service Layer     │     │
│           │                          │                     │     │
│           │                          │ • tokenService      │     │
│           │                          │ • queryOptimizer    │     │
│           │                          │ • databaseService   │     │
│           │                          └─────────────────────┘     │
│           │                                    │                 │
│           │                                    ▼                 │
│           │                          ┌─────────────────────┐     │
│           │                          │   Database Layer    │     │
│           │                          │                     │     │
│           │                          │ • PostgreSQL        │     │
│           │                          │ • Connection Pool   │     │
│           │                          │ • Query Execution   │     │
│           │                          └─────────────────────┘     │
│           │                                    │                 │
│           │                                    ▼                 │
│           │                          ┌─────────────────────┐     │
│           │                          │   Aiven Cloud       │     │
│           │                          │   PostgreSQL 17.6   │     │
│           │                          │   Hosted Database   │     │
│           │                          └─────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Поток аутентификации

```
┌─────────────┐    POST /api/auth/login    ┌─────────────┐
│   Frontend  │───────────────────────────►│   Backend   │
│   (Login)   │                            │             │
└─────────────┘                            └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Auth Ctrl   │
       │                                  │             │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Verify      │
       │                                  │ Password    │
       │                                  │ (bcrypt)    │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Token       │
       │                                  │ Service     │
       │                                  │             │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Generate    │
       │                                  │ JWT Tokens  │
       │                                  │             │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Save        │
       │                                  │ Refresh     │
       │                                  │ Token to DB │
       │                                  └─────────────┘
       │                                           │
       │        { accessToken, user }              │
       │◄──────────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│ Store Token │
│ in localStorage │
└─────────────┘
```

### 3. Поток запроса к API с авторизацией

```
┌─────────────┐    GET /api/materials     ┌─────────────┐
│   Frontend  │──────────────────────────►│   Backend   │
│             │    Authorization: Bearer  │             │
└─────────────┘                           └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Auth        │
       │                                  │ Middleware  │
       │                                  │             │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Verify JWT  │
       │                                  │ Token       │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Set DB      │
       │                                  │ Context     │
       │                                  │ (user_id,   │
       │                                  │  tenant_id) │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Route to    │
       │                                  │ Controller  │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Catalog     │
       │                                  │ Controller  │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Query       │
       │                                  │ Optimizer   │
       │                                  │ (Cache)     │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ Execute     │
       │                                  │ SQL Query   │
       │                                  │ to DB       │
       │                                  └─────────────┘
       │                                           │
       │                                           ▼
       │                                  ┌─────────────┐
       │                                  │ PostgreSQL  │
       │                                  │ Database    │
       │                                  └─────────────┘
       │                                           │
       │        { success: true, data: [...] }     │
       │◄──────────────────────────────────────────┘
```

### 4. Взаимодействие с базой данных

```
┌─────────────────────────────────────────────────────────────────┐
│                    Database Interaction Flow                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    Connection Pool    ┌─────────────────────┐  │
│  │ Controllers │◄─────────────────────►│   PostgreSQL        │  │
│  │             │                       │   Connection Pool  │  │
│  └─────────────┘                       │   (10 connections) │  │
│         │                              └─────────────────────┘  │
│         │                                       │                │
│         ▼                                       ▼                │
│  ┌─────────────┐                       ┌─────────────────────┐  │
│  │ Query       │    Parameterized      │   Aiven Cloud      │  │
│  │ Execution   │    SQL Queries        │   PostgreSQL 17.6  │  │
│  │ (database.js)│                       │   • SSL/TLS        │  │
│  └─────────────┘                       │   • RLS Enabled     │  │
│         │                              │   • Indexes        │  │
│         ▼                              │   • Triggers       │  │
│  ┌─────────────┐                       └─────────────────────┘  │
│  │ Query       │                                               │
│  │ Logging     │                                               │
│  │ (Slow Query │                                               │
│  │  Detection) │                                               │
│  └─────────────┘                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5. Схема мультитенантности

```
┌─────────────────────────────────────────────────────────────────┐
│                      Multi-Tenant Architecture                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    User Login     ┌─────────────────────┐      │
│  │   User      │──────────────────►│   Auth Controller   │      │
│  │ (kiy026@    │                   │                     │      │
│  │  yandex.ru) │                   └─────────────────────┘      │
│  └─────────────┘                           │                    │
│                                            ▼                    │
│                                   ┌─────────────────────┐      │
│                                   │ Check user_tenants  │      │
│                                   │ table for tenant    │      │
│                                   │ association         │      │
│                                   └─────────────────────┘      │
│                                            │                    │
│                                            ▼                    │
│  ┌─────────────┐    JWT Token      ┌─────────────────────┐      │
│  │   Client    │◄──────────────────│ Generate JWT with   │      │
│  │  Browser    │    (with tenant)  │ user_id + tenant_id │      │
│  └─────────────┘                   └─────────────────────┘      │
│         │                                                    │
│         │ API Request with JWT                              │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                API Request Flow                         │  │
│  │                                                         │  │
│  │  ┌─────────────┐    Extract      ┌─────────────────┐   │  │
│  │  │ Auth        │    JWT Claims   │ Set DB Session  │   │  │
│  │  │ Middleware  │────────────────►│ Variables:      │   │  │
│  │  │             │                 │ • app.user_id   │   │  │
│  │  │             │                 │ • app.tenant_id │   │  │
│  │  │             │                 └─────────────────┘   │  │
│  │  └─────────────┘                                       │  │
│  │         │                                              │  │
│  │         ▼                                              │  │
│  │  ┌─────────────┐                                       │  │
│  │  │ Row Level   │    Automatically filters              │  │
│  │  │ Security    │    data by tenant_id                  │  │
│  │  │ (RLS)       │                                       │  │
│  │  └─────────────┘                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              Data Isolation Example                     │  │
│  │                                                         │  │
│  │  SELECT * FROM materials                                │  │
│  │  WHERE tenant_id = app.tenant_id  -- RLS automatically │  │
│  │  OR tenant_id IS NULL              -- Global materials  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Кэширование и оптимизация запросов

```
┌─────────────────────────────────────────────────────────────────┐
│                Query Optimization & Caching Flow               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    Request      ┌─────────────────────┐       │
│  │ Controller  │────────────────►│ Query Optimizer     │       │
│  │             │                 │ Service             │       │
│  └─────────────┘                 └─────────────────────┘       │
│                                         │                      │
│                                         ▼                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               Cache Check Process                       │   │
│  │                                                         │   │
│  │  1. Generate Cache Key:                                 │   │
│  │     "materials_false_2000_0"                           │   │
│  │                                                         │   │
│  │  2. Check Redis Cache:                                  │   │
│  │     • Cache HIT  → Return cached data                   │   │
│  │     • Cache MISS → Execute DB query                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                         │                      │
│                                         ▼                      │
│  ┌─────────────┐    SQL Query    ┌─────────────────────┐       │
│  │ PostgreSQL  │◄────────────────│ Database Query      │       │
│  │ Database    │                 │ Execution           │       │
│  └─────────────┘                 └─────────────────────┘       │
│         │                                │                      │
│         │ Query Results                  ▼                      │
│         │ (1448 rows)            ┌─────────────────────┐       │
│         │                        │ Store in Cache      │       │
│         │                        │ (TTL: 10 minutes)   │       │
│         │                        └─────────────────────┘       │
│         │                                │                      │
│         │                                ▼                      │
│         │                        ┌─────────────────────┐       │
│         │                        │ Return to Client    │       │
│         │                        │ with Cache Info     │       │
│         │                        └─────────────────────┘       │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Performance Metrics                        │   │
│  │                                                         │   │
│  │  • First Request: ~2874ms (DB query)                   │   │
│  │  • Cached Request: ~28ms (cache hit)                   │   │
│  │  • Performance Gain: 100x faster                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 7. Поток создания сметы

```
┌─────────────────────────────────────────────────────────────────┐
│                      Estimate Creation Flow                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    User Action    ┌─────────────────────┐     │
│  │ Frontend    │──────────────────►│ Estimate Form       │     │
│  │ (React)     │                   │ Component           │     │
│  └─────────────┘                   └─────────────────────┘     │
│         │                                  │                   │
│         │ Load Data                        ▼                   │
│         ▼                          ┌─────────────────────┐     │
│  ┌─────────────┐    API Calls      │ Load All Data       │     │
│  │ API Calls   │──────────────────►│ • Works (540)       │     │
│  │             │                   │ • Materials (1448)  │     │
│  └─────────────┘                   │ • Work-Materials    │     │
│         │                          │   (1425)           │     │
│         │                          └─────────────────────┘     │
│         ▼                                  │                   │
│  ┌─────────────┐                          ▼                   │
│  │ Backend     │    GET requests    ┌─────────────────────┐     │
│  │ API         │◄───────────────────│ Catalog Controller  │     │
│  │             │                    │                     │     │
│  └─────────────┘                    └─────────────────────┘     │
│         │                                  │                   │
│         │                                  ▼                   │
│         │                          ┌─────────────────────┐     │
│         │                          │ Query Optimizer    │     │
│         │                          │ with Caching       │     │
│         │                          └─────────────────────┘     │
│         │                                  │                   │
│         │                                  ▼                   │
│         │                          ┌─────────────────────┐     │
│         │                          │ PostgreSQL DB       │     │
│         │                          │ • works_ref         │     │
│         │                          │ • materials         │     │
│         │                          │ • work_materials    │     │
│         │                          └─────────────────────┘     │
│         │                                  │                   │
│         │        JSON Response             │                   │
│         │◄─────────────────────────────────┘                   │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Frontend Data Processing                   │   │
│  │                                                         │   │
│  │  1. Transform work-materials into grouped structure    │   │
│  │  2. Create hierarchical view:                          │   │
│  │     Work → Materials → Quantities                      │   │
│  │  3. Enable user selection and quantity input           │   │
│  │  4. Calculate totals automatically                     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────┐    POST /api/    ┌─────────────────────┐     │
│  │ Save        │    customer-     │ Estimate Controller │     │
│  │ Estimate    │    estimates     │                     │     │
│  └─────────────┘                  └─────────────────────┘     │
│         │                                  │                   │
│         │                                  ▼                   │
│         │                          ┌─────────────────────┐     │
│         │                          │ Create Estimate     │     │
│         │                          │ & Items in DB       │     │
│         │                          └─────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 8. Система мониторинга и логирования

```
┌─────────────────────────────────────────────────────────────────┐
│                Monitoring & Logging Architecture               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    HTTP Request ┌─────────────────────┐       │
│  │ Client      │────────────────►│ Express Server      │       │
│  │ Request     │                 │                     │       │
│  └─────────────┘                 └─────────────────────┘       │
│                                         │                      │
│                                         ▼                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Middleware Chain                         │   │
│  │                                                         │   │
│  │  1. CORS Middleware                                     │   │
│  │  2. Rate Limiting Middleware                            │   │
│  │  3. Logging Middleware (Pino)                           │   │
│  │  4. Auth Middleware                                     │   │
│  │  5. Route Handler                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                         │                      │
│                                         ▼                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Logging & Metrics Collection               │   │
│  │                                                         │   │
│  │  ┌─────────────┐    Request    ┌─────────────────────┐  │   │
│  │  │ Pino HTTP   │    Logs       │ JSON Logs           │  │   │
│  │  │ Logger      │──────────────►│ • Request ID        │  │   │
│  │  │             │               │ • Method & URL      │  │   │
│  │  │             │               │ • Response Time     │  │   │
│  │  │             │               │ • Status Code       │  │   │
│  │  │             │               │ • User Agent        │  │   │
│  │  └─────────────┘               └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    Slow Query ┌─────────────────────┐  │   │
│  │  │ Database    │    Detection  │ Slow Query Logger   │  │   │
│  │  │ Monitor     │──────────────►│ • Query Text        │  │   │
│  │  │             │               │ • Execution Time    │  │   │
│  │  │             │               │ • Row Count         │  │   │
│  │  │             │               │ • Parameters        │  │   │
│  │  └─────────────┘               └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    Metrics    ┌─────────────────────┐  │   │
│  │  │ Prometheus  │    Collection │ Metrics Endpoint    │  │   │
│  │  │ Metrics     │──────────────►│ • HTTP Requests     │  │   │
│  │  │             │               │ • Response Times    │  │   │
│  │  │             │               │ • Error Rates       │  │   │
│  │  │             │               │ • Database Queries  │  │   │
│  │  └─────────────┘               └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                         │                      │
│                                         ▼                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Health Monitoring                          │   │
│  │                                                         │   │
│  │  GET /health                                            │   │
│  │  • Server Status                                        │   │
│  │  • Database Connection                                  │   │
│  │  • Response Time                                        │   │
│  │  • Memory Usage                                         │   │
│  │                                                         │   │
│  │  GET /metrics                                           │   │
│  │  • Prometheus Format                                    │   │
│  │  • System Metrics                                       │   │
│  │  • Application Metrics                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9. Схема развертывания

```
┌─────────────────────────────────────────────────────────────────┐
│                      Deployment Architecture                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Development Environment                   │   │
│  │                                                         │   │
│  │  ┌─────────────┐    npm run client ┌─────────────────┐  │   │
│  │  │ Frontend    │──────────────────►│ Vite Dev Server │  │   │
│  │  │ (React)     │                   │ Port: 3000      │  │   │
│  │  │             │                   │ Hot Reload      │  │   │
│  │  └─────────────┘                   └─────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    npm run server ┌─────────────────┐  │   │
│  │  │ Backend     │──────────────────►│ Node.js Server  │  │   │
│  │  │ (Node.js)   │                   │ Port: 3001      │  │   │
│  │  │             │                   │ Auto Restart    │  │   │
│  │  └─────────────┘                   └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                │                                │
│                                │ HTTPS Connection               │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Production Environment                   │   │
│  │                                                         │   │
│  │  ┌─────────────┐    GitHub Actions ┌─────────────────┐  │   │
│  │  │ CI/CD       │──────────────────►│ Auto Deploy     │  │   │
│  │  │ Pipeline    │                   │ • Build         │  │   │
│  │  │             │                   │ • Test          │  │   │
│  │  │             │                   │ • Deploy        │  │   │
│  │  └─────────────┘                   └─────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    Load Balancer ┌─────────────────┐  │   │
│  │  │ Production  │◄─────────────────►│ Multiple        │  │   │
│  │  │ Server      │                   │ Instances      │  │   │
│  │  │             │                   │ (Scaling)      │  │   │
│  │  └─────────────┘                   └─────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    SSL/TLS       ┌─────────────────┐  │   │
│  │  │ Domain      │◄─────────────────►│ HTTPS           │  │   │
│  │  │ (smeta360.  │                   │ Certificate     │  │   │
│  │  │  com)       │                   │ Auto Renewal    │  │   │
│  │  └─────────────┘                   └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                │                                │
│                                │ Database Connection            │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Aiven Cloud Database                    │   │
│  │                                                         │   │
│  │  ┌─────────────┐    PostgreSQL    ┌─────────────────┐  │   │
│  │  │ Database    │◄────────────────►│ Managed         │  │   │
│  │  │ Cluster     │    SSL/TLS       │ PostgreSQL 17.6 │  │   │
│  │  │             │                  │ • Backups       │  │   │
│  │  │             │                  │ • Monitoring    │  │   │
│  │  │             │                  │ • Scaling       │  │   │
│  │  └─────────────┘                  └─────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 10. Схема безопасности

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Architecture                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Client Security                          │   │
│  │                                                         │   │
│  │  ┌─────────────┐    JWT Storage ┌─────────────────────┐  │   │
│  │  │ Browser     │◄──────────────►│ localStorage        │  │   │
│  │  │ Security    │                │ (XSS Risk)          │  │   │
│  │  │             │                │ • Access Token      │  │   │
│  │  │             │                │ • 15 min TTL        │  │   │
│  │  │             │                │ • Auto Refresh      │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    HTTPS      ┌─────────────────────┐  │   │
│  │  │ HTTPS       │◄──────────────►│ SSL/TLS             │  │   │
│  │  │ Connection  │                │ Encryption          │  │   │
│  │  │             │                │ • Data in Transit   │  │   │
│  │  │             │                │ • Certificate       │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Server Security                          │   │
│  │                                                         │   │
│  │  ┌─────────────┐    Rate Limit  ┌─────────────────────┐  │   │
│  │  │ Request     │◄──────────────►│ Express Rate Limit  │  │   │
│  │  │ Throttling  │                │ • 1000 req/15min    │  │   │
│  │  │             │                │ • Auth: 5 req/15min │  │   │
│  │  │             │                │ • Leads: 10 req/15min│ │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    CORS       ┌─────────────────────┐  │   │
│  │  │ Cross-Origin│◄──────────────►│ CORS Middleware     │  │   │
│  │  │ Protection  │                │ • Allowed Origins   │  │   │
│  │  │             │                │ • Credentials       │  │   │
│  │  │             │                │ • Methods           │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    JWT Verify ┌─────────────────────┐  │   │
│  │  │ JWT         │◄──────────────►│ Auth Middleware     │  │   │
│  │  │ Validation  │                │ • Token Signature   │  │   │
│  │  │             │                │ • Expiration        │  │   │
│  │  │             │                │ • User Context      │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                │                                │
│                                ▼                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Database Security                        │   │
│  │                                                         │   │
│  │  ┌─────────────┐    RLS        ┌─────────────────────┐  │   │
│  │  │ Row Level   │◄──────────────►│ PostgreSQL RLS      │  │   │
│  │  │ Security    │                │ • Tenant Isolation  │  │   │
│  │  │             │                │ • User Context      │  │   │
│  │  │             │                │ • Automatic Filter  │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    Encryption ┌─────────────────────┐  │   │
│  │  │ Password    │◄──────────────►│ bcrypt Hashing      │  │   │
│  │  │ Security    │                │ • Salt Rounds: 12   │  │   │
│  │  │             │                │ • Hash Storage      │  │   │
│  │  │             │                │ • Never Plain Text  │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  │                                                         │   │
│  │  ┌─────────────┐    SQL Inject ┌─────────────────────┐  │   │
│  │  │ SQL         │◄──────────────►│ Parameterized       │  │   │
│  │  │ Injection   │                │ Queries             │  │   │
│  │  │ Protection  │                │ • No String Concat  │  │   │
│  │  │             │                │ • Type Safety       │  │   │
│  │  │             │                │ • Input Validation  │  │   │
│  │  └─────────────┘                └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Документация обновлена: 08.10.2025*  
*Версия проекта: 1.6.0*  
*База данных: Neon PostgreSQL 17.5 (миграция завершена 7 октября 2025)*
