// Query Optimizer - Phase 3 Step 1
import { getDatabaseManager } from './advancedPool.js';

/**
 * Query Optimizer для оптимизации database запросов
 */
export class QueryOptimizer {
  constructor() {
    this.queryCache = new Map();
    this.analyzedQueries = new Map();
    this.optimizationRules = new Map();
    
    this.setupOptimizationRules();
  }

  /**
   * Настройка правил оптимизации
   */
  setupOptimizationRules() {
    // Правило для SELECT запросов с тенантами
    this.optimizationRules.set('tenant_isolation', {
      pattern: /SELECT.*FROM\s+(\w+).*WHERE/i,
      optimize: (query, params, context) => {
        if (context?.tenantId && !query.includes('tenant_id')) {
          console.log('🔧 Applying tenant isolation optimization');
          // Добавляем tenant_id фильтр если его нет
          const whereIndex = query.toLowerCase().indexOf('where');
          if (whereIndex !== -1) {
            const beforeWhere = query.substring(0, whereIndex + 5);
            const afterWhere = query.substring(whereIndex + 5);
            return {
              query: `${beforeWhere} tenant_id = $${params.length + 1} AND ${afterWhere}`,
              params: [...params, context.tenantId]
            };
          }
        }
        return { query, params };
      }
    });

    // Правило для LIMIT оптимизации
    this.optimizationRules.set('limit_optimization', {
      pattern: /SELECT.*FROM.*ORDER BY.*$/i,
      optimize: (query, params) => {
        if (!query.toLowerCase().includes('limit')) {
          console.log('🔧 Adding default LIMIT for performance');
          return {
            query: query + ' LIMIT 1000',
            params
          };
        }
        return { query, params };
      }
    });

    // Правило для индексированных поиском
    this.optimizationRules.set('index_hint', {
      pattern: /WHERE.*LIKE.*%.*%/i,
      optimize: (query, params) => {
        console.log('⚠️ Full-text search detected, consider using text search indexes');
        return { query, params };
      }
    });
  }

  /**
   * Оптимизация запроса
   */
  optimizeQuery(originalQuery, originalParams = [], context = {}) {
    let { query, params } = { query: originalQuery, params: originalParams };

    // Применяем правила оптимизации
    for (const [, rule] of this.optimizationRules) {
      if (rule.pattern.test(query)) {
        const optimized = rule.optimize(query, params, context);
        query = optimized.query;
        params = optimized.params;
      }
    }

    // Кэшируем оптимизированный запрос
    const cacheKey = this.generateCacheKey(originalQuery, originalParams);
    this.queryCache.set(cacheKey, { query, params, optimizedAt: Date.now() });

    return { query, params };
  }

  /**
   * Анализ производительности запроса
   */
  async analyzeQuery(query, params = []) {
    const dbManager = getDatabaseManager();
    
    try {
      // Получаем план выполнения
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      const result = await dbManager.query(explainQuery, params);
      
      const plan = result.rows[0]['QUERY PLAN'][0];
      
      const analysis = {
        totalCost: plan['Total Cost'],
        actualTime: plan['Actual Total Time'],
        planRows: plan['Plan Rows'],
        actualRows: plan['Actual Rows'],
        node: plan['Node Type'],
        sharedHitBlocks: plan['Shared Hit Blocks'] || 0,
        sharedReadBlocks: plan['Shared Read Blocks'] || 0,
        recommendations: this.generateRecommendations(plan),
        analyzedAt: new Date().toISOString()
      };

      // Сохраняем анализ
      const analysisKey = this.generateCacheKey(query, params);
      this.analyzedQueries.set(analysisKey, analysis);

      return analysis;
    } catch (error) {
      console.error('❌ Query analysis failed:', error.message);
      return {
        error: error.message,
        analyzedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Генерация рекомендаций по оптимизации
   */
  generateRecommendations(plan) {
    const recommendations = [];

    // Проверка на Seq Scan
    if (plan['Node Type'] === 'Seq Scan') {
      recommendations.push({
        type: 'index',
        priority: 'high',
        message: 'Рассмотрите создание индекса для избежания последовательного сканирования',
        suggestion: `CREATE INDEX ON ${plan['Relation Name']} (column_name);`
      });
    }

    // Проверка на высокую стоимость
    if (plan['Total Cost'] > 1000) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Запрос имеет высокую стоимость выполнения',
        suggestion: 'Рассмотрите добавление WHERE условий или индексов'
      });
    }

    // Проверка на большое количество строк
    if (plan['Actual Rows'] > 10000) {
      recommendations.push({
        type: 'pagination',
        priority: 'medium',
        message: 'Запрос возвращает много строк',
        suggestion: 'Добавьте LIMIT и пагинацию'
      });
    }

    // Проверка на cache misses
    const totalBlocks = (plan['Shared Hit Blocks'] || 0) + (plan['Shared Read Blocks'] || 0);
    const hitRatio = totalBlocks > 0 ? (plan['Shared Hit Blocks'] || 0) / totalBlocks : 1;
    
    if (hitRatio < 0.9 && totalBlocks > 100) {
      recommendations.push({
        type: 'cache',
        priority: 'low',
        message: 'Низкий hit ratio в buffer cache',
        suggestion: 'Рассмотрите увеличение shared_buffers или оптимизацию запроса'
      });
    }

    return recommendations;
  }

