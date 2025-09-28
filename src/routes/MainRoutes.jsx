import { lazy } from 'react';

// project imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';

// render- Dashboard
const DashboardDefault = Loadable(lazy(() => import('pages/dashboard/default')));

// render - database test (for development)
const DatabaseTest = Loadable(lazy(() => import('pages/extra-pages/database-test')));

// render - directories
const WorksPage = Loadable(lazy(() => import('pages/directories/works')));
const MaterialsPage = Loadable(lazy(() => import('pages/directories/materials')));

// render - projects
const CreateProject = Loadable(lazy(() => import('pages/projects/CreateProject')));
const ProjectStorage = Loadable(lazy(() => import('pages/projects/ProjectStorage')));

// render - calculations
const EstimateCalculationPage = Loadable(lazy(() => import('pages/calculations/estimate')));
const ObjectParametersPage = Loadable(lazy(() => import('pages/calculations/objectParameters')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  element: <DashboardLayout />,
  children: [
    {
      path: '/',
      element: <DashboardDefault />
    },
    {
      path: 'dashboard',
      children: [
        {
          path: 'default',
          element: <DashboardDefault />
        }
      ]
    },
    {
      path: 'database-test',
      element: <DatabaseTest />
    },
    {
      path: 'directories',
      children: [
        {
          path: 'works',
          element: <WorksPage />
        },
        {
          path: 'materials',
          element: <MaterialsPage />
        }
      ]
    },
    {
      path: 'projects',
      children: [
        {
          path: 'create',
          element: <CreateProject />
        },
        {
          path: 'storage',
          element: <ProjectStorage />
        }
      ]
    },
    {
      path: 'calculations',
      children: [
        {
          path: 'estimate',
          element: <EstimateCalculationPage />
        },
        {
          path: 'object-parameters',
          element: <ObjectParametersPage />
        }
      ]
    }
  ]
};

export default MainRoutes;
