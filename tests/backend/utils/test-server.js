import supertest from 'supertest';

// Базовый URL для API тестов
const API_BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';

// Создаем API клиент для тестов
export const api = supertest(API_BASE_URL);

// Тестовые учетные данные
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'admin@mantis.ru',
  password: process.env.TEST_USER_PASSWORD || 'password123',
  firstname: 'Test',
  lastname: 'User'
};

// Кэш для токена авторизации
let cachedToken = null;
let tokenExpiry = 0;

/**
 * Логин и получение JWT токена для API тестов
 */
export async function loginAndGetToken({ email, password } = TEST_USER) {
  // Используем кэшированный токен если он еще валиден
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  console.log('🔐 Авторизуемся для API тестов...');

  try {
    // Сначала попробуем зарегистрироваться (на случай если пользователя нет)
    try {
      await api.post('/api/auth/register').send({
        email: email,
        password: password,
        firstname: TEST_USER.firstname,
        lastname: TEST_USER.lastname
      });
      console.log('👤 Тестовый пользователь создан');
    } catch {
      // Игнорируем ошибку - возможно пользователь уже существует
    }

    // Логинимся
    const response = await api.post('/api/auth/login').send({ email, password }).expect(200);

    const token = response.body?.data?.token || response.body?.token || response.body?.accessToken;

    if (!token) {
      throw new Error('Токен не получен при авторизации');
    }

    // Кэшируем токен на 50 минут
    cachedToken = token;
    tokenExpiry = Date.now() + 50 * 60 * 1000;

    console.log('✅ Авторизация успешна');
    return token;
  } catch (error) {
    console.error('❌ Ошибка авторизации:', error);
    throw new Error('Не удалось получить токен авторизации для тестов');
  }
}

/**
 * Создание авторизованного запроса
 */
export async function authenticatedRequest(method, path) {
  const token = await loginAndGetToken();
  return api[method](path).set('Authorization', `Bearer ${token}`);
}

/**
 * Ожидание готовности сервера
 */
export async function waitForServer(url = `${API_BASE_URL}/api/health`, timeout = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await supertest(API_BASE_URL).get('/api/health');
      if (response.status === 200) {
        console.log('✅ Сервер готов');
        return;
      }
    } catch {
      // Игнорируем ошибки и продолжаем ждать
    }

    // Ждем 1 секунду перед следующей попыткой
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Сервер не ответил в течение ${timeout}ms`);
}

/**
 * Очистка тестовых данных
 */
export async function cleanup() {
  // Очищаем кэш токена
  cachedToken = null;
  tokenExpiry = 0;
}
