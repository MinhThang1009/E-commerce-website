import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage', '*.config.*', '*.config.cjs', 'jest.setup.cjs'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2020 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-undef': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-redeclare': 'off',
      '@typescript-eslint/no-redeclare': 'warn',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      'no-restricted-imports': [
        'warn',
        {
          patterns: [
            {
              group: [
                '@/features/*/components/*',
                '@/features/*/pages/*',
                '@/features/*/hooks/*',
                '@/features/*/api/*',
                '@/features/*/store/*',
              ],
              message:
                'Import từ @/features/{name} barrel thay vì deep path (sau Phase 42 modular structure).',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['src/__tests__/**/*.{ts,tsx,cjs}', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-redeclare': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-restricted-imports': 'off',
      'no-console': 'off',
    },
  },
);
