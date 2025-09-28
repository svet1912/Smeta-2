// assets
import { CalculatorOutlined } from '@ant-design/icons';

// icons
const icons = {
  CalculatorOutlined
};

// ==============================|| MENU ITEMS - РАСЧЕТ ||============================== //

const calculations = {
  id: 'group-calculations',
  title: 'Расчет',
  type: 'group',
  children: [
    {
      id: 'calculations',
      title: 'Расчет',
      type: 'collapse',
      icon: icons.CalculatorOutlined,
      children: [
        {
          id: 'estimate-calculation',
          title: 'Расчет сметы',
          type: 'item',
          url: '/calculations/estimate',
          icon: icons.CalculatorOutlined
        }
      ]
    }
  ]
};

export default calculations;
