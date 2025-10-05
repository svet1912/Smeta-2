/**
 * Performance Optimization Hooks
 * Хуки для оптимизации производительности React приложения
 */
import { useEffect, useCallback, useMemo, useRef } from 'react';

/**
 * Хук для debounce функций
 */
export const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);

  const debouncedCallback = useCallback(
    (...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
};

/**
 * Хук для throttling функций
 */
export const useThrottle = (callback, delay) => {
  const lastRun = useRef(Date.now());

  const throttledCallback = useCallback(
    (...args) => {
      if (Date.now() - lastRun.current >= delay) {
        callback(...args);
        lastRun.current = Date.now();
      }
    },
    [callback, delay]
  );

  return throttledCallback;
};

/**
 * Хук для оптимизации списков (виртуализация)
 */
export const useVirtualization = (items, itemHeight, containerHeight) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 1, items.length);

    return items.slice(startIndex, endIndex).map((item, index) => ({
      ...item,
      index: startIndex + index
    }));
  }, [items, itemHeight, containerHeight, scrollTop]);

  const totalHeight = items.length * itemHeight;
  const offsetY = Math.floor(scrollTop / itemHeight) * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    setScrollTop
  };
};

/**
 * Хук для предварительной загрузки ресурсов
 */
export const usePreloadResources = (resources) => {
  const [loadedResources, setLoadedResources] = useState(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const preloadPromises = resources.map((resource) => {
      return new Promise((resolve, reject) => {
        if (typeof resource === 'string') {
          // Предзагрузка изображений
          const img = new Image();
          img.onload = () => resolve(resource);
          img.onerror = () => reject(resource);
          img.src = resource;
        } else {
          // Предзагрузка модулей
          import(resource).then(() => resolve(resource)).catch(() => reject(resource));
        }
      });
    });

    Promise.allSettled(preloadPromises).then((results) => {
      const loaded = new Set();
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          loaded.add(resources[index]);
        }
      });
      setLoadedResources(loaded);
      setLoading(false);
    });
  }, [resources]);

  return { loadedResources, loading };
};

/**
 * Хук для оптимизации ре-рендеров
 */
export const useOptimizedCallback = (callback, deps) => {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useCallback((...args) => {
    return callbackRef.current(...args);
  }, deps);
};

/**
 * Хук для измерения производительности
 */
export const usePerformanceMonitor = (componentName) => {
  const renderStartTime = useRef(Date.now());
  const renderCount = useRef(0);

  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    renderCount.current += 1;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Performance] ${componentName}:`, {
        renderTime: `${renderTime}ms`,
        renderCount: renderCount.current
      });
    }

    renderStartTime.current = Date.now();
  });

  return {
    renderCount: renderCount.current
  };
};

/**
 * Хук для ленивой загрузки с Intersection Observer
 */
export const useLazyLoad = (options = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasLoaded) {
          setIsVisible(true);
          setHasLoaded(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, ...options }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [hasLoaded, options]);

  return [ref, isVisible];
};

/**
 * Хук для мемоизации дорогих вычислений
 */
export const useMemoizedValue = (computeFn, deps) => {
  return useMemo(() => {
    const startTime = Date.now();
    const result = computeFn();
    const computeTime = Date.now() - startTime;

    if (process.env.NODE_ENV === 'development' && computeTime > 16) {
      console.warn(`[Performance] Expensive computation took ${computeTime}ms`);
    }

    return result;
  }, deps);
};

export default {
  useDebounce,
  useThrottle,
  useVirtualization,
  usePreloadResources,
  useOptimizedCallback,
  usePerformanceMonitor,
  useLazyLoad,
  useMemoizedValue
};
