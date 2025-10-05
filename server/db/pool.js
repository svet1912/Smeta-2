import { Pool } from 'pg';

// Настройка оптимизированного пула соединений для производительности
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // максимум одновременных соединений
  idleTimeoutMillis: 30000, // 30 секунд простаивающее соединение держим
  connectionTimeoutMillis: 2000, // если нет соединения за 2с → ошибка
  keepAlive: true, // поддерживаем соединения активными
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Логирование событий пула для мониторинга
pool.on('connect', (client) => {
  console.log('🔗 Новое соединение с БД установлено');
});

pool.on('error', (err, client) => {
  console.error('❌ Ошибка пула соединений:', err);
});

pool.on('acquire', (client) => {
  console.log('📥 Соединение получено из пула');
});

pool.on('release', (client) => {
  console.log('📤 Соединение возвращено в пул');
});

// Функция для безопасного выполнения запросов с автоматическим освобождением
export async function executeQuery(text, params = []) {
  const start = Date.now();
  const client = await pool.connect();

  try {
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    console.log('✅ Выполнен запрос через пул:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      duration: `${duration}ms`,
      rows: result.rowCount
    });

    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error('❌ Ошибка запроса через пул:', {
      text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
      duration: `${duration}ms`,
      error: error.message
    });
    throw error;
  } finally {
    client.release();
  }
}

// Функция для получения информации о состоянии пула
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

export default pool;
