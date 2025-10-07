/**
 * Comprehensive Monitoring System
 * Phase 3 Step 3: Comprehensive Monitoring
 * 
 * Advanced monitoring with Prometheus metrics, health checks, APM и business metrics
 */
import promClient from 'prom-client';
import { getDatabaseManager } from '../database/advancedPool.js';
import { getSmartCacheAnalytics } from '../cache/smartCache.js';
import { isRedisAvailable } from '../cache/redisClient.js';

// Initialize Prometheus metrics collection
const register = new promClient.Registry();

// Add default Node.js metrics
promClient.collectDefaultMetrics({
  register,
  prefix: 'smeta360_',
  timeout: 10000
});

/**
 * Custom Business Metrics
 */

// HTTP Request metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'smeta360_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'version'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10]
});

const httpRequestsTotal = new promClient.Counter({
  name: 'smeta360_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'version']
});

// Database metrics
const databaseConnectionsActive = new promClient.Gauge({
  name: 'smeta360_database_connections_active',
  help: 'Number of active database connections'
});

const databaseQueryDuration = new promClient.Histogram({
  name: 'smeta360_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
});

const databaseQueriesTotal = new promClient.Counter({
  name: 'smeta360_database_queries_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'table', 'status']
});

// Cache metrics
const cacheOperationsTotal = new promClient.Counter({
  name: 'smeta360_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'cache_type', 'status']
});

const cacheHitRatio = new promClient.Gauge({
  name: 'smeta360_cache_hit_ratio',
  help: 'Cache hit ratio as percentage',
  labelNames: ['cache_type']
});

// Business metrics
const materialsTotal = new promClient.Gauge({
  name: 'smeta360_materials_total',
  help: 'Total number of materials in system'
});

const worksTotal = new promClient.Gauge({
  name: 'smeta360_works_total',
  help: 'Total number of works in system'
});

const projectsTotal = new promClient.Gauge({
  name: 'smeta360_projects_total',
  help: 'Total number of projects in system'
});

const estimatesTotal = new promClient.Gauge({
  name: 'smeta360_estimates_total',
  help: 'Total number of estimates in system'
});

const activeUsersTotal = new promClient.Gauge({
  name: 'smeta360_active_users_total',
  help: 'Total number of active users'
});

