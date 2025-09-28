# 🔌 SMETA360 API Документация

> Полное руководство по REST API проекта SMETA360

---

## 📋 Содержание

1. [Введение](#введение)
2. [Аутентификация](#аутентификация)
3. [Endpoints Reference](#endpoints-reference)
4. [Модели данных](#модели-данных)
5. [Ошибки и коды](#ошибки-и-коды)
6. [Примеры использования](#примеры-использования)

---

## 🚀 Введение

### Base URL

```
Development: http://localhost:3001/api
Production:  https://api.smeta360.com/api
```

### Content-Type

Все запросы должны содержать заголовок:

```http
Content-Type: application/json
```

### Стандартный формат ответов

#### Успешный ответ

```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Example"
  },
  "message": "Operation completed successfully"
}
```

#### Ошибка

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "Field specific error message"
  }
}
```

---

## 🔐 Аутентификация

### Регистрация пользователя

**POST** `/auth/register`

```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "firstname": "Иван",
  "lastname": "Петров"
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstname": "Иван",
      "lastname": "Петров"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

### Авторизация пользователя

**POST** `/auth/login`

```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "firstname": "Иван",
      "lastname": "Петров"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

### Обновление токена

**POST** `/auth/refresh`

**Headers:**
```http
Authorization: Bearer <refresh_token>
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Выход из системы

**POST** `/auth/logout`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

## 📊 Endpoints Reference

### Проекты

#### Получить все проекты пользователя

**GET** `/projects`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `limit` (optional): Количество проектов (default: 50)
- `offset` (optional): Смещение для пагинации (default: 0)
- `search` (optional): Поиск по названию

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Жилой комплекс Москва-Сити",
      "description": "Строительство 5-этажного жилого комплекса",
      "status": "active",
      "total_cost": 15000000.50,
      "created_at": "2025-09-15T10:30:00Z",
      "updated_at": "2025-09-28T14:20:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

#### Создать новый проект

**POST** `/projects`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "name": "Новый проект",
  "description": "Описание проекта",
  "status": "draft"
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": 26,
    "name": "Новый проект",
    "description": "Описание проекта",
    "status": "draft",
    "total_cost": 0.00,
    "created_at": "2025-09-28T15:00:00Z",
    "updated_at": "2025-09-28T15:00:00Z"
  },
  "message": "Project created successfully"
}
```

#### Получить проект по ID

**GET** `/projects/{id}`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Жилой комплекс Москва-Сити",
    "description": "Строительство 5-этажного жилого комплекса",
    "status": "active",
    "total_cost": 15000000.50,
    "created_at": "2025-09-15T10:30:00Z",
    "updated_at": "2025-09-28T14:20:00Z",
    "estimates": [
      {
        "id": 1,
        "name": "Основная смета",
        "total": 12000000.00,
        "status": "approved"
      }
    ]
  }
}
```

#### Обновить проект

**PUT** `/projects/{id}`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "name": "Обновленное название",
  "description": "Новое описание",
  "status": "completed"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Обновленное название",
    "description": "Новое описание", 
    "status": "completed",
    "updated_at": "2025-09-28T15:30:00Z"
  },
  "message": "Project updated successfully"
}
```

#### Удалить проект

**DELETE** `/projects/{id}`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 204:**

```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### Сметы (Estimates)

#### Получить все сметы проекта

**GET** `/projects/{project_id}/estimates`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Основная смета",
      "project_id": 1,
      "total": 12000000.00,
      "status": "approved",
      "created_at": "2025-09-16T09:00:00Z",
      "items_count": 45
    }
  ]
}
```

#### Создать смету

**POST** `/projects/{project_id}/estimates`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "name": "Смета на фундамент",
  "description": "Смета на устройство фундамента",
  "items": [
    {
      "work_id": 1,
      "material_id": 5,
      "quantity": 100.0,
      "unit_price": 1500.00
    }
  ]
}
```

**Response 201:**

```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "Смета на фундамент",
    "project_id": 1,
    "total": 150000.00,
    "status": "draft",
    "created_at": "2025-09-28T16:00:00Z",
    "items_count": 1
  },
  "message": "Estimate created successfully"
}
```

### Материалы

#### Получить каталог материалов

