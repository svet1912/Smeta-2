// Компонент для ленивой загрузки тяжелых секций дашборда
import { useState, useEffect, Suspense, lazy } from 'react';
import { Typography, CircularProgress, Box } from 'utils/muiImports';

// Ленивые импорты тяжелых компонентов
const MonthlyBarChart = lazy(() => import('sections/dashboard/default/MonthlyBarChart'));
const ReportAreaChart = lazy(() => import('sections/dashboard/default/ReportAreaChart')); 
const UniqueVisitorCard = lazy(() => import('sections/dashboard/default/UniqueVisitorCard'));
const SaleReportCard = lazy(() => import('sections/dashboard/default/SaleReportCard'));
const OrdersTable = lazy(() => import('sections/dashboard/default/OrdersTable'));

// Компонент загрузки для чартов
const ChartLoader = () => (
  <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
    <CircularProgress size={24} />
    <Typography variant="body2" sx={{ ml: 2 }}>
      Загрузка графика...
    </Typography>
  </Box>
);

// Хук для отложенной загрузки компонентов при скролле
const useIntersectionObserver = (options = {}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetRef, setTargetRef] = useState(null);

  useEffect(() => {
    if (!targetRef) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(targetRef);

    return () => observer.disconnect();
  }, [targetRef, options]);

  return [setTargetRef, isVisible];
};

// Компонент для ленивой загрузки графика при появлении в области видимости
export const LazyChart = ({ children, minHeight = "200px" }) => {
  const [ref, isVisible] = useIntersectionObserver();
  
  return (
    <div ref={ref} style={{ minHeight }}>
      {isVisible ? (
        <Suspense fallback={<ChartLoader />}>
          {children}
        </Suspense>
      ) : (
        <ChartLoader />
      )}
    </div>
  );
};

// Экспорт ленивых компонентов для использования в дашборде
export const LazyMonthlyBarChart = () => (
  <LazyChart>
    <MonthlyBarChart />
  </LazyChart>
);

export const LazyReportAreaChart = () => (
  <LazyChart>
    <ReportAreaChart />
  </LazyChart>
);

export const LazyUniqueVisitorCard = () => (
  <LazyChart minHeight="300px">
    <UniqueVisitorCard />
  </LazyChart>
);

export const LazySaleReportCard = () => (
  <LazyChart minHeight="300px">
    <SaleReportCard />
  </LazyChart>
);

export const LazyOrdersTable = () => (
  <LazyChart minHeight="400px">
    <OrdersTable />
  </LazyChart>
);