import app from './index.js';
import { config } from './config.js';
import { query } from './database.js';

const PORT = config.port;

async function startServer() {
  // Простая проверка подключения без создания таблиц
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Подключение к базе данных проверено:', result.rows[0].current_time);

    // Инициализируем таблицы только после успешного подключения
    setTimeout(() => {
      if (app.initializeTables) {
        app.initializeTables().catch((err) => console.log('⚠️ Пропускаем инициализацию БД'));
      }
    }, 1000);
  } catch (error) {
    console.log('⚠️  Будем работать без базы данных (статические данные)');
    console.log('❌ Ошибка подключения:', error.message);
  }

  // Запуск сервера
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api/test`);
    console.log(`🌐 Внешний доступ через порт: ${PORT}`);
  });
}

// Запускаем сервер только если этот файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { startServer };
