// Задачи по расписанию для enhanced authentication
import { cleanupExpiredTokens } from './authService.js';

/**
 * Запускает периодическую очистку истекших токенов
 */
function startTokenCleanupScheduler() {
  // Очистка каждые 6 часов
  const CLEANUP_INTERVAL = 6 * 60 * 60 * 1000; // 6 часов в миллисекундах

  console.log('🕒 Запуск планировщика очистки токенов (каждые 6 часов)');

  // Первая очистка через 1 минуту после запуска
  setTimeout(async () => {
    try {
      await cleanupExpiredTokens();
    } catch (error) {
      console.error('❌ Ошибка первой очистки токенов:', error);
    }
  }, 60 * 1000);

  // Регулярная очистка каждые 6 часов
  setInterval(async () => {
    try {
      console.log('🧹 Запуск планового кужанжа очистки токенов...');
      await cleanupExpiredTokens();
    } catch (error) {
      console.error('❌ Ошибка плановой очистки токенов:', error);
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Получает статистику по токенам (для мониторинга)
 */
async function getTokenStats() {
  const { query } = await import('../database.js');
  
  try {
    const result = await query('SELECT * FROM get_refresh_token_stats()');
    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка получения статистики токенов:', error);
    return null;
  }
}

/**
 * Выводит статистику токенов в логи
 */
async function logTokenStats() {
  const stats = await getTokenStats();
  
  if (stats) {
    console.log('📊 Статистика refresh tokens:', {
      total: stats.total_tokens,
      active: stats.active_tokens,
      expired: stats.expired_tokens,
      revoked: stats.revoked_tokens,
      uniqueUsers: stats.unique_users,
      avgLifetime: stats.avg_token_lifetime
    });
  }
}

export {
  startTokenCleanupScheduler,
  getTokenStats,
  logTokenStats
};