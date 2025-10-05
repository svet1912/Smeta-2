import { useState, useEffect, useCallback } from 'react';
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
  Popconfirm
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons';

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

// ==============================|| СПРАВОЧНИК РАБОТ ||============================== //

export default function WorksPage() {
  const [works, setWorks] = useState([]);
  const [phases, setPhases] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [workMaterials, setWorkMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'view'
  const [selectedWork, setSelectedWork] = useState(null);
  const [form] = Form.useForm();
  const [materialForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [filteredWorks, setFilteredWorks] = useState([]);

  // Функция для естественной сортировки ID (w.1, w.2, w.10 и т.д.)
  const naturalSort = (arr) => {
    return arr.sort((a, b) => {
      const aId = a.id || '';
      const bId = b.id || '';

      // Разбиваем строку на части (текст и числа)
      const aParts = aId.split(/(\d+)/);
      const bParts = bId.split(/(\d+)/);

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || '';
        const bPart = bParts[i] || '';

        // Если обе части числа, сравниваем как числа
        if (!isNaN(aPart) && !isNaN(bPart)) {
          const diff = parseInt(aPart, 10) - parseInt(bPart, 10);
          if (diff !== 0) return diff;
        } else {
          // Иначе сравниваем как строки
          const comparison = aPart.localeCompare(bPart);
          if (comparison !== 0) return comparison;
        }
      }
      return 0;
    });
  };

  // Функция для группировки работ по стадиям и подстадиям
  const groupWorksByStages = useCallback((works) => {
    const grouped = {};

    works.forEach((work) => {
      const stageName = work.stage_name || 'Без стадии';
      const substageName = work.substage_name || null;

      if (!grouped[stageName]) {
        grouped[stageName] = {
          stage: stageName,
          substages: {}
        };
      }

      if (substageName) {
        if (!grouped[stageName].substages[substageName]) {
          grouped[stageName].substages[substageName] = {
            substage: substageName,
            works: []
          };
        }
        grouped[stageName].substages[substageName].works.push(work);
      } else {
        if (!grouped[stageName].substages['direct']) {
          grouped[stageName].substages['direct'] = {
            substage: null,
            works: []
          };
        }
        grouped[stageName].substages['direct'].works.push(work);
      }
    });

    // Сортируем работы внутри каждой группы
    Object.values(grouped).forEach((stageGroup) => {
      Object.values(stageGroup.substages).forEach((substageGroup) => {
        substageGroup.works = naturalSort(substageGroup.works);
      });
    });

    return grouped;
  }, []);

  // Создаем список элементов для отображения
  const createDisplayItems = useCallback(
    (works) => {
      const grouped = groupWorksByStages(works);
      const displayItems = [];

      Object.entries(grouped).forEach(([stageName, stageGroup]) => {
        // Добавляем заголовок стадии
        displayItems.push({
          key: `stage-${stageName}`,
          type: 'stage',
          name: stageName,
          isHeader: true
        });

        Object.entries(stageGroup.substages).forEach(([substageKey, substageGroup]) => {
          // Добавляем заголовок подстадии, если она есть
          if (substageGroup.substage) {
            displayItems.push({
              key: `substage-${substageGroup.substage}`,
              type: 'substage',
              name: substageGroup.substage,
              isHeader: true
            });
          }

          // Добавляем работы
          substageGroup.works.forEach((work) => {
            displayItems.push({
              ...work,
              type: 'work',
              isHeader: false
            });
          });
        });
      });

      return displayItems;
    },
    [groupWorksByStages]
  );

  // Функция для поиска и фильтрации работ
  const handleSearch = useCallback(
    (value) => {
      setSearchText(value);
      let filtered = works.filter(
        (work) =>
          work.name.toLowerCase().includes(value.toLowerCase()) ||
          work.phase_name?.toLowerCase().includes(value.toLowerCase()) ||
          work.stage_name?.toLowerCase().includes(value.toLowerCase()) ||
          work.id.toString().includes(value)
      );

      // Создаем элементы для отображения с группировкой
      const displayItems = createDisplayItems(filtered);
      setFilteredWorks(displayItems);
    },
    [works, createDisplayItems]
  );

  // Обновляем отфильтрованные работы при изменении основного списка
  useEffect(() => {
    handleSearch(searchText);
  }, [works, handleSearch, searchText]);

  const loadWorks = useCallback(async () => {
    setLoading(true);
    try {
      // Загружаем все работы без ограничений
      const response = await fetch(`${API_BASE_URL}/works?limit=2000&offset=0`);
      if (response.ok) {
        const result = await response.json();
        console.log('🔨 API ответ works:', result);

        let worksData = [];
        // API возвращает {data: Array, pagination: {...}}
        if (result.data && Array.isArray(result.data)) {
          worksData = result.data;
          console.log(`✅ Загружено ${result.data.length} работ`);
        } else if (Array.isArray(result)) {
          worksData = result;
          console.log(`✅ Загружено ${result.length} работ`);
        } else {
          console.warn('⚠️ /api/works вернул неожиданный формат:', result);
          worksData = [];
        }

        // Применяем естественную сортировку к загруженным данным
        const sortedWorks = naturalSort([...worksData]);
        setWorks(sortedWorks);
      } else {
        message.error('Ошибка загрузки работ');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка подключения к серверу');
    } finally {
      setLoading(false);
    }
  }, []);

  // Загрузка данных
  useEffect(() => {
    loadWorks();
    loadPhases();
    loadMaterials();
  }, [loadWorks]);

  const loadPhases = async () => {
    try {
      // Загружаем все фазы без ограничений
      const response = await fetch(`${API_BASE_URL}/phases?limit=2000&offset=0`);
      if (response.ok) {
        const result = await response.json();
        console.log('📋 API ответ phases:', result);

        // API может вернуть {data: Array} или просто Array
        if (result.data && Array.isArray(result.data)) {
          setPhases(result.data);
          console.log(`✅ Загружено ${result.data.length} фаз`);
        } else if (Array.isArray(result)) {
          setPhases(result);
          console.log(`✅ Загружено ${result.length} фаз`);
        } else {
          console.warn('⚠️ /api/phases вернул неожиданный формат:', result);
          setPhases([]);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки фаз:', error);
    }
  };

  const loadMaterials = async () => {
    try {
      // Загружаем все материалы без ограничений
      const response = await fetch(`${API_BASE_URL}/materials?limit=2000&offset=0`);
      if (response.ok) {
        const result = await response.json();
        console.log('🧱 API ответ materials:', result);

        // API возвращает {data: Array, pagination: {...}}
        if (result.data && Array.isArray(result.data)) {
          setMaterials(result.data);
          console.log(`✅ Загружено ${result.data.length} материалов`);
        } else if (Array.isArray(result)) {
          setMaterials(result);
          console.log(`✅ Загружено ${result.length} материалов`);
        } else {
          console.warn('⚠️ /api/materials вернул неожиданный формат:', result);
          setMaterials([]);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
    }
  };

  const loadWorkMaterials = async (workId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/works/${workId}/materials`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setWorkMaterials(data);
        } else {
          setWorkMaterials([]);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки материалов работы:', error);
      setWorkMaterials([]);
    }
  };

  const handleCreate = () => {
    setModalMode('create');
    setSelectedWork(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setModalMode('edit');
    setSelectedWork(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleView = (record) => {
    setModalMode('view');
    setSelectedWork(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleSave = async (values) => {
    try {
      const response = await fetch(`${API_BASE_URL}/works`, {
        method: modalMode === 'create' ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success(modalMode === 'create' ? 'Работа создана' : 'Работа обновлена');
        setModalVisible(false);
        loadWorks();
      } else {
        message.error('Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка подключения к серверу');
    }
  };

  const handleManageMaterials = (work) => {
    setSelectedWork(work);
    loadWorkMaterials(work.id);
    setMaterialModalVisible(true);
  };

  const handleAddMaterial = async (values) => {
    try {
      const response = await fetch(`${API_BASE_URL}/works/${selectedWork.id}/materials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      if (response.ok) {
        message.success('Материал добавлен к работе');
        materialForm.resetFields();
        loadWorkMaterials(selectedWork.id);
      } else {
        message.error('Ошибка добавления материала');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка подключения к серверу');
    }
  };

  const handleRemoveMaterial = async (materialId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/works/${selectedWork.id}/materials/${materialId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        message.success('Материал удален из работы');
        loadWorkMaterials(selectedWork.id);
      } else {
        message.error('Ошибка удаления материала');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      message.error('Ошибка подключения к серверу');
    }
  };

  const columns = [
    {
      title: 'ID работы',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (text, record) => {
        if (record.isHeader) {
          return null;
        }
        return text;
      }
    },
    {
      title: 'Наименование работы',
      dataIndex: 'name',
      key: 'name',
      width: 300,
      render: (text, record) => {
        if (record.type === 'stage') {
          return <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#1890ff', padding: '8px 0' }}>📁 {text}</div>;
        }
        if (record.type === 'substage') {
          return (
            <div style={{ fontWeight: '600', fontSize: '14px', color: '#52c41a', padding: '4px 0', paddingLeft: '20px' }}>📂 {text}</div>
          );
        }
        return <Text strong>{text}</Text>;
      }
    },
    {
      title: 'Фаза',
      dataIndex: 'phase_name',
      key: 'phase_name',
      width: 150,
      render: (text, record) => {
        if (record.isHeader) return null;
        return text ? <Tag color="blue">{text}</Tag> : '-';
      }
    },
    {
      title: 'Единица измерения',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
      render: (text, record) => {
        if (record.isHeader) return null;
        return text;
      }
    },
    {
      title: 'Цена за единицу',
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: 120,
      render: (value, record) => {
        if (record.isHeader) return null;
        return value ? `${parseFloat(value).toFixed(2)} ₽` : '-';
      }
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_, record) => {
        if (record.isHeader) return null;
        return (
          <Space>
            <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)} size="small" />
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
            <Button
              type="link"
              icon={<LinkOutlined />}
              onClick={() => handleManageMaterials(record)}
              size="small"
              title="Управление материалами"
            />
            <Button type="link" icon={<DeleteOutlined />} danger size="small" />
          </Space>
        );
      }
    }
  ];

  // Статистика
  const actualWorks = filteredWorks.filter((item) => item.type === 'work');
  const stats = {
    total: actualWorks.length,
    phases: [...new Set(actualWorks.filter((w) => w.phase_name).map((w) => w.phase_name))].length,
    avgPrice:
      actualWorks.length > 0
        ? actualWorks.filter((w) => w.unit_price).reduce((sum, w) => sum + w.unit_price, 0) / actualWorks.filter((w) => w.unit_price).length
        : 0
  };

  return (
    <>
      <MainCard title="Справочник работ">
        {/* Статистика */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="Всего работ" value={stats.total} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Активных фаз" value={stats.phases} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Средняя цена" value={stats.avgPrice} precision={2} suffix="₽" valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="Система" value="Works Ref 2.0" valueStyle={{ color: '#722ed1' }} />
            </Card>
          </Col>
        </Row>

        {/* Кнопки управления */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Добавить работу
            </Button>
            <Button onClick={loadWorks}>Обновить</Button>
          </Space>

          <Input.Search
            placeholder="Поиск работ..."
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            onSearch={handleSearch}
          />
        </div>

        {/* Таблица работ */}
        <Table
          columns={columns}
          dataSource={filteredWorks}
          rowKey={(record) => record.key || record.id}
          loading={loading}
          pagination={{
            pageSize: 50,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} из ${total} элементов`
          }}
          scroll={{ x: 900 }}
          rowClassName={(record) => {
            if (record.type === 'stage') return 'stage-row';
            if (record.type === 'substage') return 'substage-row';
            return 'work-row';
          }}
          onRow={(record) => {
            if (record.isHeader) {
              return {
                style: {
                  backgroundColor: record.type === 'stage' ? '#f0f8ff' : '#f6ffed',
                  cursor: 'default',
                  fontWeight: record.type === 'stage' ? 'bold' : '600'
                }
              };
            }
            return {
              style: {
                transition: 'background-color 0.2s'
              },
              onMouseEnter: (e) => {
                e.target.parentElement.style.backgroundColor = '#fafafa';
              },
              onMouseLeave: (e) => {
                e.target.parentElement.style.backgroundColor = '';
              }
            };
          }}
        />

        {/* Модальное окно для создания/редактирования */}
        <Modal
          title={modalMode === 'create' ? 'Создание работы' : modalMode === 'edit' ? 'Редактирование работы' : 'Просмотр работы'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={
            modalMode === 'view'
              ? [
                  <Button key="close" onClick={() => setModalVisible(false)}>
                    Закрыть
                  </Button>
                ]
              : [
                  <Button key="cancel" onClick={() => setModalVisible(false)}>
                    Отмена
                  </Button>,
                  <Button key="submit" type="primary" onClick={() => form.submit()}>
                    {modalMode === 'create' ? 'Создать' : 'Сохранить'}
                  </Button>
                ]
          }
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSave} disabled={modalMode === 'view'}>
            <Form.Item name="id" label="ID работы" rules={[{ required: true, message: 'Введите ID работы' }]}>
              <Input placeholder="Например: w.001" />
            </Form.Item>

            <Form.Item name="name" label="Наименование работы" rules={[{ required: true, message: 'Введите наименование работы' }]}>
              <Input placeholder="Наименование работы" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="unit" label="Единица измерения">
                  <Select placeholder="Выберите единицу">
                    <Option value="м2">м²</Option>
                    <Option value="м3">м³</Option>
                    <Option value="м">м</Option>
                    <Option value="шт">шт</Option>
                    <Option value="т">т</Option>
                    <Option value="кг">кг</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="unit_price" label="Цена за единицу (₽)">
                  <InputNumber placeholder="0.00" min={0} precision={2} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="phase_id" label="Фаза">
              <Select placeholder="Выберите фазу" allowClear>
                {phases.map((phase) => (
                  <Option key={phase.id} value={phase.id}>
                    {phase.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Form>
        </Modal>

        {/* Модальное окно для управления материалами работы */}
        <Modal
          title={`Материалы работы: ${selectedWork?.name || ''}`}
          open={materialModalVisible}
          onCancel={() => setMaterialModalVisible(false)}
          width={800}
          footer={[
            <Button key="close" onClick={() => setMaterialModalVisible(false)}>
              Закрыть
            </Button>
          ]}
        >
          <div style={{ marginBottom: 16 }}>
            <Text strong>Добавить материал к работе</Text>
            <Form form={materialForm} layout="inline" onFinish={handleAddMaterial} style={{ marginTop: 8 }}>
              <Form.Item name="material_id" rules={[{ required: true, message: 'Выберите материал' }]}>
                <Select placeholder="Выберите материал" style={{ width: 200 }}>
                  {materials.map((material) => (
                    <Option key={material.id} value={material.id}>
                      {material.name} ({material.unit_price ? `${material.unit_price} ₽/${material.unit}` : 'цена не указана'})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item name="consumption_per_work_unit" rules={[{ required: true, message: 'Введите расход' }]}>
                <InputNumber placeholder="Расход на ед. работы" min={0} precision={6} style={{ width: 150 }} />
              </Form.Item>
              <Form.Item name="waste_coeff" initialValue={1.0}>
                <InputNumber placeholder="Коэф. отходов" min={0} step={0.1} precision={3} style={{ width: 120 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit">
                  Добавить
                </Button>
              </Form.Item>
            </Form>
          </div>

          <Divider />

          <Table
            columns={[
              {
                title: 'Материал',
                dataIndex: 'material_name',
                key: 'material_name',
                width: 200
              },
              {
                title: 'Расход на ед.',
                dataIndex: 'consumption_per_work_unit',
                key: 'consumption_per_work_unit',
                width: 120,
                render: (value) => (value ? parseFloat(value).toFixed(6) : '-')
              },
              {
                title: 'Коэф. отходов',
                dataIndex: 'waste_coeff',
                key: 'waste_coeff',
                width: 100,
                render: (value) => (value ? parseFloat(value).toFixed(3) : '1.000')
              },
              {
                title: 'Итого расход',
                dataIndex: 'total_consumption',
                key: 'total_consumption',
                width: 120,
                render: (value) => (value ? parseFloat(value).toFixed(6) : '-')
              },
              {
                title: 'Стоимость',
                dataIndex: 'material_cost_per_work_unit',
                key: 'material_cost_per_work_unit',
                width: 120,
                render: (value) => (value ? `${parseFloat(value).toFixed(2)} ₽` : '-')
              },
              {
                title: 'Действия',
                key: 'actions',
                width: 80,
                render: (_, record) => (
                  <Popconfirm
                    title="Удалить материал из работы?"
                    onConfirm={() => handleRemoveMaterial(record.material_id)}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button type="link" icon={<DeleteOutlined />} danger size="small" />
                  </Popconfirm>
                )
              }
            ]}
            dataSource={workMaterials}
            rowKey="material_id"
            pagination={false}
            size="small"
            scroll={{ x: 600 }}
          />
        </Modal>
      </MainCard>
    </>
  );
}
