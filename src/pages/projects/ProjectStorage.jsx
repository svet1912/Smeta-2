import { useState, useEffect } from 'react';

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
  IconButton,
  Menu,
  Divider,
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
import FilterOutlined from '@ant-design/icons/FilterOutlined';
import MoreOutlined from '@ant-design/icons/MoreOutlined';
import EditOutlined from '@ant-design/icons/EditOutlined';
import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import CalendarOutlined from '@ant-design/icons/CalendarOutlined';
import TeamOutlined from '@ant-design/icons/TeamOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
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
  const { user } = useAuth();
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState('cards');
  const [tabValue, setTabValue] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  // Загрузка проектов при монтировании компонента
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const response = await getProjects();
      if (response.success) {
        // Преобразуем данные из БД в формат для интерфейса
        const transformedProjects = response.data.map(project => ({
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

  // Фильтрация и поиск проектов
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (project.originalData?.contract_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
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
    draft: projects.filter(p => p.status === 'draft').length,
    planning: projects.filter(p => p.status === 'planning').length,
    in_progress: projects.filter(p => p.status === 'in_progress').length,
    completed: projects.filter(p => p.status === 'completed').length,
    on_hold: projects.filter(p => p.status === 'on_hold').length,
    cancelled: projects.filter(p => p.status === 'cancelled').length
  };

  const handleMenuClick = (event, project) => {
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    const statusMap = ['all', 'draft', 'planning', 'in_progress', 'completed', 'on_hold'];
    setFilterStatus(statusMap[newValue] || 'all');
  };

  const handleProjectAction = async (action) => {
    switch (action) {
      case 'view':
        // Перенаправляем на страницу просмотра проекта
        window.location.href = `/projects/${selectedProject?.id}`;
        break;
      case 'edit':
        // Перенаправляем на страницу редактирования проекта
        window.location.href = `/projects/${selectedProject?.id}/edit`;
        break;
      case 'delete':
        if (window.confirm(`Удалить проект "${selectedProject?.name}"?`)) {
          try {
            const response = await deleteProject(selectedProject.id);
            if (response.success) {
              // Обновляем локальный список
              setProjects(prev => prev.filter(p => p.id !== selectedProject?.id));
              alert('Проект успешно удален!');
            } else {
              alert(`Ошибка при удалении проекта: ${response.message}`);
            }
          } catch (error) {
            alert('Произошла ошибка при удалении проекта');
            console.error('Ошибка удаления проекта:', error);
          }
        }
        break;
      default:
        break;
    }
    handleMenuClose();
  };

  // Компонент карточки проекта
  const ProjectCard = ({ project }) => {
    const statusInfo = getStatusInfo(project.status);

    return (
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {project.name}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => handleMenuClick(e, project)}
            >
              <MoreOutlined />
            </IconButton>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
            {project.description}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Chip
              {...statusInfo}
              label={statusInfo.label}
              color={statusInfo.color}
              size="small"
            />
            <Chip
              label={project.priority}
              color={getPriorityColor(project.priority)}
              size="small"
              variant="outlined"
            />
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
            {project.tags.slice(0, 3).map((tag) => (
              <Chip key={tag} label={tag} size="small" variant="outlined" />
            ))}
            {project.tags.length > 3 && (
              <Chip label={`+${project.tags.length - 3}`} size="small" variant="outlined" />
            )}
          </Stack>

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TeamOutlined style={{ fontSize: 16, color: '#666' }} />
              <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.75rem' } }}>
                {project.team.map((member) => (
                  <Avatar key={member.id} alt={member.name} src={member.avatar}>
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

        <CardActions sx={{ p: 2, pt: 0 }}>
          <Button size="small" onClick={() => handleMenuClick({ currentTarget: null }, project)}>
            Подробнее
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarOutlined style={{ fontSize: 14, color: '#666' }} />
            <Typography variant="caption" color="text.secondary">
              {new Date(project.endDate).toLocaleDateString()}
            </Typography>
          </Box>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <ProjectOutlined style={{ fontSize: 24, color: '#1976d2' }} />
          <Typography variant="h4">Хранилище проектов</Typography>
        </Box>
        <Typography variant="body1" color="text.secondary">
          Управляйте всеми строительными проектами в одном месте. Всего проектов: {projects.length}
        </Typography>
      </Paper>

      {/* Фильтры и поиск */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
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
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
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

          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<FilterOutlined />}
              fullWidth
              href="/projects/create"
            >
              Создать проект
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Вкладки по статусам */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label={
            <Badge badgeContent={projectsByStatus.all} color="primary" showZero>
              Все проекты
            </Badge>
          } />
          <Tab label={
            <Badge badgeContent={projectsByStatus.draft} color="default">
              Черновики
            </Badge>
          } />
          <Tab label={
            <Badge badgeContent={projectsByStatus.planning} color="info">
              Планирование
            </Badge>
          } />
          <Tab label={
            <Badge badgeContent={projectsByStatus.in_progress} color="primary">
              В работе
            </Badge>
          } />
          <Tab label={
            <Badge badgeContent={projectsByStatus.completed} color="success">
              Завершенные
            </Badge>
          } />
          <Tab label={
            <Badge badgeContent={projectsByStatus.on_hold} color="warning">
              Приостановленные
            </Badge>
          } />
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
            Измените параметры поиска или создайте новый проект
          </Typography>
          <Button variant="contained" href="/projects/create">
            Создать проект
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {sortedProjects.map((project) => (
            <Grid item xs={12} sm={6} lg={4} key={project.id}>
              <ProjectCard project={project} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Меню действий */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => handleProjectAction('view')}>
          <EyeOutlined style={{ marginRight: 8 }} />
          Просмотр
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleProjectAction('edit')}>
          <EditOutlined style={{ marginRight: 8 }} />
          Редактировать
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleProjectAction('delete')} sx={{ color: 'error.main' }}>
          <DeleteOutlined style={{ marginRight: 8 }} />
          Удалить
        </MenuItem>
      </Menu>
    </Box>
  );
}