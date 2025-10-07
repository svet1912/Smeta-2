import app from './index.js';

async function startServer() {
  console.log('🔧 Инициализация сервера...');

  // Сначала инициализируем таблицы
  try {
    console.log('📊 Инициализация базы данных...');
    if (app.initializeTables) {
      await app.initializeTables();
      console.log('✅ База данных инициализирована');
    }
  } catch (error) {
    console.log('⚠️ Ошибка инициализации БД, но продолжаем:', error.message);
  }

  // Проверяем подключение к БД
  try {
    const { query } = await import('./database.js');
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Подключение к базе данных проверено:', result.rows[0].current_time);
    
    // Запускаем планировщик очистки токенов
    try {
      const { startTokenCleanupScheduler, logTokenStats } = await import('./services/tokenScheduler.js');
      startTokenCleanupScheduler();
      
      // Показываем текущую статистику токенов
      setTimeout(async () => {
        await logTokenStats();
      }, 2000);
      
      console.log('✅ Планировщик очистки токенов запущен');
    } catch (schedulerError) {
      console.log('⚠️ Ошибка запуска планировщика токенов:', schedulerError.message);
    }

    // Инициализируем Smart Cache и Cache Warming
    try {
      const { initCacheWarming } = await import('./cache/cacheWarming.js');
      
      // Инициализируем warming стратегии
      const warmingService = initCacheWarming();
      console.log('🔥 Cache Warming инициализирован');
      
      // Запускаем warming критических данных
      setTimeout(async () => {
        try {
          await warmingService.warmCriticalData();
          console.log('✅ Критические данные предзагружены в кэш');
        } catch (warmError) {
          console.log('⚠️ Ошибка warming критических данных:', warmError.message);
        }
      }, 3000);

      // Настраиваем регулярное warming популярных данных (каждые 15 минут)
      setInterval(
        async () => {
          try {
            await warmingService.warmPopularData();
            console.log('♨️ Популярные данные обновлены в кэше');
          } catch (warmError) {
            console.log('⚠️ Ошибка warming популярных данных:', warmError.message);
          }
        },
        15 * 60 * 1000
      ); // 15 минут

      console.log('✅ Smart Cache система активирована');
    } catch (cacheError) {
      console.log('⚠️ Ошибка инициализации Smart Cache:', cacheError.message);
    }
  } catch (error) {
    console.log('⚠️  Будем работать без базы данных (статические данные)');
    console.log('❌ Ошибка подключения:', error.message);
  }

  // Запуск сервера
  const { config } = await import('./config.js');
  const PORT = config.port;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 API доступно по адресу: http://localhost:${PORT}/api/test`);
    console.log(`🌐 Внешний доступ через порт: ${PORT}`);
  });

  // Обработка ошибок сервера
  server.on('error', (error) => {
    console.error('❌ Ошибка сервера:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('🛑 Получен сигнал SIGINT, завершаем сервер...');
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('🛑 Получен сигнал SIGTERM, завершаем сервер...');
    server.close(() => {
      console.log('✅ Сервер остановлен');
      process.exit(0);
    });
  });

  console.log('🎯 Сервер готов к работе!');
}

// Запускаем сервер только если этот файл выполняется напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { startServer };
