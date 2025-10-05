import { useAuth } from 'contexts/AuthContext';

// material-ui
import {
  Box,
  Typography,
  Grid,
  Avatar,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  LinearProgress
} from '@mui/material';
import { Stack } from '@mui/material';

// assets
import EmailOutlined from '@ant-design/icons/MailOutlined';
import PhoneOutlined from '@ant-design/icons/PhoneOutlined';
import EnvironmentOutlined from '@ant-design/icons/EnvironmentOutlined';
import CalendarOutlined from '@ant-design/icons/CalendarOutlined';
import TrophyOutlined from '@ant-design/icons/TrophyOutlined';
import avatar1 from 'assets/images/users/avatar-1.png';

// ==============================|| PROFILE TAB - VIEW PROFILE ||============================== //

export default function ViewProfileTab() {
  const { user } = useAuth();

  const profileData = {
    name: user ? `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.email : 'Пользователь',
    position: 'Специалист по сметам',
    company: user?.company || 'SMETA360',
    email: user?.email || '',
    phone: '+7 000 000 0000',
    location: 'Россия',
    joinDate: user?.created_at ? new Date(user.created_at).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long' }) : 'Недавно',
    bio: 'Опытный специалист по составлению строительных смет. Специализируюсь на автоматизации процессов и оптимизации стоимости.',
    projects: 42,
    experience: '3+ лет',
    teamSize: 5
  };

  const skills = [
    { name: 'Составление смет', level: 95 },
    { name: 'Нормативная база', level: 88 },
    { name: 'Excel/СПДС', level: 92 },
    { name: 'Гранд-СМЕТА', level: 85 },
    { name: 'Калькуляция стоимости', level: 90 },
    { name: 'AutoCAD', level: 78 },
    { name: 'Нормоконтроль', level: 72 }
  ];

  const achievements = [
    'Лучший сметчик месяца (2 раза)',
    'Сертификат специалиста по сметам',
    'Опыт работы с ГОСТами',
    'Ментор для 3+ новых сотрудников'
  ];

  const recentActivity = [
    { action: 'Завершен проект "Жилой комплекс Приморье"', date: '2 дня назад' },
    { action: 'Обновлена база материалов', date: '1 неделя назад' },
    { action: 'Проведен тренинг по новым нормативам', date: '2 недели назад' }
  ];

  return (
    <Box sx={{ p: 2 }}>
      {/* Profile Header */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar src={avatar1} sx={{ width: 100, height: 100 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" gutterBottom>
                {profileData.name}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {profileData.position}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {profileData.company}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Grid container spacing={2}>
                <Grid item xs={4}>
                  <Typography variant="h4" color="primary">
                    {profileData.projects}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Проектов
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="success.main">
                    {profileData.teamSize}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    В команде
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="h4" color="warning.main">
                    5.0
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Рейтинг
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Контактная информация
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <EmailOutlined />
                  </ListItemIcon>
                  <ListItemText primary={profileData.email} secondary="Email" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <PhoneOutlined />
                  </ListItemIcon>
                  <ListItemText primary={profileData.phone} secondary="Телефон" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <EnvironmentOutlined />
                  </ListItemIcon>
                  <ListItemText primary={profileData.location} secondary="Местоположение" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CalendarOutlined />
                  </ListItemIcon>
                  <ListItemText primary={profileData.joinDate} secondary="Присоединился" />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* About */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                О себе
              </Typography>
              <Typography variant="body1" paragraph>
                {profileData.bio}
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom>
                Опыт работы
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {profileData.experience} в области UI/UX дизайна
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Skills */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Навыки и компетенции
              </Typography>
              {skills.map((skill, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{skill.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {skill.level}%
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={skill.level} sx={{ height: 6, borderRadius: 3 }} />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Achievements */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TrophyOutlined style={{ marginRight: 8, color: '#faad14' }} />
                Достижения
              </Typography>
              <Stack spacing={1}>
                {achievements.map((achievement, index) => (
                  <Chip
                    key={index}
                    label={achievement}
                    variant="outlined"
                    color="warning"
                    size="small"
                    sx={{ justifyContent: 'flex-start', '& .MuiChip-label': { textAlign: 'left' } }}
                  />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Последняя активность
              </Typography>
              <List>
                {recentActivity.map((activity, index) => (
                  <ListItem key={index} divider={index < recentActivity.length - 1}>
                    <ListItemText primary={activity.action} secondary={activity.date} />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
