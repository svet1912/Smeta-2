# 🧪 API SCRIPTS - Тестовые скрипты API

Скрипты для тестирования API эндпоинтов проекта.

## 📁 Содержимое

### 🔬 API тесты (JavaScript)
- `test_estimates_api.js` - Тестирование API смет заказчика
- `test_projects_api.js` - Тестирование API проектов
- `test_rls_security.js` - Тестирование RLS безопасности

### 🐚 Shell скрипты
- `test_customer_estimates_api.sh` - Bash тесты API смет
- `test_object_parameters_api.sh` - Bash тесты параметров объектов
- `test-routes.sh` - Тестирование всех маршрутов

## 🚀 Использование

### JavaScript тесты:
```bash
# Тест API смет
node tests/api-scripts/test_estimates_api.js

# Тест API проектов  
node tests/api-scripts/test_projects_api.js

# Тест безопасности RLS
node tests/api-scripts/test_rls_security.js
```

### Shell тесты:
```bash
# Дать права на выполнение
chmod +x tests/api-scripts/*.sh

# Запуск тестов
./tests/api-scripts/test-routes.sh
./tests/api-scripts/test_customer_estimates_api.sh
./tests/api-scripts/test_object_parameters_api.sh
```

## ⚠️ Требования

- **Node.js** для JavaScript тестов
- **Bash/PowerShell** для shell скриптов  
- **Запущенный backend сервер** на порту 3001
- **Валидный auth токен** (для защищенных эндпоинтов)

## 🎯 Цели тестов

- **Функциональность API** - проверка корректности ответов
- **Безопасность RLS** - изоляция данных тенантов
- **Производительность** - время ответа эндпоинтов
- **Интеграция** - совместная работа компонентов