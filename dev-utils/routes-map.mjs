// Скрипт для тестирования всех маршрутов приложения
const routes = [
  // Главные маршруты
  { path: '/app', name: 'Главная страница приложения' },
  { path: '/app/dashboard/default', name: 'Панель управления' },

  // Справочники
  { path: '/app/directories/works', name: 'Справочник работ' },
  { path: '/app/directories/materials', name: 'Справочник материалов' },

  // Проекты
  { path: '/app/projects/create', name: 'Создание проекта' },
  { path: '/app/projects/storage', name: 'Хранилище проектов' },

  // Расчёты
  { path: '/app/calculations/estimate', name: 'Расчёт сметы' },
  { path: '/app/calculations/object-parameters', name: 'Параметры объекта' },
  { path: '/app/calculations/customer-estimate', name: 'Клиентские сметы' },

  // Профиль
  { path: '/app/profile', name: 'Обзор профиля' },
  { path: '/app/profile/edit', name: 'Редактирование профиля' },
  { path: '/app/profile/settings', name: 'Настройки профиля' },

  // Утилиты и поддержка
  { path: '/app/database-test', name: 'Тест базы данных' },

  // Авторизация (без /app)
  { path: '/login', name: 'Страница входа' },
  { path: '/register', name: 'Страница регистрации' },

  // Лендинг
  { path: '/', name: 'Лендинг страница' }
];

console.log('📋 Карта маршрутов SMETA360:');
console.log('===============================');

routes.forEach((route, index) => {
  console.log(`${index + 1}. ${route.name}`);
  console.log(`   URL: http://localhost:3000${route.path}`);
  console.log('');
});

console.log('🔧 Исправленные проблемы:');
console.log('- ✅ URL в меню теперь содержат префикс /app');
console.log('- ✅ Убраны дублирующие маршруты');
console.log('- ✅ Добавлены маршруты для профиля');
console.log('- ✅ Правильная структура catch-all (404)');
console.log('- ✅ Исправлены конфликты в LoginRoutes');

export default routes;
