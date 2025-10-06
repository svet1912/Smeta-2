import { useState, useEffect, useCallback } from 'react';
import MainCard from 'components/MainCard';
import {
  Typography,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Tooltip,
  Popconfirm,
  Image
} from 'antd';
import {
  PlusOutlined,
  CalculatorOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  DownloadOutlined,
  SaveOutlined,
  ReloadOutlined,
  EyeOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';

const { Text } = Typography;
const { Option } = Select;

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  const currentHost = window.location.hostname;
  if (currentHost.includes('.app.github.dev')) {
    return '/api-proxy';
  }

  return 'http://localhost:3001/api';
};

// Получить JWT токен из localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Функция для форматирования чисел с запятой (российский стандарт)
const formatNumberWithComma = (number) => {
  if (number === null || number === undefined || isNaN(number)) return '0,00';
  return parseFloat(number).toFixed(2).replace('.', ',');
};

// Функция для безопасного вычисления математических выражений
const safeEval = (expression) => {
  try {
    const cleanExpression = expression.toString().replace(/\s/g, '');
    if (!/^[0-9+\-*/.(),]+$/.test(cleanExpression)) {
      return null;
    }
    const normalizedExpression = cleanExpression.replace(/,/g, '.');
    const result = new Function('return ' + normalizedExpression)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
    return null;
  } catch {
    return null;
  }
};

// Компонент калькулятора для числовых полей
const CalculatorInput = ({ value, onChange, placeholder, ...props }) => {
  const [displayValue, setDisplayValue] = useState(value?.toString() || '');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(value?.toString() || '');
    }
  }, [value, isEditing]);

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);

    if (displayValue.trim() === '') {
      onChange(0);
      setDisplayValue('0');
      return;
    }

    const hasOperators = /[+\-*/]/.test(displayValue);

    if (hasOperators) {
      const result = safeEval(displayValue);
      if (result !== null) {
        onChange(result);
        setDisplayValue(result.toString());
      } else {
        setDisplayValue(value?.toString() || '0');
      }
    } else {
      const numValue = parseFloat(displayValue.replace(',', '.')) || 0;
      onChange(numValue);
      setDisplayValue(numValue.toString());
    }
  };

  const handleChange = (e) => {
    setDisplayValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <Input
      {...props}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      title="Можно вводить математические выражения: 2+3, 10*1.5, 20/4 и т.д. Нажмите Enter или уберите фокус для вычисления"
    />
  );
};

// ==============================|| СМЕТА ЗАКАЗЧИКА (ЧИСТАЯ) ||============================== //

