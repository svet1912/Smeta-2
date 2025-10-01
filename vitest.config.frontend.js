import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/frontend/setupTests.ts'],
    css: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});