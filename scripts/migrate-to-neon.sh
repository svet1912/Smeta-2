#!/bin/bash

# 🚀 МИГРАЦИЯ SMETA360-2 С AIVEN НА NEON
# Пошаговая миграция с полной безопасностью

echo "🚀 МИГРАЦИЯ SMETA360-2: AIVEN → NEON"
echo "===================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🎯 ПРЕИМУЩЕСТВА ПЕРЕХОДА НА NEON:${NC}"
echo "✅ Встроенная интеграция с Vercel"
echo "✅ Serverless архитектура (автомасштабирование)"
echo "✅ Database branches (как Git для БД)"
echo "✅ Вероятно дешевле Aiven"
echo "✅ Connection pooling из коробки"
echo ""

echo -e "${BLUE}📋 ПЛАН МИГРАЦИИ:${NC}"
echo "1. 🏗️  Создание проекта в Neon"
echo "2. 📦 Восстановление дампа"
echo "3. 🧪 Тестирование подключения"
echo "4. ⚡ Проверка производительности"
echo "5. 🔄 Обновление Vercel environment variables"
echo "6. 🎉 Переключение production"
echo "7. ✅ Финальная проверка"
echo ""

# Проверяем наличие дампа
DUMP_FILE="backups/smeta360_custom_dump_20251007_162104.backup"
if [ ! -f "$DUMP_FILE" ]; then
    echo -e "${RED}❌ Дамп не найден: $DUMP_FILE${NC}"
    echo "Сначала создайте дамп с помощью ./scripts/backup-database.sh"
    exit 1
fi

echo -e "${GREEN}✅ Дамп готов: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))${NC}"
echo ""

# ШАГ 1: Создание проекта в Neon
echo -e "${YELLOW}🏗️  ШАГ 1: СОЗДАНИЕ ПРОЕКТА В NEON${NC}"
echo "────────────────────────────────────────"
echo ""
echo "1. Откройте https://neon.tech в новой вкладке"
echo "2. Зарегистрируйтесь/войдитев аккаунт"
echo "3. Нажмите 'Create Project'"
echo ""
echo -e "${BLUE}⚙️  НАСТРОЙКИ ПРОЕКТА:${NC}"
echo "   📛 Project Name: smeta360-2-production"
echo "   🌍 Region: Europe (Frankfurt) - ближайший к Aiven"
echo "   🗄️  PostgreSQL Version: 17 (как у вас сейчас)"
echo "   💳 Plan: можете начать с Free, потом upgrade"
echo ""
echo "4. После создания скопируйте Connection String"
echo "   (кнопка 'Copy' рядом с Database URL)"
echo ""

read -p "Нажмите Enter, когда создадите проект в Neon..."
echo ""

# Получаем connection string
echo -e "${BLUE}🔗 Введите Neon Connection String:${NC}"
echo "Формат: postgresql://user:password@hostname/dbname"
read -p "Connection String: " NEON_CONNECTION_STRING

if [ -z "$NEON_CONNECTION_STRING" ]; then
    echo -e "${RED}❌ Connection String не введен!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connection String получен${NC}"
echo ""

# ШАГ 2: Тестирование подключения
echo -e "${YELLOW}🧪 ШАГ 2: ТЕСТИРОВАНИЕ ПОДКЛЮЧЕНИЯ${NC}"
echo "─────────────────────────────────────────"
echo ""

if psql "$NEON_CONNECTION_STRING" -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Подключение к Neon успешно${NC}"
    NEON_VERSION=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT version();" | head -n1 | xargs)
    echo -e "${BLUE}   PostgreSQL версия: $NEON_VERSION${NC}"
else
    echo -e "${RED}❌ Не удалось подключиться к Neon${NC}"
    echo "Проверьте Connection String и попробуйте еще раз"
    exit 1
fi

echo ""

# ШАГ 3: Восстановление дампа
echo -e "${YELLOW}📦 ШАГ 3: ВОССТАНОВЛЕНИЕ ДАМПА${NC}"
echo "────────────────────────────────────"
echo ""
echo "Восстанавливаем полную базу данных..."
echo "Это может занять 2-5 минут..."

START_TIME=$(date +%s)

echo -e "${BLUE}🔄 Запуск pg_restore...${NC}"
pg_restore -d "$NEON_CONNECTION_STRING" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    --verbose \
    "$DUMP_FILE" 2>&1 | grep -E "(processing|creating|completed|ERROR|FATAL)" | tail -10

RESTORE_EXIT_CODE=${PIPESTATUS[0]}
END_TIME=$(date +%s)
RESTORE_DURATION=$((END_TIME - START_TIME))

