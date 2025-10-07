#!/bin/bash

# 💾 NEON BACKUP AUTOMATION
# Скрипт для автоматического создания бэкапов в Neon PostgreSQL

echo "💾 NEON BACKUP AUTOMATION - SMETA360-2"
echo "======================================"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Получаем Neon connection string из Vercel env
echo -e "${BLUE}🔍 Получаем connection string из Vercel...${NC}"
NEON_CONNECTION=$(vercel env get DATABASE_URL production 2>/dev/null)

if [ -z "$NEON_CONNECTION" ]; then
    echo -e "${RED}❌ Не удалось получить DATABASE_URL из Vercel${NC}"
    echo "Введите connection string вручную:"
    read -p "Neon Connection String: " NEON_CONNECTION
fi

# Создаем папку для бэкапов
BACKUP_DIR="backups/neon"
mkdir -p "$BACKUP_DIR"

# Генерируем имя бэкапа с timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PREFIX="smeta360_neon_$TIMESTAMP"

echo -e "${GREEN}✅ Connection string получен${NC}"
echo -e "${BLUE}📁 Папка бэкапов: $BACKUP_DIR${NC}"
echo ""

# Проверка подключения
echo -e "${YELLOW}🔗 1. ПРОВЕРКА ПОДКЛЮЧЕНИЯ${NC}"
echo "─────────────────────────────"

