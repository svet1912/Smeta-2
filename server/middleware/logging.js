/**
 * Logging Middleware Configuration
 * Настройка логирования запросов и ошибок
 */
import pino from 'pino-http';

// Конфигурация логирования для разработки
export const devLoggingMiddleware = pino({
  level: 'info',
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent';
    }
    return 'info';
  }
});

// Конфигурация логирования для продакшена
export const prodLoggingMiddleware = pino({
  level: 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn';
    } else if (res.statusCode >= 500 || err) {
      return 'error';
    }
    return 'info';
  }
});

// Выбираем подходящий middleware в зависимости от окружения
export const loggingMiddleware = process.env.NODE_ENV === 'production' 
  ? prodLoggingMiddleware 
  : devLoggingMiddleware;

export default loggingMiddleware;
