/**
 * Vercel API Test Endpoint
 * GET /api/test
 */

import { Pool } from 'pg';

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

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

  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET method is allowed'
    });
  }

  try {
    // Тестируем подключение к базе данных
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    client.release();

    return res.status(200).json({
      message: 'API работает!',
      database_time: result.rows[0].current_time,
      database_version: result.rows[0].db_version.split(' ')[0],
      status: 'connected',
      timestamp: new Date().toISOString(),
      platform: 'Vercel Serverless',
      region: process.env.VERCEL_REGION || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      pool_stats: {
        total_connections: pool.totalCount,
        idle_connections: pool.idleCount,
        waiting_count: pool.waitingCount
      }
    });

  } catch (error) {
    console.error('Database test failed:', error);
    
    return res.status(500).json({
      message: 'Database connection failed',
      error: error.message,
      status: 'disconnected',
      timestamp: new Date().toISOString(),
      platform: 'Vercel Serverless',
      environment: process.env.NODE_ENV || 'development'
    });
  }
}