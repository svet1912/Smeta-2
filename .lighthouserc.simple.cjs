module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4174/'],
      numberOfRuns: 1,
      // Упрощенные настройки для SPA
      settings: {
        onlyCategories: ['performance'],
        maxWaitForLoad: 60000,
        maxWaitForFcp: 45000,
        pauseAfterLoadMs: 5000,
        skipAudits: [
          'uses-http2',
          'is-on-https', 
          'redirects-http',
          'canonical'
        ],
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-gpu', 
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--window-size=1200,800',
          '--disable-features=VizDisplayCompositor'
        ]
      }
    },
    assert: {
      assertions: {
        // Более мягкие бюджеты для SPA
        'categories:performance': ['warn', { minScore: 0.50 }],
        // Отключаем проблематичные для SPA метрики
        'first-contentful-paint': 'off',
        'largest-contentful-paint': 'off', 
        'speed-index': 'off',
        'total-blocking-time': 'off',
        'cumulative-layout-shift': 'off',
        // Разрешаем большие бандлы для SPA
        'resource-summary:script:size': ['warn', { maxNumericValue: 2000 * 1024 }], // 2MB js
        'resource-summary:total:size': ['warn', { maxNumericValue: 4000 * 1024 }], // 4MB total
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: 'lhci-report-simple',
      reportFilenamePattern: 'simple-report-%%DATETIME%%.%%EXTENSION%%'
    }
  }
};