// Cache Analytics Dashboard - маршруты для мониторинга кэша
import express from 'express';
import { getSmartCacheAnalytics, getSmartCacheStats, cleanupSmartCache } from '../cache/smartCache.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * GET /api/admin/cache/analytics
 * Получение полной аналитики кэша
 */
router.get('/analytics', authMiddleware, async (req, res) => {
  try {
    const analytics = await getSmartCacheAnalytics();
    
    // Добавляем дополнительные вычисляемые метрики
    const enrichedAnalytics = {
      ...analytics,
      performance: {
        hitRatePercentage: parseFloat(analytics.hitRate),
        averageLatencyMs: Math.round(analytics.averageLatency * 100) / 100,
        operationsPerSecond: calculateOpsPerSecond(analytics),
        efficiency: calculateEfficiency(analytics)
      },
      health: {
        status: getHealthStatus(analytics),
        recommendations: getRecommendations(analytics)
      }
    };

    res.json({
      success: true,
      data: enrichedAnalytics
    });
  } catch (error) {
    console.error('❌ Cache analytics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache analytics'
    });
  }
});

/**
 * GET /api/admin/cache/stats
 * Базовая статистика кэша (легковесная)
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = getSmartCacheStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

/**
 * POST /api/admin/cache/cleanup
 * Запуск очистки устаревших данных
 */
router.post('/cleanup', authMiddleware, async (req, res) => {
  try {
    await cleanupSmartCache();
    
    res.json({
      success: true,
      message: 'Cache cleanup completed'
    });
  } catch (error) {
    console.error('❌ Cache cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup cache'
    });
  }
});

/**
 * GET /api/admin/cache/dashboard
 * HTML dashboard для мониторинга кэша
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const analytics = await getSmartCacheAnalytics();
    
    const dashboardHtml = generateDashboardHtml(analytics);
    
    res.set('Content-Type', 'text/html');
    res.send(dashboardHtml);
  } catch (error) {
    console.error('❌ Cache dashboard error:', error);
    res.status(500).send(`
      <html>
        <body>
          <h1>Cache Dashboard Error</h1>
          <p>Failed to load cache analytics: ${error.message}</p>
        </body>
      </html>
    `);
  }
});

// Вспомогательные функции

function calculateOpsPerSecond(analytics) {
  // Примерный расчет операций в секунду за последний час
  const totalOps = analytics.hits + analytics.misses + analytics.sets;
  // Предполагаем, что статистика собирается за последний час
  return Math.round((totalOps / 3600) * 100) / 100;
}

function calculateEfficiency(analytics) {
  const hitRate = parseFloat(analytics.hitRate);
  const avgLatency = analytics.averageLatency;
  
  // Efficiency = (hit rate * 100) / (average latency + 1)
  // Высокий hit rate и низкая latency = высокая эффективность
  const efficiency = (hitRate * 100) / (avgLatency + 1);
  return Math.round(efficiency * 100) / 100;
}

function getHealthStatus(analytics) {
  const hitRate = parseFloat(analytics.hitRate);
  const errors = analytics.errors;
  const avgLatency = analytics.averageLatency;

  if (errors > 10) return 'critical';
  if (hitRate < 50 || avgLatency > 100) return 'warning';
  if (hitRate > 80 && avgLatency < 50) return 'excellent';
  return 'good';
}

function getRecommendations(analytics) {
  const recommendations = [];
  const hitRate = parseFloat(analytics.hitRate);
  const errors = analytics.errors;
  const avgLatency = analytics.averageLatency;

  if (hitRate < 70) {
    recommendations.push({
      type: 'performance',
      message: 'Hit rate низкий. Рассмотрите увеличение TTL или cache warming.',
      priority: 'high'
    });
  }

  if (avgLatency > 50) {
    recommendations.push({
      type: 'performance',
      message: 'Высокая латентность кэша. Проверьте соединение с Redis.',
      priority: 'medium'
    });
  }

  if (errors > 5) {
    recommendations.push({
      type: 'reliability',
      message: 'Высокое количество ошибок. Проверьте логи Redis.',
      priority: 'high'
    });
  }

  if (analytics.totalKeys > 10000) {
    recommendations.push({
      type: 'maintenance',
      message: 'Большое количество ключей. Рассмотрите очистку или оптимизацию TTL.',
      priority: 'low'
    });
  }

  return recommendations;
}

function generateDashboardHtml(analytics) {
  const health = getHealthStatus(analytics);
  const healthColor = {
    excellent: '#4CAF50',
    good: '#2196F3',
    warning: '#FF9800',
    critical: '#F44336'
  }[health];

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmartCache Analytics Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
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
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
        .recommendations {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .recommendation {
            padding: 10px;
            margin: 10px 0;
            border-left: 4px solid #2196F3;
            background: #f8f9fa;
        }
        .recommendation.high { border-color: #F44336; }
        .recommendation.medium { border-color: #FF9800; }
        .recommendation.low { border-color: #4CAF50; }
        .timestamp {
            color: #666;
            font-size: 0.9em;
        }
    </style>
    <script>
        // Автообновление каждые 30 секунд
        setTimeout(() => location.reload(), 30000);
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 SmartCache Analytics Dashboard</h1>
            <p>
                <span class="health-indicator"></span>
                Статус: <strong>${health.toUpperCase()}</strong>
            </p>
            <p class="timestamp">Обновлено: ${analytics.timestamp}</p>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${analytics.hitRate}%</div>
                <div class="metric-label">Hit Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.hits}</div>
                <div class="metric-label">Cache Hits</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.misses}</div>
                <div class="metric-label">Cache Misses</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(analytics.averageLatency)}ms</div>
                <div class="metric-label">Avg Latency</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.totalKeys}</div>
                <div class="metric-label">Total Keys</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.sets}</div>
                <div class="metric-label">Cache Sets</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.invalidations}</div>
                <div class="metric-label">Invalidations</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${analytics.errors}</div>
                <div class="metric-label">Errors</div>
            </div>
        </div>

        ${
          analytics.redis
            ? `
        <div class="metric-card">
            <h3>📊 Redis Info</h3>
            <p><strong>Used Memory:</strong> ${analytics.redis.usedMemory}</p>
            <p><strong>Max Memory:</strong> ${analytics.redis.maxMemory}</p>
            <p><strong>Actual Keys:</strong> ${analytics.actualKeys || 'calculating...'}</p>
        </div>
        `
            : ''
        }

        <div class="recommendations">
            <h3>💡 Рекомендации</h3>
            ${getRecommendations(analytics)
              .map(
                (rec) => `
                <div class="recommendation ${rec.priority}">
                    <strong>${rec.type.toUpperCase()}:</strong> ${rec.message}
                </div>
            `
              )
              .join('')}
            ${getRecommendations(analytics).length === 0 ? '<p>Все отлично! Рекомендаций нет.</p>' : ''}
        </div>
    </div>
</body>
</html>`;
}

export default router;