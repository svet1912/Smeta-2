#!/bin/bash

# 🚀 SMETA360-2 Final System Status
# Финальная проверка всех компонентов системы

echo "🎯 ФИНАЛЬНАЯ ПРОВЕРКА SMETA360-2"
echo "================================="
echo ""

# Цвета для вывода
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для проверки HTTP-ответа с подробным выводом
check_http_detailed() {
    local url=$1
    local name=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}:%{time_total}" "$url" 2>/dev/null)
    local http_code=$(echo $response | cut -d':' -f1)
    local time_total=$(echo $response | cut -d':' -f2)
    
    if [ "$http_code" = "200" ]; then
        printf "✅ %-30s ${GREEN}работает${NC} (HTTP $http_code, %.0fms)\n" "$name:" $(echo "$time_total * 1000" | bc -l 2>/dev/null || echo "0")
        return 0
    else
        printf "❌ %-30s ${RED}проблема${NC} (HTTP $http_code)\n" "$name:"
        return 1
    fi
}

# Функция для проверки процесса с PID
check_process_detailed() {
    local process_name=$1
    local description=$2
    
    local pid=$(pgrep -f "$process_name" | head -1)
    if [ -n "$pid" ]; then
        local memory=$(ps -p $pid -o rss= 2>/dev/null | tr -d ' ')
        if [ -n "$memory" ]; then
            local memory_mb=$((memory / 1024))
            printf "✅ %-30s ${GREEN}запущен${NC} (PID: $pid, RAM: ${memory_mb}MB)\n" "$description:"
        else
            printf "✅ %-30s ${GREEN}запущен${NC} (PID: $pid)\n" "$description:"
        fi
        return 0
    else
        printf "❌ %-30s ${RED}не запущен${NC}\n" "$description:"
        return 1
    fi
}

echo "🔍 ДЕТАЛЬНАЯ ПРОВЕРКА ПРОЦЕССОВ:"
echo "-------------------------------"
check_process_detailed "node index.js" "Backend Main Server"
check_process_detailed "node start.js" "Backend Start Server"
check_process_detailed "vite" "Frontend Vite Server"
check_process_detailed "concurrently" "Process Manager"
echo ""

echo "🌐 ДЕТАЛЬНАЯ ПРОВЕРКА HTTP СЕРВИСОВ:"
echo "-----------------------------------"
check_http_detailed "http://localhost:3000" "Frontend (React + Vite)"
check_http_detailed "http://localhost:3001/api/health" "Backend Health Check"
check_http_detailed "http://localhost:3001/api/test" "Backend Database Test"
echo ""

