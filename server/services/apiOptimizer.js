/**
 * API Performance Optimizer
 * Phase 3 Step 2: API Performance Optimization
 * 
 * Автоматическая оптимизация API запросов с компрессией, батчингом и кэшированием
 */
import zlib from 'zlib';
import { promisify } from 'util';
import { getDatabaseManager } from '../database/advancedPool.js';

// Promisify compression functions
const gzip = promisify(zlib.gzip);
const deflate = promisify(zlib.deflate);
const brotliCompress = promisify(zlib.brotliCompress);

class APIOptimizer {
  constructor() {
    this.dbManager = getDatabaseManager();
    this.compressionThreshold = 1024; // 1KB
    this.batchQueue = new Map();
    this.batchTimeout = 50; // 50ms batch window
    this.responseCache = new Map();
    this.cacheTTL = 300000; // 5 minutes
    
    console.log('🚀 API Optimizer инициализирован');
  }

  /**
   * Response Compression Middleware
   * Автоматическое сжатие ответов API
   */
  compressionMiddleware() {
    return async (req, res, next) => {
      const originalSend = res.send;
      const acceptEncoding = req.headers['accept-encoding'] || '';
      
      res.send = async function(body) {
        try {
          let data = body;
          
          // Convert to string if needed
          if (typeof data === 'object') {
            data = JSON.stringify(data);
          }
          
          // Skip compression for small responses
          if (data.length < this.compressionThreshold) {
            return originalSend.call(this, body);
          }
          
          // Choose compression method
          let compressed;
          let encoding;
          
          if (acceptEncoding.includes('br')) {
            compressed = await brotliCompress(data);
            encoding = 'br';
          } else if (acceptEncoding.includes('gzip')) {
            compressed = await gzip(data);
            encoding = 'gzip';
          } else if (acceptEncoding.includes('deflate')) {
            compressed = await deflate(data);
            encoding = 'deflate';
          } else {
            return originalSend.call(this, body);
          }
          
          // Set compression headers
          this.setHeader('Content-Encoding', encoding);
          this.setHeader('Content-Length', compressed.length);
          this.setHeader('Vary', 'Accept-Encoding');
          
          return originalSend.call(this, compressed);
          
        } catch (error) {
          console.error('❌ Compression error:', error);
          return originalSend.call(this, body);
        }
      }.bind(this);
      
      next();
    };
  }

