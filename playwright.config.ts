import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:4174',     // vite preview
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: [
    {
      command: 'npm run serve:api',
      url: 'http://localhost:3001/api/health',
      reuseExistingServer: true,
      timeout: 30_000
    },
    {
      command: 'npm run serve:web:preview',
      url: 'http://localhost:4174',
      reuseExistingServer: true,
      timeout: 30_000
    }
  ],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // при желании добавь firefox/webkit позже
  ]
});