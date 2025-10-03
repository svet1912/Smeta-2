/**
 * Унифицированный middleware для аутентификации и авторизации
 * Заменяет дублирующуюся логику из tenantContextMiddleware и simpleAuth
 */
import jwt from 'jsonwebtoken';
import { query } from '../database.js';
import { config } from '../config.js';

// Настройки JWT
const JWT_SECRET = config.jwtSecret;
const JWT_ISSUER = 'smeta360-app';

/**
 * Извлекает JWT токен из заголовков запроса
 */
function extractJwtToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  
  return authHeader;
}

/**
 * Проверяет и декодирует JWT токен
 */
function verifyJwtToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
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
 * Устанавливает контекст пользователя и тенанта в БД
 */
async function setDatabaseContext(userId, tenantId) {
  try {
    // PostgreSQL не поддерживает параметризованные запросы для SET
    // Используем прямое значение, но с проверкой на SQL injection
    const safeUserId = parseInt(userId);
    const safeTenantId = tenantId.replace(/[^a-f0-9-]/gi, '');
    
    await query(`SET app.user_id = ${safeUserId}`);
    await query(`SET app.tenant_id = '${safeTenantId}'`);
  } catch (error) {
    console.error('❌ Ошибка установки контекста БД:', error.message);
    // Не выбрасываем ошибку, чтобы не блокировать работу приложения
    // console.error('❌ Ошибка установки контекста БД:', error);
  }
}

/**
 * Публичные маршруты, которые не требуют аутентификации
 */
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/health/db',
  '/api/test',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/lead',
  '/api/leads/stats',
  '/metrics'
];

/**
 * Проверяет, является ли маршрут публичным
 */
function isPublicRoute(path) {
  return PUBLIC_ROUTES.some(route => 
    path === route || 
    path.startsWith(route) ||
    path.startsWith('/api/materials') ||
    path.startsWith('/api/works') ||
    path.startsWith('/api/phases')
  );
}

/**
 * Основной middleware аутентификации
 */
export async function authMiddleware(req, res, next) {
  try {
    // Пропускаем публичные маршруты
    if (isPublicRoute(req.path)) {
      return next();
    }

    // Извлекаем токен
    const token = extractJwtToken(req);
    if (!token) {
      return res.status(401).json({ 
        error: 'Не предоставлен токен авторизации',
        code: 'NO_AUTH_TOKEN'
      });
    }

    // Проверяем токен
    let payload;
    try {
      payload = verifyJwtToken(token);
    } catch (error) {
      return res.status(401).json({
        error: error.message,
        code: 'INVALID_TOKEN'
      });
    }

    // Извлекаем данные пользователя
    const userId = payload.id || payload.sub;
    const tenantId = payload.tenantId || payload.tenant_id;
    const role = payload.role || 'user';
    const email = payload.email;

    if (!userId || !tenantId) {
      return res.status(401).json({
        error: 'Токен не содержит необходимые данные пользователя',
        code: 'INVALID_TOKEN_PAYLOAD'
      });
    }

    // Сохраняем данные пользователя в запросе
    req.user = {
      id: userId,
      tenantId: tenantId,
      role: role,
      email: email
    };
    

    // Устанавливаем контекст в БД
    try {
      await setDatabaseContext(userId, tenantId);
    } catch (error) {
      console.error('❌ Ошибка установки контекста БД:', error);
      // Продолжаем выполнение без установки контекста
    }

    console.log(`🔐 Auth: user=${userId}, tenant=${tenantId.substring(0,8)}, role=${role}, path=${req.path}`);
    next();

  } catch (error) {
    console.error('❌ Ошибка в authMiddleware:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Middleware для проверки роли пользователя
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    const user = req.user;
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
 */
export function requireTenantAccess(req, res, next) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({
      error: 'Требуется авторизация',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  const requestTenantId = req.params.tenantId || req.body.tenantId;
  if (requestTenantId && requestTenantId !== user.tenantId) {
    return res.status(403).json({
      error: 'Доступ к ресурсам другого тенанта запрещен',
      code: 'TENANT_ACCESS_DENIED'
    });
  }

  next();
}

/**
 * Вспомогательная функция для получения текущего пользователя
 */
export function getCurrentUser(req) {
  return req.user || null;
}

export default {
  authMiddleware,
  requireRole,
  requireTenantAccess,
  getCurrentUser
};
