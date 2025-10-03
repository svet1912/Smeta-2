/**
 * Token Service
 * Сервис для работы с JWT токенами
 */
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query } from '../database.js';
import { config } from '../config.js';

class TokenService {
  constructor() {
    this.accessTokenSecret = config.jwtSecret;
    this.refreshTokenSecret = config.jwtRefreshSecret;
    this.accessTokenExpiry = '15m';
    this.refreshTokenExpiry = '7d';
  }

  /**
   * Создание access токена
   */
  createAccessToken(user, tenantId) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role || 'estimator',
      tenantId: tenantId,
      type: 'access'
    };

    return jwt.sign(payload, this.accessTokenSecret, {
      expiresIn: this.accessTokenExpiry
    });
  }

  /**
   * Создание refresh токена
   */
  createRefreshToken(userId) {
    const payload = {
      userId: userId,
      type: 'refresh'
    };

    return jwt.sign(payload, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenExpiry
    });
  }

  /**
   * Сохранение refresh токена в базе данных
   */
  async saveRefreshToken(userId, refreshToken, userAgent, ipAddress) {
    try {
      // Создаем хеш токена для безопасности
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      // Вычисляем время истечения
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней

      await query(`
        INSERT INTO user_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
        VALUES ($1, $2, $3, $4, $5);
      `, [userId, tokenHash, expiresAt, userAgent, ipAddress]);

      console.log(`🔑 Refresh токен сохранен для пользователя: ${userId}`);
    } catch (error) {
      console.error('❌ Ошибка сохранения refresh токена:', error);
      throw error;
    }
  }

  /**
   * Ротация refresh токена
   */
  async rotateRefreshToken(refreshToken, userAgent, ipAddress) {
    try {
      // Проверяем токен
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret);
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const userId = decoded.userId;

      // Проверяем, что токен существует в базе и не истек
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const sessionResult = await query(`
        SELECT us.*, u.email, u.firstname, u.lastname
        FROM user_sessions us
        JOIN auth_users u ON u.id = us.user_id
        WHERE us.user_id = $1 AND us.token_hash = $2 AND us.expires_at > NOW();
      `, [userId, tokenHash]);

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }

      const session = sessionResult.rows[0];
      const user = sessionResult.rows[0];

      // Удаляем старый токен
      await query(`
        DELETE FROM user_sessions 
        WHERE user_id = $1 AND token_hash = $2;
      `, [userId, tokenHash]);

      // Получаем текущий тенант пользователя
      const tenantResult = await query(`
        SELECT ut.tenant_id, t.name as tenant_name
        FROM user_tenants ut
        JOIN tenants t ON t.id = ut.tenant_id
        WHERE ut.user_id = $1 AND ut.is_current = true
        LIMIT 1;
      `, [userId]);

      if (tenantResult.rows.length === 0) {
        throw new Error('No active tenant found');
      }

      const tenantInfo = tenantResult.rows[0];

      // Создаем новые токены
      const newAccessToken = this.createAccessToken(user, tenantInfo.tenant_id);
      const newRefreshToken = this.createRefreshToken(userId);

      // Сохраняем новый refresh токен
      await this.saveRefreshToken(userId, newRefreshToken, userAgent, ipAddress);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: 'estimator', // Временная роль
          tenantId: tenantInfo.tenant_id,
          tenantName: tenantInfo.tenant_name
        }
      };

    } catch (error) {
      console.error('❌ Ошибка ротации refresh токена:', error);
      return null;
    }
  }

  /**
   * Отзыв refresh токена
   */
  async revokeRefreshToken(refreshToken) {
    try {
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      
      await query(`
        DELETE FROM user_sessions 
        WHERE token_hash = $1;
      `, [tokenHash]);

      console.log('🔑 Refresh токен отозван');
    } catch (error) {
      console.error('❌ Ошибка отзыва refresh токена:', error);
      throw error;
    }
  }

  /**
   * Очистка истекших токенов
   */
  async cleanupExpiredTokens() {
    try {
      const result = await query(`
        DELETE FROM user_sessions 
        WHERE expires_at < NOW();
      `);

      if (result.rowCount > 0) {
        console.log(`🧹 Очищено ${result.rowCount} истекших токенов`);
      }
    } catch (error) {
      console.error('❌ Ошибка очистки истекших токенов:', error);
    }
  }
}

export default new TokenService();