/**
 * jest.stryker.config.js — Jest config DÀNH RIÊNG cho Stryker mutation testing.
 *
 * Vì sao cần file riêng: Stryker copy project vào thư mục sandbox `.stryker-tmp` rồi chạy jest
 * từ đó. jest.config.js có `testPathIgnorePatterns` chứa `.stryker-tmp` (để jest thường bỏ qua
 * sandbox) — khi Stryker chạy jest BÊN TRONG sandbox, mọi test path khớp ignore nên "No tests
 * found" gây ConfigError, break-threshold không bao giờ được đánh giá. Config này gỡ ignore đó
 * + bỏ coverageThreshold (mutation chạy subset test/mutant nên coverage thấp là bình thường).
 *
 * Self-contained (KHÔNG require jest.config + spread). Giữ ĐỒNG BỘ moduleNameMapper/testMatch
 * với jest.config.js khi 2 file đổi.
 */
module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@modules/(.*)$': '<rootDir>/src/modules/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@models/(.*)$': '<rootDir>/src/models/$1',
    '^@models$': '<rootDir>/src/models',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@jobs/(.*)$': '<rootDir>/src/jobs/$1',
  },
  testMatch: [
    '**/src/__tests__/**/*.test.js',
    '**/src/modules/**/*.test.js',
    '**/src/services/**/*.test.js',
    '**/src/utils/**/*.test.js',
    '**/src/shared/**/*.test.js',
    '**/src/middlewares/**/*.test.js',
    '**/src/models/**/*.test.js',
    '**/src/jobs/**/*.test.js',
  ],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['./src/__tests__/setup.js'],
  clearMocks: true,
  collectCoverage: false,
};
