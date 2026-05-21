/**
 * Jest config cho API (HTTP) tests — test HTTP endpoints qua supertest với real DB.
 * Dùng lệnh: npm run test:api
 *
 * Khác với jest.integration.config.js:
 * - Test HTTP layer (routes → controller → service → DB)
 * - Dùng supertest để gửi real HTTP requests
 * - Port riêng (9997) tránh conflict với integration tests (9998)
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__api__/**/*.http.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./src/__api__/setup.js'],
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
  maxWorkers: 1,
  testTimeout: 30000,
  forceExit: true,
  clearMocks: true,
  globalTeardown: './src/__api__/teardown.js',
};
