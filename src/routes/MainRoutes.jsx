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
const CreateProjectWizard = Loadable(lazy(() => import('pages/projects/CreateProjectWizard')));
const ProjectStorage = Loadable(lazy(() => import('pages/projects/ProjectStorage')));
const ProjectDashboard = Loadable(lazy(() => import('pages/projects/ProjectDashboard')));

// render - calculations
const CustomerEstimatePage = Loadable(lazy(() => import('pages/calculations/customerEstimate')));

// render - admin pages
const UsersManagement = Loadable(lazy(() => import('pages/admin/UsersManagement')));

// render - 404
const NotFoundApp = Loadable(lazy(() => import('pages/NotFoundApp')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/app',
  element: <DashboardLayout />,
  children: [
    {
      path: '',
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
          path: 'create-wizard',
          element: <CreateProjectWizard />
        },
        {
          path: 'storage',
          element: <ProjectStorage />
        },
        {
          path: ':projectId',
          element: <ProjectDashboard />
        }
      ]
    },
    {
      path: 'calculations',
      children: [
        {
          path: 'customer-estimate',
          element: <CustomerEstimatePage />
        }
      ]
    },
    {
      path: 'admin',
      children: [
        {
          path: 'users',
          element: <UsersManagement />
        }
      ]
    },
    {
      path: '*',
      element: <NotFoundApp />
    }
  ]
};

export default MainRoutes;
