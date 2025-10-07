/**
 * Vercel API Authentication Register Endpoint
 * POST /api/auth/register
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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
const BCRYPT_SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

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
    const { email, password, firstname, lastname, company } = req.body;

    // Валидация входных данных
    if (!email || !password || !firstname || !lastname) {
      return res.status(400).json({
        success: false,
        message: 'Все обязательные поля должны быть заполнены'
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

    // Password validation
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Пароль должен содержать минимум 8 символов'
      });
    }

    const client = await pool.connect();
    
    try {
      // Проверяем, существует ли пользователь
      const existingUserQuery = 'SELECT id FROM auth_users WHERE email = $1';
      const existingUser = await client.query(existingUserQuery, [email.toLowerCase()]);
      
      if (existingUser.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Пользователь с таким email уже существует'
        });
      }

      // Хэшируем пароль
      const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
      
      // Генерируем tenant_id для нового пользователя
      const tenantId = uuidv4();

      // Создаем нового пользователя
      const insertUserQuery = `
        INSERT INTO auth_users (
          email, password_hash, firstname, lastname, company, 
          tenant_id, is_active, email_verified, created_at, role
        ) VALUES ($1, $2, $3, $4, $5, $6, true, false, NOW(), 'user')
        RETURNING id, email, firstname, lastname, company, tenant_id, role, created_at
      `;
      
      const newUserResult = await client.query(insertUserQuery, [
        email.toLowerCase(),
        passwordHash,
        firstname,
        lastname,
        company || null,
        tenantId
      ]);

      const newUser = newUserResult.rows[0];

      // Создаем тенант для пользователя
      const insertTenantQuery = `
        INSERT INTO tenants (id, name, created_by, created_at, is_active)
        VALUES ($1, $2, $3, NOW(), true)
        ON CONFLICT (id) DO NOTHING
      `;
      
      await client.query(insertTenantQuery, [
        tenantId,
        `${firstname} ${lastname} - Personal Workspace`,
        newUser.id
      ]);

      // Генерируем JWT токен
      const accessToken = jwt.sign(
        {
          userId: newUser.id,
          email: newUser.email,
          firstname: newUser.firstname,
          lastname: newUser.lastname,
          role: newUser.role,
          tenantId: newUser.tenant_id
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Успешный ответ
      return res.status(201).json({
        success: true,
        message: 'Пользователь успешно зарегистрирован',
        user: {
          id: newUser.id,
          email: newUser.email,
          firstname: newUser.firstname,
          lastname: newUser.lastname,
          company: newUser.company,
          tenantId: newUser.tenant_id,
          role: newUser.role,
          emailVerified: false,
          createdAt: newUser.created_at
        },
        tokens: {
          accessToken,
          expiresIn: '24h'
        },
        platform: 'Vercel Serverless',
        timestamp: new Date().toISOString()
      });

    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Registration error:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}