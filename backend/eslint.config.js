// Phase 42.19.3 — Backend ESLint flat config (Modular Monolith architecture rules)
// Rule chính: enforce 3-layer separation
//   - services/ KHÔNG được import sequelize hoặc models/* (phải qua repository)
//   - controllers/ KHÔNG được import sequelize, models/*, repositories/* (phải qua service)

module.exports = [
  {
    ignores: ['node_modules/**', 'coverage/**', 'data/**', 'logs/**'],
  },
  {
    files: ['src/modules/*/services/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'sequelize', message: 'Service KHÔNG được import Sequelize. Dùng repository thay vì truy cập ORM trực tiếp.' },
        ],
        patterns: [
          { group: ['**/models/*'], message: 'Service không được import Model trực tiếp. Đi qua repository.' },
        ],
      }],
    },
  },
  {
    files: ['src/modules/*/controllers/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'sequelize', message: 'Controller KHÔNG được import Sequelize. Delegate sang service.' },
        ],
        patterns: [
          { group: ['**/models/*'], message: 'Controller không được import Model. Delegate sang service.' },
          { group: ['**/repositories/*'], message: 'Controller không được import Repository. Delegate sang service.' },
        ],
      }],
    },
  },
  {
    files: ['src/modules/**/*.js'],
    rules: {
      'no-restricted-imports': ['warn', {
        patterns: [
          {
            group: ['../../[a-z]*/services/*', '../../[a-z]*/repositories/*', '../../[a-z]*/domain/*', '../../[a-z]*/models/*'],
            message: 'Cross-module deep import bị block. Dùng DI hoặc eventBus thay vì require thẳng module khác.',
          },
        ],
      }],
    },
  },
];
