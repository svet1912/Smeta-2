# 🛠️ DEV-UTILS - Утилиты разработки

Вспомогательные файлы и утилиты для разработки проекта.

## 📁 Содержимое

### 🚀 Скрипты запуска
- `start-all.ps1` - PowerShell скрипт запуска всех сервисов
- `start-simple.ps1` - Простой PowerShell запуск
- `start-backend.bat` - Batch файл запуска backend
- `stop-all.ps1` - Остановка всех процессов

### 🗺️ Навигация и маршруты
- `routes-map.mjs` - Карта маршрутов приложения

### 🔒 Сертификаты
- `ca.pem` - SSL сертификат для подключения к БД

### 📊 Производительность
- `performance-alternatives.json` - Альтернативы производительности
- `lighthouse-spa-results.json` - Результаты Lighthouse анализа

## 🎯 Использование

### Запуск проекта (Windows):
```powershell
# Запуск всех сервисов
.\dev-utils\start-all.ps1

# Остановка
.\dev-utils\stop-all.ps1
```

### Анализ маршрутов:
```bash
node dev-utils/routes-map.mjs
```

## ℹ️ Примечания
- Скрипты PowerShell требуют соответствующих прав выполнения
- SSL сертификат используется для Aiven Cloud PostgreSQL
- Файлы производительности содержат конфигурации оптимизации