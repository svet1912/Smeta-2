import { useState, useEffect, useMemo, useRef } from 'react';
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
  InputNumber,
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
  PercentageOutlined,
  ReloadOutlined
} from '@ant-design/icons';

const { Text } = Typography;
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
    return '/api-proxy';
    // Используем прокси через Vite dev server
  }

  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

// Получить JWT токен из localStorage
const getAuthHeaders = () => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Функция для форматирования чисел с запятой (российский стандарт)
const formatNumberWithComma = (number) => {
  if (number === null || number === undefined || isNaN(number)) return '-';
  return parseFloat(number).toFixed(2).replace('.', ',');
};

// ==============================|| СМЕТА ЗАКАЗЧИКА ||============================== //

export default function CustomerEstimatePage() {
  const [customerEstimates, setCustomerEstimates] = useState([]);
  const [currentEstimate, setCurrentEstimate] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(false);

  // Refs для создания новой сметы
  const newEstimateNameRef = useRef();
  const newEstimateCustomerRef = useRef();
  const [form] = Form.useForm();

  // Состояния для применения коэффициентов
  const [coefficientModalVisible, setCoefficientModalVisible] = useState(false);
  const [coefficientForm] = Form.useForm();

  // Загрузка данных
  useEffect(() => {
    loadCustomerEstimates();
  }, [loadCustomerEstimates]);

  // Загрузка смет заказчика с сервера
  const loadCustomerEstimates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/customer-estimates`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCustomerEstimates(data);

        // Если есть сметы и нет текущей активной, установим первую
        if (data.length > 0 && !currentEstimate) {
          setCurrentEstimate(data[0]);
          // Сохраняем ID активной сметы в localStorage для доступа из других компонентов
          localStorage.setItem('activeCustomerEstimateId', data[0].id.toString());
          loadEstimateItems(data[0].id);
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
  }; // Загрузка позиций сметы
  const loadEstimateItems = async (estimateId) => {
    if (!estimateId) return;

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/customer-estimates/${estimateId}/items`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      if (response.ok) {
        const data = await response.json();
        const itemsWithFlags = data.map((item) => ({
          ...item,
          item_id: item.id,
          type: item.item_type,
          isWork: item.item_type === 'work',
          isMaterial: item.item_type === 'material',
          total: item.total_amount,
          image_url: item.image_url
        }));

        // Группируем данные по блокам (работа + её материалы)
        const groupedData = [];
        const blockMap = new Map();

        // Сначала создаем карту блоков
        itemsWithFlags.forEach((item) => {
          if (item.reference_id) {
            if (!blockMap.has(item.reference_id)) {
              blockMap.set(item.reference_id, { work: null, materials: [] });
            }

            if (item.item_type === 'work') {
              blockMap.get(item.reference_id).work = item;
            } else {
              blockMap.get(item.reference_id).materials.push(item);
            }
          } else {
            // Элементы без reference_id добавляем как отдельные
            groupedData.push(item);
          }
        });

        // Затем формируем окончательный массив в правильном порядке
        const sortedItems = [];

        // Добавляем блоки в правильном порядке
        Array.from(blockMap.entries())
          .sort(([, a], [, b]) => {
            const workA = a.work;
            const workB = b.work;
            if (!workA || !workB) return 0;
            return (workA.sort_order || 0) - (workB.sort_order || 0);
          })
          .forEach(([blockId, block]) => {
            if (block.work) {
              sortedItems.push(block.work);
              // Добавляем материалы этого блока сразу после работы
              block.materials.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((material) => sortedItems.push(material));
            }
          });

        // Добавляем элементы без группировки в конце
        groupedData.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).forEach((item) => sortedItems.push(item));

        setEstimateItems(sortedItems);
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

  // Создание новой сметы
  const createNewEstimate = async (estimateData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/customer-estimates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify(estimateData)
      });

      if (response.ok) {
        const newEstimate = await response.json();
        await loadCustomerEstimates();
        setCurrentEstimate(newEstimate);
        // Сохраняем ID активной сметы в localStorage
        localStorage.setItem('activeCustomerEstimateId', newEstimate.id.toString());
        loadEstimateItems(newEstimate.id);
        message.success('Смета создана успешно');
        return newEstimate;
      } else {
        message.error('Ошибка создания сметы');
        return null;
      }
    } catch (error) {
      console.error('Ошибка создания сметы:', error);
      message.error('Ошибка соединения при создании сметы');
      return null;
    }
  };

  // Функция создания новой сметы с диалогом
  const showCreateEstimateDialog = async () => {
    Modal.confirm({
      title: 'Создать новую смету',
      content: (
        <div>
          <Input placeholder="Название сметы" ref={newEstimateNameRef} style={{ marginBottom: 8 }} />
          <Input placeholder="Имя заказчика" ref={newEstimateCustomerRef} />
        </div>
      ),
      onOk: async () => {
        const name = newEstimateNameRef.current?.input?.value;
        const customerName = newEstimateCustomerRef.current?.input?.value;

        if (!name || !customerName) {
          message.error('Заполните название сметы и имя заказчика');
          return Promise.reject();
        }

        await createNewEstimate({ name, customer_name: customerName });
      }
    });
  };

  // Функция удаления текущей сметы
  const handleDeleteEstimate = async () => {
    if (!currentEstimate) return;

    Modal.confirm({
      title: 'Удалить смету?',
      content: `Вы уверены, что хотите удалить смету "${currentEstimate.name}"? Это действие нельзя отменить.`,
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/customer-estimates/${currentEstimate.id}`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders()
            }
          });

          if (response.ok) {
            await loadCustomerEstimates();
            if (customerEstimates.length > 1) {
              const nextEstimate = customerEstimates.find((e) => e.id !== currentEstimate.id);
              if (nextEstimate) {
                setCurrentEstimate(nextEstimate);
                // Обновляем активную смету в localStorage
                localStorage.setItem('activeCustomerEstimateId', nextEstimate.id.toString());
                loadEstimateItems(nextEstimate.id);
              }
            } else {
              setCurrentEstimate(null);
              // Удаляем активную смету из localStorage, если смет больше нет
              localStorage.removeItem('activeCustomerEstimateId');
              setEstimateItems([]);
            }
            message.success('Смета удалена');
          } else {
            message.error('Ошибка удаления сметы');
          }
        } catch (error) {
          console.error('Ошибка удаления сметы:', error);
          message.error('Ошибка соединения при удалении сметы');
        }
      }
    });
  };

  const loadWorks = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/works?limit=2000`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      if (response.ok) {
        const result = await response.json();
        // API возвращает {data: Array, pagination: {...}}
        if (result.data && Array.isArray(result.data)) {
          setWorks(result.data);
          console.log(`✅ Загружено ${result.data.length} работ для сметы заказчика`);
        } else if (Array.isArray(result)) {
          setWorks(result);
        } else {
          console.warn('⚠️ /api/works вернул неожиданный формат');
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
      const response = await fetch(`${API_BASE_URL}/materials?limit=2000`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      if (response.ok) {
        const result = await response.json();
        // API возвращает {data: Array, pagination: {...}}
        if (result.data && Array.isArray(result.data)) {
          setMaterials(result.data);
          console.log(`✅ Загружено ${result.data.length} материалов для сметы заказчика`);
        } else if (Array.isArray(result)) {
          setMaterials(result);
        } else {
          console.warn('⚠️ /api/materials вернул неожиданный формат');
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
    const workItems = estimateItems.filter((item) => item.type === 'work');
    const materialItems = estimateItems.filter((item) => item.type === 'material');

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
  const handleDeleteItem = async (itemId) => {
    if (!currentEstimate) return;

    try {
      const response = await fetch(`${API_BASE_URL}/customer-estimates/${currentEstimate.id}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        // Обновляем локальный список
        const newItems = estimateItems.filter((item) => item.id !== itemId);
        setEstimateItems(newItems);
        message.success('Позиция удалена');
      } else {
        message.error('Ошибка удаления позиции');
      }
    } catch (error) {
      console.error('Ошибка удаления позиции:', error);
      message.error('Ошибка при удалении позиции');
    }
  };

  // Функция сохранения позиции
  const handleSaveItem = async () => {
    if (!currentEstimate) {
      message.error('Сначала создайте смету');
      return;
    }

    try {
      const values = await form.validateFields();
      const itemData = {
        item_type: values.type,
        name: values.name,
        unit: values.unit,
        quantity: values.quantity,
        unit_price: values.unit_price,
        total_amount: (values.quantity || 1) * (values.unit_price || 0),
        original_unit_price: values.unit_price,
        image_url: values.image_url || null,
        notes: values.notes || null
      };

      if (selectedItem) {
        // Редактирование существующей позиции - пока обновим локально
        const updatedItems = estimateItems.map((item) =>
          item.item_id === selectedItem.item_id
            ? {
                ...item,
                ...values,
                total: (values.quantity || 1) * (values.unit_price || 0),
                isWork: values.type === 'work',
                isMaterial: values.type === 'material',
                original_unit_price: item.original_unit_price || item.unit_price
              }
            : item
        );
        setEstimateItems(updatedItems);
        message.success('Позиция обновлена');
      } else {
        // Добавление новой позиции через API
        const response = await fetch(`${API_BASE_URL}/customer-estimates/${currentEstimate.id}/items`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify(itemData)
        });
        if (response.ok) {
          await loadEstimateItems(currentEstimate.id);
          message.success('Позиция добавлена');
        } else {
          message.error('Ошибка добавления позиции');
        }
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      message.error('Ошибка при сохранении позиции');
    }
  };

  // Функция очистки сметы
  const handleClearEstimate = async () => {
    if (!currentEstimate) return;

    Modal.confirm({
      title: 'Очистить смету?',
      content: 'Все позиции будут удалены. Это действие нельзя отменить.',
      onOk: async () => {
        try {
          // Удаляем все элементы сметы через API
          const deletePromises = estimateItems.map((item) =>
            fetch(`${API_BASE_URL}/customer-estimates/${currentEstimate.id}/items/${item.id}`, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
              }
            })
          );

          await Promise.all(deletePromises);
          setEstimateItems([]);
          message.success('Смета очищена');
        } catch (error) {
          console.error('Ошибка очистки сметы:', error);
          message.error('Ошибка при очистке сметы');
        }
      }
    });
  }; // Функция открытия модального окна коэффициентов
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

      const updatedItems = estimateItems.map((item) => {
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
      setCoefficientModalVisible(false);

      message.success(`Коэффициенты применены: работы ×${workCoefficient}, материалы ×${materialCoefficient}`);
    } catch (error) {
      console.error('Ошибка применения коэффициентов:', error);
      message.error('Ошибка применения коэффициентов');
    }
  };

  // Функция отмены коэффициентов (восстановление оригинальных цен)
  const handleResetCoefficients = () => {
    const hasOriginalPrices = estimateItems.some((item) => item.original_unit_price && item.original_unit_price !== item.unit_price);

    if (!hasOriginalPrices) {
      message.info('Коэффициенты не применялись или цены уже в исходном состоянии');
      return;
    }

    const resetItems = estimateItems.map((item) => {
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
      {/* Управление сметами */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={16}>
          <Select
            placeholder="Выберите смету"
            style={{ width: '100%' }}
            value={currentEstimate?.id}
            onChange={(value) => {
              const estimate = customerEstimates.find((e) => e.id === value);
              if (estimate) {
                setCurrentEstimate(estimate);
                // Сохраняем ID активной сметы в localStorage
                localStorage.setItem('activeCustomerEstimateId', estimate.id.toString());
                loadEstimateItems(estimate.id);
              }
            }}
            loading={loading}
          >
            {customerEstimates.map((estimate) => (
              <Select.Option key={`estimate-${estimate.id}`} value={estimate.id}>
                {estimate.name} - {estimate.customer_name || 'Без имени'}({new Date(estimate.created_at).toLocaleDateString()})
              </Select.Option>
            ))}
          </Select>
        </Col>
        <Col span={4}>
          <Button type="primary" onClick={showCreateEstimateDialog} loading={loading}>
            Новая смета
          </Button>
        </Col>
        <Col span={4}>
          <Button danger onClick={handleDeleteEstimate} disabled={!currentEstimate} loading={loading}>
            Удалить смету
          </Button>
        </Col>
      </Row>

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
          <Button icon={<DownloadOutlined />} onClick={handleExportEstimate} size="middle" disabled={estimateItems.length === 0}>
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
            <Button danger icon={<DeleteOutlined />} size="middle" disabled={estimateItems.length === 0}>
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
        rowKey={(record) => `${record.item_id || record.id}-${record.type}`}
        columns={[
          {
            title: '№',
            dataIndex: 'item_id',
            key: 'item_id',
            width: 80,
            render: (text, record, index) => (
              <Text
                strong
                style={{
                  fontSize: '14px',
                  color: record.type === 'work' ? '#1890ff' : '#52c41a'
                }}
              >
                {index + 1}
              </Text>
            )
          },
          {
            title: '',
            dataIndex: 'image_url',
            key: 'image_url',
            width: 60,
            align: 'center',
            render: (imageUrl, record) => {
              if (record.type === 'material' && imageUrl) {
                return (
                  <Image
                    src={imageUrl}
                    alt={record.name}
                    width={24}
                    height={24}
                    style={{
                      objectFit: 'cover',
                      borderRadius: '3px',
                      border: '1px solid #d9d9d9'
                    }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                  />
                );
              } else if (record.type === 'work') {
                return <CalculatorOutlined style={{ color: '#1890ff', fontSize: '16px' }} />;
              }
              return null;
            }
          },
          {
            title: 'Наименование работ и материалов',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
              <div
                style={{
                  backgroundColor: record.type === 'work' ? '#f0f8ff' : '#f6ffed',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: record.type === 'work' ? '1px solid #d6e4ff' : '1px solid #d9f7be',
                  borderLeft: record.type === 'work' ? '3px solid #1890ff' : '3px solid #52c41a'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Text
                    strong={record.type === 'work'}
                    style={{
                      fontSize: '14px',
                      color: record.type === 'work' ? '#1890ff' : '#52c41a'
                    }}
                  >
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
            render: (text) => <Text style={{ color: '#722ed1' }}>{formatNumberWithComma(text)} ₽</Text>
          },
          {
            title: 'Сумма',
            dataIndex: 'total',
            key: 'total',
            width: 140,
            align: 'right',
            render: (text, record) => (
              <Text
                strong
                style={{
                  color: '#52c41a',
                  fontSize: '15px'
                }}
              >
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
                    <Button type="text" icon={<DeleteOutlined />} size="small" danger />
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
              <Form.Item name="type" label="Тип позиции" rules={[{ required: true, message: 'Выберите тип' }]}>
                <Select placeholder="Выберите тип">
                  <Option value="work">Работа</Option>
                  <Option value="material">Материал</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unit" label="Единица измерения" rules={[{ required: true, message: 'Введите единицу измерения' }]}>
                <Input placeholder="шт., м2, м3, кг..." />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="name" label="Наименование" rules={[{ required: true, message: 'Введите наименование' }]}>
            <Input.TextArea placeholder="Введите наименование работы или материала" rows={2} />
          </Form.Item>

          {/* Поле для URL изображения материала */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              return type === 'material' ? (
                <Form.Item name="image_url" label="URL изображения материала (необязательно)">
                  <Input placeholder="https://example.com/image.jpg" allowClear />
                </Form.Item>
              ) : null;
            }}
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
                <InputNumber placeholder="1.0" style={{ width: '100%' }} step={0.1} precision={3} />
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
                <InputNumber placeholder="0.00" style={{ width: '100%' }} step={0.01} precision={2} />
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
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#f6ffed',
                    border: '1px solid #b7eb8f',
                    borderRadius: '6px',
                    textAlign: 'center',
                    marginTop: '16px'
                  }}
                >
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
          <Button key="reset" icon={<ReloadOutlined />} onClick={handleResetCoefficients} disabled={estimateItems.length === 0}>
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
          <Text type="secondary">Коэффициенты будут применены ко всем позициям соответствующего типа в смете.</Text>
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

          <div
            style={{
              padding: '12px',
              backgroundColor: '#fffbe6',
              border: '1px solid #ffe58f',
              borderRadius: '6px',
              marginTop: '16px'
            }}
          >
            <Text style={{ fontSize: '14px' }}>
              <strong>Примеры коэффициентов:</strong>
              <br />
              • Увеличить на 20% → 1.2
              <br />
              • Уменьшить на 10% → 0.9
              <br />• Удвоить → 2.0
            </Text>
          </div>

          {/* Предварительный расчет */}
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const workCoeff = getFieldValue('workCoefficient') || 1;
              const materialCoeff = getFieldValue('materialCoefficient') || 1;

              const currentTotal = estimateItems.reduce((sum, item) => sum + (item.total || 0), 0);
              const workTotal = estimateItems.filter((item) => item.isWork).reduce((sum, item) => sum + (item.total || 0), 0);
              const materialTotal = estimateItems.filter((item) => !item.isWork).reduce((sum, item) => sum + (item.total || 0), 0);

              const newWorkTotal = workTotal * workCoeff;
              const newMaterialTotal = materialTotal * materialCoeff;
              const newTotal = newWorkTotal + newMaterialTotal;

              return (
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: '#f0f8ff',
                    border: '1px solid #d6e4ff',
                    borderRadius: '6px',
                    marginTop: '16px'
                  }}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic title="Текущая сумма" value={currentTotal} precision={2} suffix="₽" valueStyle={{ fontSize: '14px' }} />
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
                        value={((newTotal - currentTotal) / currentTotal) * 100 || 0}
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
