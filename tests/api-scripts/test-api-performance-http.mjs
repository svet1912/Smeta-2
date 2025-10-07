/**
 * Test API Performance HTTP Endpoints
 * Phase 3 Step 2: API Performance Optimization
 * 
 * Тестирование HTTP endpoints для performance API
 */

console.log('🌐 Testing API Performance HTTP Endpoints...\n');

const baseUrl = 'http://localhost:3001';

// Утилита для HTTP запросов
async function makeRequest(endpoint, options = {}) {
  try {
    const url = `${baseUrl}${endpoint}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    console.log(`📡 ${options.method || 'GET'} ${endpoint}`);
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    const isJson = response.headers.get('content-type')?.includes('application/json');
    
    return {
      status: response.status,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      data: isJson ? await response.json() : await response.text()
    };
    
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    return {
      status: 0,
      ok: false,
      error: error.message,
      data: null
    };
  }
}

// Тест аутентификации (мок)
async function authenticate() {
  try {
    const response = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'testpass123'
      })
    });
    
    if (response.ok && response.data?.token) {
      console.log('✅ Authentication successful');
      return response.data.token;
    }
    
    console.log('⚠️ Using mock token for testing');
    return 'mock-jwt-token';
    
  } catch (error) {
    console.log('⚠️ Authentication failed, using mock token');
    return 'mock-jwt-token';
  }
}

async function testEndpoints() {
  const token = await authenticate();
  const authHeaders = {
    'Authorization': `Bearer ${token}`
  };
  
  console.log('\n🔧 Testing Performance API Endpoints:\n');
  
  // 1. Performance Dashboard
  console.log('1. Performance Dashboard');
  const dashboard = await makeRequest('/api/performance/dashboard', {
    headers: authHeaders
  });
  console.log(`   Status: ${dashboard.status}, Type: ${dashboard.headers['content-type']}`);
  console.log(`   ${dashboard.ok ? '✅' : '❌'} Dashboard loaded\n`);
  
  // 2. Performance Statistics
  console.log('2. Performance Statistics');
  const stats = await makeRequest('/api/performance/stats', {
    headers: authHeaders
  });
  console.log(`   Status: ${stats.status}`);
  if (stats.ok && stats.data?.data) {
    console.log(`   📊 Summary: ${JSON.stringify(stats.data.data.summary, null, 2)}`);
  }
  console.log(`   ${stats.ok ? '✅' : '❌'} Statistics retrieved\n`);
  
  // 3. Performance Health Check
  console.log('3. Performance Health Check');
  const health = await makeRequest('/api/performance/health');
  console.log(`   Status: ${health.status}`);
  if (health.ok && health.data) {
    console.log(`   🏥 Health: ${health.data.status}`);
    console.log(`   📈 Performance: ${JSON.stringify(health.data.performance || {}, null, 2)}`);
  }
  console.log(`   ${health.ok ? '✅' : '❌'} Health check completed\n`);
  
  // 4. API Version Info
  console.log('4. API Version Info');
  const version = await makeRequest('/api/performance/version');
  console.log(`   Status: ${version.status}`);
  if (version.ok && version.data) {
    console.log(`   📋 Version info: ${JSON.stringify(version.data, null, 2)}`);
  }
  console.log(`   ${version.ok ? '✅' : '❌'} Version info retrieved\n`);
  
  // 5. API Documentation
  console.log('5. API Documentation');
  const docs = await makeRequest('/api/performance/docs');
  console.log(`   Status: ${docs.status}`);
  if (docs.ok && docs.data) {
    console.log(`   📚 Title: ${docs.data.title}`);
    console.log(`   📚 Version: ${docs.data.version}`);
    console.log(`   📚 Endpoints: ${Object.keys(docs.data.endpoints || {}).length} available`);
  }
  console.log(`   ${docs.ok ? '✅' : '❌'} Documentation retrieved\n`);
  
  // 6. Clear Performance Cache
  console.log('6. Clear Performance Cache');
  const clearCache = await makeRequest('/api/performance/clear-cache', {
    method: 'POST',
    headers: authHeaders
  });
  console.log(`   Status: ${clearCache.status}`);
  if (clearCache.ok && clearCache.data) {
    console.log(`   🧹 Message: ${clearCache.data.message}`);
  }
  console.log(`   ${clearCache.ok ? '✅' : '❌'} Cache clearing completed\n`);
  
  // 7. Performance Test Runner
  console.log('7. Performance Test Runner');
  const perfTest = await makeRequest('/api/performance/test', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      type: 'basic',
      iterations: 5
    })
  });
  console.log(`   Status: ${perfTest.status}`);
  if (perfTest.ok && perfTest.data?.results) {
    console.log(`   ⚡ Avg time: ${perfTest.data.results.avgTime}ms`);
    console.log(`   ⚡ Throughput: ${perfTest.data.results.throughput} ops/sec`);
  }
  console.log(`   ${perfTest.ok ? '✅' : '❌'} Performance test completed\n`);
  
  // 8. GraphQL Endpoint (простой health check)
  console.log('8. GraphQL Endpoint');
  const graphql = await makeRequest('/api/performance/graphql', {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: '{ health }'
    })
  });
  console.log(`   Status: ${graphql.status}`);
  if (graphql.ok && graphql.data) {
    console.log(`   🔧 GraphQL response received`);
  }
  console.log(`   ${graphql.ok ? '✅' : '❌'} GraphQL endpoint tested\n`);
  
  // 9. Batch API Test
  console.log('9. Batch API Test');
  const batch = await makeRequest('/api/performance/batch', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      requests: [
        {
          id: 'test1',
          method: 'GET',
          path: '/api/materials',
          query: { limit: 5 }
        },
        {
          id: 'test2',
          method: 'GET',
          path: '/api/works',
          query: { limit: 3 }
        }
      ]
    })
  });
  console.log(`   Status: ${batch.status}`);
  if (batch.ok && batch.data) {
    console.log(`   📦 Processed: ${batch.data.processed} requests`);
    console.log(`   📦 Results: ${batch.data.results?.length || 0} items`);
  }
  console.log(`   ${batch.ok ? '✅' : '❌'} Batch API tested\n`);
  
  // 10. API Versioning Test
  console.log('10. API Versioning Test');
  
  // Test v1
  const v1Response = await makeRequest('/api/materials', {
    headers: { 'API-Version': '1' }
  });
  console.log(`   V1 Status: ${v1Response.status}, Version: ${v1Response.headers['api-version']}`);
  
  // Test v2  
  const v2Response = await makeRequest('/api/materials', {
    headers: { 'API-Version': '2' }
  });
  console.log(`   V2 Status: ${v2Response.status}, Version: ${v2Response.headers['api-version']}`);
  
  const versioningWorks = v1Response.headers['api-version'] === 'v1' && 
                         v2Response.headers['api-version'] === 'v2';
  console.log(`   ${versioningWorks ? '✅' : '❌'} API versioning working\n`);
}

// Дополнительные тесты производительности
async function testPerformanceFeatures() {
  console.log('⚡ Testing Performance Features:\n');
  
  // Тест сжатия
  console.log('1. Response Compression Test');
  const compressedResponse = await makeRequest('/api/materials', {
    headers: {
      'Accept-Encoding': 'gzip, deflate, br'
    }
  });
  const hasCompression = compressedResponse.headers['content-encoding'];
  console.log(`   Compression: ${hasCompression || 'none'}`);
  console.log(`   ${hasCompression ? '✅' : '⚠️'} Compression ${hasCompression ? 'enabled' : 'not detected'}\n`);
  
  // Тест кэширования
  console.log('2. Response Caching Test');
  const firstRequest = await makeRequest('/api/materials');
  const secondRequest = await makeRequest('/api/materials');
  
  const cacheStatus1 = firstRequest.headers['x-cache'] || 'not set';
  const cacheStatus2 = secondRequest.headers['x-cache'] || 'not set';
  
  console.log(`   First request cache: ${cacheStatus1}`);
  console.log(`   Second request cache: ${cacheStatus2}`);
  console.log(`   ${cacheStatus2 === 'HIT' ? '✅' : '⚠️'} Caching ${cacheStatus2 === 'HIT' ? 'working' : 'not detected'}\n`);
  
  // Тест performance metrics
  console.log('3. Performance Metrics Test');
  const metricsStart = Date.now();
  
  // Делаем несколько запросов для генерации метрик
  await Promise.all([
    makeRequest('/api/materials'),
    makeRequest('/api/works'),
    makeRequest('/api/phases')
  ]);
  
  const metricsTime = Date.now() - metricsStart;
  console.log(`   Parallel requests completed in: ${metricsTime}ms`);
  console.log(`   ✅ Metrics collection tested\n`);
}

// Главная функция
async function main() {
  try {
    console.log('🧪 API Performance HTTP Endpoints Test');
    console.log('=' .repeat(50));
    
    await testEndpoints();
    await testPerformanceFeatures();
    
    console.log('🎉 All HTTP endpoint tests completed!');
    console.log('Check the results above for any issues.');
    
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  }
}

// Запуск
main();