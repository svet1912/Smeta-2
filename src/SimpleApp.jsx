import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Простое тестовое приложение с роутингом
function HomePage() {
  return (
    <div>
      <h2>🏠 Главная страница</h2>
      <p>React Router работает!</p>
      <div style={{ marginTop: '20px' }}>
        <Link to="/about" style={{ marginRight: '20px', color: '#0066cc' }}>О проекте</Link>
        <Link to="/test" style={{ color: '#0066cc' }}>Тест</Link>
      </div>
    </div>
  );
}

function AboutPage() {
  return (
    <div>
      <h2>📋 О проекте SMETA-2</h2>
      <p>Система управления сметами на React 18 + Node.js + PostgreSQL</p>
      <Link to="/" style={{ color: '#0066cc' }}>← Назад на главную</Link>
    </div>
  );
}

function TestPage() {
  return (
    <div>
      <h2>🧪 Тестовая страница</h2>
      <p>Проверка навигации и состояния</p>
      <button onClick={() => alert('Состояние сохраняется между страницами!')}>
        Тест состояния
      </button>
      <br/><br/>
      <Link to="/" style={{ color: '#0066cc' }}>← Назад на главную</Link>
    </div>
  );
}

function SimpleApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 SMETA-2 Test App</h1>
      <p>Если видите этот текст - React работает!</p>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f8ff', border: '1px solid #blue' }}>
        <h3>✅ Статус системы:</h3>
        <ul>
          <li>React: {React.version}</li>
          <li>Timestamp: {new Date().toLocaleString()}</li>
          <li>URL: {window.location.href}</li>
        </ul>
      </div>

      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={() => alert('React события работают!')}
          style={{ 
            padding: '10px 20px', 
            fontSize: '16px', 
            backgroundColor: '#4CAF50', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Тест клика
        </button>
      </div>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p>🔗 API тест: <a href="/api/health" target="_blank">/api/health</a></p>
        <p>📊 Теперь добавляем React Router постепенно...</p>
      </div>
    </div>
  );
}

// Приложение с роутингом
function AppWithRouter() {
  return (
    <BrowserRouter>
      <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
        <header style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px' }}>
          <h1>🚀 SMETA-2 - Теперь с роутингом!</h1>
          <nav>
            <Link to="/" style={{ marginRight: '20px', color: '#0066cc', textDecoration: 'none' }}>
              Главная
            </Link>
            <Link to="/about" style={{ marginRight: '20px', color: '#0066cc', textDecoration: 'none' }}>
              О проекте
            </Link>
            <Link to="/test" style={{ color: '#0066cc', textDecoration: 'none' }}>
              Тест
            </Link>
          </nav>
        </header>

        <main>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/test" element={<TestPage />} />
          </Routes>
        </main>

        <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid #eee', fontSize: '12px', color: '#999' }}>
          React {React.version} | API: Neon PostgreSQL | Deploy: Vercel
        </footer>
      </div>
    </BrowserRouter>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<AppWithRouter />);

export default SimpleApp;