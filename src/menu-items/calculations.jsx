// assets
import { CalculatorOutlined, HomeOutlined } from '@ant-design/icons';

// icons
const icons = {
  CalculatorOutlined,
  HomeOutlined
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
          url: '/app/calculations/estimate',
          icon: icons.CalculatorOutlined
        },
        {
          id: 'object-parameters',
          title: 'Параметры объекта',
          type: 'item',
          url: '/app/calculations/object-parameters',
          icon: icons.HomeOutlined
        }
      ]
    }
  ]
};

export default calculations;
