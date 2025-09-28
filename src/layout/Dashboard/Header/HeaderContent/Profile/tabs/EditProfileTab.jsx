import { useState, useEffect } from 'react';

// material-ui
import {
  Box,
  Button,
  TextField,
  Typography,
  Grid,
  Avatar,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress
} from '@mui/material';
import { Stack } from '@mui/material';

// project imports
import { useAuth } from 'contexts/AuthContext';
import { updateUserProfile } from 'api/auth';

// assets
import avatar1 from 'assets/images/users/avatar-1.png';

// ==============================|| PROFILE TAB - EDIT PROFILE ||============================== //

export default function EditProfileTab() {
  const { user, updateUser } = useAuth();
  
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    position: '',
    company: '',
    bio: '',
    location: ''
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Загрузка данных пользователя при монтировании компонента
  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstname || '',
        lastName: user.lastname || '',
        email: user.email || '',
        phone: user.phone || '',
        position: user.position || '',
        company: user.company || '',
        bio: user.bio || '',
        location: user.location || ''
      });
    }
  }, [user]);

  // Вычисление процента заполненности профиля
  const calculateCompletion = () => {
    const fields = [profile.firstName, profile.lastName, profile.email, profile.phone, 
                   profile.position, profile.company, profile.bio, profile.location];
    const filled = fields.filter(field => field && field.trim()).length;
    return Math.round((filled / fields.length) * 100);
  };

  const [profileCompletion, setProfileCompletion] = useState(0);

  useEffect(() => {
    setProfileCompletion(calculateCompletion());
  }, [profile]);

  const handleChange = (field) => (event) => {
    setProfile(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await updateUserProfile({
        firstname: profile.firstName,
        lastname: profile.lastName,
        company: profile.company,
        phone: profile.phone,
        position: profile.position,
        location: profile.location,
        bio: profile.bio
      });

      if (response.success) {
        // Обновляем контекст с новыми данными
        updateUser(response.data.user);
        setMessage({ type: 'success', text: 'Профиль успешно обновлен!' });
      } else {
        setMessage({ type: 'error', text: response.message || 'Ошибка при обновлении профиля' });
      }
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      setMessage({ type: 'error', text: 'Произошла ошибка при обновлении профиля' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    // Сброс к исходным данным пользователя
    if (user) {
      setProfile({
        firstName: user.firstname || '',
        lastName: user.lastname || '',
        email: user.email || '',
        phone: user.phone || '',
        position: user.position || '',
        company: user.company || '',
        bio: user.bio || '',
        location: user.location || ''
      });
    }
    setMessage(null);
  };

  const skills = ['Составление смет', 'Нормативная база', 'Excel/СПДС', 'Гранд-СМЕТА', 'Калькуляция стоимости', 'AutoCAD'];

  return (
    <Box sx={{ p: 2 }}>
      {/* Сообщения об ошибках/успехе */}
      {message && (
        <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Profile Completion Card */}
      <Card sx={{ mb: 3, bgcolor: 'primary.lighter' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Завершенность профиля
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <LinearProgress 
              variant="determinate" 
              value={profileCompletion} 
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="body2" color="text.secondary">
              {profileCompletion}%
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Добавьте еще информации, чтобы завершить профиль на 100%
          </Typography>
        </CardContent>
      </Card>

      {/* Avatar Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Avatar src={avatar1} sx={{ width: 80, height: 80 }} />
        <Box>
          <Button variant="outlined" size="small" sx={{ mb: 1, mr: 1 }}>
            Изменить фото
          </Button>
          <Button variant="text" size="small" color="error">
            Удалить
          </Button>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Рекомендуется изображение 400x400 px
          </Typography>
        </Box>
      </Box>

      {/* Form Fields */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Имя"
            value={profile.firstName}
            onChange={handleChange('firstName')}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Фамилия"
            value={profile.lastName}
            onChange={handleChange('lastName')}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Email"
            value={profile.email}
            onChange={handleChange('email')}
            variant="outlined"
            type="email"
            disabled // Email обычно не изменяется
            helperText="Email нельзя изменить после регистрации"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Телефон"
            value={profile.phone}
            onChange={handleChange('phone')}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Должность"
            value={profile.position}
            onChange={handleChange('position')}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Компания"
            value={profile.company}
            onChange={handleChange('company')}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Местоположение"
            value={profile.location}
            onChange={handleChange('location')}
            variant="outlined"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="О себе"
            value={profile.bio}
            onChange={handleChange('bio')}
            variant="outlined"
            multiline
            rows={4}
          />
        </Grid>

        {/* Skills Section */}
        <Grid item xs={12}>
          <Typography variant="h6" gutterBottom>
            Навыки
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {skills.map((skill, index) => (
              <Chip
                key={index}
                label={skill}
                variant="outlined"
                color="primary"
                onDelete={() => {}}
                sx={{ mb: 1 }}
              />
            ))}
            <Button variant="text" size="small" sx={{ ml: 1 }}>
              + Добавить навык
            </Button>
          </Stack>
        </Grid>

        {/* Action Buttons */}
        <Grid item xs={12}>
          <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleSave}
              disabled={loading || !profile.firstName || !profile.lastName}
              startIcon={loading && <CircularProgress size={20} />}
            >
              {loading ? 'Сохранение...' : 'Сохранить изменения'}
            </Button>
            <Button 
              variant="outlined" 
              onClick={handleCancel}
              disabled={loading}
            >
              Отмена
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
