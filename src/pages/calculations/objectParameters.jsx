import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  InputNumber,
  Select,
  Switch,
  Table,
  Button,
  Statistic,
  Space,
  Input,
  Typography,
  Divider
} from 'antd';
import {
  BuildOutlined,
  HomeOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  FireOutlined,
  DropboxOutlined,
  CalculatorOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Title } = Typography;

// Функция для безопасного вычисления математических выражений
const evaluateFormula = (expression) => {
  if (typeof expression === 'number') {
    return expression;
  }
  
  if (typeof expression !== 'string') {
    return 0;
  }

  // Убираем пробелы и заменяем запятые на точки
  const cleanExpression = expression.replace(/\s/g, '').replace(/,/g, '.');
  
  // Если это просто число без операторов
  if (!/[+\-*/()]/.test(cleanExpression)) {
    return parseFloat(cleanExpression) || 0;
  }

  // Проверяем на незавершенные выражения (заканчиваются на оператор)
  if (/[+\-*/]$/.test(cleanExpression)) {
    return 0; // Возвращаем 0 для незавершенных выражений
  }

  // Проверяем на пустые скобки или некорректные символы
  if (cleanExpression.includes('()') || !/^[\d+\-*/().]+$/.test(cleanExpression)) {
    return parseFloat(cleanExpression.replace(/[^0-9.]/g, '')) || 0;
  }

  try {
    // Проверяем балансировку скобок
    let openParens = 0;
    for (let char of cleanExpression) {
      if (char === '(') openParens++;
      if (char === ')') openParens--;
      if (openParens < 0) return 0; // Неправильная балансировка
    }
    if (openParens !== 0) return 0; // Несбалансированные скобки

    // Безопасное вычисление с помощью Function constructor
    const result = new Function('return ' + cleanExpression)();
    return isNaN(result) || !isFinite(result) ? 0 : Number(result.toFixed(2));
  } catch (error) {
    // Если не удалось вычислить как формулу, пробуем извлечь число
    const numbers = cleanExpression.match(/\d+\.?\d*/g);
    return numbers ? parseFloat(numbers[0]) || 0 : 0;
  }
};

