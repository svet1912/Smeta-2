// /api/works/index.js - Works API Endpoint
// Управление работами для Vercel Serverless

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
    // Verify authentication
    const decoded = verifyToken(req);
    const tenantId = decoded.tenantId;

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    switch (req.method) {
      case 'GET':
        await handleGet(req, res, tenantId);
        break;
      case 'POST':
        await handlePost(req, res, tenantId);
        break;
      case 'PUT':
        await handlePut(req, res, tenantId);
        break;
      case 'DELETE':
        await handleDelete(req, res, tenantId);
        break;
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Works API Error:', error);
    
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

// GET - Получить работы
async function handleGet(req, res, tenantId) {
  const { 
    id, 
    search, 
    category, 
    limit = '50', 
    offset = '0',
    sortBy = 'name',
    sortOrder = 'ASC' 
  } = req.query;

  if (id) {
    // Получить конкретную работу
    const query = `
      SELECT * FROM works 
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `;
    
    const result = await pool.query(query, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Work not found' });
    }
    
    res.status(200).json({ work: result.rows[0] });
  } else {
    // Получить список работ с фильтрацией и поиском
    let query = `
      SELECT w.*, 
             CASE WHEN w.tenant_id IS NULL THEN 'system' ELSE 'custom' END as source
      FROM works w
      WHERE (w.tenant_id = $1 OR w.tenant_id IS NULL)
    `;
    
    const params = [tenantId];
    let paramIndex = 2;

    // Поиск по названию
    if (search) {
      query += ` AND (w.name ILIKE $${paramIndex} OR w.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Фильтр по категории
    if (category) {
      query += ` AND w.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Сортировка
    const allowedSortFields = ['name', 'price', 'category', 'unit', 'created_at'];
    const allowedSortOrders = ['ASC', 'DESC'];
    
    if (allowedSortFields.includes(sortBy) && allowedSortOrders.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY w.${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ` ORDER BY w.name ASC`;
    }

    // Пагинация
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Получаем общее количество
    let countQuery = `
      SELECT COUNT(*) as total
      FROM works w
      WHERE (w.tenant_id = $1 OR w.tenant_id IS NULL)
    `;
    
    const countParams = [tenantId];
    let countParamIndex = 2;

    if (search) {
      countQuery += ` AND (w.name ILIKE $${countParamIndex} OR w.description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (category) {
      countQuery += ` AND w.category = $${countParamIndex}`;
      countParams.push(category);
    }

    const countResult = await pool.query(countQuery, countParams);
    
    res.status(200).json({ 
      works: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  }
}

// POST - Создать новую работу
async function handlePost(req, res, tenantId) {
  const { 
    name, 
    description, 
    price, 
    unit, 
    category,
    complexity_factor,
    required_qualification,
    estimated_duration 
  } = req.body;

  if (!name || !price || !unit) {
    return res.status(400).json({ 
      error: 'Name, price, and unit are required' 
    });
  }

  // Проверяем, не существует ли уже такая работа
  const checkQuery = `
    SELECT id FROM works 
    WHERE name = $1 AND tenant_id = $2
  `;
  const checkResult = await pool.query(checkQuery, [name, tenantId]);

  if (checkResult.rows.length > 0) {
    return res.status(400).json({ 
      error: 'Work with this name already exists' 
    });
  }

  const query = `
    INSERT INTO works (name, description, price, unit, category, complexity_factor, required_qualification, estimated_duration, tenant_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;

  const values = [name, description, price, unit, category, complexity_factor, required_qualification, estimated_duration, tenantId];
  const result = await pool.query(query, values);

  res.status(201).json({ 
    message: 'Work created successfully',
    work: result.rows[0]
  });
}

// PUT - Обновить работу
async function handlePut(req, res, tenantId) {
  const { id } = req.query;
  const { 
    name, 
    description, 
    price, 
    unit, 
    category,
    complexity_factor,
    required_qualification,
    estimated_duration 
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Work ID is required' });
  }

  // Проверяем, принадлежит ли работа тенанту (можно редактировать только свои работы)
  const checkQuery = `
    SELECT id FROM works 
    WHERE id = $1 AND tenant_id = $2
  `;
  const checkResult = await pool.query(checkQuery, [id, tenantId]);

  if (checkResult.rows.length === 0) {
    return res.status(404).json({ 
      error: 'Work not found or you do not have permission to edit it' 
    });
  }

  const query = `
    UPDATE works 
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        unit = COALESCE($4, unit),
        category = COALESCE($5, category),
        complexity_factor = COALESCE($6, complexity_factor),
        required_qualification = COALESCE($7, required_qualification),
        estimated_duration = COALESCE($8, estimated_duration),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $9 AND tenant_id = $10
    RETURNING *
  `;

  const values = [name, description, price, unit, category, complexity_factor, required_qualification, estimated_duration, id, tenantId];
  const result = await pool.query(query, values);

  res.status(200).json({
    message: 'Work updated successfully',
    work: result.rows[0]
  });
}

// DELETE - Удалить работу
async function handleDelete(req, res, tenantId) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Work ID is required' });
  }

  // Проверяем, используется ли работа в сметах
  const checkUsageQuery = `
    SELECT COUNT(*) as count 
    FROM estimate_works ew
    JOIN estimates e ON ew.estimate_id = e.id
    WHERE ew.work_id = $1 AND e.tenant_id = $2
  `;
  const usageResult = await pool.query(checkUsageQuery, [id, tenantId]);

  if (parseInt(usageResult.rows[0].count) > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete work that is used in estimates',
      usage_count: usageResult.rows[0].count
    });
  }

  // Удаляем работу (только свои)
  const deleteQuery = `
    DELETE FROM works 
    WHERE id = $1 AND tenant_id = $2 
    RETURNING *
  `;
  const result = await pool.query(deleteQuery, [id, tenantId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ 
      error: 'Work not found or you do not have permission to delete it' 
    });
  }

  res.status(200).json({
    message: 'Work deleted successfully',
    work: result.rows[0]
  });
}