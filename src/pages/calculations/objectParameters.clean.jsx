import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Input, Button, notification, Space, Spin } from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined, LoadingOutlined, SettingOutlined } from '@ant-design/icons';
import { getAuthToken } from '../../api/auth';

// CSS стили для скрытия стрелочек у input[type="number"]
const hideSpinnerStyles = `
  .ant-input[type="number"] {
    -webkit-appearance: textfield;
    -moz-appearance: textfield;
  }
  
  .ant-input[type="number"]::-webkit-outer-spin-button,
  .ant-input[type="number"]::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  .ant-input[type="number"]::-moz-number-spin-box {
    -moz-appearance: none;
  }
`;

// Добавляем стили в head
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = hideSpinnerStyles;
  document.head.appendChild(styleElement);
}

// Функция для безопасного вычисления математических выражений
const safeEval = (expression) => {
  try {
    // Удаляем пробелы и проверяем на допустимые символы
    const cleanExpression = expression.toString().replace(/\s/g, '');

    // Разрешаем только цифры, точки, запятые, и основные математические операторы
    if (!/^[0-9+\-*/.(),]+$/.test(cleanExpression)) {
      return null;
    }

    // Заменяем запятые на точки для корректной работы с десятичными числами
    const normalizedExpression = cleanExpression.replace(/,/g, '.');

    // Используем Function constructor вместо eval для большей безопасности
    const result = new Function('return ' + normalizedExpression)();

    // Проверяем, что результат - это число
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100; // Округляем до 2 знаков после запятой
    }

    return null;
  } catch {
    return null;
  }
};

// Компонент калькулятора для числовых полей
const CalculatorInput = ({ value, onChange, placeholder, ...props }) => {
  const [displayValue, setDisplayValue] = useState(value?.toString() || '');
  const [isEditing, setIsEditing] = useState(false);

  // Обновляем отображаемое значение при изменении value извне
  useEffect(() => {
    if (!isEditing) {
      setDisplayValue(value?.toString() || '');
    }
  }, [value, isEditing]);

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);

    if (displayValue.trim() === '') {
      onChange(0);
      setDisplayValue('0');
      return;
    }

    // Проверяем, содержит ли строка математические операторы
    const hasOperators = /[+\-*/]/.test(displayValue);

    if (hasOperators) {
      const result = safeEval(displayValue);
      if (result !== null) {
        onChange(result);
        setDisplayValue(result.toString());
      } else {
        // Если выражение некорректное, возвращаем предыдущее значение
        setDisplayValue(value?.toString() || '0');
      }
    } else {
      // Если это просто число, парсим его обычным способом
      const numValue = parseFloat(displayValue.replace(',', '.')) || 0;
      onChange(numValue);
      setDisplayValue(numValue.toString());
    }
  };

  const handleChange = (e) => {
    setDisplayValue(e.target.value);
  };

  const handleKeyDown = (e) => {
    // При нажатии Enter применяем вычисление
    if (e.key === 'Enter') {
      e.target.blur(); // Это вызовет handleBlur
    }
  };

  return (
    <Input
      {...props}
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      title="Можно вводить математические выражения: 2+3, 10*1.5, 20/4 и т.д. Нажмите Enter или уберите фокус для вычисления"
    />
  );
};

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  // Проверяем переменную окружения
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Автоматическое определение для GitHub Codespaces
  const currentHost = window.location.hostname;

  if (currentHost.includes('.app.github.dev')) {
    // Используем прокси через Vite dev server
    return '/api-proxy';
  }

  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

