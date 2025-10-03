/**
 * Новый файл запуска сервера с исправленной архитектурой
 */
import app from './app-new.js';
import { config } from './config.js';
import { query } from './database.js';

const PORT = config.port;

async function startServer() {
  try {
    // Проверяем подключение к базе данных
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Подключение к базе данных проверено:', result.rows[0].current_time);
    
    // Инициализируем таблицы
    if (app.initializeTables) {
      await app.initializeTables();
    }
  } catch (error) {
    console.log('⚠️  Будем работать без базы данных (статические данные)');
    console.log('❌ Ошибка подключения:', error.message);
  }

  // Запуск сервера
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api/test`);
    console.log(`🌐 Внешний доступ через порт: ${PORT}`);
    console.log(`📈 Метрики: http://localhost:${PORT}/metrics`);
    console.log(`🔧 Кэш статистика: http://localhost:${PORT}/api/cache/stats`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM, завершаем работу...');
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 Получен SIGINT, завершаем работу...');
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  });
}

// Запускаем сервер только если этот файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  });
}

export { startServer };
