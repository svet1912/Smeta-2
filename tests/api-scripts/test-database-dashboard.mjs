#!/usr/bin/env node
// HTTP тест для Database Monitoring Dashboard

const BASE_URL = 'http://localhost:3002';

async function testDatabaseMonitoring() {
  console.log('🌐 Тестирование Database Monitoring Dashboard...\n');

  try {
    // 1. Тест статистики database pool
    console.log('📊 1. Тестирование /api/admin/database/stats');
    
    const statsResponse = await fetch(`${BASE_URL}/api/admin/database/stats`, {
      headers: {
        Authorization: 'Bearer test-token'
      }
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('  ✅ Database статистика получена');
      console.log(`  📊 Pool connections: ${stats.data?.pool?.totalCount || 0}`);
      console.log(`  📈 Queries executed: ${stats.data?.pool?.queriesExecuted || 0}`);
      console.log(`  ⚡ Average query time: ${Math.round(stats.data?.pool?.averageQueryTime || 0)}ms`);
    } else {
      console.log('  ❌ Ошибка получения статистики:', statsResponse.status, statsResponse.statusText);
    }

    // 2. Тест health check
    console.log('\n🏥 2. Тестирование /api/admin/database/health');
    
    const healthResponse = await fetch(`${BASE_URL}/api/admin/database/health`, {
      headers: {
        Authorization: 'Bearer test-token'
      }
    });
    
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log('  ✅ Health check получен');
      console.log(`  💚 Status: ${health.data?.status || 'unknown'}`);
      console.log(`  ⏱️ Connection time: ${health.data?.connectionTime || 0}ms`);
    } else {
      console.log('  ❌ Ошибка health check:', healthResponse.status);
    }

    // 3. Тест медленных запросов
    console.log('\n🐌 3. Тестирование /api/admin/database/slow-queries');
    
    const slowQueriesResponse = await fetch(`${BASE_URL}/api/admin/database/slow-queries?minDuration=100`, {
      headers: {
        Authorization: 'Bearer test-token'
      }
    });
    
    if (slowQueriesResponse.ok) {
      const slowQueries = await slowQueriesResponse.json();
      console.log('  ✅ Медленные запросы получены');
      console.log(`  📊 Найдено медленных запросов: ${slowQueries.data?.count || 0}`);
    } else {
      console.log('  ❌ Ошибка получения медленных запросов:', slowQueriesResponse.status);
    }

    // 4. Тест анализа запроса
    console.log('\n🔍 4. Тестирование /api/admin/database/analyze-query');
    
    const analyzeResponse = await fetch(`${BASE_URL}/api/admin/database/analyze-query`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'SELECT NOW() as current_time',
        params: []
      })
    });
    
    if (analyzeResponse.ok) {
      const analysis = await analyzeResponse.json();
      console.log('  ✅ Анализ запроса получен');
      console.log(`  💰 Total cost: ${analysis.data?.totalCost || 'N/A'}`);
      console.log(`  ⏱️ Actual time: ${analysis.data?.actualTime || 'N/A'}ms`);
    } else {
      console.log('  ❌ Ошибка анализа запроса:', analyzeResponse.status);
    }

    // 5. Тест оптимизации запроса
    console.log('\n🔧 5. Тестирование /api/admin/database/optimize-query');
    
    const optimizeResponse = await fetch(`${BASE_URL}/api/admin/database/optimize-query`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: 'SELECT * FROM auth_users WHERE email = $1',
        params: ['test@example.com'],
        context: { tenantId: 'test-tenant-123' }
      })
    });
    
    if (optimizeResponse.ok) {
      const optimization = await optimizeResponse.json();
      console.log('  ✅ Оптимизация запроса получена');
      console.log('  📝 Оригинальный:', optimization.data?.original?.query?.substring(0, 50) + '...');
      console.log('  🔧 Оптимизированный:', optimization.data?.optimized?.query?.substring(0, 50) + '...');
    } else {
      console.log('  ❌ Ошибка оптимизации запроса:', optimizeResponse.status);
    }

    // 6. Тест Database Dashboard HTML
    console.log('\n🖥️ 6. Тестирование /api/admin/database/dashboard');
    
    const dashboardResponse = await fetch(`${BASE_URL}/api/admin/database/dashboard`, {
      headers: {
        Authorization: 'Bearer test-token'
      }
    });
    
    if (dashboardResponse.ok) {
      const dashboardHtml = await dashboardResponse.text();
      console.log('  ✅ Database Dashboard HTML получен');
      console.log(`  📏 Размер: ${dashboardHtml.length} символов`);
      
      // Проверяем наличие ключевых элементов
      const hasTitle = dashboardHtml.includes('Database Performance Dashboard');
      const hasMetrics = dashboardHtml.includes('metric-card');
      const hasConnections = dashboardHtml.includes('Активные соединения');
      const hasQueries = dashboardHtml.includes('Всего запросов');
      
      console.log(`  🏷️ Title: ${hasTitle ? '✅' : '❌'}`);
      console.log(`  📊 Metrics: ${hasMetrics ? '✅' : '❌'}`);
      console.log(`  🔗 Connections info: ${hasConnections ? '✅' : '❌'}`);
      console.log(`  📈 Queries info: ${hasQueries ? '✅' : '❌'}`);
    } else {
      console.log('  ❌ Ошибка получения dashboard:', dashboardResponse.status);
    }

    console.log('\n🎉 Тестирование Database Monitoring завершено!');
    
    console.log('\n📋 Доступные Database Monitoring endpoints:');
    console.log('  • /api/admin/database/stats - статистика pool');
    console.log('  • /api/admin/database/health - health check');
    console.log('  • /api/admin/database/slow-queries - медленные запросы');
    console.log('  • /api/admin/database/analyze-query - анализ производительности');
    console.log('  • /api/admin/database/optimize-query - оптимизация запросов');
    console.log('  • /api/admin/database/dashboard - HTML dashboard');

  } catch (error) {
    console.error('\n❌ Ошибка HTTP тестов:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Подсказка: Убедитесь, что сервер запущен на порту 3002');
      console.log('   Запустите: npm run dev:server');
    }
  }
}

// Запускаем тесты
testDatabaseMonitoring();

export { testDatabaseMonitoring };