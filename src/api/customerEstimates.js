// API функции для работы со сметами заказчика

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  // Проверяем переменную окружения
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Автоматическое определение для GitHub Codespaces
  const currentHost = window.location.hostname;
  if (currentHost.includes('.app.github.dev')) {
    // Используем прокси через Vite dev server
    return '/api-proxy';
  }

  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Получение токена из localStorage
const getAuthToken = () => {
  return localStorage.getItem('authToken');
};

// Базовая функция для API запросов
const apiRequest = async (url, options = {}) => {
  const token = getAuthToken();

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    }
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Произошла ошибка при выполнении запроса');
  }

  return data;
};

// Получение списка смет заказчика по проекту
export const getCustomerEstimatesByProject = async (projectId, options = {}) => {
  const { offset = 0, limit = 50, sort = 'created_at', order = 'desc' } = options;

  const params = new URLSearchParams({
    project_id: projectId,
    offset: offset.toString(),
    limit: limit.toString(),
    sort,
    order
  });

  return apiRequest(`/customer-estimates?${params}`);
};

// Получение конкретной сметы заказчика по ID
export const getCustomerEstimate = async (estimateId) => {
  return apiRequest(`/customer-estimates/${estimateId}`);
};

// Создание новой сметы заказчика
export const createCustomerEstimate = async (estimateData) => {
  return apiRequest('/customer-estimates', {
    method: 'POST',
    body: JSON.stringify(estimateData)
  });
};

// Обновление сметы заказчика
export const updateCustomerEstimate = async (estimateId, estimateData) => {
  return apiRequest(`/customer-estimates/${estimateId}`, {
    method: 'PUT',
    body: JSON.stringify(estimateData)
  });
};

// Удаление сметы заказчика
export const deleteCustomerEstimate = async (estimateId) => {
  return apiRequest(`/customer-estimates/${estimateId}`, {
    method: 'DELETE'
  });
};

// Получение элементов сметы (если они хранятся отдельно)
export const getCustomerEstimateItems = async (estimateId) => {
  return apiRequest(`/customer-estimates/${estimateId}/items`);
};

// Создание элемента сметы
export const createCustomerEstimateItem = async (estimateId, itemData) => {
  return apiRequest(`/customer-estimates/${estimateId}/items`, {
    method: 'POST',
    body: JSON.stringify(itemData)
  });
};

// Обновление элемента сметы
export const updateCustomerEstimateItem = async (estimateId, itemId, itemData) => {
  return apiRequest(`/customer-estimates/${estimateId}/items/${itemId}`, {
    method: 'PUT',
    body: JSON.stringify(itemData)
  });
};

// Удаление элемента сметы
export const deleteCustomerEstimateItem = async (estimateId, itemId) => {
  return apiRequest(`/customer-estimates/${estimateId}/items/${itemId}`, {
    method: 'DELETE'
  });
};
