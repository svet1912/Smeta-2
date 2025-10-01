export default {
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/backend/**/*.{test,spec}.{js,mjs,ts}'
    ],
    exclude: [
      'tests/e2e/**/*',
      'node_modules/**/*',
      'dist/**/*'
    ],
    testTimeout: 30000,
    hookTimeout: 30000
  }
}
