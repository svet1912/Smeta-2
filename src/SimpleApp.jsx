import React from 'react';
import { createRoot } from 'react-dom/client';

// Простое тестовое приложение для проверки базовой функциональности
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
        <p>📊 Если это работает, мы можем добавлять компоненты постепенно</p>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(<SimpleApp />);

export default SimpleApp;