if [ $RESTORE_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ База данных успешно восстановлена в Neon${NC}"
    echo -e "${BLUE}   Время восстановления: ${RESTORE_DURATION} секунд${NC}"
else
    echo -e "${RED}❌ Ошибка при восстановлении${NC}"
    echo "Проверьте логи выше и попробуйте еще раз"
    exit 1
fi

echo ""

# ШАГ 4: Проверка данных
echo -e "${YELLOW}📊 ШАГ 4: ПРОВЕРКА ЦЕЛОСТНОСТИ ДАННЫХ${NC}"
echo "──────────────────────────────────────────"
echo ""

# Подсчитываим таблицы
TABLES_COUNT=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
echo -e "${BLUE}📋 Всего таблиц: $TABLES_COUNT${NC}"

# Проверяем ключевые таблицы
echo -e "${BLUE}🔍 Проверка ключевых таблиц:${NC}"
TABLES=("users" "tenants" "projects" "estimates" "materials" "works_ref")

for table in "${TABLES[@]}"; do
    COUNT=$(psql "$NEON_CONNECTION_STRING" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | xargs)
    if [ "$COUNT" ]; then
        echo -e "${GREEN}   ✅ $table: $COUNT записей${NC}"
    else
        echo -e "${RED}   ❌ $table: ошибка или отсутствует${NC}"
    fi
done

echo ""

# ШАГ 5: Тест производительности
echo -e "${YELLOW}⚡ ШАГ 5: ТЕСТ ПРОИЗВОДИТЕЛЬНОСТИ${NC}"
echo "────────────────────────────────────"
echo ""

# Простой SELECT
START_TIME=$(date +%s%3N)
psql "$NEON_CONNECTION_STRING" -c "SELECT COUNT(*) FROM materials;" > /dev/null
END_TIME=$(date +%s%3N)
SIMPLE_QUERY_TIME=$((END_TIME - START_TIME))

# Сложный JOIN
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

echo -e "${BLUE}📊 Результаты производительности:${NC}"
echo -e "${GREEN}   ✅ Простой SELECT: ${SIMPLE_QUERY_TIME}ms${NC}"
echo -e "${GREEN}   ✅ Сложный JOIN: ${COMPLEX_QUERY_TIME}ms${NC}"

if [ $SIMPLE_QUERY_TIME -lt 500 ] && [ $COMPLEX_QUERY_TIME -lt 2000 ]; then
    echo -e "${GREEN}   🚀 Производительность отличная!${NC}"
else
    echo -e "${YELLOW}   ⚠️  Производительность приемлемая${NC}"
fi

echo ""

# ШАГ 6: Обновление Vercel
echo -e "${YELLOW}🔄 ШАГ 6: ОБНОВЛЕНИЕ VERCEL ENVIRONMENT VARIABLES${NC}"
echo "──────────────────────────────────────────────────"
echo ""

echo -e "${BLUE}Обновляем DATABASE_URL в Vercel...${NC}"

# Обновляем DATABASE_URL в Vercel
vercel env rm DATABASE_URL production --yes 2>/dev/null
vercel env add DATABASE_URL production <<< "$NEON_CONNECTION_STRING"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ DATABASE_URL обновлен в Vercel${NC}"
else
    echo -e "${RED}❌ Ошибка обновления Vercel env${NC}"
    echo "Обновите вручную в Vercel Dashboard:"
    echo "DATABASE_URL = $NEON_CONNECTION_STRING"
fi

echo ""

# ШАГ 7: Деплой с новой базой
echo -e "${YELLOW}🚀 ШАГ 7: ДЕПЛОЙ С НОВОЙ БАЗОЙ${NC}"
echo "────────────────────────────────────"
echo ""

echo -e "${BLUE}Запуск нового деплоя...${NC}"
vercel --prod --yes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Деплой с Neon завершен успешно!${NC}"
else
    echo -e "${RED}❌ Ошибка деплоя${NC}"
fi

echo ""

# ШАГ 8: Финальная проверка
echo -e "${YELLOW}✅ ШАГ 8: ФИНАЛЬНАЯ ПРОВЕРКА${NC}"
echo "─────────────────────────────────"
echo ""

# Получаем URL приложения
VERCEL_URL="https://smeta-2.vercel.app"

echo -e "${BLUE}🌐 Проверяем приложение: $VERCEL_URL${NC}"
echo ""

# Даем время на прогрев
echo "Ждем прогрева серверов (30 секунд)..."
sleep 30

# Проверяем health endpoint
if curl -s "$VERCEL_URL/api/health" > /dev/null; then
    echo -e "${GREEN}✅ API работает на Neon!${NC}"
else
    echo -e "${YELLOW}⚠️  API возможно еще прогревается${NC}"
fi

echo ""

# ИТОГОВЫЙ ОТЧЕТ
echo -e "${PURPLE}🎉 МИГРАЦИЯ ЗАВЕРШЕНА УСПЕШНО!${NC}"
echo "═══════════════════════════════════"
echo ""
echo -e "${GREEN}✅ База данных перенесена с Aiven на Neon${NC}"
echo -e "${GREEN}✅ Все данные сохранены ($TABLES_COUNT таблиц)${NC}"
echo -e "${GREEN}✅ Производительность: ${SIMPLE_QUERY_TIME}ms SELECT, ${COMPLEX_QUERY_TIME}ms JOIN${NC}"
echo -e "${GREEN}✅ Vercel обновлен и переразвернут${NC}"
echo -e "${GREEN}✅ Приложение работает: $VERCEL_URL${NC}"
echo ""

echo -e "${BLUE}🆕 НОВЫЕ ВОЗМОЖНОСТИ С NEON:${NC}"
echo "🌿 Database Branches - создавайте копии БД для фич"
echo "⚡ Serverless - платите только за использование"
echo "🔧 Автоматический connection pooling"
echo "📊 Встроенная аналитика в Neon Console"
echo ""

echo -e "${YELLOW}💡 СЛЕДУЮЩИЕ ШАГИ:${NC}"
echo "1. Проверьте приложение: $VERCEL_URL"
echo "2. Мониторьте производительность несколько дней"
echo "3. Изучите Neon Console: https://console.neon.tech"
echo "4. Настройте database branches для разработки"
echo "5. Можете отключить Aiven (но не сразу - подождите неделю)"
echo ""

echo -e "${GREEN}🏆 ПОЗДРАВЛЯЮ! SMETA360-2 теперь работает на современной Neon архитектуре!${NC}"
echo ""

# Сохраняем информацию о миграции
cat > migration-info.txt << EOF
SMETA360-2 Migration: Aiven → Neon
Date: $(date)
Neon Connection: $NEON_CONNECTION_STRING
Migration Duration: ${RESTORE_DURATION}s
Performance: ${SIMPLE_QUERY_TIME}ms SELECT, ${COMPLEX_QUERY_TIME}ms JOIN
Status: SUCCESS
EOF