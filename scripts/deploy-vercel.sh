#!/bin/bash

# 🚀 SMETA360-2 Vercel Deployment Script
# Автоматический деплой с настройкой всех компонентов

echo "🚀 VERCEL DEPLOYMENT FOR SMETA360-2"
echo "=================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверяем, установлен ли Vercel CLI
if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI не установлен. Устанавливаем...${NC}"
    npm install -g vercel
fi

echo -e "${BLUE}📋 ЭТАПЫ ДЕПЛОЯ:${NC}"
echo "1. Проверка проекта"
echo "2. Настройка environment variables"
echo "3. Настройка базы данных Postgres"
echo "4. Настройка Redis (Upstash)"
echo "5. Деплой на Vercel"
echo "6. Проверка работоспособности"
echo ""

# Функция для добавления environment variable
add_env_var() {
    local key=$1
    local value=$2
    echo -e "${BLUE}🔧 Добавляем переменную: ${key}${NC}"
    vercel env add "$key" production <<< "$value"
}

# Функция проверки статуса
check_status() {
    local url=$1
    local name=$2
    
    echo -e "${BLUE}🔍 Проверяем ${name}...${NC}"
    if curl -s "$url" > /dev/null; then
        echo -e "${GREEN}✅ ${name}: работает${NC}"
        return 0
    else
        echo -e "${RED}❌ ${name}: не отвечает${NC}"
        return 1
    fi
}

echo -e "${BLUE}📦 ШАГ 1: ПРОВЕРКА ПРОЕКТА${NC}"
echo "Проверяем package.json и конфигурацию..."

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json не найден!${NC}"
    exit 1
fi

if [ ! -f "vercel.json" ]; then
    echo -e "${RED}❌ vercel.json не найден!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Конфигурация проекта найдена${NC}"
echo ""

echo -e "${BLUE}🔐 ШАГ 2: НАСТРОЙКА ENVIRONMENT VARIABLES${NC}"
echo "Настраиваем переменные окружения..."

# Проверяем авторизацию в Vercel
echo -e "${BLUE}🔑 Проверяем авторизацию в Vercel...${NC}"
if ! vercel whoami > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Необходима авторизация в Vercel${NC}"
    vercel login
fi

# Подключаем проект к Vercel
echo -e "${BLUE}🔗 Подключаем проект к Vercel...${NC}"
vercel link --yes

# Читаем переменные из .env.vercel и добавляем их
if [ -f ".env.vercel" ]; then
    echo -e "${BLUE}📝 Добавляем переменные окружения из .env.vercel${NC}"
    
    # Основные переменные
    add_env_var "NODE_ENV" "production"
    add_env_var "VITE_API_URL" "/api"
    
    # Database
    echo -e "${YELLOW}🗄️  Настройка базы данных PostgreSQL${NC}"
    echo "Скопируйте DATABASE_URL из вашего .env файла:"
    read -p "DATABASE_URL: " database_url
    add_env_var "DATABASE_URL" "$database_url"
    add_env_var "DATABASE_SSLMODE" "require"
    add_env_var "DATABASE_SSL" "true"
    
    # JWT Secrets
    echo -e "${YELLOW}🔐 Генерируем JWT секреты${NC}"
    jwt_secret=$(openssl rand -base64 64)
    jwt_refresh_secret=$(openssl rand -base64 64)
    add_env_var "JWT_SECRET" "$jwt_secret"
    add_env_var "JWT_REFRESH_SECRET" "$jwt_refresh_secret"
    
    # Другие настройки
    add_env_var "BCRYPT_SALT_ROUNDS" "12"
    add_env_var "CACHE_ENABLED" "true"
    add_env_var "CACHE_WORKS" "true"
    add_env_var "CACHE_MATERIALS" "true"
    
else
    echo -e "${RED}❌ .env.vercel не найден!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables настроены${NC}"
echo ""

echo -e "${BLUE}📊 ШАГ 3: НАСТРОЙКА REDIS (UPSTASH)${NC}"
echo "Настраиваем Redis через Upstash Integration..."
echo ""
echo -e "${YELLOW}⚠️  ВАЖНО: Вам нужно вручную подключить Upstash Redis:${NC}"
echo "1. Откройте https://vercel.com/dashboard"
echo "2. Выберите ваш проект smeta360-2"
echo "3. Перейдите в Settings > Integrations"
echo "4. Найдите и подключите 'Upstash'"
echo "5. Создайте новую Redis database"
echo ""
read -p "Нажмите Enter после настройки Redis..."

echo -e "${GREEN}✅ Redis будет настроен автоматически через Upstash${NC}"
echo ""

echo -e "${BLUE}🚢 ШАГ 4: ДЕПЛОЙ НА VERCEL${NC}"
echo "Запускаем деплой..."

# Выполняем деплой
vercel --prod --yes

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Деплой выполнен успешно!${NC}"
else
    echo -e "${RED}❌ Ошибка при деплое${NC}"
    exit 1
fi

echo ""

echo -e "${BLUE}🧪 ШАГ 5: ПРОВЕРКА РАБОТОСПОСОБНОСТИ${NC}"
echo "Проверяем развернутое приложение..."

# Получаем URL проекта
project_url=$(vercel inspect --wait | grep -o 'https://[^[:space:]]*')

if [ -z "$project_url" ]; then
    echo -e "${YELLOW}⚠️  Не удалось получить URL проекта автоматически${NC}"
    echo "Проверьте ваше приложение на https://smeta360-2.vercel.app"
    project_url="https://smeta360-2.vercel.app"
fi

echo -e "${BLUE}🌐 URL проекта: ${project_url}${NC}"

# Ждем немного для прогрева
echo "Ждем готовности сервисов..."
sleep 30

# Проверяем эндпоинты
check_status "${project_url}" "Frontend"
check_status "${project_url}/api/health" "Health Check API"
check_status "${project_url}/api/test" "Database Test API"

echo ""
echo -e "${GREEN}🎉 ДЕПЛОЙ ЗАВЕРШЕН УСПЕШНО!${NC}"
echo ""
echo -e "${BLUE}📋 ИНФОРМАЦИЯ О РАЗВЕРТЫВАНИИ:${NC}"
echo "🌐 URL приложения: ${project_url}"
echo "🔧 API Health Check: ${project_url}/api/health"
echo "🧪 Database Test: ${project_url}/api/test"
echo "📊 Vercel Dashboard: https://vercel.com/dashboard"
echo ""
echo -e "${BLUE}📚 ПОЛЕЗНЫЕ КОМАНДЫ:${NC}"
echo "vercel --prod          # Повторный деплой"
echo "vercel logs            # Просмотр логов"
echo "vercel env ls          # Список переменных окружения"
echo "vercel inspect         # Информация о проекте"
echo ""
echo -e "${YELLOW}⚠️  ВАЖНЫЕ НАПОМИНАНИЯ:${NC}"
echo "1. Убедитесь, что Upstash Redis подключен в настройках проекта"
echo "2. Проверьте переменные окружения в Vercel Dashboard"
echo "3. Настройте домен в Project Settings, если нужен кастомный домен"
echo "4. Включите автоматические деплои для GitHub integration"
echo ""
echo -e "${GREEN}🚀 SMETA360-2 готов к использованию на Vercel!${NC}"