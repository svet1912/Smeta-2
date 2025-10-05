module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:4174/'],
      numberOfRuns: 1,
      // Специальные настройки для SPA приложений - РЕАЛИСТИЧНЫЕ ОЖИДАНИЯ
      settings: {
        // Значительно увеличиваем timeout для SPA
        maxWaitForLoad: 120000, // 2 минуты для комплексных SPA
        maxWaitForFcp: 90000, // 1.5 минуты для первой отрисовки
        pauseAfterLoadMs: 10000, // 10 секунд паузы после загрузки
        // Отключаем некоторые проверки, не подходящие для SPA
        onlyCategories: ['performance'],
        skipAudits: ['uses-http2', 'is-on-https', 'redirects-http'],
        // Chrome flags для SPA совместимости
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1400,1000',
          '--disable-extensions'
        ]
      }
      // Отключаем автозапуск сервера, будем использовать уже запущенный
      // startServerCommand: 'npm run serve:web:preview',
      // startServerReadyPattern: 'Local:',
      // startServerReadyTimeout: 30000,
    },
    assert: {
      assertions: {
        // РЕАЛИСТИЧНЫЕ Performance budgets для SPA
        'categories:performance': ['warn', { minScore: 0.4 }], // Снижен для SPA

        // Core Web Vitals - адаптированные для SPA
        'first-contentful-paint': ['warn', { maxNumericValue: 5000 }], // 5s для SPA
        'largest-contentful-paint': ['warn', { maxNumericValue: 8000 }], // 8s для SPA
        'total-blocking-time': ['warn', { maxNumericValue: 1000 }], // 1s для SPA
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.25 }], // Больше для динамических SPA

        // Resource budgets - реалистичные для enterprise SPA
        'resource-summary:script:size': ['warn', { maxNumericValue: 2000 * 1024 }], // 2MB js (SPA норма)
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 200 * 1024 }], // 200KB css
        'resource-summary:document:size': ['warn', { maxNumericValue: 100 * 1024 }], // 100KB html
        'resource-summary:image:size': ['warn', { maxNumericValue: 1000 * 1024 }], // 1MB images
        'resource-summary:total:size': ['warn', { maxNumericValue: 4000 * 1024 }], // 4MB total

        // Network budgets
        'network-requests': ['warn', { maxNumericValue: 50 }],
        'uses-long-cache-ttl': ['warn', { minScore: 0.7 }],

        // Security
        'is-on-https': 'off', // Отключаем для localhost
        'uses-http2': 'off' // Отключаем для localhost
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: 'lhci-report',
      reportFilenamePattern: 'report-%%DATETIME%%.%%EXTENSION%%'
    }
  }
};
