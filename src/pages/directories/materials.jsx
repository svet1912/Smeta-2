import MainCard from 'components/MainCard';
import {
  Typography,
  Button,
  Table,
  Space,
  Popconfirm,
  message,
  Input,
  Modal,
  Form,
  InputNumber,
  Select,
  Card,
  Image,
  Tag,
  Tooltip
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, LinkOutlined, EyeOutlined } from '@ant-design/icons';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getMaterials, createMaterial, updateMaterial, deleteMaterial } from '../../api/database';

// ==============================|| СПРАВОЧНИК МАТЕРИАЛОВ ||============================== //

// Хук для debounce
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export default function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' или 'edit'
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');

  // Debounce для поиска (300ms задержка)
  const debouncedSearchText = useDebounce(searchText, 300);

  // Загрузка материалов
  const loadMaterials = async () => {
    setLoading(true);
    try {
      const data = await getMaterials();
      if (Array.isArray(data)) {
        setMaterials(data);
      } else if (data && Array.isArray(data.data)) {
        setMaterials(data.data);
      } else {
        console.warn('⚠️ getMaterials вернул не-массив, устанавливаю []');
        setMaterials([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
      message.error('Ошибка загрузки материалов');
    } finally {
      setLoading(false);
    }
  };

  // Мемоизированная фильтрация материалов
  const filteredMaterials = useMemo(() => {
    const safe = Array.isArray(materials) ? materials : [];

    if (!debouncedSearchText) {
      return safe;
    }

    return safe.filter(
      (material) =>
        material &&
        material.name &&
        material.id &&
        (material.name.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
          material.unit?.toLowerCase().includes(debouncedSearchText.toLowerCase()) ||
          material.id.toString().includes(debouncedSearchText))
    );
  }, [materials, debouncedSearchText]);

  // Функция для поиска (без debounce, только обновляет состояние)
  const handleSearch = useCallback((value) => {
    setSearchText(value);
  }, []);

  // Загружаем материалы при монтировании компонента
  useEffect(() => {
    loadMaterials();
  }, []);

  const handleAdd = () => {
    setModalMode('create');
    setSelectedMaterial(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setModalMode('edit');
    setSelectedMaterial(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      await deleteMaterial(id);
      message.success('Материал успешно удален');
      loadMaterials(); // Перезагружаем список
    } catch {
      message.error('Ошибка удаления материала');
    }
  };

  const handleSave = async (values) => {
    try {
      if (modalMode === 'create') {
        await createMaterial(values);
        message.success('Материал успешно создан');
      } else {
        await updateMaterial(selectedMaterial.id, values);
        message.success('Материал успешно обновлен');
      }
      setModalVisible(false);
      loadMaterials(); // Перезагружаем список
    } catch {
      message.error(modalMode === 'create' ? 'Ошибка создания материала' : 'Ошибка обновления материала');
    }
  };

  return (
    <MainCard title="Справочник материалов">
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Добавить материал
        </Button>

        <Input.Search
          placeholder="Поиск материалов..."
          allowClear
          style={{ width: 300 }}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={handleSearch}
        />
      </div>

      {/* Таблица материалов */}
      <Table
        columns={[
          {
            title: 'Изображение',
            dataIndex: 'image_url',
            key: 'image_url',
            width: 80,
            render: (imageUrl, record) =>
              imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={record.name}
                  width={40}
                  height={40}
                  style={{
                    objectFit: 'cover',
                    borderRadius: '6px',
                    border: '1px solid #f0f0f0'
                  }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                />
              ) : (
                <div
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: '#f5f5f5',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999'
                  }}
                >
                  <EyeOutlined />
                </div>
              )
          },
          {
            title: 'ID материала',
            dataIndex: 'id',
            key: 'id',
            width: 120,
            render: (text) => <Tag color="blue">{text}</Tag>
          },
          {
            title: 'Наименование',
            dataIndex: 'name',
            key: 'name',
            render: (text) => <Typography.Text strong>{text}</Typography.Text>
          },
          {
            title: 'Единица',
            dataIndex: 'unit',
            key: 'unit',
            width: 100,
            render: (text) => <Tag color="green">{text}</Tag>
          },
          {
            title: 'Цена за единицу',
            dataIndex: 'unit_price',
            key: 'unit_price',
            width: 120,
            render: (value) => (
              <Typography.Text strong style={{ color: '#1890ff' }}>
                {value ? `${parseFloat(value).toFixed(2)} ₽` : '-'}
              </Typography.Text>
            )
          },
          {
            title: 'Расход',
            dataIndex: 'expenditure',
            key: 'expenditure',
            width: 100,
            render: (value) => (value ? parseFloat(value).toFixed(6) : '-')
          },
          {
            title: 'Вес (кг)',
            dataIndex: 'weight',
            key: 'weight',
            width: 100,
            render: (value) => (value ? parseFloat(value).toFixed(3) : '-')
          },
          {
            title: 'Ссылка на товар',
            dataIndex: 'item_url',
            key: 'item_url',
            width: 120,
            render: (url) =>
              url ? (
                <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => window.open(url, '_blank')}>
                  Открыть
                </Button>
              ) : (
                '-'
              )
          },
          {
            title: 'Действия',
            key: 'actions',
            width: 120,
            render: (_, record) => (
              <Space>
                <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                <Popconfirm
                  title="Удаление материала"
                  description="Вы уверены, что хотите удалить этот материал?"
                  onConfirm={() => handleDelete(record.id)}
                  okText="Да"
                  cancelText="Нет"
                >
                  <Button danger size="small" icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )
          }
        ]}
        dataSource={filteredMaterials}
        rowKey="id"
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} из ${total} материалов`
        }}
        scroll={{ x: 1000 }}
      />

      <div style={{ marginTop: 16, display: 'flex', gap: '20px', color: '#666', flexWrap: 'wrap' }}>
        <Typography.Text type="secondary">
          <strong>Всего материалов:</strong> {Array.isArray(materials) ? materials.length : 0}
        </Typography.Text>
        <Typography.Text type="secondary">
          <strong>С изображениями:</strong> {Array.isArray(materials) ? materials.filter((m) => m && m.image_url).length : 0}
        </Typography.Text>
        <Typography.Text type="secondary">
          <strong>С ссылками:</strong> {Array.isArray(materials) ? materials.filter((m) => m && m.item_url).length : 0}
        </Typography.Text>
        <Typography.Text type="secondary">
          <strong>Средняя цена:</strong>{' '}
          {Array.isArray(materials) && materials.length > 0
            ? `${(materials.reduce((sum, m) => sum + (parseFloat(m.unit_price) || 0), 0) / materials.length).toFixed(2)} ₽`
            : '0 ₽'}
        </Typography.Text>
      </div>

      {/* Модальное окно для создания/редактирования */}
      <Modal
        title={modalMode === 'create' ? 'Создание материала' : 'Редактирование материала'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Отмена
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()}>
            {modalMode === 'create' ? 'Создать' : 'Сохранить'}
          </Button>
        ]}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="id" label="ID материала" rules={[{ required: true, message: 'Введите ID материала' }]}>
            <Input placeholder="Например: m.1001" />
          </Form.Item>

          <Form.Item name="name" label="Наименование материала" rules={[{ required: true, message: 'Введите наименование материала' }]}>
            <Input placeholder="Наименование материала" />
          </Form.Item>

          <Form.Item name="image_url" label="URL изображения">
            <Input placeholder="https://example.com/image.jpg" />
          </Form.Item>

          <Form.Item name="item_url" label="URL товара">
            <Input placeholder="https://example.com/product" />
          </Form.Item>

          <Form.Item name="unit" label="Единица измерения" rules={[{ required: true, message: 'Выберите единицу измерения' }]}>
            <Select placeholder="Выберите единицу">
              <Select.Option value="шт.">шт.</Select.Option>
              <Select.Option value="кг">кг</Select.Option>
              <Select.Option value="л">л</Select.Option>
              <Select.Option value="м">м</Select.Option>
              <Select.Option value="м²">м²</Select.Option>
              <Select.Option value="м³">м³</Select.Option>
              <Select.Option value="т">т</Select.Option>
              <Select.Option value="комплект">комплект</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="unit_price" label="Цена за единицу (руб.)" rules={[{ required: true, message: 'Введите цену' }]}>
            <InputNumber placeholder="0.00" min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="expenditure" label="Расход">
            <InputNumber placeholder="0.000000" min={0} precision={6} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="weight" label="Вес (кг)">
            <InputNumber placeholder="0.000" min={0} precision={3} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </MainCard>
  );
}
