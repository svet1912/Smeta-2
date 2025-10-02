# Quick Vercel Setup Guide

## 🚀 Подключение к Vercel

1. Зайдите на [vercel.com](https://vercel.com) и войдите через GitHub
2. Нажмите **"New Project"**
3. Выберите репозиторий **`IYK026/Smeta360-2`**
4. Настройки будут подхвачены автоматически из `vercel.json`

## ⚙️ Переменные окружения

В разделе **Environment Variables** добавьте:

### Production
```
VITE_SITE_URL=https://smeta360-2.vercel.app
VITE_APP_BASE_URL=https://smeta360-2.vercel.app/app
VITE_API_BASE_URL=https://smeta360-2.vercel.app/api
```

### Preview
```
VITE_SITE_URL=https://VERCEL_URL  
VITE_APP_BASE_URL=https://VERCEL_URL/app
VITE_API_BASE_URL=https://VERCEL_URL/api
VITE_VERCEL_ENV=preview
```

## 📋 После деплоя проверьте:

- [ ] Лендинг работает: `https://project.vercel.app/`
- [ ] SPA работает: `https://project.vercel.app/app`  
- [ ] 404 корректна: `https://project.vercel.app/random-page`
- [ ] robots.txt правильный: `https://project.vercel.app/robots.txt`

## 🔗 Получение превью-ссылок

Pull Request автоматически создает превью с комментарием от Vercel bot.

**Готово к деплою!** 🎉