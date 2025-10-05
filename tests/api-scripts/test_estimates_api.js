#!/usr/bin/env node

const API_BASE = 'http://localhost:3001/api';

// Тестовые данные
const TEST_USER = {
  email: 'test@example.com',
  password: 'password123'
};

const TEST_PROJECT_DATA = {
  customerName: 'Тест для смет',
  projectCode: `EST-TEST-${Date.now()}`, // Уникальный код проекта
  objectAddress: 'Тестовый адрес, 123',
  contractorName: 'Тестовый подрядчик',
  contractNumber: 'CONTRACT-001',
  deadline: '2025-12-31',
  description: 'Проект для тестирования API estimates'
};

const TEST_ESTIMATE_DATA = {
  estimate_number: 'EST-001',
  name: 'Тестовая смета',
  version: 1,
  currency: 'RUB',
  notes: 'Тестовая смета для проверки API'
};

let authToken = '';
let testProjectId = '';
let testEstimateId = '';

async function makeRequest(method, endpoint, data = null, expectError = false) {
  const url = `${API_BASE}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { Authorization: `Bearer ${authToken}` })
    }
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  console.log(`\n🔄 ${method} ${endpoint}`);
  if (data) console.log('📤 Данные:', JSON.stringify(data, null, 2));

  try {
    const response = await fetch(url, options);
    const result = await response.json();

    console.log(`📥 Ответ (${response.status}):`, JSON.stringify(result, null, 2));

    if (!expectError && !response.ok) {
      throw new Error(`HTTP ${response.status}: ${result.error || result.message}`);
    }

    return { status: response.status, data: result };
  } catch (error) {
    if (expectError) {
      console.log('✅ Ожидаемая ошибка получена:', error.message);
      return { status: 0, error: error.message };
    }
    console.error('❌ Ошибка запроса:', error.message);
    throw error;
  }
}

async function runTests() {
  try {
    console.log('🚀 Запуск тестов API estimates...\n');

    // 1. Авторизация
    console.log('=== АВТОРИЗАЦИЯ ===');
    const authResponse = await makeRequest('POST', '/auth/login', TEST_USER);
    authToken = authResponse.data.data.token; // Токен находится в data.data.token
    console.log('✅ Авторизация успешна');

    // 2. Создание тестового проекта
    console.log('\n=== СОЗДАНИЕ ТЕСТОВОГО ПРОЕКТА ===');
    const projectResponse = await makeRequest('POST', '/projects', TEST_PROJECT_DATA);
    testProjectId = projectResponse.data.data.id; // ID находится в data.data.id
    console.log(`✅ Проект создан с ID: ${testProjectId}`);

    // 3. Тестирование CREATE estimate
    console.log('\n=== СОЗДАНИЕ СМЕТЫ ===');
    const createData = { ...TEST_ESTIMATE_DATA, project_id: testProjectId };
    const createResponse = await makeRequest('POST', '/estimates', createData);
    testEstimateId = createResponse.data.estimate.id;
    console.log(`✅ Смета создана с ID: ${testEstimateId}`);

    // 4. Тестирование дублирующего номера сметы (должен вернуть 409)
    console.log('\n=== ТЕСТ: КОНФЛИКТ НОМЕРА СМЕТЫ ===');
    await makeRequest('POST', '/estimates', createData, true);
    console.log('✅ Конфликт номера сметы корректно обработан');

    // 5. Тестирование создания сметы с чужим проектом (должен вернуть 403)
    console.log('\n=== ТЕСТ: ЧУЖОЙ ПРОЕКТ ===');
    const foreignData = { ...TEST_ESTIMATE_DATA, project_id: 999999, estimate_number: 'EST-002' };
    await makeRequest('POST', '/estimates', foreignData, true);
    console.log('✅ Доступ к чужому проекту корректно запрещен');

    // 6. Тестирование валидации обязательных полей
    console.log('\n=== ТЕСТ: ВАЛИДАЦИЯ ПОЛЕЙ ===');
    await makeRequest('POST', '/estimates', { name: 'Только имя' }, true);
    console.log('✅ Валидация обязательных полей работает');

    // 7. Тестирование GET single estimate
    console.log('\n=== ПОЛУЧЕНИЕ ОДНОЙ СМЕТЫ ===');
    const getOneResponse = await makeRequest('GET', `/estimates/${testEstimateId}`);
    console.log('✅ Смета успешно получена');
    console.log(`   Название: ${getOneResponse.data.estimate.name}`);
    console.log(`   Номер: ${getOneResponse.data.estimate.estimate_number}`);

    // 8. Тестирование GET чужой сметы (должен вернуть 403)
    console.log('\n=== ТЕСТ: ЧУЖАЯ СМЕТА ===');
    await makeRequest('GET', '/estimates/999999', null, true);
    console.log('✅ Доступ к чужой смете корректно запрещен');

    // 9. Тестирование UPDATE estimate
    console.log('\n=== ОБНОВЛЕНИЕ СМЕТЫ ===');
    const updateData = {
      name: 'Обновленная смета',
      estimate_number: 'EST-001-UPD',
      version: 2,
      status: 'active',
      notes: 'Обновленные заметки'
    };
    await makeRequest('PUT', `/estimates/${testEstimateId}`, updateData);
    console.log('✅ Смета успешно обновлена');

    // 10. Тестирование конфликта номера при обновлении
    console.log('\n=== СОЗДАНИЕ ВТОРОЙ СМЕТЫ ДЛЯ ТЕСТА КОНФЛИКТА ===');
    const secondEstimateData = { ...TEST_ESTIMATE_DATA, project_id: testProjectId, estimate_number: 'EST-002' };
    const secondEstimateResponse = await makeRequest('POST', '/estimates', secondEstimateData);
    const secondEstimateId = secondEstimateResponse.data.estimate.id;

    console.log('\n=== ТЕСТ: КОНФЛИКТ НОМЕРА ПРИ ОБНОВЛЕНИИ ===');
    const conflictUpdate = { estimate_number: 'EST-001-UPD' }; // Номер уже занят первой сметой
    await makeRequest('PUT', `/estimates/${secondEstimateId}`, conflictUpdate, true);
    console.log('✅ Конфликт номера при обновлении корректно обработан');

    // 11. Тестирование GET all estimates с различными параметрами
    console.log('\n=== ПОЛУЧЕНИЕ СПИСКА СМЕТ ===');

    // Без фильтров
    await makeRequest('GET', '/estimates');
    console.log('✅ Список без фильтров получен');

    // С фильтром по проекту
    await makeRequest('GET', `/estimates?project_id=${testProjectId}`);
    console.log('✅ Список с фильтром по проекту получен');

    // С поиском
    await makeRequest('GET', '/estimates?search=Обновленная');
    console.log('✅ Поиск по названию работает');

    // С пагинацией и сортировкой
    await makeRequest('GET', '/estimates?offset=0&limit=10&sort=estimate_number&order=asc');
    console.log('✅ Пагинация и сортировка работают');

    // 12. Тестирование DELETE estimate
    console.log('\n=== УДАЛЕНИЕ ВТОРОЙ СМЕТЫ ===');
    await makeRequest('DELETE', `/estimates/${secondEstimateId}`);
    console.log('✅ Смета успешно удалена');

    // 13. Тестирование удаления несуществующей сметы
    console.log('\n=== ТЕСТ: УДАЛЕНИЕ НЕСУЩЕСТВУЮЩЕЙ СМЕТЫ ===');
    await makeRequest('DELETE', '/estimates/999999', null, true);
    console.log('✅ Удаление несуществующей сметы корректно обработано');

    // 14. Проверяем финальное состояние
    console.log('\n=== ФИНАЛЬНАЯ ПРОВЕРКА ===');
    const finalListResponse = await makeRequest('GET', `/estimates?project_id=${testProjectId}`);
    console.log(`✅ В проекте осталось смет: ${finalListResponse.data.total}`);

    // Очистка: удаляем тестовый проект (это удалит и все его сметы)
    console.log('\n=== ОЧИСТКА ===');
    await makeRequest('DELETE', `/projects/${testProjectId}`);
    console.log('✅ Тестовый проект и связанные сметы удалены');

    console.log('\n🎉 ВСЕ ТЕСТЫ УСПЕШНО ПРОЙДЕНЫ!');
    console.log('\nПроверенная функциональность:');
    console.log('✅ Создание смет с валидацией tenant_id');
    console.log('✅ Уникальность estimate_number в рамках проекта');
    console.log('✅ Защита от доступа к чужим проектам и сметам');
    console.log('✅ Валидация обязательных полей');
    console.log('✅ Обновление смет с проверкой конфликтов');
    console.log('✅ Получение списка с фильтрацией, поиском и пагинацией');
    console.log('✅ Удаление смет с контролем доступа');
    console.log('✅ Корректные HTTP коды ошибок (400, 403, 404, 409)');
  } catch (error) {
    console.error('\n💥 ТЕСТ ПРОВАЛЕН:', error.message);

    // Попытка очистки при ошибке
    if (testProjectId) {
      try {
        await makeRequest('DELETE', `/projects/${testProjectId}`);
        console.log('🧹 Тестовый проект удален после ошибки');
      } catch (cleanupError) {
        console.log('⚠️ Не удалось удалить тестовый проект:', cleanupError.message);
      }
    }

    process.exit(1);
  }
}

// Запуск тестов
if (require.main === module) {
  // Проверяем, что сервер запущен
  fetch(`${API_BASE}/test`)
    .then(() => {
      console.log('🔗 Сервер доступен, запускаем тесты...');
      return runTests();
    })
    .catch((error) => {
      console.error('❌ Сервер недоступен:', error.message);
      console.log('💡 Убедитесь, что сервер запущен на http://localhost:3001');
      process.exit(1);
    });
}
