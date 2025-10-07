/**
 * Monitoring Middleware
 * Phase 3 Step 3: Comprehensive Monitoring
 * 
 * Middleware для автоматического сбора метрик запросов и производительности
 */
import { getMonitoringService } from '../services/monitoringService.js';

const monitoringService = getMonitoringService();

/**
 * Request Monitoring Middleware
 * Собирает метрики для каждого HTTP запроса
 */
export function requestMonitoringMiddleware() {
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to capture response time
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      
      try {
        // Record HTTP request metrics
        monitoringService.recordHttpRequest(req, res, responseTime);
        
        // Log slow requests
        if (responseTime > 2000) {
          console.warn(`🐌 Slow request detected: ${req.method} ${req.path} - ${responseTime}ms`);
        }
        
      } catch (error) {
        console.error('❌ Error recording request metrics:', error);
      }
      
      return originalEnd.apply(this, args);
    };
    
    next();
  };
}

/**
 * Database Query Monitoring Middleware
 * Оборачивает database queries для сбора метрик
 */
export function wrapDatabaseQuery(originalQuery) {
  return async function(queryText, params = [], options = {}) {
    const startTime = Date.now();
    const queryType = this.getQueryType(queryText);
    const table = this.extractTableName(queryText);
    
    try {
      const result = await originalQuery.call(this, queryText, params, options);
      const duration = Date.now() - startTime;
      
      // Record successful query metrics
      monitoringService.recordDatabaseQuery(queryType, table, duration, true);
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`🐌 Slow query detected: ${queryType} on ${table} - ${duration}ms`);
      }
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Record failed query metrics
      monitoringService.recordDatabaseQuery(queryType, table, duration, false);
      
      throw error;
    }
  };
}

/**
 * Cache Operation Monitoring
 * Оборачивает cache operations для сбора метрик
 */
export function wrapCacheOperation(originalOperation, operationType, cacheType) {
  return async function(...args) {
    try {
      const result = await originalOperation.apply(this, args);
      
      // Record successful cache operation
      monitoringService.recordCacheOperation(operationType, cacheType, true);
      
      return result;
      
    } catch (error) {
      // Record failed cache operation
      monitoringService.recordCacheOperation(operationType, cacheType, false);
      
      throw error;
    }
  };
}

/**
 * Error Monitoring Middleware
 * Отслеживает и записывает ошибки системы
 */
