// assets
import { ProjectOutlined, PlusOutlined, FolderOutlined } from '@ant-design/icons';

// icons
const icons = {
  ProjectOutlined,
  PlusOutlined,
  FolderOutlined
};

// ==============================|| MENU ITEMS - PROJECTS ||============================== //

const projects = {
  id: 'group-projects',
  title: 'Проекты',
  type: 'group',
  children: [
    {
      id: 'projects',
      title: 'Управление проектами',
      type: 'collapse',
      icon: icons.ProjectOutlined,
      children: [
        {
          id: 'create-project',
          title: 'Создать проект',
          type: 'item',
          url: '/projects/create',
          icon: icons.PlusOutlined,
          breadcrumbs: false
        },
        {
          id: 'projects-storage',
          title: 'Хранилище проектов',
          type: 'item',
          url: '/projects/storage',
          icon: icons.FolderOutlined,
          breadcrumbs: false
        }
      ]
    }
  ]
};

export default projects;
