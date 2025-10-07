# SMETA360-2 Deployment Manager

Automated Blue-Green Deployment Service для обеспечения zero-downtime развертывания приложения.

## Возможности

- ✅ Blue-Green развертывание с автоматическим переключением трафика
- ✅ Проверки работоспособности с настраиваемыми таймаутами
- ✅ Автоматический откат при сбоях
- ✅ RESTful API для управления развертыванием
- ✅ Логирование всех операций развертывания
- ✅ История развертываний
- ✅ Запланированные проверки работоспособности
- ✅ Docker интеграция для управления контейнерами

## API Endpoints

### Статус и мониторинг

```bash
# Проверка работоспособности сервиса
GET /health

# Получить текущий статус развертывания
GET /api/deployment/status

# История развертываний
GET /api/deployment/history?limit=10
```

### Развертывание

```bash
# Запустить Blue-Green развертывание
POST /api/deployment/deploy
Content-Type: application/json

{
  "image": "smeta360/app",
  "tag": "v1.2.0",
  "healthCheckPath": "/api/monitoring/health",
  "healthCheckTimeout": 300000,
  "rollbackOnFailure": true
}

# Откатить к предыдущей версии
POST /api/deployment/rollback
```

## Процесс развертывания

1. **Pull Image** - Загрузка нового Docker образа
2. **Stop Inactive Container** - Остановка неактивного контейнера
3. **Start New Container** - Запуск нового контейнера с новой версией
4. **Health Check** - Проверка работоспособности новой версии
5. **Switch Traffic** - Переключение трафика на новую версию
6. **Cleanup** - Очистка (старый контейнер сохраняется для отката)

## Переменные окружения

```bash
PORT=3000                    # Порт deployment manager
DATABASE_URL=...             # URL базы данных
REDIS_URL=...                # URL Redis
JWT_SECRET=...               # JWT секрет
NODE_ENV=production          # Окружение
```

## Docker интеграция

Сервис взаимодействует с Docker API для:
- Управления контейнерами приложения
- Обновления конфигурации Nginx
- Мониторинга состояния контейнеров

## Мониторинг

- Логирование в `error.log` и `combined.log`
- Автоматические проверки каждые 5 минут
- Метрики производительности развертывания
- История всех операций развертывания

## Безопасность

- Helmet.js для базовой защиты HTTP
- CORS настройки
- Валидация входных данных с Joi
- Логирование всех операций

## Запуск

```bash
# В составе docker-compose
docker-compose -f docker-compose.blue-green.yml up -d

# Или отдельно
cd /workspaces/Smeta-2/deployment/manager
npm install
npm start
```

## Использование

```bash
# Развернуть новую версию
curl -X POST http://localhost:3000/api/deployment/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "image": "smeta360/app",
    "tag": "v1.2.0"
  }'

# Проверить статус
curl http://localhost:3000/api/deployment/status

# Откатить при необходимости
curl -X POST http://localhost:3000/api/deployment/rollback
```

## Архитектура

```
┌─────────────────┐    ┌─────────────────┐
│   Blue App      │    │   Green App     │
│   (Port 3001)   │    │   (Port 3002)   │
└─────────────────┘    └─────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
         ┌─────────────────┐
         │  Nginx LB       │
         │  (Port 80/443)  │
         └─────────────────┘
                     │
         ┌─────────────────┐
         │ Deployment      │
         │ Manager         │
         │ (Port 3000)     │
         └─────────────────┘
```