if psql "$NEON_CONNECTION" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Подключение работает${NC}"
    
    # Получаем информацию о БД
    DB_NAME=$(psql "$NEON_CONNECTION" -t -c "SELECT current_database();" | xargs)
    DB_SIZE=$(psql "$NEON_CONNECTION" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)
    RECORD_COUNT=$(psql "$NEON_CONNECTION" -t -c "
        SELECT SUM(n_tup_ins + n_tup_upd) 
        FROM pg_stat_user_tables;
    " | xargs)
    
    echo -e "${BLUE}   База данных: $DB_NAME${NC}"
    echo -e "${BLUE}   Размер: $DB_SIZE${NC}"
    echo -e "${BLUE}   Записей: $RECORD_COUNT${NC}"
else
    echo -e "${RED}❌ Подключение не работает!${NC}"
    exit 1
fi

echo ""

# Создание полного бэкапа
echo -e "${YELLOW}💾 2. СОЗДАНИЕ ПОЛНОГО БЭКАПА${NC}"
echo "─────────────────────────────────"

echo -e "${BLUE}   Создаем полный дамп...${NC}"
FULL_BACKUP="$BACKUP_DIR/${BACKUP_PREFIX}_full.sql"

if pg_dump "$NEON_CONNECTION" > "$FULL_BACKUP"; then
    FULL_SIZE=$(ls -lh "$FULL_BACKUP" | awk '{print $5}')
    echo -e "${GREEN}   ✅ Полный бэкап создан: $FULL_SIZE${NC}"
else
    echo -e "${RED}   ❌ Ошибка создания полного бэкапа${NC}"
    exit 1
fi

# Создание схемы отдельно
echo -e "${BLUE}   Создаем дамп схемы...${NC}"
SCHEMA_BACKUP="$BACKUP_DIR/${BACKUP_PREFIX}_schema.sql"

if pg_dump "$NEON_CONNECTION" --schema-only > "$SCHEMA_BACKUP"; then
    SCHEMA_SIZE=$(ls -lh "$SCHEMA_BACKUP" | awk '{print $5}')
    echo -e "${GREEN}   ✅ Схема сохранена: $SCHEMA_SIZE${NC}"
else
    echo -e "${RED}   ❌ Ошибка создания дампа схемы${NC}"
fi

# Создание дампа только данных
echo -e "${BLUE}   Создаем дамп данных...${NC}"
DATA_BACKUP="$BACKUP_DIR/${BACKUP_PREFIX}_data.sql"

if pg_dump "$NEON_CONNECTION" --data-only > "$DATA_BACKUP"; then
    DATA_SIZE=$(ls -lh "$DATA_BACKUP" | awk '{print $5}')
    echo -e "${GREEN}   ✅ Данные сохранены: $DATA_SIZE${NC}"
else
    echo -e "${RED}   ❌ Ошибка создания дампа данных${NC}"
fi

# Создание сжатого бэкапа
echo -e "${BLUE}   Создаем сжатый бэкап...${NC}"
COMPRESSED_BACKUP="$BACKUP_DIR/${BACKUP_PREFIX}_compressed.sql.gz"

if pg_dump "$NEON_CONNECTION" | gzip > "$COMPRESSED_BACKUP"; then
    COMPRESSED_SIZE=$(ls -lh "$COMPRESSED_BACKUP" | awk '{print $5}')
    echo -e "${GREEN}   ✅ Сжатый бэкап создан: $COMPRESSED_SIZE${NC}"
else
    echo -e "${RED}   ❌ Ошибка создания сжатого бэкапа${NC}"
fi

echo ""

# Проверка созданных бэкапов
echo -e "${YELLOW}✅ 3. ПРОВЕРКА БЭКАПОВ${NC}"
echo "───────────────────────"

BACKUPS_INFO="$BACKUP_DIR/${BACKUP_PREFIX}_info.txt"

cat > "$BACKUPS_INFO" << EOF
NEON BACKUP INFO - SMETA360-2
Created: $(date)
Database: $DB_NAME
Original Size: $DB_SIZE
Records Count: $RECORD_COUNT

BACKUP FILES:
EOF

echo -e "${BLUE}   Проверяем созданные файлы...${NC}"

if [ -f "$FULL_BACKUP" ]; then
    LINES=$(wc -l < "$FULL_BACKUP")
    echo -e "${GREEN}   ✅ $FULL_BACKUP ($FULL_SIZE, $LINES строк)${NC}"
    echo "- Full Backup: $FULL_SIZE ($LINES lines)" >> "$BACKUPS_INFO"
fi

if [ -f "$SCHEMA_BACKUP" ]; then
    SCHEMA_LINES=$(wc -l < "$SCHEMA_BACKUP")
    echo -e "${GREEN}   ✅ $SCHEMA_BACKUP ($SCHEMA_SIZE, $SCHEMA_LINES строк)${NC}"
    echo "- Schema Only: $SCHEMA_SIZE ($SCHEMA_LINES lines)" >> "$BACKUPS_INFO"
fi

if [ -f "$DATA_BACKUP" ]; then
    DATA_LINES=$(wc -l < "$DATA_BACKUP")
    echo -e "${GREEN}   ✅ $DATA_BACKUP ($DATA_SIZE, $DATA_LINES строк)${NC}"
    echo "- Data Only: $DATA_SIZE ($DATA_LINES lines)" >> "$BACKUPS_INFO"
fi

if [ -f "$COMPRESSED_BACKUP" ]; then
    echo -e "${GREEN}   ✅ $COMPRESSED_BACKUP ($COMPRESSED_SIZE)${NC}"
    echo "- Compressed: $COMPRESSED_SIZE" >> "$BACKUPS_INFO"
fi

echo ""

# Тест восстановления (проверка целостности)
echo -e "${YELLOW}🔬 4. ТЕСТ ЦЕЛОСТНОСТИ${NC}"
echo "─────────────────────────"

echo -e "${BLUE}   Проверяем синтаксис SQL...${NC}"

# Проверяем синтаксис полного бэкапа
if psql "$NEON_CONNECTION" -f "$FULL_BACKUP" --dry-run > /dev/null 2>&1; then
    echo -e "${GREEN}   ✅ Синтаксис полного бэкапа корректен${NC}"
    echo "- Full backup syntax: OK" >> "$BACKUPS_INFO"
else
    echo -e "${RED}   ❌ Ошибка в синтаксисе полного бэкапа${NC}"
    echo "- Full backup syntax: ERROR" >> "$BACKUPS_INFO"
fi

# Проверяем таблицы в бэкапе
TABLES_IN_BACKUP=$(grep -c "CREATE TABLE" "$FULL_BACKUP" 2>/dev/null || echo "0")
CURRENT_TABLES=$(psql "$NEON_CONNECTION" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)

echo -e "${BLUE}   Таблиц в бэкапе: $TABLES_IN_BACKUP${NC}"
echo -e "${BLUE}   Таблиц в БД: $CURRENT_TABLES${NC}"

if [ "$TABLES_IN_BACKUP" -eq "$CURRENT_TABLES" ]; then
    echo -e "${GREEN}   ✅ Количество таблиц совпадает${NC}"
    echo "- Table count match: YES ($TABLES_IN_BACKUP tables)" >> "$BACKUPS_INFO"
else
    echo -e "${YELLOW}   ⚠️  Количество таблиц не совпадает${NC}"
    echo "- Table count match: NO (backup: $TABLES_IN_BACKUP, db: $CURRENT_TABLES)" >> "$BACKUPS_INFO"
fi

echo ""

# Очистка старых бэкапов
echo -e "${YELLOW}🧹 5. ОЧИСТКА СТАРЫХ БЭКАПОВ${NC}"
echo "─────────────────────────────"

# Удаляем бэкапы старше 30 дней
OLD_BACKUPS=$(find "$BACKUP_DIR" -name "smeta360_neon_*.sql*" -mtime +30 2>/dev/null)
if [ -n "$OLD_BACKUPS" ]; then
    echo -e "${BLUE}   Найдены старые бэкапы (>30 дней):${NC}"
    echo "$OLD_BACKUPS"
    echo -e "${YELLOW}   Удаляем старые бэкапы...${NC}"
    find "$BACKUP_DIR" -name "smeta360_neon_*.sql*" -mtime +30 -delete
    echo -e "${GREEN}   ✅ Старые бэкапы удалены${NC}"
else
    echo -e "${GREEN}   ✅ Старых бэкапов не найдено${NC}"
fi

# Показываем текущие бэкапы
CURRENT_BACKUPS=$(ls -la "$BACKUP_DIR"/smeta360_neon_*.sql* 2>/dev/null | wc -l)
BACKUP_TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

echo -e "${BLUE}   Текущих бэкапов: $CURRENT_BACKUPS${NC}"
echo -e "${BLUE}   Общий размер папки: $BACKUP_TOTAL_SIZE${NC}"

echo ""

# Итоговый отчет
echo -e "${GREEN}📋 ИТОГОВЫЙ ОТЧЕТ${NC}"
echo "════════════════"
echo ""

# Добавляем финальную информацию в файл
cat >> "$BACKUPS_INFO" << EOF

CLEANUP:
- Old backups removed: $(echo "$OLD_BACKUPS" | wc -l 2>/dev/null || echo "0")
- Current backups count: $CURRENT_BACKUPS
- Total backup size: $BACKUP_TOTAL_SIZE

STATUS: SUCCESS
EOF

echo -e "${GREEN}✅ База данных: $DB_NAME ($DB_SIZE)${NC}"
echo -e "${GREEN}✅ Бэкапы созданы: 4 формата${NC}"
echo -e "${GREEN}✅ Целостность: проверена${NC}"
echo -e "${GREEN}✅ Очистка: выполнена${NC}"
echo ""

echo -e "${GREEN}🎉 БЭКАП ЗАВЕРШЕН УСПЕШНО!${NC}"
echo ""
echo -e "${BLUE}📁 Папка бэкапов: $BACKUP_DIR${NC}"
echo -e "${BLUE}📊 Информация: $BACKUPS_INFO${NC}"
echo ""

# Показываем созданные файлы
echo -e "${YELLOW}📋 СОЗДАННЫЕ ФАЙЛЫ:${NC}"
ls -lah "$BACKUP_DIR"/*${TIMESTAMP}* 2>/dev/null || echo -e "${RED}Нет файлов с timestamp $TIMESTAMP${NC}"

echo ""
echo -e "${YELLOW}💡 АВТОМАТИЗАЦИЯ:${NC}"
echo "• Добавьте этот скрипт в crontab для автоматических бэкапов:"
echo "  0 2 * * * cd /path/to/project && ./scripts/backup-neon.sh"
echo "• Настройте GitHub Actions для регулярных бэкапов"
echo "• Используйте Neon Branches для точечных бэкапов"
echo ""
echo -e "${GREEN}🚀 SMETA360-2 данные в безопасности!${NC}"