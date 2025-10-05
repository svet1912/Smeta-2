import React, { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, InputNumber, Select, Switch, Table, Button, Statistic, Space, Input, notification } from 'antd';
import { getAuthToken, removeAuthToken } from '../../api/auth';
import {
  BuildOutlined,
  HomeOutlined,
  SettingOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  FireOutlined,
  DropboxOutlined,
  CalculatorOutlined,
  SaveOutlined,
  LoadingOutlined
} from '@ant-design/icons';

const { Option } = Select;
// const { Title } = Typography; // Неиспользуемый импорт

// Функция для получения правильного API URL
const getApiBaseUrl = () => {
  // Проверяем переменную окружения
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // Автоматическое определение для GitHub Codespaces
  const currentHost = window.location.hostname;
  if (currentHost.includes('.app.github.dev')) {
    // Заменяем порт 3000 на 3001 в GitHub Codespaces URL
    return '/api-proxy';
    // Используем прокси через Vite dev server
  }

  // Fallback для локальной разработки
  return 'http://localhost:3001/api';
};

// Единые стили для всех полей ввода
const inputStyles = {
  fontSize: '13px',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  height: '28px',
  lineHeight: '28px',
  fontWeight: '400'
};

const compactInputStyles = {
  ...inputStyles,
  fontSize: '12px',
  height: '26px',
  lineHeight: '26px'
};

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
  } catch {
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
          ...compactInputStyles,
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

const ObjectParameters = ({ projectId: propProjectId }) => {
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

  // Состояние загрузки
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState(propProjectId || null); // Используем переданный projectId или загружаем первый доступный
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Проверка валидности токена
  const checkTokenValidity = async (token) => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return response.ok;
    } catch {
      console.log('⚠️ Не удалось проверить токен, продолжаем работу');
      return true; // Предполагаем что токен валиден
    }
  };

  // Загрузка первого доступного проекта
  const loadFirstProject = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.log('⚠️ Токен не найден, используем локальные данные');
        setLoading(false);
        return null;
      }

      const response = await fetch(`${getApiBaseUrl()}/projects`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const projects = await response.json();
        if (projects.length > 0) {
          const firstProject = projects[0];
          console.log(`✅ Используем проект ID: ${firstProject.id} - ${firstProject.customer_name}`);
          setProjectId(firstProject.id);
          return firstProject.id;
        } else {
          console.log('⚠️ В системе нет проектов');
          notification.warning({
            message: 'Нет проектов',
            description: 'Создайте проект в разделе "Хранилище проектов"'
          });
          setLoading(false);
          return null;
        }
      }
    } catch (error) {
      console.error('Ошибка загрузки проектов:', error);
    }
    setLoading(false);
    return null;
  };

  // Функции для работы с API
  const loadObjectParameters = useCallback(
    async (currentProjectId = projectId) => {
      try {
        setLoading(true);

        const token = getAuthToken();
        if (!token) {
          console.log('Токен не найден, работаем в режиме просмотра');
          notification.info({
            message: 'Режим просмотра',
            description: 'Войдите в систему для сохранения данных'
          });
          setLoading(false);
          return;
        }

        // Если нет projectId, загружаем первый проект
        if (!currentProjectId) {
          const loadedProjectId = await loadFirstProject();
          if (!loadedProjectId) {
            setLoading(false);
            return;
          }
          currentProjectId = loadedProjectId;
        }

        // Проверяем валидность токена
        const isTokenValid = await checkTokenValidity(token);
        if (!isTokenValid) {
          console.log('Токен недействителен, работаем в режиме просмотра');
          removeAuthToken(); // Удаляем недействительный токен
          setIsAuthenticated(false);
          notification.warning({
            message: 'Сессия истекла',
            description: 'Пожалуйста, войдите в систему заново'
          });
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // Загружаем параметры объекта
        const objectParamsResponse = await fetch(`${getApiBaseUrl()}/projects/${currentProjectId}/object-parameters`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (objectParamsResponse.status === 404) {
          // Параметры не найдены - создаем их с значениями по умолчанию
          console.log('Параметры объекта не найдены, создаем с значениями по умолчанию');
          setLoading(false);

          // Автоматически сохраняем параметры по умолчанию через 1 секунду
          setTimeout(() => {
            console.log('Создаем параметры объекта по умолчанию...');
            saveObjectParameters();
          }, 1000);
          return;
        }

        if (objectParamsResponse.status === 401) {
          console.log('Токен недействителен или истек, используем значения по умолчанию');
          notification.warning({
            message: 'Не авторизован',
            description: 'Пожалуйста, войдите в систему для сохранения данных'
          });
          setLoading(false);
          return;
        }

        if (!objectParamsResponse.ok) {
          throw new Error('Ошибка загрузки параметров объекта');
        }

        const objectParams = await objectParamsResponse.json();

        // Загружаем помещения
        const roomsResponse = await fetch(`${getApiBaseUrl()}/object-parameters/${objectParams.id}/rooms`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (roomsResponse.ok) {
          const roomsData = await roomsResponse.json();
          if (roomsData.length > 0) {
            // Преобразуем данные из БД в формат компонента
            const formattedRooms = roomsData.map((room) => ({
              id: room.id,
              name: room.room_name || room.name,
              perimeter: room.perimeter || 0,
              height: room.height || 2.7,
              floorArea: room.area || room.floor_area || 0,
              prostenki: room.prostenki || 0,
              doorsCount: room.doors_count || 0,
              window1Width: room.window1_width || 0,
              window1Height: room.window1_height || 0,
              window2Width: room.window2_width || 0,
              window2Height: room.window2_height || 0,
              window3Width: room.window3_width || 0,
              window3Height: room.window3_height || 0,
              portal1Width: room.portal1_width || 0,
              portal1Height: room.portal1_height || 0,
              portal2Width: room.portal2_width || 0,
              portal2Height: room.portal2_height || 0
            }));
            setRooms(formattedRooms);
          }
        }

        // Обновляем параметры здания если они есть в objectParams
        if (objectParams.building_floors) {
          setBuildingParams((prev) => ({
            ...prev,
            floors: objectParams.building_floors,
            purpose: objectParams.building_purpose || prev.purpose,
            energyClass: objectParams.energy_class || prev.energyClass,
            hasBasement: objectParams.has_basement || prev.hasBasement,
            hasAttic: objectParams.has_attic || prev.hasAttic,
            heatingType: objectParams.heating_type || prev.heatingType
          }));
        }
      } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        notification.error({
          message: 'Ошибка загрузки',
          description: 'Не удалось загрузить данные объекта'
        });
      } finally {
        setLoading(false);
      }
    },
    [projectId] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const saveObjectParameters = useCallback(async () => {
    try {
      setSaving(true);

      const token = getAuthToken();
      if (!token) {
        notification.warning({
          message: 'Не авторизован',
          description: 'Пожалуйста, войдите в систему для сохранения данных'
        });
        setSaving(false);
        return;
      }

      // Проверяем валидность токена перед сохранением
      const isTokenValid = await checkTokenValidity(token);
      if (!isTokenValid) {
        removeAuthToken(); // Удаляем недействительный токен
        notification.error({
          message: 'Сессия истекла',
          description: 'Пожалуйста, войдите в систему заново'
        });
        setSaving(false);
        return;
      }

      // Сохраняем параметры объекта
      const objectParamsResponse = await fetch(`${getApiBaseUrl()}/projects/${projectId}/object-parameters`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          building_type: buildingParams.purpose || 'residential',
          construction_category: 2,
          floors_above_ground: buildingParams.floors || 1,
          floors_below_ground: buildingParams.hasBasement ? 1 : 0,
          height_above_ground: (buildingParams.floors || 1) * 2.7,
          height_below_ground: buildingParams.hasBasement ? 2.5 : 0,
          total_area: 100.0,
          building_area: 80.0,
          estimated_cost: 2000000,
          construction_complexity: 'средняя',
          seismic_zone: 6,
          wind_load: 2,
          snow_load: 3,
          soil_conditions: 'суглинок',
          groundwater_level: 3.0,
          climate_zone: 'умеренная'
        })
      });

      if (objectParamsResponse.status === 401) {
        notification.warning({
          message: 'Не авторизован',
          description: 'Пожалуйста, войдите в систему для сохранения данных'
        });
        setSaving(false);
        return;
      }

      if (!objectParamsResponse.ok) {
        throw new Error('Ошибка сохранения параметров объекта');
      }

      const savedObjectParams = await objectParamsResponse.json();
      console.log('Saved object params:', savedObjectParams); // Для отладки

      // ID находится в data поле
      const objectParamsId = savedObjectParams.data?.id;
      console.log('🔍 savedObjectParams:', savedObjectParams);
      console.log('🔍 objectParamsId:', objectParamsId);
      if (!objectParamsId) {
        throw new Error('Не удалось получить ID параметров объекта');
      }

      // Сохраняем каждое помещение
      for (const room of rooms) {
        const roomData = {
          roomName: room.name,
          area: room.floorArea,
          height: room.height,
          volume: room.floorArea * room.height, // Вычисляем объем
          finishClass: 'standard', // Значение по умолчанию
          purpose: 'general', // Значение по умолчанию
          sortOrder: 0, // Значение по умолчанию
          perimeter: room.perimeter,
          prostenki: room.prostenki,
          doorsCount: room.doorsCount,
          window1Width: room.window1Width,
          window1Height: room.window1Height,
          window2Width: room.window2Width,
          window2Height: room.window2Height,
          window3Width: room.window3Width,
          window3Height: room.window3Height,
          portal1Width: room.portal1Width,
          portal1Height: room.portal1Height,
          portal2Width: room.portal2Width,
          portal2Height: room.portal2Height
        };

        // Проверяем, является ли помещение новым (ID сгенерирован локально или это дефолтные помещения)
        const isNewRoom = room.id > 1000000 || room.id <= 3; // ID 1,2,3 - это дефолтные помещения

        if (isNewRoom) {
          // Новое помещение - создаем через POST
          const response = await fetch(`${getApiBaseUrl()}/object-parameters/${objectParamsId}/rooms`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(roomData)
          });

          if (response.ok) {
            const newRoomData = await response.json();
            // Обновляем ID в локальном состоянии
            setRooms((prev) => prev.map((r) => (r.id === room.id ? { ...r, id: newRoomData.data.id } : r)));
          }
        } else {
          // Существующее помещение пользователя - обновляем через PUT
          await fetch(`/api-proxy/rooms/${room.id}`, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(roomData)
          });
        }
      }

      notification.success({
        message: 'Сохранено',
        description: 'Параметры объекта успешно сохранены'
      });
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      notification.error({
        message: 'Ошибка сохранения',
        description: 'Не удалось сохранить данные объекта'
      });
    } finally {
      setSaving(false);
    }
  }, [projectId, rooms, buildingParams]);

  // Загрузка данных при монтировании компонента
  useEffect(() => {
    // Если projectId передан как prop, используем его
    if (propProjectId) {
      setProjectId(propProjectId);
      loadObjectParameters(propProjectId);
    } else if (projectId === null) {
      // При монтировании загружаем первый доступный проект (только если projectId не передан)
      loadFirstProject().then((id) => {
        if (id) {
          loadObjectParameters(id);
        }
      });
    } else {
      loadObjectParameters();
    }
  }, [projectId, propProjectId, loadObjectParameters]);

  // Автосохранение при изменении данных (с задержкой)
  useEffect(() => {
    if (loading || saving || !isAuthenticated) return; // Не сохраняем для неавторизованных пользователей

    const timeoutId = setTimeout(() => {
      console.log('Автосохранение данных...');
      saveObjectParameters();
    }, 3000); // Автосохранение через 3 секунды после изменения

    return () => clearTimeout(timeoutId);
  }, [rooms, buildingParams, constructiveParams, engineeringParams, isAuthenticated, loading, saving]); // eslint-disable-line react-hooks/exhaustive-deps

  // Функции для обновления данных
  const updateBuildingParam = (key, value) => {
    setBuildingParams((prev) => ({ ...prev, [key]: value }));
  };

  // Функция валидации значений
  const validateRoomValue = (field, value) => {
    const numValue = parseFloat(value) || 0;

    switch (field) {
      case 'perimeter':
      case 'height':
      case 'floorArea':
        return Math.max(0, Math.min(1000, numValue)); // 0-1000 м
      case 'window1Width':
      case 'window1Height':
      case 'window2Width':
      case 'window2Height':
      case 'window3Width':
      case 'window3Height':
      case 'portal1Width':
      case 'portal1Height':
      case 'portal2Width':
      case 'portal2Height':
        return Math.max(0, Math.min(10, numValue)); // 0-10 м для окон/порталов
      case 'prostenki':
        return Math.max(0, Math.min(500, numValue)); // 0-500 м.пог для простенков
      case 'doorsCount':
        return Math.max(0, Math.min(20, Math.floor(numValue))); // 0-20 шт, целое число
      default:
        return numValue;
    }
  };

  const updateRoom = (roomId, field, value) => {
    const validatedValue = validateRoomValue(field, value);
    setRooms((prev) => prev.map((room) => (room.id === roomId ? { ...room, [field]: validatedValue } : room)));
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
    setRooms(rooms.filter((room) => room.id !== roomId));
  };

  const updateConstructiveParam = (key, value) => {
    setConstructiveParams((prev) => ({ ...prev, [key]: value }));
  };

  const updateEngineeringParam = (key, value) => {
    setEngineeringParams((prev) => ({ ...prev, [key]: value }));
  };

  // Колонки для таблицы помещений
  const roomColumns = [
    {
      title: 'Помещение',
      dataIndex: 'name',
      key: 'name',
      width: 110,
      render: (text) => (
        <span
          style={{
            fontWeight: '500',
            fontSize: '12px',
            color: '#2c3e50'
          }}
        >
          {text}
        </span>
      )
    },
    {
      title: 'Периметр (м.пог.)',
      dataIndex: 'perimeter',
      key: 'perimeter',
      width: 90,
      render: (value, record) => (
        <FormulaInput
          value={value}
          onChange={(val) => updateRoom(record.id, 'perimeter', val || 0)}
          style={{ width: '100%', ...compactInputStyles }}
        />
      )
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
          style={{ width: '100%', ...compactInputStyles }}
        />
      )
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
          style={{ width: '100%', ...compactInputStyles }}
        />
      )
    },
    {
      title: 'Площадь стен (м²)',
      dataIndex: 'wallsArea',
      key: 'wallsArea',
      width: 90,
      render: (_, record) => {
        const totalOpeningsArea =
          record.window1Width * record.window1Height +
          record.window2Width * record.window2Height +
          record.window3Width * record.window3Height +
          record.portal1Width * record.portal1Height +
          record.portal2Width * record.portal2Height;

        const grossWallArea = record.perimeter * record.height;
        const wallArea = grossWallArea - totalOpeningsArea;

        // Проверка на логические ошибки
        const hasError = wallArea < 0 || totalOpeningsArea > grossWallArea * 0.8; // Предупреждение если проемы > 80% стены

        return (
          <span
            style={{
              color: hasError ? '#ff4d4f' : '#52c41a',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            {wallArea.toFixed(1)}
            {hasError && ' ⚠️'}
          </span>
        );
      }
    },
    {
      title: 'Откосы (м.пог.)',
      dataIndex: 'slopes',
      key: 'slopes',
      width: 90,
      render: (value, record) => {
        // Формула откосов: для каждого окна (ширина + 2*высота) + простенки
        const w1w = parseFloat(record.window1Width) || 0;
        const w1h = parseFloat(record.window1Height) || 0;
        const w2w = parseFloat(record.window2Width) || 0;
        const w2h = parseFloat(record.window2Height) || 0;
        const w3w = parseFloat(record.window3Width) || 0;
        const w3h = parseFloat(record.window3Height) || 0;
        const prostenki = parseFloat(record.prostenki) || 0;

        const window1Slopes = w1w > 0 && w1h > 0 ? w1w + 2 * w1h : 0;
        const window2Slopes = w2w > 0 && w2h > 0 ? w2w + 2 * w2h : 0;
        const window3Slopes = w3w > 0 && w3h > 0 ? w3w + 2 * w3h : 0;

        const totalSlopes = window1Slopes + window2Slopes + window3Slopes + prostenki;

        // Проверяем разумность значений
        const perimeter = parseFloat(record.perimeter) || 0;
        const maxReasonableSlopes = perimeter * 2; // Максимум - двойной периметр
        const hasWarning = totalSlopes > maxReasonableSlopes;

        return (
          <span
            style={{
              color: hasWarning ? '#fa8c16' : '#52c41a',
              fontWeight: 'bold',
              fontSize: '11px'
            }}
          >
            {Number(totalSlopes).toFixed(1)}
            {hasWarning && ' ⚠️'}
          </span>
        );
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
          style={{ width: '100%', ...compactInputStyles }}
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
          style={{ width: '100%', ...compactInputStyles }}
          controls={false}
        />
      )
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
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Ширина"
          />
          <FormulaInput
            value={record.window1Height}
            onChange={(val) => updateRoom(record.id, 'window1Height', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Высота"
          />
        </Space.Compact>
      )
    },
    {
      title: 'Окно 2 Ш×В (м)',
      key: 'window2',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <FormulaInput
            value={record.window2Width}
            onChange={(val) => updateRoom(record.id, 'window2Width', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Ширина"
          />
          <FormulaInput
            value={record.window2Height}
            onChange={(val) => updateRoom(record.id, 'window2Height', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Высота"
          />
        </Space.Compact>
      )
    },
    {
      title: 'Окно 3 Ш×В (м)',
      key: 'window3',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <FormulaInput
            value={record.window3Width}
            onChange={(val) => updateRoom(record.id, 'window3Width', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Ширина"
          />
          <FormulaInput
            value={record.window3Height}
            onChange={(val) => updateRoom(record.id, 'window3Height', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Высота"
          />
        </Space.Compact>
      )
    },
    {
      title: 'Портал 1 Ш×В (м)',
      key: 'portal1',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <FormulaInput
            value={record.portal1Width}
            onChange={(val) => updateRoom(record.id, 'portal1Width', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Ширина"
          />
          <FormulaInput
            value={record.portal1Height}
            onChange={(val) => updateRoom(record.id, 'portal1Height', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Высота"
          />
        </Space.Compact>
      )
    },
    {
      title: 'Портал 2 Ш×В (м)',
      key: 'portal2',
      width: 110,
      render: (_, record) => (
        <Space.Compact>
          <FormulaInput
            value={record.portal2Width}
            onChange={(val) => updateRoom(record.id, 'portal2Width', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Ширина"
          />
          <FormulaInput
            value={record.portal2Height}
            onChange={(val) => updateRoom(record.id, 'portal2Height', val || 0)}
            style={{
              width: '50%',
              fontSize: '12px'
            }}
            placeholder="Высота"
          />
        </Space.Compact>
      )
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 60,
      render: (_, record) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeRoom(record.id)} size="small" />
    }
  ];

  // Показываем индикатор загрузки
  if (loading) {
    return (
      <div
        style={{
          padding: '24px',
          backgroundColor: '#f0f2f5',
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}
      >
        <Card>
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <LoadingOutlined style={{ fontSize: '24px', marginBottom: '16px' }} />
            <div>Загрузка параметров объекта...</div>
          </div>
        </Card>
      </div>
    );
  }

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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
              <Switch checked={buildingParams.hasBasement} onChange={(val) => updateBuildingParam('hasBasement', val)} />
            </div>
          </Col>
          <Col span={8}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label>Наличие чердака</label>
              <Switch checked={buildingParams.hasAttic} onChange={(val) => updateBuildingParam('hasAttic', val)} />
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
            <Space style={{ marginLeft: 'auto' }}>
              {!isAuthenticated && !loading && (
                <span
                  style={{
                    fontSize: '12px',
                    color: '#999',
                    marginRight: '8px'
                  }}
                >
                  🔒 Режим просмотра
                </span>
              )}
              <Button
                icon={saving ? <LoadingOutlined /> : <SaveOutlined />}
                onClick={saveObjectParameters}
                size="small"
                loading={saving}
                disabled={loading || !isAuthenticated}
                type={isAuthenticated ? 'default' : 'dashed'}
              >
                {saving ? 'Сохранение...' : isAuthenticated ? 'Сохранить' : 'Войдите для сохранения'}
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={addRoom} size="small" disabled={loading}>
                Добавить помещение
              </Button>
            </Space>
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
          scroll={{ x: 1500 }}
          style={{
            fontSize: '12px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}
        />

        {/* Справочная информация */}
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#1890ff'
          }}
        >
          💡 <strong>Формулы расчета:</strong> Площадь стен = Периметр × Высота - Площади всех проемов | Откосы = (Ширина окна + 2 × Высота
          окна) + Простенки | ⚠️ - предупреждение о возможных ошибках в данных
        </div>

        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f6ffed',
            border: '1px solid #b7eb8f',
            borderRadius: '6px'
          }}
        >
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
                  const wallArea =
                    room.perimeter * room.height -
                    room.window1Width * room.window1Height -
                    room.window2Width * room.window2Height -
                    room.window3Width * room.window3Height -
                    room.portal1Width * room.portal1Height -
                    room.portal2Width * room.portal2Height;
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
                  const window1Slopes =
                    (room.window1Width || 0) > 0 && (room.window1Height || 0) > 0
                      ? (room.window1Width || 0) + 2 * (room.window1Height || 0)
                      : 0;
                  const window2Slopes =
                    (room.window2Width || 0) > 0 && (room.window2Height || 0) > 0
                      ? (room.window2Width || 0) + 2 * (room.window2Height || 0)
                      : 0;
                  const window3Slopes =
                    (room.window3Width || 0) > 0 && (room.window3Height || 0) > 0
                      ? (room.window3Width || 0) + 2 * (room.window3Height || 0)
                      : 0;

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
              <Statistic title="Всего помещений" value={rooms.length} suffix="шт" valueStyle={{ color: '#722ed1' }} />
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
                style={{ width: '100%', marginTop: '4px', ...inputStyles }}
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
              <Switch checked={engineeringParams.heating} onChange={(val) => updateEngineeringParam('heating', val)} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <ThunderboltOutlined style={{ fontSize: '24px', color: '#fadb14' }} />
              <label>Электричество</label>
              <Switch checked={engineeringParams.electricity} onChange={(val) => updateEngineeringParam('electricity', val)} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <DropboxOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <label>Водоснабжение</label>
              <Switch checked={engineeringParams.water} onChange={(val) => updateEngineeringParam('water', val)} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <DropboxOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              <label>Канализация</label>
              <Switch checked={engineeringParams.sewage} onChange={(val) => updateEngineeringParam('sewage', val)} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <SettingOutlined style={{ fontSize: '24px', color: '#13c2c2' }} />
              <label>Вентиляция</label>
              <Switch checked={engineeringParams.ventilation} onChange={(val) => updateEngineeringParam('ventilation', val)} />
            </div>
          </Col>
          <Col span={4}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <SettingOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
              <label>Кондиционирование</label>
              <Switch checked={engineeringParams.airConditioning} onChange={(val) => updateEngineeringParam('airConditioning', val)} />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default ObjectParameters;
