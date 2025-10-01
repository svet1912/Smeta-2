// material-ui (оптимизированные импорты)
import {
  Avatar,
  AvatarGroup, 
  Button,
  Grid,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
  Box
} from 'utils/muiImports';

// third-party
import { Suspense } from 'react';

// project imports
import MainCard from 'components/MainCard';
import AnalyticEcommerce from 'components/cards/statistics/AnalyticEcommerce';
import {
  LazyMonthlyBarChart,
  LazyReportAreaChart,
  LazyUniqueVisitorCard,
  LazySaleReportCard,
  LazyOrdersTable
} from 'components/LazyDashboardComponents';

// Оптимизированные API хуки с кэшированием
import { useStatistics, useOrders } from 'hooks/useApiQueries';

// assets (оптимизированные импорты иконок)
import { GiftOutlined, MessageOutlined, SettingOutlined } from 'utils/antdIcons';

import avatar1 from 'assets/images/users/avatar-1.png';
import avatar2 from 'assets/images/users/avatar-2.png';
import avatar3 from 'assets/images/users/avatar-3.png';
import avatar4 from 'assets/images/users/avatar-4.png';

// avatar style
const avatarSX = {
  width: 36,
  height: 36,
  fontSize: '1rem'
};

// action style
const actionSX = {
  mt: 0.75,
  ml: 1,
  top: 'auto',
  right: 'auto',
  alignSelf: 'flex-start',
  transform: 'none'
};

// ==============================|| DASHBOARD - DEFAULT ||============================== //