export default function CustomerEstimateClean() {
  const [estimateItems, setEstimateItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  // Состояние для управления видимостью колонки изображений
  const [showImageColumn, setShowImageColumn] = useState(true);

  // Состояния для управления сметами
  const [customerEstimates, setCustomerEstimates] = useState([]);
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [estimateModalVisible, setEstimateModalVisible] = useState(false);
  const [estimateForm] = Form.useForm();

  // Функция для установки активной сметы с сохранением в localStorage
  const setActiveEstimate = (estimate) => {
    setCurrentEstimate(estimate);
    if (estimate) {
      localStorage.setItem('activeCustomerEstimateId', estimate.id.toString());
    } else {
      localStorage.removeItem('activeCustomerEstimateId');
    }
  };

  // Загрузка смет заказчика
  const loadCustomerEstimates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/customer-estimates`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        const data = await response.json();
        const estimates = Array.isArray(data) ? data : data.items || [];
        setCustomerEstimates(estimates);

        if (estimates.length > 0 && !currentEstimate) {
          // Пытаемся восстановить активную смету из localStorage
          const savedEstimateId = localStorage.getItem('activeCustomerEstimateId');
          const savedEstimate = savedEstimateId ? estimates.find((e) => e.id.toString() === savedEstimateId) : null;
          
          if (savedEstimate) {
            setActiveEstimate(savedEstimate);
            loadEstimateItems(savedEstimate.id);
          } else {
            setActiveEstimate(estimates[0]);
            loadEstimateItems(estimates[0].id);
          }
        }
      } else {
        message.error('Ошибка загрузки смет');
      }
    } catch (error) {
      console.error('Ошибка загрузки смет:', error);
      message.error('Ошибка соединения при загрузке смет');
    } finally {
      setLoading(false);
    }
  }, [currentEstimate]);

  // Загрузка позиций сметы
  const loadEstimateItems = async (estimateId) => {
    if (!estimateId) return;

    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/customer-estimates/${estimateId}/items`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        const data = await response.json();
        const items = Array.isArray(data) ? data : data.items || [];
        setEstimateItems(items);
      } else {
        message.error('Ошибка загрузки позиций сметы');
      }
    } catch (error) {
      console.error('Ошибка загрузки позиций сметы:', error);
      message.error('Ошибка соединения при загрузке позиций');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerEstimates();
  }, [loadCustomerEstimates]);

  // Создание новой сметы
  const handleCreateEstimate = async (values) => {
    try {
      setLoading(true);

      // Преобразуем данные для API - сервер сам создаст проект по умолчанию если нужно
      const requestData = {
        estimate_name: values.name,
        customer_name: values.customer_name,
        description: values.description
      };

      const response = await fetch(`${getApiBaseUrl()}/customer-estimates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(requestData)
      });

      if (response.ok) {
        const newEstimate = await response.json();
        message.success('Смета создана успешно');
        setEstimateModalVisible(false);
        estimateForm.resetFields();
        loadCustomerEstimates();
        setActiveEstimate(newEstimate);
        setEstimateItems([]);
      } else {
        message.error('Ошибка создания сметы');
      }
    } catch (error) {
      console.error('Ошибка создания сметы:', error);
      message.error('Ошибка соединения при создании сметы');
    } finally {
      setLoading(false);
    }
  };

  // Добавление новой позиции
  const handleAddItem = async (values) => {
    if (!currentEstimate) {
      message.error('Сначала выберите или создайте смету');
      return;
    }

    try {
      setLoading(true);
      const itemData = {
        ...values,
        total_amount: values.quantity * values.unit_price
      };

      const response = await fetch(`${getApiBaseUrl()}/customer-estimates/${currentEstimate.id}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        message.success('Позиция добавлена');
        setModalVisible(false);
        form.resetFields();
        loadEstimateItems(currentEstimate.id);
      } else {
        message.error('Ошибка добавления позиции');
      }
    } catch (error) {
      console.error('Ошибка добавления позиции:', error);
      message.error('Ошибка соединения при добавлении позиции');
    } finally {
      setLoading(false);
    }
  };

  // Редактирование позиции
  const handleEditItem = async (values) => {
    if (!selectedItem) return;

    try {
      setLoading(true);
      const itemData = {
        ...values,
        total_amount: values.quantity * values.unit_price
      };

      const response = await fetch(`${getApiBaseUrl()}/customer-estimate-items/${selectedItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(itemData)
      });

      if (response.ok) {
        message.success('Позиция обновлена');
        setModalVisible(false);
        setSelectedItem(null);
        form.resetFields();
        loadEstimateItems(currentEstimate.id);
      } else {
        message.error('Ошибка обновления позиции');
      }
    } catch (error) {
      console.error('Ошибка обновления позиции:', error);
      message.error('Ошибка соединения при обновлении позиции');
    } finally {
      setLoading(false);
    }
  };

  // Удаление позиции
  const handleDeleteItem = async (itemId) => {
    try {
      setLoading(true);
      const response = await fetch(`${getApiBaseUrl()}/customer-estimate-items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        message.success('Позиция удалена');
        loadEstimateItems(currentEstimate.id);
      } else {
        message.error('Ошибка удаления позиции');
      }
    } catch (error) {
      console.error('Ошибка удаления позиции:', error);
      message.error('Ошибка соединения при удалении позиции');
    } finally {
      setLoading(false);
    }
  };

  // Очистка всех позиций сметы
  const handleClearEstimate = async () => {
    if (!currentEstimate) {
      message.error('Выберите смету для очистки');
      return;
    }

    try {
      setLoading(true);
      
      // Получаем все позиции текущей сметы
      const itemsResponse = await fetch(`${getApiBaseUrl()}/customer-estimates/${currentEstimate.id}/items`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (itemsResponse.ok) {
        const data = await itemsResponse.json();
        const items = Array.isArray(data) ? data : data.items || [];
        
        if (items.length === 0) {
          message.info('Смета уже пуста');
          return;
        }

        // Удаляем все позиции параллельно
        const deletePromises = items.map((item) =>
          fetch(`${getApiBaseUrl()}/customer-estimates/${currentEstimate.id}/items/${item.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            }
          })
        );

        const results = await Promise.all(deletePromises);
        const successCount = results.filter((response) => response.ok).length;

        if (successCount === items.length) {
          message.success(`Смета очищена! Удалено ${successCount} позиций`);
          setEstimateItems([]);
        } else {
          message.warning(`Частично очищено: удалено ${successCount} из ${items.length} позиций`);
          loadEstimateItems(currentEstimate.id); // Перезагружаем для актуального состояния
        }
      } else {
        message.error('Ошибка загрузки позиций сметы');
      }
    } catch (error) {
      console.error('Ошибка очистки сметы:', error);
      message.error('Ошибка соединения при очистке сметы');
    } finally {
      setLoading(false);
    }
  };

  // Статистика
  const itemsArray = Array.isArray(estimateItems) ? estimateItems : [];
  const stats = {
    totalItems: itemsArray.length,
    totalAmount: itemsArray.reduce((sum, item) => sum + (item.total_amount || 0), 0),
    worksCount: itemsArray.filter((item) => item.item_type === 'work').length,
    materialsCount: itemsArray.filter((item) => item.item_type === 'material').length
  };

  // Функция для получения колонок таблицы
  const getColumns = () => {
    const baseColumns = [
      {
        title: '№',
        dataIndex: 'id',
        key: 'id',
        width: 60,
        render: (text, record, index) => {
          // Создаем виртуальный item_id в формате w.1, m.2 и т.д.
          const itemId = record.item_type === 'work' ? `w.${text}` : `m.${text}`;
          return (
            <Text strong style={{ color: record.item_type === 'work' ? '#1890ff' : '#52c41a' }}>
              {itemId}
            </Text>
          );
        }
      },
      {
        title: 'Наименование',
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <div
            style={{
              backgroundColor: record.item_type === 'work' ? '#f0f8ff' : '#f6ffed',
              padding: '8px 12px',
              borderRadius: '4px',
              border: record.item_type === 'work' ? '1px solid #d6e4ff' : '1px solid #d9f7be',
              borderLeft: record.item_type === 'work' ? '3px solid #1890ff' : '3px solid #52c41a'
            }}
          >
            <Text
              strong={record.item_type === 'work'}
              style={{
                fontSize: '14px',
                color: record.item_type === 'work' ? '#1890ff' : '#52c41a'
              }}
            >
              {text}
            </Text>
          </div>
        )
      },
      {
        title: 'Ед. изм.',
        dataIndex: 'unit',
        key: 'unit',
        width: 80,
        align: 'center'
      },
      {
        title: 'Кол-во',
        dataIndex: 'quantity',
        key: 'quantity',
        width: 100,
        align: 'center',
        render: (value) => formatNumberWithComma(value)
      },
      {
        title: 'Цена',
        dataIndex: 'unit_price',
        key: 'unit_price',
        width: 120,
        align: 'right',
        render: (value) => `${formatNumberWithComma(value)} ₽`
      },
      {
        title: 'Сумма',
        dataIndex: 'total_amount',
        key: 'total_amount',
        width: 140,
        align: 'right',
        render: (value) => (
          <Text strong style={{ color: '#722ed1' }}>
            {formatNumberWithComma(value)} ₽
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
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedItem(record);
                  form.setFieldsValue(record);
                  setModalVisible(true);
                }}
              />
            </Tooltip>
            <Popconfirm
              title="Удалить позицию?"
              description="Это действие нельзя отменить"
              onConfirm={() => handleDeleteItem(record.id)}
              okText="Да"
              cancelText="Нет"
            >
              <Tooltip title="Удалить">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        )
      }
    ];

    // Добавляем колонку изображения, если она включена
    if (showImageColumn) {
      // Находим позицию после колонки "Наименование"
      const nameColumnIndex = baseColumns.findIndex((col) => col.key === 'name');
      if (nameColumnIndex !== -1) {
        baseColumns.splice(nameColumnIndex + 1, 0, {
          title: 'Изображение',
          dataIndex: 'image_url',
          key: 'image_url',
          width: 80,
          align: 'center',
          render: (imageUrl, record) => {
            if (record.item_type === 'material' && imageUrl) {
              return (
                <Image
                  src={imageUrl}
                  alt={record.name}
                  width={32}
                  height={32}
                  style={{
                    objectFit: 'cover',
                    borderRadius: '4px',
                    border: '1px solid #d9d9d9'
                  }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                />
              );
            } else if (record.item_type === 'work') {
              return (
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    backgroundColor: '#f0f8ff',
                    border: '1px solid #d6e4ff',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CalculatorOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                </div>
              );
            }
            return (
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <FileTextOutlined style={{ color: '#999', fontSize: '16px' }} />
              </div>
            );
          }
        });
      }
    }

    return baseColumns;
  };

  // Получаем колонки
  const columns = getColumns();

  return (
    <MainCard title="Смета заказчика">
      {/* Управление сметами */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Select
            placeholder="Выберите смету"
            style={{ width: '100%' }}
            value={currentEstimate?.id}
            onChange={(value) => {
              const estimate = customerEstimates.find((e) => e.id === value);
              if (estimate) {
                setActiveEstimate(estimate);
                loadEstimateItems(estimate.id);
              }
            }}
            loading={loading}
          >
            {Array.isArray(customerEstimates) &&
              customerEstimates.map((estimate) => (
                <Option key={estimate.id} value={estimate.id}>
                  {estimate.name} - {estimate.customer_name} ({new Date(estimate.created_at).toLocaleDateString()})
                </Option>
              ))}
          </Select>
        </Col>
        <Col span={3}>
          <Button type="primary" onClick={() => setEstimateModalVisible(true)} loading={loading}>
            Новая смета
          </Button>
        </Col>
        <Col span={3}>
          <Button onClick={() => loadCustomerEstimates()} loading={loading} icon={<ReloadOutlined />}>
            Обновить
          </Button>
        </Col>
        <Col span={4}>
          <Popconfirm
            title="Очистить смету?"
            description="Все позиции будут удалены. Это действие нельзя отменить."
            onConfirm={handleClearEstimate}
            okText="Да, очистить"
            cancelText="Отмена"
            disabled={!currentEstimate || estimateItems.length === 0}
          >
            <Button danger icon={<DeleteOutlined />} loading={loading} disabled={!currentEstimate || estimateItems.length === 0}>
              Очистить смету
            </Button>
          </Popconfirm>
        </Col>
      </Row>

      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Всего позиций" value={stats.totalItems} prefix={<FileTextOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Работы" value={stats.worksCount} prefix={<CalculatorOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Материалы" value={stats.materialsCount} prefix={<FileTextOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="Общая сумма"
              value={formatNumberWithComma(stats.totalAmount)}
              suffix="₽"
              valueStyle={{ color: '#722ed1', fontWeight: 'bold' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Кнопки управления */}
      <div style={{ marginBottom: 16, textAlign: 'right' }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedItem(null);
              form.resetFields();
              setModalVisible(true);
            }}
            disabled={!currentEstimate}
          >
            Добавить позицию
          </Button>
          <Button icon={<SaveOutlined />} disabled={!currentEstimate}>
            Сохранить смету
          </Button>
          <Button icon={<DownloadOutlined />} disabled={!currentEstimate}>
            Экспорт в Excel
          </Button>
          <Tooltip title={showImageColumn ? 'Скрыть колонку изображений' : 'Показать колонку изображений'}>
            <Button
              icon={showImageColumn ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={() => setShowImageColumn(!showImageColumn)}
              type={showImageColumn ? 'default' : 'dashed'}
            >
              {showImageColumn ? 'Скрыть' : 'Показать'} изображения
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Таблица позиций */}
      <Table
        size="small"
        rowKey="id"
        columns={columns}
        dataSource={itemsArray}
        loading={loading}
        pagination={false}
        bordered
        locale={{
          emptyText: currentEstimate
            ? 'Нет позиций в смете. Нажмите "Добавить позицию" для создания первой позиции.'
            : 'Выберите или создайте смету для просмотра позиций.'
        }}
        summary={() => (
          <Table.Summary fixed>
            <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
              <Table.Summary.Cell index={0} colSpan={6}>
                <Text strong style={{ fontSize: '16px' }}>
                  ИТОГО:
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={6}>
                <Text strong style={{ fontSize: '16px', color: '#722ed1' }}>
                  {formatNumberWithComma(stats.totalAmount)} ₽
                </Text>
              </Table.Summary.Cell>
              <Table.Summary.Cell index={7} />
            </Table.Summary.Row>
          </Table.Summary>
        )}
      />

      {/* Модальное окно создания сметы */}
      <Modal
        title="Создать новую смету"
        open={estimateModalVisible}
        onCancel={() => {
          setEstimateModalVisible(false);
          estimateForm.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={estimateForm} layout="vertical" onFinish={handleCreateEstimate}>
          <Form.Item name="name" label="Название сметы" rules={[{ required: true, message: 'Введите название сметы' }]}>
            <Input placeholder="Например: Ремонт квартиры" />
          </Form.Item>

          <Form.Item name="customer_name" label="Имя заказчика" rules={[{ required: true, message: 'Введите имя заказчика' }]}>
            <Input placeholder="Например: Иванов И.И." />
          </Form.Item>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={3} placeholder="Дополнительная информация о смете" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button
                onClick={() => {
                  setEstimateModalVisible(false);
                  estimateForm.resetFields();
                }}
              >
                Отмена
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                Создать смету
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно добавления/редактирования позиции */}
      <Modal
        title={selectedItem ? 'Редактировать позицию' : 'Добавить позицию'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setSelectedItem(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={selectedItem ? handleEditItem : handleAddItem}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="item_type" label="Тип позиции" rules={[{ required: true, message: 'Выберите тип позиции' }]}>
                <Select placeholder="Выберите тип">
                  <Option value="work">
                    <Space>
                      <CalculatorOutlined style={{ color: '#1890ff' }} />
                      Работа
                    </Space>
                  </Option>
                  <Option value="material">
                    <Space>
                      <FileTextOutlined style={{ color: '#52c41a' }} />
                      Материал
                    </Space>
                  </Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Единица измерения" rules={[{ required: true, message: 'Введите единицу измерения' }]}>
                <Input placeholder="м², шт, м.пог." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="name" label="Наименование" rules={[{ required: true, message: 'Введите наименование' }]}>
            <Input placeholder="Например: Штукатурка стен" />
          </Form.Item>

          <Form.Item name="image_url" label="Ссылка на изображение">
            <Input placeholder="https://example.com/image.jpg (необязательно)" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="Количество" rules={[{ required: true, message: 'Введите количество' }]}>
                <CalculatorInput placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit_price" label="Цена за единицу" rules={[{ required: true, message: 'Введите цену' }]}>
                <CalculatorInput placeholder="0,00" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Описание">
            <Input.TextArea rows={2} placeholder="Дополнительная информация" />
          </Form.Item>

          <Form.Item style={{ textAlign: 'right', marginBottom: 0 }}>
            <Space>
              <Button
                onClick={() => {
                  setModalVisible(false);
                  setSelectedItem(null);
                  form.resetFields();
                }}
              >
                Отмена
              </Button>
              <Button type="primary" htmlType="submit" loading={loading}>
                {selectedItem ? 'Обновить' : 'Добавить'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </MainCard>
  );
}
