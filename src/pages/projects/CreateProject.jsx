import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Box, Button, TextField, Typography, Grid, Card, CardContent, Paper, Alert, CircularProgress, Chip } from '@mui/material';

// api
import { getCurrentUser } from '../../api/auth';

// assets
import ProjectOutlined from '@ant-design/icons/ProjectOutlined';

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

// ==============================|| CREATE PROJECT PAGE ||============================== //

export default function CreateProject() {
  const navigate = useNavigate();
  const [project, setProject] = useState({
    customerName: '', // ФИО заказчика
    objectAddress: '', // Адрес объекта
    contractorName: '', // Название подрядчика
    contractNumber: '', // Номер договора
    deadline: '' // Срок выполнения
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Проверка аутентификации при загрузке
  useEffect(() => {
    checkAuthentication();
  }, [checkAuthentication]);

  const checkAuthentication = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await getCurrentUser();
      if (response.success) {
        setCurrentUser(response.user);
      } else {
        navigate('/login');
      }
    } catch (error) {
      console.error('Ошибка проверки аутентификации:', error);
      navigate('/login');
    } finally {
      setAuthChecked(true);
    }
  }, [navigate]);

  const handleChange = (field) => (event) => {
    setProject((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleCreateProject = async () => {
    // Проверка заполненности обязательных полей
    if (!project.customerName || !project.objectAddress || !project.contractorName || !project.contractNumber || !project.deadline) {
      setMessage({
        type: 'error',
        text: 'Пожалуйста, заполните все поля!'
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(project)
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: `Проект успешно создан! ID: ${data.project.id}`
        });

        // Сброс формы после создания
        setProject({
          customerName: '',
          objectAddress: '',
          contractorName: '',
          contractNumber: '',
          deadline: ''
        });
      } else {
        if (response.status === 401) {
          navigate('/login');
          return;
        }

        setMessage({
          type: 'error',
          text: data.error || 'Ошибка при создании проекта'
        });
      }
    } catch (error) {
      console.error('Ошибка API:', error);
      setMessage({
        type: 'error',
        text: 'Ошибка соединения с сервером'
      });
    } finally {
      setLoading(false);
    }
  };

  // Показываем загрузку пока проверяется аутентификация
  if (!authChecked) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Заголовок */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ProjectOutlined style={{ fontSize: 24, color: '#1976d2' }} />
            <Typography variant="h4">Создание нового проекта</Typography>
          </Box>

          {/* Информация о пользователе */}
          {currentUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Создается как:
              </Typography>
              <Chip label={`${currentUser.email} (${currentUser.role})`} color="primary" variant="outlined" size="small" />
              {currentUser.tenantName && <Chip label={currentUser.tenantName} color="secondary" variant="outlined" size="small" />}
            </Box>
          )}
        </Box>
      </Paper>

      {/* Форма создания проекта */}
      <Card>
        <CardContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            <Grid size={12}>
              <Typography variant="h6" gutterBottom color="primary">
                Информация о проекте
              </Typography>
            </Grid>

            {/* Сообщения об ошибках или успехе */}
            {message && (
              <Grid size={12}>
                <Alert severity={message.type} sx={{ mb: 2 }}>
                  {message.text}
                </Alert>
              </Grid>
            )}

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Заказчик (ФИО) *"
                value={project.customerName}
                onChange={handleChange('customerName')}
                variant="outlined"
                placeholder="Иванов Иван Иванович"
                required
                disabled={loading}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Подрядчик (Название) *"
                value={project.contractorName}
                onChange={handleChange('contractorName')}
                variant="outlined"
                placeholder="ООО 'СтройКомпания'"
                required
                disabled={loading}
              />
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                label="Адрес объекта *"
                value={project.objectAddress}
                onChange={handleChange('objectAddress')}
                variant="outlined"
                placeholder="г. Москва, ул. Примерная, д. 123, кв. 45"
                required
                disabled={loading}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Договор № *"
                value={project.contractNumber}
                onChange={handleChange('contractNumber')}
                variant="outlined"
                placeholder="001/2024"
                required
                disabled={loading}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label="Срок выполнения *"
                type="date"
                value={project.deadline}
                onChange={handleChange('deadline')}
                variant="outlined"
                InputLabelProps={{ shrink: true }}
                required
                disabled={loading}
              />
            </Grid>

            <Grid size={12}>
              <Box sx={{ display: 'flex', justifyContent: 'center', pt: 3 }}>
                <Button
                  variant="contained"
                  onClick={handleCreateProject}
                  sx={{ px: 4, py: 1.5 }}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {loading ? 'Создание...' : 'Создать проект'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
