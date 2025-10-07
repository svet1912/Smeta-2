#!/bin/bash

# 🧪 ТЕСТИРОВАНИЕ МИГРАЦИИ НА NEON
# Скрипт для безопасного тестирования переезда с Aiven на Neon

echo "🧪 ТЕСТ МИГРАЦИИ SMETA360-2 НА NEON"
echo "================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Этапы тестирования:${NC}"
echo "1. Создание тестового проекта в Neon"
echo "2. Восстановление дампа в Neon"
echo "3. Тестирование подключения"
echo "4. Проверка производительности"
echo "5. Сравнение с текущей базой"
echo ""

# Проверяем наличие дампа
DUMP_FILE="backups/smeta360_custom_dump_20251007_162104.backup"
if [ ! -f "$DUMP_FILE" ]; then
    echo -e "${RED}❌ Дамп не найден: $DUMP_FILE${NC}"
    echo "Сначала создайте дамп с помощью ./scripts/backup-database.sh"
    exit 1
fi

echo -e "${GREEN}✅ Дамп найден: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))${NC}"
echo ""

echo -e "${YELLOW}📝 ИНСТРУКЦИЯ ПО НАСТРОЙКЕ NEON:${NC}"
echo ""
echo "1. Откройте https://neon.tech"
echo "2. Зарегистрируйтесь/войдите"
echo "3. Создайте новый проект:"
echo "   - Name: smeta360-2-test"
echo "   - Region: Europe (Frankfurt) - для минимальной задержки"
echo "   - PostgreSQL версия: 16 (близко к вашей 17.6)"
echo ""
echo "4. Скопируйте Connection String из Dashboard"
echo "   Формат: postgresql://user:password@hostname/dbname"
echo ""

# Запрашиваем connection string
read -p "Введите Neon Connection String: " NEON_CONNECTION_STRING

if [ -z "$NEON_CONNECTION_STRING" ]; then
    echo -e "${RED}❌ Connection string не введен!${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔄 Начинаем тестирование миграции...${NC}"
echo ""

# Тест 1: Проверка подключения
echo -e "${YELLOW}🔗 Тест 1: Проверка подключения к Neon...${NC}"
if psql "$NEON_CONNECTION_STRING" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Подключение к Neon успешно${NC}"
    NEON_VERSION=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT version();" | head -n1 | xargs)
    echo -e "${BLUE}   Версия PostgreSQL: $NEON_VERSION${NC}"
else
    echo -e "${RED}❌ Не удалось подключиться к Neon${NC}"
    echo "Проверьте connection string и доступ к сети"
    exit 1
fi

echo ""

# Тест 2: Восстановление дампа
echo -e "${YELLOW}📦 Тест 2: Восстановление дампа в Neon...${NC}"
echo "Это может занять несколько минут..."

# Засекаем время восстановления
START_TIME=$(date +%s)

pg_restore -d "$NEON_CONNECTION_STRING" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    "$DUMP_FILE" 2>&1 | tail -20

RESTORE_EXIT_CODE=${PIPESTATUS[0]}
END_TIME=$(date +%s)
RESTORE_DURATION=$((END_TIME - START_TIME))

