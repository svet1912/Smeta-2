# 🛠️ SMETA360-2 Database Tools

Набор инструментов для управления базой данных PostgreSQL в проекте SMETA360-2.

## 📋 Обзор инструментов

### 🔄 Миграция
- `migrate-to-neon.sh` - Полная миграция с Aiven на Neon PostgreSQL
- `backup-database.sh` - Создание бэкапов текущей БД (Aiven/Neon)
- `POST_MIGRATION_GUIDE.md` - Руководство по пост-миграционной настройке

### 📊 Мониторинг
- `monitor-neon.sh` - Полный мониторинг Neon PostgreSQL
- `backup-neon.sh` - Автоматическое создание бэкапов Neon
- `.github/workflows/neon-monitoring.yml` - GitHub Actions для автоматизации

### 🔧 Утилиты
- `test-connection.sh` - Тестирование подключения к БД
- `performance-test.sh` - Тестирование производительности

---

## 🚀 Быстрый старт

### 1. Миграция на Neon PostgreSQL

```bash
# Создаем бэкап текущей БД
./scripts/backup-database.sh

# Выполняем миграцию
./scripts/migrate-to-neon.sh

# Следуем пост-миграционным инструкциям
cat POST_MIGRATION_GUIDE.md
```

### 2. Мониторинг Neon

```bash
# Запуск мониторинга
./scripts/monitor-neon.sh

# Создание бэкапа
./scripts/backup-neon.sh
```

### 3. Автоматизация

GitHub Actions автоматически:
- 📊 Мониторит БД ежедневно в 02:00 UTC
- 💾 Создает бэкапы по расписанию  
- 🚨 Отправляет алерты при проблемах
- 📋 Генерирует отчеты о состоянии

---

## 📊 Подробное описание скриптов

### 🔄 `migrate-to-neon.sh`

Полная миграция базы данных с Aiven на Neon PostgreSQL.

**Возможности:**
- ✅ Проверка подключений (источник и цель)
- ✅ Создание бэкапа перед миграцией
- ✅ Перенос схемы и данных
- ✅ Проверка целостности данных
- ✅ Обновление переменных окружения в Vercel
- ✅ Тестирование API после миграции

**Использование:**
```bash
chmod +x ./scripts/migrate-to-neon.sh
./scripts/migrate-to-neon.sh
```

**Что происходит:**
1. Создается полный бэкап исходной БД
2. Проверяется подключение к Neon
3. Переносится схема и данные
4. Проверяется количество записей
5. Обновляются env-переменные в Vercel
6. Тестируется API с новой БД

---

### 📊 `monitor-neon.sh`

Комплексный мониторинг Neon PostgreSQL.

**Проверки:**
- 🔗 Подключение к БД (время отклика)
- 📊 Количество записей в таблицах
- ⚡ Производительность (простые и сложные запросы)
- 🌐 Работа API endpoints
- 🔌 Статистика подключений
- 💾 Размер базы данных

**Использование:**
```bash
chmod +x ./scripts/monitor-neon.sh
./scripts/monitor-neon.sh
```

**Результат:**
- Подробный отчет в консоли
- Файл отчета `neon-monitoring-YYYYMMDD_HHMMSS.txt`
- Цветной вывод статусов
- Рекомендации по оптимизации

---

### 💾 `backup-neon.sh`

Создание автоматических бэкапов Neon PostgreSQL.

**Типы бэкапов:**
- 📄 Полный дамп (схема + данные)
- 🏗️ Только схема
- 📊 Только данные  
- 🗜️ Сжатый архив

**Возможности:**
- ✅ Проверка целостности бэкапов
- ✅ Автоматическая очистка старых файлов (>30 дней)
- ✅ Проверка синтаксиса SQL
- ✅ Информационный файл с метаданными

**Использование:**
```bash
chmod +x ./scripts/backup-neon.sh
./scripts/backup-neon.sh
```

