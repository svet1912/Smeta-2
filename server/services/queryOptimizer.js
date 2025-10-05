/**
 * Query Optimizer Service
 * Сервис для оптимизации запросов к базе данных
 */
import { query } from '../database.js';

class QueryOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.cacheStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  /**
   * Оптимизированный запрос с кэшированием
   */
  async optimizedQuery(sql, params = [], options = {}) {
    const {
      cacheKey,
      cacheTTL = 300000, // 5 минут по умолчанию
      skipCache = false,
      explain = false
    } = options;

    // Если включено объяснение плана запроса
    if (explain && process.env.NODE_ENV === 'development') {
      try {
        const explainResult = await query(`EXPLAIN ANALYZE ${sql}`, params);
        console.log('🔍 План выполнения запроса:', explainResult.rows);
      } catch (error) {
        console.warn('⚠️ Не удалось получить план запроса:', error.message);
      }
    }

    // Проверяем кэш если указан ключ и кэш не отключен
    if (cacheKey && !skipCache) {
      const cached = this.queryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        this.cacheStats.hits++;
        console.log(`📦 Кэш-хит для ключа: ${cacheKey}`);
        return cached.result;
      }
      this.cacheStats.misses++;
    }

    const startTime = Date.now();
    const result = await query(sql, params);
    const duration = Date.now() - startTime;

    // Логируем медленные запросы
    if (duration > 1000) {
      console.warn(`🐌 МЕДЛЕННЫЙ ЗАПРОС (${duration}ms):`, {
        sql: sql.substring(0, 100) + '...',
        params: params.length,
        rows: result.rowCount
      });
    }

    // Сохраняем в кэш если указан ключ
    if (cacheKey && !skipCache) {
      this.queryCache.set(cacheKey, {
        result,
        timestamp: Date.now()
      });

      // Очищаем старые записи из кэша
      this.cleanupCache();
    }

    return result;
  }

  /**
   * Оптимизированная загрузка материалов с пагинацией
   */
  async getMaterialsOptimized(filters = {}, pagination = {}) {
    const { search = '', category = '', limit = 50, offset = 0 } = { ...filters, ...pagination };

    const cacheKey = `materials_${search}_${category}_${limit}_${offset}`;

    let sql = `
      SELECT 
        id, name, unit, unit_price, expenditure, weight, image_url, item_url,
        created_at, updated_at
      FROM materials 
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    // Добавляем условия поиска
    if (search) {
      sql += ` AND name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    // Добавляем сортировку и пагинацию
    sql += ` ORDER BY name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return this.optimizedQuery(sql, params, {
      cacheKey,
      cacheTTL: 600000 // 10 минут для материалов
    });
  }

  /**
   * Оптимизированная загрузка работ с пагинацией
   */
  async getWorksOptimized(filters = {}, pagination = {}) {
    const { search = '', limit = 50, offset = 0 } = { ...filters, ...pagination };

    const cacheKey = `works_${search}_${limit}_${offset}`;

    let sql = `
      SELECT 
        w.id, 
        w.name, 
        w.unit, 
        w.unit_price, 
        w.sort_order,
        w.phase_id,
        w.stage_id,
        w.substage_id,
        w.created_at, 
        w.updated_at,
        p.name as phase_name,
        s.name as stage_name,
        st.name as substage_name
      FROM works_ref w
      LEFT JOIN phases p ON w.phase_id = p.id
      LEFT JOIN stages s ON w.stage_id = s.id
      LEFT JOIN substages st ON w.substage_id = st.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND w.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY w.sort_order, w.name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    return this.optimizedQuery(sql, params, {
      cacheKey,
      cacheTTL: 600000 // 10 минут для работ
    });
  }

  /**
   * Оптимизированная загрузка смет с предварительной загрузкой элементов
   */
  async getCustomerEstimatesOptimized(userId, tenantId, pagination = {}) {
    const { limit = 20, offset = 0, includeItems = true } = pagination;

    const cacheKey = `estimates_${userId}_${tenantId}_${limit}_${offset}_${includeItems}`;

    let sql = `
      SELECT 
        ce.id, ce.name, ce.description, ce.status, ce.total_cost, ce.currency,
        ce.created_at, ce.updated_at,
        COUNT(cei.id) as items_count
      FROM customer_estimates ce
      LEFT JOIN customer_estimate_items cei ON ce.id = cei.estimate_id
      WHERE ce.user_id = $1 AND ce.tenant_id = $2
      GROUP BY ce.id, ce.name, ce.description, ce.status, ce.total_cost, ce.currency, ce.created_at, ce.updated_at
      ORDER BY ce.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const result = await this.optimizedQuery(sql, [userId, tenantId, limit, offset], {
      cacheKey,
      cacheTTL: 300000 // 5 минут для смет
    });

    // Если нужно загрузить элементы смет
    if (includeItems && result.rows.length > 0) {
      const estimateIds = result.rows.map((row) => row.id);
      const itemsSql = `
        SELECT 
          cei.*,
          CASE 
            WHEN cei.item_type = 'work' THEN w.name
            WHEN cei.item_type = 'material' THEN m.name
            ELSE cei.name
          END as reference_name
        FROM customer_estimate_items cei
        LEFT JOIN works_ref w ON cei.item_type = 'work' AND cei.reference_id = w.id
        LEFT JOIN materials m ON cei.item_type = 'material' AND cei.reference_id = m.id
        WHERE cei.estimate_id = ANY($1)
        ORDER BY cei.sort_order, cei.created_at
      `;

      const itemsResult = await this.optimizedQuery(itemsSql, [estimateIds], {
        cacheKey: `estimate_items_${estimateIds.join('_')}`,
        cacheTTL: 300000
      });

      // Группируем элементы по сметам
      const itemsByEstimate = itemsResult.rows.reduce((acc, item) => {
        if (!acc[item.estimate_id]) {
          acc[item.estimate_id] = [];
        }
        acc[item.estimate_id].push(item);
        return acc;
      }, {});

      // Добавляем элементы к сметам
      result.rows.forEach((estimate) => {
        estimate.items = itemsByEstimate[estimate.id] || [];
      });
    }

    return result;
  }

  /**
   * Оптимизированная загрузка статистики лидов
   */
  async getLeadsStatsOptimized() {
    const cacheKey = 'leads_stats';

    const sql = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as week,
        COUNT(DISTINCT email) as unique_emails,
        COUNT(*) FILTER (WHERE env_name = 'production') as production,
        COUNT(*) FILTER (WHERE env_name != 'production') as preview
      FROM leads
    `;

    return this.optimizedQuery(sql, [], {
      cacheKey,
      cacheTTL: 60000 // 1 минута для статистики
    });
  }

  /**
   * Очистка устаревших записей из кэша
   */
  cleanupCache() {
    const now = Date.now();
    const maxAge = 600000; // 10 минут

    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.queryCache.delete(key);
        this.cacheStats.evictions++;
      }
    }
  }

  /**
   * Получение статистики кэша
   */
  getCacheStats() {
    return {
      ...this.cacheStats,
      size: this.queryCache.size,
      hitRate: (this.cacheStats.hits / (this.cacheStats.hits + this.cacheStats.misses)) * 100
    };
  }

  /**
   * Очистка всего кэша
   */
  clearCache() {
    this.queryCache.clear();
    this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
    console.log('🧹 Кэш запросов очищен');
  }
}

export default new QueryOptimizer();
