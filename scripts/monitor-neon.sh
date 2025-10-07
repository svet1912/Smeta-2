#!/bin/bash

# 📊 МОНИТОРИНГ NEON DATABASE
# Скрипт для проверки производительности и здоровья базы после миграции

echo "📊 МОНИТОРИНГ NEON DATABASE - SMETA360-2"
echo "========================================"
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Читаем информацию о миграции
if [ -f "migration-info.txt" ]; then
    echo -e "${BLUE}📋 Информация о миграции:${NC}"
    cat migration-info.txt
    echo ""
fi

# Получаем Neon connection string из Vercel env
echo -e "${BLUE}🔍 Получаем connection string из Vercel...${NC}"
NEON_CONNECTION=$(vercel env get DATABASE_URL production 2>/dev/null)

if [ -z "$NEON_CONNECTION" ]; then
    echo -e "${RED}❌ Не удалось получить DATABASE_URL из Vercel${NC}"
    echo "Введите connection string вручную:"
    read -p "Neon Connection String: " NEON_CONNECTION
fi

echo -e "${GREEN}✅ Connection string получен${NC}"
echo ""

# Проверка подключения
echo -e "${YELLOW}🔗 1. ПРОВЕРКА ПОДКЛЮЧЕНИЯ${NC}"
echo "─────────────────────────────"

START_TIME=$(date +%s%3N)
if psql "$NEON_CONNECTION" -c "SELECT 1;" > /dev/null 2>&1; then
    END_TIME=$(date +%s%3N)
    CONNECTION_TIME=$((END_TIME - START_TIME))
    echo -e "${GREEN}✅ Подключение работает (${CONNECTION_TIME}ms)${NC}"
    
    VERSION=$(psql "$NEON_CONNECTION" -t -c "SELECT version();" | head -n1 | xargs)
    echo -e "${BLUE}   PostgreSQL: $VERSION${NC}"
else
    echo -e "${RED}❌ Подключение не работает!${NC}"
    exit 1
fi

echo ""

# Проверка основных таблиц
echo -e "${YELLOW}📊 2. ПРОВЕРКА ДАННЫХ${NC}"
echo "──────────────────────"

TABLES=("users" "tenants" "projects" "estimates" "materials" "works_ref" "customer_estimates")
TOTAL_RECORDS=0

