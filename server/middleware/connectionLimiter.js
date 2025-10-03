/**
 * Middleware для ограничения одновременных соединений
 * Централизованное управление соединениями
 */
import { activeConnections as activeConnectionsGauge } from '../metrics.js';

// Ограничение одновременных соединений
const activeConnections = new Set();
const MAX_CONNECTIONS = 50; // Увеличиваем лимит для production

/**
 * Middleware для ограничения соединений
 */
export function connectionLimiterMiddleware(req, res, next) {
  // Пропускаем health checks и metrics
  if (req.path === '/api/health' || req.path === '/api/health/db' || req.path === '/metrics') {
    return next();
  }

  if (activeConnections.size >= MAX_CONNECTIONS) {
    console.log(`⚠️ Отклоняем запрос - превышен лимит (${activeConnections.size}/${MAX_CONNECTIONS})`);
    return res.status(503).json({ 
      error: 'Сервер перегружен, попробуйте позже',
      code: 'SERVER_OVERLOADED'
    });
  }
  
  const connectionId = Math.random().toString(36).substr(2, 9);
  activeConnections.add(connectionId);
  
  req.connectionId = connectionId;
  console.log(`📨 ${req.method} ${req.path} [${connectionId}] (${activeConnections.size}/${MAX_CONNECTIONS})`);
  
  // Обновляем метрику активных соединений
  activeConnectionsGauge.set(activeConnections.size);
  
  // Очистка при завершении запроса
  const cleanup = () => {
    activeConnections.delete(connectionId);
    activeConnectionsGauge.set(activeConnections.size);
  };
  
  res.on('finish', cleanup);
  res.on('close', cleanup);
  
  next();
}

/**
 * Получить статистику соединений
 */
export function getConnectionStats() {
  return {
    active: activeConnections.size,
    max: MAX_CONNECTIONS,
    utilization: (activeConnections.size / MAX_CONNECTIONS * 100).toFixed(1) + '%'
  };
}

// Named export для совместимости
export { connectionLimiterMiddleware as connectionLimiter };

export default {
  connectionLimiterMiddleware,
  getConnectionStats
};
