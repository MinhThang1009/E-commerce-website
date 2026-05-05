/**
 * Jest config cho frontend — dùng .cjs để tránh xung đột với "type": "module"
 * Chỉ chạy .test.cjs files (pure CommonJS, không cần transform TypeScript/ESM)
 *
 * ⚠️ GIỚI HẠN HIỆN TẠI (lưu ý cho dev tương lai):
 * - Pattern testMatch CHỈ match `*.test.cjs` / `*.spec.cjs`.
 * - File `.test.ts` / `.test.tsx` (vd React component test, hook test) sẽ bị
 *   jest SILENT SKIP — KHÔNG báo lỗi, không chạy. CI cũng không phát hiện.
 *
 * 💡 Nếu cần thêm React component test (Phase 44.3 plan):
 * 1. Cài ts-jest + @testing-library/react + jest-environment-jsdom:
 *    npm i -D ts-jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom
 * 2. Đổi config:
 *    testEnvironment: 'jsdom',
 *    testMatch: ['**\/__tests__/**\/*.test.{cjs,ts,tsx}'],
 *    transform: { '^.+\\.(ts|tsx)$': 'ts-jest' },
 *    setupFilesAfterEach: ['<rootDir>/jest.setup.ts'],
 * 3. Copy pattern từ BE `__tests__/*.unit.test.js` (mock pattern).
 *
 * Hiện tại (2026-05-05): 1 file .test.cjs / 20 tests / utils JSON parsing.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.cjs', '**/?(*.)+(spec|test).cjs'],
  transform: {},
  // Không cần transform — test files là CommonJS thuần
};
