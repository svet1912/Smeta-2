#!/bin/bash

echo "🧪 Step 3: Customer-estimates API Test"

# Получаем новый JWT токен
echo "1️⃣ Получение JWT токена..."
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}')

TOKEN=$(echo $TOKEN_RESPONSE | jq -r '.data.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Ошибка получения токена"
    echo "$TOKEN_RESPONSE"
    exit 1
fi

echo "✅ Токен получен: ${TOKEN:0:50}..."

echo ""
echo "2️⃣ Тестируем GET /api/customer-estimates (должен быть пустой список)..."
curl -X GET "http://localhost:3001/api/customer-estimates" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" | jq

echo ""
echo "3️⃣ Создаем customer estimate..."
ESTIMATE_RESPONSE=$(curl -s -X POST http://localhost:3001/api/customer-estimates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "project_id": 45,
    "customer_name": "ООО Тестовый Заказчик",
    "estimate_name": "Смета для заказчика №1",
    "description": "Детализированная смета для клиента",
    "status": "draft"
  }')

echo $ESTIMATE_RESPONSE | jq

ESTIMATE_ID=$(echo $ESTIMATE_RESPONSE | jq -r '.estimate.id // empty')

if [ -n "$ESTIMATE_ID" ]; then
    echo ""
    echo "4️⃣ Получаем созданную смету по ID: $ESTIMATE_ID"
    curl -X GET "http://localhost:3001/api/customer-estimates/$ESTIMATE_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" | jq
    
    echo ""  
    echo "5️⃣ Обновляем смету..."
    curl -X PUT "http://localhost:3001/api/customer-estimates/$ESTIMATE_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "customer_name": "ООО Обновленный Заказчик",
        "estimate_name": "Обновленная смета для заказчика",
        "description": "Обновленное описание",
        "status": "sent"
      }' | jq

    echo ""
    echo "6️⃣ Удаляем смету..."
    curl -X DELETE "http://localhost:3001/api/customer-estimates/$ESTIMATE_ID" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" | jq
else
    echo "❌ Смета не была создана"
fi

echo ""
echo "🎯 Тестирование завершено!"