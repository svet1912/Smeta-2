import { lazy } from 'react';

// project imports
import Loadable from 'components/Loadable';

// Landing pages
const LandingPage = Loadable(lazy(() => import('pages/Landing')));
const NotFound = Loadable(lazy(() => import('pages/Landing/NotFound')));

// ==============================|| LANDING ROUTING ||============================== //

const LandingRoutes = {
  path: '/',
  children: [
    {
      path: '',
      element: <LandingPage />
    },
    {
      path: '*',
      element: <NotFound />
    }
  ]
};

export default LandingRoutes;
