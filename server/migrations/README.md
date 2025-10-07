# SMETA360-2 Database Migration System

Система автоматизированных миграций базы данных с поддержкой rollback и валидации.

## 🚀 Возможности

- ✅ **Автоматизированные миграции** с forward/rollback SQL
- ✅ **Транзакционная безопасность** - все изменения в одной транзакции
- ✅ **Автоматические бэкапы** перед каждой миграцией
- ✅ **Валидация изменений** с post-migration checks
- ✅ **Версионирование** с временными метками
- ✅ **Rollback поддержка** с автоматическим восстановлением
- ✅ **Checksum verification** для целостности файлов
- ✅ **CLI interface** для удобного управления

## 📁 Структура

```
server/
├── migration-manager.js          # Основной менеджер миграций
├── migrations/                   # Директория миграций
│   ├── 20251007120000_performance_indexes.sql
│   ├── 20251007121000_multitenancy_enhancement.sql
│   └── 20251007122000_auth_security_enhancement.sql
└── backups/                     # Автоматические бэкапы
    └── backup_[version]_[timestamp].sql
```

## 🎯 Использование

### Генерация новой миграции

```bash
cd server
node migration-manager.js generate "add_user_preferences" "Add user preferences table"
```

Создаст файл с шаблоном:
```sql
-- Migration: add_user_preferences
-- Version: 20251007123000_add_user_preferences
-- Description: Add user preferences table

-- ============================
-- FORWARD MIGRATION (UP)
-- ============================
-- Ваш SQL код здесь

-- ============================
-- ROLLBACK MIGRATION (DOWN)
-- ============================
-- ROLLBACK_START
-- SQL для отката
-- ROLLBACK_END

-- ============================
-- POST MIGRATION VALIDATION
-- ============================
-- VALIDATION_START
-- Проверки после миграции
-- VALIDATION_END
```

### Применение миграций

```bash
# Dry run - показать что будет применено
node migration-manager.js migrate --dry-run

# Применить все pending миграции с бэкапами
node migration-manager.js migrate

# Применить без создания бэкапов (быстрее)
node migration-manager.js migrate --no-backup
```

### Откат миграций

```bash
# Откатить последнюю миграцию
node migration-manager.js rollback

# Откатить последние 3 миграции
node migration-manager.js rollback 3
```

### Проверка статуса

```bash
node migration-manager.js status
```

Пример вывода:
```
Migration Status:
  Total migrations: 6
  Applied: 3
  Pending: 3

Pending migrations:
  - 20251007120000_performance_indexes: 20251007120000_performance_indexes.sql
  - 20251007121000_multitenancy_enhancement: 20251007121000_multitenancy_enhancement.sql
  - 20251007122000_auth_security_enhancement: 20251007122000_auth_security_enhancement.sql
```

## 📊 Готовые миграции

### 1. Performance Indexes (20251007120000)
**Назначение**: Критические индексы для оптимизации производительности

**Изменения**:
- GIN индекс для полнотекстового поиска материалов
- Индексы для аутентификации пользователей
- Композитные индексы для временных меток
- Оптимизация запросов к проектам и работам
- Индексы для статистики с партиционированием по дате

**Ожидаемое улучшение**: 
- Поиск материалов: 1211ms → <200ms
- Аутентификация: 1206ms → <100ms  
- Загрузка статистики: 1198ms → <300ms

### 2. Multitenancy Enhancement (20251007121000)
**Назначение**: Полноценная мультитенантная архитектура

**Изменения**:
- Создание таблицы `tenants` с настройками организаций
- Добавление `tenant_id` во все основные таблицы
- Row Level Security (RLS) для изоляции данных
- Функции управления tenant контекстом
- Миграция существующих данных в default tenant

**Безопасность**:
- Полная изоляция данных между тенантами
- Автоматическая фильтрация по RLS политикам
- Защита от cross-tenant доступа