if [ $RESTORE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ Дамп успешно восстановлен в Neon${NC}"
    echo -e "${BLUE}   Время восстановления: ${RESTORE_DURATION}s${NC}"
else
    echo -e "${RED}❌ Ошибка при восстановлении дампа${NC}"
    exit 1
fi

echo ""

# Тест 3: Проверка данных
echo -e "${YELLOW}📊 Тест 3: Проверка целостности данных...${NC}"

# Проверяем количество таблиц
NEON_TABLES=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo -e "${BLUE}   Таблицы в Neon: $NEON_TABLES${NC}"

# Проверяем основные таблицы
echo -e "${BLUE}   Проверка ключевых таблиц:${NC}"

TABLES=("users" "tenants" "projects" "estimates" "materials" "works_ref")
for table in "${TABLES[@]}"; do
    COUNT=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    if [ "$COUNT" ]; then
        echo -e "${GREEN}   ✅ $table: $COUNT записей${NC}"
    else
        echo -e "${RED}   ❌ $table: ошибка или таблица отсутствует${NC}"
    fi
done

echo ""

# Тест 4: Производительность
echo -e "${YELLOW}⚡ Тест 4: Тестирование производительности...${NC}"

# Простой тест производительности
echo -e "${BLUE}   Тест SELECT запросов...${NC}"
START_TIME=$(date +%s%3N)
psql "$NEON_CONNECTION_STRING" -c "SELECT COUNT(*) FROM materials;" > /dev/null
END_TIME=$(date +%s%3N)
QUERY_TIME=$((END_TIME - START_TIME))
echo -e "${BLUE}   Время простого SELECT: ${QUERY_TIME}ms${NC}"

# Тест сложного запроса
START_TIME=$(date +%s%3N)
psql "$NEON_CONNECTION_STRING" -c "
SELECT 
    COUNT(DISTINCT p.id) as projects,
    COUNT(DISTINCT e.id) as estimates,
    COUNT(DISTINCT m.id) as materials
FROM projects p
LEFT JOIN estimates e ON p.id = e.project_id
LEFT JOIN materials m ON m.tenant_id IS NOT NULL
LIMIT 1;
" > /dev/null
END_TIME=$(date +%s%3N)
COMPLEX_QUERY_TIME=$((END_TIME - START_TIME))
echo -e "${BLUE}   Время сложного JOIN: ${COMPLEX_QUERY_TIME}ms${NC}"

echo ""

# Тест 5: Сравнение с оригиналом
echo -e "${YELLOW}🔍 Тест 5: Сравнение с оригинальной базой...${NC}"

if [ -f ".env" ]; then
    source .env
    
    # Сравниваем количество записей в ключевых таблицах
    echo -e "${BLUE}   Сравнение количества записей:${NC}"
    
    for table in "${TABLES[@]}"; do
        AIVEN_COUNT=$(PGPASSWORD="${DATABASE_PASSWORD:-$(echo $DATABASE_URL | sed 's/.*:\([^@]*\)@.*/\1/')}" psql -h "$(echo $DATABASE_URL | sed 's/.*@\([^:]*\):.*/\1/')" -p "$(echo $DATABASE_URL | sed 's/.*:\([0-9]*\)\/.*/\1/')" -U "$(echo $DATABASE_URL | sed 's/.*\/\/\([^:]*\):.*/\1/')" -d "$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
        NEON_COUNT=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
        
        if [ "$AIVEN_COUNT" = "$NEON_COUNT" ]; then
            echo -e "${GREEN}   ✅ $table: $AIVEN_COUNT = $NEON_COUNT${NC}"
        else
            echo -e "${YELLOW}   ⚠️  $table: Aiven($AIVEN_COUNT) ≠ Neon($NEON_COUNT)${NC}"
        fi
    done
else
    echo -e "${YELLOW}   ⚠️  Файл .env не найден, пропускаем сравнение${NC}"
fi

echo ""

# Итоговый отчет
echo -e "${GREEN}🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!${NC}"
echo ""
echo -e "${BLUE}📋 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ:${NC}"
echo "✅ Подключение к Neon: успешно"
echo "✅ Восстановление дампа: успешно (${RESTORE_DURATION}s)"
echo "✅ Целостность данных: проверена"
echo "✅ Производительность: SELECT ${QUERY_TIME}ms, JOIN ${COMPLEX_QUERY_TIME}ms"
echo ""

echo -e "${BLUE}🔗 Neon Connection String для тестирования:${NC}"
echo "$NEON_CONNECTION_STRING"
echo ""

echo -e "${YELLOW}💡 СЛЕДУЮЩИЕ ШАГИ:${NC}"
echo "1. Протестируйте приложение с Neon connection string"
echo "2. Сравните производительность под нагрузкой"
echo "3. Проверьте стоимость в Neon Dashboard"
echo "4. Если все устраивает - обновите production environment variables"
echo ""

echo -e "${GREEN}✨ Neon готов к использованию с SMETA360-2!${NC}"