  /**
   * Response Caching Middleware
   * Кэширование API ответов на уровне приложения
   */
  cachingMiddleware() {
    return (req, res, next) => {
      // Only cache GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      const cacheKey = `api_cache:${req.originalUrl}:${JSON.stringify(req.query)}`;
      const cached = this.responseCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp < this.cacheTTL)) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', Math.floor((this.cacheTTL - (Date.now() - cached.timestamp)) / 1000));
        return res.json(cached.data);
      }
      
      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.responseCache.set(cacheKey, {
            data,
            timestamp: Date.now()
          });
        }
        
        res.setHeader('X-Cache', 'MISS');
        return originalJson.call(this, data);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Batch API Processing
   * Объединение множественных запросов в один
   */
  async processBatch(requests) {
    const results = [];
    
    try {
      // Group by endpoint type
      const grouped = this.groupBatchRequests(requests);
      
      // Process each group
      for (const [endpoint, items] of grouped.entries()) {
        try {
          const batchResult = await this.executeBatchQuery(endpoint, items);
          results.push(...batchResult);
        } catch (error) {
          console.error(`❌ Batch error for ${endpoint}:`, error);
          // Add error results
          items.forEach(item => {
            results.push({
              id: item.id,
              error: 'Batch processing failed',
              data: null
            });
          });
        }
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Batch processing error:', error);
      throw error;
    }
  }

  /**
   * Group batch requests by endpoint type
   */
  groupBatchRequests(requests) {
    const grouped = new Map();
    
    requests.forEach(req => {
      const endpoint = this.identifyEndpoint(req.path);
      if (!grouped.has(endpoint)) {
        grouped.set(endpoint, []);
      }
      grouped.get(endpoint).push(req);
    });
    
    return grouped;
  }

  /**
   * Identify endpoint type for batching
   */
  identifyEndpoint(path) {
    if (path.includes('/materials')) return 'materials';
    if (path.includes('/works')) return 'works';
    if (path.includes('/projects')) return 'projects';
    if (path.includes('/estimates')) return 'estimates';
    return 'generic';
  }

  /**
   * Execute batch query for specific endpoint
   */
  async executeBatchQuery(endpoint, requests) {
    switch (endpoint) {
      case 'materials':
        return await this.batchMaterials(requests);
      case 'works':
        return await this.batchWorks(requests);
      case 'projects':
        return await this.batchProjects(requests);
      case 'estimates':
        return await this.batchEstimates(requests);
      default:
        return await this.batchGeneric(requests);
    }
  }

  /**
   * Batch materials requests
   */
  async batchMaterials(requests) {
    const ids = requests.map(req => req.params?.id).filter(Boolean);
    
    if (ids.length === 0) {
      // Get all materials
      const result = await this.dbManager.query(
        'SELECT * FROM materials ORDER BY name LIMIT 100',
        [],
        { useCache: true, cacheTTL: 300 }
      );
      
      return requests.map(req => ({
        id: req.id,
        data: result.rows,
        error: null
      }));
    }
    
    // Get specific materials
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.dbManager.query(
      `SELECT * FROM materials WHERE id IN (${placeholders}) ORDER BY name`,
      ids,
      { useCache: true, cacheTTL: 300 }
    );
    
    return requests.map(req => ({
      id: req.id,
      data: result.rows.filter(row => row.id === req.params?.id) || result.rows,
      error: null
    }));
  }

  /**
   * Batch works requests
   */
  async batchWorks(requests) {
    const ids = requests.map(req => req.params?.id).filter(Boolean);
    
    if (ids.length === 0) {
      const result = await this.dbManager.query(
        'SELECT * FROM works ORDER BY name LIMIT 100',
        [],
        { useCache: true, cacheTTL: 300 }
      );
      
      return requests.map(req => ({
        id: req.id,
        data: result.rows,
        error: null
      }));
    }
    
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.dbManager.query(
      `SELECT * FROM works WHERE id IN (${placeholders}) ORDER BY name`,
      ids,
      { useCache: true, cacheTTL: 300 }
    );
    
    return requests.map(req => ({
      id: req.id,
      data: result.rows.filter(row => row.id === req.params?.id) || result.rows,
      error: null
    }));
  }

  /**
   * Batch projects requests
   */
  async batchProjects(requests) {
    const userIds = [...new Set(requests.map(req => req.user?.id).filter(Boolean))];
    
    if (userIds.length === 0) {
      return requests.map(req => ({
        id: req.id,
        data: [],
        error: 'User ID required'
      }));
    }
    
    const placeholders = userIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.dbManager.query(
      `SELECT * FROM projects WHERE user_id IN (${placeholders}) ORDER BY created_at DESC`,
      userIds,
      { useCache: true, cacheTTL: 120 }
    );
    
    return requests.map(req => ({
      id: req.id,
      data: result.rows.filter(row => row.user_id === req.user?.id) || [],
      error: null
    }));
  }

  /**
   * Batch estimates requests
   */
  async batchEstimates(requests) {
    const tenantIds = [...new Set(requests.map(req => req.user?.tenantId).filter(Boolean))];
    
    if (tenantIds.length === 0) {
      return requests.map(req => ({
        id: req.id,
        data: [],
        error: 'Tenant ID required'
      }));
    }
    
    const placeholders = tenantIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await this.dbManager.query(
      `SELECT * FROM customer_estimates WHERE tenant_id IN (${placeholders}) ORDER BY created_at DESC LIMIT 100`,
      tenantIds,
      { useCache: true, cacheTTL: 180 }
    );
    
    return requests.map(req => ({
      id: req.id,
      data: result.rows.filter(row => row.tenant_id === req.user?.tenantId) || [],
      error: null
    }));
  }

  /**
   * Batch generic requests
   */
  async batchGeneric(requests) {
    return requests.map(req => ({
      id: req.id,
      data: null,
      error: 'Endpoint not supported for batching'
    }));
  }

  /**
   * API versioning support
   */
  versioningMiddleware() {
    return (req, res, next) => {
      // Extract version from header or URL
      const version = req.headers['api-version'] || 
                     req.query.version || 
                     this.extractVersionFromUrl(req.originalUrl) || 
                     'v1';
      
      req.apiVersion = version;
      res.setHeader('API-Version', version);
      
      // Add version-specific handling
      if (version === 'v2') {
        req.isV2 = true;
      } else if (version === 'v1') {
        req.isV1 = true;
      }
      
      next();
    };
  }

  /**
   * Extract version from URL path
   */
  extractVersionFromUrl(url) {
    const versionMatch = url.match(/\/api\/v(\d+)\//);
    return versionMatch ? `v${versionMatch[1]}` : null;
  }

  /**
   * Performance metrics collection
   */
  metricsMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;
        
        // Log performance metrics
        this.collectMetrics({
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode,
          duration,
          compressed: res.getHeader('Content-Encoding') ? true : false,
          cached: res.getHeader('X-Cache') === 'HIT',
          version: req.apiVersion
        });
        
        return originalEnd.apply(this, args);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Collect performance metrics
   */
  collectMetrics(data) {
    try {
      // Log to console for now (could be sent to monitoring system)
      console.log(`📊 API Metrics: ${data.method} ${data.path} - ${data.statusCode} - ${data.duration}ms - ${data.cached ? 'CACHED' : 'FRESH'} - ${data.compressed ? 'COMPRESSED' : 'RAW'}`);
      
      // Store in memory for dashboard (could be Redis/database)
      const key = `${data.method}:${data.path}`;
      if (!this.metricsData) {
        this.metricsData = new Map();
      }
      
      if (!this.metricsData.has(key)) {
        this.metricsData.set(key, {
          method: data.method,
          path: data.path,
          count: 0,
          totalDuration: 0,
          avgDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          cacheHits: 0,
          compressionUse: 0,
          statusCodes: {}
        });
      }
      
      const metrics = this.metricsData.get(key);
      metrics.count++;
      metrics.totalDuration += data.duration;
      metrics.avgDuration = Math.round(metrics.totalDuration / metrics.count);
      metrics.minDuration = Math.min(metrics.minDuration, data.duration);
      metrics.maxDuration = Math.max(metrics.maxDuration, data.duration);
      
      if (data.cached) metrics.cacheHits++;
      if (data.compressed) metrics.compressionUse++;
      
      metrics.statusCodes[data.statusCode] = (metrics.statusCodes[data.statusCode] || 0) + 1;
      
    } catch (error) {
      console.error('❌ Metrics collection error:', error);
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    if (!this.metricsData) {
      return { endpoints: [], summary: {} };
    }
    
    const endpoints = Array.from(this.metricsData.values());
    const summary = {
      totalRequests: endpoints.reduce((sum, e) => sum + e.count, 0),
      avgResponseTime: Math.round(endpoints.reduce((sum, e) => sum + e.avgDuration, 0) / endpoints.length),
      cacheHitRate: Math.round((endpoints.reduce((sum, e) => sum + e.cacheHits, 0) / endpoints.reduce((sum, e) => sum + e.count, 0)) * 100),
      compressionRate: Math.round((endpoints.reduce((sum, e) => sum + e.compressionUse, 0) / endpoints.reduce((sum, e) => sum + e.count, 0)) * 100),
      endpointsCount: endpoints.length
    };
    
    return { endpoints, summary };
  }

  /**
   * Clear performance cache
   */
  clearCache() {
    this.responseCache.clear();
    console.log('🧹 API response cache cleared');
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, value] of this.responseCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        this.responseCache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
  }
}

// Singleton instance
let apiOptimizer = null;

export function getAPIOptimizer() {
  if (!apiOptimizer) {
    apiOptimizer = new APIOptimizer();
    
    // Setup cleanup interval
    setInterval(() => {
      try {
        apiOptimizer.cleanupCache();
      } catch (error) {
        console.error('❌ Cache cleanup error:', error);
      }
    }, 60000); // Cleanup every minute
  }
  
  return apiOptimizer;
}

export default getAPIOptimizer;