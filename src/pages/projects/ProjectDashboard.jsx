import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Button, Grid, Stack, Typography, Box, Card, CardContent, Chip, IconButton, Tabs, Tab, Paper } from '@mui/material';
import AnalyticEcommerce from 'components/cards/statistics/AnalyticEcommerce';
import CustomerEstimate from './CustomerEstimate';
import ObjectParameters from '../calculations/objectParameters.clean';
import EstimateCalculation from '../calculations/estimate';

// API
import { getProject } from 'api/projects';

// assets
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  UserOutlined,
  FileTextOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

// ==============================|| PROJECT DASHBOARD ||============================== //

export default function ProjectDashboard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0); // Открываем сразу "Параметры объекта" (новый компонент)

  // Загрузка данных проекта
  useEffect(() => {
    const loadProject = async () => {
      try {
        setLoading(true);
        const response = await getProject(projectId);

        if (response.success) {
          setProject(response.data);
        } else {
          setError(response.message || 'Не удалось загрузить проект');
        }
      } catch (err) {
        console.error('Ошибка загрузки проекта:', err);
        setError('Произошла ошибка при загрузке проекта');
      } finally {
        setLoading(false);
      }
    };

    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // Функция для получения информации о статусе
  const getStatusInfo = (status) => {
    const statusMap = {
      draft: { label: 'Черновик', color: 'default' },
      planning: { label: 'Планирование', color: 'info' },
      in_progress: { label: 'В работе', color: 'primary' },
      completed: { label: 'Завершен', color: 'success' },
      on_hold: { label: 'Приостановлен', color: 'warning' },
      cancelled: { label: 'Отменен', color: 'error' }
    };
    return statusMap[status] || statusMap.draft;
  };

  // Обработчик возврата к списку проектов
  const handleBackToProjects = () => {
    navigate('/app/projects/storage');
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <Typography variant="h6">Загрузка данных проекта...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          {error}
        </Typography>
        <Button variant="contained" onClick={handleBackToProjects} startIcon={<ArrowLeftOutlined />}>
          Вернуться к проектам
        </Button>
      </Box>
    );
  }

  if (!project) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          textAlign: 'center'
        }}
      >
        <Typography variant="h6" color="error" gutterBottom>
          Проект не найден
        </Typography>
        <Button variant="contained" onClick={handleBackToProjects} startIcon={<ArrowLeftOutlined />}>
          Вернуться к проектам
        </Button>
      </Box>
    );
  }

  const statusInfo = getStatusInfo(project.status);

  return (
    <Box sx={{ p: 2 }}>
      {/* Заголовок */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <IconButton onClick={handleBackToProjects} size="large">
            <ArrowLeftOutlined />
          </IconButton>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 600 }}>
              {project.customer_name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {project.object_address}
            </Typography>
          </Box>
        </Stack>
        <Chip label={statusInfo.label} color={statusInfo.color} variant="filled" />
      </Stack>

      {/* Навигационные вкладки */}
      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto" sx={{ px: 2 }}>
          <Tab icon={<ExclamationCircleOutlined />} label="Параметры объекта" iconPosition="start" />
          <Tab icon={<DollarOutlined />} label="Расчет сметы" iconPosition="start" />
          <Tab icon={<CheckCircleOutlined />} label="График" iconPosition="start" />
          <Tab icon={<FileTextOutlined />} label="Смета заказчика" iconPosition="start" />
          <Tab icon={<CalendarOutlined />} label="Платежи заказчика" iconPosition="start" />
          <Tab icon={<ClockCircleOutlined />} label="Закупки" iconPosition="start" />
          <Tab icon={<UserOutlined />} label="Работы" iconPosition="start" />
          <Tab icon={<FileTextOutlined />} label="Документы" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Информация о проекте */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                <UserOutlined style={{ marginRight: 4, fontSize: 12 }} />
                Подрядчик
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {project.contractor_name}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                <FileTextOutlined style={{ marginRight: 4, fontSize: 12 }} />
                Договор
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {project.contract_number}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                <CalendarOutlined style={{ marginRight: 4, fontSize: 12 }} />
                Создан
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {new Date(project.created_at).toLocaleDateString('ru-RU')}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                <CalendarOutlined style={{ marginRight: 4, fontSize: 12 }} />
                Deadline
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {project.deadline ? new Date(project.deadline).toLocaleDateString('ru-RU') : 'Не указан'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Статистика проекта */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnalyticEcommerce title="Общий прогресс" count="75%" percentage={75} color="primary" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnalyticEcommerce title="Выполнено задач" count="12" extra="18" percentage={67} color="success" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnalyticEcommerce title="Потрачено дней" count="45" extra="60" percentage={75} color="warning" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <AnalyticEcommerce title="Бюджет" count="₽ 2,450,000" percentage={85} color="info" />
        </Grid>
      </Grid>

      {/* Основной контент в зависимости от вкладки */}
      <Paper sx={{ p: 2 }}>
        {tabValue === 0 && <ObjectParameters projectId={projectId} />}
        {tabValue === 1 && <EstimateCalculation projectId={projectId} />}
        {tabValue === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              График работ
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Здесь будет отображен график выполнения работ...
            </Typography>
          </Box>
        )}
        {tabValue === 3 && <CustomerEstimate projectId={projectId} project={project} />}
        {tabValue === 4 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Платежи заказчика
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Здесь будет информация о платежах...
            </Typography>
          </Box>
        )}
        {tabValue === 5 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Закупки
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Здесь будет информация о закупках материалов...
            </Typography>
          </Box>
        )}
        {tabValue === 6 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Работы
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Здесь будет информация о выполняемых работах...
            </Typography>
          </Box>
        )}
        {tabValue === 7 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Документы
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Здесь будут храниться документы проекта...
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
