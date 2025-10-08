/**
 * Vercel API Authentication Login Endpoint
 * POST /api/auth/login
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// JWT настройки
const JWT_SECRET = process.env.JWT_SECRET || 'vercel-dev-secret-key-2024';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'vercel-dev-refresh-secret-key-2024';

export default async function handler(req, res) {
  // Добавляем CORS заголовки
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const { email, password } = req.body;

    // Валидация входных данных
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email и пароль обязательны'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Неверный формат email'
      });
    }

    // Поиск пользователя в базе данных
    const client = await pool.connect();
    
    try {
      const userQuery = `
        SELECT id, email, password_hash, firstname, lastname, company, 
               is_active, email_verified, created_at, role, tenant_id
        FROM auth_users 
        WHERE email = $1 AND is_active = true
      `;
      
      const userResult = await client.query(userQuery, [email.toLowerCase()]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }

      const user = userResult.rows[0];

      // Проверка пароля
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Неверный email или пароль'
        });
      }

      // Генерация JWT токенов
      const accessToken = jwt.sign(
        {
          userId: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          role: user.role || 'user',
          tenantId: user.tenant_id
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id, email: user.email },
        JWT_REFRESH_SECRET,
        { expiresIn: '30d' }
      );

      // Сохранение refresh token в базе данных
      const tokenQuery = `
        INSERT INTO user_sessions (user_id, refresh_token, expires_at, created_at, user_agent, ip_address)
        VALUES ($1, $2, $3, NOW(), $4, $5)
        ON CONFLICT (user_id) 
        DO UPDATE SET refresh_token = $2, expires_at = $3, updated_at = NOW()
      `;
      
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 дней
      const userAgent = req.headers['user-agent'] || 'Unknown';
      const ipAddress = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
      
      await client.query(tokenQuery, [user.id, refreshToken, expiresAt, userAgent, ipAddress]);

      // Успешный ответ
      return res.status(200).json({
        success: true,
        message: 'Успешная авторизация',
        user: {
          id: user.id,
          email: user.email,
          firstname: user.firstname,
          lastname: user.lastname,
          company: user.company,
          role: user.role || 'user',
          tenantId: user.tenant_id,
          emailVerified: user.email_verified
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '24h'
        },
        platform: 'Vercel Serverless',
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Login error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}