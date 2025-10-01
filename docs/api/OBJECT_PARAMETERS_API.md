# API Документация - Параметры Объектов

## Обзор
Созданы новые API эндпоинты для работы с параметрами объектов, помещениями, конструктивными элементами и инженерными системами в системе SMETA 360°.

## Структура Базы Данных

### Созданные таблицы:

1. **object_parameters** - Параметры объекта (связанные с проектами)
2. **project_rooms** - Помещения проекта
3. **constructive_elements** - Конструктивные элементы
4. **engineering_systems** - Инженерные системы
5. **user_roles** - Роли пользователей
6. **user_role_assignments** - Назначения ролей
7. **permissions** - Разрешения
8. **role_permissions** - Связь ролей и разрешений
9. **audit_log** - Журнал аудита

### Система ролей:
- **super_admin** - Полный доступ
- **admin** - Управление проектами и пользователями
- **project_manager** - Управление проектами и сметами
- **estimator** - Создание и редактирование смет
- **viewer** - Только просмотр

## API Эндпоинты

### Параметры Объектов

#### GET `/api/projects/:projectId/object-parameters`
Получение параметров объекта для проекта
```bash
curl -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/projects/5/object-parameters
```

#### POST `/api/projects/:projectId/object-parameters`
Создание/обновление параметров объекта
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "buildingType": "жилое",
  "constructionCategory": 2,
  "floorsAboveGround": 5,
  "floorsBelowGround": 1,
  "heightAboveGround": 15.5,
  "heightBelowGround": 3.0,
  "totalArea": 1200.5,
  "buildingArea": 800.0,
  "estimatedCost": 25000000,
  "constructionComplexity": "средняя",
  "seismicZone": 6,
  "windLoad": 2,
  "snowLoad": 3,
  "soilConditions": "песчаный",
  "groundwaterLevel": 2.5,
  "climateZone": "умеренный"
}' \
http://localhost:3001/api/projects/5/object-parameters
```

### Помещения

#### GET `/api/object-parameters/:objectParamsId/rooms`
Получение списка помещений
```bash
curl -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/object-parameters/1/rooms
```

#### POST `/api/object-parameters/:objectParamsId/rooms`
Создание помещения
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "roomName": "Гостиная",
  "area": 25.5,
  "height": 3.0,
  "volume": 76.5,
  "finishClass": "стандарт",
  "purpose": "жилое",
  "sortOrder": 1
}' \
http://localhost:3001/api/object-parameters/1/rooms
```

#### PUT `/api/rooms/:roomId`
Обновление помещения
```bash
curl -X PUT -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "roomName": "Гостиная обновленная",
  "area": 30.0,
  "height": 3.2,
  "volume": 96.0,
  "finishClass": "улучшенная",
  "purpose": "жилое",
  "sortOrder": 1
}' \
http://localhost:3001/api/rooms/1
```

#### DELETE `/api/rooms/:roomId`
Удаление помещения
```bash
curl -X DELETE -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/rooms/1
```

### Конструктивные Элементы

#### GET `/api/object-parameters/:objectParamsId/constructive-elements`
Получение конструктивных элементов
```bash
curl -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/object-parameters/1/constructive-elements
```

