import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  AvatarGroup,
  LinearProgress,
  Paper,
  InputAdornment,
  Tabs,
  Tab,
  Badge,
  Alert,
  CircularProgress
} from '@mui/material';
import { Stack } from '@mui/material';

// project imports
import { getProjects, deleteProject } from 'api/projects';
import { useAuth } from 'contexts/AuthContext';

// assets
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import TeamOutlined from '@ant-design/icons/TeamOutlined';
import ProjectOutlined from '@ant-design/icons/ProjectOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import ExclamationCircleOutlined from '@ant-design/icons/ExclamationCircleOutlined';
import PauseCircleOutlined from '@ant-design/icons/PauseCircleOutlined';
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined';

// Функция для получения информации о статусе проекта
const getStatusInfo = (status) => {
  const statusMap = {
    draft: { label: 'Черновик', color: 'default', icon: <EditOutlined /> },
    planning: { label: 'Планирование', color: 'info', icon: <ClockCircleOutlined /> },
    in_progress: { label: 'В работе', color: 'primary', icon: <ExclamationCircleOutlined /> },
    completed: { label: 'Завершен', color: 'success', icon: <CheckCircleOutlined /> },
    on_hold: { label: 'Приостановлен', color: 'warning', icon: <PauseCircleOutlined /> },
    cancelled: { label: 'Отменен', color: 'error', icon: <CloseCircleOutlined /> }
  };
  return statusMap[status] || statusMap.draft;
};

const getPriorityColor = (priority) => {
  const priorityColors = {
    low: 'default',
    medium: 'primary',
    high: 'warning',
    critical: 'error'
  };
  return priorityColors[priority] || 'default';
};

