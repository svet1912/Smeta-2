// assets
import { SettingOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';

// icons
const icons = {
  SettingOutlined,
  UserOutlined,
  TeamOutlined
};

// ==============================|| MENU ITEMS - ADMINISTRATION ||============================== //

const administration = {
  id: 'group-administration',
  title: 'Администрирование',
  type: 'group',
  children: [
    {
      id: 'administration',
      title: 'Управление системой',
      type: 'collapse',
      icon: icons.SettingOutlined,
      children: [
        {
          id: 'users-management',
          title: 'Пользователи и роли',
          type: 'item',
          url: '/app/admin/users',
          icon: icons.TeamOutlined
        }
      ]
    }
  ]
};

export default administration;