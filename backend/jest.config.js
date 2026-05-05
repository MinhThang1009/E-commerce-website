module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__tests__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./src/__tests__/setup.js'],
  clearMocks: true,
  // Phase 44 partial — coverage threshold lock baseline làm floor.
  // Khi collectCoverageFrom include all src/ → baseline 27% (thấp hơn lúc chỉ count file
  // có test touch). Threshold 25/12/18/25 dưới baseline ~2%, để CI không vỡ
  // khi thêm new untested file; nâng dần khi viết thêm test.
  // Generate report: `npx jest --coverage`. Snapshot trong docs/TESTING_COVERAGE_BASELINE.md.
  coverageThreshold: {
    global: {
      statements: 25,
      branches: 12,
      functions: 18,
      lines: 25,
    },
  },
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/__tests__/**',
    '!src/migrations/**',
    '!src/seeders/**',
    '!src/config/**',
    '!src/server.js',
    '!src/app.js',
  ],
};
