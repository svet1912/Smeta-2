module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4174/'],
      numberOfRuns: 1,
      // Отключаем автозапуск сервера, будем использовать уже запущенный
      // startServerCommand: 'npm run serve:web:preview',
      // startServerReadyPattern: 'Local:',
      // startServerReadyTimeout: 30000,
    },
    assert: {
      assertions: {
        // Performance budgets
        'categories:performance': ['error', { minScore: 0.80 }],
        'categories:accessibility': ['warn', { minScore: 0.90 }],
        'categories:best-practices': ['warn', { minScore: 0.85 }],
        'categories:seo': ['warn', { minScore: 0.80 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        
        // Resource budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 400 * 1024 }], // ~400KB js
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100 * 1024 }], // ~100KB css
        'resource-summary:document:size': ['warn', { maxNumericValue: 50 * 1024 }], // ~50KB html
        'resource-summary:image:size': ['warn', { maxNumericValue: 500 * 1024 }], // ~500KB images
        'resource-summary:total:size': ['error', { maxNumericValue: 1500 * 1024 }], // ~1.5MB total
        
        // Network budgets
        'network-requests': ['warn', { maxNumericValue: 50 }],
        'uses-long-cache-ttl': ['warn', { minScore: 0.70 }],
        
        // Security
        'is-on-https': 'off', // Отключаем для localhost
        'uses-http2': 'off', // Отключаем для localhost
      }
    },
    upload: { 
      target: 'filesystem', 
      outputDir: 'lhci-report',
      reportFilenamePattern: 'report-%%DATETIME%%.%%EXTENSION%%'
    }
  }
};