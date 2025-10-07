# SMETA360-2 Deployment Infrastructure

Infrastructure as Code для автоматизированного развертывания SMETA360-2 с использованием Blue-Green стратегии.

## 📁 Структура

```
deployment/
├── docker-compose.blue-green.yml    # Основная инфраструктура
├── deploy.sh                        # Скрипт управления развертыванием
├── nginx/
│   └── nginx.conf                   # Конфигурация load balancer
└── manager/
    ├── Dockerfile                   # Deployment manager контейнер
    ├── package.json                 # Dependencies
    ├── server.js                    # Blue-Green логика
    └── README.md                    # Документация менеджера
```

## 🚀 Быстрый старт

### 1. Запуск инфраструктуры

```bash
# Запустить Blue-Green инфраструктуру
./deployment/deploy.sh start

# Проверить статус
./deployment/deploy.sh status
```

### 2. Развертывание приложения

```bash
# Развернуть последнюю версию
./deployment/deploy.sh deploy

# Развернуть конкретную версию
./deployment/deploy.sh deploy v1.2.0
```

### 3. Мониторинг и управление

```bash
# Посмотреть историю развертываний
./deployment/deploy.sh history

# Откатить к предыдущей версии
./deployment/deploy.sh rollback

# Посмотреть логи
./deployment/deploy.sh logs deployment-manager
```

## 🏗️ Архитектура

```
                    ┌─────────────────┐
                    │   Users         │
                    └─────────────────┘
                             │
                    ┌─────────────────┐
                    │   Nginx LB      │ ← SSL Termination
                    │   (Port 80/443) │   Rate Limiting
                    └─────────────────┘   Security Headers
                             │
                    ┌─────────────────┐
              ┌─────│   Blue/Green    │─────┐
              │     │   Switch Logic  │     │
              │     └─────────────────┘     │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │   Blue App      │           │   Green App     │
    │   (Port 3001)   │           │   (Port 3002)   │
    │   Active/Standby│           │   Standby/Active│
    └─────────────────┘           └─────────────────┘
              │                             │
              └─────────────┬───────────────┘
                           │
              ┌─────────────────┐
              │   Database      │ ← Shared Storage
              │   Redis         │   Persistent Data
              │   Monitoring    │   Metrics & Logs
              └─────────────────┘
                           │
              ┌─────────────────┐
              │ Deployment      │ ← Orchestration
              │ Manager         │   Health Checks
              │ (Port 3000)     │   Rollback Logic
              └─────────────────┘
```

## 🔧 Компоненты

### Nginx Load Balancer
- **SSL Termination**: Автоматическое управление HTTPS
- **Blue-Green Routing**: Переключение трафика между средами
- **Rate Limiting**: Защита от DDoS атак
- **Health Checks**: Мониторинг доступности backends
- **Static Files**: Эффективная отдача статических ресурсов

### Deployment Manager
- **Blue-Green Logic**: Автоматическое переключение между средами
- **Health Monitoring**: Проверки работоспособности перед переключением
- **Rollback Capability**: Мгновенный откат при проблемах
- **API Management**: RESTful API для управления развертыванием
- **Logging & Metrics**: Полное логирование всех операций

### Application Containers
- **Isolated Environments**: Blue и Green среды полностью изолированы
- **Shared Resources**: Общая база данных и Redis
- **Environment Variables**: Конфигурация через переменные окружения
- **Health Endpoints**: Встроенные endpoints для проверки здоровья

## 📊 Мониторинг

### Prometheus Metrics
- Время развертывания
- Количество успешных/неудачных развертываний
- Производительность приложения
- Использование ресурсов

### Grafana Dashboards
- Real-time мониторинг развертываний
- Визуализация метрик производительности
- Алерты при проблемах
- История изменений

### Application Logs
```bash
# Логи deployment manager
./deployment/deploy.sh logs deployment-manager

# Логи приложения (blue)
./deployment/deploy.sh logs app-blue

# Логи nginx
./deployment/deploy.sh logs nginx-lb
```

## 🔒 Безопасность

### Network Security
- Изолированные Docker networks
- Минимальные привилегии контейнеров
- Encrypted communication между сервисами

### SSL/TLS Configuration
- Автоматическое обновление сертификатов
- Perfect Forward Secrecy
- HTTP Strict Transport Security (HSTS)
- Secure headers (CSP, X-Frame-Options, etc.)

### Access Control
- JWT токены для API доступа
- Rate limiting для защиты от атак
- Audit логирование всех операций

## 🎯 Production Readiness

### Автоматизация
- **Zero-downtime deployments**: Развертывание без остановки сервиса
- **Automated rollbacks**: Автоматический откат при проблемах
- **Health checks**: Комплексные проверки работоспособности
- **Database migrations**: Безопасные миграции БД

### Отказоустойчивость
- **Multiple environments**: Blue/Green для мгновенного переключения
- **Persistent storage**: Данные сохраняются между развертываниями
- **Backup strategies**: Автоматическое резервное копирование
- **Disaster recovery**: Планы восстановления после сбоев

### Производительность
- **Load balancing**: Равномерное распределение нагрузки
- **Caching layers**: Redis для кэширования
- **Connection pooling**: Эффективное использование БД соединений
- **Resource limits**: Контроль использования ресурсов

## 📈 Масштабирование

### Горизонтальное масштабирование
```yaml
# docker-compose.blue-green.yml
app-blue:
  deploy:
    replicas: 3
    resources:
      limits:
        cpus: '1.0'
        memory: 1G
```

### Вертикальное масштабирование
```yaml
# Увеличение ресурсов контейнера
resources:
  limits:
    cpus: '2.0'
    memory: 2G
  reservations:
    cpus: '1.0'
    memory: 1G
```

## 🔧 Troubleshooting

### Проблемы с развертыванием
```bash
# Проверить статус всех сервисов
docker-compose -f docker-compose.blue-green.yml ps

# Проверить логи deployment manager
./deployment/deploy.sh logs deployment-manager

# Проверить health check endpoints
curl http://localhost:3001/api/monitoring/health  # Blue
curl http://localhost:3002/api/monitoring/health  # Green
```

### Проблемы с базой данных
```bash
# Проверить соединение с БД
docker-compose -f docker-compose.blue-green.yml exec postgres psql -U postgres -d smeta360 -c '\dt'

# Проверить миграции
node server/run-migration.js --check
```

### Проблемы с производительностью
```bash
# Мониторинг ресурсов
docker stats

# Анализ логов nginx
./deployment/deploy.sh logs nginx-lb | grep -E "(error|warn)"
```

## 🚦 Best Practices

1. **Всегда тестируйте** развертывание в staging окружении
2. **Мониторьте метрики** после каждого развертывания
3. **Держите откат готовым** - знайте как быстро откатиться
4. **Бэкапьте данные** перед критическими изменениями
5. **Используйте теги версий** вместо 'latest' в production
6. **Автоматизируйте все** что можно автоматизировать
7. **Логируйте все операции** для audit trail

## 📚 Дополнительная документация

- [Deployment Manager API](manager/README.md)
- [Nginx Configuration](nginx/README.md) (создать при необходимости)
- [Monitoring Setup](../docs/MONITORING.md) (создать при необходимости)
- [Security Guide](../docs/SECURITY.md) (создать при необходимости)