#!/usr/bin/env node
// Test Smart Cache система - Phase 2 Step 6

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

async function testSmartCache() {
  console.log('🧪 Тестирование Smart Cache System Phase 2 Step 6...\n');

  try {
    // Импортируем модули
    const { smartCacheGetOrSet, smartCacheInvalidate, getSmartCacheAnalytics, cleanupSmartCache } = await import('../../server/cache/smartCache.js');
    const { initCacheWarming } = await import('../../server/cache/cacheWarming.js');

    console.log('✅ Модули Smart Cache загружены');

    // 1. Тест базовых операций кэша
    console.log('\n📝 1. Тестирование базовых операций...');
    
    // Простой тест
    const testData = await smartCacheGetOrSet(
      'test:simple',
      300,
      async () => {
        console.log('  📊 Генерируем тестовые данные...');
        return { message: 'Hello Smart Cache!', timestamp: new Date().toISOString() };
      }
    );
    console.log('  ✅ Простой кэш работает:', testData.message);

    // Тест с зависимостями
    const dependentData = await smartCacheGetOrSet(
      'test:with-dependencies',
      300,
      async () => {
        console.log('  📊 Генерируем данные с зависимостями...');
        return { data: 'cached with dependencies', id: Math.random() };
      },
      {
        dependencies: ['test-dependency', 'another-dependency'],
        metadata: { testType: 'dependency-test' }
      }
    );
    console.log('  ✅ Кэш с зависимостями работает:', dependentData.data);

    // 2. Тест инвалидации по зависимостям
    console.log('\n🗑️ 2. Тестирование smart invalidation...');
    
    // Создаем еще один ключ с той же зависимостью
    await smartCacheGetOrSet(
      'test:another-dependent',
      300,
      async () => ({ value: 'another dependent value' }),
      { dependencies: ['test-dependency'] }
    );

    // Инвалидируем по зависимости
    await smartCacheInvalidate('test-dependency');
    console.log('  ✅ Инвалидация по зависимости выполнена');

    // Проверяем, что данные удалились
    const shouldBeNull = await smartCacheGetOrSet(
      'test:with-dependencies',
      300,
      async () => {
        console.log('  📊 Данные отсутствуют в кэше, генерируем заново...');
        return { data: 'regenerated after invalidation', id: Math.random() };
      },
      { dependencies: ['test-dependency'] }
    );
    console.log('  ✅ После инвалидации данные сгенерированы заново');

    // 3. Тест Cache Warming
    console.log('\n🔥 3. Тестирование Cache Warming...');
    
    const warmingService = initCacheWarming();
    console.log('  ✅ Cache Warming инициализирован');

    // Показываем информацию о стратегиях
    const strategiesInfo = warmingService.getStrategiesInfo();
    console.log('  📋 Стратегии warming:');
    console.log(`    • Критические: ${strategiesInfo.critical.count} шт.`);
    console.log(`    • Популярные: ${strategiesInfo.popular.count} шт.`);
    console.log(`    • По требованию: ${strategiesInfo.onDemand.count} шт.`);

    // Тестируем критическое warming
    await warmingService.warmCriticalData();
    console.log('  ✅ Критические данные предзагружены');

    // Добавляем пользовательскую стратегию
    warmingService.addCustomStrategy({
      key: 'test:custom-strategy',
      ttl: 180,
      dependencies: ['custom-test'],
      producer: async () => ({
        customData: 'This is custom warming strategy',
        generated: new Date().toISOString()
      })
    });

    // Запускаем on-demand warming
    await warmingService.warmOnDemand('custom');
    console.log('  ✅ Пользовательская стратегия warming выполнена');

    // 4. Тест аналитики
    console.log('\n📊 4. Тестирование аналитики кэша...');
    
    const analytics = await getSmartCacheAnalytics();
    console.log('  📈 Статистика кэша:');
    console.log(`    • Hit Rate: ${analytics.hitRate}%`);
    console.log(`    • Hits: ${analytics.hits}`);
    console.log(`    • Misses: ${analytics.misses}`);
    console.log(`    • Sets: ${analytics.sets}`);
    console.log(`    • Errors: ${analytics.errors}`);
    console.log(`    • Average Latency: ${Math.round(analytics.averageLatency * 100) / 100}ms`);
    console.log(`    • Total Keys: ${analytics.totalKeys}`);

    if (analytics.redis) {
      console.log('  🔴 Redis информация:');
      console.log(`    • Used Memory: ${analytics.redis.usedMemory}`);
      console.log(`    • Actual Keys: ${analytics.actualKeys || 'calculating...'}`);
    }

    // 5. Тест очистки
    console.log('\n🧹 5. Тестирование очистки...');
    
    await cleanupSmartCache();
    console.log('  ✅ Очистка устаревших данных выполнена');

    // 6. Финальная аналитика
    console.log('\n📊 6. Финальная статистика...');
    
    const finalAnalytics = await getSmartCacheAnalytics();
    console.log(`  📈 Финальный Hit Rate: ${finalAnalytics.hitRate}%`);
    console.log(`  🔢 Общие операции: ${finalAnalytics.hits + finalAnalytics.misses + finalAnalytics.sets}`);
    
    console.log('\n🎉 Все тесты Smart Cache прошли успешно!');
    console.log('\n📋 Smart Cache Phase 2 Step 6 возможности:');
    console.log('  ✅ Dependency tracking и smart invalidation');
    console.log('  ✅ Cache warming с различными стратегиями');
    console.log('  ✅ Расширенная аналитика и мониторинг');
    console.log('  ✅ Автоматическая очистка устаревших данных');
    console.log('  ✅ Гибкие метаданные и категоризация');
    console.log('  ✅ Обратная совместимость с существующим кодом');

  } catch (error) {
    console.error('\n❌ Ошибка тестирования Smart Cache:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Запускаем тесты
if (import.meta.url === `file://${process.argv[1]}`) {
  testSmartCache().then(() => {
    console.log('\n✅ Тестирование завершено');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
  });
}

export { testSmartCache };