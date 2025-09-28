import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Создаем экземпляр axios с базовой конфигурацией
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Интерсептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);

    // Если сервер недоступен, возвращаем статические данные
    if (error.code === 'ECONNREFUSED' || error.code === 'NETWORK_ERROR') {
      console.warn('🔄 Сервер недоступен, используем статические данные');
      return Promise.resolve({ data: [] });
    }

    return Promise.reject(error);
  }
);

// API функции

// Получение статистики
export const getStatistics = async () => {
  try {
    const response = await api.get('/statistics');
    return response.data;
  } catch (error) {
    // Возвращаем статические данные если API недоступен
    return [
      {
        id: 1,
        metric_name: 'Всего просмотров',
        metric_value: 442236,
        percentage: 59.3,
        extra_value: 35000,
        is_loss: false,
        color: 'primary'
      },
      {
        id: 2,
        metric_name: 'Всего пользователей',
        metric_value: 78250,
        percentage: 70.5,
        extra_value: 8900,
        is_loss: false,
        color: 'primary'
      },
      { id: 3, metric_name: 'Всего заказов', metric_value: 18800, percentage: 27.4, extra_value: 1943, is_loss: true, color: 'warning' },
      { id: 4, metric_name: 'Всего продаж', metric_value: 35078, percentage: 27.4, extra_value: 20395, is_loss: true, color: 'warning' }
    ];
  }
};

// Получение заказов
export const getOrders = async () => {
  try {
    const response = await api.get('/orders');
    return response.data;
  } catch (error) {
    // Возвращаем статические данные если API недоступен
    return [
      { id: 1, tracking_no: 84564564, product_name: 'Объектив камеры', quantity: 40, status: 2, amount: 40570.0, created_at: '2024-01-20' },
      { id: 2, tracking_no: 98764564, product_name: 'Ноутбук', quantity: 300, status: 0, amount: 180139.0, created_at: '2024-01-19' },
      {
        id: 3,
        tracking_no: 98756325,
        product_name: 'Мобильный телефон',
        quantity: 355,
        status: 1,
        amount: 90989.0,
        created_at: '2024-01-18'
      },
      { id: 4, tracking_no: 98652366, product_name: 'Телефон', quantity: 50, status: 1, amount: 10239.0, created_at: '2024-01-17' },
      {
        id: 5,
        tracking_no: 13286564,
        product_name: 'Компьютерные аксессуары',
        quantity: 100,
        status: 1,
        amount: 83348.0,
        created_at: '2024-01-16'
      }
    ];
  }
};

// Получение пользователей
export const getUsers = async () => {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    // Статические данные как fallback
    return [
      { id: 1, name: 'Иван Иванов', email: 'ivan@example.com', created_at: '2024-01-15' },
      { id: 2, name: 'Мария Петрова', email: 'maria@example.com', created_at: '2024-01-14' }
    ];
  }
};

// Получение материалов
export const getMaterials = async () => {
  try {
    const response = await api.get('/materials');
    return response.data;
  } catch (error) {
    // Возвращаем пустой массив если API недоступен
    return [];
  }
};

// Создание нового материала
export const createMaterial = async (materialData) => {
  try {
    const response = await api.post('/materials', materialData);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания материала:', error);
    throw error;
  }
};

// Обновление материала
export const updateMaterial = async (id, materialData) => {
  try {
    const response = await api.put(`/materials/${id}`, materialData);
    return response.data;
  } catch (error) {
    console.error('Ошибка обновления материала:', error);
    throw error;
  }
};

// Удаление материала
export const deleteMaterial = async (id) => {
  try {
    const response = await api.delete(`/materials/${id}`);
    return response.data;
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    throw error;
  }
};

// Создание нового пользователя
export const createUser = async (userData) => {
  try {
    const response = await api.post('/users', userData);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания пользователя:', error);
    throw error;
  }
};

// Создание нового заказа
export const createOrder = async (orderData) => {
  try {
    const response = await api.post('/orders', orderData);
    return response.data;
  } catch (error) {
    console.error('Ошибка создания заказа:', error);
    throw error;
  }
};

// Тестовый запрос
export const testConnection = async () => {
  try {
    const response = await api.get('/test');
    return response.data;
  } catch (error) {
    console.error('Ошибка тестового соединения:', error);
    return { status: 'error', message: 'Сервер недоступен' };
  }
};

export default api;
