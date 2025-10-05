// Конфигурация React Query для клиентского кэширования
import { QueryClient } from '@tanstack/react-query';

// Создаем клиент с оптимизированными настройками кэширования
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Кэшируем данные на 5 минут
      staleTime: 1000 * 60 * 5,
      // Данные считаются свежими 10 минут
      cacheTime: 1000 * 60 * 10,
      // Не перезапрашиваем данные при фокусе окна
      refetchOnWindowFocus: false,
      // Не перезапрашиваем при переподключении
      refetchOnReconnect: false,
      // Повторяем запрос только 1 раз при ошибке
      retry: 1,
      // Показываем кэшированные данные пока загружаются новые
      keepPreviousData: true
    },
    mutations: {
      // При ошибке мутации не повторяем
      retry: false
    }
  }
});

// Хуки для работы с кэшированными данными
export const QUERY_KEYS = {
  STATISTICS: ['statistics'],
  ORDERS: ['orders'],
  MATERIALS: ['materials'],
  WORKS: ['works'],
  PROJECTS: ['projects'],
  USER_PROFILE: ['user', 'profile']
};