export default function DashboardDefault() {
  // Используем кэшированные запросы вместо прямых API вызовов
  const { data: statistics = [], isLoading: statsLoading, error: statsError } = useStatistics();
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useOrders();

  const loading = statsLoading || ordersLoading;

  if (loading) {
    return (
      <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '200px' }}>
        <Typography variant="h6">Загрузка данных...</Typography>
      </Grid>
    );
  }

  if (statsError || ordersError) {
    return (
      <Grid container justifyContent="center" alignItems="center" style={{ minHeight: '200px' }}>
        <Typography variant="h6" color="error">
          Ошибка загрузки данных. Попробуйте обновить страницу.
        </Typography>
      </Grid>
    );
  }

  return (
    <Grid container rowSpacing={4.5} columnSpacing={2.75}>
      {/* row 1 */}
      <Grid sx={{ mb: -2.25 }} size={12}>
        <Typography variant="h5">Панель управления</Typography>
      </Grid>
      {Array.isArray(statistics) && statistics.length > 0 ? (
        statistics.map((stat, index) => (
          <Grid key={stat.id || index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <AnalyticEcommerce
              title={stat.metric_name}
              count={stat.metric_value?.toLocaleString() || '0'}
              percentage={Number(stat.percentage) || 0}
              extra={stat.extra_value?.toLocaleString()}
              isLoss={stat.is_loss || false}
              color={stat.color || 'primary'}
            />
          </Grid>
        ))
      ) : (
        <Grid size={12}>
          <Typography variant="body2" color="text.secondary" align="center">
            Загрузка статистики...
          </Typography>
        </Grid>
      )}
      <Grid sx={{ display: { sm: 'none', md: 'block', lg: 'none' } }} size={{ md: 8 }} />
      {/* row 2 */}
      <Grid size={{ xs: 12, md: 7, lg: 8 }}>
        <LazyUniqueVisitorCard />
      </Grid>
      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid>
            <Typography variant="h5">Обзор доходов</Typography>
          </Grid>
          <Grid />
        </Grid>
        <MainCard sx={{ mt: 2 }} content={false}>
          <Box sx={{ p: 3, pb: 0 }}>
            <Stack sx={{ gap: 2 }}>
              <Typography variant="h6" color="text.secondary">
                Статистика за эту неделю
              </Typography>
              <Typography variant="h3">$7,650</Typography>
            </Stack>
          </Box>
          <LazyMonthlyBarChart />
        </MainCard>
      </Grid>
      {/* row 3 */}
      <Grid size={{ xs: 12, md: 7, lg: 8 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid>
            <Typography variant="h5">Последние заказы</Typography>
          </Grid>
          <Grid />
        </Grid>
        <MainCard sx={{ mt: 2 }} content={false}>
          <LazyOrdersTable />
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid>
            <Typography variant="h5">Аналитический отчет</Typography>
          </Grid>
          <Grid />
        </Grid>
        <MainCard sx={{ mt: 2 }} content={false}>
          <List sx={{ p: 0, '& .MuiListItemButton-root': { py: 2 } }}>
            <ListItemButton divider>
              <ListItemText primary="Рост финансов компании" />
              <Typography variant="h5">+45.14%</Typography>
            </ListItemButton>
            <ListItemButton divider>
              <ListItemText primary="Коэффициент расходов компании" />
              <Typography variant="h5">0.58%</Typography>
            </ListItemButton>
            <ListItemButton>
              <ListItemText primary="Бизнес-риски" />
              <Typography variant="h5">Низкий</Typography>
            </ListItemButton>
          </List>
          <LazyReportAreaChart />
        </MainCard>
      </Grid>
      {/* row 4 */}
      <Grid size={{ xs: 12, md: 7, lg: 8 }}>
        <LazySaleReportCard />
      </Grid>
      <Grid size={{ xs: 12, md: 5, lg: 4 }}>
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid>
            <Typography variant="h5">История транзакций</Typography>
          </Grid>
          <Grid />
        </Grid>
        <MainCard sx={{ mt: 2 }} content={false}>
          <List
            component="nav"
            sx={{
              px: 0,
              py: 0,
              '& .MuiListItemButton-root': {
                py: 1.5,
                px: 2,
                '& .MuiAvatar-root': avatarSX,
                '& .MuiListItemSecondaryAction-root': { ...actionSX, position: 'relative' }
              }
            }}
          >
            <ListItem
              component={ListItemButton}
              divider
              secondaryAction={
                <Stack sx={{ alignItems: 'flex-end' }}>
                  <Typography variant="subtitle1" noWrap>
                    + $1,430
                  </Typography>
                  <Typography variant="h6" color="secondary" noWrap>
                    78%
                  </Typography>
                </Stack>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ color: 'success.main', bgcolor: 'success.lighter' }}>
                  <GiftOutlined />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={<Typography variant="subtitle1">Заказ #002434</Typography>} secondary="Сегодня, 2:00" />
            </ListItem>
            <ListItem
              component={ListItemButton}
              divider
              secondaryAction={
                <Stack sx={{ alignItems: 'flex-end' }}>
                  <Typography variant="subtitle1" noWrap>
                    + $302
                  </Typography>
                  <Typography variant="h6" color="secondary" noWrap>
                    8%
                  </Typography>
                </Stack>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ color: 'primary.main', bgcolor: 'primary.lighter' }}>
                  <MessageOutlined />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={<Typography variant="subtitle1">Заказ #984947</Typography>} secondary="5 августа, 13:45" />
            </ListItem>
            <ListItem
              component={ListItemButton}
              secondaryAction={
                <Stack sx={{ alignItems: 'flex-end' }}>
                  <Typography variant="subtitle1" noWrap>
                    + $682
                  </Typography>
                  <Typography variant="h6" color="secondary" noWrap>
                    16%
                  </Typography>
                </Stack>
              }
            >
              <ListItemAvatar>
                <Avatar sx={{ color: 'error.main', bgcolor: 'error.lighter' }}>
                  <SettingOutlined />
                </Avatar>
              </ListItemAvatar>
              <ListItemText primary={<Typography variant="subtitle1">Заказ #988784</Typography>} secondary="7 часов назад" />
            </ListItem>
          </List>
        </MainCard>
        <MainCard sx={{ mt: 2 }}>
          <Stack sx={{ gap: 3 }}>
            <Grid container justifyContent="space-between" alignItems="center">
              <Grid>
                <Stack>
                  <Typography variant="h5" noWrap>
                    Помощь и чат поддержки
                  </Typography>
                  <Typography variant="caption" color="secondary" noWrap>
                    Обычный ответ в течение 5 мин
                  </Typography>
                </Stack>
              </Grid>
              <Grid>
                <AvatarGroup sx={{ '& .MuiAvatar-root': { width: 32, height: 32 } }}>
                  <Avatar alt="Remy Sharp" src={avatar1} />
                  <Avatar alt="Travis Howard" src={avatar2} />
                  <Avatar alt="Cindy Baker" src={avatar3} />
                  <Avatar alt="Agnes Walker" src={avatar4} />
                </AvatarGroup>
              </Grid>
            </Grid>
            <Button size="small" variant="contained" sx={{ textTransform: 'capitalize' }}>
              Нужна помощь?
            </Button>
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
  );
}
