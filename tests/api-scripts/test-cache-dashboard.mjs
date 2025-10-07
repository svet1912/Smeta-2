#!/usr/bin/env node
// HTTP тест для Cache Analytics Dashboard

const BASE_URL = 'http://localhost:3002';

async function testCacheAnalytics() {
  console.log('🌐 Тестирование Cache Analytics Dashboard...\n');

  try {
    // 1. Тест получения статистики кэша
    console.log('📊 1. Тестирование /api/admin/cache/stats');
    
    const statsResponse = await fetch(`${BASE_URL}/api/admin/cache/stats`, {
      headers: {
        Authorization: 'Bearer test-token' // В реальном проекте нужен валидный JWT
      }
    });
    
    if (statsResponse.ok) {
      const stats = await statsResponse.json();
      console.log('  ✅ Статистика получена:', JSON.stringify(stats, null, 2));
    } else {
      console.log('  ❌ Ошибка получения статистики:', statsResponse.status, statsResponse.statusText);
    }

    // 2. Тест полной аналитики
    console.log('\n📈 2. Тестирование /api/admin/cache/analytics');
    
    const analyticsResponse = await fetch(`${BASE_URL}/api/admin/cache/analytics`, {
      headers: {
        Authorization: 'Bearer test-token'
      }
    });
    
    if (analyticsResponse.ok) {
      const analytics = await analyticsResponse.json();
      console.log('  ✅ Аналитика получена');
      console.log(`  📊 Hit Rate: ${analytics.data.hitRate}%`);
      console.log(`  🔢 Total Operations: ${analytics.data.hits + analytics.data.misses + analytics.data.sets}`);
    } else {
      console.log('  ❌ Ошибка получения аналитики:', analyticsResponse.status);
    }

    // 3. Тест Dashboard HTML
    console.log('\n🖥️ 3. Тестирование /api/admin/cache/dashboard');
    
    const dashboardResponse = await fetch(`${BASE_URL}/api/admin/cache/dashboard`, {
      headers: {
        Authorization: 'Bearer test-token'
      }
    });
    
    if (dashboardResponse.ok) {
      const dashboardHtml = await dashboardResponse.text();
      console.log('  ✅ Dashboard HTML получен');
      console.log(`  📏 Размер: ${dashboardHtml.length} символов`);
      
      // Проверяем наличие ключевых элементов
      const hasTitle = dashboardHtml.includes('SmartCache Analytics Dashboard');
      const hasMetrics = dashboardHtml.includes('metric-card');
      const hasRefresh = dashboardHtml.includes('setTimeout');
      
      console.log(`  🏷️ Title: ${hasTitle ? '✅' : '❌'}`);
      console.log(`  📊 Metrics: ${hasMetrics ? '✅' : '❌'}`);
      console.log(`  🔄 Auto-refresh: ${hasRefresh ? '✅' : '❌'}`);
    } else {
      console.log('  ❌ Ошибка получения dashboard:', dashboardResponse.status);
    }

    // 4. Тест очистки кэша
    console.log('\n🧹 4. Тестирование /api/admin/cache/cleanup');
    
    const cleanupResponse = await fetch(`${BASE_URL}/api/admin/cache/cleanup`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        'Content-Type': 'application/json'
      }
    });
    
    if (cleanupResponse.ok) {
      const cleanupResult = await cleanupResponse.json();
      console.log('  ✅ Очистка выполнена:', cleanupResult.message);
    } else {
      console.log('  ❌ Ошибка очистки:', cleanupResponse.status);
    }

    console.log('\n🎉 Тестирование Cache Analytics завершено!');

  } catch (error) {
    console.error('\n❌ Ошибка HTTP тестов:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Подсказка: Убедитесь, что сервер запущен на порту 3002');
      console.log('   Запустите: npm run dev:server');
    }
  }
}

// Запускаем тесты
testCacheAnalytics();

export { testCacheAnalytics };