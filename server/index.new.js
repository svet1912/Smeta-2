import app from './app.js';
import { config } from './config.js';

const PORT = config.port;

// Инициализация таблиц
if (app.initializeTables) {
  await app.initializeTables();
}

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://0.0.0.0:${PORT}`);
  console.log(`📊 Метрики доступны на http://0.0.0.0:${PORT}/metrics`);
  console.log(`🔍 Health check: http://0.0.0.0:${PORT}/api/health`);
  console.log(`💽 DB Health: http://0.0.0.0:${PORT}/api/health/db`);
});