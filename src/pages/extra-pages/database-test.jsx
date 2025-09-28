import { useState, useEffect } from 'react';

// material-ui
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

// project imports
import MainCard from 'components/MainCard';
import { testConnection, getUsers, getOrders, getStatistics } from 'api/database';

// ==============================|| DATABASE TEST PAGE ||============================== //

export default function DatabaseTest() {
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    users: [],
    orders: [],
    statistics: []
  });

  const testDatabaseConnection = async () => {
    setLoading(true);
    try {
      const result = await testConnection();
      setConnectionStatus(result);

      // Если соединение успешно, загружаем данные
      if (result.status !== 'error') {
        const [users, orders, stats] = await Promise.all([getUsers(), getOrders(), getStatistics()]);

        setData({
          users,
          orders,
          statistics: stats
        });
      }
    } catch (error) {
      setConnectionStatus({
        status: 'error',
        message: 'Ошибка подключения к серверу',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testDatabaseConnection();
  }, []);

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <MainCard title="Тест подключения к базе данных">
          <Grid container spacing={2}>
            <Grid size={12}>
              {loading ? (
                <Box display="flex" justifyContent="center" alignItems="center" p={3}>
                  <CircularProgress />
                  <Typography variant="body1" sx={{ ml: 2 }}>
                    Проверка подключения...
                  </Typography>
                </Box>
              ) : connectionStatus ? (
                <Alert severity={connectionStatus.status === 'error' ? 'error' : 'success'} sx={{ mb: 2 }}>
                  <Typography variant="h6">
                    {connectionStatus.status === 'error' ? '❌ Ошибка подключения' : '✅ Подключение успешно'}
                  </Typography>
                  <Typography variant="body2">{connectionStatus.message}</Typography>
                  {connectionStatus.database_time && (
                    <Typography variant="body2">Время сервера: {new Date(connectionStatus.database_time).toLocaleString()}</Typography>
                  )}
                </Alert>
              ) : null}

              <Button variant="contained" onClick={testDatabaseConnection} disabled={loading}>
                Проверить подключение
              </Button>
            </Grid>

            {/* Статистика данных */}
            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2">
                    Пользователи
                  </Typography>
                  <Typography variant="h4" color="primary">
                    {data.users.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего пользователей в системе
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => console.log('Users:', data.users)}>
                    Показать в консоли
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2">
                    Заказы
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    {data.orders.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Всего заказов в системе
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => console.log('Orders:', data.orders)}>
                    Показать в консоли
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="h2">
                    Статистика
                  </Typography>
                  <Typography variant="h4" color="warning.main">
                    {data.statistics.length}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Метрики статистики
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button size="small" onClick={() => console.log('Statistics:', data.statistics)}>
                    Показать в консоли
                  </Button>
                </CardActions>
              </Card>
            </Grid>

            {/* Детали подключения */}
            {connectionStatus && (
              <Grid size={12}>
                <MainCard title="Детали подключения">
                  <Typography
                    variant="body2"
                    component="pre"
                    sx={{
                      backgroundColor: 'grey.100',
                      p: 2,
                      borderRadius: 1,
                      overflow: 'auto'
                    }}
                  >
                    {JSON.stringify(connectionStatus, null, 2)}
                  </Typography>
                </MainCard>
              </Grid>
            )}
          </Grid>
        </MainCard>
      </Grid>
    </Grid>
  );
}
