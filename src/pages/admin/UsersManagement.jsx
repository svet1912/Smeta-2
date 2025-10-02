import { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';

const { Title, Text } = Typography;
const { Option } = Select;

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form] = Form.useForm();

  // Загрузка данных
  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api-proxy/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      const data = await response.json();
      console.log('Users response:', data); // Отладочный вывод
      // Проверяем, что каждый пользователь имеет массив ролей
      const normalizedData = Array.isArray(data) ? data.map(user => ({
        ...user,
        roles: Array.isArray(user.roles) ? user.roles : []
      })) : [];
      setUsers(normalizedData);
    } catch (error) {
      console.error('Error loading users:', error); // Отладочный вывод
      message.error('Ошибка загрузки пользователей');
      setUsers([]); // Устанавливаем пустой массив в случае ошибки
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const response = await fetch('/api-proxy/roles', {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      const data = await response.json();
      console.log('Roles response:', data); // Отладочный вывод
      // Проверяем, что data это массив, иначе берем пустой массив
      setRoles(Array.isArray(data) ? data : data?.roles || []);
    } catch (error) {
      console.error('Error loading roles:', error); // Отладочный вывод
      message.error('Ошибка загрузки ролей');
      setRoles([]); // Устанавливаем пустой массив в случае ошибки
    }
  };

  const loadUserRoles = async (userId) => {
    try {
      const response = await fetch(`/api-proxy/users/${userId}/roles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });
      const data = await response.json();
      return data;
    } catch (error) {
      return [];
    }
  };

  useEffect(() => {
    loadUsers();
    loadRoles();
  }, []);

  // Назначение роли
  const assignRole = async (values) => {
    try {
      const response = await fetch(`/api-proxy/users/${selectedUser.id}/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({ roleId: values.roleId })
      });

      if (response.ok) {
        message.success('Роль успешно назначена');
        setAssignModalVisible(false);
        form.resetFields();
        loadUsers();
      } else {
        message.error('Ошибка назначения роли');
      }
    } catch (error) {
      message.error('Ошибка назначения роли');
    }
  };

  // Отзыв роли
  const revokeRole = async (userId, roleId) => {
    try {
      const response = await fetch(`/api-proxy/users/${userId}/roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
      });

      if (response.ok) {
        message.success('Роль отозвана');
        loadUsers();
      } else {
        message.error('Ошибка отзыва роли');
      }
    } catch (error) {
      message.error('Ошибка отзыва роли');
    }
  };

  // Получение цвета для роли
  const getRoleColor = (roleName) => {
    const colors = {
      super_admin: 'red',
      admin: 'blue',
      project_manager: 'green',
      estimator: 'orange',
      viewer: 'default'
    };
    return colors[roleName] || 'default';
  };

  // Колонки таблицы
  const columns = [
    {
      title: 'Пользователь',
      key: 'user',
      render: (record) => (
        <Space>
          <UserOutlined />
          <div>
            <div><strong>{record.firstname} {record.lastname}</strong></div>
            <Text type="secondary">{record.email}</Text>
          </div>
        </Space>
      )
    },
    {
      title: 'Компания',
      dataIndex: 'company',
      key: 'company'
    },
    {
      title: 'Роли',
      key: 'roles',
      render: (record) => (
        <Space wrap>
          {Array.isArray(record.roles) && record.roles.length > 0 ? 
            record.roles.map(role => (
              <Tag 
                key={role.id} 
                color={getRoleColor(role.name)}
                closable={role.name !== 'super_admin'}
                onClose={() => revokeRole(record.id, role.id)}
              >
                {role.name === 'super_admin' && <CrownOutlined />}
                {role.description}
              </Tag>
            )) : <Text type="secondary">Нет ролей</Text>}
        </Space>
      )
    },
    {
      title: 'Статус',
      key: 'status',
      render: (record) => (
        <Tag color={record.is_active ? 'green' : 'red'}>
          {record.is_active ? 'Активен' : 'Неактивен'}
        </Tag>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (record) => (
        <Space>
          <Tooltip title="Назначить роль">
            <Button 
              type="primary" 
              icon={<UserAddOutlined />}
              onClick={() => {
                setSelectedUser(record);
                setAssignModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title="Редактировать">
            <Button icon={<EditOutlined />} />
          </Tooltip>
          {record.roles?.some(r => r.name === 'super_admin') ? null : (
            <Popconfirm
              title="Деактивировать пользователя?"
              onConfirm={() => {/* TODO: реализовать */}}
            >
              <Button danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // Статистика
  const stats = {
    total: users.length,
    active: users.filter(u => u.is_active).length,
    admins: users.filter(u => u.roles?.some(r => r.name === 'admin')).length,
    superAdmins: users.filter(u => u.roles?.some(r => r.name === 'super_admin')).length
  };

  return (
    <div>
      <MainCard title="Управление пользователями и ролями">
        {/* Статистика */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Всего пользователей"
                value={stats.total}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Активных"
                value={stats.active}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Администраторов"
                value={stats.admins}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Суперадминов"
                value={stats.superAdmins}
                prefix={<CrownOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Действия */}
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />}>
              Добавить пользователя
            </Button>
            <Button onClick={loadUsers}>
              Обновить
            </Button>
          </Space>
        </div>

        {/* Таблица пользователей */}
        <Table
          columns={columns}
          dataSource={users}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Всего: ${total} пользователей`
          }}
        />
      </MainCard>

      {/* Модальное окно назначения роли */}
      <Modal
        title={`Назначить роль пользователю: ${selectedUser?.firstname} ${selectedUser?.lastname}`}
        open={assignModalVisible}
        onOk={() => form.submit()}
        onCancel={() => {
          setAssignModalVisible(false);
          form.resetFields();
        }}
        okText="Назначить"
        cancelText="Отмена"
      >
        <Form
          form={form}
          onFinish={assignRole}
          layout="vertical"
        >
          <Form.Item
            name="roleId"
            label="Выберите роль"
            rules={[{ required: true, message: 'Выберите роль' }]}
          >
            <Select placeholder="Выберите роль для назначения">
              {Array.isArray(roles) && roles.map(role => (
                <Option key={role.id} value={role.id}>
                  <Space>
                    {role.name === 'super_admin' && <CrownOutlined />}
                    <Tag color={getRoleColor(role.name)}>{role.name}</Tag>
                    {role.description}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersManagement;