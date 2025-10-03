import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Suspense, useState, useEffect } from 'react';

// project imports
import router from 'routes';
import ThemeCustomization from 'themes';
import { AuthProvider } from 'contexts/AuthContext';
import ScrollTop from 'components/ScrollTop';
import Preloader from 'components/Preloader';
import { usePreloadResources } from 'hooks/usePerformanceOptimization';

// ==============================|| OPTIMIZED APP ||============================== //

export default function AppOptimized() {
  const [isPreloading, setIsPreloading] = useState(true);
  const [showApp, setShowApp] = useState(false);

  // Ресурсы для предварительной загрузки
  const criticalResources = [
    // Критичные изображения
    '/assets/images/logo.svg',
    '/assets/images/hero-bg.jpg',
    // Критичные модули (ленивая загрузка)
    'sections/dashboard/default/MonthlyBarChart',
    'sections/dashboard/default/ReportAreaChart'
  ];

  const { loadedResources, loading } = usePreloadResources(criticalResources);

  useEffect(() => {
    // Минимальное время показа preloader для UX
    const minPreloadTime = 1500;
    const preloadStartTime = Date.now();

    const finishPreloading = () => {
      const elapsedTime = Date.now() - preloadStartTime;
      const remainingTime = Math.max(0, minPreloadTime - elapsedTime);

      setTimeout(() => {
        setIsPreloading(false);
        // Небольшая задержка для плавного перехода
        setTimeout(() => setShowApp(true), 100);
      }, remainingTime);
    };

    if (!loading) {
      finishPreloading();
    } else {
      // Максимальное время ожидания
      const maxWaitTime = 5000;
      setTimeout(finishPreloading, maxWaitTime);
    }
  }, [loading, loadedResources]);

  const handlePreloaderComplete = () => {
    setIsPreloading(false);
    setTimeout(() => setShowApp(true), 100);
  };

  if (isPreloading) {
    return <Preloader onComplete={handlePreloaderComplete} />;
  }

  if (!showApp) {
    return null;
  }

  return (
    <div data-testid="app-root-ready">
      <HelmetProvider>
        <ThemeCustomization>
          <AuthProvider>
            <ScrollTop>
              <Suspense fallback={
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100vh',
                  fontSize: '18px',
                  color: '#666'
                }}>
                  Загрузка приложения...
                </div>
              }>
                <RouterProvider router={router} />
              </Suspense>
            </ScrollTop>
          </AuthProvider>
        </ThemeCustomization>
      </HelmetProvider>
    </div>
  );
}
