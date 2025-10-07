#!/bin/bash
# Тест enhanced authentication

echo "🧪 Тестирование Enhanced Authentication System"
echo "=" | tr ' ' '=' | head -50

# 1. Логин и получение токенов
echo "1️⃣ Тест логина..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "auth-test@smeta360.com",
    "password": "testpass123"
  }')

echo "   Статус логина: $(echo "$LOGIN_RESPONSE" | jq -r '.success')"
echo "   Access token: $(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken != null')"
echo "   Refresh token: $(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken != null')"

# 2. Извлекаем токены
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.accessToken')
REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.data.refreshToken')

echo "   Access token (первые 30 символов): ${ACCESS_TOKEN:0:30}..."
echo "   Refresh token (первые 30 символов): ${REFRESH_TOKEN:0:30}..."

# 3. Тест refresh token
echo -e "\n2️⃣ Тест refresh token..."
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\": \"$REFRESH_TOKEN\"}")

echo "   Статус refresh: $(echo "$REFRESH_RESPONSE" | jq -r '.success')"
echo "   Новый access token: $(echo "$REFRESH_RESPONSE" | jq -r '.data.accessToken != null')"

# 4. Проверка access token
echo -e "\n3️⃣ Тест защищенного эндпоинта..."
NEW_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.data.accessToken')
AUTH_ME_RESPONSE=$(curl -s http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")

echo "   Статус /auth/me: $(echo "$AUTH_ME_RESPONSE" | jq -r '.success')"
echo "   Пользователь: $(echo "$AUTH_ME_RESPONSE" | jq -r '.data.user.email')"

# 5. Проверка сессий
echo -e "\n4️⃣ Тест управления сессиями..."
SESSIONS_RESPONSE=$(curl -s http://localhost:3001/api/auth/sessions \
  -H "Authorization: Bearer $NEW_ACCESS_TOKEN")

echo "   Статус sessions: $(echo "$SESSIONS_RESPONSE" | jq -r '.success')"
echo "   Количество сессий: $(echo "$SESSIONS_RESPONSE" | jq -r '.data.total')"

echo -e "\n✅ Enhanced Authentication тестирование завершено!"