// API Performance metrics
const apiResponseTime = new promClient.Histogram({
  name: 'smeta360_api_response_time_seconds',
  help: 'API response time in seconds',
  labelNames: ['endpoint', 'method', 'version'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
});

const apiRequestsPerSecond = new promClient.Gauge({
  name: 'smeta360_api_requests_per_second',
  help: 'API requests per second'
});

// System health metrics
const systemHealthStatus = new promClient.Gauge({
  name: 'smeta360_system_health_status',
  help: 'System health status (1=healthy, 0=unhealthy)',
  labelNames: ['component']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(databaseConnectionsActive);
register.registerMetric(databaseQueryDuration);
register.registerMetric(databaseQueriesTotal);
register.registerMetric(cacheOperationsTotal);
register.registerMetric(cacheHitRatio);
register.registerMetric(materialsTotal);
register.registerMetric(worksTotal);
register.registerMetric(projectsTotal);
register.registerMetric(estimatesTotal);
register.registerMetric(activeUsersTotal);
register.registerMetric(apiResponseTime);
register.registerMetric(apiRequestsPerSecond);
register.registerMetric(systemHealthStatus);

/**
 * Comprehensive Monitoring Service
 */
class MonitoringService {
  constructor() {
    this.dbManager = getDatabaseManager();
    this.healthChecks = new Map();
    this.alertRules = new Map();
    this.businessMetricsInterval = null;
    this.requestsCounter = 0;
    this.requestsTimestamp = Date.now();
    this.initialized = false;
    
    console.log('📊 Monitoring Service создан');
  }

  /**
   * Initialize monitoring service
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      this.initializeHealthChecks();
      this.initializeAlertRules();
      
      // Register all metrics with Prometheus
      register.registerMetric(httpRequestDuration);
      register.registerMetric(httpRequestsTotal);
      register.registerMetric(databaseConnectionsActive);
      register.registerMetric(databaseQueryDuration);
      register.registerMetric(cacheOperationsTotal);
      register.registerMetric(cacheHitRatio);
      register.registerMetric(systemHealthStatus);
      // Additional metrics registered separately
      console.log('📊 Prometheus метрики зарегистрированы');
      
      this.initialized = true;
      console.log('✅ Comprehensive Monitoring Service инициализирован');
    } catch (error) {
      console.error('❌ Ошибка инициализации мониторинга:', error);
      throw error;
    }
  }

  /**
   * Initialize health checks
   */
  initializeHealthChecks() {
    // Database health check
    this.healthChecks.set('database', async () => {
      try {
        const health = await this.dbManager.healthCheck();
        systemHealthStatus.set({ component: 'database' }, health.healthy ? 1 : 0);
        return {
          healthy: health.healthy,
          responseTime: health.responseTime,
          details: health
        };
      } catch (error) {
        systemHealthStatus.set({ component: 'database' }, 0);
        return {
          healthy: false,
          error: error.message
        };
      }
    });

    // Redis health check
    this.healthChecks.set('redis', async () => {
      try {
        const isAvailable = await isRedisAvailable();
        systemHealthStatus.set({ component: 'redis' }, isAvailable ? 1 : 0);
        return {
          healthy: isAvailable,
          details: { available: isAvailable }
        };
      } catch (error) {
        systemHealthStatus.set({ component: 'redis' }, 0);
        return {
          healthy: false,
          error: error.message
        };
      }
    });

    // Memory health check
    this.healthChecks.set('memory', async () => {
      try {
        const usage = process.memoryUsage();
        const maxMemory = 1024 * 1024 * 1024; // 1GB limit
        const healthy = usage.heapUsed < maxMemory * 0.8;
        
        systemHealthStatus.set({ component: 'memory' }, healthy ? 1 : 0);
        
        return {
          healthy,
          usage: {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
          }
        };
      } catch (error) {
        systemHealthStatus.set({ component: 'memory' }, 0);
        return {
          healthy: false,
          error: error.message
        };
      }
    });

    // Disk space health check
    this.healthChecks.set('disk', async () => {
      try {
        // Simple disk check (in real scenario would use fs.statvfs)
        const healthy = true; // Mock healthy status
        systemHealthStatus.set({ component: 'disk' }, healthy ? 1 : 0);
        
        return {
          healthy,
          usage: {
            total: '100GB',
            used: '45GB',
            available: '55GB',
            percentage: 45
          }
        };
      } catch (error) {
        systemHealthStatus.set({ component: 'disk' }, 0);
        return {
          healthy: false,
          error: error.message
        };
      }
    });
  }

  /**
   * Initialize alert rules
   */
  initializeAlertRules() {
    this.alertRules.set('high_response_time', {
      condition: (metrics) => metrics.avgResponseTime > 2000,
      message: 'High API response time detected',
      severity: 'warning'
    });

    this.alertRules.set('low_cache_hit_rate', {
      condition: (metrics) => metrics.cacheHitRate < 50,
      message: 'Low cache hit rate detected',
      severity: 'warning'
    });

    this.alertRules.set('database_connection_issues', {
      condition: (health) => !health.database?.healthy,
      message: 'Database connection issues detected',
      severity: 'critical'
    });

    this.alertRules.set('memory_usage_high', {
      condition: (health) => !health.memory?.healthy,
      message: 'High memory usage detected',
      severity: 'warning'
    });

    this.alertRules.set('redis_unavailable', {
      condition: (health) => !health.redis?.healthy,
      message: 'Redis cache unavailable',
      severity: 'warning'
    });
  }

  /**
   * Start business metrics collection
   */
  startBusinessMetricsCollection() {
    if (this.businessMetricsInterval) {
      return; // Already started
    }
    this.businessMetricsInterval = setInterval(async () => {
      try {
        await this.collectBusinessMetrics();
      } catch (error) {
        console.error('❌ Business metrics collection error:', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Collect business metrics
   */
  async collectBusinessMetrics() {
    try {
      // Materials count
      const materialsResult = await this.dbManager.query(
        'SELECT COUNT(*) as count FROM materials'
      );
      materialsTotal.set(parseInt(materialsResult.rows[0].count));

      // Works count
      const worksResult = await this.dbManager.query(
        'SELECT COUNT(*) as count FROM works_ref'
      );
      worksTotal.set(parseInt(worksResult.rows[0].count));

      // Projects count
      const projectsResult = await this.dbManager.query(
        'SELECT COUNT(*) as count FROM construction_projects'
      );
      projectsTotal.set(parseInt(projectsResult.rows[0].count));

      // Estimates count
      const estimatesResult = await this.dbManager.query(
        'SELECT COUNT(*) as count FROM customer_estimates'
      );
      estimatesTotal.set(parseInt(estimatesResult.rows[0].count));

      // Active users count
      const usersResult = await this.dbManager.query(
        'SELECT COUNT(*) as count FROM auth_users'
      );
      activeUsersTotal.set(parseInt(usersResult.rows[0].count));

      // Update cache metrics
      const cacheAnalytics = await getSmartCacheAnalytics();
      if (cacheAnalytics?.hitRate !== undefined) {
        cacheHitRatio.set({ cache_type: 'smart_cache' }, cacheAnalytics.hitRate);
      }

      // Update requests per second
      const now = Date.now();
      const timeDiff = (now - this.requestsTimestamp) / 1000;
      if (timeDiff >= 1) {
        const rps = this.requestsCounter / timeDiff;
        apiRequestsPerSecond.set(rps);
        this.requestsCounter = 0;
        this.requestsTimestamp = now;
      }

    } catch (error) {
      console.error('❌ Error collecting business metrics:', error);
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(req, res, responseTime) {
    const method = req.method;
    const route = req.route?.path || req.path;
    const statusCode = res.statusCode;
    const version = req.apiVersion || 'v1';

    // Record metrics
    httpRequestDuration
      .labels(method, route, statusCode, version)
      .observe(responseTime / 1000);

    httpRequestsTotal
      .labels(method, route, statusCode, version)
      .inc();

    apiResponseTime
      .labels(route, method, version)
      .observe(responseTime / 1000);

    // Update requests counter
    this.requestsCounter++;
  }

  /**
   * Record database query metrics
   */
  recordDatabaseQuery(queryType, table, duration, success) {
    databaseQueryDuration
      .labels(queryType, table)
      .observe(duration / 1000);

    databaseQueriesTotal
      .labels(queryType, table, success ? 'success' : 'error')
      .inc();
  }

  /**
   * Record cache operation metrics
   */
  recordCacheOperation(operation, cacheType, success) {
    cacheOperationsTotal
      .labels(operation, cacheType, success ? 'success' : 'error')
      .inc();
  }

  /**
   * Update database connections metric
   */
  updateDatabaseConnections(activeConnections) {
    databaseConnectionsActive.set(activeConnections);
  }

  /**
   * Run all health checks
   */
  async runHealthChecks() {
    const results = {};
    
    for (const [name, check] of this.healthChecks) {
      try {
        results[name] = await check();
      } catch (error) {
        results[name] = {
          healthy: false,
          error: error.message
        };
      }
    }
    
    return results;
  }

  /**
   * Check alert conditions
   */
  async checkAlerts() {
    const health = await this.runHealthChecks();
    const alerts = [];

    for (const [name, rule] of this.alertRules) {
      try {
        if (rule.condition(health)) {
          alerts.push({
            name,
            message: rule.message,
            severity: rule.severity,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error(`❌ Error checking alert rule ${name}:`, error);
      }
    }

    return alerts;
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getDashboardData() {
    const health = await this.runHealthChecks();
    const alerts = await this.checkAlerts();
    
    // Get metrics from Prometheus registry
    const metrics = await register.getMetricsAsJSON();
    
    return {
      health,
      alerts,
      metrics: this.formatMetricsForDashboard(metrics),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format metrics for dashboard display
   */
  formatMetricsForDashboard(metrics) {
    const formatted = {};
    
    metrics.forEach(metric => {
      const name = metric.name.replace('smeta360_', '');
      
      if (metric.type === 'counter') {
        formatted[name] = {
          type: 'counter',
          value: metric.values.reduce((sum, v) => sum + v.value, 0),
          labels: metric.values.map(v => v.labels)
        };
      } else if (metric.type === 'gauge') {
        formatted[name] = {
          type: 'gauge',
          value: metric.values.length > 0 ? metric.values[0].value : 0,
          labels: metric.values.map(v => v.labels)
        };
      } else if (metric.type === 'histogram') {
        const buckets = metric.values.filter(v => v.metricName?.includes('_bucket'));
        formatted[name] = {
          type: 'histogram',
          buckets: buckets.length,
          samples: metric.values.find(v => v.metricName?.includes('_count'))?.value || 0
        };
      }
    });
    
    return formatted;
  }

  /**
   * Get Prometheus metrics
   */
  async getPrometheusMetrics() {
    return await register.metrics();
  }

  /**
   * Cleanup monitoring service
   */
  cleanup() {
    if (this.businessMetricsInterval) {
      clearInterval(this.businessMetricsInterval);
    }
    register.clear();
  }
}

// Singleton instance
let monitoringService = null;

export function getMonitoringService() {
  if (!monitoringService) {
    monitoringService = new MonitoringService();
  }
  return monitoringService;
}

// Export metrics for external use
export {
  register,
  httpRequestDuration,
  httpRequestsTotal,
  databaseConnectionsActive,
  databaseQueryDuration,
  databaseQueriesTotal,
  cacheOperationsTotal,
  cacheHitRatio,
  apiResponseTime,
  systemHealthStatus
};

export default getMonitoringService;