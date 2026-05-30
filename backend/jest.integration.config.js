/**
 * Jest config cho integration tests — test service/repository layer với real DB.
 * Dùng lệnh: npm run test:integration
 *
 * Khác với jest.config.js (unit):
 * - Không mock Sequelize models
 * - Kết nối MySQL thật
 * - maxWorkers=1 để tránh race condition trên cùng DB
 *
 * Khác với jest.api.config.js (HTTP tests):
 * - Test trực tiếp service/repository, không qua HTTP layer
 * - Không dùng supertest
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__integration__/**/*.integration.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.stryker-tmp/'],
  setupFiles: ['./src/__integration__/setup.js'],
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
  testTimeout: 30000, // HTTP tests qua supertest cần lâu hơn
  forceExit: true,
  clearMocks: true,
  globalTeardown: './src/__integration__/teardown.js',
};
