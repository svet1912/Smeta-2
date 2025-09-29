import { useState, useEffect, useMemo, useCallback } from 'react';
import MainCard from 'components/MainCard';
import {
  Typography,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Divider,
  Tooltip,
  Popconfirm,
  Badge,
  Image
} from 'antd';
import { PlusOutlined, MinusOutlined, CalculatorOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, DownloadOutlined, SaveOutlined, PercentageOutlined, ReloadOutlined } from '@ant-design/icons';
import { workMaterialsApi } from 'api/workMaterials';

const { Title, Text } = Typography;
const { Option } = Select;

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  // Проверяем переменную окружения
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // Автоматическое определение для GitHub Codespaces
  const currentHost = window.location.hostname;
  if (currentHost.includes('.app.github.dev')) {
    // Заменяем порт 3000 на 3001 в GitHub Codespaces URL
    return "/api-proxy";
    // Используем прокси через Vite dev server
  }
  
  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Функция для форматирования чисел с запятой (российский стандарт)
const formatNumberWithComma = (number) => {
  if (number === null || number === undefined || isNaN(number)) return '-';
  return parseFloat(number).toFixed(2).replace('.', ',');
};

// Функция для парсинга чисел с запятой в точку
const parseNumberWithComma = (value) => {
  if (typeof value === 'string') {
    return parseFloat(value.replace(',', '.'));
  }
  return parseFloat(value) || 0;
};

// ==============================|| СМЕТА ЗАКАЗЧИКА ||============================== //

