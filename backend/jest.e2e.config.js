/**
 * Jest config cho E2E tests — kiểm tra toàn bộ user flow qua HTTP với real DB.
 * Dùng lệnh: npm run test:e2e
 *
 * Khác với jest.api.config.js:
 * - Test multi-step user journeys (đăng ký → đăng nhập → mua hàng → đặt hàng)
 * - Mỗi test file = 1 flow hoàn chỉnh, không phải 1 endpoint đơn lẻ
 * - Timeout dài hơn (60s) vì flow có nhiều bước
 * - Port riêng (9996) tránh conflict với các test tiers khác
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/__e2e__/**/*.e2e.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./src/__e2e__/setup.js'],
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
  testTimeout: 60000,
  forceExit: true,
  clearMocks: true,
  globalTeardown: './src/__e2e__/teardown.js',
};
