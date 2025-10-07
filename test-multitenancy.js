#!/usr/bin/env node
// Тестовый скрипт для проверки multitenancy middleware

const http = require('http');

async function makeRequest(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function testMultitenancy() {
  console.log('🧪 Тестирование Multitenancy Middleware');
  console.log('=' .repeat(50));

  // Test 1: Запрос без токена
  console.log('\n1️⃣ Тест без JWT токена:');
  try {
    const response = await makeRequest('/api/test');
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Data: ${response.data}`);
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
  }

  // Test 2: Запрос с валидным JWT токеном (содержит tenantId)
  console.log('\n2️⃣ Тест с валидным JWT токеном:');
  const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjYsImVtYWlsIjoia2l5MDI2QHlhbmRleC5ydSIsImZpcnN0bmFtZSI6ItCY0LvRjNGPIiwibGFzdG5hbWUiOiLQmtGD0LfRjNC80LjQvSIsInJvbGUiOiJzdXBlcl9hZG1pbiIsInRlbmFudElkIjoiY2Q1ZmZiMGYtODYxNi00MjI3LWEwNTYtNGY3MjllZDY5MzNjIiwiaWF0IjoxNzU5ODMzMTg1LCJleHAiOjE3NTk5MTk1ODV9.i-G-s6UBvCrb0Dc8oiZXyioC0WKWL1oCsrCxIeWcQzA';
  
  try {
    const response = await makeRequest('/api/test', {
      'Authorization': `Bearer ${validToken}`
    });
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Data: ${response.data}`);
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
  }

  // Test 3: Health check (должен пропускаться)
  console.log('\n3️⃣ Тест Health Check (должен пропускаться):');
  try {
    const response = await makeRequest('/api/health', {
      'Authorization': `Bearer ${validToken}`
    });
    console.log(`   Status: ${response.statusCode}`);
    console.log(`   Data: ${response.data}`);
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`);
  }

  console.log('\n✅ Тестирование завершено');
  console.log('💡 Проверьте логи сервера для tenant middleware сообщений');
}

// Запуск тестов
testMultitenancy().catch(console.error);