// material-ui
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  LinearProgress
} from '@mui/material';
import { Stack } from '@mui/material';

// assets
import CreditCardOutlined from '@ant-design/icons/CreditCardOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import CalendarOutlined from '@ant-design/icons/CalendarOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import ClockCircleOutlined from '@ant-design/icons/ClockCircleOutlined';
import ExclamationCircleOutlined from '@ant-design/icons/ExclamationCircleOutlined';

// ==============================|| PROFILE TAB - BILLING ||============================== //

export default function BillingTab() {
  const billingStats = {
    currentBalance: 2456.78,
    monthlySpend: 324.5,
    yearlySpend: 3894.0,
    creditLimit: 5000,
    availableCredit: 2543.22,
    nextPayment: '15 октября 2024',
    nextPaymentAmount: 324.5
  };

  const transactions = [
    {
      id: 'TXN-001',
      description: 'Adobe Creative Suite - месячная подписка',
      amount: -52.99,
      date: '2024-09-25',
      status: 'completed',
      category: 'Софтвер'
    },
    {
      id: 'TXN-002',
      description: 'Пополнение баланса',
      amount: +500.0,
      date: '2024-09-22',
      status: 'completed',
      category: 'Пополнение'
    },
    {
      id: 'TXN-003',
      description: 'Figma Professional - годовая подписка',
      amount: -144.0,
      date: '2024-09-20',
      status: 'completed',
      category: 'Софтвер'
    },
    {
      id: 'TXN-004',
      description: 'Возврат за неиспользованные услуги',
      amount: +23.5,
      date: '2024-09-18',
      status: 'pending',
      category: 'Возврат'
    },
    {
      id: 'TXN-005',
      description: 'Hosting услуги - месячная оплата',
      amount: -29.99,
      date: '2024-09-15',
      status: 'failed',
      category: 'Услуги'
    }
  ];

  const upcomingBills = [
    { service: 'Office 365 Subscription', amount: 12.99, dueDate: '2024-10-01', auto: true },
    { service: 'Slack Premium', amount: 6.67, dueDate: '2024-10-05', auto: true },
    { service: 'Dropbox Professional', amount: 19.99, dueDate: '2024-10-10', auto: false },
    { service: 'GitHub Pro', amount: 4.0, dueDate: '2024-10-15', auto: true }
  ];

  const paymentMethods = [
    { type: 'Visa', last4: '4532', expiry: '12/26', isDefault: true },
    { type: 'Mastercard', last4: '8901', expiry: '08/25', isDefault: false },
    { type: 'PayPal', email: 'john.doe@example.com', isDefault: false }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined />;
      case 'pending':
        return <ClockCircleOutlined />;
      case 'failed':
        return <ExclamationCircleOutlined />;
      default:
        return null;
    }
  };

  const creditUsagePercentage = ((billingStats.creditLimit - billingStats.availableCredit) / billingStats.creditLimit) * 100;

  return (
    <Box sx={{ p: 2 }}>
      {/* Billing Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'primary.lighter' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DollarOutlined style={{ color: '#1976d2' }} />
                <Typography variant="subtitle2">Текущий баланс</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                ${billingStats.currentBalance.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'success.lighter' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarOutlined style={{ color: '#2e7d32' }} />
                <Typography variant="subtitle2">Расходы за месяц</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                ${billingStats.monthlySpend.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'warning.lighter' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CreditCardOutlined style={{ color: '#ed6c02' }} />
                <Typography variant="subtitle2">Доступный кредит</Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                ${billingStats.availableCredit.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: 'error.lighter' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <CalendarOutlined style={{ color: '#d32f2f' }} />
                <Typography variant="subtitle2">Следующий платеж</Typography>
              </Box>
              <Typography variant="h6" color="error.main">
                ${billingStats.nextPaymentAmount.toFixed(2)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {billingStats.nextPayment}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Credit Usage */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Использование кредитного лимита
          </Typography>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Использовано: ${(billingStats.creditLimit - billingStats.availableCredit).toFixed(2)}</Typography>
              <Typography variant="body2">Лимит: ${billingStats.creditLimit.toFixed(2)}</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={creditUsagePercentage}
              sx={{ height: 8, borderRadius: 4 }}
              color={creditUsagePercentage > 80 ? 'error' : creditUsagePercentage > 60 ? 'warning' : 'success'}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {creditUsagePercentage.toFixed(1)}% от лимита использовано
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Recent Transactions */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Последние транзакции
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Описание</TableCell>
                      <TableCell>Дата</TableCell>
                      <TableCell align="right">Сумма</TableCell>
                      <TableCell>Статус</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <Typography variant="body2">{transaction.description}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {transaction.category}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{new Date(transaction.date).toLocaleDateString('ru-RU')}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={transaction.amount > 0 ? 'success.main' : 'text.primary'}
                            fontWeight={transaction.amount > 0 ? 'bold' : 'normal'}
                          >
                            {transaction.amount > 0 ? '+' : ''}${Math.abs(transaction.amount).toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={getStatusIcon(transaction.status)}
                            label={
                              transaction.status === 'completed' ? 'Завершена' : transaction.status === 'pending' ? 'Ожидает' : 'Ошибка'
                            }
                            color={getStatusColor(transaction.status)}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Upcoming Bills */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Предстоящие счета
              </Typography>
              <List dense>
                {upcomingBills.map((bill, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemText primary={bill.service} secondary={`Срок: ${new Date(bill.dueDate).toLocaleDateString('ru-RU')}`} />
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" fontWeight="bold">
                        ${bill.amount.toFixed(2)}
                      </Typography>
                      {bill.auto && (
                        <Typography variant="caption" color="success.main">
                          Авто
                        </Typography>
                      )}
                    </Box>
                  </ListItem>
                ))}
              </List>
              <Button variant="outlined" size="small" fullWidth sx={{ mt: 1 }}>
                Управление подписками
              </Button>
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Способы оплаты
              </Typography>
              <Stack spacing={2}>
                {paymentMethods.map((method, index) => (
                  <Box
                    key={index}
                    sx={{
                      border: 1,
                      borderColor: method.isDefault ? 'primary.main' : 'divider',
                      borderRadius: 1,
                      p: 2,
                      bgcolor: method.isDefault ? 'primary.lighter' : 'background.paper'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Typography variant="body2" fontWeight="medium">
                        {method.type} {method.last4 ? `****${method.last4}` : ''}
                      </Typography>
                      {method.isDefault && <Chip label="По умолчанию" size="small" color="primary" />}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {method.expiry ? `Действительна до ${method.expiry}` : method.email}
                    </Typography>
                  </Box>
                ))}
              </Stack>
              <Button variant="outlined" size="small" fullWidth sx={{ mt: 2 }}>
                Добавить способ оплаты
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
