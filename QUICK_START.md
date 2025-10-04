# 🚀 Быстрый старт SMETA360

## ✅ Система успешно настроена!

### 📊 Статус подключения
- ✅ **База данных**: PostgreSQL 17.6 на Aiven Cloud
- ✅ **Backend сервер**: Запущен на порту 3001
- ✅ **Frontend приложение**: Запущено на порту 3000
- ✅ **Таблицы в БД**: 20+ таблиц с данными

---

## 🎯 Как запустить систему

### Вариант 1: Автоматический запуск (рекомендуется)

```powershell
# Из корня проекта
cd Smeta360-3

# Запуск backend сервера
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
cd server
node start-server.mjs
```

Откройте **новое окно PowerShell** и запустите frontend:

```powershell
cd Smeta360-3
npm start
```

### Вариант 2: Через npm скрипты

```powershell
# Backend (в одном окне)
cd Smeta360-3/server
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
node start-server.mjs

# Frontend (в другом окне)
cd Smeta360-3
npm start
```

---

## 🌐 Доступ к приложению

После запуска откройте в браузере:

- **Приложение**: http://localhost:3000
- **Backend API**: http://localhost:3001/api/health
- **Тест API**: http://localhost:3001/api/test

---

## 🔧 Конфигурация

### Файл `.env` (в папке `server/`)

```env
# Database Configuration
DATABASE_URL=postgres://username:password@your-host.aivencloud.com:11433/defaultdb?sslmode=require
DATABASE_CA_CERT_PATH=./ca.pem
DATABASE_SSLMODE=prefer

# JWT Secrets
JWT_SECRET=smeta360-jwt-secret-key-2025-production-change-me
JWT_REFRESH_SECRET=smeta360-jwt-refresh-secret-key-2025-production-change-me

# Security
BCRYPT_SALT_ROUNDS=12

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS Configuration
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Disable TLS certificate verification for Aiven Cloud
NODE_TLS_REJECT_UNAUTHORIZED=0
```

⚠️ **Важно**: Переменная `NODE_TLS_REJECT_UNAUTHORIZED=0` отключает проверку SSL сертификата. Это необходимо для подключения к Aiven Cloud с self-signed сертификатом.

---

## 🛠️ Управление серверами

### Проверка статуса

```powershell
# Проверка backend
Invoke-RestMethod http://localhost:3001/api/health

# Проверка frontend
Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

### Остановка серверов

```powershell
# Остановить все процессы Node.js
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Проверить свободны ли порты
Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue
```

### Перезапуск

```powershell
# Остановить
Get-Process node | Stop-Process -Force

# Подождать
Start-Sleep -Seconds 2

# Запустить снова (см. Вариант 1 выше)
```

---

## 📋 Основные функции системы

### 1. Создание смет
- Интерактивный расчет стоимости работ
- Автоматический подсчет материалов
- Блочное копирование данных

### 2. Сметы заказчика
- Управление коммерческими предложениями
- Применение коэффициентов
- История изменений

### 3. Каталоги данных
- 1,448 материалов
- 540 работ
- Поиск и фильтрация

### 4. Управление проектами
- Создание и хранение проектов
- Параметры объектов
- Помещения и конструктивные элементы

---

## 🔐 Безопасность

- **JWT аутентификация** с токенами
- **5-уровневая система ролей**: super_admin, admin, project_manager, estimator, viewer
- **Мультитенантность** с изоляцией данных
- **Аудит** всех действий пользователей

---

## 📊 API Endpoints

### Основные

```http
GET  /api/health              # Статус сервера
GET  /api/test                # Тестовый endpoint
GET  /api/materials           # Справочник материалов
GET  /api/works               # Справочник работ
GET  /api/projects            # Проекты
GET  /api/customer-estimates  # Сметы заказчика
```

### Аутентификация

```http
POST /api/auth/register       # Регистрация
POST /api/auth/login          # Вход
POST /api/auth/logout         # Выход
GET  /api/auth/me             # Текущий пользователь
```

---

## 🐛 Устранение неполадок

### Backend не запускается

```powershell
# Проверьте переменную окружения
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

# Проверьте наличие .env файла
Test-Path server/.env

# Проверьте подключение к БД
cd server
node start-server.mjs
# Смотрите сообщения об ошибках
```

### Frontend не подключается к backend

1. Убедитесь что backend запущен: `Invoke-RestMethod http://localhost:3001/api/health`
2. Проверьте CORS настройки в `server/.env`
3. Очистите кэш браузера и перезагрузите страницу

### Порт уже занят

```powershell
# Найдите процесс на порту 3001
Get-NetTCPConnection -LocalPort 3001 | Select-Object OwningProcess

# Остановите процесс
Stop-Process -Id <PID> -Force
```

---

## 📚 Дополнительная документация

- `README.md` - Полная документация проекта
- `docs/api/` - API документация
- `docs/reports/` - Технические отчеты
- `server/start-server.mjs` - Скрипт запуска backend

---

## ✨ Готово к использованию!

Система **SMETA360** успешно настроена и готова к работе. Приятного использования! 🎉

---

_Последнее обновление: 4 октября 2025_  
_Версия: 2.3.0_