**Автоматизация:**
```bash
# Добавить в crontab для ежедневных бэкапов в 2:00
0 2 * * * cd /path/to/smeta-2 && ./scripts/backup-neon.sh
```

---

### 🤖 GitHub Actions Workflow

Файл: `.github/workflows/neon-monitoring.yml`

**Задачи:**
- 📊 **neon-monitoring** - Ежедневный мониторинг
- 💾 **neon-backup** - Еженедельные бэкапы
- 📋 **health-summary** - Сводный отчет

**Триггеры:**
- 🕐 По расписанию (ежедневно в 02:00 UTC)
- 📝 При пуше в main (изменения в server/ или src/api/)
- 🖱️ Ручной запуск (workflow_dispatch)

**Алерты:**
- 🚨 Issues при проблемах с производительностью
- ❌ Issues при неудачных бэкапах
- 💬 Комментарии к коммитам с отчетами

---

## 🔧 Настройка

### Переменные окружения

Необходимые переменные в GitHub Secrets:

```bash
VERCEL_TOKEN=your_vercel_token
VERCEL_PROJECT_ID=your_project_id
```

### Локальная настройка

1. Установите зависимости:
```bash
# PostgreSQL client
sudo apt-get install postgresql-client

# Vercel CLI
npm install -g vercel@latest
```

2. Авторизуйтесь в Vercel:
```bash
vercel login
vercel link
```

3. Сделайте скрипты исполняемыми:
```bash
chmod +x ./scripts/*.sh
```

---

## 📈 Метрики производительности

### 🟢 Отлично
- Подключение: < 100ms
- Простые запросы: < 100ms
- Сложные запросы: < 500ms

### 🟡 Хорошо  
- Подключение: < 300ms
- Простые запросы: < 300ms
- Сложные запросы: < 1000ms

### 🔴 Требует внимания
- Подключение: > 300ms
- Простые запросы: > 300ms
- Сложные запросы: > 1000ms

---

## 🛡️ Безопасность

### Данные конфигурации
- ✅ Connection strings не логируются
- ✅ Пароли передаются через переменные окружения
- ✅ Все скрипты работают с SSL/TLS

### Бэкапы
- 📁 Локальное хранение в `backups/neon/`
- ☁️ GitHub Artifacts (90 дней retention)
- 🗜️ Сжатие для экономии места
- 🧹 Автоматическая очистка старых файлов

---

## 🚨 Troubleshooting

### Проблемы с подключением

```bash
# Проверьте переменные окружения
vercel env ls

# Тест подключения
psql "postgresql://user:pass@host:5432/dbname" -c "SELECT 1;"
```

### Медленная производительность

1. **Увеличьте Compute Units в Neon Console**
2. **Проверьте индексы:**
   ```sql
   SELECT schemaname, tablename, indexname 
   FROM pg_indexes 
   WHERE schemaname = 'public';
   ```
3. **Анализируйте медленные запросы:**
   ```sql
   SELECT query, mean_time, calls 
   FROM pg_stat_statements 
   ORDER BY mean_time DESC LIMIT 10;
   ```

### Проблемы с бэкапами

```bash
# Проверьте доступ к pg_dump
which pg_dump

# Проверьте права на запись
ls -la backups/

# Проверьте размер БД
psql "$CONNECTION" -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
```

---

## 📚 Дополнительные ресурсы

- 📖 [Neon Documentation](https://neon.tech/docs)
- 🔧 [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- ☁️ [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- 🤖 [GitHub Actions Documentation](https://docs.github.com/en/actions)

---

## 🎯 Следующие шаги

После настройки инструментов:

1. **Настройте мониторинг** - запустите первый мониторинг
2. **Создайте первый бэкап** - убедитесь что все работает
3. **Настройте алерты** - добавьте webhook для Slack/Discord
4. **Оптимизируйте производительность** - следите за метриками
5. **Документируйте изменения** - ведите changelog

---

*🚀 SMETA360-2 - Система управления строительными сметами*