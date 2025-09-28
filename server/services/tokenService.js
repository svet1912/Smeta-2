/**
 * Система управления JWT токенами с ротацией refresh токенов
 * Шаг 9.2 — Ротация и отзыв refresh-токенов через user_sessions
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database.js';

// Настройки токенов
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_ISSUER = 'sn4-app';
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // Короткий access токен
const REFRESH_TOKEN_EXPIRES_IN = '7d'; // Длинный refresh токен

/**
 * Создает access токен с пользовательскими данными
 * @param {Object} user - Данные пользователя
 * @param {string} tenantId - ID текущего тенанта
 * @returns {string} JWT access токен
 */
export function createAccessToken(user, tenantId) {
  const payload = {
    sub: user.id, // subject = user ID
    email: user.email,
    role: user.role,
    tenant_id: tenantId,
    type: 'access'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    issuer: JWT_ISSUER,
    algorithm: 'HS256'
  });
}

/**
 * Создает refresh токен
 * @param {string} userId - ID пользователя
 * @returns {string} JWT refresh токен
 */
export function createRefreshToken(userId) {
  const payload = {
    sub: userId,
    type: 'refresh'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: JWT_ISSUER,
    algorithm: 'HS256'
  });
}

/**
 * Создает хэш токена для безопасного хранения в БД
 * @param {string} token - Исходный токен
 * @returns {string} SHA256 хэш токена
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Сохраняет refresh токен в базе данных
 * @param {string} userId - ID пользователя
 * @param {string} refreshToken - Refresh токен
 * @param {string} userAgent - User-Agent браузера
 * @param {string} ipAddress - IP адрес пользователя
 * @returns {string} ID созданной сессии
 */
export async function saveRefreshToken(userId, refreshToken, userAgent, ipAddress) {
  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
  
  try {
    const result = await query(`
      INSERT INTO user_sessions (
        user_id, 
        token_hash, 
        expires_at, 
        user_agent, 
        ip_address,
        is_revoked,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)
      RETURNING id;
    `, [userId, tokenHash, expiresAt, userAgent, ipAddress]);

    return result.rows[0].id;
  } catch (error) {
    console.error('❌ Ошибка сохранения refresh токена:', error.message);
    throw new Error('Ошибка сохранения сессии');
  }
}

/**
 * Проверяет refresh токен и возвращает данные сессии
 * @param {string} refreshToken - Refresh токен для проверки
 * @returns {Object|null} Данные сессии или null если токен недействителен
 */
export async function validateRefreshToken(refreshToken) {
  try {
    // 1. Проверяем JWT подпись и срок действия
    const payload = jwt.verify(refreshToken, JWT_SECRET, {
      issuer: JWT_ISSUER,
      algorithms: ['HS256']
    });

    if (payload.type !== 'refresh') {
      throw new Error('Неверный тип токена');
    }

    // 2. Проверяем токен в базе данных
    const tokenHash = hashToken(refreshToken);
    const result = await query(`
      SELECT us.id, us.user_id, us.is_revoked, us.expires_at, us.user_agent, us.ip_address,
             u.email, u.role
      FROM user_sessions us
      JOIN users u ON u.id = us.user_id
      WHERE us.token_hash = $1 AND us.user_id = $2;
    `, [tokenHash, payload.sub]);

    if (result.rows.length === 0) {
      throw new Error('Сессия не найдена');
    }

    const session = result.rows[0];

    // 3. Проверяем, что токен не отозван
    if (session.is_revoked) {
      throw new Error('Токен отозван');
    }

    // 4. Проверяем срок действия (дополнительная проверка)
    if (new Date() > new Date(session.expires_at)) {
      await revokeRefreshToken(refreshToken);
      throw new Error('Токен истёк');
    }

    return {
      sessionId: session.id,
      userId: session.user_id,
      email: session.email,
      role: session.role,
      userAgent: session.user_agent,
      ipAddress: session.ip_address
    };

  } catch (error) {
    console.error('❌ Ошибка валидации refresh токена:', error.message);
    return null;
  }
}

