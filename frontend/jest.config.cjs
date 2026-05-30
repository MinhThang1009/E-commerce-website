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
  maxWorkers: 2, // Giới hạn worker để tránh OOM trên Windows
  projects: [
    // Project 1: CommonJS utils tests (như trước)
    {
      displayName: 'utils',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.cjs', '**/?(*.)+(spec|test).cjs'],
      transform: {},
    },
    // Project 2: React component tests (mới)
    {
      displayName: 'components',
      testEnvironment: 'jsdom',
      testMatch: ['**/__tests__/**/*.test.tsx', '**/?(*.)+(spec|test).tsx'],
      transform: { '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }] },
      setupFiles: ['<rootDir>/jest.setup.cjs'],
      // Loại shadcn/ui (wrapper Radix) khỏi coverage — đặt trong project vì coverage gom theo project
      coveragePathIgnorePatterns: ['/node_modules/', '[\\\\/]components[\\\\/]ui[\\\\/]'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@features/(.*)$': '<rootDir>/src/features/$1',
        '^@components/(.*)$': '<rootDir>/src/components/$1',
        '^@stores/(.*)$': '<rootDir>/src/stores/$1',
        '^@lib/(.*)$': '<rootDir>/src/lib/$1',
        '^@utils/(.*)$': '<rootDir>/src/utils/$1',
        '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
        '^@types/(.*)$': '<rootDir>/src/types/$1',
        '^@constants$': '<rootDir>/src/constants/index.ts',
        '^@constants/(.*)$': '<rootDir>/src/constants/$1',
        '^@schemas$': '<rootDir>/src/schemas/index.ts',
        '^@schemas/(.*)$': '<rootDir>/src/schemas/$1',
        '^@routes/(.*)$': '<rootDir>/src/routes/$1',
        '^@config/(.*)$': '<rootDir>/src/config/$1',
        '^@assets/(.*)$': '<rootDir>/src/assets/$1',
        '^@styles/(.*)$': '<rootDir>/src/styles/$1',
        '^@pages/(.*)$': '<rootDir>/src/pages/$1',
        '\\.(css|scss|png|jpg|svg)$': '<rootDir>/src/__tests__/__mocks__/fileMock.cjs',
      },
    },
  ],
  // shadcn/ui là wrapper Radix (vendored, storefront-shared) — loại khỏi coverage thay vì viết test rỗng.
  // Regex tách biệt separator để chạy được cả Windows (\) lẫn POSIX (/).
  coveragePathIgnorePatterns: ['/node_modules/', '[\\\\/]components[\\\\/]ui[\\\\/]'],
  // Ngưỡng coverage — chặn regression ở CI (chỉ kích hoạt khi chạy --coverage, vd: npm run test:ci).
  // global = sàn ở mức HIỆN TẠI (project chưa đạt 100% toàn bộ) → không cho tụt xuống thấp hơn.
  // Per-file 100% = khoá các file đã phủ kín, không cho ai làm rớt coverage.
  coverageThreshold: {
    global: {
      statements: 79,
      branches: 67,
      functions: 69,
      lines: 79,
    },
    './src/schemas/auth.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/features/auth/pages/RegisterPage.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/features/auth/pages/ResetPasswordPage.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/features/auth/pages/VerifyEmailPage.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
