# TechStore — Chiến Lược Testing

> 5 tầng test, 275 suites, 5.411 test cases, coverage 100% (unit).

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Test Pyramid](#2-test-pyramid)
- [3. Unit Tests](#3-unit-tests)
  - [3.1 Backend Unit Tests](#31-backend-unit-tests)
  - [3.2 Frontend Component Tests](#32-frontend-component-tests)
- [4. Integration Tests](#4-integration-tests)
  - [4.1 Backend Integration Tests](#41-backend-integration-tests)
- [5. API HTTP Tests](#5-api-http-tests)
- [6. E2E Tests](#6-e2e-tests)
- [7. Coverage Requirements](#7-coverage-requirements)
  - [7.1 Backend coverage](#71-backend-coverage)
  - [7.2 Frontend coverage](#72-frontend-coverage)
- [8. Test Naming Convention](#8-test-naming-convention)
- [9. CI/CD Integration](#9-cicd-integration)
- [10. Chạy Tests](#10-chạy-tests)
  - [10.1 Backend](#101-backend)
  - [10.2 Frontend](#102-frontend)
- [11. Test Baseline](#11-test-baseline)
- [12. Common Patterns](#12-common-patterns)
  - [12.1 Mock patterns](#121-mock-patterns)
  - [12.2 Database test setup](#122-database-test-setup)

---

# 1. Tổng quan

TechStore áp dụng chiến lược kiểm thử đa tầng. Mỗi tầng phục vụ mục đích khác nhau và bổ sung cho nhau:

| Suite | Suites | Tests | Runtime | Config |
|---|---|---|---|---|
| BE Unit Tests | 166 | **3.778** | ~10s | `jest.config.js` |
| BE Integration Tests | 42 | **228** | ~50s | `jest.integration.config.js` |
| BE API HTTP Tests | 45 | **866** | ~140s | `jest.api.config.js` |
| BE E2E Tests | 5 | **102** | ~20s | `jest.e2e.config.js` |
| FE Component Tests | 17 | **437** | ~7s | `jest.config.cjs` (frontend/) |
| **Tổng** | **275** | **5.411** | | |

---

# 2. Test Pyramid

```
                    ┌──────────────────┐
                    │  E2E Tests (102) │   ← Full user flows (HTTP + real DB)
                  ┌─┴──────────────────┴─┐
                  │  API HTTP Tests (866) │  ← Endpoint tests (Supertest + real DB)
                ┌─┴──────────────────────┴─┐
                │ Integration Tests (228)   │  ← Service/repo layer (real DB)
              ┌─┴──────────────────────────┴─┐
              │  Unit Tests (3.778 + 437)     │  ← Isolated logic + React components
              └────────────────────────────────┘
```

| Tầng | Framework | Database | Port test server |
|---|---|---|---|
| BE Unit | Jest 29 | Mock (jest.fn()) | — |
| BE Integration | Jest 29 | MySQL thật (`techstore_test`) | 9998 |
| BE API HTTP | Jest 29 + Supertest | MySQL thật (`techstore_test`) | 9997 |
| BE E2E | Jest 29 + Supertest | MySQL thật (`techstore_test`) | 9996 |
| FE Component | Jest 29 + ts-jest + @testing-library/react | jsdom | — |

---

# 3. Unit Tests

## 3.1 Backend Unit Tests

**Mục đích**: Kiểm tra logic nghiệp vụ của từng hàm trong isolation hoàn toàn. Mọi external dependency (Sequelize models, email, AI, Redis) đều được mock bằng `jest.fn()`.

**Phạm vi**: 166 test suites, 3.778 test cases.
- Tất cả Service classes (19 modules × nhiều methods)
- Repository classes
- Controller handlers (input/output, error paths)
- Utility functions (`logger`, `i18n`, `catch-async`, `image-url`)
- Middleware (`authenticate`, `authorize`, `rate-limiter`, `validate-request`, `cache`, `detect-locale`)
- Models và validators
- Cron job functions (`runDailyCleanup`, `runWeeklyCleanup`)
- EventBus, UnitOfWork, AdminAuditService

**Vị trí file test**:
```
backend/src/
├── __tests__/                    # Cross-cutting tests
├── modules/<name>/*.test.js      # Co-located unit tests của module
├── services/**/*.test.js
├── utils/**/*.test.js
├── shared/**/*.test.js
├── middlewares/**/*.test.js
├── models/**/*.test.js
└── jobs/**/*.test.js
```

**Config**: `backend/jest.config.js`
- `testMatch`: patterns trên + `src/__tests__/**/*.test.js`
- `setupFiles`: `./src/__tests__/setup.js` (mock toàn cục)
- `clearMocks: true` (reset mocks giữa các tests)
- Các file excluded khỏi coverage: `module.js` (DI wiring), `index.js` (barrel), `*-dto.js`, `i-*-repository.js`, `app.js`, `server.js`, migrations, seeders, config

## 3.2 Frontend Component Tests

**Mục đích**: Kiểm tra React components, Zustand stores, và utility functions trong môi trường jsdom.

**Phạm vi**: 17 test suites, 437 test cases.
- Zustand stores (auth, cart, chat, catalog, wishlist, ui) — state transitions
- Utility functions (formatters, validators, token-manager)
- React components (render, user interactions, conditional rendering)

**Vị trí file test**:
```
frontend/src/__tests__/
├── *.test.cjs      # CommonJS utils tests (jsdom/node)
└── *.test.tsx      # React component tests (ts-jest, jsdom)
```

**Config**: `frontend/jest.config.cjs`
- 2 projects: `utils` (node env, `.test.cjs`) + `components` (jsdom env, `.test.tsx`)
- `components` project dùng `ts-jest` với `jsx: react-jsx`
- Module aliases được map tương ứng với `vite.config.ts`
- `setupFiles`: `jest.setup.cjs` (mock globals: localStorage, sessionStorage, matchMedia)

---

# 4. Integration Tests

## 4.1 Backend Integration Tests

**Mục đích**: Kiểm tra Service và Repository layer với database MySQL thật. Xác nhận logic nghiệp vụ hoạt động đúng với SQL queries thực tế, transactions, và constraints.

**Phạm vi**: 42 test suites, 228 test cases.
- Service methods với real DB queries (thay vì mock)
- Repository queries (Sequelize findAll, create, update, destroy với real schema)
- Transactions và `runInTransaction` / `lockRow`
- Race conditions và concurrent stock deductions
- Business flow tests (order → inventory chain)

**Vị trí file test**:
```
backend/src/__integration__/
└── **/*.integration.test.js
```

**Config**: `backend/jest.integration.config.js`
- `testMatch`: `**/src/__integration__/**/*.integration.test.js`
- `maxWorkers: 1` — chạy tuần tự tránh race condition trên cùng DB
- `testTimeout: 30000` (30s) — DB operations cần thời gian
- `globalTeardown`: `./src/__integration__/teardown.js` — cleanup DB sau toàn bộ suite

**Setup**: `./src/__integration__/setup.js`
- Kết nối MySQL thật với `DB_NAME_TEST` (mặc định `techstore_test`)
- Load tất cả models và associations
- Truncate tables cần thiết trước mỗi test file (isolate data)

---

# 5. API HTTP Tests

**Mục đích**: Kiểm tra toàn bộ HTTP layer — từ routes đến middleware chain đến DB. Dùng Supertest để gửi real HTTP requests đến Express app.

**Phạm vi**: 45 test suites, 866 test cases.
- Authentication (JWT verify, token refresh, blacklist)
- Authorization (role check — user vs admin endpoints)
- Input validation (Zod schemas — valid/invalid payloads)
- HTTP status codes (200/201/400/401/403/404/409/500)
- Response body structure
- Rate limiting behavior
- Cache headers

**Vị trí file test**:
```
backend/src/__api__/
└── **/*.http.test.js
```

**Config**: `backend/jest.api.config.js`
- `testMatch`: `**/src/__api__/**/*.http.test.js`
- `maxWorkers: 1`
- `testTimeout: 30000`
- `globalTeardown`: `./src/__api__/teardown.js`
- Port server test: 9997 (tránh conflict với integration port 9998)

**Setup**: `./src/__api__/setup.js`
- Khởi động Express app trên port 9997
- Kết nối MySQL thật, load models
- Tạo test users (user role + admin role) cho authentication tests

---

# 6. E2E Tests

**Mục đích**: Kiểm tra toàn bộ user journey end-to-end qua HTTP. Mỗi test file = 1 flow hoàn chỉnh nhiều bước.

**Phạm vi**: 5 test suites, 102 test cases.
- Flow đăng ký → xác thực email → đăng nhập
- Flow mua hàng: browse sản phẩm → thêm giỏ → checkout → đặt hàng → thanh toán
- Flow quản trị: tạo sản phẩm → cập nhật tồn kho → xử lý đơn hàng
- Flow đặt hàng → DELIVERED → xác nhận trạng thái
- Flow discount: tạo mã → apply → validate usedCount

**Vị trí file test**:
```
backend/src/__e2e__/
└── **/*.e2e.test.js
```

**Config**: `backend/jest.e2e.config.js`
- `testMatch`: `**/src/__e2e__/**/*.e2e.test.js`
- `maxWorkers: 1`
- `testTimeout: 60000` (60s — flows có nhiều bước)
- Port server test: 9996

**Đặc điểm**:
- Mỗi test file dọn dữ liệu của chính nó (không dùng chung data với file khác)
- State xây dần qua các `it()` trong cùng `describe()` — có thứ tự phụ thuộc
- Tập trung vào "happy path" + 1-2 critical error paths

---

# 7. Coverage Requirements

## 7.1 Backend coverage

Coverage được tính trên file `coverage/coverage-summary.json` sau khi chạy unit tests.

**Threshold hiện tại** (trong `jest.config.js`):
```javascript
coverageThreshold: {
  global: {
    statements: 99,   // current: 100%
    branches: 97,     // buffer 3% cho nhánh khó cover (||, ??, ternary)
    functions: 99,    // current: 100%
    lines: 99,        // current: 100%
  }
}
```

**CI threshold** (trong `.github/workflows/ci.yml`):
```
Statements >= 97%
Lines      >= 97%
Branches   >= 85%
Functions  >= 95%
```

CI threshold thấp hơn local để không fail khi thêm file mới chưa có test. Tăng dần theo thời gian.

**Files excluded khỏi coverage** (có lý do cụ thể):
- `module.js` — DI wiring, không có business logic
- `index.js` (barrel files) — chỉ re-export
- `app.js`, `server.js` — startup/wiring, test qua integration
- `migrations/`, `seeders/` — DB scripts, không có logic test
- `config/` — configuration objects
- `*-dto.js` — data shapes, không có logic
- `i-*-repository.js`, `i-*-service.js` — interface definitions

**Files với istanbul ignore** (comment `/* istanbul ignore */`): Branches không thể cover thực tế (OS-dependent code, fallback paths trong edge cases hiếm gặp). Danh sách đầy đủ xem [`MEMORY.md`](C:\Users\Admin\.claude\projects\d--QUAN-TR-NG-e-commerce-website\memory\project_test_state.md).

## 7.2 Frontend coverage

Frontend chạy `npm run test:ci` để generate coverage.

- Coverage được enforce qua `jest.config.cjs`
- Target: 100% cho tất cả files trong `src/__tests__/`
- Component tests dùng `@testing-library/react` + `@testing-library/user-event`

---

# 8. Test Naming Convention

**Quy định bắt buộc**: Tất cả test descriptions viết bằng **tiếng Việt** (quy định đồ án — hội đồng bảo vệ sẽ đọc).

```javascript
// Backend — đúng
describe('AuthService', () => {
  describe('register', () => {
    test('trả về user mới khi email chưa tồn tại', async () => { ... });
    test('ném lỗi 409 khi email đã tồn tại', async () => { ... });
    test('hash mật khẩu trước khi lưu vào DB', async () => { ... });
  });

  describe('login', () => {
    test('trả về tokens khi thông tin đăng nhập đúng', async () => { ... });
    test('ném lỗi 401 khi mật khẩu sai', async () => { ... });
    test('ném lỗi 401 khi email chưa xác thực', async () => { ... });
  });
});

// Frontend — đúng
describe('useCartStore', () => {
  test('thêm item mới vào giỏ hàng', () => { ... });
  test('tăng số lượng nếu item đã tồn tại', () => { ... });
  test('tính đúng totalItems và subtotal sau khi thêm', () => { ... });
});
```

**Format tên test**: `<hành động/trạng thái> khi/nếu <điều kiện>` hoặc `<hành động> → <kết quả mong đợi>`.

**Sai** (không được dùng):
```javascript
test('test login 2', ...)          // không mô tả
test('should return user', ...)    // tiếng Anh
test('loginSucceeds', ...)         // không rõ điều kiện
```

**Đặt tên file test**:
- Unit: `<service-name>.test.js` (co-located hoặc trong `__tests__/`)
- Integration: `<module-name>.integration.test.js`
- API HTTP: `<module-name>.http.test.js`
- E2E: `<flow-name>.e2e.test.js`
- Frontend: `<component-name>.test.tsx` hoặc `<utility>.test.cjs`

---

# 9. CI/CD Integration

GitHub Actions workflow (`.github/workflows/ci.yml`) chạy trên `push` đến `main`, `phase-*`, `feat/*`, `fix/*` và `pull_request` vào `main`.

**Backend job** (ubuntu-latest, Node 22, timeout 20 phút):
1. `npm ci` — install dependencies
2. `npm run lint:strict` — ESLint zero warnings
3. `bash scripts/lint-migrations.sh` — kiểm tra tất cả migrations có `down()` rollback
4. `npm audit --audit-level=high` — security audit (continue-on-error)
5. Jest unit tests + coverage (không có DB — chỉ mock)
6. Enforce coverage thresholds: Stmts >= 97%, Lines >= 97%, Branches >= 85%, Fns >= 95%
7. Upload coverage artifact (`backend-coverage`, retention 7 ngày)

**Frontend job** (ubuntu-latest, Node 22, timeout 15 phút):
1. `npm ci`
2. `npm run lint` — ESLint
3. `npm run typecheck` — `tsc --noEmit`
4. `npm audit --audit-level=high` — security audit (continue-on-error)
5. `npm run build` — production build với `VITE_API_URL=http://localhost:8888/api`
6. Bundle size check: `dist/` phải <= 10MB
7. Upload build artifact (`frontend-dist`, retention 3 ngày)

**Lưu ý quan trọng**: CI **không chạy** Integration Tests, API HTTP Tests, hay E2E Tests vì chúng cần MySQL thật. Chỉ chạy được locally hoặc trên server có MySQL setup. Trong CI, Backend coverage được đảm bảo hoàn toàn qua Unit Tests (mock DB).

**Husky pre-commit hooks** (`.husky/pre-commit`):
1. Secret scanning — block commit nếu phát hiện AWS keys, Stripe live keys, GitHub tokens, private keys, hardcoded passwords trong staged files
2. Block `.env` files (trừ `.env.example`)
3. `scripts/audit-architecture.sh` — kiểm tra: service không import Sequelize trực tiếp, controller không touch ORM, không có cross-module deep imports
4. Frontend `lint-staged` (ESLint + Prettier cho changed files)
5. Frontend `tsc --noEmit`
6. Backend `lint-staged` (ESLint + Prettier cho changed files)

---

# 10. Chạy Tests

## 10.1 Backend

```bash
cd backend

# Unit tests + coverage (CI mode)
npm run test

# Unit tests không coverage (nhanh hơn)
npm run test:fast

# Chạy test 1 file cụ thể
npm run test:file -- <pattern>

# Integration tests (cần MySQL thật)
npm run test:integration

# API HTTP tests (cần MySQL thật)
npm run test:api

# E2E tests (cần MySQL thật)
npm run test:e2e

# Lint
npm run lint
```

**Setup MySQL cho Integration/API/E2E tests**:
1. Tạo database `techstore_test` trong MySQL
2. Set `DB_NAME_TEST=techstore_test` trong `.env`
3. Chạy migrations: `npm run db:migrate` (với `NODE_ENV=test` hoặc đảm bảo `DB_NAME` trỏ đúng)

## 10.2 Frontend

```bash
cd frontend

# Component tests
npm test

# CI mode + coverage
npm run test:ci

# Coverage only
npm run test:coverage

# TypeScript check
npm run typecheck

# Lint
npm run lint

# Production build
npm run build
```

---

# 11. Test Baseline

Đây là baseline chính thức tại thời điểm cập nhật tài liệu:

| Suite | Suites | Tests | Runtime |
|---|---|---|---|
| BE Unit Tests | 166 | 3.778 | ~10s |
| BE Integration Tests | 42 | 228 | ~50s |
| BE API HTTP Tests | 45 | 866 | ~140s |
| BE E2E Tests | 5 | 102 | ~20s |
| FE Component Tests | 17 | 437 | ~7s |
| **Tổng** | **275** | **5.411** | |

**Coverage (local unit tests)**:
- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

**Ràng buộc khi thêm code mới**:
- Mọi service method mới → phải có unit test tương ứng
- Mọi feature mới → phải có ít nhất 1 integration test cho happy path
- Bug fix → viết failing test trước, mới fix (TDD)
- Coverage không được giảm dưới threshold CI (Stmts 97%, Lines 97%, Branches 85%, Fns 95%)

---

# 12. Common Patterns

## 12.1 Mock patterns

**Mock Sequelize model**:
```javascript
// setup.js hoặc đầu file test
jest.mock('@models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    count: jest.fn(),
  },
  // ... các models khác
}));
```

**Mock service trong controller test**:
```javascript
const mockService = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

// Inject vào controller factory
const controller = createController({ service: mockService });
```

**Mock EventBus**:
```javascript
jest.mock('@shared/event-bus', () => ({
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockReturnValue(() => {}),
}));
```

**Mock email service**:
```javascript
jest.mock('@services/email', () => ({
  sendOTPEmail: jest.fn().mockResolvedValue(true),
  sendOrderConfirmation: jest.fn().mockResolvedValue(true),
}));
```

**Mock Redis (trong unit tests)**:
```javascript
const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};
jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(mockRedisClient),
}));
```

**Arrange-Act-Assert pattern**:
```javascript
test('tạo đơn hàng thành công khi tồn kho đủ', async () => {
  // Arrange
  const mockOrder = { id: 1, status: 'pending', totalAmount: 500000 };
  Order.create.mockResolvedValue(mockOrder);
  ProductVariant.findOne.mockResolvedValue({ stockQuantity: 10 });

  // Act
  const result = await ordersService.createOrder(createOrderDto, userId);

  // Assert
  expect(result.status).toBe('pending');
  expect(eventBus.publish).toHaveBeenCalledWith(
    expect.objectContaining({ type: 'order.created' })
  );
});
```

## 12.2 Database test setup

**Integration và API tests** dùng MySQL thật với database `techstore_test`:

```javascript
// src/__integration__/setup.js
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_TEST || 'techstore_test';

// Kết nối và load models
require('module-alias/register');
require('dotenv').config();
const { sequelize } = require('@models');

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});
```

**Data isolation**: Mỗi integration test file tự truncate tables cần thiết trong `beforeEach` hoặc `beforeAll`. Không dùng transactions để rollback (phức tạp với Sequelize associations).

**Port conflicts**: Mỗi test tier dùng port server riêng:
- Integration: 9998
- API HTTP: 9997
- E2E: 9996

Để chạy đồng thời nhiều tiers, các ports này phải không bị chiếm. Nếu bị conflict: `npm run kill` (backend) hoặc đổi port trong setup file.

**Supertest setup (API/E2E)**:
```javascript
// src/__api__/setup.js
const app = require('../../app');
const supertest = require('supertest');

let server;
let request;

beforeAll(async () => {
  server = app.listen(9997);
  request = supertest(server);
  global.request = request;
  // Tạo test users...
});

afterAll(async () => {
  server.close();
});
```
