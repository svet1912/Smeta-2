# API для смет заказчика (Customer Estimates API)

## Описание
API для управления сметами заказчика с поддержкой многопользовательской системы и ролевой модели доступа.

## Аутентификация
Все эндпоинты требуют аутентификации через JWT токен в заголовке Authorization.

## Роли и права доступа

### Роли пользователей:
- **super_admin** - Полный доступ ко всем сметам
- **admin** - Полный доступ ко всем сметам в рамках tenant
- **project_manager** - Полный доступ ко всем сметам проектов
- **estimator** - Создание и редактирование только своих смет
- **viewer** - Только просмотр своих смет

### Матрица доступа:
| Действие | super_admin | admin | project_manager | estimator | viewer |
|----------|-------------|-------|-----------------|-----------|--------|
| Просмотр всех смет | ✅ | ✅ | ✅ | ❌ | ❌ |
| Просмотр своих смет | ✅ | ✅ | ✅ | ✅ | ✅ |
| Создание сметы | ✅ | ✅ | ✅ | ✅ | ❌ |
| Редактирование любой сметы | ✅ | ✅ | ✅ | ❌ | ❌ |
| Редактирование своей сметы | ✅ | ✅ | ✅ | ✅ | ❌ |
| Удаление смет | ✅ | ✅ | ✅ | ❌ | ❌ |

## Структура данных

### Таблица customer_estimates
```sql
id: UUID (Primary Key)
project_id: UUID (Foreign Key -> construction_projects.id)
user_id: UUID (Foreign Key -> auth_users.id)
name: VARCHAR(255) NOT NULL
description: TEXT
coefficients: JSONB (коэффициенты для расчетов)
status: VARCHAR(50) DEFAULT 'draft' (draft, in_progress, completed, archived)
created_at: TIMESTAMP DEFAULT NOW()
updated_at: TIMESTAMP DEFAULT NOW()
```

### Таблица customer_estimate_items
```sql
id: UUID (Primary Key)
estimate_id: UUID (Foreign Key -> customer_estimates.id)
item_type: VARCHAR(50) NOT NULL (work, material, custom)
reference_id: UUID (ID из справочника работ/материалов)
custom_name: VARCHAR(255) (Пользовательское название)
unit: VARCHAR(20) NOT NULL (единица измерения)
quantity: DECIMAL(10,3) NOT NULL
unit_price: DECIMAL(10,2) NOT NULL
total_cost: DECIMAL(12,2) NOT NULL
position: INTEGER (позиция в смете для сортировки)
metadata: JSONB (дополнительные данные)
created_at: TIMESTAMP DEFAULT NOW()
updated_at: TIMESTAMP DEFAULT NOW()
```

## API Эндпоинты

### 1. Получить все сметы заказчика
```http
GET /api/customer-estimates
```

**Параметры:** Нет

**Возвращает:**
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "user_id": "uuid",
    "name": "Смета по ремонту квартиры",
    "description": "Полная смета на ремонт 2-комнатной квартиры",
    "coefficients": {
      "region": 1.2,
      "difficulty": 1.1,
      "urgency": 1.0
    },
    "status": "draft",
    "created_at": "2024-03-15T10:00:00Z",
    "updated_at": "2024-03-15T10:00:00Z",
    "project_name": "Ремонт квартиры на Невском",
    "creator_name": "ivanov_estimator",
    "items_count": 25,
    "total_estimate_cost": 450000.00
  }
]
```

### 2. Получить смету по ID
```http
GET /api/customer-estimates/:id
```

**Параметры:**
- `id` (path) - UUID сметы

**Возвращает:**
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "user_id": "uuid",
  "name": "Смета по ремонту квартиры",
  "description": "Полная смета на ремонт 2-комнатной квартиры",
  "coefficients": {
    "region": 1.2,
    "difficulty": 1.1,
    "urgency": 1.0
  },
  "status": "draft",
  "created_at": "2024-03-15T10:00:00Z",
  "updated_at": "2024-03-15T10:00:00Z",
  "project_name": "Ремонт квартиры на Невском",
  "creator_name": "ivanov_estimator"
}
```

### 3. Создать новую смету
```http
POST /api/customer-estimates
```

**Тело запроса:**
```json
{
  "project_id": "uuid",
  "name": "Новая смета",
  "description": "Описание сметы",
  "coefficients": {
    "region": 1.2,
    "difficulty": 1.1,
    "urgency": 1.0
  },
  "status": "draft"
}
```

**Возвращает:** Созданную смету (структура как в GET /:id)

### 4. Обновить смету
```http
PUT /api/customer-estimates/:id
```

**Параметры:**
- `id` (path) - UUID сметы

**Тело запроса:**
```json
{
  "name": "Обновленное название",
  "description": "Новое описание",
  "coefficients": {
    "region": 1.3,
    "difficulty": 1.2,
    "urgency": 1.1
  },
  "status": "in_progress"
}
```

