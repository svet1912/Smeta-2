import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    actionTimeout: 30000,
    navigationTimeout: 60000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