  /**
   * Построение оптимизированного JOIN запроса
   */
  optimizeJoinQuery(tables, conditions, context = {}) {
    const { tenantId, limit = 1000 } = context;

    // Базовая структура JOIN
    let query = `SELECT `;
    const selectFields = [];
    const joins = [];
    const whereConditions = [];
    const params = [];

    // Добавляем поля из всех таблиц
    tables.forEach((table, index) => {
      const alias = `t${index}`;
      table.fields?.forEach((field) => {
        selectFields.push(`${alias}.${field} as ${table.name}_${field}`);
      });
    });

    query += selectFields.join(', ');
    query += ` FROM ${tables[0].name} t0`;

    // Добавляем JOINs
    for (let i = 1; i < tables.length; i++) {
      const table = tables[i];
      const alias = `t${i}`;
      
      // Определяем тип JOIN
      const joinType = table.required ? 'INNER JOIN' : 'LEFT JOIN';
      joins.push(`${joinType} ${table.name} ${alias} ON ${table.joinCondition}`);
    }

    query += ' ' + joins.join(' ');

    // Добавляем WHERE условия
    if (tenantId) {
      // Добавляем tenant_id для каждой таблицы
      tables.forEach((table, index) => {
        if (table.hasTenant !== false) {
          whereConditions.push(`t${index}.tenant_id = $${params.length + 1}`);
          params.push(tenantId);
        }
      });
    }

    // Добавляем пользовательские условия
    conditions?.forEach((condition) => {
      whereConditions.push(condition.clause);
      if (condition.params) {
        params.push(...condition.params);
      }
    });

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Добавляем LIMIT для производительности
    query += ` LIMIT ${limit}`;

    return { query, params };
  }

  /**
   * Batch запросы для множественных операций
   */
  async executeBatch(queries) {
    const dbManager = getDatabaseManager();
    const results = [];

    // Группируем SELECT запросы для параллельного выполнения
    const selectQueries = queries.filter(q => q.query.toLowerCase().trim().startsWith('select'));
    const otherQueries = queries.filter(q => !q.query.toLowerCase().trim().startsWith('select'));

    try {
      // Выполняем SELECT запросы параллельно
      if (selectQueries.length > 0) {
        const selectPromises = selectQueries.map(({ query, params, options }) => 
          dbManager.query(query, params, options)
        );
        const selectResults = await Promise.all(selectPromises);
        results.push(...selectResults);
      }

      // Выполняем модифицирующие запросы последовательно в транзакции
      if (otherQueries.length > 0) {
        const transactionResult = await dbManager.transaction(async (client) => {
          const txResults = [];
          for (const { query, params } of otherQueries) {
            const result = await client.query(query, params);
            txResults.push(result);
          }
          return txResults;
        });
        results.push(...transactionResult);
      }

      return results;
    } catch (error) {
      console.error('❌ Batch execution failed:', error.message);
      throw error;
    }
  }

  /**
   * Генерация ключа для кэширования
   */
  generateCacheKey(query, params) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramsKey = params ? JSON.stringify(params) : '';
    return `${normalizedQuery}:${paramsKey}`;
  }

  /**
   * Получение статистики оптимизатора
   */
  getOptimizerStats() {
    const now = Date.now();
    const recentAnalyses = Array.from(this.analyzedQueries.values())
      .filter(analysis => now - new Date(analysis.analyzedAt).getTime() < 24 * 60 * 60 * 1000);

    return {
      cachedQueries: this.queryCache.size,
      analyzedQueries: this.analyzedQueries.size,
      recentAnalyses: recentAnalyses.length,
      optimizationRules: this.optimizationRules.size,
      averageCost: recentAnalyses.length > 0 
        ? recentAnalyses.reduce((sum, a) => sum + (a.totalCost || 0), 0) / recentAnalyses.length
        : 0,
      slowQueries: recentAnalyses.filter(a => (a.actualTime || 0) > 1000).length
    };
  }

  /**
   * Очистка кэша
   */
  clearCache() {
    this.queryCache.clear();
    this.analyzedQueries.clear();
    console.log('✅ Query optimizer cache cleared');
  }
}

// Глобальный экземпляр оптимизатора
const queryOptimizer = new QueryOptimizer();

export default queryOptimizer;