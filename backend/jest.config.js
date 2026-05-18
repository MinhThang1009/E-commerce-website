module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@modules/(.*)$':     '<rootDir>/src/modules/$1',
    '^@shared/(.*)$':      '<rootDir>/src/shared/$1',
    '^@utils/(.*)$':       '<rootDir>/src/utils/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@models/(.*)$':      '<rootDir>/src/models/$1',
    '^@models$':           '<rootDir>/src/models',
    '^@config/(.*)$':      '<rootDir>/src/config/$1',
    '^@services/(.*)$':    '<rootDir>/src/services/$1',
    '^@jobs/(.*)$':        '<rootDir>/src/jobs/$1',
  },
  // Hỗ trợ cả flat __tests__/ (integration tests) lẫn co-located unit tests
  testMatch: [
    '**/src/__tests__/**/*.test.js',        // integration + cross-cutting tests
    '**/src/modules/**/*.test.js',          // co-located module unit tests
    '**/src/services/**/*.test.js',         // co-located service tests
    '**/src/utils/**/*.test.js',            // co-located util tests
    '**/src/shared/**/*.test.js',           // co-located shared tests
    '**/src/middlewares/**/*.test.js',      // co-located middleware tests
    '**/src/models/**/*.test.js',           // co-located model tests
    '**/src/jobs/**/*.test.js',             // co-located job tests
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./src/__tests__/setup.js'],
  clearMocks: true,
  // Phase 44 partial — coverage threshold lock baseline làm floor.
  // Khi collectCoverageFrom include all src/ → baseline 27% (thấp hơn lúc chỉ count file
  // có test touch). Threshold 25/12/18/25 dưới baseline ~2%, để CI không vỡ
  // khi thêm new untested file; nâng dần khi viết thêm test.
  // Generate report: `npx jest --coverage`. Snapshot trong docs/TESTING_COVERAGE_BASELINE.md.
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',        // exclude co-located test files
    '!src/__tests__/**',        // exclude flat test directory
    '!src/migrations/**',
    '!src/seeders/**',
    '!src/config/**',
    '!src/server.js',
    '!src/app.js',
    '!src/**/I*.js',            // exclude abstract interface files (IRepository, IService)
    '!src/**/*.module.js',
    '!src/**/module.js',        // exclude DI wiring modules
    '!src/**/index.js',         // exclude barrel re-exports
    '!src/routes/imageProxy.js', // proxy utility, not business logic
  ],
  coverageThreshold: {
    global: {
      statements: 99,   // current: ~99.65% post Phase-10 coverage push
      branches: 97,     // current: ~97.75% post Phase-10 coverage push
      functions: 99,    // current: ~99.15% post Phase-10 coverage push
      lines: 99,        // current: ~99.82% post Phase-10 coverage push
    },
  },
};
