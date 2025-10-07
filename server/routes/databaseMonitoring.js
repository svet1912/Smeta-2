// Database Monitoring Routes - Phase 3 Step 1
import express from 'express';
import { getDatabaseManager } from '../database/advancedPool.js';
import queryOptimizer from '../database/queryOptimizer.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/admin/database/stats
 * Получение статистики database pool
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const dbManager = getDatabaseManager();
    const poolStats = dbManager.getPoolStats();
    const optimizerStats = queryOptimizer.getOptimizerStats();

    res.json({
      success: true,
      data: {
        pool: poolStats,
        optimizer: optimizerStats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Database stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database stats'
    });
  }
});

/**
 * GET /api/admin/database/health
 * Проверка здоровья базы данных
 */
router.get('/health', authMiddleware, async (req, res) => {
  try {
    const dbManager = getDatabaseManager();
    const healthCheck = await dbManager.healthCheck();

    const statusCode = healthCheck.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthCheck.status === 'healthy',
      data: healthCheck
    });
  } catch (error) {
    console.error('❌ Database health check error:', error);
    res.status(503).json({
      success: false,
      error: 'Database health check failed'
    });
  }
});

/**
 * GET /api/admin/database/slow-queries
 * Получение медленных запросов
 */
router.get('/slow-queries', authMiddleware, async (req, res) => {
  try {
    const { minDuration = 1000 } = req.query;
    const dbManager = getDatabaseManager();
    
    const slowQueries = dbManager.getSlowQueries(parseInt(minDuration));
    
    res.json({
      success: true,
      data: {
        slowQueries,
        minDuration: parseInt(minDuration),
        count: slowQueries.length
      }
    });
  } catch (error) {
    console.error('❌ Slow queries error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get slow queries'
    });
  }
});

/**
 * POST /api/admin/database/analyze-query
 * Анализ производительности запроса
 */
router.post('/analyze-query', authMiddleware, async (req, res) => {
  try {
    const { query, params = [] } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const analysis = await queryOptimizer.analyzeQuery(query, params);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('❌ Query analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze query'
    });
  }
});

/**
 * GET /api/admin/database/dashboard
 * HTML dashboard для мониторинга базы данных
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const dbManager = getDatabaseManager();
    const poolStats = dbManager.getPoolStats();
    const slowQueries = dbManager.getSlowQueries(500);
    const optimizerStats = queryOptimizer.getOptimizerStats();

    const dashboardHtml = generateDatabaseDashboardHtml({
      poolStats,
      slowQueries,
      optimizerStats
    });

    res.set('Content-Type', 'text/html');
    res.send(dashboardHtml);
  } catch (error) {
    console.error('❌ Database dashboard error:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Database Dashboard Error</h1>
          <p>Failed to load database statistics: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

/**
 * POST /api/admin/database/optimize-query
 * Оптимизация запроса
 */
router.post('/optimize-query', authMiddleware, async (req, res) => {
  try {
    const { query, params = [], context = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query is required'
      });
    }

    const optimized = queryOptimizer.optimizeQuery(query, params, context);
    
    res.json({
      success: true,
      data: {
        original: { query, params },
        optimized,
        context
      }
    });
  } catch (error) {
    console.error('❌ Query optimization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize query'
    });
  }
});

/**
 * Генерация HTML dashboard для мониторинга БД
 */
