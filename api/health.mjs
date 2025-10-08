/**
 * Vercel API Health Check Endpoint
 * GET /api/health
 */

import { Pool } from 'pg';

// Подключение к базе данных
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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
    // Проверяем подключение к базе данных
    let dbStatus = { connected: false };
    
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT NOW() as current_time');
      client.release();
      
      dbStatus = {
        connected: true,
        server_time: result.rows[0].current_time,
        pool_total: pool.totalCount,
        pool_idle: pool.idleCount
      };
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      dbStatus = {
        connected: false,
        error: dbError.message
      };
    }

    return res.status(200).json({
      status: 'OK',
      message: 'SMETA360-2 API работает на Vercel',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      platform: 'Vercel Serverless',
      region: process.env.VERCEL_REGION || 'unknown',
      deployment: {
        id: process.env.VERCEL_DEPLOYMENT_ID,
        url: process.env.VERCEL_URL,
        branch: process.env.VERCEL_GIT_COMMIT_REF,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7)
      },
      version: '2.0.0'
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return res.status(500).json({
      status: 'ERROR',
      message: 'Service unavailable',
      timestamp: new Date().toISOString(),
      error: error.message,
      environment: process.env.NODE_ENV || 'development'
    });
  }
}