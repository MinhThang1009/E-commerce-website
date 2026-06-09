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
  testPathIgnorePatterns: ['/node_modules/', '/.stryker-tmp/'],
  setupFiles: ['./src/__tests__/setup.js'],
  clearMocks: true,
  // Phase 44 partial — coverage threshold lock baseline làm floor.
  // Khi collectCoverageFrom include all src/ → baseline 27% (thấp hơn lúc chỉ count file
  // có test touch). Threshold 25/12/18/25 dưới baseline ~2%, để CI không vỡ
  // khi thêm new untested file; nâng dần khi viết thêm test.
  // Generate report: `npx jest --coverage`. Snapshot trong docs/TESTING_COVERAGE_BASELINE.md.
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',              // exclude co-located test files
    '!src/__tests__/**',              // exclude flat test directory
    '!src/__integration__/**',        // exclude integration test helpers
    '!src/__api__/**',                // exclude HTTP test helpers
    '!src/__e2e__/**',                // exclude E2E test helpers
    '!src/migrations/**',
    '!src/seeders/**',
    '!src/config/**',
    '!src/server.js',
    '!src/app.js',
    '!src/**/I*.js',                  // exclude PascalCase abstract interface files
    '!src/**/i-*-repository.js',      // exclude kebab-case interface repositories (sau rename)
    '!src/**/i-*-service.js',         // exclude kebab-case interface services
    '!src/**/*-dto.js',               // exclude DTO files (data shapes, no logic)
    '!src/**/*.module.js',
    '!src/**/module.js',              // exclude DI wiring modules
    '!src/**/index.js',               // exclude barrel re-exports
    '!src/routes/imageProxy.js',      // proxy utility, not business logic
    '!src/models/image.js',           // associations removed from index.js — model not used via @models
  ],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
