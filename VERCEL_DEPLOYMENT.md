# 🚀 VERCEL DEPLOYMENT GUIDE - SMETA360-2

## 📋 Подготовка к деплою

### 1. Автоматический деплой
```bash
# Запуск автоматического скрипта деплоя
./scripts/deploy-vercel.sh
```

### 2. Ручной деплой (пошагово)

#### Шаг 1: Установка Vercel CLI
```bash
npm install -g vercel
```

#### Шаг 2: Авторизация
```bash
vercel login
```

#### Шаг 3: Подключение проекта
```bash
vercel link
```

#### Шаг 4: Настройка environment variables
```bash
# Основные настройки
vercel env add NODE_ENV production
vercel env add VITE_API_URL /api

# База данных (введите свой DATABASE_URL)
vercel env add DATABASE_URL your-database-url-here
vercel env add DATABASE_SSL true
vercel env add DATABASE_SSLMODE require

# JWT секреты (генерируются автоматически)
vercel env add JWT_SECRET $(openssl rand -base64 64)
vercel env add JWT_REFRESH_SECRET $(openssl rand -base64 64)

# Другие настройки
vercel env add BCRYPT_SALT_ROUNDS 12
vercel env add CACHE_ENABLED true
vercel env add CACHE_WORKS true
vercel env add CACHE_MATERIALS true
```

#### Шаг 5: Настройка Redis (Upstash)
1. Откройте https://vercel.com/dashboard
2. Выберите ваш проект
3. Settings > Integrations
4. Подключите "Upstash" 
5. Создайте новую Redis database

#### Шаг 6: Деплой
```bash
vercel --prod
```

## 🌐 API Endpoints (готовые для Vercel)

### Аутентификация
- `POST /api/auth/login` - Вход в систему
- `POST /api/auth/register` - Регистрация пользователя

### Основные сущности
- `GET/POST/PUT/DELETE /api/projects` - Управление проектами
- `GET/POST/PUT/DELETE /api/estimates` - Управление сметами
- `GET/POST/PUT/DELETE /api/materials` - Управление материалами
- `GET/POST/PUT/DELETE /api/works` - Управление работами
- `GET/PUT /api/users` - Управление пользователями

### Служебные
- `GET /api/health` - Проверка состояния системы
- `GET /api/test` - Тест подключения к базе данных

## 🔧 Структура проекта для Vercel

```
/
├── api/                    # Serverless Functions
│   ├── auth/
│   │   ├── login.js       # JWT аутентификация
│   │   └── register.js    # Регистрация пользователей
│   ├── projects/
│   │   └── index.js       # CRUD операции с проектами
│   ├── estimates/
│   │   └── index.js       # CRUD операции со сметами
│   ├── materials/
│   │   └── index.js       # CRUD операции с материалами
│   ├── works/
│   │   └── index.js       # CRUD операции с работами
│   ├── users/
│   │   └── index.js       # Управление пользователями
│   ├── health.js          # Health check
│   └── test.js            # Database test
├── src/                   # React Frontend
├── vercel.json           # Vercel конфигурация
└── .env.vercel          # Environment переменные
```

## 🔐 Безопасность

### JWT токены
- Автоматическая генерация безопасных секретов
- Refresh токены для продления сессий
- Bcrypt для хеширования паролей (saltRounds: 12)

### База данных
- PostgreSQL с SSL/TLS шифрованием
- Row Level Security (RLS) для мультитенантности
- Connection pooling для оптимизации

### CORS
- Настроенные CORS заголовки для всех API
- Поддержка preflight запросов

## 📊 Мониторинг и логи

### Vercel Dashboard
```bash
# Просмотр логов
vercel logs

# Информация о проекте
vercel inspect

# Список переменных окружения
vercel env ls
```

### Health Check
```bash
# Проверка состояния
curl https://your-app.vercel.app/api/health

# Тест базы данных
curl https://your-app.vercel.app/api/test
```

## 🚀 Автоматические деплои

### GitHub Integration
1. Подключите репозиторий в Vercel Dashboard
2. Каждый push в main автоматически запускает деплой
3. Preview deployments для pull requests

### Environment переменные
- Production: устанавливаются через Vercel Dashboard
- Preview: наследуются от production или устанавливаются отдельно
- Development: используется локальный .env файл

## 🔧 Команды для разработки

```bash
# Локальная разработка с Vercel
vercel dev

# Проверка конфигурации
vercel inspect

# Список проектов
vercel ls

# Удаление проекта
vercel remove your-project-name
```

## ⚡ Оптимизация производительности

### Caching
- Статические ресурсы: кэширование на 1 год
- API ответы: кэширование через Redis (Upstash)
- Материалы и работы: кэширование включено

### Database
- Connection pooling (max: 20 connections)
- Optimized queries с индексами
- Multi-tenant architecture с RLS

## 🎯 Особенности Vercel Serverless

### Ограничения
- Функции выполняются максимум 60 секунд
- Размер deployment пакета до 50MB
- Memory limit: 1024MB

### Преимущества
- Автоматическое масштабирование
- Global CDN для статики
- Встроенная аналитика
- Zero-config deployment

## 📞 Поддержка

При проблемах с деплоем:
1. Проверьте логи: `vercel logs`
2. Проверьте переменные: `vercel env ls`
3. Протестируйте локально: `vercel dev`
4. Проверьте health endpoints

---

**🎉 SMETA360-2 готов к использованию на Vercel!**

После успешного деплоя ваше приложение будет доступно по адресу:
`https://your-project-name.vercel.app`