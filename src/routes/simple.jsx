import { createBrowserRouter } from 'react-router-dom';

// Простые компоненты для тестирования
const SimpleLanding = () => (
  <div style={{ padding: '20px' }}>
    <h1>🏠 Лендинг страница работает!</h1>
    <p>Если вы видите этот текст, маршрутизация работает корректно.</p>
    <a href="/login" style={{ color: 'blue', textDecoration: 'underline' }}>
      Перейти к авторизации
    </a>
  </div>
);

const SimpleLogin = () => (
  <div style={{ padding: '20px' }}>
    <h1>🔐 Страница авторизации</h1>
    <p>Тестовая страница входа</p>
    <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
      Вернуться на главную
    </a>
  </div>
);

const SimpleApp = () => (
  <div style={{ padding: '20px' }}>
    <h1>📱 Приложение</h1>
    <p>Тестовая страница приложения</p>
    <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
      Вернуться на главную
    </a>
  </div>
);

// ==============================|| SIMPLE ROUTING FOR DEBUG ||============================== //

const simpleRouter = createBrowserRouter([
  {
    path: '/',
    element: <SimpleLanding />
  },
  {
    path: '/login',
    element: <SimpleLogin />
  },
  {
    path: '/app/*',
    element: <SimpleApp />
  },
  {
    path: '*',
    element: (
      <div style={{ padding: '20px' }}>
        <h1>❌ 404 - Страница не найдена</h1>
        <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>
          Вернуться на главную
        </a>
      </div>
    )
  }
]);

export default simpleRouter;
