// assets
import { ProjectOutlined } from '@ant-design/icons';

// icons
const icons = {
  ProjectOutlined
};

// ==============================|| MENU ITEMS - PROJECTS ||============================== //

const projects = {
  id: 'group-projects',
  title: 'Проекты',
  type: 'group',
  children: [
    {
      id: 'projects-storage',
      title: 'Проекты',
      type: 'item',
      url: '/app/projects/storage',
      icon: icons.ProjectOutlined,
      breadcrumbs: false
    }
  ]
};

export default projects;
