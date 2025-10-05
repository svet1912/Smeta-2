import { createBrowserRouter } from 'react-router-dom';

// project imports
import MainRoutes from './MainRoutes';
import LoginRoutes from './LoginRoutes';
import LandingRoutes from './LandingRoutes';

// ==============================|| ROUTING RENDER ||============================== //

const router = createBrowserRouter([LandingRoutes, LoginRoutes, MainRoutes], {
  basename: import.meta.env.VITE_APP_BASE_NAME || '/'
});

export default router;