### 3. Auth Security Enhancement (20251007122000)  
**Назначение**: Расширенная система аутентификации и безопасности

**Изменения**:
- Таблица `refresh_tokens` для JWT refresh механизма
- Система `user_sessions` для управления сессиями
- Таблица `login_attempts` для rate limiting
- Поддержка password reset tokens
- Блокировка пользователей при множественных неудачных попытках
- Поддержка 2FA (подготовка)

**Безопасность**:
- Rate limiting по IP и email
- Автоматическая блокировка при брute force
- Revocation всех сессий пользователя
- Cleanup expired tokens

## 🔧 Архитектурные особенности

### Транзакционная безопасность
```javascript
await client.query('BEGIN');
try {
  // Применение миграции
  await client.query(migrationSQL);
  // Валидация
  await client.query(validationSQL);
  // Запись в schema_migrations
  await client.query(recordSQL);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
}
```

### Автоматические бэкапы
- Создаются перед каждой миграцией через `pg_dump`
- Схема-only бэкапы для быстрого восстановления
- Хранятся в `server/backups/` с уникальными именами

### Валидация изменений
```sql
-- VALIDATION_START
SELECT COUNT(*) FROM new_table WHERE required_field IS NOT NULL;
SELECT schemaname, indexname FROM pg_indexes WHERE indexname = 'new_index';
-- VALIDATION_END
```

### Rollback механизм
```sql
-- ROLLBACK_START
DROP INDEX IF EXISTS new_index;
DROP TABLE IF EXISTS new_table;
-- ROLLBACK_END
```

## 📈 Production Deployment

### Переменные окружения
```bash
DATABASE_URL=postgresql://user:pass@host:5432/database
```

### Интеграция с CI/CD
```yaml
# .github/workflows/deploy.yml
- name: Run Database Migrations
  run: |
    cd server
    node migration-manager.js migrate
```

### Мониторинг миграций
- Логирование в `migration.log`
- Tracking времени выполнения
- Checksum verification для целостности
- Audit trail всех изменений схемы

## 🚨 Best Practices

### Написание миграций
1. **Всегда включайте rollback SQL** в ROLLBACK_START/END блоки
2. **Используйте IF NOT EXISTS** для безопасного повторного запуска
3. **Добавляйте валидацию** в VALIDATION_START/END блоки
4. **Тестируйте rollback** перед production deployment
5. **Используйте CONCURRENTLY** для индексов в production

### Безопасность
1. **Создавайте бэкапы** перед критическими изменениями
2. **Тестируйте на staging** окружении
3. **Мониторьте производительность** после индексов
4. **Проверяйте RLS политики** для data isolation

### Производительность
1. **Анализируйте план запросов** после индексов
2. **Обновляйте статистику** с ANALYZE
3. **Мониторьте размер индексов** и disk usage
4. **Используйте партиционирование** для больших таблиц

## 🔍 Troubleshooting

### Частые проблемы

**Миграция зависла**:
```bash
# Проверить активные запросы
SELECT pid, query, state FROM pg_stat_activity WHERE state = 'active';

# Завершить зависший процесс
SELECT pg_terminate_backend(pid);
```

**Rollback не работает**:
```bash
# Проверить содержимое rollback SQL
SELECT version, rollback_sql FROM schema_migrations WHERE version = '20251007120000_performance_indexes';

# Выполнить rollback вручную
BEGIN;
-- Вставить rollback SQL
COMMIT;
```

**Проблемы с RLS**:
```bash
# Проверить политики
SELECT schemaname, tablename, policyname FROM pg_policies;

# Установить tenant контекст
SELECT set_tenant_context('tenant-uuid');
```

## 📚 Связанные документы

- [Database Schema Documentation](../docs/DATABASE_SCHEMA.md)
- [Performance Optimization Guide](../PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [Security Guidelines](../docs/SECURITY_CRITICAL.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)