**Возвращает:** Обновленную смету

### 5. Удалить смету
```http
DELETE /api/customer-estimates/:id
```

**Параметры:**
- `id` (path) - UUID сметы

**Возвращает:**
```json
{
  "message": "Смета успешно удалена"
}
```

### 6. Получить элементы сметы
```http
GET /api/customer-estimates/:estimateId/items
```

**Параметры:**
- `estimateId` (path) - UUID сметы

**Возвращает:**
```json
[
  {
    "id": "uuid",
    "estimate_id": "uuid",
    "item_type": "work",
    "reference_id": "uuid",
    "custom_name": "Штукатурка стен",
    "unit": "м²",
    "quantity": 45.5,
    "unit_price": 850.00,
    "total_cost": 38675.00,
    "position": 1,
    "metadata": {
      "work_complexity": "medium",
      "material_included": true
    },
    "created_at": "2024-03-15T10:30:00Z",
    "updated_at": "2024-03-15T10:30:00Z"
  }
]
```

### 7. Добавить элемент в смету
```http
POST /api/customer-estimates/:estimateId/items
```

**Параметры:**
- `estimateId` (path) - UUID сметы

**Тело запроса:**
```json
{
  "item_type": "work",
  "reference_id": "uuid",
  "custom_name": "Покраска потолка",
  "unit": "м²",
  "quantity": 35.0,
  "unit_price": 450.00,
  "total_cost": 15750.00,
  "position": 5,
  "metadata": {
    "paint_type": "water_based",
    "layers": 2
  }
}
```

**Возвращает:** Созданный элемент сметы

## Коды статусов смет

- `draft` - Черновик
- `in_progress` - В работе
- `completed` - Завершена
- `archived` - Архивная

## Типы элементов сметы

- `work` - Работа из справочника
- `material` - Материал из справочника
- `custom` - Пользовательский элемент

## Примеры использования

### Создание новой сметы с элементами:

1. **Создать смету:**
```bash
curl -X POST http://localhost:3001/api/customer-estimates \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "project-uuid",
    "name": "Смета на отделочные работы",
    "description": "Смета включает все отделочные работы",
    "coefficients": {"region": 1.2, "difficulty": 1.1},
    "status": "draft"
  }'
```

2. **Добавить элементы:**
```bash
curl -X POST http://localhost:3001/api/customer-estimates/ESTIMATE_ID/items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "item_type": "work",
    "reference_id": "work-uuid",
    "custom_name": "Штукатурка стен",
    "unit": "м²",
    "quantity": 45.5,
    "unit_price": 850.00,
    "total_cost": 38675.00,
    "position": 1
  }'
```

### Получение смет с фильтрацией по роли:

Для роли `estimator` - возвращаются только сметы, созданные этим пользователем.
Для ролей `admin`, `project_manager`, `super_admin` - возвращаются все сметы.

## Ошибки

### 400 Bad Request
```json
{
  "message": "Проект не найден"
}
```

### 403 Forbidden
```json
{
  "message": "Недостаточно прав для создания смет"
}
```

### 404 Not Found
```json
{
  "message": "Смета не найдена или нет прав доступа"
}
```

### 500 Internal Server Error
```json
{
  "message": "Ошибка сервера"
}
```

## Интеграция с фронтендом

Существующий компонент `customerEstimate.jsx` использует localStorage для хранения данных. Для интеграции с новым API нужно:

1. Заменить localStorage на API вызовы
2. Добавить обработку ошибок и загрузки
3. Реализовать сохранение коэффициентов в поле `coefficients`
4. Добавить управление статусами смет

### Пример интеграции:

```javascript
// Загрузка сметы
const loadEstimate = async (estimateId) => {
  try {
    const response = await apiClient.get(`/customer-estimates/${estimateId}`);
    setEstimateData(response.data);
    
    const itemsResponse = await apiClient.get(`/customer-estimates/${estimateId}/items`);
    setEstimateItems(itemsResponse.data);
  } catch (error) {
    console.error('Ошибка загрузки сметы:', error);
  }
};

// Сохранение элемента
const saveEstimateItem = async (item) => {
  try {
    if (item.id) {
      await apiClient.put(`/customer-estimates/${estimateId}/items/${item.id}`, item);
    } else {
      await apiClient.post(`/customer-estimates/${estimateId}/items`, item);
    }
    await loadEstimate(estimateId); // Перезагрузить данные
  } catch (error) {
    console.error('Ошибка сохранения элемента:', error);
  }
};
```

## База данных

Миграция создана в файле `/server/migrations/20250929_create_customer_estimates.sql` и автоматически применяется при запуске сервера.

Таблицы создаются с поддержкой:
- UUID primary keys
- Автоматическое обновление updated_at
- Каскадное удаление связанных записей
- Индексы для оптимизации запросов
- Валидация статусов и типов элементов