import { RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { Suspense } from 'react';

// project imports
import router from 'routes';
import ThemeCustomization from 'themes';
import { AuthProvider } from 'contexts/AuthContext';
import ScrollTop from 'components/ScrollTop';

// Debug mode import
import DebugApp from './DebugApp';

// ==============================|| APP - THEME, ROUTER, LOCAL ||============================== //

export default function App() {
  // Временно включаем debug режим
  const isDebugMode = true; // Измените на true для отладки

  if (isDebugMode) {
    return <DebugApp />;
  }

  return (
    <div data-testid="app-root-ready">
      <HelmetProvider>
        <ThemeCustomization>
          <AuthProvider>
            <ScrollTop>
              <Suspense fallback={<div>Loading router...</div>}>
                <RouterProvider router={router} />
              </Suspense>
            </ScrollTop>
          </AuthProvider>
        </ThemeCustomization>
      </HelmetProvider>
    </div>
  );
}