function generateDatabaseDashboardHtml({ poolStats, slowQueries, optimizerStats }) {
  const connectionUtilization = poolStats.totalCount > 0 
    ? ((poolStats.totalCount - poolStats.idleCount) / poolStats.totalCount * 100).toFixed(1)
    : 0;

  const healthStatus = getHealthStatus(poolStats);
  const healthColor = {
    excellent: '#4CAF50',
    good: '#2196F3', 
    warning: '#FF9800',
    critical: '#F44336'
  }[healthStatus];

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Performance Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2em;
            font-weight: bold;
            color: #333;
        }
        .metric-label {
            color: #666;
            margin-top: 5px;
        }
        .health-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: ${healthColor};
            margin-right: 8px;
        }
        .slow-queries {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        .query-item {
            padding: 10px;
            margin: 10px 0;
            background: #f8f9fa;
            border-radius: 4px;
            border-left: 4px solid #FF9800;
        }
        .query-text {
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
            background: #e9ecef;
            padding: 8px;
            border-radius: 4px;
            margin: 8px 0;
            word-break: break-all;
        }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
        .progress-bar {
            width: 100%;
            height: 20px;
            background: #e9ecef;
            border-radius: 10px;
            overflow: hidden;
            margin: 10px 0;
        }
        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4CAF50, #FF9800);
            transition: width 0.3s ease;
        }
        .optimizer-stats {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
    </style>
    <script>
        // Автообновление каждые 15 секунд
        setTimeout(() => location.reload(), 15000);
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗄️ Database Performance Dashboard</h1>
            <p>
                <span class="health-indicator"></span>
                Статус: <strong>${healthStatus.toUpperCase()}</strong>
            </p>
            <p class="timestamp">Обновлено: ${new Date().toLocaleString('ru-RU')}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${poolStats.totalCount || 0}</div>
                <div class="metric-label">Активные соединения</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${connectionUtilization}%"></div>
                </div>
                <small>Idle: ${poolStats.idleCount || 0} | Waiting: ${poolStats.waitingCount || 0}</small>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${poolStats.queriesExecuted || 0}</div>
                <div class="metric-label">Всего запросов</div>
                <small>Ошибок: ${poolStats.queryErrors || 0} (${poolStats.errorRate})</small>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${Math.round(poolStats.averageQueryTime || 0)}ms</div>
                <div class="metric-label">Среднее время запроса</div>
                <small>QPS: ${poolStats.queriesPerSecond || 0}</small>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${slowQueries.length}</div>
                <div class="metric-label">Медленные запросы</div>
                <small>>500ms за последний час</small>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${optimizerStats.cachedQueries}</div>
                <div class="metric-label">Кэшированные запросы</div>
                <small>Оптимизировано: ${optimizerStats.analyzedQueries}</small>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${Math.round(optimizerStats.averageCost || 0)}</div>
                <div class="metric-label">Средняя стоимость</div>
                <small>Правил оптимизации: ${optimizerStats.optimizationRules}</small>
            </div>
        </div>

        ${slowQueries.length > 0 ? `
        <div class="slow-queries">
            <h3>🐌 Медленные запросы (последние 10)</h3>
            ${slowQueries.slice(0, 10).map(query => `
                <div class="query-item">
                    <strong>⏱️ ${query.duration}ms</strong> | 
                    <strong>📊 ${query.rowCount} rows</strong> | 
                    <span class="timestamp">${new Date(query.timestamp).toLocaleString('ru-RU')}</span>
                    <div class="query-text">${query.query}</div>
                    ${query.error ? `<div style="color: #F44336;">❌ ${query.error}</div>` : ''}
                </div>
            `).join('')}
        </div>
        ` : ''}

        <div class="optimizer-stats">
            <h3>🔧 Query Optimizer Statistics</h3>
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${optimizerStats.recentAnalyses}</div>
                    <div class="metric-label">Анализов за 24ч</div>
                </div>
                <div class="metric-card">
                    <div class="metric-value">${optimizerStats.slowQueries}</div>
                    <div class="metric-label">Медленных за 24ч</div>
                </div>
            </div>
            
            <h4>📋 Последние запросы:</h4>
            ${poolStats.recentQueries ? poolStats.recentQueries.slice(0, 5).map(query => `
                <div class="query-item">
                    <strong>${query.duration}ms</strong> | 
                    <strong>${query.rowCount} rows</strong> |
                    <span class="timestamp">${new Date(query.timestamp).toLocaleString('ru-RU')}</span>
                    <div class="query-text">${query.query}</div>
                </div>
            `).join('') : '<p>Нет данных о последних запросах</p>'}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Определение статуса здоровья БД
 */
function getHealthStatus(poolStats) {
  const errorRate = parseFloat(poolStats.errorRate) || 0;
  const avgTime = poolStats.averageQueryTime || 0;
  const utilization = poolStats.totalCount > 0 
    ? (poolStats.totalCount - poolStats.idleCount) / poolStats.totalCount * 100 
    : 0;

  if (errorRate > 5 || avgTime > 2000 || utilization > 90) return 'critical';
  if (errorRate > 2 || avgTime > 1000 || utilization > 70) return 'warning';
  if (errorRate < 1 && avgTime < 500 && utilization < 50) return 'excellent';
  return 'good';
}

export default router;