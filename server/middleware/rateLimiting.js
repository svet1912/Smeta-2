/**
 * Rate Limiting Middleware Configuration
 * Настройка ограничения частоты запросов
 */
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

// Общие настройки rate limiting
const createRateLimit = (options) => {
  return rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMaxRequests,
    message: {
      error: 'Слишком много запросов с этого IP, попробуйте позже',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // Возвращать информацию о лимитах в заголовках
    legacyHeaders: false, // Отключить X-RateLimit-* заголовки
    // Убираем keyGenerator для избежания IPv6 ошибок
    handler: (req, res, next, options) => {
      console.warn(`⚠️ Превышен лимит запросов для IP: ${req.ip}`);
      res.status(options.statusCode).send(options.message);
    },
    ...options
  });
};

// Общий rate limiter для всех API endpoints
export const generalRateLimit = createRateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    error: 'Превышен общий лимит запросов',
    code: 'GENERAL_RATE_LIMIT_EXCEEDED'
  }
});

// Строгий rate limiter для аутентификации
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: config.authRateLimitMax, // Настраиваемое количество попыток
  message: {
    error: 'Слишком много попыток входа, попробуйте позже',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  skipSuccessfulRequests: true // Не считать успешные запросы
});

// Rate limiter для создания лидов
export const leadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 час
  max: config.leadRateLimitMax, // Настраиваемое количество заявок
  message: {
    error: 'Превышен лимит заявок, попробуйте позже',
    code: 'LEAD_RATE_LIMIT_EXCEEDED'
  }
});

// Rate limiter для API endpoints с изменением данных
export const mutationRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов изменения данных за 15 минут
  message: {
    error: 'Превышен лимит запросов на изменение данных',
    code: 'MUTATION_RATE_LIMIT_EXCEEDED'
  }
});

// Rate limiter для поиска и каталогов
export const searchRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 500, // 500 запросов поиска за 15 минут
  message: {
    error: 'Превышен лимит запросов поиска',
    code: 'SEARCH_RATE_LIMIT_EXCEEDED'
  }
});

export default generalRateLimit;