export function errorMonitoringMiddleware() {
  return (err, req, res, next) => {
    try {
      // Log error details
      console.error('❌ Application Error:', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      
      // Here you could send error to external monitoring service
      // like Sentry, DataDog, etc.
      
    } catch (monitoringError) {
      console.error('❌ Error in error monitoring:', monitoringError);
    }
    
    next(err);
  };
}

/**
 * Health Check Middleware
 * Проверяет здоровье системы на каждом запросе
 */
export function healthCheckMiddleware() {
  return async (req, res, next) => {
    // Skip health checks for monitoring endpoints to avoid recursion
    if (req.path.startsWith('/api/monitoring')) {
      return next();
    }
    
    try {
      // Periodic health check (every 100 requests)
      if (Math.random() < 0.01) {
        const health = await monitoringService.runHealthChecks();
        
        // Check for critical issues
        const criticalIssues = Object.entries(health)
          .filter(([, check]) => !check.healthy)
          .filter(([name]) => ['database', 'memory'].includes(name));
        
        if (criticalIssues.length > 0) {
          console.warn('⚠️ Critical health issues detected:', criticalIssues.map(([name]) => name));
        }
      }
      
    } catch (error) {
      console.error('❌ Health check middleware error:', error);
    }
    
    next();
  };
}

/**
 * Business Metrics Middleware
 * Собирает бизнес-метрики на основе активности пользователей
 */
export function businessMetricsMiddleware() {
  return (req, res, next) => {
    try {
      // Track user activity patterns
      if (req.user) {
        // Log user activity for analytics
        const activity = {
          userId: req.user.id,
          tenantId: req.user.tenantId,
          endpoint: req.path,
          method: req.method,
          timestamp: new Date().toISOString()
        };
        
        // Here you could store user activity for business analytics
        // For now, just increment user activity counter
        
      }
      
      // Track API usage patterns
      const isAPICall = req.path.startsWith('/api/');
      if (isAPICall) {
        // Track API endpoint usage for product analytics
      }
      
    } catch (error) {
      console.error('❌ Business metrics middleware error:', error);
    }
    
    next();
  };
}

/**
 * Security Monitoring Middleware
 * Отслеживает подозрительную активность и угрозы безопасности
 */
export function securityMonitoringMiddleware() {
  const suspiciousPatterns = [
    /sql.*injection/i,
    /script.*alert/i,
    /\.\.\/.*\.\.\//, // Path traversal
    /<script.*>.*<\/script>/i,
    /union.*select/i
  ];
  
  return (req, res, next) => {
    try {
      const requestData = JSON.stringify({
        url: req.originalUrl,
        body: req.body,
        query: req.query,
        headers: req.headers
      });
      
      // Check for suspicious patterns
      const suspicious = suspiciousPatterns.some(pattern => pattern.test(requestData));
      
      if (suspicious) {
        console.warn('🚨 Suspicious request detected:', {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          url: req.originalUrl,
          method: req.method,
          timestamp: new Date().toISOString()
        });
        
        // Here you could implement rate limiting, blocking, or alerting
      }
      
      // Check for brute force attempts (too many failed auth requests)
      if (req.path.includes('/auth/login') && req.method === 'POST') {
        // Track failed login attempts by IP
        // Implementation would depend on your session/cache store
      }
      
    } catch (error) {
      console.error('❌ Security monitoring error:', error);
    }
    
    next();
  };
}

/**
 * Performance Monitoring Middleware
 * Отслеживает производительность системы в реальном времени
 */
export function performanceMonitoringMiddleware() {
  let requestCount = 0;
  let totalResponseTime = 0;
  
  return (req, res, next) => {
    const startTime = Date.now();
    
    // Override res.end to capture performance metrics
    const originalEnd = res.end;
    res.end = function(...args) {
      const responseTime = Date.now() - startTime;
      
      try {
        requestCount++;
        totalResponseTime += responseTime;
        
        // Calculate moving averages
        const avgResponseTime = totalResponseTime / requestCount;
        
        // Reset counters every 1000 requests to prevent memory growth
        if (requestCount >= 1000) {
          requestCount = 0;
          totalResponseTime = 0;
        }
        
        // Check performance thresholds
        if (responseTime > 5000) {
          console.warn(`🐌 Very slow request: ${req.method} ${req.path} - ${responseTime}ms`);
        }
        
        if (avgResponseTime > 1000) {
          console.warn(`📊 High average response time: ${avgResponseTime.toFixed(2)}ms`);
        }
        
      } catch (error) {
        console.error('❌ Performance monitoring error:', error);
      }
      
      return originalEnd.apply(this, args);
    };
    
    next();
  };
}

// Helper functions for database query monitoring
const queryTypePatterns = {
  SELECT: /^\s*SELECT/i,
  INSERT: /^\s*INSERT/i,
  UPDATE: /^\s*UPDATE/i,
  DELETE: /^\s*DELETE/i,
  CREATE: /^\s*CREATE/i,
  DROP: /^\s*DROP/i,
  ALTER: /^\s*ALTER/i
};

function getQueryType(queryText) {
  for (const [type, pattern] of Object.entries(queryTypePatterns)) {
    if (pattern.test(queryText)) {
      return type;
    }
  }
  return 'OTHER';
}

function extractTableName(queryText) {
  // Simple table name extraction
  const matches = queryText.match(/(?:FROM|INTO|UPDATE|TABLE)\s+(\w+)/i);
  return matches ? matches[1] : 'unknown';
}

export {
  getQueryType,
  extractTableName
};