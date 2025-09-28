import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Box, Modal, Fade, Backdrop } from '@mui/material';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';

// project imports
import EditProfileTab from './tabs/EditProfileTab';
import ViewProfileTab from './tabs/ViewProfileTab';
import SocialProfileTab from './tabs/SocialProfileTab';
import BillingTab from './tabs/BillingTab';
import { logoutUser } from 'api/auth';
import { useAuth } from 'contexts/AuthContext';

// assets
import EditOutlined from '@ant-design/icons/EditOutlined';
import ProfileOutlined from '@ant-design/icons/ProfileOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import WalletOutlined from '@ant-design/icons/WalletOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';

// ==============================|| HEADER PROFILE - PROFILE TAB ||============================== //

export default function ProfileTab() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [openModal, setOpenModal] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  
  const handleLogout = async () => {
    try {
      // Вызываем API logout для очистки сессии на сервере
      await logoutUser();
      // Очищаем контекст
      logout();
      // Перенаправляем на страницу входа
      navigate('/login');
    } catch (error) {
      console.error('Ошибка при выходе:', error);
      // Даже при ошибке API очищаем контекст и перенаправляем
      logout();
      navigate('/login');
    }
  };
  
  const handleListItemClick = (event, index) => {
    setSelectedIndex(index);
    
    // Handle different actions based on index
    switch (index) {
      case 0: // Edit Profile
        setModalContent(<EditProfileTab />);
        setOpenModal(true);
        break;
      case 1: // View Profile
        setModalContent(<ViewProfileTab />);
        setOpenModal(true);
        break;
      case 3: // Social Profile
        setModalContent(<SocialProfileTab />);
        setOpenModal(true);
        break;
      case 4: // Billing
        setModalContent(<BillingTab />);
        setOpenModal(true);
        break;
      case 2: // Logout
        handleLogout();
        break;
      default:
        break;
    }
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setModalContent(null);
    setSelectedIndex(0);
  };

  const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '90vw',
    maxWidth: 1200,
    maxHeight: '90vh',
    bgcolor: 'background.paper',
    boxShadow: 24,
    borderRadius: 2,
    outline: 0,
    overflow: 'auto'
  };

  return (
    <>
      <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
        <ListItemButton selected={selectedIndex === 0} onClick={(event) => handleListItemClick(event, 0)}>
          <ListItemIcon>
            <EditOutlined />
          </ListItemIcon>
          <ListItemText primary="Редактировать профиль" />
        </ListItemButton>
        <ListItemButton selected={selectedIndex === 1} onClick={(event) => handleListItemClick(event, 1)}>
          <ListItemIcon>
            <UserOutlined />
          </ListItemIcon>
          <ListItemText primary="Просмотр профиля" />
        </ListItemButton>
        <ListItemButton selected={selectedIndex === 3} onClick={(event) => handleListItemClick(event, 3)}>
          <ListItemIcon>
            <ProfileOutlined />
          </ListItemIcon>
          <ListItemText primary="Социальный профиль" />
        </ListItemButton>
        <ListItemButton selected={selectedIndex === 4} onClick={(event) => handleListItemClick(event, 4)}>
          <ListItemIcon>
            <WalletOutlined />
          </ListItemIcon>
          <ListItemText primary="Биллинг" />
        </ListItemButton>
        <ListItemButton selected={selectedIndex === 2} onClick={(event) => handleListItemClick(event, 2)}>
          <ListItemIcon>
            <LogoutOutlined />
          </ListItemIcon>
          <ListItemText primary="Выход" />
        </ListItemButton>
      </List>

      {/* Modal for profile tabs */}
      <Modal
        open={openModal}
        onClose={handleCloseModal}
        closeAfterTransition
        BackdropComponent={Backdrop}
        BackdropProps={{
          timeout: 500,
        }}
      >
        <Fade in={openModal}>
          <Box sx={modalStyle}>
            <Box sx={{ 
              position: 'sticky', 
              top: 0, 
              bgcolor: 'background.paper', 
              borderBottom: 1, 
              borderColor: 'divider',
              p: 2,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              zIndex: 1
            }}>
              <Box sx={{ 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                p: 1,
                borderRadius: 1,
                '&:hover': { bgcolor: 'action.hover' }
              }} onClick={handleCloseModal}>
                <CloseOutlined />
              </Box>
            </Box>
            {modalContent}
          </Box>
        </Fade>
      </Modal>
    </>
  );
}