// assets
import { BookOutlined, ToolOutlined, BuildOutlined } from '@ant-design/icons';

// icons
const icons = {
  BookOutlined,
  ToolOutlined,
  BuildOutlined
};

// ==============================|| MENU ITEMS - СПРАВОЧНИКИ ||============================== //

const directories = {
  id: 'group-directories',
  title: 'Справочники',
  type: 'group',
  children: [
    {
      id: 'directories',
      title: 'Справочники',
      type: 'collapse',
      icon: icons.BookOutlined,
      children: [
        {
          id: 'works',
          title: 'Работы',
          type: 'item',
          url: '/directories/works',
          icon: icons.ToolOutlined
        },
        {
          id: 'materials',
          title: 'Материал',
          type: 'item',
          url: '/directories/materials',
          icon: icons.BuildOutlined
        }
      ]
    }
  ]
};

export default directories;
