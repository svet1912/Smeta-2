// assets
import { UserOutlined, SettingOutlined, EditOutlined } from '@ant-design/icons';

// icons
const icons = {
  UserOutlined,
  SettingOutlined,
  EditOutlined
};

// ==============================|| MENU ITEMS - PROFILE ||============================== //

const profile = {
  id: 'group-profile',
  title: 'Профиль',
  type: 'group',
  children: [
    {
      id: 'profile',
      title: 'Профиль пользователя',
      type: 'collapse',
      icon: icons.UserOutlined,
      children: [
        {
          id: 'profile-overview',
          title: 'Обзор профиля',
          type: 'item',
          url: '/app/profile',
          icon: icons.UserOutlined
        },
        {
          id: 'profile-edit',
          title: 'Редактировать',
          type: 'item',
          url: '/app/profile/edit',
          icon: icons.EditOutlined
        },
        {
          id: 'profile-settings',
          title: 'Настройки',
          type: 'item',
          url: '/app/profile/settings',
          icon: icons.SettingOutlined
        }
      ]
    }
  ]
};

export default profile;
