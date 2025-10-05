// material-ui
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Button,
  IconButton,
  Divider
} from '@mui/material';
import { Stack } from '@mui/material';

// assets
import HeartOutlined from '@ant-design/icons/HeartOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import ShareAltOutlined from '@ant-design/icons/ShareAltOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';
import TeamOutlined from '@ant-design/icons/TeamOutlined';
import StarOutlined from '@ant-design/icons/StarOutlined';
import avatar1 from 'assets/images/users/avatar-1.png';
import avatar2 from 'assets/images/users/avatar-2.png';
import avatar3 from 'assets/images/users/avatar-3.png';
import avatar4 from 'assets/images/users/avatar-4.png';

// ==============================|| PROFILE TAB - SOCIAL PROFILE ||============================== //

export default function SocialProfileTab() {
  const socialStats = {
    followers: 1247,
    following: 358,
    posts: 89,
    likes: 5420,
    views: 12500,
    shares: 234
  };

  const recentPosts = [
    {
      id: 1,
      title: 'Новый дизайн мобильного приложения',
      description: 'Завершил работу над UI/UX дизайном банковского приложения. Особое внимание уделил доступности.',
      date: '2 часа назад',
      likes: 24,
      comments: 8,
      shares: 3,
      views: 156
    },
    {
      id: 2,
      title: 'Воркшоп по дизайн-системам',
      description: 'Провел интересный воркшоп для команды разработки. Обсудили принципы создания масштабируемых компонентов.',
      date: '1 день назад',
      likes: 45,
      comments: 12,
      shares: 7,
      views: 289
    },
    {
      id: 3,
      title: 'Участие в UX Conference 2024',
      description: 'Отличная конференция! Много новых идей и знакомств. Спасибо организаторам за качественную программу.',
      date: '3 дня назад',
      likes: 67,
      comments: 23,
      shares: 15,
      views: 421
    }
  ];

  const connections = [
    { name: 'Alice Johnson', position: 'Product Manager', avatar: avatar2, mutual: 12 },
    { name: 'Bob Smith', position: 'Frontend Developer', avatar: avatar3, mutual: 8 },
    { name: 'Carol Davis', position: 'UX Researcher', avatar: avatar4, mutual: 15 },
    { name: 'David Wilson', position: 'Design Lead', avatar: avatar1, mutual: 22 }
  ];

  const skills = ['UI/UX Design', 'React', 'Figma', 'Adobe XD', 'JavaScript', 'Design Systems'];

  return (
    <Box sx={{ p: 2 }}>
      {/* Social Stats */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Социальная активность
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={4} sm={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="primary">
                  {socialStats.followers}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Подписчиков
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4} sm={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="success.main">
                  {socialStats.following}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Подписок
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4} sm={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="warning.main">
                  {socialStats.posts}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Постов
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4} sm={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="error.main">
                  {socialStats.likes}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Лайков
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4} sm={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="info.main">
                  {socialStats.views}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Просмотров
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={4} sm={2}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h5" color="secondary.main">
                  {socialStats.shares}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Репостов
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Recent Posts */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Последние публикации
              </Typography>
              <Stack spacing={3}>
                {recentPosts.map((post) => (
                  <Box key={post.id}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
                      <Avatar src={avatar1} sx={{ width: 40, height: 40 }} />
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" gutterBottom>
                          {post.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                          {post.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {post.date}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, ml: 7 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" color="error">
                          <HeartOutlined />
                        </IconButton>
                        <Typography variant="body2">{post.likes}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" color="primary">
                          <MessageOutlined />
                        </IconButton>
                        <Typography variant="body2">{post.comments}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton size="small" color="success">
                          <ShareAltOutlined />
                        </IconButton>
                        <Typography variant="body2">{post.shares}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
                        <EyeOutlined style={{ fontSize: 14, color: '#666' }} />
                        <Typography variant="caption" color="text.secondary">
                          {post.views} просмотров
                        </Typography>
                      </Box>
                    </Box>
                    {post.id < recentPosts.length && <Divider sx={{ mt: 3 }} />}
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Connections */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <TeamOutlined style={{ marginRight: 8 }} />
                Связи
              </Typography>
              <List dense>
                {connections.map((connection, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemAvatar>
                      <Avatar src={connection.avatar} sx={{ width: 32, height: 32 }} />
                    </ListItemAvatar>
                    <ListItemText primary={connection.name} secondary={connection.position} />
                    <Typography variant="caption" color="text.secondary">
                      {connection.mutual} общих
                    </Typography>
                  </ListItem>
                ))}
              </List>
              <Button variant="outlined" size="small" fullWidth sx={{ mt: 1 }}>
                Показать все связи
              </Button>
            </CardContent>
          </Card>

          {/* Skills/Interests */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <StarOutlined style={{ marginRight: 8 }} />
                Интересы
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {skills.map((skill, index) => (
                  <Chip key={index} label={skill} size="small" variant="outlined" color="primary" sx={{ mb: 1 }} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