export default function ProjectStorage() {
  // eslint-disable-next-line no-unused-vars
  const { user } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  // eslint-disable-next-line no-unused-vars
  const [viewMode, setViewMode] = useState('cards');
  const [tabValue, setTabValue] = useState(0);

  // Загрузка проектов при монтировании компонента
  useEffect(() => {
    loadProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await getProjects();
      if (response.success) {
        // Преобразуем данные из БД в формат для интерфейса
        const transformedProjects = (response.data.items || []).map((project) => ({
          id: project.id,
          name: `${project.customer_name} - ${project.object_address}`,
          description: `Подрядчик: ${project.contractor_name}. Договор: ${project.contract_number}`,
          status: project.status || 'draft',
          priority: 'medium', // По умолчанию
          progress: 0, // Будем рассчитывать позже
          startDate: project.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          endDate: project.deadline || new Date().toISOString().split('T')[0],
          budget: 'По запросу',
          client: project.customer_name,
          tags: ['Строительство', 'Смета', project.contractor_name.split(' ')[0]],
          team: [{ id: project.user_id, name: project.created_by_name || 'Пользователь', avatar: null }],
          tasksTotal: 1,
          tasksCompleted: project.status === 'completed' ? 1 : 0,
          lastActivity: formatLastActivity(project.updated_at || project.created_at),
          category: 'construction',
          // Добавляем оригинальные данные
          originalData: project
        }));
        setProjects(transformedProjects);
      } else {
        setError(response.message);
      }
    } catch (error) {
      setError('Ошибка загрузки проектов');
      console.error('Ошибка загрузки проектов:', error);
    } finally {
      setLoading(false);
    }
  };

  // Форматирование времени последней активности
  const formatLastActivity = (dateString) => {
    if (!dateString) return 'Недавно';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Вчера';
    if (diffDays < 7) return `${diffDays} дней назад`;
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)} недель назад`;
    return `${Math.ceil(diffDays / 30)} месяцев назад`;
  };

  // Открытие проекта
  const handleOpenProject = (project) => {
    // Переходим к странице проекта
    console.log('Открытие проекта:', project.id);
    navigate(`/app/projects/${project.id}`);
  };

  // Удаление проекта
  const handleDeleteProject = async (project) => {
    if (window.confirm(`Вы уверены, что хотите удалить проект "${project.name}"?`)) {
      try {
        const response = await deleteProject(project.id);
        if (response.success) {
          setProjects(projects.filter((p) => p.id !== project.id));
          console.log('Проект удален:', project.id);
        } else {
          console.error('Ошибка удаления проекта:', response.message);
        }
      } catch (error) {
        console.error('Ошибка удаления проекта:', error);
      }
    }
  };

  // Фильтрация и поиск проектов
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.originalData?.contract_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = filterStatus === 'all' || project.status === filterStatus;
    const matchesCategory = filterCategory === 'all' || project.category === filterCategory;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Сортировка проектов
  const sortedProjects = filteredProjects.sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'status':
        return a.status.localeCompare(b.status);
      case 'priority':
        const priorityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      case 'recent':
      default:
        return new Date(b.startDate) - new Date(a.startDate);
    }
  });

  // Группировка по статусам для вкладок
  const projectsByStatus = {
    all: filteredProjects.length,
    draft: projects.filter((p) => p.status === 'draft').length,
    planning: projects.filter((p) => p.status === 'planning').length,
    in_progress: projects.filter((p) => p.status === 'in_progress').length,
    completed: projects.filter((p) => p.status === 'completed').length,
    on_hold: projects.filter((p) => p.status === 'on_hold').length,
    cancelled: projects.filter((p) => p.status === 'cancelled').length
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    const statusMap = ['all', 'draft', 'planning', 'in_progress', 'completed', 'on_hold'];
    setFilterStatus(statusMap[newValue] || 'all');
  };

  // Компонент карточки проекта
  const ProjectCard = ({ project }) => {
    const statusInfo = getStatusInfo(project.status);

    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {project.name}
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
            {project.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip {...statusInfo} label={statusInfo.label} color={statusInfo.color} size="small" />
            <Chip label={project.priority} color={getPriorityColor(project.priority)} size="small" variant="outlined" />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2">Прогресс</Typography>
              <Typography variant="body2">{project.progress}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={project.progress}
              color={project.progress === 100 ? 'success' : 'primary'}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            {project.tags.slice(0, 3).map((tag, index) => (
              <Chip key={`${tag}-${index}`} label={tag} size="small" variant="outlined" />
            ))}
            {project.tags.length > 3 && <Chip label={`+${project.tags.length - 3}`} size="small" variant="outlined" />}
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamOutlined style={{ fontSize: 16, color: '#666' }} />
              <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                {project.team.map((member, index) => (
                  <Avatar key={member.id || `member-${index}`} alt={member.name} src={member.avatar}>
                    {member.name.charAt(0)}
                  </Avatar>
                ))}
              </AvatarGroup>
            </Box>
            <Typography variant="caption" color="text.secondary">
              {project.lastActivity}
            </Typography>
          </Box>
        </CardContent>

        <CardActions sx={{ p: 2, pt: 0, display: 'flex', gap: 1 }}>
          <Button size="small" variant="contained" startIcon={<EyeOutlined />} onClick={() => handleOpenProject(project)} sx={{ flex: 1 }}>
            Открыть
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlined />}
            onClick={() => handleDeleteProject(project)}
            sx={{ flex: 1 }}
          >
            Удалить
          </Button>
        </CardActions>
      </Card>
    );
  };

  // Состояние загрузки
  if (loading) {
    return (
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Состояние ошибки
  if (error) {
    return (
      <Box sx={{ width: '100%' }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={loadProjects}>
          Повторить попытку
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Заголовок */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ProjectOutlined style={{ fontSize: 24, color: '#1976d2' }} />
            <Typography variant="h4">Хранилище проектов</Typography>
          </Box>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/app/projects/create-wizard')}
            sx={{
              minWidth: 140,
              height: 40,
              fontWeight: 600
            }}
          >
            Создать проект
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Управляйте всеми строительными проектами в одном месте. Всего проектов: {projects.length}
        </Typography>
      </Paper>

      {/* Фильтры и поиск */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск проектов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined />
                  </InputAdornment>
                )
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <MenuItem value="all">Все статусы</MenuItem>
                <MenuItem value="draft">Черновик</MenuItem>
                <MenuItem value="planning">Планирование</MenuItem>
                <MenuItem value="in_progress">В работе</MenuItem>
                <MenuItem value="completed">Завершен</MenuItem>
                <MenuItem value="on_hold">Приостановлен</MenuItem>
                <MenuItem value="cancelled">Отменен</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Категория</InputLabel>
              <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <MenuItem value="all">Все категории</MenuItem>
                <MenuItem value="construction">Строительство</MenuItem>
                <MenuItem value="reconstruction">Реконструкция</MenuItem>
                <MenuItem value="repair">Ремонт</MenuItem>
                <MenuItem value="design">Проектирование</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, md: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Сортировка</InputLabel>
              <Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <MenuItem value="recent">По дате</MenuItem>
                <MenuItem value="name">По названию</MenuItem>
                <MenuItem value="status">По статусу</MenuItem>
                <MenuItem value="priority">По приоритету</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>

      {/* Вкладки по статусам */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab
            label={
              <Badge badgeContent={projectsByStatus.all} color="primary" showZero>
                Все проекты
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={projectsByStatus.draft} color="default">
                Черновики
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={projectsByStatus.planning} color="info">
                Планирование
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={projectsByStatus.in_progress} color="primary">
                В работе
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={projectsByStatus.completed} color="success">
                Завершенные
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={projectsByStatus.on_hold} color="warning">
                Приостановленные
              </Badge>
            }
          />
        </Tabs>
      </Paper>

      {/* Список проектов */}
      {sortedProjects.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ProjectOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Проекты не найдены
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Измените параметры поиска или фильтры
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {sortedProjects.map((project) => (
            <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={project.id}>
              <ProjectCard project={project} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
