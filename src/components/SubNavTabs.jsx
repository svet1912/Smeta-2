import React from 'react';
import { Tabs } from 'antd';
import { 
  EditOutlined,
  BarChartOutlined,
  FileTextOutlined,
  CreditCardOutlined,
  ShoppingOutlined,
  ToolOutlined,
  FolderOutlined 
} from '@ant-design/icons';
import './SubNavTabs.css';

const SubNavTabs = ({ activeKey, onChange }) => {
  const items = [
    {
      key: 'editor',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <EditOutlined />
          Редактор сметы
        </span>
      ),
    },
    {
      key: 'chart',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <BarChartOutlined />
          График
        </span>
      ),
    },
    {
      key: 'customer-estimate',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <FileTextOutlined />
          Смета заказчика
        </span>
      ),
    },
    {
      key: 'customer-payments',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <CreditCardOutlined />
          Платежи заказчика
        </span>
      ),
    },
    {
      key: 'purchases',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <ShoppingOutlined />
          Закупки
        </span>
      ),
    },
    {
      key: 'works',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <ToolOutlined />
          Работы
        </span>
      ),
    },
    {
      key: 'documents',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'inherit' }}>
          <FolderOutlined />
          Документы
        </span>
      ),
    },
  ];

  return (
    <div className="sub-nav-tabs">
      <div style={{ padding: '0 24px' }}>
        <Tabs
          activeKey={activeKey}
          onChange={onChange}
          type="line"
          size="middle"
          items={items}
        />
      </div>
    </div>
  );
};

export default SubNavTabs;