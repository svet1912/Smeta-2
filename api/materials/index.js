// /api/materials/index.js - Materials API Endpoint
// Управление материалами для Vercel Serverless

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
    console.error('Materials API Error:', error);
    
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

// GET - Получить материалы
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
    // Получить конкретный материал
    const query = `
      SELECT * FROM materials 
      WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)
    `;
    
    const result = await pool.query(query, [id, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }
    
    res.status(200).json({ material: result.rows[0] });
  } else {
    // Получить список материалов с фильтрацией и поиском
    let query = `
      SELECT m.*, 
             CASE WHEN m.tenant_id IS NULL THEN 'system' ELSE 'custom' END as source
      FROM materials m
      WHERE (m.tenant_id = $1 OR m.tenant_id IS NULL)
    `;
    
    const params = [tenantId];
    let paramIndex = 2;

    // Поиск по названию
    if (search) {
      query += ` AND (m.name ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Фильтр по категории
    if (category) {
      query += ` AND m.category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Сортировка
    const allowedSortFields = ['name', 'price', 'category', 'unit', 'created_at'];
    const allowedSortOrders = ['ASC', 'DESC'];
    
    if (allowedSortFields.includes(sortBy) && allowedSortOrders.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY m.${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ` ORDER BY m.name ASC`;
    }

    // Пагинация
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Получаем общее количество
    let countQuery = `
      SELECT COUNT(*) as total
      FROM materials m
      WHERE (m.tenant_id = $1 OR m.tenant_id IS NULL)
    `;
    
    const countParams = [tenantId];
    let countParamIndex = 2;

    if (search) {
      countQuery += ` AND (m.name ILIKE $${countParamIndex} OR m.description ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    if (category) {
      countQuery += ` AND m.category = $${countParamIndex}`;
      countParams.push(category);
    }

    const countResult = await pool.query(countQuery, countParams);
    
    res.status(200).json({ 
      materials: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  }
}

// POST - Создать новый материал
async function handlePost(req, res, tenantId) {
  const { 
    name, 
    description, 
    price, 
    unit, 
    category,
    supplier_info,
    specifications 
  } = req.body;

  if (!name || !price || !unit) {
    return res.status(400).json({ 
      error: 'Name, price, and unit are required' 
    });
  }

  // Проверяем, не существует ли уже такой материал
  const checkQuery = `
    SELECT id FROM materials 
    WHERE name = $1 AND tenant_id = $2
  `;
  const checkResult = await pool.query(checkQuery, [name, tenantId]);

  if (checkResult.rows.length > 0) {
    return res.status(400).json({ 
      error: 'Material with this name already exists' 
    });
  }

  const query = `
    INSERT INTO materials (name, description, price, unit, category, supplier_info, specifications, tenant_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `;

  const values = [name, description, price, unit, category, supplier_info, specifications, tenantId];
  const result = await pool.query(query, values);

  res.status(201).json({ 
    message: 'Material created successfully',
    material: result.rows[0]
  });
}

// PUT - Обновить материал
async function handlePut(req, res, tenantId) {
  const { id } = req.query;
  const { 
    name, 
    description, 
    price, 
    unit, 
    category,
    supplier_info,
    specifications 
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Material ID is required' });
  }

  // Проверяем, принадлежит ли материал тенанту (можно редактировать только свои материалы)
  const checkQuery = `
    SELECT id FROM materials 
    WHERE id = $1 AND tenant_id = $2
  `;
  const checkResult = await pool.query(checkQuery, [id, tenantId]);

  if (checkResult.rows.length === 0) {
    return res.status(404).json({ 
      error: 'Material not found or you do not have permission to edit it' 
    });
  }

  const query = `
    UPDATE materials 
    SET name = COALESCE($1, name),
        description = COALESCE($2, description),
        price = COALESCE($3, price),
        unit = COALESCE($4, unit),
        category = COALESCE($5, category),
        supplier_info = COALESCE($6, supplier_info),
        specifications = COALESCE($7, specifications),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $8 AND tenant_id = $9
    RETURNING *
  `;

  const values = [name, description, price, unit, category, supplier_info, specifications, id, tenantId];
  const result = await pool.query(query, values);

  res.status(200).json({
    message: 'Material updated successfully',
    material: result.rows[0]
  });
}

// DELETE - Удалить материал
async function handleDelete(req, res, tenantId) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Material ID is required' });
  }

  // Проверяем, используется ли материал в сметах
  const checkUsageQuery = `
    SELECT COUNT(*) as count 
    FROM estimate_materials em
    JOIN estimates e ON em.estimate_id = e.id
    WHERE em.material_id = $1 AND e.tenant_id = $2
  `;
  const usageResult = await pool.query(checkUsageQuery, [id, tenantId]);

  if (parseInt(usageResult.rows[0].count) > 0) {
    return res.status(400).json({ 
      error: 'Cannot delete material that is used in estimates',
      usage_count: usageResult.rows[0].count
    });
  }

  // Удаляем материал (только свои)
  const deleteQuery = `
    DELETE FROM materials 
    WHERE id = $1 AND tenant_id = $2 
    RETURNING *
  `;
  const result = await pool.query(deleteQuery, [id, tenantId]);

  if (result.rows.length === 0) {
    return res.status(404).json({ 
      error: 'Material not found or you do not have permission to delete it' 
    });
  }

  res.status(200).json({
    message: 'Material deleted successfully',
    material: result.rows[0]
  });
}