// Простой компонент для параметров объекта
const ObjectParametersNew = ({ projectId = 56 }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [objectParametersId, setObjectParametersId] = useState(null);

  // Загрузка данных
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 Загружаем данные для проекта:', projectId);

      const token = getAuthToken();
      if (!token) {
        console.log('❌ Нет токена авторизации');
        setLoading(false);
        return;
      }

      // Получаем параметры объекта
      const objectParamsResponse = await fetch(`${getApiBaseUrl()}/projects/${projectId}/object-parameters`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!objectParamsResponse.ok) {
        throw new Error('Не удалось загрузить параметры объекта');
      }

      const objectParams = await objectParamsResponse.json();
      console.log('✅ Параметры объекта:', objectParams);
      setObjectParametersId(objectParams.id);

      // Получаем помещения
      const roomsResponse = await fetch(`${getApiBaseUrl()}/object-parameters/${objectParams.id}/rooms`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (roomsResponse.ok) {
        const roomsData = await roomsResponse.json();
        console.log('✅ Помещения загружены:', roomsData);

        // Преобразуем данные из БД в формат компонента
        const formattedRooms = roomsData.map((room) => {
          console.log(`🏠 Загружаем помещение ${room.room_name}: ceiling_area=${room.ceiling_area}, ceiling_slopes=${room.ceiling_slopes}`);
          return {
            id: room.id,
            name: room.room_name,
            area: parseFloat(room.area) || 0,
            height: parseFloat(room.height) || 2.7,
            perimeter: parseFloat(room.perimeter) || 0,
            prostenki: parseFloat(room.prostenki) || 0,
            ceilingArea: parseFloat(room.ceiling_area) || 0,
            ceilingSlopes: parseFloat(room.ceiling_slopes) || 0,
            window1Width: parseFloat(room.window1_width) || 0,
            window1Height: parseFloat(room.window1_height) || 0,
            window2Width: parseFloat(room.window2_width) || 0,
            window2Height: parseFloat(room.window2_height) || 0,
            window3Width: parseFloat(room.window3_width) || 0,
            window3Height: parseFloat(room.window3_height) || 0,
            portal1Width: parseFloat(room.portal1_width) || 0,
            portal1Height: parseFloat(room.portal1_height) || 0,
            portal2Width: parseFloat(room.portal2_width) || 0,
            portal2Height: parseFloat(room.portal2_height) || 0
          };
        });

        setRooms(formattedRooms);
      } else {
        console.log('⚠️ Нет помещений, создаем пустой список');
        setRooms([]);
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки:', error);
      notification.error({
        message: 'Ошибка загрузки',
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Сохранение данных
  const saveData = async () => {
    try {
      setSaving(true);
      console.log('💾 Сохраняем данные...');

      const token = getAuthToken();
      if (!token) {
        notification.error({
          message: 'Ошибка авторизации',
          description: 'Войдите в систему для сохранения данных'
        });
        return;
      }

      // Сохраняем каждое помещение
      for (const room of rooms) {
        if (room.id > 1000000) {
          // Новое помещение - создаем
          console.log('➕ Создаем новое помещение:', room.name);

          const newRoomData = {
            objectParametersId: objectParametersId,
            roomName: room.name,
            area: room.area,
            height: room.height,
            volume: room.area * room.height,
            finishClass: 'standard',
            purpose: 'general',
            sortOrder: 0,
            perimeter: room.perimeter,
            prostenki: room.prostenki,
            ceilingArea: room.ceilingArea,
            ceilingSlopes: room.ceilingSlopes,
            doorsCount: 1,
            window1Width: room.window1Width.toString(),
            window1Height: room.window1Height.toString(),
            window2Width: room.window2Width.toString(),
            window2Height: room.window2Height.toString(),
            window3Width: room.window3Width.toString(),
            window3Height: room.window3Height.toString(),
            portal1Width: room.portal1Width.toString(),
            portal1Height: room.portal1Height.toString(),
            portal2Width: room.portal2Width.toString(),
            portal2Height: room.portal2Height.toString()
          };

          const createResponse = await fetch(`${getApiBaseUrl()}/object-parameters/${objectParametersId}/rooms`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(newRoomData)
          });

          if (!createResponse.ok) {
            throw new Error(`Ошибка создания помещения "${room.name}"`);
          }

          const createdRoom = await createResponse.json();
          console.log(`✅ Помещение "${room.name}" создано с ID:`, createdRoom.id);

          // Обновляем ID в локальном состоянии
          room.id = createdRoom.id;
        } else {
          // Существующее помещение - обновляем
          console.log('📝 Обновляем помещение:', room.name);

          const roomData = {
            roomName: room.name,
            area: room.area,
            height: room.height,
            volume: room.area * room.height,
            finishClass: 'standard',
            purpose: 'general',
            sortOrder: 0,
            perimeter: room.perimeter,
            prostenki: room.prostenki,
            ceilingArea: room.ceilingArea,
            ceilingSlopes: room.ceilingSlopes,
            doorsCount: 1,
            window1Width: room.window1Width.toString(),
            window1Height: room.window1Height.toString(),
            window2Width: room.window2Width.toString(),
            window2Height: room.window2Height.toString(),
            window3Width: room.window3Width.toString(),
            window3Height: room.window3Height.toString(),
            portal1Width: room.portal1Width.toString(),
            portal1Height: room.portal1Height.toString(),
            portal2Width: room.portal2Width.toString(),
            portal2Height: room.portal2Height.toString()
          };

          const response = await fetch(`${getApiBaseUrl()}/rooms/${room.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(roomData)
          });

          if (!response.ok) {
            throw new Error(`Ошибка сохранения помещения "${room.name}"`);
          }

          console.log(`✅ Помещение "${room.name}" сохранено`);
        }
      }

      setHasChanges(false);

      // Перезагружаем данные с сервера после сохранения
      await loadData();

      notification.success({
        message: 'Сохранено',
        description: 'Все изменения успешно сохранены'
      });
    } catch (error) {
      console.error('❌ Ошибка сохранения:', error);
      notification.error({
        message: 'Ошибка сохранения',
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  // Обновление помещения
  const updateRoom = (roomId, field, value) => {
    if (field === 'ceilingArea' || field === 'ceilingSlopes') {
      console.log(`🏠 Изменение поля ${field} в помещении ${roomId}: ${value}`);
    }
    setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, [field]: value } : room)));
    setHasChanges(true);
  };

  // Добавление помещения
  const addRoom = () => {
    const newRoom = {
      id: Date.now(), // Временный ID
      name: `Помещение ${rooms.length + 1}`,
      area: 0,
      height: 0,
      perimeter: 0,
      prostenki: 0,
      ceilingArea: 0,
      ceilingSlopes: 0,
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
    setRooms((prev) => [...prev, newRoom]);
    setHasChanges(true);
  };

  // Удаление помещения
  const deleteRoom = async (roomId) => {
    try {
      // Если ID больше 1000000, то это новое помещение (еще не в БД)
      if (roomId < 1000000) {
        const token = getAuthToken();
        if (!token) {
          notification.error({
            message: 'Ошибка авторизации',
            description: 'Войдите в систему для удаления помещения'
          });
          return;
        }

        console.log('🗑️ Удаляем помещение из БД:', roomId);

        const response = await fetch(`${getApiBaseUrl()}/rooms/${roomId}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Ошибка удаления помещения из базы данных');
        }

        console.log('✅ Помещение удалено из БД');
      }

      // Удаляем из локального состояния
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      setHasChanges(false); // Сбрасываем флаг изменений, так как операция завершена

      notification.success({
        message: 'Помещение удалено',
        description: 'Помещение успешно удалено'
      });
    } catch (error) {
      console.error('❌ Ошибка удаления:', error);
      notification.error({
        message: 'Ошибка удаления',
        description: error.message
      });
    }
  };

  // Загрузка при монтировании
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Колонки таблицы
  const columns = [
    {
      title: 'Название',
      dataIndex: 'name',
      key: 'name',
      width: 120,
      render: (value, record) => (
        <Input value={value} onChange={(e) => updateRoom(record.id, 'name', e.target.value)} placeholder="Название" size="small" />
      )
    },
    {
      title: 'Площадь (м²)',
      dataIndex: 'area',
      key: 'area',
      width: 75,
      render: (value, record) => (
        <CalculatorInput value={value} onChange={(newValue) => updateRoom(record.id, 'area', newValue)} placeholder="0" size="small" />
      )
    },
    {
      title: 'Высота (м)',
      dataIndex: 'height',
      key: 'height',
      width: 70,
      render: (value, record) => (
        <CalculatorInput value={value} onChange={(newValue) => updateRoom(record.id, 'height', newValue)} placeholder="2.7" size="small" />
      )
    },
    {
      title: 'Периметр (м)',
      dataIndex: 'perimeter',
      key: 'perimeter',
      width: 75,
      render: (value, record) => (
        <CalculatorInput value={value} onChange={(newValue) => updateRoom(record.id, 'perimeter', newValue)} placeholder="0" size="small" />
      )
    },
    {
      title: 'Простенки (м)',
      dataIndex: 'prostenki',
      key: 'prostenki',
      width: 75,
      render: (value, record) => (
        <CalculatorInput value={value} onChange={(newValue) => updateRoom(record.id, 'prostenki', newValue)} placeholder="0" size="small" />
      )
    },
    {
      title: 'Площадь потолка (м²)',
      dataIndex: 'ceilingArea',
      key: 'ceilingArea',
      width: 95,
      render: (value, record) => (
        <CalculatorInput
          value={value}
          onChange={(newValue) => updateRoom(record.id, 'ceilingArea', newValue)}
          placeholder="0"
          size="small"
        />
      )
    },
    {
      title: 'Откосы потолочные (м.пог.)',
      dataIndex: 'ceilingSlopes',
      key: 'ceilingSlopes',
      width: 100,
      render: (value, record) => (
        <CalculatorInput
          value={value}
          onChange={(newValue) => updateRoom(record.id, 'ceilingSlopes', newValue)}
          placeholder="0"
          size="small"
        />
      )
    },
    {
      title: 'Окно 1 (Ш×В)',
      key: 'window1',
      width: 95,
      render: (_, record) => (
        <Space.Compact>
          <CalculatorInput
            value={record.window1Width}
            onChange={(newValue) => updateRoom(record.id, 'window1Width', newValue)}
            placeholder="Ш"
            size="small"
            style={{ width: 47 }}
          />
          <CalculatorInput
            value={record.window1Height}
            onChange={(newValue) => updateRoom(record.id, 'window1Height', newValue)}
            placeholder="В"
            size="small"
            style={{ width: 47 }}
          />
        </Space.Compact>
      )
    },
    {
      title: 'Окно 2 (Ш×В)',
      key: 'window2',
      width: 95,
      render: (_, record) => (
        <Space.Compact>
          <CalculatorInput
            value={record.window2Width}
            onChange={(newValue) => updateRoom(record.id, 'window2Width', newValue)}
            placeholder="Ш"
            size="small"
            style={{ width: 47 }}
          />
          <CalculatorInput
            value={record.window2Height}
            onChange={(newValue) => updateRoom(record.id, 'window2Height', newValue)}
            placeholder="В"
            size="small"
            style={{ width: 47 }}
          />
        </Space.Compact>
      )
    },
    {
      title: 'Окно 3 (Ш×В)',
      key: 'window3',
      width: 95,
      render: (_, record) => (
        <Space.Compact>
          <CalculatorInput
            value={record.window3Width}
            onChange={(newValue) => updateRoom(record.id, 'window3Width', newValue)}
            placeholder="Ш"
            size="small"
            style={{ width: 47 }}
          />
          <CalculatorInput
            value={record.window3Height}
            onChange={(newValue) => updateRoom(record.id, 'window3Height', newValue)}
            placeholder="В"
            size="small"
            style={{ width: 47 }}
          />
        </Space.Compact>
      )
    },
    {
      title: 'Портал 1 (Ш×В)',
      key: 'portal1',
      width: 95,
      render: (_, record) => (
        <Space.Compact>
          <CalculatorInput
            value={record.portal1Width}
            onChange={(newValue) => updateRoom(record.id, 'portal1Width', newValue)}
            placeholder="Ш"
            size="small"
            style={{ width: 47 }}
          />
          <CalculatorInput
            value={record.portal1Height}
            onChange={(newValue) => updateRoom(record.id, 'portal1Height', newValue)}
            placeholder="В"
            size="small"
            style={{ width: 47 }}
          />
        </Space.Compact>
      )
    },
    {
      title: 'Портал 2 (Ш×В)',
      key: 'portal2',
      width: 95,
      render: (_, record) => (
        <Space.Compact>
          <CalculatorInput
            value={record.portal2Width}
            onChange={(newValue) => updateRoom(record.id, 'portal2Width', newValue)}
            placeholder="Ш"
            size="small"
            style={{ width: 47 }}
          />
          <CalculatorInput
            value={record.portal2Height}
            onChange={(newValue) => updateRoom(record.id, 'portal2Height', newValue)}
            placeholder="В"
            size="small"
            style={{ width: 47 }}
          />
        </Space.Compact>
      )
    },
    {
      title: <SettingOutlined style={{ fontSize: '16px' }} />,
      key: 'actions',
      width: 50,
      align: 'center',
      render: (_, record) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => deleteRoom(record.id)} title="Удалить помещение" />
      )
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Параметры объекта (Проект #{projectId})</span>
            <Space>
              {hasChanges && <span style={{ color: '#fa8c16', fontSize: '12px' }}>⚠️ Есть несохраненные изменения</span>}
              <Button
                type={hasChanges ? 'primary' : 'default'}
                icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
                onClick={saveData}
                loading={saving}
                size="small"
              >
                {saving ? 'Сохранение...' : hasChanges ? 'Сохранить изменения' : 'Сохранить'}
              </Button>
              <Button type="dashed" icon={<PlusOutlined />} onClick={addRoom} size="small">
                Добавить помещение
              </Button>
            </Space>
          </div>
        }
      >
        <Table
          columns={columns}
          dataSource={rooms}
          rowKey="id"
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 'max-content' }}
          locale={{
            emptyText: 'Нет помещений. Нажмите "Добавить помещение" чтобы создать первое помещение.'
          }}
        />

        {rooms.length > 0 && (
          <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <div style={{ marginBottom: '12px' }}>
              <strong>Итого по помещениям:</strong>
              <Table
                size="small"
                bordered
                pagination={false}
                style={{ marginTop: '8px' }}
                columns={[
                  {
                    title: 'Помещение',
                    dataIndex: 'name',
                    key: 'name',
                    width: 150
                  },
                  {
                    title: 'Площадь стен (м²)',
                    dataIndex: 'wallArea',
                    key: 'wallArea',
                    width: 130,
                    render: (value) => <strong style={{ color: '#1890ff' }}>{value}</strong>
                  },
                  {
                    title: 'Откосы (м.пог.)',
                    dataIndex: 'slopes',
                    key: 'slopes',
                    width: 120,
                    render: (value) => <strong style={{ color: '#52c41a' }}>{value}</strong>
                  },
                  {
                    title: 'Площадь потолка (м²)',
                    dataIndex: 'ceilingArea',
                    key: 'ceilingArea',
                    width: 130,
                    render: (value) => <strong style={{ color: '#722ed1' }}>{value}</strong>
                  },
                  {
                    title: 'Откосы потолочные (м.пог.)',
                    dataIndex: 'ceilingSlopes',
                    key: 'ceilingSlopes',
                    width: 160,
                    render: (value) => <strong style={{ color: '#eb2f96' }}>{value}</strong>
                  }
                ]}
                dataSource={rooms.map((room) => {
                  // Площадь стен = (Периметр * высоту) - (все окна и порталы)
                  const windowsAndPortalsArea =
                    room.window1Width * room.window1Height +
                    room.window2Width * room.window2Height +
                    room.window3Width * room.window3Height +
                    room.portal1Width * room.portal1Height +
                    room.portal2Width * room.portal2Height;

                  const wallArea = room.perimeter * room.height - windowsAndPortalsArea;

                  // Откосы = (ширина + (высота * 2)) + простенки (только окна, порталы не учитываем)
                  const slopes =
                    (room.window1Width > 0 && room.window1Height > 0 ? room.window1Width + room.window1Height * 2 : 0) +
                    (room.window2Width > 0 && room.window2Height > 0 ? room.window2Width + room.window2Height * 2 : 0) +
                    (room.window3Width > 0 && room.window3Height > 0 ? room.window3Width + room.window3Height * 2 : 0) +
                    room.prostenki;

                  return {
                    key: room.id,
                    name: room.name,
                    wallArea: wallArea.toFixed(1),
                    slopes: slopes.toFixed(1),
                    ceilingArea: room.ceilingArea.toFixed(1),
                    ceilingSlopes: room.ceilingSlopes.toFixed(1)
                  };
                })}
                summary={() => {
                  const totalWallArea = rooms.reduce((sum, room) => {
                    const windowsAndPortalsArea =
                      room.window1Width * room.window1Height +
                      room.window2Width * room.window2Height +
                      room.window3Width * room.window3Height +
                      room.portal1Width * room.portal1Height +
                      room.portal2Width * room.portal2Height;
                    return sum + (room.perimeter * room.height - windowsAndPortalsArea);
                  }, 0);

                  const totalSlopes = rooms.reduce((sum, room) => {
                    return (
                      sum +
                      (room.window1Width > 0 && room.window1Height > 0 ? room.window1Width + room.window1Height * 2 : 0) +
                      (room.window2Width > 0 && room.window2Height > 0 ? room.window2Width + room.window2Height * 2 : 0) +
                      (room.window3Width > 0 && room.window3Height > 0 ? room.window3Width + room.window3Height * 2 : 0) +
                      room.prostenki
                    );
                  }, 0);

                  const totalCeilingArea = rooms.reduce((sum, room) => sum + room.ceilingArea, 0);

                  const totalCeilingSlopes = rooms.reduce((sum, room) => sum + room.ceilingSlopes, 0);

                  return (
                    <Table.Summary.Row style={{ backgroundColor: '#fafafa' }}>
                      <Table.Summary.Cell index={0}>
                        <strong>ВСЕГО:</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        <strong style={{ color: '#1890ff', fontSize: '14px' }}>{totalWallArea.toFixed(1)} м²</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <strong style={{ color: '#52c41a', fontSize: '14px' }}>{totalSlopes.toFixed(1)} м.пог.</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={3}>
                        <strong style={{ color: '#722ed1', fontSize: '14px' }}>{totalCeilingArea.toFixed(1)} м²</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={4}>
                        <strong style={{ color: '#eb2f96', fontSize: '14px' }}>{totalCeilingSlopes.toFixed(1)} м.пог.</strong>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  );
                }}
              />
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ObjectParametersNew;