export default function CustomerEstimatePage() {
  const [works, setWorks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [estimateItems, setEstimateItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [expandedWorks, setExpandedWorks] = useState(new Set());

  // Состояния для управления материалами
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [materialAction, setMaterialAction] = useState('add');
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [selectedMaterialToReplace, setSelectedMaterialToReplace] = useState(null);
  const [materialForm] = Form.useForm();

  // Состояния для применения коэффициентов
  const [coefficientModalVisible, setCoefficientModalVisible] = useState(false);
  const [coefficientForm] = Form.useForm();

  // Загрузка данных
  useEffect(() => {
    loadWorks();
    loadMaterials();
    loadCustomerEstimate();
  }, []);

  // Загрузка сметы заказчика из localStorage
  const loadCustomerEstimate = () => {
    try {
      const savedData = localStorage.getItem('customerEstimate');
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        // Добавляем original_unit_price для существующих позиций, если его нет
        const itemsWithOriginalPrices = parsedData.map(item => ({
          ...item,
          original_unit_price: item.original_unit_price || item.unit_price
        }));
        setEstimateItems(itemsWithOriginalPrices);
      }
    } catch (error) {
      console.error('Ошибка загрузки сметы заказчика:', error);
    }
  };

  // Сохранение сметы заказчика в localStorage
  const saveCustomerEstimate = (items) => {
    try {
      localStorage.setItem('customerEstimate', JSON.stringify(items));
    } catch (error) {
      console.error('Ошибка сохранения сметы заказчика:', error);
    }
  };

  const loadWorks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/works`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setWorks(data);
        } else {
          setWorks([]);
        }
      } else {
        message.error('Ошибка загрузки работ');
        setWorks([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки работ:', error);
      message.error('Ошибка соединения при загрузке работ');
      setWorks([]);
    }
  };

  const loadMaterials = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/materials`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMaterials(data);
        } else {
          setMaterials([]);
        }
      } else {
        message.error('Ошибка загрузки материалов');
        setMaterials([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
      message.error('Ошибка соединения при загрузке материалов');
      setMaterials([]);
    }
  };

  // Статистика
  const stats = useMemo(() => {
    const workItems = estimateItems.filter(item => item.type === 'work');
    const materialItems = estimateItems.filter(item => item.type === 'material');
    
    const worksAmount = workItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const materialsAmount = materialItems.reduce((sum, item) => sum + (item.total || 0), 0);
    
    return {
      totalWorks: workItems.length,
      totalMaterials: materialItems.length,
      worksAmount,
      materialsAmount,
      totalAmount: worksAmount + materialsAmount
    };
  }, [estimateItems]);

  // Функция добавления работы
  const handleAddWork = () => {
    setSelectedItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  // Функция редактирования позиции
  const handleEditItem = (item) => {
    setSelectedItem(item);
    form.setFieldsValue({
      ...item,
      unit_price: item.unit_price || 0,
      quantity: item.quantity || 1
    });
    setModalVisible(true);
  };

  // Функция удаления позиции
  const handleDeleteItem = (itemId) => {
    const newItems = estimateItems.filter(item => item.item_id !== itemId);
    setEstimateItems(newItems);
    saveCustomerEstimate(newItems);
    message.success('Позиция удалена');
  };

  // Функция сохранения позиции
  const handleSaveItem = async () => {
    try {
      const values = await form.validateFields();
      
      if (selectedItem) {
        // Редактирование существующей позиции
        const updatedItems = estimateItems.map(item => 
          item.item_id === selectedItem.item_id 
            ? {
                ...item,
                ...values,
                total: (values.quantity || 1) * (values.unit_price || 0),
                // Сохраняем оригинальную цену, если она еще не сохранена
                original_unit_price: item.original_unit_price || item.unit_price
              }
            : item
        );
        setEstimateItems(updatedItems);
        saveCustomerEstimate(updatedItems);
        message.success('Позиция обновлена');
      } else {
        // Добавление новой позиции
        const newItem = {
          item_id: Date.now().toString(),
          type: 'work',
          ...values,
          total: (values.quantity || 1) * (values.unit_price || 0),
          isWork: true,
          // Сохраняем оригинальную цену при создании
          original_unit_price: values.unit_price || 0
        };
        const newItems = [...estimateItems, newItem];
        setEstimateItems(newItems);
        saveCustomerEstimate(newItems);
        message.success('Позиция добавлена');
      }
      
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
    }
  };

  // Функция очистки сметы
  const handleClearEstimate = () => {
    setEstimateItems([]);
    saveCustomerEstimate([]);
    message.success('Смета очищена');
  };

  // Функция открытия модального окна коэффициентов
  const handleOpenCoefficientModal = () => {
    coefficientForm.setFieldsValue({
      workCoefficient: 1,
      materialCoefficient: 1
    });
    setCoefficientModalVisible(true);
  };

  // Функция применения коэффициентов
  const handleApplyCoefficients = async () => {
    try {
      const values = await coefficientForm.validateFields();
      const { workCoefficient, materialCoefficient } = values;

      if (workCoefficient <= 0 || materialCoefficient <= 0) {
        message.error('Коэффициенты должны быть больше нуля');
        return;
      }

      const updatedItems = estimateItems.map(item => {
        // Сохраняем оригинальную цену, если она еще не сохранена
        const originalPrice = item.original_unit_price || item.unit_price;
        
        if (item.isWork) {
          // Применяем коэффициент к работам
          const newPrice = item.unit_price * workCoefficient;
          return {
            ...item,
            unit_price: newPrice,
            total: item.quantity * newPrice,
            original_unit_price: originalPrice
          };
        } else {
          // Применяем коэффициент к материалам
          const newPrice = item.unit_price * materialCoefficient;
          return {
            ...item,
            unit_price: newPrice,
            total: item.quantity * newPrice,
            original_unit_price: originalPrice
          };
        }
      });

      setEstimateItems(updatedItems);
      saveCustomerEstimate(updatedItems);
      setCoefficientModalVisible(false);
      
      message.success(`Коэффициенты применены: работы ×${workCoefficient}, материалы ×${materialCoefficient}`);
    } catch (error) {
      console.error('Ошибка применения коэффициентов:', error);
      message.error('Ошибка применения коэффициентов');
    }
  };

  // Функция отмены коэффициентов (восстановление оригинальных цен)
  const handleResetCoefficients = () => {
    const hasOriginalPrices = estimateItems.some(item => item.original_unit_price && item.original_unit_price !== item.unit_price);
    
    if (!hasOriginalPrices) {
      message.info('Коэффициенты не применялись или цены уже в исходном состоянии');
      return;
    }

    const resetItems = estimateItems.map(item => {
      if (item.original_unit_price && item.original_unit_price !== item.unit_price) {
        return {
          ...item,
          unit_price: item.original_unit_price,
          total: item.quantity * item.original_unit_price
        };
      }
      return item;
    });

    setEstimateItems(resetItems);
    saveCustomerEstimate(resetItems);
    
    // Сбрасываем значения в форме
    coefficientForm.setFieldsValue({
      workCoefficient: 1,
      materialCoefficient: 1
    });
    
    message.success('Цены восстановлены к исходным значениям');
  };

  // Функция экспорта сметы
  const handleExportEstimate = () => {
    const dataStr = JSON.stringify(estimateItems, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer-estimate-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('Смета экспортирована');
  };

  return (
    <MainCard title="Смета заказчика">
      {/* Статистика */}
      <Row gutter={8} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ padding: '8px' }}>
            <Statistic 
              title="Работ" 
              value={stats.totalWorks} 
              valueStyle={{ color: '#52c41a', fontSize: '16px' }}
              prefix={<CalculatorOutlined style={{ fontSize: '14px' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ padding: '8px' }}>
            <Statistic 
              title="Материалов" 
              value={stats.totalMaterials} 
              valueStyle={{ color: '#faad14', fontSize: '16px' }}
              prefix={<FileTextOutlined style={{ fontSize: '14px' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ padding: '8px' }}>
            <Statistic 
              title="Сумма работ" 
              value={formatNumberWithComma(stats.worksAmount)} 
              suffix="₽" 
              valueStyle={{ color: '#52c41a', fontSize: '16px' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ padding: '8px' }}>
            <Statistic 
              title="Общая сумма" 
              value={formatNumberWithComma(stats.totalAmount)} 
              suffix="₽" 
              valueStyle={{ color: '#722ed1', fontSize: '18px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Кнопки управления */}
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space wrap size="small">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddWork} size="middle">
            Добавить работу
          </Button>
          <Button
            icon={<CalculatorOutlined />}
            onClick={() => {
              loadWorks();
              loadMaterials();
            }}
            size="middle"
          >
            Обновить справочники
          </Button>
          <Button
            icon={<PercentageOutlined />}
            onClick={handleOpenCoefficientModal}
            size="middle"
            disabled={estimateItems.length === 0}
            style={{ color: '#fa8c16', borderColor: '#fa8c16' }}
          >
            Применить коэффициенты
          </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportEstimate}
            size="middle"
            disabled={estimateItems.length === 0}
          >
            Экспорт сметы
          </Button>
          <Popconfirm
            title="Очистить смету?"
            description="Все позиции будут удалены. Это действие нельзя отменить."
            onConfirm={handleClearEstimate}
            okText="Да, очистить"
            cancelText="Отмена"
            disabled={estimateItems.length === 0}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="middle"
              disabled={estimateItems.length === 0}
            >
              Очистить смету
            </Button>
          </Popconfirm>
        </Space>

        <div style={{ textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Смета заказчика на {new Date().toLocaleDateString('ru-RU')}
          </Text>
          <br />
          <Text strong style={{ color: '#722ed1', fontSize: '14px' }}>
            Итого: {formatNumberWithComma(stats.totalAmount)} ₽
          </Text>
        </div>
      </div>

      {/* Таблица сметы */}
      <Table
        size="small"
        columns={[
          {
            title: '№',
            dataIndex: 'item_id',
            key: 'item_id',
            width: 80,
            render: (text, record, index) => (
              <Text strong style={{ 
                fontSize: '14px',
                color: record.type === 'work' ? '#1890ff' : '#52c41a'
              }}>
                {index + 1}
              </Text>
            )
          },
          {
            title: 'Наименование работ и материалов',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
              <div style={{
                backgroundColor: record.type === 'work' ? '#f0f8ff' : '#f6ffed',
                padding: '8px 12px',
                borderRadius: '4px',
                border: record.type === 'work' ? '1px solid #d6e4ff' : '1px solid #d9f7be',
                borderLeft: record.type === 'work' ? '3px solid #1890ff' : '3px solid #52c41a'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {record.type === 'work' ? (
                    <CalculatorOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                  ) : (
                    <FileTextOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                  )}
                  <Text strong={record.type === 'work'} style={{ 
                    fontSize: '14px', 
                    color: record.type === 'work' ? '#1890ff' : '#52c41a' 
                  }}>
                    {text}
                  </Text>
                </div>
              </div>
            )
          },
          {
            title: 'Ед. изм.',
            dataIndex: 'unit',
            key: 'unit',
            width: 100,
            align: 'center',
            render: (text) => <Text>{text || '-'}</Text>
          },
          {
            title: 'Кол-во',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 120,
            align: 'right',
            render: (text) => (
              <Text strong style={{ color: '#1890ff' }}>
                {formatNumberWithComma(text)}
              </Text>
            )
          },
          {
            title: 'Цена',
            dataIndex: 'unit_price',
            key: 'unit_price',
            width: 120,
            align: 'right',
            render: (text) => (
              <Text style={{ color: '#722ed1' }}>
                {formatNumberWithComma(text)} ₽
              </Text>
            )
          },
          {
            title: 'Сумма',
            dataIndex: 'total',
            key: 'total',
            width: 140,
            align: 'right',
            render: (text, record) => (
              <Text strong style={{ 
                color: '#52c41a',
                fontSize: '15px'
              }}>
                {formatNumberWithComma(text)} ₽
              </Text>
            )
          },
          {
            title: 'Действия',
            key: 'actions',
            width: 120,
            align: 'center',
            render: (_, record) => (
              <Space size="small">
                <Tooltip title="Редактировать">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    size="small"
                    onClick={() => handleEditItem(record)}
                    style={{ color: '#1890ff' }}
                  />
                </Tooltip>
                <Popconfirm
                  title="Удалить позицию?"
                  description="Это действие нельзя отменить."
                  onConfirm={() => handleDeleteItem(record.item_id)}
                  okText="Удалить"
                  cancelText="Отмена"
                >
                  <Tooltip title="Удалить">
                    <Button
                      type="text"
                      icon={<DeleteOutlined />}
                      size="small"
                      danger
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            )
          }
        ]}
        dataSource={estimateItems}
        pagination={false}
        bordered
        locale={{
          emptyText: 'Нет позиций в смете. Добавьте работы или материалы.'
        }}
        summary={() => (
          <Table.Summary>
            <Table.Summary.Row style={{ backgroundColor: '#f0f2f5', fontWeight: 'bold' }}>
              <Table.Summary.Cell index={0} colSpan={5}>
                <Text strong style={{ fontSize: '16px' }}>
                  Итого по смете:
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right">
                <Text strong style={{ fontSize: '18px', color: '#722ed1' }}>
                  {formatNumberWithComma(stats.totalAmount)} ₽
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={2} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Модальное окно добавления/редактирования позиции */}
      <Modal
        title={selectedItem ? 'Редактировать позицию' : 'Добавить позицию'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={handleSaveItem}
        okText="Сохранить"
        cancelText="Отмена"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            type: 'work',
            quantity: 1,
            unit_price: 0,
            unit: 'шт.'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Тип позиции"
                rules={[{ required: true, message: 'Выберите тип' }]}
              >
                <Select placeholder="Выберите тип">
                  <Option value="work">Работа</Option>
                  <Option value="material">Материал</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="unit"
                label="Единица измерения"
                rules={[{ required: true, message: 'Введите единицу измерения' }]}
              >
                <Input placeholder="шт., м2, м3, кг..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="name"
            label="Наименование"
            rules={[{ required: true, message: 'Введите наименование' }]}
          >
            <Input.TextArea 
              placeholder="Введите наименование работы или материала"
              rows={2}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="quantity"
                label="Количество"
                rules={[
                  { required: true, message: 'Введите количество' },
                  { type: 'number', min: 0.001, message: 'Количество должно быть больше 0' }
                ]}
              >
                <InputNumber
                  placeholder="1.0"
                  style={{ width: '100%' }}
                  step={0.1}
                  precision={3}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="unit_price"
                label="Цена за единицу (₽)"
                rules={[
                  { required: true, message: 'Введите цену' },
                  { type: 'number', min: 0, message: 'Цена не может быть отрицательной' }
                ]}
              >
                <InputNumber
                  placeholder="0.00"
                  style={{ width: '100%' }}
                  step={0.01}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Предварительный расчет суммы */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const quantity = getFieldValue('quantity') || 0;
              const unitPrice = getFieldValue('unit_price') || 0;
              const total = quantity * unitPrice;
              
              return (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f6ffed',
                  border: '1px solid #b7eb8f',
                  borderRadius: '6px',
                  textAlign: 'center',
                  marginTop: '16px'
                }}>
                  <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                    Сумма: {formatNumberWithComma(total)} ₽
                  </Text>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно применения коэффициентов */}
      <Modal
        title="Применить коэффициенты"
        open={coefficientModalVisible}
        onCancel={() => setCoefficientModalVisible(false)}
        onOk={handleApplyCoefficients}
        okText="Применить"
        cancelText="Отмена"
        width={550}
        footer={[
          <Button 
            key="reset" 
            icon={<ReloadOutlined />}
            onClick={handleResetCoefficients}
            disabled={estimateItems.length === 0}
          >
            Отменить коэффициенты
          </Button>,
          <Button key="cancel" onClick={() => setCoefficientModalVisible(false)}>
            Отмена
          </Button>,
          <Button key="apply" type="primary" onClick={handleApplyCoefficients}>
            Применить
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">
            Коэффициенты будут применены ко всем позициям соответствующего типа в смете.
          </Text>
        </div>
        
        <Form
          form={coefficientForm}
          layout="vertical"
          initialValues={{
            workCoefficient: 1,
            materialCoefficient: 1
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="workCoefficient"
                label="Коэффициент для работ"
                rules={[
                  { required: true, message: 'Введите коэффициент' },
                  { type: 'number', min: 0.001, max: 1000, message: 'Коэффициент должен быть от 0.001 до 1000' }
                ]}
              >
                <InputNumber
                  placeholder="1.000"
                  style={{ width: '100%', height: '32px' }}
                  step={0.1}
                  precision={3}
                  min={0.001}
                  max={1000}
                  controls={true}
                  addonAfter="×"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="materialCoefficient"
                label="Коэффициент для материалов"
                rules={[
                  { required: true, message: 'Введите коэффициент' },
                  { type: 'number', min: 0.001, max: 1000, message: 'Коэффициент должен быть от 0.001 до 1000' }
                ]}
              >
                <InputNumber
                  placeholder="1.000"
                  style={{ width: '100%', height: '32px' }}
                  step={0.1}
                  precision={3}
                  min={0.001}
                  max={1000}
                  controls={true}
                  addonAfter="×"
                />
              </Form.Item>
            </Col>
          </Row>

          <div style={{
            padding: '12px',
            backgroundColor: '#fffbe6',
            border: '1px solid #ffe58f',
            borderRadius: '6px',
            marginTop: '16px'
          }}>
            <Text style={{ fontSize: '14px' }}>
              <strong>Примеры коэффициентов:</strong>
              <br />
              • Увеличить на 20% → 1.2
              <br />
              • Уменьшить на 10% → 0.9
              <br />
              • Удвоить → 2.0
            </Text>
          </div>

          {/* Предварительный расчет */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const workCoeff = getFieldValue('workCoefficient') || 1;
              const materialCoeff = getFieldValue('materialCoefficient') || 1;
              
              const currentTotal = estimateItems.reduce((sum, item) => sum + (item.total || 0), 0);
              const workTotal = estimateItems
                .filter(item => item.isWork)
                .reduce((sum, item) => sum + (item.total || 0), 0);
              const materialTotal = estimateItems
                .filter(item => !item.isWork)
                .reduce((sum, item) => sum + (item.total || 0), 0);
              
              const newWorkTotal = workTotal * workCoeff;
              const newMaterialTotal = materialTotal * materialCoeff;
              const newTotal = newWorkTotal + newMaterialTotal;
              
              return (
                <div style={{
                  padding: '12px',
                  backgroundColor: '#f0f8ff',
                  border: '1px solid #d6e4ff',
                  borderRadius: '6px',
                  marginTop: '16px'
                }}>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="Текущая сумма"
                        value={currentTotal}
                        precision={2}
                        suffix="₽"
                        valueStyle={{ fontSize: '14px' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="Новая сумма"
                        value={newTotal}
                        precision={2}
                        suffix="₽"
                        valueStyle={{ fontSize: '14px', color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="Изменение"
                        value={((newTotal - currentTotal) / currentTotal * 100) || 0}
                        precision={1}
                        suffix="%"
                        valueStyle={{ 
                          fontSize: '14px',
                          color: newTotal > currentTotal ? '#52c41a' : newTotal < currentTotal ? '#ff4d4f' : '#666'
                        }}
                      />
                    </Col>
                  </Row>
                </div>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>
    </MainCard>
  );
}