// /api/estimates/index.js - Estimates API Endpoint
// Управление сметами для Vercel Serverless

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
    console.error('Estimates API Error:', error);
    
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

// GET - Получить сметы
async function handleGet(req, res, userId, tenantId) {
  const { 
    id, 
    project_id,
    limit = '50', 
    offset = '0',
    sortBy = 'created_at',
    sortOrder = 'DESC',
    status
  } = req.query;

  if (id) {
    // Получить конкретную смету с деталями
    const estimateQuery = `
      SELECT e.*, 
             p.name as project_name,
             p.address as project_address,
             p.client_name,
             u.username as created_by_name
      FROM estimates e
      JOIN projects p ON e.project_id = p.id
      JOIN users u ON e.created_by = u.id
      WHERE e.id = $1 AND e.tenant_id = $2
    `;
    
    const estimateResult = await pool.query(estimateQuery, [id, tenantId]);
    
    if (estimateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Estimate not found' });
    }

    // Получить позиции сметы с материалами и работами
    const itemsQuery = `
      SELECT 
        'material' as type,
        em.id,
        em.quantity,
        em.unit_price,
        em.total_price,
        m.name,
        m.description,
        m.unit,
        m.category
      FROM estimate_materials em
      JOIN materials m ON em.material_id = m.id
      WHERE em.estimate_id = $1
      
      UNION ALL
      
      SELECT 
        'work' as type,
        ew.id,
        ew.quantity,
        ew.unit_price,
        ew.total_price,
        w.name,
        w.description,
        w.unit,
        w.category
      FROM estimate_works ew
      JOIN works w ON ew.work_id = w.id
      WHERE ew.estimate_id = $1
      
      ORDER BY type, name
    `;
    
    const itemsResult = await pool.query(itemsQuery, [id]);
    
    res.status(200).json({ 
      estimate: estimateResult.rows[0],
      items: itemsResult.rows
    });
  } else {
    // Получить список смет
    let query = `
      SELECT e.*, 
             p.name as project_name,
             p.client_name,
             u.username as created_by_name,
             COUNT(em.id) + COUNT(ew.id) as items_count
      FROM estimates e
      JOIN projects p ON e.project_id = p.id
      JOIN users u ON e.created_by = u.id
      LEFT JOIN estimate_materials em ON e.id = em.estimate_id
      LEFT JOIN estimate_works ew ON e.id = ew.estimate_id
      WHERE e.tenant_id = $1
    `;
    
    const params = [tenantId];
    let paramIndex = 2;

    // Фильтр по проекту
    if (project_id) {
      query += ` AND e.project_id = $${paramIndex}`;
      params.push(project_id);
      paramIndex++;
    }

    // Фильтр по статусу
    if (status) {
      query += ` AND e.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` GROUP BY e.id, p.name, p.client_name, u.username`;

    // Сортировка
    const allowedSortFields = ['name', 'total_cost', 'created_at', 'status'];
    const allowedSortOrders = ['ASC', 'DESC'];
    
    if (allowedSortFields.includes(sortBy) && allowedSortOrders.includes(sortOrder.toUpperCase())) {
      query += ` ORDER BY e.${sortBy} ${sortOrder.toUpperCase()}`;
    } else {
      query += ` ORDER BY e.created_at DESC`;
    }

    // Пагинация
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Получаем общее количество
    let countQuery = `
      SELECT COUNT(DISTINCT e.id) as total
      FROM estimates e
      JOIN projects p ON e.project_id = p.id
      WHERE e.tenant_id = $1
    `;
    
    const countParams = [tenantId];
    let countParamIndex = 2;

    if (project_id) {
      countQuery += ` AND e.project_id = $${countParamIndex}`;
      countParams.push(project_id);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND e.status = $${countParamIndex}`;
      countParams.push(status);
    }

    const countResult = await pool.query(countQuery, countParams);
    
    res.status(200).json({ 
      estimates: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  }
}

// POST - Создать новую смету
async function handlePost(req, res, userId, tenantId) {
  const { 
    name, 
    description, 
    project_id,
    materials = [],
    works = []
  } = req.body;

  if (!name || !project_id) {
    return res.status(400).json({ 
      error: 'Name and project_id are required' 
    });
  }

  // Проверяем, что проект принадлежит тенанту
  const projectCheck = await pool.query(
    'SELECT id FROM projects WHERE id = $1 AND tenant_id = $2',
    [project_id, tenantId]
  );

  if (projectCheck.rows.length === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Создаем смену
    const estimateQuery = `
      INSERT INTO estimates (name, description, project_id, tenant_id, created_by, total_cost)
      VALUES ($1, $2, $3, $4, $5, 0)
      RETURNING *
    `;

    const estimateResult = await client.query(estimateQuery, [
      name, description, project_id, tenantId, userId
    ]);

    const estimateId = estimateResult.rows[0].id;
    let totalCost = 0;

    // Добавляем материалы
    for (const material of materials) {
      const { material_id, quantity, unit_price } = material;
      const total_price = quantity * unit_price;
      totalCost += total_price;

      await client.query(`
        INSERT INTO estimate_materials (estimate_id, material_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5)
      `, [estimateId, material_id, quantity, unit_price, total_price]);
    }

    // Добавляем работы
    for (const work of works) {
      const { work_id, quantity, unit_price } = work;
      const total_price = quantity * unit_price;
      totalCost += total_price;

      await client.query(`
        INSERT INTO estimate_works (estimate_id, work_id, quantity, unit_price, total_price)
        VALUES ($1, $2, $3, $4, $5)
      `, [estimateId, work_id, quantity, unit_price, total_price]);
    }

    // Обновляем общую стоимость
    const updatedEstimate = await client.query(`
      UPDATE estimates 
      SET total_cost = $1 
      WHERE id = $2 
      RETURNING *
    `, [totalCost, estimateId]);

    await client.query('COMMIT');

    res.status(201).json({ 
      message: 'Estimate created successfully',
      estimate: updatedEstimate.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// PUT - Обновить смету
async function handlePut(req, res, userId, tenantId) {
  const { id } = req.query;
  const { 
    name, 
    description, 
    status,
    materials = [],
    works = []
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Estimate ID is required' });
  }

  // Проверяем существование сметы
  const checkQuery = `
    SELECT id FROM estimates 
    WHERE id = $1 AND tenant_id = $2
  `;
  const checkResult = await pool.query(checkQuery, [id, tenantId]);

  if (checkResult.rows.length === 0) {
    return res.status(404).json({ error: 'Estimate not found' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Обновляем основную информацию
    await client.query(`
      UPDATE estimates 
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5
    `, [name, description, status, id, tenantId]);

    // Если переданы материалы/работы, обновляем их
    if (materials.length > 0 || works.length > 0) {
      // Удаляем существующие позиции
      await client.query('DELETE FROM estimate_materials WHERE estimate_id = $1', [id]);
      await client.query('DELETE FROM estimate_works WHERE estimate_id = $1', [id]);

      let totalCost = 0;

      // Добавляем новые материалы
      for (const material of materials) {
        const { material_id, quantity, unit_price } = material;
        const total_price = quantity * unit_price;
        totalCost += total_price;

        await client.query(`
          INSERT INTO estimate_materials (estimate_id, material_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, material_id, quantity, unit_price, total_price]);
      }

      // Добавляем новые работы
      for (const work of works) {
        const { work_id, quantity, unit_price } = work;
        const total_price = quantity * unit_price;
        totalCost += total_price;

        await client.query(`
          INSERT INTO estimate_works (estimate_id, work_id, quantity, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5)
        `, [id, work_id, quantity, unit_price, total_price]);
      }

      // Обновляем общую стоимость
      await client.query(`
        UPDATE estimates 
        SET total_cost = $1 
        WHERE id = $2
      `, [totalCost, id]);
    }

    // Получаем обновленную смету
    const updatedResult = await client.query(`
      SELECT * FROM estimates WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Estimate updated successfully',
      estimate: updatedResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// DELETE - Удалить смету
async function handleDelete(req, res, userId, tenantId) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Estimate ID is required' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Удаляем связанные записи
    await client.query('DELETE FROM estimate_materials WHERE estimate_id = $1', [id]);
    await client.query('DELETE FROM estimate_works WHERE estimate_id = $1', [id]);

    // Удаляем смету
    const deleteResult = await client.query(`
      DELETE FROM estimates 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING *
    `, [id, tenantId]);

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Estimate not found' });
    }

    await client.query('COMMIT');

    res.status(200).json({
      message: 'Estimate deleted successfully',
      estimate: deleteResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}