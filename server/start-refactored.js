/**
 * Refactored Server Startup
 * Запуск рефакторенного сервера с модульной архитектурой
 */
import app from './app-refactored.js';
import { config } from './config.js';

const PORT = config.port;

async function startRefactoredServer() {
  console.log('🚀 Запуск рефакторенного сервера...');

  // Запуск сервера
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Рефакторенный сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 API доступно по адресу: http://localhost:${PORT}/health`);
    console.log(`🌐 Внешний доступ через порт: ${PORT}`);
    console.log(`📈 Метрики: http://localhost:${PORT}/metrics`);
  });
}

// Запуск сервера
startRefactoredServer().catch(error => {
  console.error('❌ Критическая ошибка запуска сервера:', error);
  process.exit(1);
});

export { startRefactoredServer };
