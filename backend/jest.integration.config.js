/**
 * Jest config cho integration tests — chạy với database thật (test_db).
 * Dùng lệnh: npm run test:integration
 *
 * Khác với jest.config.js (unit):
 * - Không mock Sequelize models
 * - Kết nối MySQL thật (test_db)
 * - maxWorkers=1 để tránh race condition trên cùng DB
 * - Timeout dài hơn (10s/test)
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__integration__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
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
