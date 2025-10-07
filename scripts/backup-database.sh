#!/bin/bash

# 🗄️ SMETA360-2 Database Backup Script
# Создание полного дампа PostgreSQL базы данных

echo "🗄️  СОЗДАНИЕ ДАМПА БАЗЫ ДАННЫХ SMETA360-2"
echo "========================================"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Загружаем переменные окружения
if [ -f ".env" ]; then
    source .env
    echo -e "${GREEN}✅ Переменные окружения загружены${NC}"
else
    echo -e "${RED}❌ Файл .env не найден!${NC}"
    exit 1
fi

# Извлекаем параметры подключения из DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL не найден в .env файле!${NC}"
    exit 1
fi

# Парсим DATABASE_URL
# Формат: postgres://user:password@host:port/database?params
DB_URL_REGEX="postgres://([^:]+):([^@]+)@([^:]+):([0-9]+)/([^?]+)"

if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]}"
    DB_NAME="${BASH_REMATCH[5]}"
else
    echo -e "${RED}❌ Не удалось распарсить DATABASE_URL!${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Параметры подключения:${NC}"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

# Создаем timestamp для имени файла
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

# Имена файлов дампов
FULL_DUMP="$BACKUP_DIR/smeta360_full_dump_$TIMESTAMP.sql"
SCHEMA_DUMP="$BACKUP_DIR/smeta360_schema_dump_$TIMESTAMP.sql"
DATA_DUMP="$BACKUP_DIR/smeta360_data_dump_$TIMESTAMP.sql"
CUSTOM_DUMP="$BACKUP_DIR/smeta360_custom_dump_$TIMESTAMP.backup"

# Устанавливаем пароль для pg_dump
export PGPASSWORD="$DB_PASS"

echo -e "${BLUE}🔄 Начинаем создание дампов...${NC}"
echo ""

# 1. Полный дамп (структура + данные)
echo -e "${YELLOW}📦 Создание полного дампа (структура + данные)...${NC}"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --create \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    > "$FULL_DUMP"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Полный дамп создан: $FULL_DUMP${NC}"
    FULL_SIZE=$(du -h "$FULL_DUMP" | cut -f1)
    echo -e "${BLUE}   Размер: $FULL_SIZE${NC}"
else
    echo -e "${RED}❌ Ошибка при создании полного дампа!${NC}"
fi

echo ""

# 2. Дамп только структуры
echo -e "${YELLOW}🏗️  Создание дампа структуры базы данных...${NC}"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --schema-only \
    --create \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    > "$SCHEMA_DUMP"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Дамп структуры создан: $SCHEMA_DUMP${NC}"
    SCHEMA_SIZE=$(du -h "$SCHEMA_DUMP" | cut -f1)
    echo -e "${BLUE}   Размер: $SCHEMA_SIZE${NC}"
else
    echo -e "${RED}❌ Ошибка при создании дампа структуры!${NC}"
fi

echo ""

# 3. Дамп только данных
echo -e "${YELLOW}📊 Создание дампа данных...${NC}"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --data-only \
    --no-owner \
    --no-privileges \
    --disable-triggers \
    > "$DATA_DUMP"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Дамп данных создан: $DATA_DUMP${NC}"
    DATA_SIZE=$(du -h "$DATA_DUMP" | cut -f1)
    echo -e "${BLUE}   Размер: $DATA_SIZE${NC}"
else
    echo -e "${RED}❌ Ошибка при создании дампа данных!${NC}"
fi

echo ""

# 4. Кастомный формат дампа (для pg_restore)
echo -e "${YELLOW}🔧 Создание дампа в кастомном формате...${NC}"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --verbose \
    --format=custom \
    --compress=9 \
    --no-owner \
    --no-privileges \
    > "$CUSTOM_DUMP"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Кастомный дамп создан: $CUSTOM_DUMP${NC}"
    CUSTOM_SIZE=$(du -h "$CUSTOM_DUMP" | cut -f1)
    echo -e "${BLUE}   Размер: $CUSTOM_SIZE${NC}"
else
    echo -e "${RED}❌ Ошибка при создании кастомного дампа!${NC}"
fi

echo ""

# Очищаем переменную пароля
unset PGPASSWORD

# Показываем статистику таблиц
echo -e "${BLUE}📊 Статистика таблиц в базе данных:${NC}"
export PGPASSWORD="$DB_PASS"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows,
    n_dead_tup as dead_rows
FROM pg_stat_user_tables 
ORDER BY n_live_tup DESC;
"
unset PGPASSWORD

echo ""
echo -e "${GREEN}🎉 ДАМПЫ УСПЕШНО СОЗДАНЫ!${NC}"
echo ""
echo -e "${BLUE}📋 Созданные файлы:${NC}"
echo "1. $FULL_DUMP - Полный дамп (структура + данные)"
echo "2. $SCHEMA_DUMP - Только структура"
echo "3. $DATA_DUMP - Только данные"  
echo "4. $CUSTOM_DUMP - Кастомный формат (сжатый)"
echo ""
echo -e "${BLUE}🔧 Как использовать дампы:${NC}"
echo ""
echo -e "${YELLOW}Восстановление полного дампа:${NC}"
echo "psql -h HOST -p PORT -U USER -d DATABASE < $FULL_DUMP"
echo ""
echo -e "${YELLOW}Восстановление кастомного дампа:${NC}"
echo "pg_restore -h HOST -p PORT -U USER -d DATABASE $CUSTOM_DUMP"
echo ""
echo -e "${YELLOW}Восстановление только структуры:${NC}"
echo "psql -h HOST -p PORT -U USER -d DATABASE < $SCHEMA_DUMP"
echo ""
echo -e "${GREEN}✅ Резервные копии готовы для миграции или восстановления!${NC}"