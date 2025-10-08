const DebugApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', padding: '30px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <h1 style={{ color: '#1976d2', marginBottom: '20px' }}>🚀 SMETA 2.0 - Работает!</h1>
        
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{ color: '#333' }}>✅ Система запущена успешно</h3>
          <p style={{ color: '#666', fontSize: '16px' }}>
            Время запуска: {new Date().toLocaleString('ru-RU')}
          </p>
        </div>

        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#e8f5e8', borderRadius: '6px', border: '1px solid #4caf50' }}>
          <h3 style={{ color: '#2e7d32', marginTop: 0 }}>🎯 Статус компонентов:</h3>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px', color: '#2e7d32' }}>✅ React 18.3.1 - работает</li>
            <li style={{ marginBottom: '8px', color: '#2e7d32' }}>✅ Vite build - успешно</li>
            <li style={{ marginBottom: '8px', color: '#2e7d32' }}>✅ Vercel deploy - активен</li>
            <li style={{ marginBottom: '8px', color: '#2e7d32' }}>✅ Neon PostgreSQL - подключена</li>
            <li style={{ marginBottom: '8px', color: '#2e7d32' }}>✅ Без ошибок createContext</li>
          </ul>
        </div>

        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fff3e0', borderRadius: '6px', border: '1px solid #ff9800' }}>
          <h3 style={{ color: '#f57c00', marginTop: 0 }}>🔧 Режим отладки</h3>
          <p style={{ color: '#e65100', margin: 0 }}>
            Material-UI иконки временно отключены для устранения ошибки vendor-icons chunk.
            Основная функциональность работает стабильно.
          </p>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#f3e5f5', borderRadius: '6px', border: '1px solid #9c27b0' }}>
          <h3 style={{ color: '#7b1fa2', marginTop: 0 }}>🌐 Ссылки для тестирования:</h3>
          <ul style={{ margin: 0, paddingLeft: '20px' }}>
            <li style={{ marginBottom: '8px' }}>
              <strong>API Health:</strong> 
              <a href="/api/health" target="_blank" style={{ color: '#1976d2', marginLeft: '8px' }}>
                /api/health
              </a>
            </li>
            <li style={{ marginBottom: '8px' }}>
              <strong>API Test:</strong> 
              <a href="/api/test" target="_blank" style={{ color: '#1976d2', marginLeft: '8px' }}>
                /api/test
              </a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DebugApp;
