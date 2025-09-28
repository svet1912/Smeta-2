/**
 * JWT Middleware для автоматической установки контекста тенанта в БД
 * Шаг 9.1 — Middleware для app.user_id и app.tenant_id из JWT токена
 */
import jwt from 'jsonwebtoken';
import { query } from '../database.js';

// Настройки JWT
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_ISSUER = 'sn4-app';

/**
 * Извлекает JWT токен из заголовков запроса
 * @param {Request} req - Express запрос
 * @returns {string|null} JWT токен или null
 */
function extractJwtToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  // Поддерживаем как 'Bearer TOKEN' так и просто 'TOKEN'
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return authHeader;
}

/**
 * Проверяет и декодирует JWT токен
 * @param {string} token - JWT токен
 * @returns {Object} Декодированный payload
 * @throws {Error} Если токен недействителен
 */
function verifyJwtToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      algorithms: ['HS256']
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('JWT токен истёк');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Недействительный JWT токен');
    }
    throw new Error(`Ошибка проверки JWT: ${error.message}`);
  }
}

/**
 * Middleware для установки контекста тенанта из JWT токена
 * Автоматически устанавливает app.user_id и app.tenant_id в БД для каждого запроса
 */
export function tenantContextMiddleware(req, res, next) {
  // Пропускаем авторизацию для публичных маршрутов
  const publicRoutes = [
    '/auth/login',
    '/auth/register', 
    '/auth/refresh',
    '/health',
    '/api-docs'
  ];
  
  // Проверяем, является ли маршрут публичным
  const isPublicRoute = publicRoutes.some(route => req.path === route || req.path.startsWith(route));
  if (isPublicRoute) {
    return next();
  }

  try {
    // 1. Извлекаем JWT токен из заголовков
    const token = extractJwtToken(req);
    if (!token) {
      return res.status(401).json({ 
        error: 'Не предоставлен токен авторизации',
        code: 'NO_AUTH_TOKEN'
      });
    }

    // 2. Проверяем и декодируем токен
    let payload;
    try {
      payload = verifyJwtToken(token);
    } catch (error) {
      return res.status(401).json({
        error: error.message,
        code: 'INVALID_TOKEN'
      });
    }

    // 3. Извлекаем данные пользователя из payload
    const userId = payload.sub; // subject = user ID
    const tenantId = payload.tenant_id;
    const role = payload.role || 'user';
    const email = payload.email;

    if (!userId) {
      return res.status(401).json({
        error: 'Токен не содержит ID пользователя',
        code: 'INVALID_USER_ID'
      });
    }

    if (!tenantId) {
      return res.status(401).json({
        error: 'Токен не содержит ID тенанта',
        code: 'INVALID_TENANT_ID'
      });
    }

    // 4. Сохраняем данные пользователя в объекте запроса
    req.user = {
      id: userId,
      tenantId: tenantId,
      role: role,
      email: email
    };

    // 5. Устанавливаем контекст в БД для текущего соединения
    // Используем SET LOCAL для изоляции в рамках текущей транзакции
    setDatabaseContext(userId, tenantId)
      .then(() => {
        // Добавляем информацию о контексте в логи
        console.log(`🔐 JWT Context: user=${userId.substring(0,8)}, tenant=${tenantId.substring(0,8)}, role=${role}, path=${req.path}`);
        next();
      })
      .catch(error => {
        console.error('❌ Ошибка установки контекста БД:', error.message);
        res.status(500).json({
          error: 'Ошибка установки контекста базы данных',
          code: 'DATABASE_CONTEXT_ERROR'
        });
      });

  } catch (error) {
    console.error('❌ Ошибка в tenantContextMiddleware:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Устанавливает контекст пользователя и тенанта в БД
 * @param {string} userId - ID пользователя
 * @param {string} tenantId - ID тенанта
 */
async function setDatabaseContext(userId, tenantId) {
  try {
    // Используем SET (без LOCAL) для установки переменных сессии
    // Это установит переменные для текущего соединения
    await query(`SET app.user_id = $1`, [userId]);
    await query(`SET app.tenant_id = $2`, [tenantId]);
    
  } catch (error) {
    console.error('❌ Ошибка установки контекста БД:', error.message);
    throw error;
  }
}

/**
 * Вспомогательная функция для получения текущего пользователя из запроса
 * @param {Request} req - Express запрос
 * @returns {Object|null} Данные пользователя или null
 */
export function getCurrentUser(req) {
  return req.user || null;
}

/**
 * Middleware для проверки роли пользователя
 * @param {string|string[]} allowedRoles - Разрешенные роли
 * @returns {Function} Express middleware функция
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (!user) {
      return res.status(401).json({
        error: 'Требуется авторизация',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({
        error: `Доступ запрещен. Требуется роль: ${roles.join(' или ')}`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}

/**
 * Middleware для проверки владения ресурсом тенантом
 * Дополнительная защита сверх RLS политик
 */
export function requireTenantAccess(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Требуется авторизация',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  // Проверяем наличие tenant_id в параметрах запроса
  const requestTenantId = req.params.tenantId || req.body.tenantId;
  if (requestTenantId && requestTenantId !== user.tenantId) {
    return res.status(403).json({
      error: 'Доступ к ресурсам другого тенанта запрещен',
      code: 'TENANT_ACCESS_DENIED'
    });
  }

  next();
}

// Экспорт всех утилит
export default {
  tenantContextMiddleware,
  getCurrentUser,
  requireRole,
  requireTenantAccess,
  extractJwtToken,
  verifyJwtToken
};
