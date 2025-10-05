import app from './index.js';
import { config } from './config.js';

const PORT = config.port;

console.log('🚀 Запуск тестового сервера...');

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
  console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api/test`);
});
