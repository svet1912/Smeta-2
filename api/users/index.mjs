// /api/users/index.js - Users API Endpoint
// Управление пользователями для Vercel Serverless

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('No authorization header');
  }
  
  const token = authHeader.split(' ')[1];
  if (!token) {
    throw new Error('No token provided');
  }
  
  const jwt = require('jsonwebtoken');
  return jwt.verify(token, process.env.JWT_SECRET);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  try {
    const decoded = verifyToken(req);
    const userId = decoded.userId;
    const tenantId = decoded.tenantId;

    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    switch (req.method) {
      case 'GET':
        await handleGet(req, res, userId, tenantId);
        break;
      case 'PUT':
        await handlePut(req, res, userId, tenantId);
        break;
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Users API Error:', error);
    
    if (error.message.includes('authorization') || error.message.includes('token')) {
      res.status(401).json({ error: 'Unauthorized' });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
}

async function handleGet(req, res, userId, tenantId) {
  // Получить информацию о текущем пользователе
  const query = `
    SELECT u.id, u.username, u.email, u.role, u.created_at,
           t.name as tenant_name, t.plan as tenant_plan
    FROM users u
    JOIN tenants t ON u.tenant_id = t.id
    WHERE u.id = $1 AND u.tenant_id = $2
  `;
  
  const result = await pool.query(query, [userId, tenantId]);
  
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.status(200).json({ user: result.rows[0] });
}

async function handlePut(req, res, userId, tenantId) {
  const { username, email } = req.body;

  if (!username && !email) {
    return res.status(400).json({ error: 'Username or email is required' });
  }

  const query = `
    UPDATE users 
    SET username = COALESCE($1, username),
        email = COALESCE($2, email),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3 AND tenant_id = $4
    RETURNING id, username, email, role, created_at
  `;

  const values = [username, email, userId, tenantId];
  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.status(200).json({
    message: 'User updated successfully',
    user: result.rows[0]
  });
}