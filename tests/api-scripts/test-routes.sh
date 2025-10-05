#!/bin/bash

echo "🔍 Тестирование маршрутов SMETA360..."
echo "=================================="

# Массив URL для тестирования
urls=(
    "http://localhost:3000"
    "http://localhost:3000/login"
    "http://localhost:3000/app"
    "http://localhost:3000/app/directories/works"
    "http://localhost:3000/app/directories/materials"
    "http://localhost:3000/app/calculations/estimate"
    "http://localhost:3000/app/projects/create"
)

# Тестируем каждый URL
for url in "${urls[@]}"; do
    echo -n "Проверяем $url ... "
    if curl -s --head "$url" | grep "200 OK" > /dev/null; then
        echo "✅ OK"
    else
        echo "❌ Недоступен"
    fi
done

echo ""
echo "🎯 Результат: Основные маршруты проверены!"
echo "Откройте http://localhost:3000 в браузере для полной проверки."