import { RouterProvider } from 'react-router-dom';

// project imports
import router from 'routes';
import ThemeCustomization from 'themes';
import { AuthProvider } from 'contexts/AuthContext';

import ScrollTop from 'components/ScrollTop';

// ==============================|| APP - THEME, ROUTER, LOCAL ||============================== //

export default function App() {
  return (
    <div data-testid="app-root-ready">
      <ThemeCustomization>
        <AuthProvider>
          <ScrollTop>
            <RouterProvider router={router} />
          </ScrollTop>
        </AuthProvider>
      </ThemeCustomization>
    </div>
  );
}