**GET** `/materials`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `search` (optional): Поиск по названию
- `category` (optional): Фильтр по категории
- `limit` (optional): Количество записей (default: 50)
- `offset` (optional): Смещение (default: 0)

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Цемент ПЦ 500 Д0",
      "category": "Вяжущие материалы",
      "unit": "т",
      "price": 8500.00,
      "code": "101-0001",
      "description": "Портландцемент марки 500 без добавок"
    }
  ],
  "pagination": {
    "total": 1247,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Получить материал по ID

**GET** `/materials/{id}`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Цемент ПЦ 500 Д0",
    "category": "Вяжущие материалы", 
    "unit": "т",
    "price": 8500.00,
    "code": "101-0001",
    "description": "Портландцемент марки 500 без добавок",
    "created_at": "2025-08-01T12:00:00Z",
    "updated_at": "2025-09-15T10:00:00Z"
  }
}
```

### Справочник работ

#### Получить справочник работ

**GET** `/works`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `search` (optional): Поиск по названию
- `section` (optional): Фильтр по разделу
- `limit` (optional): Количество записей (default: 50)
- `offset` (optional): Смещение (default: 0)

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Устройство бетонной подготовки",
      "code": "05-01-001-01",
      "section": "Земляные работы",
      "unit": "м3",
      "labor_cost": 2.5,
      "material_cost": 1800.00,
      "machine_cost": 450.00,
      "description": "Устройство бетонной подготовки толщиной 100мм"
    }
  ],
  "pagination": {
    "total": 2156,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Получить работу по ID

**GET** `/works/{id}`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Устройство бетонной подготовки",
    "code": "05-01-001-01",
    "section": "Земляные работы",
    "unit": "м3", 
    "labor_cost": 2.5,
    "material_cost": 1800.00,
    "machine_cost": 450.00,
    "description": "Устройство бетонной подготовки толщиной 100мм",
    "materials": [
      {
        "id": 1,
        "name": "Цемент ПЦ 500 Д0",
        "quantity": 0.35,
        "unit": "т"
      }
    ]
  }
}
```

### Пользователи

#### Получить профиль пользователя

**GET** `/users/profile`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstname": "Иван",
    "lastname": "Петров",
    "role": "estimator",
    "company": "ООО Стройтрест",
    "phone": "+7 (999) 123-45-67",
    "created_at": "2025-09-01T10:00:00Z",
    "last_login": "2025-09-28T14:30:00Z"
  }
}
```

#### Обновить профиль

**PUT** `/users/profile`

**Headers:**
```http
Authorization: Bearer <access_token>
```

**Body:**

```json
{
  "firstname": "Иван",
  "lastname": "Петров",
  "company": "ООО Новая стройка",
  "phone": "+7 (999) 123-45-67"
}
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "email": "user@example.com",
    "firstname": "Иван",
    "lastname": "Петров",
    "company": "ООО Новая стройка",
    "phone": "+7 (999) 123-45-67",
    "updated_at": "2025-09-28T17:00:00Z"
  },
  "message": "Profile updated successfully"
}
```

---

## 📋 Модели данных

### User

```json
{
  "id": "integer",
  "email": "string (unique)",
  "firstname": "string",
  "lastname": "string", 
  "role": "string (enum: admin, estimator, viewer)",
  "company": "string (optional)",
  "phone": "string (optional)",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "last_login": "timestamp (optional)"
}
```

### Project

```json
{
  "id": "integer",
  "name": "string",
  "description": "text (optional)",
  "status": "string (enum: draft, active, completed, archived)",
  "total_cost": "decimal",
  "user_id": "integer (foreign key)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Estimate

```json
{
  "id": "integer",
  "name": "string",
  "description": "text (optional)",
  "project_id": "integer (foreign key)",
  "total": "decimal",
  "status": "string (enum: draft, approved, rejected)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Material

```json
{
  "id": "integer",
  "name": "string",
  "category": "string",
  "unit": "string",
  "price": "decimal",
  "code": "string (unique)",
  "description": "text (optional)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Work

```json
{
  "id": "integer",
  "name": "string",
  "code": "string (unique)", 
  "section": "string",
  "unit": "string",
  "labor_cost": "decimal",
  "material_cost": "decimal", 
  "machine_cost": "decimal",
  "description": "text (optional)",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### EstimateItem

```json
{
  "id": "integer",
  "estimate_id": "integer (foreign key)",
  "work_id": "integer (foreign key, optional)",
  "material_id": "integer (foreign key, optional)",
  "quantity": "decimal",
  "unit_price": "decimal",
  "total_price": "decimal",
  "description": "string (optional)",
  "created_at": "timestamp"
}
```

---

## ❌ Ошибки и коды

### HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200  | OK | Успешный запрос |
| 201  | Created | Ресурс создан |
| 204  | No Content | Ресурс удален |
| 400  | Bad Request | Ошибка валидации |
| 401  | Unauthorized | Не авторизован |
| 403  | Forbidden | Нет прав доступа |
| 404  | Not Found | Ресурс не найден |
| 409  | Conflict | Конфликт данных |
| 422  | Unprocessable Entity | Ошибка бизнес-логики |
| 429  | Too Many Requests | Превышен лимит запросов |
| 500  | Internal Server Error | Серверная ошибка |

### Error Codes

#### Authentication Errors

```json
{
  "success": false,
  "error": "Invalid credentials",
  "code": "AUTH_INVALID_CREDENTIALS"
}
```

```json
{
  "success": false,
  "error": "Token expired",
  "code": "AUTH_TOKEN_EXPIRED"
}
```

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "AUTH_INSUFFICIENT_PERMISSIONS"
}
```

#### Validation Errors

```json
{
  "success": false,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "email": "Valid email is required",
    "password": "Password must be at least 8 characters"
  }
}
```

#### Business Logic Errors

```json
{
  "success": false,
  "error": "Project not found",
  "code": "PROJECT_NOT_FOUND"
}
```

```json
{
  "success": false,
  "error": "Cannot delete project with active estimates",
  "code": "PROJECT_HAS_DEPENDENCIES"
}
```

#### Rate Limiting

```json
{
  "success": false,
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

---

## 💡 Примеры использования

### JavaScript (Fetch API)

```javascript
// Authentication
const login = async (email, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });
  
  const data = await response.json();
  
  if (data.success) {
    localStorage.setItem('token', data.data.token);
    return data.data.user;
  } else {
    throw new Error(data.error);
  }
};

