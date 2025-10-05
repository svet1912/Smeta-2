// API сервис для авторизации

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  // Проверяем переменную окружения
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // В GitHub Codespaces используем относительный URL или localhost
  const currentHost = window.location.hostname;
  if (currentHost.includes('.app.github.dev')) {
    // Пробуем использовать относительный путь через прокси VS Code
    return '/api-proxy';
  }

  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

const API_BASE_URL = `${getApiBaseUrl()}/auth`;

// Сохранение токена в localStorage
export const setAuthToken = (token) => {
  localStorage.setItem('authToken', token);
};

// Получение токена из localStorage
export const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Удаление токена из localStorage
export const removeAuthToken = () => {
  localStorage.removeItem('authToken');
};

// Проверка наличия токена
export const isAuthenticated = () => {
  return !!getAuthToken();
};

// Общая функция для выполнения запросов с обработкой ошибок
const apiRequest = async (url, options = {}) => {
  try {
    const token = getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();

    if (!response.ok) {
      // Если токен невалиден (401), удаляем его
      if (response.status === 401 && token) {
        console.warn('⚠️ Токен невалиден или истек, удаляем локально');
        removeAuthToken();
      }

      throw new Error(data.message || data.error || 'Произошла ошибка при выполнении запроса');
    }

    return data;
  } catch (error) {
    console.error('API запрос ошибка:', error);
    throw error;
  }
};

// Регистрация пользователя
export const registerUser = async (userData) => {
  const { firstname, lastname, email, company, password } = userData;

  const response = await apiRequest(`${API_BASE_URL}/register`, {
    method: 'POST',
    body: JSON.stringify({
      firstname,
      lastname,
      email,
      company,
      password
    })
  });

  // Backend возвращает токен в data.token, не в accessToken
  if (response.success && response.data && response.data.token) {
    setAuthToken(response.data.token);
  }

  return response;
};

// Авторизация пользователя
export const loginUser = async (credentials) => {
  const { email, password } = credentials;

  const response = await apiRequest(`${API_BASE_URL}/login`, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password
    })
  });

  // Backend возвращает токен в data.token, не в accessToken
  if (response.success && response.data && response.data.token) {
    setAuthToken(response.data.token);
  }

  return response;
};

// Выход из системы
export const logoutUser = async () => {
  try {
    await apiRequest(`${API_BASE_URL}/logout`, {
      method: 'POST'
    });
  } catch (error) {
    console.log('Ошибка при выходе:', error.message);
  } finally {
    // Всегда удаляем токен локально
    removeAuthToken();
  }
};

// Получение информации о текущем пользователе
export const getCurrentUser = async () => {
  return await apiRequest(`${API_BASE_URL}/me`, {
    method: 'GET'
  });
};

// Проверка валидности токена
export const validateToken = async () => {
  try {
    const token = getAuthToken();
    if (!token) {
      return false;
    }

    const response = await getCurrentUser();
    return response.success && response.user;
  } catch (error) {
    // НЕ удаляем токен при ошибках сети!
    // Токен будет удален автоматически при реальной 401 ошибке в apiRequest
    console.warn('⚠️ Ошибка проверки токена (возможно временная):', error.message);

    // Если токен есть, предполагаем что он валиден (оптимистичный подход)
    // Реальная валидация произойдет при первом API запросе
    return !!getAuthToken();
  }
};

// Обновление профиля пользователя
export const updateUserProfile = async (profileData) => {
  return await apiRequest(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
};
