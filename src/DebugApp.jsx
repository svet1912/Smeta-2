import React from 'react';

const DebugApp = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🔍 Debug Mode - SMETA360</h1>
      <p>Если вы видите этот текст, React работает корректно.</p>
      <p>Время: {new Date().toLocaleString()}</p>
      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f0f0' }}>
        <h3>Статус системы:</h3>
        <ul>
          <li>✅ React компилируется</li>
          <li>✅ JavaScript выполняется</li>
          <li>✅ Страница рендерится</li>
        </ul>
      </div>
    </div>
  );
};

export default DebugApp;