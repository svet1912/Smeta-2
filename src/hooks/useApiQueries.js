// Оптимизированные хуки для API с React Query кэшированием
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStatistics, getOrders } from 'api/database';
import { QUERY_KEYS } from 'utils/queryClient';

// Хук для получения статистики с кэшированием
export const useStatistics = () => {
  return useQuery({
    queryKey: QUERY_KEYS.STATISTICS,
    queryFn: async () => {
      const data = await getStatistics();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 5, // 5 минут
    cacheTime: 1000 * 60 * 10, // 10 минут
    onError: (error) => {
      console.error('Ошибка загрузки статистики:', error);
    }
  });
};

// Хук для получения заказов с кэшированием
export const useOrders = () => {
  return useQuery({
    queryKey: QUERY_KEYS.ORDERS,
    queryFn: async () => {
      const data = await getOrders();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 1000 * 60 * 3, // 3 минуты (заказы обновляются чаще)
    cacheTime: 1000 * 60 * 8, // 8 минут
    onError: (error) => {
      console.error('Ошибка загрузки заказов:', error);
    }
  });
};

// Хук для инвалидации кэша при обновлении данных
export const useInvalidateQueries = () => {
  const queryClient = useQueryClient();

  return {
    invalidateStatistics: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STATISTICS }),
    invalidateOrders: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORDERS }),
    invalidateAll: () => queryClient.invalidateQueries()
  };
};

// Хук для предзагрузки данных
export const usePrefetchQueries = () => {
  const queryClient = useQueryClient();

  return {
    prefetchStatistics: () => {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.STATISTICS,
        queryFn: getStatistics,
        staleTime: 1000 * 60 * 5
      });
    },
    prefetchOrders: () => {
      queryClient.prefetchQuery({
        queryKey: QUERY_KEYS.ORDERS,
        queryFn: getOrders,
        staleTime: 1000 * 60 * 3
      });
    }
  };
};
