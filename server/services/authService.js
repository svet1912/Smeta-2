// Enhanced Authentication Service с refresh tokens
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database.js';
import { config } from '../config.js';

// Настройки токенов
const ACCESS_TOKEN_EXPIRY = '15m';     // Access token живет 15 минут
const REFRESH_TOKEN_EXPIRY = '30d';    // Refresh token живет 30 дней
const REFRESH_TOKEN_LENGTH = 64;       // Длина refresh token

/**
 * Генерирует криптографически безопасный refresh token
 */
function generateRefreshToken() {
  return crypto.randomBytes(REFRESH_TOKEN_LENGTH).toString('hex');
}

/**
 * Создает access token с коротким временем жизни
 */
function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256'
  });
}

/**
 * Создает refresh token запись в базе данных
 */
async function createRefreshToken(userId, deviceInfo = {}) {
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 дней

  const { userAgent = '', ipAddress = '', deviceId = null } = deviceInfo;

  try {
    await query(`
      INSERT INTO refresh_tokens (
        user_id, 
        token_hash, 
        expires_at, 
        user_agent, 
        ip_address, 
        device_id,
        created_at,
        last_used_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
    `, [
      userId,
      crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt,
      userAgent,
      ipAddress,
      deviceId
    ]);

    console.log(`🔄 Создан refresh token для пользователя ${userId}`);
    return refreshToken;
  } catch (error) {
    console.error('❌ Ошибка создания refresh token:', error);
    throw new Error('Не удалось создать refresh token');
  }
}

/**
 * Проверяет валидность refresh token
 */
async function validateRefreshToken(refreshToken) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  try {
    const result = await query(`
      SELECT rt.*, au.id as user_id, au.email, au.firstname, au.lastname, 
             au.is_active, ut.tenant_id
      FROM refresh_tokens rt
      JOIN auth_users au ON rt.user_id = au.id
      LEFT JOIN user_tenants ut ON au.id = ut.user_id
      WHERE rt.token_hash = $1 
        AND rt.expires_at > NOW() 
        AND rt.is_revoked = false
        AND au.is_active = true
    `, [tokenHash]);

    if (result.rows.length === 0) {
      return null;
    }

    // Обновляем время последнего использования
    await query(`
      UPDATE refresh_tokens 
      SET last_used_at = NOW(), use_count = use_count + 1
      WHERE token_hash = $1
    `, [tokenHash]);

    return result.rows[0];
  } catch (error) {
    console.error('❌ Ошибка проверки refresh token:', error);
    return null;
  }
}

/**
 * Отзывает (делает недействительным) refresh token
 */
async function revokeRefreshToken(refreshToken) {
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  try {
    await query(`
      UPDATE refresh_tokens 
      SET is_revoked = true, revoked_at = NOW()
      WHERE token_hash = $1
    `, [tokenHash]);

    console.log(`♻️ Refresh token отозван`);
  } catch (error) {
    console.error('❌ Ошибка отзыва refresh token:', error);
    throw new Error('Не удалось отозвать refresh token');
  }
}

/**
 * Отзывает все refresh tokens пользователя
 */
async function revokeAllUserTokens(userId) {
  try {
    await query(`
      UPDATE refresh_tokens 
      SET is_revoked = true, revoked_at = NOW()
      WHERE user_id = $1 AND is_revoked = false
    `, [userId]);

    console.log(`🔄 Все refresh tokens пользователя ${userId} отозваны`);
  } catch (error) {
    console.error('❌ Ошибка отзыва всех токенов:', error);
    throw new Error('Не удалось отозвать токены');
  }
}

/**
 * Создает полную пару токенов (access + refresh)
 */
async function createTokenPair(user, deviceInfo = {}) {
  // Payload для access token
  const accessPayload = {
    userId: user.id,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    role: user.role || 'estimator',
    tenantId: user.tenant_id,
    tokenType: 'access'
  };

  const accessToken = generateAccessToken(accessPayload);
  const refreshToken = await createRefreshToken(user.id, deviceInfo);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiry: ACCESS_TOKEN_EXPIRY,
    refreshTokenExpiry: REFRESH_TOKEN_EXPIRY
  };
}

