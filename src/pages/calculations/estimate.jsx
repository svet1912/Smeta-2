import { useState, useEffect, useMemo, useCallback } from 'react';
import MainCard from 'components/MainCard';
import {
  Typography,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Divider,
  Tooltip,
  Popconfirm,
  Badge,
  Image
} from 'antd';
import { PlusOutlined, MinusOutlined, CalculatorOutlined, DeleteOutlined, EditOutlined, FileTextOutlined, DownloadOutlined, SaveOutlined } from '@ant-design/icons';
import { workMaterialsApi } from 'api/workMaterials';

const { Title, Text } = Typography;
const { Option } = Select;

// ==============================|| ХУКИ И УТИЛИТЫ ||============================== //

// Хук для debounce
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// ==============================|| МЕМОИЗИРОВАННЫЕ КОМПОНЕНТЫ ||============================== //





// ==============================|| РАСЧЕТ СМЕТЫ ||============================== //

export default function EstimateCalculationPage() {
  const [works, setWorks] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [workMaterials, setWorkMaterials] = useState({}); // workId -> materials array
         const [estimateItems, setEstimateItems] = useState([]);
         const [modalVisible, setModalVisible] = useState(false);
         const [selectedItem, setSelectedItem] = useState(null);
         const [loading, setLoading] = useState(false);
         const [form] = Form.useForm();
         const [expandedWorks, setExpandedWorks] = useState(new Set());

  // Новые состояния для управления материалами
  const [materialModalVisible, setMaterialModalVisible] = useState(false);
  const [materialAction, setMaterialAction] = useState('add'); // 'add' | 'replace'
  const [selectedWorkId, setSelectedWorkId] = useState(null);
  const [selectedMaterialToReplace, setSelectedMaterialToReplace] = useState(null);
  const [materialForm] = Form.useForm();

  // Загрузка данных
  useEffect(() => {
    loadWorks();
    loadMaterials();
           loadAllWorkMaterials();
  }, []);

  const loadWorks = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/works');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setWorks(data);
        } else {
          setWorks([]);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки работ:', error);
      setWorks([]);
    }
  };

  const loadMaterials = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/materials');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setMaterials(data);
        } else {
          setMaterials([]);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки материалов:', error);
      setMaterials([]);
    }
  };

  const loadWorkMaterials = async (workId) => {
    if (!workId) return [];

    try {
      const response = await fetch(`http://localhost:3001/api/works/${workId}/materials`);
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setWorkMaterials((prev) => ({ ...prev, [workId]: data }));
          return data;
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки материалов работы:', error);
    }
    setWorkMaterials((prev) => ({ ...prev, [workId]: [] }));
    return [];
  };

  // Оптимизированная загрузка всех данных сметы одним запросом
  const loadOptimizedEstimateData = async () => {
    setLoading(true);
    try {
      console.log('🚀 Загрузка оптимизированных данных сметы...');
      const startTime = Date.now();
      
      const response = await fetch('http://localhost:3001/api/estimate-data');
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          const endTime = Date.now();
          console.log(`✅ Оптимизированная загрузка завершена за ${endTime - startTime}ms`);
          console.log(`📊 Получено ${result.data.length} записей за ${result.meta.duration}ms`);
          
          // Преобразуем данные в формат для отображения в таблице
          const flatItems = [];

          // Группируем по работам
          const workGroups = {};
          result.data.forEach(item => {
            if (!workGroups[item.work_id]) {
              workGroups[item.work_id] = {
                work: null,
                materials: []
              };
            }

            if (item.work_name) {
              workGroups[item.work_id].work = {
                type: 'work',
                item_id: item.work_id,
                name: item.work_name,
                unit: item.work_unit || 'шт.',
                quantity: 1, // По умолчанию 1 единица
                unit_price: parseFloat(item.work_unit_price) || 0,
                total: (parseFloat(item.work_unit_price) || 0) * 1,
                work_id: null
              };
            }

            if (item.material_name) {
              workGroups[item.work_id].materials.push({
                type: 'material',
                item_id: item.material_id,
                name: item.material_name,
                unit: item.material_unit || 'шт.',
                quantity: (parseFloat(item.consumption_per_work_unit) || 1) * 1, // Умножаем на количество работ
                unit_price: parseFloat(item.material_unit_price) || 0,
                total: ((parseFloat(item.consumption_per_work_unit) || 1) * 1) * (parseFloat(item.material_unit_price) || 0),
                work_id: item.work_id,
                image_url: item.material_image_url,
                item_url: item.material_item_url,
                consumption_per_work_unit: parseFloat(item.consumption_per_work_unit) || 0
              });
            }
          });

          // Преобразуем в плоский список, сортируя по ID работ
          Object.values(workGroups)
            .sort((a, b) => {
              // Извлекаем числовую часть из ID (w.1 -> 1, w.2 -> 2, etc.)
              const getWorkNumber = (workId) => {
                const match = workId?.match(/w\.(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
              };
              return getWorkNumber(a.work?.item_id) - getWorkNumber(b.work?.item_id);
            })
            .forEach(group => {
              if (group.work) {
                flatItems.push(group.work);
                flatItems.push(...group.materials);
              }
            });

          setEstimateItems(flatItems);
          console.log(`✅ Загружено ${flatItems.length} позиций из базы данных (оптимизированно)`);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки оптимизированных данных сметы:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка всех связей работа-материал из базы данных (старый метод)
  const loadAllWorkMaterials = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/work-materials');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          // Преобразуем данные в формат для отображения в таблице
          const flatItems = [];

          // Группируем по работам
          const workGroups = {};
          data.forEach(item => {
            if (!workGroups[item.work_id]) {
              workGroups[item.work_id] = {
                work: null,
                materials: []
              };
            }

            if (item.work_name) {
              workGroups[item.work_id].work = {
                type: 'work',
                item_id: item.work_id,
                name: item.work_name,
                unit: item.work_unit || 'шт.',
                quantity: 1, // По умолчанию 1 единица
                unit_price: parseFloat(item.work_unit_price) || 0,
                total: (parseFloat(item.work_unit_price) || 0) * 1,
                work_id: null
              };
            }

            if (item.material_name) {
              workGroups[item.work_id].materials.push({
                type: 'material',
                item_id: item.material_id,
                name: item.material_name,
                unit: item.material_unit || 'шт.',
                quantity: (parseFloat(item.consumption_per_work_unit) || 1) * 1, // Умножаем на количество работ
                unit_price: parseFloat(item.material_unit_price) || 0,
                total: ((parseFloat(item.consumption_per_work_unit) || 1) * 1) * (parseFloat(item.material_unit_price) || 0),
                work_id: item.work_id,
                image_url: item.material_image_url,
                item_url: item.material_item_url,
                consumption_per_work_unit: parseFloat(item.consumption_per_work_unit) || 0
              });
            }
          });

          // Преобразуем в плоский список, сортируя по ID работ
          Object.values(workGroups)
            .sort((a, b) => {
              // Извлекаем числовую часть из ID (w.1 -> 1, w.2 -> 2, etc.)
              const getWorkNumber = (workId) => {
                const match = workId?.match(/w\.(\d+)/);
                return match ? parseInt(match[1], 10) : 0;
              };
              return getWorkNumber(a.work?.item_id) - getWorkNumber(b.work?.item_id);
            })
            .forEach(group => {
              if (group.work) {
                flatItems.push(group.work);
                flatItems.push(...group.materials);
              }
            });

          setEstimateItems(flatItems);
          console.log(`✅ Загружено ${flatItems.length} позиций из базы данных`);
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки связей работа-материал:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setSelectedItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEditItem = (record) => {
    setSelectedItem(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDeleteItem = async (record) => {
    try {
      if (record.isWork) {
        // Удаляем работу и все связанные материалы
        const workId = record.item_id;
        
        // Находим все материалы, связанные с этой работой, и удаляем их из БД
        const materialsToDelete = estimateItems.filter(item => 
          item.work_id === workId && item.type === 'material'
        );

        // Удаляем каждый материал из базы данных
        for (const material of materialsToDelete) {
          const result = await workMaterialsApi.removeMaterialFromWork(workId, material.item_id);
          if (!result.success) {
            console.error('Ошибка удаления материала:', result.message);
            // Продолжаем удаление остальных материалов даже при ошибке
          }
        }

        // Обновляем локальное состояние
        const newItems = estimateItems.filter(item => 
          !(item.item_id === workId && item.type === 'work') && 
          !(item.work_id === workId && item.type === 'material')
        );
        setEstimateItems(newItems);
        message.success('Блок работ и связанные материалы удалены из сметы и базы данных');
      } else {
        // Удаляем только материал
        const result = await workMaterialsApi.removeMaterialFromWork(record.work_id, record.item_id);
        
        if (!result.success) {
          message.error(result.message || 'Ошибка удаления материала из базы данных');
          return;
        }

        // Обновляем локальное состояние после успешного удаления из БД
        const newItems = estimateItems.filter(item => 
          !(item.item_id === record.item_id && item.type === 'material' && item.work_id === record.work_id)
        );
        setEstimateItems(newItems);
        message.success('Материал удален из сметы и базы данных');
      }
    } catch (error) {
      console.error('Ошибка при удалении:', error);
      message.error('Ошибка при удалении из базы данных');
    }
  };

  // ==============================|| ФУНКЦИИ УПРАВЛЕНИЯ МАТЕРИАЛАМИ ||============================== //

  const handleAddMaterial = (workRecord) => {
    setMaterialAction('add');
    setSelectedWorkId(workRecord.item_id);
    setSelectedMaterialToReplace(null);
    
    // Правильно сбрасываем форму с начальными значениями
    materialForm.resetFields();
    materialForm.setFieldsValue({
      quantity: 1,
      waste_coeff: 1,
      consumption_per_work_unit: 1,
      unit_price: 0
    });
    
    setMaterialModalVisible(true);
    
    // Автоматически разворачиваем работу для лучшего UX
    setExpandedWorks(prev => new Set([...prev, workRecord.item_id]));
  };

  const handleReplaceMaterial = (materialRecord) => {
    setMaterialAction('replace');
    setSelectedWorkId(materialRecord.work_id);
    setSelectedMaterialToReplace(materialRecord);
    
    // Правильно сбрасываем форму с начальными значениями
    materialForm.resetFields();
    materialForm.setFieldsValue({
      quantity: 1,
      waste_coeff: 1,
      consumption_per_work_unit: 1,
      unit_price: 0
    });
    
    setMaterialModalVisible(true);
  };

  const handleSaveMaterial = async (values) => {
    const quantity = parseFloat(values.quantity) || 1;
    const unitPrice = parseFloat(values.unit_price) || 0;
    const total = quantity * unitPrice;
    const consumptionPerWorkUnit = values.consumption_per_work_unit || 1;
    const wasteCoeff = values.waste_coeff || 1;

    const newMaterial = {
      type: 'material',
      item_id: values.material_id,
      name: values.name,
      unit: values.unit,
      unit_price: unitPrice,
      quantity: quantity,
      total: total,
      work_id: selectedWorkId,
      consumption_per_work_unit: consumptionPerWorkUnit,
      waste_coeff: wasteCoeff,
      image_url: values.image_url,
      item_url: values.item_url
    };

    try {
      if (materialAction === 'add') {
        // Сохраняем в базу данных
        const result = await workMaterialsApi.addMaterialToWork(selectedWorkId, {
          material_id: values.material_id,
          consumption_per_work_unit: consumptionPerWorkUnit,
          waste_coeff: wasteCoeff
        });

        if (!result.success) {
          message.error(result.message || 'Ошибка сохранения материала в базу данных');
          return;
        }

        // Обновляем локальное состояние после успешного сохранения в БД
        // Находим индекс работы, после которой нужно вставить материал
        const workIndex = estimateItems.findIndex(item => 
          item.type === 'work' && item.item_id === selectedWorkId
        );
        
        if (workIndex !== -1) {
          // Находим последний материал этой работы или саму работу
          let insertIndex = workIndex + 1;
          for (let i = workIndex + 1; i < estimateItems.length; i++) {
            if (estimateItems[i].work_id === selectedWorkId) {
              insertIndex = i + 1;
            } else if (estimateItems[i].type === 'work') {
              break;
            }
          }
          
          // Вставляем материал в правильную позицию
          setEstimateItems(prev => {
            const newItems = [...prev];
            newItems.splice(insertIndex, 0, newMaterial);
            return newItems;
          });
        } else {
          // Fallback: добавляем в конец, если работа не найдена
          setEstimateItems(prev => [...prev, newMaterial]);
        }
        
        // Автоматически разворачиваем работу, чтобы показать добавленный материал
        setExpandedWorks(prev => new Set([...prev, selectedWorkId]));
        
        message.success('Материал добавлен к блоку работ и сохранен в базу данных');

      } else if (materialAction === 'replace') {
        // Для замены сначала удаляем старую связь, затем добавляем новую
        const deleteResult = await workMaterialsApi.removeMaterialFromWork(
          selectedWorkId, 
          selectedMaterialToReplace.item_id
        );

        if (!deleteResult.success) {
          message.error(deleteResult.message || 'Ошибка удаления старого материала');
          return;
        }

        const addResult = await workMaterialsApi.addMaterialToWork(selectedWorkId, {
          material_id: values.material_id,
          consumption_per_work_unit: consumptionPerWorkUnit,
          waste_coeff: wasteCoeff
        });

        if (!addResult.success) {
          message.error(addResult.message || 'Ошибка добавления нового материала');
          return;
        }

        // Обновляем локальное состояние после успешного обновления в БД
        setEstimateItems(prev => prev.map(item => {
          if (item.item_id === selectedMaterialToReplace.item_id && 
              item.type === 'material' && 
              item.work_id === selectedMaterialToReplace.work_id) {
            return newMaterial;
          }
          return item;
        }));
        
        // Убеждаемся, что работа развернута для отображения замененного материала
        setExpandedWorks(prev => new Set([...prev, selectedWorkId]));
        
        message.success('Материал заменен и изменения сохранены в базу данных');
      }

      setMaterialModalVisible(false);
      materialForm.resetFields();

    } catch (error) {
      console.error('Ошибка при сохранении материала:', error);
      message.error('Ошибка при сохранении материала в базу данных');
    }
  };

  // Функции для работы с блоками
  const handleEditBlock = (block) => {
    setSelectedItem(block.work);
    form.setFieldsValue(block.work);
    setModalVisible(true);
  };

  const handleDeleteBlock = async (blockIndex) => {
    try {
      const blockKeys = Object.keys(groupedItems);
      const blockKey = blockKeys[blockIndex];
      const block = groupedItems[blockKey];
      
      // Удаляем работу и все связанные материалы
      const workId = block.work.item_id;
      
      // Находим все материалы, связанные с этой работой, и удаляем их из БД
      const materialsToDelete = estimateItems.filter(item => 
        item.work_id === workId && item.type === 'material'
      );

      // Удаляем каждый материал из базы данных
      for (const material of materialsToDelete) {
        const result = await workMaterialsApi.removeMaterialFromWork(workId, material.item_id);
        if (!result.success) {
          console.error('Ошибка удаления материала:', result.message);
          // Продолжаем удаление остальных материалов даже при ошибке
        }
      }
      
      // Обновляем локальное состояние
      const newItems = estimateItems.filter(item => 
        !(item.item_id === workId && item.type === 'work') && 
        !(item.work_id === workId && item.type === 'material')
      );
      
      setEstimateItems(newItems);
      message.success('Блок работ и связанные материалы удалены из сметы и базы данных');
    } catch (error) {
      console.error('Ошибка при удалении блока:', error);
      message.error('Ошибка при удалении блока из базы данных');
    }
  };

  const handleSaveItem = async (values) => {
    const quantity = values.quantity || 1;
    const itemsToAdd = [];

    // Добавляем основную позицию (работу или материал)
    const mainItem = {
      ...values,
      total: calculateTotal(values)
    };
    itemsToAdd.push(mainItem);

    // Если это работа, добавляем связанные материалы
    if (values.type === 'work') {
      const workMats = workMaterials[values.item_id] || [];
      workMats.forEach((mat) => {
        const materialQuantity = (mat.total_consumption || 0) * quantity;
        const materialTotal = materialQuantity * (mat.material_unit_price || 0);

        itemsToAdd.push({
          type: 'material',
          item_id: mat.material_id,
          name: mat.material_name,
          unit: mat.material_unit,
          unit_price: mat.material_unit_price || 0,
          quantity: materialQuantity,
          total: materialTotal,
          work_id: values.item_id,
          consumption_per_work_unit: mat.consumption_per_work_unit,
          waste_coeff: mat.waste_coeff
        });
      });
    }

    if (selectedItem) {
      // Редактирование - нужно найти и заменить основную позицию и связанные материалы
      const index = estimateItems.findIndex((item) => item === selectedItem);
      const newItems = [...estimateItems];

      // Удаляем старую позицию и связанные материалы
      let deleteCount = 1;
      if (selectedItem.type === 'work') {
        // Найдем сколько материалов связано с этой работой
        const relatedMaterials = estimateItems
          .slice(index + 1)
          .filter((item) => item.work_id === selectedItem.item_id && item.type === 'material');
        deleteCount += relatedMaterials.length;
      }

      newItems.splice(index, deleteCount, ...itemsToAdd);
      setEstimateItems(newItems);
      message.success('Позиция обновлена');
    } else {
      // Добавление
      setEstimateItems([...estimateItems, ...itemsToAdd]);
      message.success('Позиция добавлена в смету');
    }
    setModalVisible(false);
  };

  const calculateTotal = (item) => {
    const quantity = item.quantity || 0;
    const unitPrice = item.unit_price || 0;
    return quantity * unitPrice;
  };

  // Мемоизированная функция для расчета общей суммы
  const getTotalEstimate = useCallback(() => {
    return estimateItems.reduce((sum, item) => sum + (item.total || 0), 0);
  }, [estimateItems]);

  // Мемоизированная группировка позиций по блокам (работа + материалы)
  const groupedItems = useMemo(() => {
    return estimateItems.reduce((groups, item, index) => {
      if (item.type === 'work') {
        // Создаем новый блок для работы
        const blockId = `block_${item.item_id}_${index}`;
        groups[blockId] = {
          work: item,
          materials: [],
          blockId,
          totalCost: item.total || 0
        };
      } else if (item.work_id) {
        // Добавляем материал к последнему блоку работы
        const lastBlock = Object.values(groups).pop();
        if (lastBlock) {
          lastBlock.materials.push(item);
          lastBlock.totalCost += item.total || 0;
        }
      }
      return groups;
    }, {});
  }, [estimateItems]);

  // Мемоизированное создание плоского списка для отображения в стиле Excel
  const flatEstimateItems = useMemo(() => {
    const items = [];

    // Безопасная проверка на массив
    if (!Array.isArray(estimateItems)) {
      return items;
    }

    estimateItems.forEach((item, index) => {
      if (item && item.type === 'work') {
        items.push({
          ...item,
          level: 1,
          isWork: true,
          isMaterial: false,
          parentWork: null,
          expanded: expandedWorks.has(item.item_id)
        });
      } else if (item && item.work_id) {
        // Показываем материал только если работа развернута
        if (expandedWorks.has(item.work_id)) {
          items.push({
            ...item,
            level: 2,
            isWork: false,
            isMaterial: true,
            parentWork: null
          });
        }
      }
    });

    return items;
  }, [estimateItems, expandedWorks]);


  // Мемоизированная статистика сметы
  const stats = useMemo(() => {
    const blockList = Object.values(groupedItems);
    const works = estimateItems.filter((item) => item.type === 'work');
    const materials = estimateItems.filter((item) => item.type === 'material');
    
    return {
      totalBlocks: blockList.length,
      totalWorks: works.length,
      totalMaterials: materials.length,
      totalAmount: getTotalEstimate(),
      worksAmount: works.reduce((sum, item) => sum + (item.total || 0), 0),
      materialsAmount: materials.reduce((sum, item) => sum + (item.total || 0), 0)
    };
  }, [groupedItems, estimateItems, getTotalEstimate]);

  // Функции для экспорта и сохранения
  const handleExportEstimate = () => {
    const estimateData = {
      date: new Date().toLocaleDateString('ru-RU'),
      items: estimateItems,
      statistics: stats
    };
    
    const dataStr = JSON.stringify(estimateData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estimate_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    message.success('Смета экспортирована');
  };

         const handleClearEstimate = () => {
           setEstimateItems([]);
           message.success('Смета очищена');
         };

         // Функция для переключения развернутости работы
         const toggleWorkExpansion = (workId) => {
           const newExpandedWorks = new Set(expandedWorks);
           if (newExpandedWorks.has(workId)) {
             newExpandedWorks.delete(workId);
           } else {
             newExpandedWorks.add(workId);
           }
           setExpandedWorks(newExpandedWorks);
         };


  return (
    <MainCard title="Расчет сметы">
      {/* Статистика */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Блоков работ" 
              value={stats.totalBlocks} 
              valueStyle={{ color: '#1890ff' }}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Работ" 
              value={stats.totalWorks} 
              valueStyle={{ color: '#52c41a' }}
              prefix={<CalculatorOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Материалов" 
              value={stats.totalMaterials} 
              valueStyle={{ color: '#faad14' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Сумма работ" 
              value={stats.worksAmount} 
              precision={2} 
              suffix="₽" 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Сумма материалов" 
              value={stats.materialsAmount} 
              precision={2} 
              suffix="₽" 
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic 
              title="Общая сумма" 
              value={stats.totalAmount} 
              precision={2} 
              suffix="₽" 
              valueStyle={{ color: '#722ed1', fontSize: '20px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Кнопки управления */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddItem} size="large">
            Добавить блок работ
          </Button>
          <Button
            icon={<CalculatorOutlined />}
            onClick={() => {
              loadWorks();
              loadMaterials();
            }}
            size="large"
          >
            Обновить справочники
          </Button>
                 <Button
                   icon={<FileTextOutlined />}
                   onClick={loadOptimizedEstimateData}
                   size="large"
                   type="dashed"
                 >
                   Загрузить оптимизированно
                 </Button>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExportEstimate}
            size="large"
            disabled={estimateItems.length === 0}
          >
            Экспорт сметы
          </Button>
          <Popconfirm
            title="Очистить смету?"
            description="Все позиции будут удалены. Это действие нельзя отменить."
            onConfirm={handleClearEstimate}
            okText="Да, очистить"
            cancelText="Отмена"
            disabled={estimateItems.length === 0}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="large"
              disabled={estimateItems.length === 0}
            >
              Очистить смету
            </Button>
          </Popconfirm>
        </Space>

        <div style={{ textAlign: 'right' }}>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            Смета на {new Date().toLocaleDateString('ru-RU')}
          </Text>
          <br />
          <Text strong style={{ color: '#722ed1', fontSize: '16px' }}>
            Итого: {stats.totalAmount.toFixed(2)} ₽
          </Text>
        </div>
      </div>

      {/* Таблица сметы */}
      <Table
        columns={[
          {
            title: '№',
            dataIndex: 'item_id',
            key: 'item_id',
            width: 100,
            render: (text, record) => (
              <div style={{
                paddingLeft: record.isMaterial ? '24px' : '0px',
                display: 'flex',
                alignItems: 'center'
              }}>
                {record.isMaterial && (
                  <span style={{ 
                    marginRight: '8px',
                    color: '#999',
                    fontSize: '12px'
                  }}>
                    └─
                  </span>
                )}
                <Text strong={record.isWork} style={{ 
                  fontSize: record.isWork ? '14px' : '13px',
                  color: record.isWork ? '#1890ff' : '#52c41a'
                }}>
                  {text}
                </Text>
              </div>
            )
          },
          {
            title: 'Наименование работ и материалов',
            dataIndex: 'name',
            key: 'name',
            render: (text, record) => (
              <div style={{
                paddingLeft: record.isMaterial ? '24px' : '0px',
                backgroundColor: record.isWork ? '#f0f8ff' : record.isMaterial ? '#f6ffed' : 'transparent',
                padding: '8px 12px',
                borderRadius: '4px',
                border: record.isWork ? '1px solid #d6e4ff' : record.isMaterial ? '1px solid #d9f7be' : 'none',
                borderLeft: record.isMaterial ? '3px solid #52c41a' : record.isWork ? '3px solid #1890ff' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {record.isWork ? (
                    <>
                      <Button
                        type="text"
                        size="small"
                        icon={expandedWorks.has(record.item_id) ? <MinusOutlined /> : <PlusOutlined />}
                        onClick={() => toggleWorkExpansion(record.item_id)}
                        style={{
                          padding: '2px 4px',
                          minWidth: '20px',
                          height: '20px',
                          backgroundColor: expandedWorks.has(record.item_id) ? '#e6f7ff' : '#f0f0f0'
                        }}
                        title={expandedWorks.has(record.item_id) ? 'Скрыть материалы' : 'Показать материалы'}
                      />
                      <CalculatorOutlined style={{ color: '#1890ff', fontSize: '16px' }} />
                      <Text strong style={{ fontSize: '14px', color: '#1890ff' }}>
                        {text}
                      </Text>
                      {(() => {
                        const materialsCount = estimateItems.filter(item => 
                          item.type === 'material' && item.work_id === record.item_id
                        ).length;
                        if (materialsCount > 0) {
                          return (
                            <Badge 
                              count={materialsCount} 
                              size="small" 
                              style={{ backgroundColor: '#52c41a', marginLeft: '8px' }}
                              title={`${materialsCount} материалов`}
                            />
                          );
                        }
                        return null;
                      })()}
                    </>
                  ) : (
                    <>
                      <span style={{ 
                        marginLeft: '24px',
                        color: '#999',
                        fontSize: '12px'
                      }}>
                        └─
                      </span>
                      <FileTextOutlined style={{ color: '#52c41a', fontSize: '14px' }} />
                      <Text style={{ fontSize: '13px', color: '#52c41a' }}>
                        {text}
                      </Text>
                    </>
                  )}
                </div>
              </div>
            )
          },
          {
            title: 'Изображение',
            dataIndex: 'image_url',
            key: 'image_url',
            width: 80,
            align: 'center',
            render: (imageUrl, record) => {
              if (record.isMaterial && imageUrl) {
                return (
                  <Image
                    src={imageUrl}
                    alt={record.name}
                    width={30}
                    height={30}
                    style={{
                      objectFit: 'cover',
                      borderRadius: '4px',
                      border: '1px solid #d9d9d9'
                    }}
                    fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMIAAADDCAYAAADQvc6UAAABRWlDQ1BJQ0MgUHJvZmlsZQAAKJFjYGASSSwoyGFhYGDIzSspCnJ3UoiIjFJgf8LAwSDCIMogwMCcmFxc4BgQ4ANUwgCjUcG3awyMIPqyLsis7PPOq3QdDFcvjV3jOD1boQVTPQrgSkktTgbSf4A4LbmgqISBgTEFyFYuLykAsTuAbJEioKOA7DkgdjqEvQHEToKwj4DVhAQ5A9k3gGyB5IxEoBmML4BsnSQk8XQkNtReEOBxcfXxUQg1Mjc0dyHgXNJBSWpFCYh2zi+oLMpMzyhRcASGUqqCZ16yno6CkYGRAQMDKMwhqj/fAIcloxgHQqxAjIHBEugw5sUIsSQpBobtQPdLciLEVJYzMPBHMDBsayhILEqEO4DxG0txmrERhM29nYGBddr//5/DGRjYNRkY/l7////39v///y4Dmn+LgeHANwDrkl1AuO+pmgAAADhlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAAqACAAQAAAABAAAAwqADAAQAAAABAAAAwwAAAAD9b/HnAAAHlklEQVR4Ae3dP3Ik1RnG4W+FgYxN"
                  />
                );
              } else if (record.isWork) {
                return (
                  <div style={{
                    width: '30px',
                    height: '30px',
                    backgroundColor: '#1890ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: 'white',
                    margin: '0 auto'
                  }}>
                    🔨
                  </div>
                );
              } else {
                return (
                  <div style={{
                    width: '30px',
                    height: '30px',
                    backgroundColor: '#52c41a',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: 'white',
                    margin: '0 auto'
                  }}>
                    📦
                  </div>
                );
              }
            }
          },
          {
            title: 'Ед.изм.',
            dataIndex: 'unit',
            key: 'unit',
            width: 80,
            render: (text) => <Text>{text}</Text>
          },
          {
            title: 'Количество',
            dataIndex: 'quantity',
            key: 'quantity',
            width: 100,
            render: (value) => <Text strong>{value}</Text>
          },
          {
            title: 'Цена за единицу',
            dataIndex: 'unit_price',
            key: 'unit_price',
            width: 120,
            render: (value) => (
              <Text strong style={{ color: '#1890ff' }}>
                {value ? `${parseFloat(value).toFixed(2)} ₽` : '-'}
              </Text>
            )
          },
          {
            title: 'Расход',
            dataIndex: 'consumption_per_work_unit',
            key: 'consumption_per_work_unit',
            width: 100,
            render: (value) => value ? parseFloat(value).toFixed(6) : '-'
          },
          {
            title: 'Сумма',
            dataIndex: 'total',
            key: 'total',
            width: 120,
            render: (value) => (
              <Text strong style={{ color: '#52c41a' }}>
                {value ? `${parseFloat(value).toFixed(2)} ₽` : '-'}
              </Text>
            )
          },
          {
            title: 'Действия',
            key: 'actions',
            width: 180,
            render: (_, record) => {
              if (record.isWork) {
                return (
                  <Space size="small" direction="vertical">
                    <Button
                      type="primary"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditItem(record)}
                      block
                    >
                      Редактировать
                    </Button>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddMaterial(record)}
                      block
                      style={{ color: '#52c41a', borderColor: '#52c41a' }}
                    >
                      Добавить материал
                    </Button>
                    <Popconfirm
                      title="Удалить блок?"
                      description="Удалить работу и все связанные материалы?"
                      onConfirm={() => handleDeleteItem(record)}
                      okText="Да"
                      cancelText="Нет"
                    >
                      <Button
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        block
                      >
                        Удалить
                      </Button>
                    </Popconfirm>
                  </Space>
                );
              } else {
                return (
                  <Space size="small" wrap>
                    <Button
                      type="link"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => handleEditItem(record)}
                      title="Редактировать материал"
                    />
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => handleReplaceMaterial(record)}
                      title="Заменить материал"
                      style={{ color: '#faad14' }}
                    />
                    <Popconfirm
                      title="Удалить материал?"
                      description="Удалить материал из работы?"
                      onConfirm={() => handleDeleteItem(record)}
                      okText="Да"
                      cancelText="Нет"
                    >
                      <Button
                        type="link"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        title="Удалить материал"
                      />
                    </Popconfirm>
                  </Space>
                );
              }
            }
          }
        ]}
        dataSource={flatEstimateItems}
        rowKey={(record, index) => `${record.type}_${record.item_id}_${index}`}
        loading={loading}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} из ${total} позиций`
        }}
        scroll={{ x: 1200 }}
        summary={() => (
          <Table.Summary.Row style={{ backgroundColor: '#f8f9fa' }}>
            <Table.Summary.Cell index={0} colSpan={7}>
              <Text strong style={{ fontSize: '16px' }}>
                Итого по смете:
              </Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={7}>
              <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                {stats.totalAmount.toFixed(2)} ₽
              </Text>
            </Table.Summary.Cell>
            <Table.Summary.Cell index={8} />
          </Table.Summary.Row>
        )}
      />

      {/* Модальное окно для добавления/редактирования */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalculatorOutlined style={{ color: '#1890ff' }} />
            {selectedItem ? 'Редактирование блока работ' : 'Добавление блока работ в смету'}
          </div>
        }
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>
            Отмена
          </Button>,
          <Button key="submit" type="primary" onClick={() => form.submit()} icon={<SaveOutlined />}>
            {selectedItem ? 'Сохранить блок' : 'Добавить блок в смету'}
          </Button>
        ]}
        width={700}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleSaveItem}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="type" label="Тип позиции" initialValue="work" rules={[{ required: true, message: 'Выберите тип позиции' }]}>
                <Select placeholder="Выберите тип" size="large" disabled>
                  <Option value="work">
                    <Space>
                      <CalculatorOutlined />
                      Работа
                    </Space>
                  </Option>
            </Select>
          </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="quantity" label="Количество" rules={[{ required: true, message: 'Введите количество' }]}>
                <InputNumber 
                  placeholder="0.00" 
                  min={0} 
                  precision={2} 
                  style={{ width: '100%' }} 
                  size="large"
                />
              </Form.Item>
            </Col>
          </Row>

                <Form.Item
                  name="item_id"
            label={
              <Space>
                <CalculatorOutlined />
                Выберите работу
              </Space>
            }
            rules={[{ required: true, message: 'Выберите работу' }]}
                >
                  <Select
              placeholder="Выберите работу"
              size="large"
              showSearch
              filterOption={(input, option) =>
                option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
                    onChange={async (value) => {
                const item = works.find((w) => w.id === value);
                      if (item) {
                        form.setFieldsValue({
                          name: item.name,
                          unit: item.unit,
                          unit_price: item.unit_price || 0
                        });

                  // Загрузим связанные материалы для отображения
                          await loadWorkMaterials(value);
                      }
                    }}
                  >
              {works.map((work) => (
                          <Option key={work.id} value={work.id}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{work.name}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {work.unit_price ? `${work.unit_price} ₽/${work.unit}` : 'цена не указана'}
                    </div>
                  </div>
                          </Option>
                        ))}
                  </Select>
          </Form.Item>

          {/* Отображение связанных материалов для работы */}
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) =>
              prevValues.item_id !== currentValues.item_id || prevValues.quantity !== currentValues.quantity
            }
          >
            {({ getFieldValue }) => {
              const workId = getFieldValue('item_id');
              const quantity = getFieldValue('quantity') || 1;

              if (workId && workMaterials[workId]?.length > 0) {
                const materials = workMaterials[workId];
                const totalMaterialsCost = materials.reduce((sum, mat) => {
                  const materialQuantity = (mat.total_consumption || 0) * quantity;
                  const materialCost = materialQuantity * (mat.material_unit_price || 0);
                  return sum + materialCost;
                }, 0);

                return (
                  <Card 
                    title={
                      <Space>
                        <FileTextOutlined style={{ color: '#52c41a' }} />
                    <Text strong style={{ color: '#52c41a' }}>
                          Связанные материалы (будут добавлены автоматически)
                    </Text>
                      </Space>
                    }
                    size="small"
                    style={{ marginTop: 16, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}
                  >
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {materials.map((mat) => {
                        const materialQuantity = (mat.total_consumption || 0) * quantity;
                        const materialCost = materialQuantity * (mat.material_unit_price || 0);
                        return (
                          <div key={mat.material_id} style={{ 
                            marginBottom: 8, 
                            padding: '8px 12px', 
                            backgroundColor: '#fff',
                            borderRadius: '4px',
                            border: '1px solid #d9f7be'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <Text strong style={{ fontSize: '13px' }}>{mat.material_name}</Text>
                                <br />
                                <Text type="secondary" style={{ fontSize: '11px' }}>
                                  Расход: {materialQuantity.toFixed(6)} {mat.material_unit}
                                </Text>
                              </div>
                              <Text strong style={{ color: '#52c41a', fontSize: '14px' }}>
                                {materialCost.toFixed(2)} ₽
                              </Text>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Divider style={{ margin: '12px 0' }} />
                    <div style={{ textAlign: 'right' }}>
                      <Text strong style={{ color: '#52c41a', fontSize: '16px' }}>
                        Итого материалов: {totalMaterialsCost.toFixed(2)} ₽
                      </Text>
                  </div>
                  </Card>
                );
              }
              return null;
            }}
          </Form.Item>

          <Form.Item name="name" style={{ display: 'none' }}>
            <Input />
          </Form.Item>
          <Form.Item name="unit" style={{ display: 'none' }}>
            <Input />
          </Form.Item>
          <Form.Item name="unit_price" style={{ display: 'none' }}>
            <InputNumber />
          </Form.Item>
        </Form>
      </Modal>

      {/* Модальное окно для добавления/замены материалов */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileTextOutlined style={{ color: '#52c41a' }} />
            {materialAction === 'add' ? 'Добавление материала к работе' : 'Замена материала'}
          </div>
        }
        open={materialModalVisible}
        onCancel={() => {
          setMaterialModalVisible(false);
          materialForm.resetFields();
        }}
        footer={[
          <Button key="cancel" onClick={() => {
            setMaterialModalVisible(false);
            materialForm.resetFields();
          }}>
            Отмена
          </Button>,
          <Button key="submit" type="primary" onClick={() => materialForm.submit()}>
            {materialAction === 'add' ? 'Добавить материал' : 'Заменить материал'}
          </Button>
        ]}
        width={800}
        destroyOnClose
      >
        <Form 
          form={materialForm} 
          layout="vertical" 
          onFinish={handleSaveMaterial}
          initialValues={{
            quantity: 1,
            waste_coeff: 1,
            consumption_per_work_unit: 1,
            unit_price: 0
          }}
        >
          <Row gutter={16}>
            {/* Выбор материала */}
            <Col span={24}>
              <Form.Item 
                name="material_id" 
                label="Выберите материал"
                rules={[{ required: true, message: 'Выберите материал' }]}
              >
                <Select
                  placeholder="Начните вводить название материала..."
                  showSearch
                  optionFilterProp="children"
                  filterOption={(input, option) => {
                    const materialName = option.key || '';
                    return materialName.toLowerCase().includes(input.toLowerCase());
                  }}
                  size="large"
                  onChange={(value) => {
                    const selectedMaterial = materials.find(m => m.id === value);
                    if (selectedMaterial) {
                      // Принудительно обновляем поля формы
                      const fieldsToUpdate = {
                        name: selectedMaterial.name,
                        unit: selectedMaterial.unit,
                        unit_price: selectedMaterial.unit_price || 0,
                        image_url: selectedMaterial.image_url,
                        item_url: selectedMaterial.item_url
                      };
                      
                      materialForm.setFieldsValue(fieldsToUpdate);
                      
                      // Принудительно перепроверяем валидацию для поля цены
                      materialForm.validateFields(['unit_price']).catch(() => {});
                    }
                  }}
                >
                  {materials.map((material) => (
                    <Option key={material.name} value={material.id}>
                      <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                        <Text strong style={{ fontSize: '14px', lineHeight: '1.2' }}>
                          {material.name}
                        </Text>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '2px' }}>
                          <Text style={{ fontSize: '12px', color: '#666' }}>
                            {material.unit_price ? `${material.unit_price} ₽/${material.unit}` : 'цена не указана'}
                          </Text>
                          {material.image_url && (
                            <Badge count="📷" style={{ marginLeft: 8 }} size="small" />
                          )}
                        </div>
                      </div>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            {/* Скрытые поля для данных материала */}
            <Form.Item name="name" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="unit" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="image_url" noStyle>
              <Input type="hidden" />
            </Form.Item>
            <Form.Item name="item_url" noStyle>
              <Input type="hidden" />
            </Form.Item>

            {/* Количество и цена */}
            <Col span={8}>
              <Form.Item 
                name="quantity" 
                label="Количество"
                rules={[
                  { required: true, message: 'Введите количество' },
                  { type: 'number', min: 0.001, message: 'Количество должно быть больше 0' }
                ]}
              >
                <InputNumber 
                  placeholder="1.0" 
                  style={{ width: '100%' }}
                  step={0.1}
                  precision={3}
                  size="large"
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item 
                name="unit_price" 
                label={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Цена за единицу (₽)
                    <Tooltip title="Цена автоматически подставляется из справочника. Вы можете изменить её при необходимости.">
                      <Badge count="?" style={{ backgroundColor: '#1890ff' }} size="small" />
                    </Tooltip>
                  </div>
                }
                rules={[
                  { 
                    validator: (_, value) => {
                      if (value === null || value === undefined || value === '') {
                        return Promise.reject(new Error('Пожалуйста, выберите материал для автоматического заполнения цены'));
                      }
                      if (value < 0) {
                        return Promise.reject(new Error('Цена не может быть отрицательной'));
                      }
                      return Promise.resolve();
                    }
                  }
                ]}
              >
                <InputNumber 
                  placeholder="0.00" 
                  style={{ width: '100%' }}
                  step={0.01}
                  precision={2}
                  size="large"
                  addonAfter={
                    <Tooltip title="Цена из справочника">
                      <FileTextOutlined style={{ color: '#52c41a' }} />
                    </Tooltip>
                  }
                />
              </Form.Item>
            </Col>

            <Col span={8}>
              <Form.Item 
                name="consumption_per_work_unit" 
                label="Расход на единицу работы"
                rules={[
                  { required: true, message: 'Введите расход' },
                  { type: 'number', min: 0.001, message: 'Расход должен быть больше 0' }
                ]}
              >
                <InputNumber 
                  placeholder="1.0" 
                  style={{ width: '100%' }}
                  step={0.1}
                  precision={3}
                  size="large"
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item 
                name="waste_coeff" 
                label="Коэффициент потерь"
                rules={[
                  { required: true, message: 'Введите коэффициент' },
                  { type: 'number', min: 1, message: 'Коэффициент должен быть больше или равен 1' }
                ]}
              >
                <InputNumber 
                  placeholder="1.1" 
                  style={{ width: '100%' }}
                  step={0.01}
                  precision={3}
                  size="large"
                />
              </Form.Item>
            </Col>

            {/* Предварительный просмотр суммы */}
            <Col span={12}>
              <Form.Item noStyle shouldUpdate>
                {({ getFieldValue }) => {
                  const quantity = getFieldValue('quantity') || 0;
                  const unitPrice = getFieldValue('unit_price') || 0;
                  const total = quantity * unitPrice;
                  
                  return (
                    <Form.Item label="Общая стоимость">
                      <div style={{
                        padding: '8px 12px',
                        backgroundColor: '#f6ffed',
                        border: '1px solid #b7eb8f',
                        borderRadius: '6px',
                        textAlign: 'center'
                      }}>
                        <Text strong style={{ fontSize: '16px', color: '#52c41a' }}>
                          {total.toFixed(2)} ₽
                        </Text>
                      </div>
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </Col>

            {/* Информация о заменяемом материале */}
            {materialAction === 'replace' && selectedMaterialToReplace && (
              <Col span={24}>
                <Card 
                  size="small" 
                  title="Заменяемый материал" 
                  style={{ 
                    backgroundColor: '#fff7e6', 
                    border: '1px solid #ffd591',
                    marginTop: 16 
                  }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text><Text strong>Название:</Text> {selectedMaterialToReplace.name}</Text>
                    <Text><Text strong>Количество:</Text> {selectedMaterialToReplace.quantity} {selectedMaterialToReplace.unit}</Text>
                    <Text><Text strong>Цена:</Text> {selectedMaterialToReplace.unit_price} ₽/{selectedMaterialToReplace.unit}</Text>
                    <Text><Text strong>Сумма:</Text> <Text type="danger">{selectedMaterialToReplace.total.toFixed(2)} ₽</Text></Text>
                  </Space>
                </Card>
              </Col>
            )}
          </Row>
        </Form>
      </Modal>
    </MainCard>
  );
}
