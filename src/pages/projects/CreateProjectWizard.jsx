import React, { useState } from 'react';
import { 
  Steps, 
  Button, 
  Form, 
  Input, 
  DatePicker, 
  Card,
  Row,
  Col,
  message,
  Space,
  Typography,
  Divider,
  Result
} from 'antd';
import { 
  ProjectOutlined, 
  FileTextOutlined, 
  CheckCircleOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  SaveOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

// Импортируем ПОЛНЫЙ компонент параметров объекта
import ObjectParametersPage from '../calculations/objectParameters';

const { Step } = Steps;
const { Title, Text } = Typography;

const API_BASE_URL = 'http://localhost:3001/api';

const getAuthToken = () => localStorage.getItem('authToken');

const CreateProjectWizard = () => {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Данные проекта
  const [projectData, setProjectData] = useState({
    customerName: '',
    objectAddress: '',
    contractorName: '',
    contractNumber: '',
    deadline: null
  });
  
  // ID созданного проекта (заполнится после шага 1)
  const [createdProjectId, setCreatedProjectId] = useState(null);
  
  // Данные параметров объекта (заполнятся на шаге 2)
  const [objectParamsData, setObjectParamsData] = useState(null);
  
  const [form] = Form.useForm();

  // Шаг 1: Основная информация о проекте
  const renderStep1 = () => (
    <Card>
      <Title level={4}>
        <ProjectOutlined style={{ marginRight: 8, color: '#1890ff' }} />
        Основная информация о проекте
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        Заполните основные данные строительного проекта
      </Text>
      
      <Form
        form={form}
        layout="vertical"
        initialValues={projectData}
        onValuesChange={(changedValues, allValues) => {
          setProjectData(allValues);
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Заказчик"
              name="customerName"
              rules={[{ required: true, message: 'Укажите заказчика' }]}
            >
              <Input 
                placeholder="ООО 'Строй Групп'" 
                size="large"
              />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label="Подрядчик"
              name="contractorName"
              rules={[{ required: true, message: 'Укажите подрядчика' }]}
            >
              <Input 
                placeholder="ООО 'РемСтрой'" 
                size="large"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Адрес объекта"
          name="objectAddress"
          rules={[{ required: true, message: 'Укажите адрес объекта' }]}
        >
          <Input.TextArea 
            placeholder="г. Москва, ул. Примерная, д. 1" 
            rows={2}
            size="large"
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Номер договора"
              name="contractNumber"
              rules={[{ required: true, message: 'Укажите номер договора' }]}
            >
              <Input 
                placeholder="Д-2025/001" 
                size="large"
              />
            </Form.Item>
          </Col>
          
          <Col span={12}>
            <Form.Item
              label="Срок выполнения работ"
              name="deadline"
              rules={[{ required: true, message: 'Укажите срок' }]}
            >
              <DatePicker 
                style={{ width: '100%' }} 
                size="large"
                format="DD.MM.YYYY"
                placeholder="Выберите дату"
              />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Card>
  );

  // Шаг 2: Параметры объекта
  const renderStep2 = () => (
    <Card>
      <Title level={4}>
        <FileTextOutlined style={{ marginRight: 8, color: '#52c41a' }} />
        Параметры объекта
      </Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        Укажите технические характеристики строительного объекта
      </Text>
      
      {createdProjectId ? (
        <div style={{ 
          padding: 0, 
          backgroundColor: 'transparent',
          border: 'none',
          width: '100%',
          margin: '0 -24px'  // Компенсация padding родительской Card
        }}>
          <ObjectParametersPage />
        </div>
      ) : (
        <Text type="warning">Сначала создайте проект на Шаге 1</Text>
      )}
    </Card>
  );

  // Шаг 3: Завершение
  const renderStep3 = () => (
    <Card>
      <Result
        status="success"
        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
        title="Проект успешно создан!"
        subTitle={`Проект "${projectData.customerName}" добавлен в систему`}
        extra={[
          <Space key="actions" size="large" direction="vertical" style={{ width: '100%' }}>
            <Card size="small" style={{ textAlign: 'left', backgroundColor: '#f6ffed' }}>
              <Title level={5}>Что создано:</Title>
              <Text>✅ Проект с основной информацией</Text><br/>
              <Text>✅ Параметры объекта сохранены</Text><br/>
              <Text>✅ Помещения добавлены в систему</Text><br/>
              {createdProjectId && (
                <>
                  <Divider style={{ margin: '12px 0' }} />
                  <Text type="secondary">ID проекта: {createdProjectId}</Text>
                </>
              )}
            </Card>
            
            <Space>
              <Button 
                type="primary" 
                size="large"
                onClick={() => navigate(`/projects/${createdProjectId}`)}
              >
                Открыть проект
              </Button>
              <Button 
                size="large"
                onClick={() => navigate('/projects/storage')}
              >
                К списку проектов
              </Button>
              <Button 
                size="large"
                onClick={() => {
                  // Сброс и создание нового проекта
                  setCurrent(0);
                  setCreatedProjectId(null);
                  setProjectData({
                    customerName: '',
                    objectAddress: '',
                    contractorName: '',
                    contractNumber: '',
                    deadline: null
                  });
                  form.resetFields();
                }}
              >
                Создать еще проект
              </Button>
            </Space>
          </Space>
        ]}
      />
    </Card>
  );

  // Создание проекта (после шага 1)
  const createProject = async () => {
    try {
      setLoading(true);
      
      const token = getAuthToken();
      if (!token) {
        message.error('Требуется авторизация');
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerName: projectData.customerName,
          objectAddress: projectData.objectAddress,
          contractorName: projectData.contractorName,
          contractNumber: projectData.contractNumber,
          deadline: projectData.deadline ? projectData.deadline.format('YYYY-MM-DD') : null
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCreatedProjectId(data.project.id);
        message.success('Проект создан!');
        console.log('✅ Проект создан, ID:', data.project.id);
        return true;
      } else {
        message.error(data.error || 'Ошибка создания проекта');
        return false;
      }
    } catch (error) {
      console.error('Ошибка создания проекта:', error);
      message.error('Ошибка соединения с сервером');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Переход на следующий шаг
  const next = async () => {
    if (current === 0) {
      // Валидация формы на шаге 1
      try {
        await form.validateFields();
        
        // Создаем проект
        const success = await createProject();
        if (success) {
          setCurrent(current + 1);
        }
      } catch (error) {
        message.error('Пожалуйста, заполните все обязательные поля');
      }
    } else if (current === 1) {
      // На шаге 2 просто переходим дальше
      // Параметры объекта сохраняются автоматически
      setCurrent(current + 1);
    }
  };

  // Возврат на предыдущий шаг
  const prev = () => {
    setCurrent(current - 1);
  };

  const steps = [
    {
      title: 'Проект',
      description: 'Основная информация',
      icon: <ProjectOutlined />,
      content: renderStep1()
    },
    {
      title: 'Параметры объекта',
      description: 'Технические характеристики',
      icon: <FileTextOutlined />,
      content: renderStep2()
    },
    {
      title: 'Готово',
      description: 'Завершение',
      icon: <CheckCircleOutlined />,
      content: renderStep3()
    }
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      <Card style={{ maxWidth: current === 1 ? '100%' : 1200, margin: '0 auto', width: '100%' }}>
        <Title level={2} style={{ marginBottom: 24 }}>
          <ProjectOutlined style={{ marginRight: 12 }} />
          Создание нового проекта
        </Title>

        <Steps current={current} style={{ marginBottom: 32 }}>
          {steps.map((step, index) => (
            <Step 
              key={index} 
              title={step.title} 
              description={step.description}
              icon={step.icon}
            />
          ))}
        </Steps>

        <div style={{ minHeight: '400px', marginBottom: 24, width: '100%' }}>
          {steps[current].content}
        </div>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <Button 
            size="large"
            onClick={() => navigate('/projects/storage')}
            icon={<ArrowLeftOutlined />}
          >
            Отмена
          </Button>

          <Space>
            {current > 0 && current < steps.length - 1 && (
              <Button 
                size="large" 
                onClick={prev}
                icon={<ArrowLeftOutlined />}
              >
                Назад
              </Button>
            )}
            
            {current < steps.length - 1 && (
              <Button 
                type="primary" 
                size="large"
                onClick={next}
                loading={loading}
                icon={current === 0 ? <SaveOutlined /> : <ArrowRightOutlined />}
              >
                {current === 0 ? 'Создать проект' : 'Далее'}
              </Button>
            )}
          </Space>
        </div>
      </Card>
    </div>
  );
};

export default CreateProjectWizard;

