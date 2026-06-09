// Backend ESLint flat config — Naming conventions + Architecture rules
//
// NAMING CONVENTIONS (JS standard):
//   camelCase           — biến, hàm, tham số, local const
//   PascalCase          — class, constructor
//   SCREAMING_SNAKE_CASE— global/module-level constants (primitive values)
//   _camelCase          — private by convention
//   kebab-case          — tên file và folder (enforce qua unicorn/filename-case)
//
// ARCHITECTURE RULES (Modular Monolith):
//   services/    — KHÔNG import sequelize/models/* trực tiếp
//   controllers/ — KHÔNG import sequelize/models*/repositories/*
//   cross-module — KHÔNG deep import vào module khác

const unicorn = require('eslint-plugin-unicorn').default;
const security = require('eslint-plugin-security');

module.exports = [
  {
    ignores: [
      'node_modules/**', 'coverage/**', 'data/**', 'logs/**',
      'migrations/**',   'scripts/**',
    ],
  },

  // ── 0. Security rules ─────────────────────────────────────────────────────
  {
    files: ['src/**/*.js'],
    ignores: ['src/**/*.test.js', 'src/__tests__/**', 'src/__integration__/**', 'src/__api__/**', 'src/__e2e__/**'],
    plugins: { security },
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-regexp': 'off',
      'security/detect-non-literal-require': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-eval-with-expression': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
    },
  },

  // ── 1. File naming: kebab-case ─────────────────────────────────────────────
  {
    files: ['src/**/*.js'],
    ignores: ['src/migrations/**'],  // migrations không rename (Sequelize track theo filename)
    plugins: { unicorn },
    rules: {
      // Tất cả file phải là kebab-case
      // warn (không error) vì còn legacy PascalCase files — rename dần theo sprint
      'unicorn/filename-case': ['warn', {
        cases: { kebabCase: true },
      }],
    },
  },

  // ── 2. Identifier naming conventions ───────────────────────────────────────
  {
    files: ['src/**/*.js'],
    rules: {
      // camelCase cho biến/hàm; allow SCREAMING_SNAKE_CASE cho module-level constants
      camelcase: ['error', {
        properties: 'never',       // không enforce object keys (DB thường snake_case)
        ignoreDestructuring: true, // { user_id } từ DB/request body được phép
        ignoreGlobals: true,       // process, __dirname, __filename...
        allow: [
          '^[A-Z][A-Z0-9_]+$', // SCREAMING_SNAKE_CASE constants
          '^vnp_',              // VNPay payment gateway API params (external convention)
          '^momo_',             // MoMo payment API params
        ],
      }],

      // PascalCase bắt buộc cho constructor/class
      'new-cap': ['error', {
        newIsCap: true,
        capIsNew: false, // factory function có thể PascalCase mà không dùng new
        capIsNewExceptions: ['Boolean', 'Number', 'String', 'Object', 'Array', 'Symbol'],
      }],

      // Cấm var — chỉ dùng const/let
      'no-var': 'error',

      // Dùng const khi không reassign
      'prefer-const': ['error', { destructuring: 'any', ignoreReadBeforeAssign: false }],

      // Tránh shadow variable — dễ gây bug
      'no-shadow': ['warn', {
        builtinGlobals: false,
        hoist: 'functions',
        allow: ['err', 'error', 'resolve', 'reject', 'next', 'req', 'res', 'e'],
      }],

      // Identifier tối thiểu 2 ký tự (trừ các ký tự thông dụng)
      'id-length': ['warn', {
        min: 2,
        exceptions: [
          'i', 'j', 'k',  // loop counters
          'n', 'x', 'y', 'z', // math vars
          '_',             // intentionally unused param
          'e',             // error in catch
          't',             // translation key
          'q', 'v', 'p',   // query/value/page
          'l', 'r', 's',   // left/right/sum trong reducers
          'a', 'b',        // sort comparator (a, b) => a - b
          'c', 'o', 'm',   // common arrow param aliases
          'w',             // width
          'u', 'd', 'h', 'f', // update/delete/handler/flag shortcuts trong callbacks
          'g',             // group
        ],
      }],
    },
  },

  // ── 3. Architecture: layer separation ──────────────────────────────────────
  {
    files: ['src/modules/*/services/**/*.js', 'src/modules/*/services/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'sequelize', message: 'Service KHÔNG được import Sequelize trực tiếp. Dùng repository.' },
        ],
        patterns: [
          { group: ['**/models/*', '@models/*'], message: 'Service không được import Model. Đi qua repository.' },
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
          { group: ['**/models/*', '@models/*'], message: 'Controller không được import Model. Delegate sang service.' },
          { group: ['**/repositories/*'],        message: 'Controller không được import Repository. Delegate sang service.' },
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
            group: [
              '../../[a-z]*/services/*', '../../[a-z]*/repositories/*',
              '../../[a-z]*/domain/*',   '../../[a-z]*/models/*',
            ],
            message: 'Cross-module deep import bị cảnh báo. Dùng DI hoặc @modules/X.',
          },
        ],
      }],
    },
  },

  // ── 4. Test files — relax no-shadow ────────────────────────────────────────
  // Test files thường dùng scoped variables trùng tên với outer scope (describe mock setup).
  // no-shadow warning gây nhiễu nhưng không ảnh hưởng correctness trong test context.
  {
    files: [
      'src/**/*.test.js',
      'src/__integration__/**',
      'src/__api__/**',
      'src/__e2e__/**',
      'src/__tests__/**',
    ],
    rules: {
      'no-shadow': 'off',
    },
  },
];