/**
 * Обновляет access token по refresh token
 */
async function refreshAccessToken(refreshToken) {
  const tokenData = await validateRefreshToken(refreshToken);
  
  if (!tokenData) {
    throw new Error('Недействительный или истекший refresh token');
  }

  // Получаем актуальную роль пользователя
  let userRole = 'estimator';
  try {
    const roleResult = await query(`
      SELECT ur.name as role_name
      FROM user_role_assignments ura
      JOIN user_roles ur ON ur.id = ura.role_id
      WHERE ura.user_id = $1 AND ura.is_active = true
      ORDER BY ura.assigned_at DESC
      LIMIT 1
    `, [tokenData.user_id]);

    if (roleResult.rows.length > 0) {
      userRole = roleResult.rows[0].role_name;
    }
  } catch (error) {
    console.log('⚠️ Не удалось получить роль при refresh, используем estimator');
  }

  // Создаем новый access token
  const accessPayload = {
    userId: tokenData.user_id,
    email: tokenData.email,
    firstname: tokenData.firstname,
    lastname: tokenData.lastname,
    role: userRole,
    tenantId: tokenData.tenant_id,
    tokenType: 'access'
  };

  const newAccessToken = generateAccessToken(accessPayload);

  console.log(`🔄 Access token обновлен для пользователя ${tokenData.user_id}`);

  return {
    accessToken: newAccessToken,
    accessTokenExpiry: ACCESS_TOKEN_EXPIRY,
    user: {
      id: tokenData.user_id,
      email: tokenData.email,
      firstname: tokenData.firstname,
      lastname: tokenData.lastname,
      role: userRole,
      tenantId: tokenData.tenant_id
    }
  };
}

/**
 * Очищает истекшие refresh tokens из базы данных
 */
async function cleanupExpiredTokens() {
  try {
    const result = await query(`
      DELETE FROM refresh_tokens 
      WHERE expires_at < NOW() OR is_revoked = true
    `);

    const deletedCount = result.rowCount || 0;
    if (deletedCount > 0) {
      console.log(`🧹 Очищено ${deletedCount} истекших refresh tokens`);
    }
  } catch (error) {
    console.error('❌ Ошибка очистки токенов:', error);
  }
}

/**
 * Получает информацию о сессиях пользователя
 */
async function getUserSessions(userId) {
  try {
    const result = await query(`
      SELECT 
        id,
        user_agent,
        ip_address,
        device_id,
        created_at,
        last_used_at,
        use_count,
        expires_at,
        is_revoked
      FROM refresh_tokens 
      WHERE user_id = $1 AND is_revoked = false
      ORDER BY last_used_at DESC
    `, [userId]);

    return result.rows.map(session => ({
      id: session.id,
      userAgent: session.user_agent,
      ipAddress: session.ip_address,
      deviceId: session.device_id,
      createdAt: session.created_at,
      lastUsedAt: session.last_used_at,
      useCount: session.use_count,
      expiresAt: session.expires_at,
      isActive: !session.is_revoked
    }));
  } catch (error) {
    console.error('❌ Ошибка получения сессий:', error);
    return [];
  }
}

/**
 * Отзывает конкретную сессию по ID
 */
async function revokeSession(userId, sessionId) {
  try {
    await query(`
      UPDATE refresh_tokens 
      SET is_revoked = true, revoked_at = NOW()
      WHERE id = $1 AND user_id = $2
    `, [sessionId, userId]);

    console.log(`🔄 Сессия ${sessionId} пользователя ${userId} отозвана`);
  } catch (error) {
    console.error('❌ Ошибка отзыва сессии:', error);
    throw new Error('Не удалось отозвать сессию');
  }
}

export {
  generateRefreshToken,
  generateAccessToken,
  createRefreshToken,
  validateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  createTokenPair,
  refreshAccessToken,
  cleanupExpiredTokens,
  getUserSessions,
  revokeSession
};