/**
 * Test API Performance Optimization
 * Phase 3 Step 2: API Performance Optimization
 * 
 * Тестирование всех компонентов производительности API
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Конфигурация тестирования
const config = {
  baseUrl: 'http://localhost:3001',
  testUser: {
    email: 'test@example.com',
    password: 'testpass123'
  },
  endpoints: [
    '/api/materials',
    '/api/works',
    '/api/projects',
    '/api/customer-estimates'
  ]
};

// Результаты тестирования
const testResults = {
  apiOptimizer: { passed: 0, failed: 0, tests: [] },
  graphql: { passed: 0, failed: 0, tests: [] },
  batchAPI: { passed: 0, failed: 0, tests: [] },
  versioning: { passed: 0, failed: 0, tests: [] },
  performance: { passed: 0, failed: 0, tests: [] }
};

// Утилиты для тестирования
function logTest(category, testName, passed, details = '') {
  const emoji = passed ? '✅' : '❌';
  const status = passed ? 'PASSED' : 'FAILED';
  
  console.log(`${emoji} [${category}] ${testName} - ${status}`);
  if (details) {
    console.log(`   Details: ${details}`);
  }
  
  testResults[category].tests.push({
    name: testName,
    passed,
    details,
    timestamp: new Date().toISOString()
  });
  
  if (passed) {
    testResults[category].passed++;
  } else {
    testResults[category].failed++;
  }
}

async function makeRequest(path, options = {}) {
  try {
    const url = `${config.baseUrl}${path}`;
    const defaultOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    return {
      ok: response.ok,
      status: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      data: response.headers.get('content-type')?.includes('application/json') 
        ? await response.json() 
        : await response.text()
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      error: error.message,
      headers: {},
      data: null
    };
  }
}

async function authenticateUser() {
  try {
    const response = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(config.testUser)
    });
    
    if (response.ok && response.data?.token) {
      return response.data.token;
    }
    
    return null;
  } catch (error) {
    console.log('⚠️ Authentication failed, using mock token');
    return 'mock-jwt-token';
  }
}

// ============ ТЕСТЫ API OPTIMIZER ============

async function testAPIOptimizer() {
  console.log('\n🚀 Testing API Optimizer...\n');
  
  // Тест 1: Проверка compression middleware
  try {
    const response = await makeRequest('/api/materials', {
      headers: {
        'Accept-Encoding': 'gzip, deflate, br'
      }
    });
    
    const hasCompression = response.headers['content-encoding'];
    logTest('apiOptimizer', 'Response Compression', 
      !!hasCompression, 
      `Encoding: ${hasCompression || 'none'}`);
  } catch (error) {
    logTest('apiOptimizer', 'Response Compression', false, error.message);
  }
  
  // Тест 2: Проверка caching middleware
  try {
    const response1 = await makeRequest('/api/materials');
    const response2 = await makeRequest('/api/materials');
    
    const cacheHit = response2.headers['x-cache'] === 'HIT';
    logTest('apiOptimizer', 'Response Caching', 
      cacheHit, 
      `Cache status: ${response2.headers['x-cache'] || 'not set'}`);
  } catch (error) {
    logTest('apiOptimizer', 'Response Caching', false, error.message);
  }
  
  // Тест 3: Проверка versioning middleware
  try {
    const response = await makeRequest('/api/materials', {
      headers: {
        'API-Version': '2'
      }
    });
    
    const apiVersion = response.headers['api-version'];
    logTest('apiOptimizer', 'API Versioning', 
      apiVersion === 'v2', 
      `Version: ${apiVersion || 'not set'}`);
  } catch (error) {
    logTest('apiOptimizer', 'API Versioning', false, error.message);
  }
  
  // Тест 4: Проверка metrics collection
  try {
    const token = await authenticateUser();
    const response = await makeRequest('/api/performance/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const hasMetrics = response.ok && response.data?.data;
    logTest('apiOptimizer', 'Metrics Collection', 
      hasMetrics, 
      `Status: ${response.status}, Has data: ${!!response.data?.data}`);
  } catch (error) {
    logTest('apiOptimizer', 'Metrics Collection', false, error.message);
  }
}

// ============ ТЕСТЫ GRAPHQL ============

async function testGraphQL() {
  console.log('\n🔧 Testing GraphQL...\n');
  
  const token = await authenticateUser();
  
  // Тест 1: GraphQL endpoint availability
  try {
    const response = await makeRequest('/api/performance/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: '{ health }'
      })
    });
    
    logTest('graphql', 'GraphQL Endpoint', 
      response.status !== 404, 
      `Status: ${response.status}`);
  } catch (error) {
    logTest('graphql', 'GraphQL Endpoint', false, error.message);
  }
  
  // Тест 2: GraphQL materials query
  try {
    const query = `
      query GetMaterials($limit: Int) {
        materials(pagination: {limit: $limit}) {
          edges {
            node {
              id
              name
              price
            }
          }
          totalCount
        }
      }
    `;
    
    const response = await makeRequest('/api/performance/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query,
        variables: { limit: 5 }
      })
    });
    
    const hasData = response.data?.data?.materials;
    logTest('graphql', 'Materials Query', 
      !!hasData, 
      `Has materials data: ${!!hasData}`);
  } catch (error) {
    logTest('graphql', 'Materials Query', false, error.message);
  }
  
  // Тест 3: GraphQL error handling
  try {
    const response = await makeRequest('/api/performance/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        query: '{ invalidField }'
      })
    });
    
    const hasErrors = response.data?.errors && response.data.errors.length > 0;
    logTest('graphql', 'Error Handling', 
      hasErrors, 
      `Has error response: ${hasErrors}`);
  } catch (error) {
    logTest('graphql', 'Error Handling', false, error.message);
  }
}

// ============ ТЕСТЫ BATCH API ============

async function testBatchAPI() {
  console.log('\n📦 Testing Batch API...\n');
  
  const token = await authenticateUser();
  
  // Тест 1: General batch endpoint
  try {
    const batchRequest = {
      requests: [
        {
          id: 'req1',
          method: 'GET',
          path: '/api/materials',
          query: { limit: 5 }
        },
        {
          id: 'req2',
          method: 'GET',
          path: '/api/works',
          query: { limit: 3 }
        }
      ]
    };
    
    const response = await makeRequest('/api/performance/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(batchRequest)
    });
    
    const hasResults = response.data?.results && response.data.results.length === 2;
    logTest('batchAPI', 'General Batch Processing', 
      hasResults, 
      `Results count: ${response.data?.results?.length || 0}`);
  } catch (error) {
    logTest('batchAPI', 'General Batch Processing', false, error.message);
  }
  
  // Тест 2: Batch materials operations
  try {
    const batchMaterials = {
      operations: [
        {
          type: 'create',
          data: {
            name: 'Test Material Batch',
            type: 'BASIC',
            unit: 'м2',
            price: 100.50,
            category: 'Test'
          }
        }
      ]
    };
    
    const response = await makeRequest('/api/performance/batch/materials', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(batchMaterials)
    });
    
    const success = response.ok && response.data?.success;
    logTest('batchAPI', 'Batch Materials Operations', 
      success, 
      `Status: ${response.status}, Success: ${success}`);
  } catch (error) {
    logTest('batchAPI', 'Batch Materials Operations', false, error.message);
  }
  
  // Тест 3: Bulk import
  try {
    const importData = {
      type: 'materials',
      data: [
        {
          name: 'Bulk Import Material 1',
          type: 'BASIC',
          unit: 'кг',
          price: 25.00,
          category: 'Bulk Test'
        },
        {
          name: 'Bulk Import Material 2',
          type: 'BASIC',
          unit: 'л',
          price: 30.00,
          category: 'Bulk Test'
        }
      ],
      options: {
        batchSize: 10,
        skipErrors: true
      }
    };
    
    const response = await makeRequest('/api/performance/batch/import', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(importData)
    });
    
    const imported = response.data?.results?.processed > 0;
    logTest('batchAPI', 'Bulk Import', 
      imported, 
      `Processed: ${response.data?.results?.processed || 0}`);
  } catch (error) {
    logTest('batchAPI', 'Bulk Import', false, error.message);
  }
}

// ============ ТЕСТЫ VERSIONING ============

async function testVersioning() {
  console.log('\n🔢 Testing API Versioning...\n');
  
  // Тест 1: Default version (v1)
  try {
    const response = await makeRequest('/api/materials');
    const version = response.headers['api-version'];
    
    logTest('versioning', 'Default Version Detection', 
      version === 'v1', 
      `Version: ${version || 'not set'}`);
  } catch (error) {
    logTest('versioning', 'Default Version Detection', false, error.message);
  }
  
  // Тест 2: Header-based versioning
  try {
    const response = await makeRequest('/api/materials', {
      headers: {
        'API-Version': '2'
      }
    });
    
    const version = response.headers['api-version'];
    logTest('versioning', 'Header-based Versioning', 
      version === 'v2', 
      `Requested: v2, Got: ${version || 'not set'}`);
  } catch (error) {
    logTest('versioning', 'Header-based Versioning', false, error.message);
  }
  
  // Тест 3: Query parameter versioning
  try {
    const response = await makeRequest('/api/materials?version=2');
    const version = response.headers['api-version'];
    
    logTest('versioning', 'Query Parameter Versioning', 
      version === 'v2', 
      `Requested: v2, Got: ${version || 'not set'}`);
  } catch (error) {
    logTest('versioning', 'Query Parameter Versioning', false, error.message);
  }
  
  // Тест 4: Version documentation
  try {
    const response = await makeRequest('/api/performance/version');
    const hasVersionInfo = response.data?.current && response.data?.supported;
    
    logTest('versioning', 'Version Documentation', 
      hasVersionInfo, 
      `Current: ${response.data?.current}, Supported: ${response.data?.supported?.join(', ')}`);
  } catch (error) {
    logTest('versioning', 'Version Documentation', false, error.message);
  }
}

// ============ ТЕСТЫ PERFORMANCE ============

async function testPerformance() {
  console.log('\n⚡ Testing Performance Features...\n');
  
  const token = await authenticateUser();
  
  // Тест 1: Performance dashboard
  try {
    const response = await makeRequest('/api/performance/dashboard', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const isDashboard = response.ok && response.headers['content-type']?.includes('text/html');
    logTest('performance', 'Performance Dashboard', 
      isDashboard, 
      `Status: ${response.status}, Type: ${response.headers['content-type']}`);
  } catch (error) {
    logTest('performance', 'Performance Dashboard', false, error.message);
  }
  
  // Тест 2: Performance statistics
  try {
    const response = await makeRequest('/api/performance/stats', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const hasStats = response.ok && response.data?.data?.summary;
    logTest('performance', 'Performance Statistics', 
      hasStats, 
      `Status: ${response.status}, Has summary: ${!!response.data?.data?.summary}`);
  } catch (error) {
    logTest('performance', 'Performance Statistics', false, error.message);
  }
  
  // Тест 3: Cache management
  try {
    const response = await makeRequest('/api/performance/clear-cache', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const cleared = response.ok && response.data?.success;
    logTest('performance', 'Cache Management', 
      cleared, 
      `Status: ${response.status}, Success: ${cleared}`);
  } catch (error) {
    logTest('performance', 'Cache Management', false, error.message);
  }
  
  // Тест 4: Health check with performance metrics
  try {
    const response = await makeRequest('/api/performance/health');
    const hasHealthData = response.ok && response.data?.performance;
    
    logTest('performance', 'Health Check with Metrics', 
      hasHealthData, 
      `Status: ${response.data?.status}, Has metrics: ${!!response.data?.performance}`);
  } catch (error) {
    logTest('performance', 'Health Check with Metrics', false, error.message);
  }
  
  // Тест 5: Performance test runner
  try {
    const testRequest = {
      type: 'basic',
      iterations: 5
    };
    
    const response = await makeRequest('/api/performance/test', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(testRequest)
    });
    
    const hasResults = response.ok && response.data?.results?.avgTime !== undefined;
    logTest('performance', 'Performance Test Runner', 
      hasResults, 
      `Avg time: ${response.data?.results?.avgTime}ms`);
  } catch (error) {
    logTest('performance', 'Performance Test Runner', false, error.message);
  }
}

// ============ ОСНОВНАЯ ФУНКЦИЯ ТЕСТИРОВАНИЯ ============

async function runAllTests() {
  console.log('🧪 Starting API Performance Optimization Tests...');
  console.log('='.repeat(50));
  
  const startTime = Date.now();
  
  // Запуск всех тестов
  await testAPIOptimizer();
  await testGraphQL();
  await testBatchAPI();
  await testVersioning();
  await testPerformance();
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  // Подсчет результатов
  let totalPassed = 0;
  let totalFailed = 0;
  
  console.log('\n📊 Test Results Summary:');
  console.log('='.repeat(50));
  
  Object.keys(testResults).forEach(category => {
    const result = testResults[category];
    totalPassed += result.passed;
    totalFailed += result.failed;
    
    const emoji = result.failed === 0 ? '✅' : result.passed > result.failed ? '⚠️' : '❌';
    console.log(`${emoji} ${category}: ${result.passed} passed, ${result.failed} failed`);
  });
  
  console.log('='.repeat(50));
  console.log(`🎯 Total: ${totalPassed} passed, ${totalFailed} failed`);
  console.log(`⏱️  Execution time: ${totalTime}ms`);
  console.log(`📈 Success rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);
  
  if (totalFailed === 0) {
    console.log('\n🎉 All tests passed! API Performance Optimization is working correctly.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the details above.');
  }
  
  // Сохранение результатов
  const results = {
    summary: {
      totalPassed,
      totalFailed,
      successRate: Math.round((totalPassed / (totalPassed + totalFailed)) * 100),
      executionTime: totalTime,
      timestamp: new Date().toISOString()
    },
    categories: testResults
  };
  
  console.log('\n💾 Test results saved to memory.');
  
  return results;
}

// Запуск тестов
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then(results => {
      process.exit(results.summary.totalFailed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner error:', error);
      process.exit(1);
    });
}

export default runAllTests;