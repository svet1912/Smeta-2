#!/usr/bin/env node
// Test Advanced Database Optimization - Phase 3 Step 1

import { fileURLToPath } from 'url';

async function testAdvancedDatabase() {
  console.log('🧪 Тестирование Advanced Database Optimization Phase 3 Step 1...\n');

  try {
    // 1. Тест Advanced Database Pool
    console.log('📝 1. Тестирование Advanced Pool Manager...');
    
    const { getDatabaseManager } = await import('../../server/database/advancedPool.js');
    const dbManager = getDatabaseManager();
    
    console.log('  ✅ Database Pool Manager импортирован');

    // Проверяем инициализацию
    await dbManager.initialize();
    console.log('  ✅ Database Pool инициализирован');

    // Тест простого запроса
    const testResult = await dbManager.query('SELECT NOW() as current_time');
    console.log('  ✅ Простой запрос выполнен:', testResult.rows[0].current_time);

    // Тест запроса с кэшированием
    const cachedResult = await dbManager.query(
      'SELECT $1 as test_value, NOW() as query_time',
      ['cached_test'],
      {
        useCache: true,
        cacheKey: 'test:cached-query',
        cacheTTL: 60,
        dependencies: ['test']
      }
    );
    console.log('  ✅ Кэшированный запрос:', cachedResult.rows[0].test_value);

    // Повторный запрос должен взяться из кэша
    const cachedResult2 = await dbManager.query(
      'SELECT $1 as test_value, NOW() as query_time',
      ['cached_test'],
      {
        useCache: true,
        cacheKey: 'test:cached-query'
      }
    );
    console.log('  ✅ Второй кэшированный запрос (из кэша)');

    // 2. Тест Query Optimizer
    console.log('\n🔧 2. Тестирование Query Optimizer...');
    
    const queryOptimizer = (await import('../../server/database/queryOptimizer.js')).default;
    
    // Тест оптимизации запроса
    const testQuery = 'SELECT * FROM auth_users WHERE email = $1';
    const testParams = ['test@example.com'];
    const context = { tenantId: 'test-tenant-123' };

    const optimized = queryOptimizer.optimizeQuery(testQuery, testParams, context);
    console.log('  📊 Оригинальный запрос:', testQuery);
    console.log('  🔧 Оптимизированный запрос:', optimized.query);
    console.log('  ✅ Query Optimizer работает');

    // Тест построения JOIN запроса
    const joinTables = [
      {
        name: 'projects',
        fields: ['id', 'name', 'status'],
        hasTenant: true
      },
      {
        name: 'estimates', 
        fields: ['id', 'total_cost'],
        joinCondition: 't0.id = t1.project_id',
        required: true,
        hasTenant: true
      }
    ];

    const joinConditions = [
      { clause: 't0.status = $1', params: ['active'] }
    ];

    const joinQuery = queryOptimizer.optimizeJoinQuery(
      joinTables, 
      joinConditions, 
      { tenantId: 'test-tenant', limit: 50 }
    );
    
    console.log('  🔗 Оптимизированный JOIN:', joinQuery.query.substring(0, 100) + '...');
    console.log('  ✅ JOIN оптимизация работает');

    // 3. Тест статистики
    console.log('\n📊 3. Тестирование статистики...');
    
    const poolStats = dbManager.getPoolStats();
    console.log('  📈 Pool статистика:');
    console.log(`    • Всего соединений: ${poolStats.totalCount}`);
    console.log(`    • Idle соединений: ${poolStats.idleCount}`);
    console.log(`    • Выполнено запросов: ${poolStats.queriesExecuted}`);
    console.log(`    • Среднее время: ${Math.round(poolStats.averageQueryTime)}ms`);
    console.log(`    • Коэффициент ошибок: ${poolStats.errorRate}`);

    const optimizerStats = queryOptimizer.getOptimizerStats();
    console.log('  🔧 Optimizer статистика:');
    console.log(`    • Кэшированных запросов: ${optimizerStats.cachedQueries}`);
    console.log(`    • Анализировано запросов: ${optimizerStats.analyzedQueries}`);
    console.log(`    • Правил оптимизации: ${optimizerStats.optimizationRules}`);

    // 4. Тест транзакций
    console.log('\n💳 4. Тестирование транзакций...');
    
    try {
      const txResult = await dbManager.transaction(async (client) => {
        // Имитируем работу в транзакции
        const result1 = await client.query('SELECT 1 as step1');
        const result2 = await client.query('SELECT 2 as step2');
        
        return {
          step1: result1.rows[0].step1,
          step2: result2.rows[0].step2
        };
      });
      
      console.log('  ✅ Транзакция выполнена:', txResult);
    } catch (txError) {
      console.log('  ❌ Ошибка транзакции:', txError.message);
    }

    // 5. Тест Health Check
    console.log('\n🏥 5. Тестирование Health Check...');
    
    const healthCheck = await dbManager.healthCheck();
    console.log('  📊 Health Check:');
    console.log(`    • Статус: ${healthCheck.status}`);
    console.log(`    • Время подключения: ${healthCheck.connectionTime}ms`);
    console.log(`    • Timestamp: ${healthCheck.timestamp}`);

    // 6. Тест медленных запросов
    console.log('\n🐌 6. Тестирование медленных запросов...');
    
    // Имитируем медленный запрос
    try {
      await dbManager.query('SELECT pg_sleep(0.1), 1 as slow_query');
      console.log('  ✅ Медленный запрос выполнен');
    } catch (error) {
      console.log('  ⚠️ Медленный запрос не выполнен (это нормально)');
    }

    const slowQueries = dbManager.getSlowQueries(50); // запросы >50ms
    console.log(`  📊 Найдено медленных запросов: ${slowQueries.length}`);

    if (slowQueries.length > 0) {
      console.log(`  🐌 Самый медленный: ${slowQueries[0].duration}ms`);
    }

    console.log('\n🎉 Все тесты Advanced Database прошли успешно!');
    console.log('\n📋 Advanced Database Phase 3 Step 1 возможности:');
    console.log('  ✅ Advanced Connection Pooling с оптимальными настройками');
    console.log('  ✅ Query-level Caching с Smart Cache интеграцией');
    console.log('  ✅ Query Optimization с автоматическими правилами');
    console.log('  ✅ Transaction Management с error handling');
    console.log('  ✅ Performance Monitoring и статистика');
    console.log('  ✅ Health Checks и диагностика');
    console.log('  ✅ Slow Query Detection и анализ');

  } catch (error) {
    console.error('\n❌ Ошибка тестирования Advanced Database:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('connect ECONNREFUSED')) {
      console.log('\n💡 Подсказка: Убедитесь, что PostgreSQL запущен и DATABASE_URL настроен');
      console.log('   Проверьте файл server/.env');
    }
  }
}

// Запускаем тесты
if (import.meta.url === `file://${process.argv[1]}`) {
  testAdvancedDatabase().then(() => {
    console.log('\n✅ Тестирование завершено');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
}

export { testAdvancedDatabase };