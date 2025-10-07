// /api/projects/index.js - Projects API Endpoint
// Управление проектами для Vercel Serverless

import { Pool } from 'pg';

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// JWT verification helper
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

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  try {
    // Verify authentication for all requests
    const decoded = verifyToken(req);
    const userId = decoded.userId;
    const tenantId = decoded.tenantId;

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    switch (req.method) {
      case 'GET':
        await handleGet(req, res, userId, tenantId);
        break;
      case 'POST':
        await handlePost(req, res, userId, tenantId);
        break;
      case 'PUT':
        await handlePut(req, res, userId, tenantId);
        break;
      case 'DELETE':
        await handleDelete(req, res, userId, tenantId);
        break;
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Projects API Error:', error);
    
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

// GET - Получить список проектов
async function handleGet(req, res, userId, tenantId) {
  const { id } = req.query;

  if (id) {
    // Получить конкретный проект
    const query = `
      SELECT p.*, 
             COUNT(e.id) as estimates_count,
             COALESCE(SUM(e.total_cost), 0) as total_value
      FROM projects p
      LEFT JOIN estimates e ON p.id = e.project_id
      WHERE p.id = $1 AND p.tenant_id = $2
      GROUP BY p.id
    `;
    
    const result = await pool.query(query, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.status(200).json({ project: result.rows[0] });
  } else {
    // Получить список всех проектов
    const query = `
      SELECT p.*, 
             COUNT(e.id) as estimates_count,
             COALESCE(SUM(e.total_cost), 0) as total_value
      FROM projects p
      LEFT JOIN estimates e ON p.id = e.project_id
      WHERE p.tenant_id = $1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `;
    
    const result = await pool.query(query, [tenantId]);
    
    res.status(200).json({ 
      projects: result.rows,
      total: result.rows.length
    });
  }
}

// POST - Создать новый проект
async function handlePost(req, res, userId, tenantId) {
  const { name, description, address, client_name, client_contact } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const query = `
    INSERT INTO projects (name, description, address, client_name, client_contact, tenant_id, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;

  const values = [name, description, address, client_name, client_contact, tenantId, userId];
  const result = await pool.query(query, values);

  res.status(201).json({ 
    message: 'Project created successfully',
    project: result.rows[0]
  });
}

// PUT - Обновить проект
async function handlePut(req, res, userId, tenantId) {
  const { id } = req.query;
  const { name, description, address, client_name, client_contact, status } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  const query = `
    UPDATE projects 
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        address = COALESCE($3, address),
        client_name = COALESCE($4, client_name),
        client_contact = COALESCE($5, client_contact),
        status = COALESCE($6, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $7 AND tenant_id = $8
    RETURNING *
  `;

  const values = [name, description, address, client_name, client_contact, status, id, tenantId];
  const result = await pool.query(query, values);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.status(200).json({
    message: 'Project updated successfully',
    project: result.rows[0]
  });
}

// DELETE - Удалить проект
async function handleDelete(req, res, userId, tenantId) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  // Проверяем, есть ли связанные сметы
  const checkQuery = 'SELECT COUNT(*) as count FROM estimates WHERE project_id = $1';
  const checkResult = await pool.query(checkQuery, [id]);

  if (parseInt(checkResult.rows[0].count) > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete project with existing estimates',
      estimates_count: checkResult.rows[0].count
    });
  }

  const deleteQuery = 'DELETE FROM projects WHERE id = $1 AND tenant_id = $2 RETURNING *';
  const result = await pool.query(deleteQuery, [id, tenantId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.status(200).json({
    message: 'Project deleted successfully',
    project: result.rows[0]
  });
}