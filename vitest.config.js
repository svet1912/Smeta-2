import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',          // для backend-тестов
    globals: true,
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./vitest.setup.js']
  }
});