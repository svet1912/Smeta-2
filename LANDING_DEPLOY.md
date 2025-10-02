# Документация по деплою лендинга на Vercel

## 🚀 Настройка Vercel

### Подключение к GitHub
1. Перейдите на [vercel.com](https://vercel.com)
2. Войдите через GitHub аккаунт
3. Нажмите "New Project" → Import Git Repository
4. Выберите репозиторий `IYK026/Smeta360-2`
5. Настройки импорта:
   ```
   Framework Preset: Vite
   Root Directory: ./
   Build Command: npm run build:vercel
   Output Directory: dist
   Install Command: npm install --legacy-peer-deps
   ```

### Переменные окружения в Vercel

#### Production Environment
```bash
VITE_SITE_URL=https://smeta360-2.vercel.app
VITE_APP_BASE_URL=https://smeta360-2.vercel.app/app  
VITE_API_BASE_URL=https://smeta360-2.vercel.app/api
NODE_ENV=production
```

#### Preview Environment
```bash
VITE_SITE_URL=https://VERCEL_URL
VITE_APP_BASE_URL=https://VERCEL_URL/app
VITE_API_BASE_URL=https://VERCEL_URL/api
NODE_ENV=preview
VITE_VERCEL_ENV=preview
```

## 📦 Как работают деплои

### Автоматические деплои
- **Master branch** → Production деплой (https://smeta360-2.vercel.app)
- **Pull Request** → Preview деплой (https://smeta360-2-git-[branch].vercel.app)
- **Feature branch** → Preview деплой при push

### Структура URL
```
Production:
https://smeta360-2.vercel.app/          # Лендинг
https://smeta360-2.vercel.app/app       # SPA приложение
https://smeta360-2.vercel.app/api       # API (пока заглушка)

Preview:
https://smeta360-2-git-feature.vercel.app/     # Лендинг
https://smeta360-2-git-feature.vercel.app/app  # SPA приложение
```

## 🤖 Автоматическая генерация robots.txt

### Продакшен (разрешена индексация)
```
User-agent: *
Allow: /
Sitemap: https://smeta360-2.vercel.app/sitemap.xml
```

### Preview (запрещена индексация)
```
User-agent: *
Disallow: /
# Preview окружение - индексация запрещена
```

### Скрипт генерации
- **Файл:** `scripts/generate-robots.js`
- **Запуск:** автоматически при `npm run build:vercel`
- **Логика:** проверяет `NODE_ENV` и `VERCEL_ENV`

## 🔧 Файлы конфигурации

### vercel.json
```json
{
  "framework": "vite",
  "buildCommand": "npm run build:vercel",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/app/(.*)", "destination": "/index.html" },
    { "source": "/((?!api|content|sitemap\\.xml|robots\\.txt).*)", "destination": "/index.html" }
  ]
}
```

### Команды сборки в package.json
```json
{
  "scripts": {
    "build": "npm run generate:robots && vite build",
    "build:vercel": "npm run generate:robots && vite build", 
    "generate:robots": "node scripts/generate-robots.js"
  }
}
```

## 📋 Проверка после деплоя

### Чеклист для каждого деплоя
- [ ] Лендинг открывается по корневому URL `/`
- [ ] SPA работает по адресу `/app/*`
- [ ] 404 страница корректно отображается
- [ ] Все секции лендинга загружаются (Hero, Features, etc.)
- [ ] Навигация с якорями работает
- [ ] robots.txt соответствует окружению
- [ ] Canonical URL указывает правильно
- [ ] Environment banner показывается на preview

### Команды для локальной проверки
```bash
# Генерация robots.txt
npm run generate:robots

# Локальная сборка (как на Vercel)
npm run build:vercel

# Превью сборки
npm run preview
```

## 🐛 Диагностика проблем

### Частые ошибки
1. **404 на /app routes** → проверить rewrites в vercel.json
2. **Неправильный robots.txt** → проверить переменные окружения
3. **Не загружается контент** → проверить пути к JSON файлам
4. **SPA не работает** → проверить fallback на index.html

### Логи сборки
- В Vercel Dashboard → Project → Deployments → View Function Logs
- Поиск ошибок в Build Logs секции

### Переменные окружения в runtime
```javascript
// В компонентах можно проверить:
console.log('Site URL:', import.meta.env.VITE_SITE_URL);
console.log('Environment:', import.meta.env.NODE_ENV);
console.log('Vercel ENV:', import.meta.env.VITE_VERCEL_ENV);
```

## 🔄 Обновление контента

### Изменение текстов лендинга
1. Редактировать `/public/content/landing/landing.json`
2. Commit + Push в master или создать PR
3. Vercel автоматически пересоберет и задеплоит

### Изменение компонентов
1. Редактировать файлы в `/src/pages/Landing/`
2. Тестировать локально: `npm run dev`
3. Commit + Push → автодеплой

## 📞 Получение ссылки на превью

### Через GitHub PR
1. Создать Pull Request
2. В комментариях к PR появится ссылка от Vercel bot
3. Формат: `https://smeta360-2-git-[branch-name].vercel.app`

### Через Vercel Dashboard
1. Войти в vercel.com
2. Project: smeta360-2
3. Deployments tab → выбрать нужный деплой
4. Скопировать URL из "Visit" кнопки