// Authenticated request
const getProjects = async () => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/projects', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  const data = await response.json();
  return data.data;
};

// Create project
const createProject = async (projectData) => {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(projectData)
  });
  
  const data = await response.json();
  return data.data;
};
```

### Python (requests)

```python
import requests
import json

class SMETA360API:
    def __init__(self, base_url="http://localhost:3001/api"):
        self.base_url = base_url
        self.token = None
    
    def login(self, email, password):
        response = requests.post(f"{self.base_url}/auth/login", json={
            "email": email,
            "password": password
        })
        
        data = response.json()
        if data["success"]:
            self.token = data["data"]["token"]
            return data["data"]["user"]
        else:
            raise Exception(data["error"])
    
    def get_headers(self):
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def get_projects(self):
        response = requests.get(
            f"{self.base_url}/projects",
            headers=self.get_headers()
        )
        return response.json()["data"]
    
    def create_project(self, name, description=""):
        response = requests.post(
            f"{self.base_url}/projects",
            headers=self.get_headers(),
            json={
                "name": name,
                "description": description,
                "status": "draft"
            }
        )
        return response.json()["data"]

# Usage
api = SMETA360API()
user = api.login("user@example.com", "password")
projects = api.get_projects()
new_project = api.create_project("Новый проект", "Описание проекта")
```

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Get projects (with token)
curl -X GET http://localhost:3001/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"

# Create project
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name":"Новый проект","description":"Описание проекта","status":"draft"}'

# Search materials
curl -X GET "http://localhost:3001/api/materials?search=цемент&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

---

## 🔍 Поиск и фильтрация

### Полнотекстовый поиск

Материалы и работы поддерживают полнотекстовый поиск на русском языке:

```http
GET /api/materials?search=цемент портландцемент
GET /api/works?search=устройство фундамент бетон
```

### Фильтры

```http
# Материалы по категории
GET /api/materials?category=Вяжущие материалы

# Работы по разделу  
GET /api/works?section=Земляные работы

# Проекты по статусу
GET /api/projects?status=active

# Комбинированные фильтры
GET /api/materials?category=Металлы&search=арматура&limit=20
```

### Пагинация

```http
# Первая страница (записи 1-50)
GET /api/materials?limit=50&offset=0

# Вторая страница (записи 51-100)
GET /api/materials?limit=50&offset=50

# Проверить есть ли еще записи
# Если hasMore: true в ответе - есть еще данные
```

---

## 🚀 WebSocket Events

### Подключение

```javascript
const socket = io('http://localhost:3001', {
  auth: {
    token: localStorage.getItem('token')
  }
});
```

### События

#### Обновление проекта

```javascript
// Подписка на обновления проекта
socket.emit('join_project', { projectId: 123 });

// Получение обновлений
socket.on('project_updated', (data) => {
  console.log('Project updated:', data);
});
```

#### Обновление сметы

```javascript
// Подписка на обновления сметы
socket.emit('join_estimate', { estimateId: 456 });

// Получение обновлений
socket.on('estimate_updated', (data) => {
  console.log('Estimate updated:', data);
});
```

---

*Документация API обновлена: 28 сентября 2025*  
*Версия: 1.0*