// project import
import dashboard from './dashboard';
import projects from './projects';
import pages from './page';
import utilities from './utilities';
import directories from './directories';
import calculations from './calculations';
// import profile from './profile'; // Временно отключено - пустые компоненты
import support from './support';

// ==============================|| MENU ITEMS ||============================== //

const menuItems = {
  items: [dashboard, projects, directories, calculations, pages, utilities, support]
};

export default menuItems;