/**
 * Отзывает refresh токен (помечает как отозванный в БД)
 * @param {string} refreshToken - Токен для отзыва
 * @returns {boolean} true если токен был отозван
 */
export async function revokeRefreshToken(refreshToken) {
  try {
    const tokenHash = hashToken(refreshToken);
    
    const result = await query(`
      UPDATE user_sessions 
      SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1;
    `, [tokenHash]);

    return result.rowCount > 0;
  } catch (error) {
    console.error('❌ Ошибка отзыва refresh токена:', error.message);
    return false;
  }
}

/**
 * Отзывает все активные сессии пользователя (logout из всех устройств)
 * @param {string} userId - ID пользователя
 * @returns {number} Количество отозванных сессий
 */
export async function revokeAllUserSessions(userId) {
  try {
    const result = await query(`
      UPDATE user_sessions 
      SET is_revoked = true, revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND is_revoked = false;
    `, [userId]);

    return result.rowCount;
  } catch (error) {
    console.error('❌ Ошибка отзыва всех сессий пользователя:', error.message);
    return 0;
  }
}

/**
 * Ротация refresh токена - создает новый и отзывает старый
 * @param {string} oldRefreshToken - Старый refresh токен
 * @param {string} userAgent - User-Agent браузера
 * @param {string} ipAddress - IP адрес пользователя
 * @returns {Object|null} Новые токены или null при ошибке
 */
export async function rotateRefreshToken(oldRefreshToken, userAgent, ipAddress) {
  try {
    // 1. Валидируем старый токен
    const sessionData = await validateRefreshToken(oldRefreshToken);
    if (!sessionData) {
      throw new Error('Недействительный refresh токен');
    }

    // 2. Получаем данные пользователя и его текущий тенант
    const userResult = await query(`
      SELECT u.id, u.email, u.role, ut.tenant_id
      FROM users u
      JOIN user_tenants ut ON ut.user_id = u.id
      WHERE u.id = $1 AND ut.is_current = true
      LIMIT 1;
    `, [sessionData.userId]);

    if (userResult.rows.length === 0) {
      throw new Error('Пользователь не найден или не имеет активного тенанта');
    }

    const user = userResult.rows[0];

    // 3. Отзываем старый refresh токен
    await revokeRefreshToken(oldRefreshToken);

    // 4. Создаем новые токены
    const newAccessToken = createAccessToken(user, user.tenant_id);
    const newRefreshToken = createRefreshToken(user.id);

    // 5. Сохраняем новый refresh токен
    await saveRefreshToken(user.id, newRefreshToken, userAgent, ipAddress);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id
      }
    };

  } catch (error) {
    console.error('❌ Ошибка ротации refresh токена:', error.message);
    return null;
  }
}

/**
 * Очищает истекшие и отозванные токены (для периодического запуска)
 * @returns {number} Количество удаленных записей
 */
export async function cleanupExpiredSessions() {
  try {
    const result = await query(`
      DELETE FROM user_sessions
      WHERE expires_at < CURRENT_TIMESTAMP 
         OR (is_revoked = true AND revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days');
    `);

    console.log(`🧹 Очищено истекших сессий: ${result.rowCount}`);
    return result.rowCount;
  } catch (error) {
    console.error('❌ Ошибка очистки истекших сессий:', error.message);
    return 0;
  }
}

/**
 * Получает список активных сессий пользователя
 * @param {string} userId - ID пользователя
 * @returns {Array} Список активных сессий
 */
export async function getUserActiveSessions(userId) {
  try {
    const result = await query(`
      SELECT id, user_agent, ip_address, created_at, expires_at
      FROM user_sessions
      WHERE user_id = $1 
        AND is_revoked = false 
        AND expires_at > CURRENT_TIMESTAMP
      ORDER BY created_at DESC;
    `, [userId]);

    return result.rows;
  } catch (error) {
    console.error('❌ Ошибка получения активных сессий:', error.message);
    return [];
  }
}

// Экспорт всех функций
export default {
  createAccessToken,
  createRefreshToken,
  saveRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserSessions,
  rotateRefreshToken,
  cleanupExpiredSessions,
  getUserActiveSessions
};
