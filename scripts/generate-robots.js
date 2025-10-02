const fs = require('fs');
const path = require('path');

// Генерация robots.txt в зависимости от окружения
const generateRobots = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const isPreview = process.env.VERCEL_ENV === 'preview';
  
  let robotsContent;
  
  if (isProduction && !isPreview) {
    // Продакшен - разрешаем индексацию
    robotsContent = `User-agent: *
Allow: /

# Главные страницы
Allow: /
Allow: /app

# Исключить служебные файлы
Disallow: /content/
Disallow: /assets/
Disallow: *.json

# Sitemap
Sitemap: ${process.env.VITE_SITE_URL || 'https://smeta360-2.vercel.app'}/sitemap.xml`;
  } else {
    // Preview или разработка - запрещаем индексацию
    robotsContent = `User-agent: *
Disallow: /

# Preview окружение - индексация запрещена
# Это временный деплой для тестирования`;
  }
  
  // Записываем файл в public
  const robotsPath = path.join(process.cwd(), 'public', 'robots.txt');
  fs.writeFileSync(robotsPath, robotsContent);
  
  console.log(`robots.txt generated for ${isProduction ? 'production' : 'preview'} environment`);
};

generateRobots();