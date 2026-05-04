/**
 * Jest config cho frontend — dùng .cjs để tránh xung đột với "type": "module"
 * Chỉ chạy .test.cjs files (pure CommonJS, không cần transform TypeScript/ESM)
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.cjs', '**/?(*.)+(spec|test).cjs'],
  transform: {},
  // Không cần transform — test files là CommonJS thuần
};
