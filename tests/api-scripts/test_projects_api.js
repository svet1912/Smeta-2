import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001/api';

// Тестовый токен - замените на реальный из системы аутентификации
const TEST_JWT_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';

async function testProjectsAPI() {
  console.log('🧪 ТЕСТИРОВАНИЕ PROJECTS API (ЦЕЛЕВАЯ МОДЕЛЬ)');
  console.log('🎯 Проверка всех эндпоинтов с tenant_id логикой\n');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TEST_JWT_TOKEN}`
  };

  try {
    // 1. Тест GET /api/projects (список с пагинацией)
    console.log('📋 ТЕСТ 1: GET /api/projects');
    const listResponse = await fetch(`${BASE_URL}/projects?limit=5&offset=0&search=test&sort=created_at&order=desc`, {
      method: 'GET',
      headers
    });

    console.log(`   Статус: ${listResponse.status}`);
    const listData = await listResponse.text();
    console.log(`   Ответ: ${listData.substring(0, 200)}...`);
    console.log('');

    // 2. Тест POST /api/projects (создание)
    console.log('📝 ТЕСТ 2: POST /api/projects');
    const createPayload = {
      customerName: 'Тестовый Клиент API',
      objectAddress: 'ул. Тестовая, 123',
      contractorName: 'ООО Тестстрой',
      contractNumber: 'TEST-API-2025',
      deadline: '2025-12-31',
      projectCode: 'PRJ-API-TEST'
    };

    const createResponse = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload)
    });

    console.log(`   Статус: ${createResponse.status}`);
    const createData = await createResponse.text();
    console.log(`   Ответ: ${createData.substring(0, 300)}...`);
    console.log('');

    // Если проект создался, получим его ID для дальнейших тестов
    let projectId = null;
    if (createResponse.status === 201) {
      try {
        const createJson = JSON.parse(createData);
        projectId = createJson.data?.id;
        console.log(`   ✅ Проект создан с ID: ${projectId}`);
      } catch {
        console.log('   ⚠️ Не удалось извлечь ID проекта');
      }
    }

    // 3. Тест GET /api/projects/:id (получение конкретного проекта)
    if (projectId) {
      console.log('🔍 ТЕСТ 3: GET /api/projects/:id');
      const getResponse = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: 'GET',
        headers
      });

      console.log(`   Статус: ${getResponse.status}`);
      const getData = await getResponse.text();
      console.log(`   Ответ: ${getData.substring(0, 300)}...`);
      console.log('');

      // 4. Тест PUT /api/projects/:id (обновление)
      console.log('✏️ ТЕСТ 4: PUT /api/projects/:id');
      const updatePayload = {
        customerName: 'Обновленный Клиент API',
        status: 'active',
        projectCode: 'PRJ-API-UPD'
      };

      const updateResponse = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updatePayload)
      });

      console.log(`   Статус: ${updateResponse.status}`);
      const updateData = await updateResponse.text();
      console.log(`   Ответ: ${updateData.substring(0, 300)}...`);
      console.log('');

      // 5. Тест DELETE /api/projects/:id (удаление)
      console.log('🗑️ ТЕСТ 5: DELETE /api/projects/:id');
      const deleteResponse = await fetch(`${BASE_URL}/projects/${projectId}`, {
        method: 'DELETE',
        headers
      });

      console.log(`   Статус: ${deleteResponse.status}`);
      const deleteData = await deleteResponse.text();
      console.log(`   Ответ: ${deleteData.substring(0, 200)}...`);
      console.log('');
    } else {
      console.log('⚠️ ТЕСТЫ 3-5 пропущены - не удалось создать проект');
    }

    // 6. Тест дублирования projectCode (409 ошибка)
    console.log('🔄 ТЕСТ 6: Дублирование projectCode');
    const duplicatePayload = {
      customerName: 'Дубликат Клиент',
      objectAddress: 'ул. Дубликат, 1',
      contractorName: 'ООО Дубликат',
      contractNumber: 'DUP-001',
      deadline: '2025-11-30',
      projectCode: 'PRJ-API-TEST' // тот же код
    };

    const duplicateResponse = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(duplicatePayload)
    });

    console.log(`   Статус: ${duplicateResponse.status}`);
    const duplicateData = await duplicateResponse.text();
    console.log(`   Ответ: ${duplicateData.substring(0, 200)}...`);
    console.log('');

    // 7. Тест доступа к чужому проекту (403 ошибка)
    console.log('🚫 ТЕСТ 7: Доступ к чужому проекту');
    const foreignResponse = await fetch(`${BASE_URL}/projects/999999`, {
      method: 'GET',
      headers
    });

    console.log(`   Статус: ${foreignResponse.status}`);
    const foreignData = await foreignResponse.text();
    console.log(`   Ответ: ${foreignData.substring(0, 200)}...`);
    console.log('');

    // 8. Тест валидации полей (400 ошибка)
    console.log('❌ ТЕСТ 8: Валидация полей');
    const invalidPayload = {
      customerName: '',
      objectAddress: 'адрес'
      // отсутствуют обязательные поля
    };

    const invalidResponse = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers,
      body: JSON.stringify(invalidPayload)
    });

    console.log(`   Статус: ${invalidResponse.status}`);
    const invalidData = await invalidResponse.text();
    console.log(`   Ответ: ${invalidData.substring(0, 200)}...`);
    console.log('');

    console.log('🎉 ТЕСТИРОВАНИЕ ЗАВЕРШЕНО!');
    console.log('💡 Проверьте статусы ответов:');
    console.log('   • GET /projects - должен быть 200 или 401 (нет токена)');
    console.log('   • POST /projects - должен быть 201 или 401 (нет токена)');
    console.log('   • Дублирование - должен быть 409 (PROJECT_CODE_CONFLICT)');
    console.log('   • Чужой проект - должен быть 403 (FOREIGN_TENANT) или 404');
    console.log('   • Валидация - должен быть 400 (MISSING_REQUIRED_FIELDS)');
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error.message);
  }
}

// Запускаем тесты
testProjectsAPI().catch(console.error);
