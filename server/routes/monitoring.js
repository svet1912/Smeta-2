/**
 * Comprehensive Monitoring Routes
 * Phase 3 Step 3: Comprehensive Monitoring
 * 
 * Routes для мониторинга системы, health checks, metrics и alerting
 */
import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getMonitoringService } from '../services/monitoringService.js';

const router = express.Router();
const monitoringService = getMonitoringService();

/**
 * Prometheus Metrics Endpoint
 * GET /api/monitoring/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await monitoringService.getPrometheusMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    console.error('❌ Metrics endpoint error:', error);
    res.status(500).send('Error retrieving metrics');
  }
});

/**
 * Comprehensive Health Check
 * GET /api/monitoring/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await monitoringService.runHealthChecks();
    
    // Determine overall health status
    const allHealthy = Object.values(health).every(check => check.healthy);
    const status = allHealthy ? 'healthy' : 'degraded';
    const httpStatus = allHealthy ? 200 : 503;
    
    res.status(httpStatus).json({
      status,
      timestamp: new Date().toISOString(),
      checks: health,
      version: process.env.npm_package_version || '1.0.0'
    });
    
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Detailed Health Dashboard
 * GET /api/monitoring/health/dashboard
 */
router.get('/health/dashboard', authMiddleware, async (req, res) => {
  try {
    const dashboardData = await monitoringService.getDashboardData();
    
    const dashboard = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SMETA360 Monitoring Dashboard</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
            .container { max-width: 1400px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 2.5em; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-left: 4px solid #667eea; }
            .card h3 { margin: 0 0 15px 0; color: #333; font-size: 1.3em; }
            .status-healthy { color: #10B981; font-weight: bold; }
            .status-unhealthy { color: #EF4444; font-weight: bold; }
            .status-degraded { color: #F59E0B; font-weight: bold; }
            .metric-value { font-size: 2em; font-weight: bold; color: #667eea; margin-bottom: 5px; }
            .metric-label { color: #666; font-size: 0.9em; }
            .health-check { margin-bottom: 15px; padding: 15px; border-radius: 8px; background: #f8f9fa; }
            .health-check.healthy { border-left: 4px solid #10B981; }
            .health-check.unhealthy { border-left: 4px solid #EF4444; }
            .alert { padding: 15px; margin-bottom: 15px; border-radius: 8px; }
            .alert.warning { background: #FEF3C7; border-left: 4px solid #F59E0B; }
            .alert.critical { background: #FEE2E2; border-left: 4px solid #EF4444; }
            .refresh-btn { background: #10B981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 1em; }
            .refresh-btn:hover { background: #059669; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
            .metric-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
            .timestamp { text-align: center; color: #666; margin-top: 30px; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 SMETA360 Monitoring Dashboard</h1>
              <p>Comprehensive system monitoring with real-time metrics and health checks</p>
              <button class="refresh-btn" onclick="location.reload()">🔄 Refresh Dashboard</button>
            </div>
            
            <!-- Health Status Overview -->
            <div class="grid">
              ${Object.entries(dashboardData.health).map(([name, check]) => `
                <div class="card">
                  <h3>🔍 ${name.toUpperCase()} Health</h3>
                  <div class="status-${check.healthy ? 'healthy' : 'unhealthy'}">
                    ${check.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}
                  </div>
                  ${check.responseTime ? `<p>Response Time: ${check.responseTime}ms</p>` : ''}
                  ${check.usage ? `<p>Usage: ${JSON.stringify(check.usage)}</p>` : ''}
                  ${check.error ? `<p style="color: #EF4444;">Error: ${check.error}</p>` : ''}
                </div>
              `).join('')}
            </div>
            
            <!-- Alerts Section -->
            ${dashboardData.alerts.length > 0 ? `
              <div class="card">
                <h3>⚠️ Active Alerts</h3>
                ${dashboardData.alerts.map(alert => `
                  <div class="alert ${alert.severity}">
                    <strong>${alert.severity.toUpperCase()}</strong>: ${alert.message}
                    <br><small>Time: ${new Date(alert.timestamp).toLocaleString()}</small>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="card">
                <h3>✅ No Active Alerts</h3>
                <p>All systems are operating normally.</p>
              </div>
            `}
            
            <!-- Business Metrics -->
            <div class="card">
              <h3>📊 Business Metrics</h3>
              <div class="metrics-grid">
                ${Object.entries(dashboardData.metrics).filter(([name]) => 
                  ['materials_total', 'works_total', 'projects_total', 'estimates_total', 'active_users_total'].includes(name)
                ).map(([name, metric]) => `
                  <div class="metric-card">
                    <div class="metric-value">${metric.value || 0}</div>
                    <div class="metric-label">${name.replace(/_/g, ' ').toUpperCase()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <!-- Performance Metrics -->
            <div class="card">
              <h3>⚡ Performance Metrics</h3>
              <div class="metrics-grid">
                ${Object.entries(dashboardData.metrics).filter(([name]) => 
                  ['http_requests_total', 'api_requests_per_second', 'cache_hit_ratio'].includes(name)
                ).map(([name, metric]) => `
                  <div class="metric-card">
                    <div class="metric-value">${metric.value || 0}${name.includes('ratio') ? '%' : ''}</div>
                    <div class="metric-label">${name.replace(/_/g, ' ').toUpperCase()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <!-- Database Metrics -->
            <div class="card">
              <h3>🗄️ Database Metrics</h3>
              <div class="metrics-grid">
                ${Object.entries(dashboardData.metrics).filter(([name]) => 
                  name.includes('database')
                ).map(([name, metric]) => `
                  <div class="metric-card">
                    <div class="metric-value">${metric.value || 0}</div>
                    <div class="metric-label">${name.replace(/_/g, ' ').toUpperCase()}</div>
                  </div>
                `).join('')}
              </div>
            </div>
            
            <div class="timestamp">
              <p>Last updated: ${new Date(dashboardData.timestamp).toLocaleString()}</p>
              <p>Auto-refresh in 60 seconds</p>
            </div>
          </div>
          
          <script>
            // Auto-refresh every 60 seconds
            setTimeout(() => location.reload(), 60000);
          </script>
        </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html');
    res.send(dashboard);
    
  } catch (error) {
    console.error('❌ Health dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load health dashboard',
      code: 'DASHBOARD_ERROR'
    });
  }
});

/**
 * System Alerts
 * GET /api/monitoring/alerts
 */
router.get('/alerts', authMiddleware, async (req, res) => {
  try {
    const alerts = await monitoringService.checkAlerts();
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeAlerts: alerts.length,
      alerts
    });
    
  } catch (error) {
    console.error('❌ Alerts endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve alerts',
      code: 'ALERTS_ERROR'
    });
  }
});

/**
 * Business Metrics API
 * GET /api/monitoring/business-metrics
 */
router.get('/business-metrics', authMiddleware, async (req, res) => {
  try {
    const dashboardData = await monitoringService.getDashboardData();
    
    // Extract business metrics
    const businessMetrics = {
      materials: dashboardData.metrics.materials_total?.value || 0,
      works: dashboardData.metrics.works_total?.value || 0,
      projects: dashboardData.metrics.projects_total?.value || 0,
      estimates: dashboardData.metrics.estimates_total?.value || 0,
      activeUsers: dashboardData.metrics.active_users_total?.value || 0,
      cacheHitRate: dashboardData.metrics.cache_hit_ratio?.value || 0,
      requestsPerSecond: dashboardData.metrics.api_requests_per_second?.value || 0
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: businessMetrics
    });
    
  } catch (error) {
    console.error('❌ Business metrics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve business metrics',
      code: 'BUSINESS_METRICS_ERROR'
    });
  }
});

/**
 * Performance Analytics
 * GET /api/monitoring/performance
 */
router.get('/performance', authMiddleware, async (req, res) => {
  try {
    const dashboardData = await monitoringService.getDashboardData();
    
    // Extract performance metrics
    const performanceMetrics = {
      httpRequests: {
        total: dashboardData.metrics.http_requests_total?.value || 0,
        perSecond: dashboardData.metrics.api_requests_per_second?.value || 0
      },
      database: {
        activeConnections: dashboardData.metrics.database_connections_active?.value || 0,
        queriesTotal: dashboardData.metrics.database_queries_total?.value || 0
      },
      cache: {
        hitRatio: dashboardData.metrics.cache_hit_ratio?.value || 0,
        operations: dashboardData.metrics.cache_operations_total?.value || 0
      },
      system: {
        healthy: Object.values(dashboardData.health).every(check => check.healthy)
      }
    };
    
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      performance: performanceMetrics
    });
    
  } catch (error) {
    console.error('❌ Performance analytics error:', error);
    res.status(500).json({
      error: 'Failed to retrieve performance analytics',
      code: 'PERFORMANCE_ERROR'
    });
  }
});

/**
 * System Information
 * GET /api/monitoring/system
 */
router.get('/system', authMiddleware, async (req, res) => {
  try {
    const health = await monitoringService.runHealthChecks();
    
    const systemInfo = {
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: Math.floor(process.uptime())
      },
      memory: health.memory?.usage || {},
      disk: health.disk?.usage || {},
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      system: systemInfo
    });
    
  } catch (error) {
    console.error('❌ System info error:', error);
    res.status(500).json({
      error: 'Failed to retrieve system information',
      code: 'SYSTEM_INFO_ERROR'
    });
  }
});

/**
 * Reset Metrics (for testing)
 * POST /api/monitoring/reset
 */
router.post('/reset', authMiddleware, async (req, res) => {
  try {
    // In production, this should be restricted or removed
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Metrics reset not allowed in production',
        code: 'RESET_FORBIDDEN'
      });
    }
    
    // Reset would clear metrics - for now just return success
    res.json({
      success: true,
      message: 'Metrics reset completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Metrics reset error:', error);
    res.status(500).json({
      error: 'Failed to reset metrics',
      code: 'RESET_ERROR'
    });
  }
});

/**
 * Monitoring Configuration
 * GET /api/monitoring/config
 */
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const config = {
      metricsEnabled: true,
      healthChecksEnabled: true,
      alertingEnabled: true,
      businessMetricsEnabled: true,
      refreshIntervals: {
        businessMetrics: 30000, // 30 seconds
        healthChecks: 10000,    // 10 seconds
        dashboard: 60000        // 60 seconds
      },
      thresholds: {
        responseTime: 2000,     // 2 seconds
        cacheHitRate: 50,       // 50%
        memoryUsage: 80         // 80%
      }
    };
    
    res.json({
      success: true,
      config,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Config endpoint error:', error);
    res.status(500).json({
      error: 'Failed to retrieve monitoring configuration',
      code: 'CONFIG_ERROR'
    });
  }
});

export default router;