// Компонент для ввода с поддержкой формул
const FormulaInput = ({ value, onChange, style, ...props }) => {
  const [inputValue, setInputValue] = useState(value?.toString() || '');
  const [originalValue, setOriginalValue] = useState(value?.toString() || '');
  const [isFormula, setIsFormula] = useState(false);
  const [showResult, setShowResult] = useState(false);
  
  React.useEffect(() => {
    const newValue = value?.toString() || '';
    setInputValue(newValue);
    setOriginalValue(newValue);
  }, [value]);

  const handleInputChange = (newValue) => {
    setInputValue(newValue);
    
    // Проверяем, содержит ли ввод математические операторы
    const hasOperators = /[+\-*/]/.test(newValue);
    setIsFormula(hasOperators);
    setShowResult(false); // Сбрасываем показ результата при изменении
  };

  const handleCalculate = () => {
    if (isFormula) {
      // Вычисляем результат и передаем наверх
      const result = evaluateFormula(inputValue);
      setShowResult(true);
      setOriginalValue(result.toString()); // Обновляем оригинальное значение
      if (onChange) {
        onChange(result);
      }
    } else {
      // Для обычных чисел
      const numValue = parseFloat(inputValue) || 0;
      setOriginalValue(numValue.toString()); // Обновляем оригинальное значение
      if (onChange) {
        onChange(numValue);
      }
    }
  };

  const handleCancel = () => {
    // Восстанавливаем оригинальное значение
    setInputValue(originalValue);
    setShowResult(false);
    setIsFormula(/[+\-*/]/.test(originalValue));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCalculate();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  const displayValue = showResult && isFormula ? evaluateFormula(inputValue) : inputValue;

  return (
    <div style={{ position: 'relative', ...style }}>
      <Input
        value={displayValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onBlur={handleCalculate}
        onKeyDown={handleKeyPress}
        placeholder="Введите число или формулу (2+3*4)"
        style={{ 
          paddingRight: isFormula ? '30px' : '8px',
          color: showResult && isFormula ? '#52c41a' : 'inherit',
          fontWeight: showResult && isFormula ? 'bold' : 'normal'
        }}
        {...props}
      />
      {isFormula && (
        <CalculatorOutlined
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: showResult ? '#52c41a' : '#1890ff',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          onClick={handleCalculate}
          title="Нажмите для вычисления, Enter - вычислить, Esc - отменить"
        />
      )}
    </div>
  );
};

const ObjectParameters = () => {
  const [buildingParams, setBuildingParams] = useState({
    floors: 1,
    purpose: 'residential',
    energyClass: 'B',
    hasBasement: false,
    hasAttic: false,
    heatingType: 'central'
  });

  const [rooms, setRooms] = useState([
    {
      id: 1,
      name: 'Гостиная',
      perimeter: 18.0,
      height: 2.7,
      floorArea: 20.0,
      prostenki: 0,
      doorsCount: 2,
      window1Width: 1.5,
      window1Height: 1.2,
      window2Width: 0,
      window2Height: 0,
      window3Width: 0,
      window3Height: 0,
      portal1Width: 0,
      portal1Height: 0,
      portal2Width: 0,
      portal2Height: 0
    },
    {
      id: 2,
      name: 'Спальня',
      perimeter: 15.0,
      height: 2.7,
      floorArea: 14.0,
      prostenki: 0,
      doorsCount: 1,
      window1Width: 1.2,
      window1Height: 1.2,
      window2Width: 0,
      window2Height: 0,
      window3Width: 0,
      window3Height: 0,
      portal1Width: 0,
      portal1Height: 0,
      portal2Width: 0,
      portal2Height: 0
    },
    {
      id: 3,
      name: 'Кухня',
      perimeter: 13.0,
      height: 2.7,
      floorArea: 10.5,
      prostenki: 0,
      doorsCount: 1,
      window1Width: 1.0,
      window1Height: 1.0,
      window2Width: 0.8,
      window2Height: 1.0,
      window3Width: 0,
      window3Height: 0,
      portal1Width: 0,
      portal1Height: 0,
      portal2Width: 0,
      portal2Height: 0
    }
  ]);

  const [constructiveParams, setConstructiveParams] = useState({
    wallMaterial: 'brick',
    wallThickness: 380,
    floorType: 'concrete',
    roofType: 'pitched',
    insulationType: 'mineral_wool'
  });

  const [engineeringParams, setEngineeringParams] = useState({
    heating: true,
    electricity: true,
    water: true,
    sewage: true,
    ventilation: false,
    airConditioning: false
  });

  // Функции для обновления данных
  const updateBuildingParam = (key, value) => {
    setBuildingParams(prev => ({ ...prev, [key]: value }));
  };

  const updateRoom = (roomId, field, value) => {
    setRooms(prev => 
      prev.map(room => 
        room.id === roomId ? { ...room, [field]: value } : room
      )
    );
  };

  const addRoom = () => {
    const newRoom = {
      id: Date.now(),
      name: `Помещение ${rooms.length + 1}`,
      perimeter: 12.0,
      height: 2.7,
      floorArea: 9.0,
      wallArea: 32.4,
      slopes: 2.0,
      doorsCount: 1,
      window1Width: 0,
      window1Height: 0,
      window2Width: 0,
      window2Height: 0,
      window3Width: 0,
      window3Height: 0,
      portal1Width: 0,
      portal1Height: 0,
      portal2Width: 0,
      portal2Height: 0
    };
    setRooms([...rooms, newRoom]);
  };

  const removeRoom = (roomId) => {
    setRooms(rooms.filter(room => room.id !== roomId));
  };

  const updateConstructiveParam = (key, value) => {
    setConstructiveParams(prev => ({ ...prev, [key]: value }));
  };

  const updateEngineeringParam = (key, value) => {
    setEngineeringParams(prev => ({ ...prev, [key]: value }));
  };

  // Колонки для таблицы помещений
  const roomColumns = [
    {
      title: 'Помещение',
      dataIndex: 'name',
      key: 'name',
      width: 110,
      render: (text) => (
        <span style={{ fontWeight: '500' }}>{text}</span>
      ),
    },
    {
      title: 'Периметр (м.пог.)',
      dataIndex: 'perimeter',
      key: 'perimeter',
      width: 100,
      render: (value, record) => (
        <FormulaInput
          value={value}
          onChange={(val) => updateRoom(record.id, 'perimeter', val || 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Высота (м)',
      dataIndex: 'height',
      key: 'height',
      width: 80,
      render: (value, record) => (
        <FormulaInput
          value={value}
          onChange={(val) => updateRoom(record.id, 'height', val || 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Площадь пола (м²)',
      dataIndex: 'floorArea',
      key: 'floorArea',
      width: 120,
      render: (value, record) => (
        <FormulaInput
          value={value}
          onChange={(val) => updateRoom(record.id, 'floorArea', val)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Площадь стен (м²)',
      dataIndex: 'wallArea',
      key: 'wallArea',
      width: 100,
      render: (_, record) => {
        const wallArea = (
          record.perimeter * record.height - 
          (record.window1Width * record.window1Height) - 
          (record.window2Width * record.window2Height) - 
          (record.window3Width * record.window3Height) - 
          (record.portal1Width * record.portal1Height) - 
          (record.portal2Width * record.portal2Height)
        ).toFixed(1);
        return <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{wallArea}</span>;
      },
    },
    {
      title: 'Откосы (м.пог.)',
      dataIndex: 'slopes',
      key: 'slopes',
      width: 100,
      render: (value, record) => {
        // Формула: для каждого окна (ширина + 2*высота) + простенки
        const window1Slopes = (record.window1Width || 0) > 0 && (record.window1Height || 0) > 0 
          ? (record.window1Width || 0) + 2 * (record.window1Height || 0) : 0;
        const window2Slopes = (record.window2Width || 0) > 0 && (record.window2Height || 0) > 0 
          ? (record.window2Width || 0) + 2 * (record.window2Height || 0) : 0;
        const window3Slopes = (record.window3Width || 0) > 0 && (record.window3Height || 0) > 0 
          ? (record.window3Width || 0) + 2 * (record.window3Height || 0) : 0;
        
        const totalSlopes = window1Slopes + window2Slopes + window3Slopes + (record.prostenki || 0);
        
        return <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{totalSlopes.toFixed(1)}</span>;
      }
    },
    {
      title: 'Простенки (м.пог.)',
      dataIndex: 'prostenki',
      key: 'prostenki',
      width: 120,
      render: (value, record) => (
        <FormulaInput
          value={value}
          onChange={(val) => updateRoom(record.id, 'prostenki', val)}
          style={{ width: '100%' }}
        />
      )
    },
    {
      title: 'Двери (шт)',
      dataIndex: 'doorsCount',
      key: 'doorsCount',
      width: 80,
      render: (value, record) => (
        <InputNumber
          value={value}
          onChange={(val) => updateRoom(record.id, 'doorsCount', val || 0)}
          min={0}
          step={1}
          size="small"
          style={{ width: '100%' }}
          controls={false}
        />
      ),
    },
    {
      title: 'Окно 1 Ш×В (м)',
      key: 'window1',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <FormulaInput
            value={record.window1Width}
            onChange={(val) => updateRoom(record.id, 'window1Width', val || 0)}
            style={{ width: '50%' }}
          />
          <FormulaInput
            value={record.window1Height}
            onChange={(val) => updateRoom(record.id, 'window1Height', val || 0)}
            style={{ width: '50%' }}
          />
        </Space.Compact>
      ),
    },
    {
      title: 'Окно 2 Ш×В (м)',
      key: 'window2',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <InputNumber
            value={record.window2Width}
            onChange={(val) => updateRoom(record.id, 'window2Width', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="Ш"
            controls={false}
          />
          <InputNumber
            value={record.window2Height}
            onChange={(val) => updateRoom(record.id, 'window2Height', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="В"
            controls={false}
          />
        </Space.Compact>
      ),
    },
    {
      title: 'Окно 3 Ш×В (м)',
      key: 'window3',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <InputNumber
            value={record.window3Width}
            onChange={(val) => updateRoom(record.id, 'window3Width', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="Ш"
            controls={false}
          />
          <InputNumber
            value={record.window3Height}
            onChange={(val) => updateRoom(record.id, 'window3Height', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="В"
            controls={false}
          />
        </Space.Compact>
      ),
    },
    {
      title: 'Портал 1 Ш×В (м)',
      key: 'portal1',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <InputNumber
            value={record.portal1Width}
            onChange={(val) => updateRoom(record.id, 'portal1Width', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="Ш"
            controls={false}
          />
          <InputNumber
            value={record.portal1Height}
            onChange={(val) => updateRoom(record.id, 'portal1Height', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="В"
            controls={false}
          />
        </Space.Compact>
      ),
    },
    {
      title: 'Портал 2 Ш×В (м)',
      key: 'portal2',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <InputNumber
            value={record.portal2Width}
            onChange={(val) => updateRoom(record.id, 'portal2Width', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="Ш"
            controls={false}
          />
          <InputNumber
            value={record.portal2Height}
            onChange={(val) => updateRoom(record.id, 'portal2Height', val || 0)}
            min={0}
            step={0.1}
            size="small"
            style={{ width: '50%' }}
            precision={1}
            placeholder="В"
            controls={false}
          />
        </Space.Compact>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeRoom(record.id)}
          size="small"
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', backgroundColor: '#f0f2f5', minHeight: '100vh' }}>
      {/* Общие параметры здания */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BuildOutlined style={{ color: '#1890ff' }} />
            Общие параметры здания
          </div>
        }
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <div>
              <label>Количество этажей</label>
              <InputNumber
                value={buildingParams.floors}
                onChange={(val) => updateBuildingParam('floors', val)}
                min={1}
                max={20}
                style={{ width: '100%', marginTop: '4px' }}
                controls={false}
              />
            </div>
          </Col>
          <Col span={6}>
            <div>
              <label>Назначение здания</label>
              <Select
                value={buildingParams.purpose}
                onChange={(val) => updateBuildingParam('purpose', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="residential">Жилое</Option>
                <Option value="office">Офисное</Option>
                <Option value="commercial">Коммерческое</Option>
                <Option value="industrial">Промышленное</Option>
              </Select>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <label>Класс энергоэффективности</label>
              <Select
                value={buildingParams.energyClass}
                onChange={(val) => updateBuildingParam('energyClass', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="A++">A++</Option>
                <Option value="A+">A+</Option>
                <Option value="A">A</Option>
                <Option value="B">B</Option>
                <Option value="C">C</Option>
                <Option value="D">D</Option>
              </Select>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <label>Тип отопления</label>
              <Select
                value={buildingParams.heatingType}
                onChange={(val) => updateBuildingParam('heatingType', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="central">Центральное</Option>
                <Option value="individual">Индивидуальное</Option>
                <Option value="electric">Электрическое</Option>
                <Option value="gas">Газовое</Option>
              </Select>
            </div>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label>Наличие подвала</label>
              <Switch
                checked={buildingParams.hasBasement}
                onChange={(val) => updateBuildingParam('hasBasement', val)}
              />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label>Наличие чердака</label>
              <Switch
                checked={buildingParams.hasAttic}
                onChange={(val) => updateBuildingParam('hasAttic', val)}
              />
            </div>
          </Col>
        </Row>
      </Card>

      {/* Габариты помещений */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HomeOutlined style={{ color: '#52c41a' }} />
            Габариты помещений
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={addRoom}
              size="small"
              style={{ marginLeft: 'auto' }}
            >
              Добавить помещение
            </Button>
          </div>
        }
        style={{ marginBottom: '24px' }}
      >
        <Table
          columns={roomColumns}
          dataSource={rooms}
          rowKey="id"
          pagination={false}
          size="small"
          bordered
        />
        
        <div style={{ 
          marginTop: '16px', 
          padding: '12px', 
          backgroundColor: '#f6ffed', 
          border: '1px solid #b7eb8f',
          borderRadius: '6px'
        }}>
          <Row gutter={[16, 8]}>
            <Col span={6}>
              <Statistic
                title="Общая площадь пола"
                value={rooms.reduce((sum, room) => sum + room.floorArea, 0)}
                precision={1}
                suffix="м²"
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Общая площадь стен"
                value={rooms.reduce((sum, room) => {
                  const wallArea = room.perimeter * room.height - 
                    (room.window1Width * room.window1Height) - 
                    (room.window2Width * room.window2Height) - 
                    (room.window3Width * room.window3Height) - 
                    (room.portal1Width * room.portal1Height) - 
                    (room.portal2Width * room.portal2Height);
                  return sum + wallArea;
                }, 0)}
                precision={1}
                suffix="м²"
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Всего откосов"
                value={rooms.reduce((sum, room) => {
                  const window1Slopes = (room.window1Width || 0) > 0 && (room.window1Height || 0) > 0 
                    ? (room.window1Width || 0) + 2 * (room.window1Height || 0) : 0;
                  const window2Slopes = (room.window2Width || 0) > 0 && (room.window2Height || 0) > 0 
                    ? (room.window2Width || 0) + 2 * (room.window2Height || 0) : 0;
                  const window3Slopes = (room.window3Width || 0) > 0 && (room.window3Height || 0) > 0 
                    ? (room.window3Width || 0) + 2 * (room.window3Height || 0) : 0;
                  
                  return sum + window1Slopes + window2Slopes + window3Slopes + (room.prostenki || 0);
                }, 0)}
                precision={1}
                suffix="м.пог."
                valueStyle={{ color: '#52c41a' }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="Всего периметра"
                value={rooms.reduce((sum, room) => sum + room.perimeter, 0)}
                precision={1}
                suffix="м.пог."
                valueStyle={{ color: '#13c2c2' }}
              />
            </Col>
          </Row>
          <Row gutter={[16, 8]} style={{ marginTop: '8px' }}>
            <Col span={8}>
              <Statistic
                title="Всего помещений"
                value={rooms.length}
                suffix="шт"
                valueStyle={{ color: '#722ed1' }}
              />
            </Col>
            <Col span={8}>
              <Statistic
                title="Всего дверей"
                value={rooms.reduce((sum, room) => sum + room.doorsCount, 0)}
                suffix="шт"
                valueStyle={{ color: '#fa8c16' }}
              />
            </Col>
          </Row>
        </div>
      </Card>

      {/* Конструктивные элементы */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SettingOutlined style={{ color: '#fa8c16' }} />
            Конструктивные элементы
          </div>
        }
        style={{ marginBottom: '24px' }}
      >
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <div>
              <label>Материал стен</label>
              <Select
                value={constructiveParams.wallMaterial}
                onChange={(val) => updateConstructiveParam('wallMaterial', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="brick">Кирпич</Option>
                <Option value="concrete">Бетон</Option>
                <Option value="wood">Дерево</Option>
                <Option value="panel">Панель</Option>
              </Select>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <label>Толщина стен (мм)</label>
              <InputNumber
                value={constructiveParams.wallThickness}
                onChange={(val) => updateConstructiveParam('wallThickness', val)}
                min={100}
                max={1000}
                step={10}
                style={{ width: '100%', marginTop: '4px' }}
                controls={false}
              />
            </div>
          </Col>
          <Col span={6}>
            <div>
              <label>Тип перекрытия</label>
              <Select
                value={constructiveParams.floorType}
                onChange={(val) => updateConstructiveParam('floorType', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="concrete">Железобетон</Option>
                <Option value="wood">Деревянное</Option>
                <Option value="metal">Металлическое</Option>
              </Select>
            </div>
          </Col>
          <Col span={6}>
            <div>
              <label>Тип кровли</label>
              <Select
                value={constructiveParams.roofType}
                onChange={(val) => updateConstructiveParam('roofType', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="pitched">Скатная</Option>
                <Option value="flat">Плоская</Option>
                <Option value="mansard">Мансардная</Option>
              </Select>
            </div>
          </Col>
        </Row>
        <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
          <Col span={6}>
            <div>
              <label>Тип утеплителя</label>
              <Select
                value={constructiveParams.insulationType}
                onChange={(val) => updateConstructiveParam('insulationType', val)}
                style={{ width: '100%', marginTop: '4px' }}
              >
                <Option value="mineral_wool">Минвата</Option>
                <Option value="foam">Пенопласт</Option>
                <Option value="extruded_foam">Пеноплекс</Option>
                <Option value="eco_wool">Эковата</Option>
              </Select>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Инженерные системы */}
      <Card 
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThunderboltOutlined style={{ color: '#722ed1' }} />
            Инженерные системы
          </div>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <FireOutlined style={{ fontSize: '24px', color: '#ff4d4f' }} />
              <label>Отопление</label>
              <Switch
                checked={engineeringParams.heating}
                onChange={(val) => updateEngineeringParam('heating', val)}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <ThunderboltOutlined style={{ fontSize: '24px', color: '#fadb14' }} />
              <label>Электричество</label>
              <Switch
                checked={engineeringParams.electricity}
                onChange={(val) => updateEngineeringParam('electricity', val)}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <DropboxOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <label>Водоснабжение</label>
              <Switch
                checked={engineeringParams.water}
                onChange={(val) => updateEngineeringParam('water', val)}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <DropboxOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              <label>Канализация</label>
              <Switch
                checked={engineeringParams.sewage}
                onChange={(val) => updateEngineeringParam('sewage', val)}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <SettingOutlined style={{ fontSize: '24px', color: '#13c2c2' }} />
              <label>Вентиляция</label>
              <Switch
                checked={engineeringParams.ventilation}
                onChange={(val) => updateEngineeringParam('ventilation', val)}
              />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <SettingOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
              <label>Кондиционирование</label>
              <Switch
                checked={engineeringParams.airConditioning}
                onChange={(val) => updateEngineeringParam('airConditioning', val)}
              />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ObjectParameters;