// API сервис для проектов

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  // Проверяем переменную окружения
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Автоматическое определение для GitHub Codespaces
  const currentHost = window.location.hostname;
  if (currentHost.includes('.app.github.dev')) {
    // Заменяем порт 3000 на 3001 в GitHub Codespaces URL
    return '/api-proxy';
    // Используем прокси через Vite dev server
  }

  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Получение токена из localStorage
const getAuthToken = () => {
  return localStorage.getItem('authToken');
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
      throw new Error(data.message || data.error || 'Произошла ошибка');
    }

    return { success: true, data };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Получение всех проектов пользователя
export const getProjects = async () => {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects`, {
      method: 'GET'
    });
    return response;
  } catch (error) {
    console.error('Ошибка получения проектов:', error);
    return { success: false, message: error.message };
  }
};

// Получение проекта по ID
export const getProject = async (id) => {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects/${id}`, {
      method: 'GET'
    });
    return response;
  } catch (error) {
    console.error('Ошибка получения проекта:', error);
    return { success: false, message: error.message };
  }
};

// Создание нового проекта
export const createProject = async (projectData) => {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects`, {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
    return response;
  } catch (error) {
    console.error('Ошибка создания проекта:', error);
    return { success: false, message: error.message };
  }
};

// Обновление проекта
export const updateProject = async (id, projectData) => {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData)
    });
    return response;
  } catch (error) {
    console.error('Ошибка обновления проекта:', error);
    return { success: false, message: error.message };
  }
};

// Удаление проекта
export const deleteProject = async (id) => {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE'
    });
    return response;
  } catch (error) {
    console.error('Ошибка удаления проекта:', error);
    return { success: false, message: error.message };
  }
};
