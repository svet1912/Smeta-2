import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import useMediaQuery from '@mui/material/useMediaQuery';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';

// project imports
import Drawer from './Drawer';
import Header from './Header';
import Footer from './Footer';
import Loader from 'components/Loader';
import SubNavTabs from 'components/SubNavTabs';
import useScrollDirection from '../../hooks/useScrollDirection';

import { handlerDrawerOpen, useGetMenuMaster } from 'api/menu';

// ==============================|| MAIN LAYOUT ||============================== //

export default function DashboardLayout() {
  const { menuMasterLoading } = useGetMenuMaster();
  const downXL = useMediaQuery((theme) => theme.breakpoints.down('xl'));
  const location = useLocation();
  const navigate = useNavigate();
  const scrollDirection = useScrollDirection();
  const [activeSubTab, setActiveSubTab] = useState('editor');
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // set media wise responsive drawer
  useEffect(() => {
    handlerDrawerOpen(!downXL);
  }, [downXL]);

  // Управляем видимостью хедера на основе направления скролла
  useEffect(() => {
    if (scrollDirection === 'down') {
      setIsHeaderVisible(false);
    } else if (scrollDirection === 'up') {
      setIsHeaderVisible(true);
    }
  }, [scrollDirection]);

  // Синхронизируем активную вкладку с текущим маршрутом
  useEffect(() => {
    if (location.pathname.includes('/object-parameters')) {
      setActiveSubTab('object-parameters');
    } else if (location.pathname.includes('/customer-estimate')) {
      setActiveSubTab('customer-estimate');
    } else if (location.pathname.includes('/estimate')) {
      // Можем выбрать, какую вкладку показывать по умолчанию для /estimate
      // Пока оставим 'estimate-calculation' как основную для этой страницы
      setActiveSubTab('estimate-calculation');
    }
    // Можно добавить другие маршруты по мере необходимости
  }, [location.pathname]);

  // Определяем, нужно ли показывать подвкладки (только на страницах расчетов, исключая проекты)
  const showSubNavTabs = location.pathname.includes('/calculations/') && !location.pathname.includes('/projects/');

  const handleSubTabChange = (key) => {
    setActiveSubTab(key);

    // Логика навигации по подвкладкам
    switch (key) {
      case 'object-parameters':
        navigate('/calculations/object-parameters');
        break;
      case 'estimate-calculation':
        navigate('/calculations/estimate');
        break;
      case 'customer-estimate':
        navigate('/calculations/customer-estimate');
        break;
      case 'editor':
        navigate('/calculations/estimate');
        break;
      default:
        console.log('Selected tab:', key);
    }
  };

  if (menuMasterLoading) return <Loader />;

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      <Header />
      <Drawer />

      <Box component="main" sx={{ width: 'calc(100% - 260px)', flexGrow: 1, p: { xs: 2, sm: 3 } }}>
        <Toolbar
          sx={{
            mt: 'inherit',
            // Добавляем отступ только если хедер видим
            display: isHeaderVisible ? 'block' : 'none'
          }}
        />

        {/* Подвкладки для страниц расчетов и проектов */}
        {showSubNavTabs && <SubNavTabs activeKey={activeSubTab} onChange={handleSubTabChange} />}

        <Box
          sx={{
            ...{ px: { xs: 0, sm: 2 } },
            position: 'relative',
            minHeight: 'calc(100vh - 110px)',
            display: 'flex',
            flexDirection: 'column',
            paddingTop: showSubNavTabs ? '16px' : isHeaderVisible ? '0px' : '24px' // Компенсируем скрытый хедер
          }}
        >
          <Outlet />
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
