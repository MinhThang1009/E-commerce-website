module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // TypeScript compiler xử lý no-undef — tắt để tránh false positive (React JSX transform)
    'no-undef': 'off',
    // Dùng @typescript-eslint/no-unused-vars thay vì no-unused-vars (TS-aware)
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // as any — warn thay vì error vì còn nhiều trong codebase, xử lý dần (AC4)
    '@typescript-eslint/no-explicit-any': 'warn',
    // no-redeclare — tắt vì @typescript-eslint version xử lý chính xác hơn
    'no-redeclare': 'off',
    '@typescript-eslint/no-redeclare': 'warn',
    // Ngăn console.log tái xuất hiện trong code mới — chỉ giữ console.error
    'no-console': ['warn', { allow: ['error', 'warn'] }],
    // Phase 42.19.3 — Architecture guardrails: warn deep import bypass barrel
    'no-restricted-imports': ['warn', {
      patterns: [
        {
          group: ['@/features/*/components/*', '@/features/*/pages/*', '@/features/*/hooks/*', '@/features/*/api/*', '@/features/*/store/*'],
          message: 'Import từ @/features/{name} barrel thay vì deep path (sau Phase 42 modular structure).',
        },
      ],
    }],
  },
};
