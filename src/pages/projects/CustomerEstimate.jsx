import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack
} from '@mui/material';

// icons
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, DollarOutlined, SaveOutlined } from '@ant-design/icons';

// API
import {
  getCustomerEstimatesByProject,
  getCustomerEstimateItems,
  createCustomerEstimate,
  createCustomerEstimateItem,
  updateCustomerEstimateItem,
  deleteCustomerEstimateItem
} from 'api/customerEstimates';

// ==============================|| CUSTOMER ESTIMATE COMPONENT ||============================== //

export default function CustomerEstimate({ projectId, project }) {
  const [customerEstimate, setCustomerEstimate] = useState(null);
  const [estimateItems, setEstimateItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    item_type: 'material',
    unit: '',
    quantity: '',
    unit_price: '',
    total_amount: ''
  });

  const itemTypes = [
    { value: 'material', label: 'Материал' },
    { value: 'work', label: 'Работа' },
    { value: 'equipment', label: 'Оборудование' },
    { value: 'service', label: 'Услуга' },
    { value: 'overhead', label: 'Накладные расходы' }
  ];

  // Загрузка сметы и её элементов
  useEffect(() => {
    loadCustomerEstimate();
  }, [projectId, loadCustomerEstimate]);

  const loadCustomerEstimate = useCallback(async () => {
    try {
      setLoading(true);

      // Загружаем сметы заказчика для конкретного проекта
      const response = await getCustomerEstimatesByProject(projectId);

      if (response.success !== false && response.items && response.items.length > 0) {
        // Берем первую смету (в теории может быть несколько, но пока работаем с одной)
        const estimate = response.items[0];
        setCustomerEstimate(estimate);

        // Загружаем элементы сметы
        await loadEstimateItems(estimate.id);
      } else {
        // Если смет нет, сбрасываем состояние
        setCustomerEstimate(null);
        setEstimateItems([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки сметы заказчика:', error);
      setCustomerEstimate(null);
      setEstimateItems([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadEstimateItems = async (estimateId) => {
    try {
      // Загружаем элементы сметы через API
      const itemsResponse = await getCustomerEstimateItems(estimateId);

      if (itemsResponse.success !== false && itemsResponse.items) {
        setEstimateItems(itemsResponse.items);
      } else {
        setEstimateItems([]);
      }
    } catch (error) {
      console.error('Ошибка загрузки элементов сметы:', error);
      // В случае ошибки оставляем пустой массив
      setEstimateItems([]);
    }
  };

  // Создание новой сметы заказчика
  const handleCreateEstimate = async () => {
    try {
      setLoading(true);

      const estimateData = {
        project_id: parseInt(projectId), // Обязательно число!
        estimate_name: `Смета заказчика - ${project?.customer_name || 'Проект'}`,
        customer_name: project?.customer_name || 'Не указан',
        description: 'Смета для заказчика',
        status: 'draft'
      };

      const response = await createCustomerEstimate(estimateData);

      if (response.success !== false) {
        // Обновляем состояние
        await loadCustomerEstimate();
      }
    } catch (error) {
      console.error('Ошибка создания сметы:', error);
    } finally {
      setLoading(false);
    }
  };

  // Открытие диалога создания/редактирования элемента
  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({
        name: item.name,
        item_type: item.item_type,
        unit: item.unit,
        quantity: item.quantity.toString(),
        unit_price: item.unit_price.toString(),
        total_amount: item.total_amount.toString()
      });
    } else {
      setEditingItem(null);
      setFormData({
        name: '',
        item_type: 'material',
        unit: '',
        quantity: '',
        unit_price: '',
        total_amount: ''
      });
    }
    setOpenDialog(true);
  };

  // Закрытие диалога
  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingItem(null);
    setFormData({
      name: '',
      item_type: 'material',
      unit: '',
      quantity: '',
      unit_price: '',
      total_amount: ''
    });
  };

  // Изменение формы
  const handleFormChange = (field, value) => {
    const newFormData = { ...formData, [field]: value };

    // Автоматический расчет общей стоимости
    if (field === 'quantity' || field === 'unit_price') {
      const quantity = parseFloat(newFormData.quantity) || 0;
      const unitPrice = parseFloat(newFormData.unit_price) || 0;
      newFormData.total_amount = (quantity * unitPrice).toString();
    }

    setFormData(newFormData);
  };

  // Сохранение элемента сметы
  const handleSaveItem = async () => {
    if (!customerEstimate) {
      console.error('Смета заказчика не создана');
      return;
    }

    try {
      const itemData = {
        name: formData.name,
        item_type: formData.item_type,
        unit: formData.unit,
        quantity: parseFloat(formData.quantity),
        unit_price: parseFloat(formData.unit_price),
        total_amount: parseFloat(formData.total_amount)
      };

      if (editingItem) {
        // Обновление существующего элемента
        await updateCustomerEstimateItem(customerEstimate.id, editingItem.id, itemData);

        const updatedItems = estimateItems.map((item) => (item.id === editingItem.id ? { ...item, ...itemData } : item));
        setEstimateItems(updatedItems);
      } else {
        // Создание нового элемента
        const response = await createCustomerEstimateItem(customerEstimate.id, itemData);

        if (response.success !== false) {
          // Перезагружаем элементы сметы
          await loadEstimateItems(customerEstimate.id);
        }
      }

      handleCloseDialog();
    } catch (error) {
      console.error('Ошибка сохранения элемента сметы:', error);
    }
  };

  // Удаление элемента сметы
  const handleDeleteItem = async (itemId) => {
    if (!customerEstimate) return;

    if (window.confirm('Вы уверены, что хотите удалить эту позицию?')) {
      try {
        await deleteCustomerEstimateItem(customerEstimate.id, itemId);

        const updatedItems = estimateItems.filter((item) => item.id !== itemId);
        setEstimateItems(updatedItems);
      } catch (error) {
        console.error('Ошибка удаления элемента сметы:', error);
      }
    }
  };

  // Получение цвета чипа для типа элемента
  const getItemTypeColor = (itemType) => {
    const colors = {
      material: 'primary',
      work: 'success',
      equipment: 'warning',
      service: 'info',
      overhead: 'secondary'
    };
    return colors[itemType] || 'default';
  };

  // Получение названия типа элемента
  const getItemTypeName = (itemType) => {
    const typeObj = itemTypes.find((type) => type.value === itemType);
    return typeObj ? typeObj.label : itemType;
  };

  // Расчет общей суммы
  const totalAmount = estimateItems.reduce((sum, item) => sum + (item.total_amount || 0), 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <Typography>Загрузка сметы...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">
          <FileTextOutlined style={{ marginRight: 8 }} />
          Смета заказчика
        </Typography>
        <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => handleOpenDialog()}>
          Добавить позицию
        </Button>
      </Stack>

      {!customerEstimate ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <FileTextOutlined style={{ fontSize: 48, color: '#ccc', marginBottom: 16 }} />
            <Typography variant="h6" gutterBottom>
              Смета заказчика не создана
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Создайте смету заказчика для начала работы с проектом
            </Typography>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={handleCreateEstimate} sx={{ mt: 2 }} disabled={loading}>
              Создать смету заказчика
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Наименование</TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell>Ед. изм.</TableCell>
                  <TableCell align="right">Кол-во</TableCell>
                  <TableCell align="right">Цена за ед.</TableCell>
                  <TableCell align="right">Общая стоимость</TableCell>
                  <TableCell align="center">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {estimateItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {item.name}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={getItemTypeName(item.item_type)} color={getItemTypeColor(item.item_type)} size="small" />
                    </TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell align="right">{item.quantity}</TableCell>
                    <TableCell align="right">₽ {item.unit_price.toLocaleString('ru-RU')}</TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" fontWeight={600}>
                        ₽ {item.total_amount.toLocaleString('ru-RU')}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => handleOpenDialog(item)} color="primary">
                        <EditOutlined />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteItem(item.id)} color="error">
                        <DeleteOutlined />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Итого */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="h6">
                  <DollarOutlined style={{ marginRight: 8 }} />
                  Итого по смете:
                </Typography>
                <Typography variant="h5" color="primary" fontWeight={700}>
                  ₽ {totalAmount.toLocaleString('ru-RU')}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </>
      )}

      {/* Диалог создания/редактирования позиции */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingItem ? 'Редактировать позицию' : 'Добавить позицию сметы'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={12}>
              <TextField
                fullWidth
                label="Наименование"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Тип элемента</InputLabel>
                <Select value={formData.item_type} label="Тип элемента" onChange={(e) => handleFormChange('item_type', e.target.value)}>
                  {itemTypes.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Единица измерения"
                value={formData.unit}
                onChange={(e) => handleFormChange('unit', e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Количество"
                type="number"
                value={formData.quantity}
                onChange={(e) => handleFormChange('quantity', e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Цена за единицу"
                type="number"
                value={formData.unit_price}
                onChange={(e) => handleFormChange('unit_price', e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                fullWidth
                label="Общая стоимость"
                type="number"
                value={formData.total_amount}
                onChange={(e) => handleFormChange('total_amount', e.target.value)}
                InputProps={{
                  readOnly: true
                }}
                helperText="Рассчитывается автоматически"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button onClick={handleSaveItem} variant="contained" startIcon={<SaveOutlined />}>
            {editingItem ? 'Сохранить' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

CustomerEstimate.propTypes = {
  projectId: PropTypes.string.isRequired,
  project: PropTypes.object
};