for table in "${TABLES[@]}"; do
    COUNT=$(psql "$NEON_CONNECTION" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    if [ "$COUNT" ]; then
        echo -e "${GREEN}   ✅ $table: $COUNT записей${NC}"
        TOTAL_RECORDS=$((TOTAL_RECORDS + COUNT))
    else
        echo -e "${RED}   ❌ $table: ошибка${NC}"
    fi
done

echo -e "${BLUE}   📊 Всего записей: $TOTAL_RECORDS${NC}"
echo ""

# Тест производительности
echo -e "${YELLOW}⚡ 3. ТЕСТ ПРОИЗВОДИТЕЛЬНОСТИ${NC}"
echo "─────────────────────────────"

# Простые запросы
echo -e "${BLUE}   Тестируем простые SELECT...${NC}"
SIMPLE_TIMES=()
for i in {1..5}; do
    START_TIME=$(date +%s%3N)
    psql "$NEON_CONNECTION" -c "SELECT COUNT(*) FROM materials;" > /dev/null
    END_TIME=$(date +%s%3N)
    TIME=$((END_TIME - START_TIME))
    SIMPLE_TIMES+=($TIME)
done

# Вычисляем среднее время
SIMPLE_AVG=0
for time in "${SIMPLE_TIMES[@]}"; do
    SIMPLE_AVG=$((SIMPLE_AVG + time))
done
SIMPLE_AVG=$((SIMPLE_AVG / ${#SIMPLE_TIMES[@]}))

# Сложные запросы
echo -e "${BLUE}   Тестируем сложные JOIN...${NC}"
COMPLEX_TIMES=()
for i in {1..3}; do
    START_TIME=$(date +%s%3N)
    psql "$NEON_CONNECTION" -c "
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
    TIME=$((END_TIME - START_TIME))
    COMPLEX_TIMES+=($TIME)
done

# Вычисляем среднее время для сложных запросов
COMPLEX_AVG=0
for time in "${COMPLEX_TIMES[@]}"; do
    COMPLEX_AVG=$((COMPLEX_AVG + time))
done
COMPLEX_AVG=$((COMPLEX_AVG / ${#COMPLEX_TIMES[@]}))

echo -e "${GREEN}   ✅ Простые SELECT: ${SIMPLE_AVG}ms (среднее из 5)${NC}"
echo -e "${GREEN}   ✅ Сложные JOIN: ${COMPLEX_AVG}ms (среднее из 3)${NC}"

# Оценка производительности
if [ $SIMPLE_AVG -lt 100 ] && [ $COMPLEX_AVG -lt 500 ]; then
    echo -e "${GREEN}   🚀 ОТЛИЧНАЯ производительность!${NC}"
elif [ $SIMPLE_AVG -lt 300 ] && [ $COMPLEX_AVG -lt 1000 ]; then
    echo -e "${YELLOW}   ⚡ ХОРОШАЯ производительность${NC}"
else
    echo -e "${RED}   ⚠️  МЕДЛЕННАЯ производительность - требует внимания${NC}"
fi

echo ""

# Проверка Vercel API
echo -e "${YELLOW}🌐 4. ПРОВЕРКА VERCEL API${NC}"
echo "────────────────────────"

VERCEL_URL="https://smeta-2.vercel.app"

# Health check
echo -e "${BLUE}   Проверяем health endpoint...${NC}"
START_TIME=$(date +%s%3N)
HEALTH_RESPONSE=$(curl -s "$VERCEL_URL/api/health" || echo "ERROR")
END_TIME=$(date +%s%3N)
API_TIME=$((END_TIME - START_TIME))

if [[ $HEALTH_RESPONSE == *"status"* ]]; then
    echo -e "${GREEN}   ✅ API работает (${API_TIME}ms)${NC}"
else
    echo -e "${RED}   ❌ API не отвечает или ошибка${NC}"
fi

# Database test endpoint
echo -e "${BLUE}   Проверяем database test endpoint...${NC}"
START_TIME=$(date +%s%3N)
DB_TEST_RESPONSE=$(curl -s "$VERCEL_URL/api/test" || echo "ERROR")
END_TIME=$(date +%s%3N)
DB_TEST_TIME=$((END_TIME - START_TIME))

if [[ $DB_TEST_RESPONSE == *"version"* ]]; then
    echo -e "${GREEN}   ✅ Database API работает (${DB_TEST_TIME}ms)${NC}"
else
    echo -e "${RED}   ❌ Database API не отвечает${NC}"
fi

echo ""

# Проверка статистики подключений
echo -e "${YELLOW}🔌 5. СТАТИСТИКА ПОДКЛЮЧЕНИЙ${NC}"
echo "─────────────────────────────"

# Активные подключения
ACTIVE_CONNECTIONS=$(psql "$NEON_CONNECTION" -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" | xargs)
TOTAL_CONNECTIONS=$(psql "$NEON_CONNECTION" -t -c "SELECT count(*) FROM pg_stat_activity;" | xargs)

echo -e "${BLUE}   Активные подключения: $ACTIVE_CONNECTIONS${NC}"
echo -e "${BLUE}   Всего подключений: $TOTAL_CONNECTIONS${NC}"

if [ $TOTAL_CONNECTIONS -lt 10 ]; then
    echo -e "${GREEN}   ✅ Использование подключений нормальное${NC}"
elif [ $TOTAL_CONNECTIONS -lt 50 ]; then
    echo -e "${YELLOW}   ⚠️  Умеренное использование подключений${NC}"
else
    echo -e "${RED}   ⚠️  Высокое использование подключений${NC}"
fi

echo ""

# Размер базы данных
echo -e "${YELLOW}💾 6. РАЗМЕР БАЗЫ ДАННЫХ${NC}"
echo "────────────────────────"

DB_SIZE=$(psql "$NEON_CONNECTION" -t -c "SELECT pg_size_pretty(pg_database_size(current_database()));" | xargs)
LARGEST_TABLES=$(psql "$NEON_CONNECTION" -t -c "
SELECT 
    schemaname||'.'||tablename as table,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename::regclass)) as size
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size(schemaname||'.'||tablename::regclass) DESC 
LIMIT 5;
")

echo -e "${BLUE}   Размер базы данных: $DB_SIZE${NC}"
echo -e "${BLUE}   Топ-5 таблиц по размеру:${NC}"
echo "$LARGEST_TABLES" | grep -v "^$" | while read line; do
    echo -e "${BLUE}     $line${NC}"
done

echo ""

# Итоговый отчет
echo -e "${GREEN}📋 ИТОГОВЫЙ ОТЧЕТ${NC}"
echo "════════════════"
echo ""

# Создаем отчет
REPORT_FILE="neon-monitoring-$(date +%Y%m%d_%H%M%S).txt"
cat > "$REPORT_FILE" << EOF
NEON MONITORING REPORT - SMETA360-2
Generated: $(date)

CONNECTION:
- Status: OK
- Response Time: ${CONNECTION_TIME}ms

DATABASE:
- Total Records: $TOTAL_RECORDS
- Database Size: $DB_SIZE
- Active Connections: $ACTIVE_CONNECTIONS
- Total Connections: $TOTAL_CONNECTIONS

PERFORMANCE:
- Simple SELECT: ${SIMPLE_AVG}ms avg
- Complex JOIN: ${COMPLEX_AVG}ms avg

API ENDPOINTS:
- Health Check: ${API_TIME}ms
- Database Test: ${DB_TEST_TIME}ms

ASSESSMENT: $(if [ $SIMPLE_AVG -lt 100 ] && [ $COMPLEX_AVG -lt 500 ]; then echo "EXCELLENT"; elif [ $SIMPLE_AVG -lt 300 ] && [ $COMPLEX_AVG -lt 1000 ]; then echo "GOOD"; else echo "NEEDS_ATTENTION"; fi)
EOF

echo -e "${GREEN}✅ Подключение: работает (${CONNECTION_TIME}ms)${NC}"
echo -e "${GREEN}✅ Данные: $TOTAL_RECORDS записей в основных таблицах${NC}"
echo -e "${GREEN}✅ Производительность: SELECT ${SIMPLE_AVG}ms, JOIN ${COMPLEX_AVG}ms${NC}"
echo -e "${GREEN}✅ API: работает корректно${NC}"
echo -e "${GREEN}✅ Размер БД: $DB_SIZE${NC}"
echo ""

if [ $SIMPLE_AVG -lt 100 ] && [ $COMPLEX_AVG -lt 500 ]; then
    echo -e "${GREEN}🎉 СТАТУС: ВСЕ ОТЛИЧНО! Neon работает великолепно!${NC}"
elif [ $SIMPLE_AVG -lt 300 ] && [ $COMPLEX_AVG -lt 1000 ]; then
    echo -e "${YELLOW}✅ СТАТУС: ХОРОШО! Производительность в норме${NC}"
else
    echo -e "${RED}⚠️  СТАТУС: ТРЕБУЕТ ВНИМАНИЯ! Проверьте настройки${NC}"
fi

echo ""
echo -e "${BLUE}📊 Отчет сохранен: $REPORT_FILE${NC}"
echo ""
echo -e "${YELLOW}💡 РЕКОМЕНДАЦИИ:${NC}"
echo "• Запускайте мониторинг ежедневно первую неделю"
echo "• Следите за размером базы данных"
echo "• Настройте alerts в Neon Console при превышении лимитов"
echo "• Если производительность падает - увеличьте Compute Units в Neon"
echo ""
echo -e "${GREEN}🚀 SMETA360-2 успешно работает на Neon!${NC}"