#### POST `/api/object-parameters/:objectParamsId/constructive-elements`
Создание конструктивного элемента
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "elementType": "foundation",
  "material": "железобетон",
  "characteristics": "ленточный фундамент",
  "quantity": 50.0,
  "unit": "м3",
  "notes": "глубина заложения 1.5м"
}' \
http://localhost:3001/api/object-parameters/1/constructive-elements
```

#### PUT `/api/constructive-elements/:elementId`
Обновление конструктивного элемента
```bash
curl -X PUT -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "elementType": "foundation",
  "material": "железобетон М300",
  "characteristics": "ленточный фундамент усиленный",
  "quantity": 60.0,
  "unit": "м3",
  "notes": "глубина заложения 1.8м"
}' \
http://localhost:3001/api/constructive-elements/1
```

#### DELETE `/api/constructive-elements/:elementId`
Удаление конструктивного элемента
```bash
curl -X DELETE -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/constructive-elements/1
```

### Инженерные Системы

#### GET `/api/object-parameters/:objectParamsId/engineering-systems`
Получение инженерных систем
```bash
curl -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/object-parameters/1/engineering-systems
```

#### POST `/api/object-parameters/:objectParamsId/engineering-systems`
Создание инженерной системы
```bash
curl -X POST -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "systemType": "heating",
  "characteristics": "водяное отопление",
  "capacity": "25 кВт",
  "efficiency": "92%",
  "notes": "котел газовый настенный"
}' \
http://localhost:3001/api/object-parameters/1/engineering-systems
```

#### PUT `/api/engineering-systems/:systemId`
Обновление инженерной системы
```bash
curl -X PUT -H "Authorization: Bearer TOKEN" \
-H "Content-Type: application/json" \
-d '{
  "systemType": "heating",
  "characteristics": "водяное отопление двухконтурное",
  "capacity": "30 кВт",
  "efficiency": "95%",
  "notes": "котел газовый конденсационный"
}' \
http://localhost:3001/api/engineering-systems/1
```

#### DELETE `/api/engineering-systems/:systemId`
Удаление инженерной системы
```bash
curl -X DELETE -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/engineering-systems/1
```

### Роли и Разрешения

#### GET `/api/roles`
Получение всех ролей
```bash
curl -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/roles
```

#### GET `/api/users/:userId/roles`
Получение ролей пользователя
```bash
curl -H "Authorization: Bearer TOKEN" \
http://localhost:3001/api/users/1/roles
```

## Особенности Архитектуры

### Мультитенантность
- Все таблицы поддерживают разделение по `tenant_id`
- Пользователи могут иметь доступ только к данным своей организации

### Система Разрешений
- Детальный контроль доступа на уровне ресурсов и действий
- Гибкое назначение ролей с различными разрешениями

### Аудит
- Все изменения записываются в `audit_log`
- Отслеживание пользователя, времени и типа операции

### Индексы
- Созданы индексы для оптимизации производительности
- Поддержка быстрого поиска по tenant_id и связанным таблицам

## Интеграция с Существующей Системой

### Связь с Проектами
Параметры объектов связаны с существующей таблицей `construction_projects` через `project_id`

### Пользователи
Используется существующая система авторизации с JWT токенами

### База Данных
Все данные хранятся в PostgreSQL на платформе AIVEN Cloud

## Пример Полного Сценария

1. **Регистрация пользователя:**
```bash
curl -X POST -H "Content-Type: application/json" \
-d '{"email":"test@smeta360.ru","password":"password123","firstname":"Тест","lastname":"Пользователь"}' \
http://localhost:3001/api/auth/register
```

2. **Создание проекта:**
```bash
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
-d '{"customerName":"ООО Тест","objectAddress":"г. Москва","contractorName":"ООО Подрядчик","contractNumber":"001","deadline":"2025-12-31"}' \
http://localhost:3001/api/projects
```

3. **Создание параметров объекта:**
```bash
curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
-d '{"buildingType":"жилое","constructionCategory":2,"floorsAboveGround":5}' \
http://localhost:3001/api/projects/ID/object-parameters
```

4. **Добавление помещений, конструктивных элементов и инженерных систем**

## Статус Реализации

✅ **Завершено:**
- Создание всех таблиц БД
- API для параметров объектов (CRUD)
- API для помещений (CRUD)
- API для конструктивных элементов (CRUD)
- API для инженерных систем (CRUD)
- Система ролей и разрешений
- Мультитенантность
- Аудит логирование
- Интеграция с AIVEN PostgreSQL
- Тестирование всех API

🔄 **Следующие шаги:**
- Интеграция с фронтендом для страницы "Параметры объекта"
- Реализация UI для управления ролями
- Добавление экспорта параметров объекта