echo "🗄️ ПРОВЕРКА БАЗЫ ДАННЫХ:"
echo "------------------------"
db_response=$(curl -s http://localhost:3001/api/test 2>/dev/null)
if echo "$db_response" | grep -q "database_time"; then
    db_time=$(echo "$db_response" | grep -o '"database_time":"[^"]*"' | cut -d'"' -f4)
    printf "✅ %-30s ${GREEN}подключена${NC}\n" "PostgreSQL:"
    printf "   %-30s ${BLUE}%s${NC}\n" "Время БД:" "$db_time"
    printf "   %-30s ${BLUE}%s${NC}\n" "Провайдер:" "Aiven Cloud"
    
    # Тест производительности БД
    start_time=$(date +%s%3N)
    curl -s http://localhost:3001/api/test >/dev/null 2>&1
    end_time=$(date +%s%3N)
    db_response_time=$((end_time - start_time))
    
    if [ $db_response_time -lt 200 ]; then
        printf "   %-30s ${GREEN}%dms (отлично)${NC}\n" "Время отклика БД:" $db_response_time
    elif [ $db_response_time -lt 500 ]; then
        printf "   %-30s ${YELLOW}%dms (хорошо)${NC}\n" "Время отклика БД:" $db_response_time
    else
        printf "   %-30s ${RED}%dms (медленно)${NC}\n" "Время отклика БД:" $db_response_time
    fi
else
    printf "❌ %-30s ${RED}проблема с подключением${NC}\n" "PostgreSQL:"
fi
echo ""

echo "🔒 ПРОВЕРКА БЕЗОПАСНОСТИ:"
echo "------------------------"
# Проверка rate limiting
rate_limit_headers=$(curl -I -s http://localhost:3001/api/health 2>/dev/null | grep -i ratelimit | wc -l)
if [ $rate_limit_headers -gt 0 ]; then
    printf "✅ %-30s ${GREEN}активен${NC}\n" "Rate Limiting:"
    curl -I -s http://localhost:3001/api/health 2>/dev/null | grep -i ratelimit | sed 's/^/   /'
else
    printf "⚠️  %-30s ${YELLOW}проверьте конфигурацию${NC}\n" "Rate Limiting:"
fi

# Проверка CORS
cors_headers=$(curl -I -s http://localhost:3001/api/health 2>/dev/null | grep -i "access-control" | wc -l)
if [ $cors_headers -gt 0 ]; then
    printf "✅ %-30s ${GREEN}настроен${NC}\n" "CORS:"
else
    printf "⚠️  %-30s ${YELLOW}проверьте конфигурацию${NC}\n" "CORS:"
fi
echo ""

echo "📊 ПРОВЕРКА ПОРТОВ И СЕТЕВЫХ СОЕДИНЕНИЙ:"
echo "---------------------------------------"
# Проверка активных портов
for port in 3000 3001 4174; do
    if netstat -tlnp 2>/dev/null | grep ":$port " | grep -q LISTEN; then
        process_info=$(netstat -tlnp 2>/dev/null | grep ":$port " | grep LISTEN | awk '{print $7}' | cut -d'/' -f2)
        printf "✅ %-30s ${GREEN}активен${NC} (%s)\n" "Порт $port:" "$process_info"
    else
        printf "❌ %-30s ${RED}не активен${NC}\n" "Порт $port:"
    fi
done
echo ""

echo "⚡ ПРОВЕРКА ПРОИЗВОДИТЕЛЬНОСТИ:"
echo "-----------------------------"
# Тест скорости API
echo "Тестирование производительности API..."
total_time=0
successful_requests=0

for i in {1..5}; do
    start_time=$(date +%s%3N)
    if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
        end_time=$(date +%s%3N)
        response_time=$((end_time - start_time))
        total_time=$((total_time + response_time))
        successful_requests=$((successful_requests + 1))
    fi
done

if [ $successful_requests -gt 0 ]; then
    avg_time=$((total_time / successful_requests))
    if [ $avg_time -lt 100 ]; then
        printf "✅ %-30s ${GREEN}%dms (превосходно)${NC}\n" "Среднее время API:" $avg_time
    elif [ $avg_time -lt 200 ]; then
        printf "✅ %-30s ${GREEN}%dms (отлично)${NC}\n" "Среднее время API:" $avg_time
    elif [ $avg_time -lt 500 ]; then
        printf "⚠️  %-30s ${YELLOW}%dms (приемлемо)${NC}\n" "Среднее время API:" $avg_time
    else
        printf "❌ %-30s ${RED}%dms (медленно)${NC}\n" "Среднее время API:" $avg_time
    fi
    printf "   %-30s ${BLUE}%d/5${NC}\n" "Успешных запросов:" $successful_requests
else
    printf "❌ %-30s ${RED}API не отвечает${NC}\n" "Производительность:"
fi
echo ""

echo "🧪 ФУНКЦИОНАЛЬНЫЕ ТЕСТЫ:"
echo "-----------------------"
# Тест аутентификации
printf "%-30s " "Эндпоинт /api/auth/login:"
auth_test=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test123"}' \
    http://localhost:3001/api/auth/login 2>/dev/null)

if echo "$auth_test" | grep -q -E "(email|пароль|Неверный|success)"; then
    printf "${GREEN}работает${NC} (ожидаемый ответ)\n"
else
    printf "${RED}проблема${NC}\n"
fi

# Тест API маршрутов
printf "%-30s " "API маршруты:"
if curl -s http://localhost:3001/api/health | grep -q "OK"; then
    printf "${GREEN}работают${NC}\n"
else
    printf "${RED}проблема${NC}\n"
fi
echo ""

echo "📈 ОБЩИЙ СТАТУС СИСТЕМЫ:"
echo "========================"

# Подсчет успешных компонентов
components_ok=0
total_components=8

# Проверяем каждый компонент
if pgrep -f "node index.js" >/dev/null; then ((components_ok++)); fi
if pgrep -f "vite" >/dev/null; then ((components_ok++)); fi
if curl -s http://localhost:3000 >/dev/null 2>&1; then ((components_ok++)); fi
if curl -s http://localhost:3001/api/health | grep -q "OK" 2>/dev/null; then ((components_ok++)); fi
if curl -s http://localhost:3001/api/test | grep -q "database_time" 2>/dev/null; then ((components_ok++)); fi
if netstat -tlnp 2>/dev/null | grep -q ":3000.*LISTEN"; then ((components_ok++)); fi
if netstat -tlnp 2>/dev/null | grep -q ":3001.*LISTEN"; then ((components_ok++)); fi

# API performance test
start_time=$(date +%s%3N)
curl -s http://localhost:3001/api/health >/dev/null 2>&1
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))
if [ $response_time -lt 200 ]; then ((components_ok++)); fi

percentage=$((components_ok * 100 / total_components))

if [ $percentage -ge 90 ]; then
    printf "🎉 ${GREEN}СТАТУС: ОТЛИЧНО${NC} (%d/%d компонентов - %d%%)\n" $components_ok $total_components $percentage
    echo "✅ Все основные компоненты системы работают корректно!"
    echo "🚀 Система готова к использованию!"
elif [ $percentage -ge 75 ]; then
    printf "⚠️  ${YELLOW}СТАТУС: ХОРОШО${NC} (%d/%d компонентов - %d%%)\n" $components_ok $total_components $percentage
    echo "🔧 Большинство компонентов работает, некоторые требуют внимания"
elif [ $percentage -ge 50 ]; then
    printf "❌ ${RED}СТАТУС: ТРЕБУЕТ ВНИМАНИЯ${NC} (%d/%d компонентов - %d%%)\n" $components_ok $total_components $percentage
    echo "🚨 Несколько критических компонентов не работают"
else
    printf "🚨 ${RED}СТАТУС: КРИТИЧЕСКАЯ ПРОБЛЕМА${NC} (%d/%d компонентов - %d%%)\n" $components_ok $total_components $percentage
    echo "💥 Система требует немедленного вмешательства"
fi

echo ""
echo "🔗 ССЫЛКИ ДЛЯ ДОСТУПА:"
echo "====================="
printf "🖥️  %-20s ${BLUE}http://localhost:3000${NC}\n" "Frontend:"
printf "🔧 %-20s ${BLUE}http://localhost:3001${NC}\n" "Backend API:"
printf "📊 %-20s ${BLUE}http://localhost:3001/api/health${NC}\n" "Health Check:"
printf "🧪 %-20s ${BLUE}http://localhost:3001/api/test${NC}\n" "Test Endpoint:"

echo ""
echo "📚 ДОКУМЕНТАЦИЯ:"
echo "==============="
echo "📖 Основная документация: PROJECT_DOCUMENTATION.md"
echo "🎯 Статус оптимизации: OPTIMIZATION_COMPLETE.md"
echo "🔒 Реализация безопасности: docs/SECURITY_IMPLEMENTATION.md"
echo ""
echo "🎊 SMETA360-2 Enterprise-Grade Construction Estimation System"
echo "   ✨ Полная оптимизация завершена успешно!"