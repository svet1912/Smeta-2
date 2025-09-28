// API сервис для авторизации

const API_BASE_URL = 'http://localhost:3001/api/auth';

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
      throw new Error(data.message || 'Произошла ошибка при выполнении запроса');
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

  if (response.success && response.data.token) {
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

  if (response.success && response.data.token) {
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
    const response = await getCurrentUser();
    return response.success && response.data.user;
  } catch (error) {
    // Если токен невалиден, удаляем его
    removeAuthToken();
    return false;
  }
};

// Обновление профиля пользователя
export const updateUserProfile = async (profileData) => {
  return await apiRequest(`${API_BASE_URL}/profile`, {
    method: 'PUT',
    body: JSON.stringify(profileData)
  });
};
