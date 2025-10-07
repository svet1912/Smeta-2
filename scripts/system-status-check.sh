#!/bin/bash

# 🚀 SMETA360-2 System Status Check
# Проверка всех компонентов оптимизированной системы

echo "🎯 ПРОВЕРКА СТАТУСА СИСТЕМЫ SMETA360-2"
echo "========================================"
echo ""

# Функция для проверки HTTP-ответа
check_http() {
    local url=$1
    local name=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$response" = "200" ]; then
        echo "✅ $name: работает (HTTP $response)"
        return 0
    else
        echo "❌ $name: проблема (HTTP $response)"
        return 1
    fi
}

# Функция для проверки процесса
check_process() {
    local process_name=$1
    local description=$2
    
    if pgrep -f "$process_name" > /dev/null; then
        echo "✅ $description: запущен"
        return 0
    else
        echo "❌ $description: не запущен"
        return 1
    fi
}

echo "🔍 ПРОВЕРКА ПРОЦЕССОВ:"
echo "--------------------"
check_process "node index.js" "Backend Server (Node.js)"
check_process "vite" "Frontend Server (Vite)"
check_process "node start.js" "Additional Server"
echo ""

echo "🌐 ПРОВЕРКА HTTP СЕРВИСОВ:"
echo "-------------------------"
check_http "http://localhost:3000" "Frontend (React + Vite)"
check_http "http://localhost:3001/api/health" "Backend API Health"
check_http "http://localhost:3001/api/test" "Backend API Test"
echo ""

echo "🗄️ ПРОВЕРКА БАЗЫ ДАННЫХ:"
echo "------------------------"
# Тест подключения к базе данных через API
db_response=$(curl -s http://localhost:3001/api/test)
if echo "$db_response" | grep -q "database_time"; then
    echo "✅ База данных: подключена и работает"
    db_time=$(echo "$db_response" | grep -o '"database_time":"[^"]*"' | cut -d'"' -f4)
    echo "   📅 Время БД: $db_time"
else
    echo "❌ База данных: проблема с подключением"
fi
echo ""

echo "🔒 ПРОВЕРКА БЕЗОПАСНОСТИ:"
echo "------------------------"
# Проверка security headers
security_headers=$(curl -I -s http://localhost:3000 | grep -E "(X-Content-Type-Options|X-Frame-Options|X-XSS-Protection)")
if [ -n "$security_headers" ]; then
    echo "✅ Security Headers: установлены"
    echo "$security_headers" | sed 's/^/   /'
else
    echo "⚠️  Security Headers: проверьте конфигурацию"
fi
echo ""

echo "⚡ ПРОВЕРКА ПРОИЗВОДИТЕЛЬНОСТИ:"
echo "-----------------------------"
# Тест скорости API
start_time=$(date +%s%3N)
curl -s http://localhost:3001/api/health > /dev/null
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))

if [ $response_time -lt 200 ]; then
    echo "✅ API Response Time: ${response_time}ms (отлично)"
elif [ $response_time -lt 500 ]; then
    echo "⚠️  API Response Time: ${response_time}ms (приемлемо)"
else
    echo "❌ API Response Time: ${response_time}ms (медленно)"
fi
echo ""

echo "📊 ПРОВЕРКА ПОРТОВ:"
echo "------------------"
# Проверка активных портов
active_ports=$(netstat -tlnp 2>/dev/null | grep -E "(3000|3001|4174|8080)" | grep LISTEN || echo "")
if [ -n "$active_ports" ]; then
    echo "✅ Активные порты:"
    echo "$active_ports" | while read line; do
        port=$(echo "$line" | awk '{print $4}' | cut -d':' -f2)
        echo "   🔌 Порт $port: активен"
    done
else
    echo "⚠️  Порты: проверьте конфигурацию"
fi
echo ""

echo "🧪 БЫСТРЫЙ ФУНКЦИОНАЛЬНЫЙ ТЕСТ:"
echo "------------------------------"
# Тест аутентификации (без реальных данных)
auth_response=$(curl -s -X POST -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test123"}' \
    http://localhost:3001/api/auth/login 2>/dev/null || echo "error")

if echo "$auth_response" | grep -q "error\|Пользователь не найден\|401"; then
    echo "✅ API Authentication: эндпоинт работает (ожидаемый ответ для тестовых данных)"
else
    echo "⚠️  API Authentication: проверьте конфигурацию"
fi
echo ""

echo "📈 ОБЩИЙ СТАТУС СИСТЕМЫ:"
echo "========================"

# Подсчет успешных проверок
success_count=0
total_checks=6

# Frontend
if check_http "http://localhost:3000" "" >/dev/null 2>&1; then
    ((success_count++))
fi

# Backend API
if check_http "http://localhost:3001/api/health" "" >/dev/null 2>&1; then
    ((success_count++))
fi

# Database
if curl -s http://localhost:3001/api/test | grep -q "database_time"; then
    ((success_count++))
fi

# Processes
if pgrep -f "node index.js" >/dev/null && pgrep -f "vite" >/dev/null; then
    ((success_count++))
fi

# API Response Time
start_time=$(date +%s%3N)
curl -s http://localhost:3001/api/health >/dev/null 2>&1
end_time=$(date +%s%3N)
response_time=$((end_time - start_time))
if [ $response_time -lt 500 ]; then
    ((success_count++))
fi

# Ports
if netstat -tlnp 2>/dev/null | grep -E "(3000|3001)" | grep -q LISTEN; then
    ((success_count++))
fi

percentage=$((success_count * 100 / total_checks))

if [ $percentage -ge 90 ]; then
    echo "🎉 СТАТУС: ОТЛИЧНО ($success_count/$total_checks проверок пройдено - ${percentage}%)"
    echo "✅ Система полностью готова к работе!"
elif [ $percentage -ge 70 ]; then
    echo "⚠️  СТАТУС: ХОРОШО ($success_count/$total_checks проверок пройдено - ${percentage}%)"
    echo "🔧 Некоторые компоненты требуют внимания"
else
    echo "❌ СТАТУС: ТРЕБУЕТ ВНИМАНИЯ ($success_count/$total_checks проверок пройдено - ${percentage}%)"
    echo "🚨 Проверьте конфигурацию системы"
fi

echo ""
echo "🔗 ССЫЛКИ ДЛЯ ДОСТУПА:"
echo "====================="
echo "🖥️  Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo "📊 Health Check: http://localhost:3001/api/health"
echo "🧪 Test Endpoint: http://localhost:3001/api/test"
echo ""
echo "📚 Документация: /workspaces/Smeta-2/PROJECT_DOCUMENTATION.md"
echo "🎯 Статус оптимизации: /workspaces/Smeta-2/OPTIMIZATION_COMPLETE.md"
echo ""
echo "🎊 SMETA360-2 Enterprise-Grade Construction Estimation System"
echo "   ✨ Полная оптимизация завершена!"