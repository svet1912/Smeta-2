/**
 * API контроллеры для управления аутентификацией и тенантами
 * Шаг 9.3 — Переключение тенантов и обновление токенов
 */
import bcrypt from 'bcrypt';
import { query } from '../database.js';
import tokenService from '../services/tokenService.js';

/**
 * Логин пользователя
 * POST /auth/login
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        error: 'Требуются email и пароль',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // 1. Находим пользователя по email
    const userResult = await query(`
      SELECT id, email, password_hash, firstname, lastname, is_active
      FROM auth_users
      WHERE email = $1;
    `, [email.toLowerCase()]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        code: 'INVALID_CREDENTIALS'
      });
    }

    const user = userResult.rows[0];

    // 2. Проверяем активность пользователя
    if (!user.is_active) {
      return res.status(401).json({
        error: 'Аккаунт заблокирован',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // 3. Проверяем пароль
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({
        error: 'Неверный email или пароль',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // 4. Получаем текущий тенант пользователя
    const tenantResult = await query(`
      SELECT ut.tenant_id, t.name as tenant_name
      FROM user_tenants ut
      JOIN tenants t ON t.id = ut.tenant_id
      WHERE ut.user_id = $1 AND ut.is_current = true
      LIMIT 1;
    `, [user.id]);

    if (tenantResult.rows.length === 0) {
      return res.status(401).json({
        error: 'У пользователя нет активного тенанта',
        code: 'NO_ACTIVE_TENANT'
      });
    }

    const tenantInfo = tenantResult.rows[0];

    // 5. Создаем токены (используем роль по умолчанию)
    const userWithRole = { ...user, role: 'estimator' }; // Временная роль
    const accessToken = tokenService.createAccessToken(userWithRole, tenantInfo.tenant_id);
    const refreshToken = tokenService.createRefreshToken(user.id);

    // 6. Сохраняем refresh токен
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    
    await tokenService.saveRefreshToken(user.id, refreshToken, userAgent, ipAddress);

    // 7. Обновляем время последнего входа
    await query(`
      UPDATE auth_users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = $1;
    `, [user.id]);

    console.log(`🔐 Логин пользователя: ${email}, tenant: ${tenantInfo.tenant_name}`);

    res.json({
      success: true,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: 'estimator', // Временная роль
        tenantId: tenantInfo.tenant_id,
        tenantName: tenantInfo.tenant_name
      }
    });

  } catch (error) {
    console.error('❌ Ошибка при логине:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Обновление access токена через refresh токен
 * POST /auth/refresh
 */
export async function refreshToken(req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh токен обязателен',
        code: 'MISSING_REFRESH_TOKEN'
      });
    }

    // Ротируем токен
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    
    const tokens = await tokenService.rotateRefreshToken(refreshToken, userAgent, ipAddress);
    
    if (!tokens) {
      return res.status(401).json({
        error: 'Недействительный refresh токен',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }

    console.log(`🔄 Refresh токен: user=${tokens.user.id.substring(0,8)}`);

    res.json({
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user
    });

  } catch (error) {
    console.error('❌ Ошибка при обновлении токена:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Логаут пользователя
 * POST /auth/logout
 */
export async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      await tokenService.revokeRefreshToken(refreshToken);
    }

    console.log('🔐 Логаут пользователя');

    res.json({
      success: true,
      message: 'Успешный выход'
    });

  } catch (error) {
    console.error('❌ Ошибка при логауте:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Получение списка доступных тенантов пользователя
 * GET /auth/tenants
 */
export async function getUserTenants(req, res) {
  try {
    const user = req.user; // Из JWT middleware
    
    const result = await query(`
      SELECT 
        ut.tenant_id,
        ut.is_current,
        t.name,
        t.display_name,
        t.created_at,
        ut.role as user_role
      FROM user_tenants ut
      JOIN tenants t ON t.id = ut.tenant_id
      WHERE ut.user_id = $1 AND ut.is_active = true
      ORDER BY ut.is_current DESC, t.name ASC;
    `, [user.id]);

    const tenants = result.rows.map(row => ({
      id: row.tenant_id,
      name: row.name,
      displayName: row.display_name,
      isCurrent: row.is_current,
      userRole: row.user_role,
      createdAt: row.created_at
    }));

    res.json({
      success: true,
      tenants
    });

  } catch (error) {
    console.error('❌ Ошибка получения списка тенантов:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Переключение на другой тенант
 * POST /auth/switch-tenant
 */
export async function switchTenant(req, res) {
  try {
    const user = req.user; // Из JWT middleware
    const { tenantId } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        error: 'ID тенанта обязателен',
        code: 'MISSING_TENANT_ID'
      });
    }

    // 1. Проверяем доступ к тенанту
    const tenantResult = await query(`
      SELECT ut.tenant_id, t.name, t.display_name, ut.role
      FROM user_tenants ut
      JOIN tenants t ON t.id = ut.tenant_id
      WHERE ut.user_id = $1 AND ut.tenant_id = $2 AND ut.is_active = true;
    `, [user.id, tenantId]);

    if (tenantResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Доступ к указанному тенанту запрещен',
        code: 'TENANT_ACCESS_DENIED'
      });
    }

    const tenantInfo = tenantResult.rows[0];

    // 2. Обновляем текущий тенант
    await query('BEGIN');
    
    try {
      // Сбрасываем is_current для всех тенантов пользователя
      await query(`
        UPDATE user_tenants 
        SET is_current = false 
        WHERE user_id = $1;
      `, [user.id]);

      // Устанавливаем новый текущий тенант
      await query(`
        UPDATE user_tenants 
        SET is_current = true 
        WHERE user_id = $1 AND tenant_id = $2;
      `, [user.id, tenantId]);

      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

    // 3. Получаем данные пользователя
    const userResult = await query(`
      SELECT id, email, firstname, lastname
      FROM auth_users
      WHERE id = $1;
    `, [user.id]);

    const userData = userResult.rows[0];

    // 4. Создаем новый access токен с новым тенантом
    const userDataWithRole = { ...userData, role: 'estimator' }; // Временная роль
    const accessToken = tokenService.createAccessToken(userDataWithRole, tenantId);

    console.log(`🔄 Переключение тенанта: user=${user.id.substring(0,8)}, tenant=${tenantInfo.name}`);

    res.json({
      success: true,
      accessToken,
      user: {
        id: userData.id,
        email: userData.email,
        role: 'estimator', // Временная роль
        tenantId: tenantId,
        tenantName: tenantInfo.name,
        tenantDisplayName: tenantInfo.display_name,
        tenantRole: tenantInfo.role
      }
    });

  } catch (error) {
    console.error('❌ Ошибка переключения тенанта:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

/**
 * Получение информации о текущем пользователе
 * GET /auth/me
 */
export async function getCurrentUserInfo(req, res) {
  try {
    // Возвращаем тестовую информацию
    res.json({
      success: true,
      user: {
        id: 6,
        email: 'kiy026@yandex.ru',
        role: 'estimator',
        tenantId: 'cd5ffb0f-8616-4227-a056-4f729ed6933c',
        tenantName: 'Test Company RLS'
      }
    });

  } catch (error) {
    console.error('❌ Ошибка получения информации о пользователе:', error);
    res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      code: 'INTERNAL_ERROR'
    });
  }
}

// Экспорт всех контроллеров
export default {
  login,
  refreshToken,
  logout,
  getUserTenants,
  switchTenant,
  getCurrentUserInfo
};
