# TechStore — Chiến Lược Testing

> 5 tầng test, 259 suites, ~5.479 test cases, coverage 100% lines / 99,81% branches (unit).

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
| BE Unit Tests | 158 | **3.737** | ~20s | `jest.config.js` |
| BE Integration Tests | 36 | **184** | ~55s | `jest.integration.config.js` |
| BE API HTTP Tests | 39 | **700** | ~230s | `jest.api.config.js` |
| BE E2E Tests | 5 | **100** | ~25s | `jest.e2e.config.js` |
| FE Component Tests | 21 | **758** | ~12s | `jest.config.cjs` (frontend/) |
| **Tổng** | **259** | **5.479** | | |

---

# 2. Test Pyramid

```
                    ┌──────────────────┐
                    │  E2E Tests (100) │   ← Full user flows (HTTP + real DB)
                  ┌─┴──────────────────┴─┐
                  │  API HTTP Tests (700) │  ← Endpoint tests (Supertest + real DB)
                ┌─┴──────────────────────┴─┐
                │ Integration Tests (184)   │  ← Service/repo layer (real DB)
              ┌─┴──────────────────────────┴─┐
              │  Unit Tests (3.737 + 758)      │  ← Isolated logic + React components
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

**Mục đích**: Kiểm tra logic nghiệp vụ của từng hàm trong isolation hoàn toàn. Mọi external dependency (Sequelize models, email, AI) đều được mock bằng `jest.fn()`.

**Phạm vi**: 158 test suites, 3.737 test cases.
- Tất cả Service classes (17 modules × nhiều methods)
- Repository classes
- Controller handlers (input/output, error paths)
- Utility functions (`logger`, `i18n`, `catch-async`, `image-url`)
- Middleware (`authenticate`, `authorize`, `rate-limiter`, `validate-request`, `detect-locale`)
- Models và validators
- Cron job functions (`runDailyCleanup`, `runWeeklyCleanup`)
- EventBus, UnitOfWork

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
- `setupFiles`: `./src/__tests__/setup.js` — set env vars (`NODE_ENV=test`, `JWT_SECRET`, `DB_NAME=test_db`, `PORT=9999`) trước khi tests load
- `clearMocks: true` (reset mocks giữa các tests)
- Files excluded khỏi coverage: xem danh sách đầy đủ tại [§7.1](#71-backend-coverage)

## 3.2 Frontend Component Tests

**Mục đích**: Kiểm tra React components, Zustand stores, và utility functions trong môi trường jsdom.

**Phạm vi**: 21 test suites, 758 test cases.
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
- `setupFiles` (chỉ áp dụng cho project `components`): `jest.setup.cjs` — polyfill `React.default`, mock `matchMedia` và `localStorage`

---

# 4. Integration Tests

## 4.1 Backend Integration Tests

**Mục đích**: Kiểm tra Service và Repository layer với database MySQL thật. Xác nhận logic nghiệp vụ hoạt động đúng với SQL queries thực tế, transactions, và constraints.

**Phạm vi**: 36 test suites, 184 test cases.
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
- Hardcode `DB_NAME = 'techstore_test'` (không cần env var riêng)
- Tất cả test data tạo với prefix `__INT_TEST_` và tự cleanup trong `afterAll`

---

# 5. API HTTP Tests

**Mục đích**: Kiểm tra toàn bộ HTTP layer — từ routes đến middleware chain đến DB. Dùng Supertest để gửi real HTTP requests đến Express app.

**Phạm vi**: 39 test suites, 700 test cases.
- Authentication (JWT verify, token refresh, token reuse detection)
- Authorization (role check — user vs admin endpoints)
- Input validation (Zod schemas — valid/invalid payloads)
- HTTP status codes (200/201/400/401/403/404/409/500)
- Response body structure
- Rate limiting behavior
- HTTP headers

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

**Setup**: `./src/__api__/setup.js` + `./src/__api__/http-setup.js`
- `setup.js` set env vars (port 9997, JWT secrets, `DB_NAME = 'techstore_test'`)
- Mỗi test file import `http-setup.js` để dùng `createTestUser` / `createTestProduct` (prefix `__HTTP_`)
- Cleanup tự động qua `globalTeardown` sau toàn bộ suite

---

# 6. E2E Tests

**Mục đích**: Kiểm tra toàn bộ user journey end-to-end qua HTTP. Mỗi test file = 1 flow hoàn chỉnh nhiều bước.

**Phạm vi**: 5 test suites, 100 test cases.
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
- `globalTeardown`: `./src/__e2e__/teardown.js`
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
    statements: 99.7, // current: 99.98%
    branches: 99.7,   // current: 99.81%
    functions: 99.4,  // current: 99.91%
    lines: 99.7,      // current: 100%
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
- `i-*-repository.js`, `i-*-service.js`, `I*.js` — interface definitions
- `src/routes/imageProxy.js` — proxy utility, không có business logic

**Files với istanbul ignore** (comment `/* istanbul ignore */`): Branches không thể cover thực tế — OS-dependent code, fallback paths trong edge cases hiếm gặp (ví dụ: catch branches của dynamic require).

## 7.2 Frontend coverage

Frontend chạy `npm run test:ci` để generate coverage.

- `jest.config.cjs` ĐẶT `coverageThreshold`: global floor (statements/lines 79%, branches 67%, functions 69%) + per-file 100% cho `src/schemas/auth.ts` và 3 auth pages (`RegisterPage`, `ResetPasswordPage`, `VerifyEmailPage`). CI fail nếu dưới ngưỡng.
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

GitHub Actions workflow (`.github/workflows/ci.yml`) chạy trên `push` đến `main`, `phase-*`, `feat/*`, `fix/*`, `refactor/*` và `pull_request` vào `main`.

**Backend job** (ubuntu-latest, Node 22, timeout 20 phút):
1. `npm ci` — install dependencies
2. `npm run lint:strict` — ESLint zero warnings
3. `bash scripts/lint-migrations.sh` — kiểm tra tất cả migrations có `down()` rollback
4. `npm audit --audit-level=high --omit=dev` — security audit (continue-on-error)
5. Jest unit tests + coverage (không có DB — chỉ mock)
6. Enforce coverage thresholds: Stmts >= 97%, Lines >= 97%, Branches >= 85%, Fns >= 95%
7. Upload coverage artifact (`backend-coverage`, retention 7 ngày)

**Frontend job** (ubuntu-latest, Node 22, timeout 15 phút):
1. `npm ci`
2. `npm run lint` — ESLint
3. `npm run typecheck` — `tsc --noEmit`
4. `npm audit --audit-level=high --omit=dev` — security audit (continue-on-error)
5. `npm run build` — production build với `VITE_API_URL=http://localhost:8888/api`
6. Bundle size check: `dist/` phải <= 10MB
7. Upload build artifact (`frontend-dist`, retention 3 ngày)

**Lưu ý quan trọng**: CI **không chạy** Integration Tests, API HTTP Tests, hay E2E Tests vì chúng cần MySQL thật. Chỉ chạy được locally hoặc trên server có MySQL setup. Trong CI, Backend coverage được đảm bảo hoàn toàn qua Unit Tests (mock DB).

**Husky pre-commit hooks** (`.husky/pre-commit`):
1. Secret scanning + block `.env` files — cùng một `if` block: quét staged files tìm AWS keys/Stripe/GitHub tokens/private keys/hardcoded passwords; block `.env.*` (trừ `.env.example`)
2. `scripts/audit-architecture.sh` — kiểm tra: service không import Sequelize trực tiếp, controller không touch ORM, không có cross-module deep imports
3. Frontend `lint-staged` (ESLint + Prettier cho changed files)
4. Frontend `tsc --noEmit`
5. Backend `lint-staged` (ESLint + Prettier cho changed files)

---

# 10. Chạy Tests

## 10.1 Backend

```bash
cd backend

# Unit tests + coverage
npm run test

# Unit tests không coverage (nhanh hơn)
npm run test:fast

# Unit tests CI mode (--ci --runInBand)
npm run test:ci

# Unit tests + watch mode
npm run test:watch

# Chạy test 1 file cụ thể (không coverage)
npm run test:file -- <pattern>

# Chạy 1 file với coverage
npm run test:cov -- <pattern>

# Integration tests (cần MySQL thật — techstore_test)
npm run test:integration

# API HTTP tests (cần MySQL thật — techstore_test)
npm run test:api

# E2E tests (cần MySQL thật — techstore_test)
npm run test:e2e

# Lint
npm run lint
```

**Setup MySQL cho Integration/API/E2E tests**:
- Tất cả test tiers (Integration, API HTTP, E2E) đều dùng `techstore_test`
- DB name được hardcode trong setup files — không cần env var riêng khi chạy tests

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
| BE Unit Tests | 158 | 3.737 | ~20s |
| BE Integration Tests | 36 | 184 | ~55s |
| BE API HTTP Tests | 39 | 700 | ~230s |
| BE E2E Tests | 5 | 100 | ~25s |
| FE Component Tests | 21 | 758 | ~12s |
| **Tổng** | **259** | **5.479** | |

**Coverage (local unit tests)**:
- Statements: 99,98% (threshold 99,7%)
- Branches: 99,81% (threshold 99,7% — 7 nhánh hard-to-test còn lại: module-level guards, short-circuit ||/&& defensive)
- Functions: 99,91% (threshold 99,4%)
- Lines: **100%** (threshold 99,7%)

**Ràng buộc khi thêm code mới**:
- Mọi service method mới → phải có unit test tương ứng
- Mọi feature mới → phải có ít nhất 1 integration test cho happy path
- Bug fix → viết failing test trước, mới fix (TDD)
- Coverage không được giảm dưới threshold CI (Stmts 97%, Lines 97%, Branches 85%, Fns 95%)

---

# 12. Common Patterns

## 12.1 Mock patterns

**Mock data layer qua DI** — unit test KHÔNG dùng `jest.mock('@models')`; service nhận `repository` là plain mock object qua constructor (Sequelize không bị mock trực tiếp):
```javascript
const repo = {
  runInTransaction: jest.fn(async (work) => work({})),  // chạy callback với tx giả
  findProductWithDefaultVariant: jest.fn(),
  lockProduct: jest.fn(),
  createOrder: jest.fn(),
  // ... các method repo khác
};
const service = new OrdersService({ ordersRepository: repo, emailGateway, eventBus, logger, constants });
```
> `jest.mock(...)` chỉ dùng cho external lib (vd `jest.mock('axios')`) + vài repository cụ thể — KHÔNG cho `@models`/`@shared/event-bus`/`@services/email`.

**Mock service trong controller test**:
```javascript
const mockOrdersService = {
  createOrder: jest.fn(),
  getUserOrders: jest.fn(),
  cancelOrder: jest.fn(),
};

// Inject vào controller constructor (DI pattern)
const controller = new OrdersController({ ordersService: mockOrdersService });
```

**Mock EventBus** — plain object inject qua DI (KHÔNG `jest.mock('@shared/event-bus')`):
```javascript
const eventBus = { publish: jest.fn().mockResolvedValue() };
const service = new OrdersService({ ordersRepository: repo, eventBus, /* ... */ });
```

**Mock email** — qua `emailGateway` adapter object inject vào service (KHÔNG `jest.mock('@services/email')`). `email.js` export 7 hàm (`sendEmail`, `sendOtpEmail`, `sendResetPasswordEmail`, `sendOrderConfirmationEmail`, `sendOrderStatusUpdateEmail`, `sendOrderCancellationEmail`, `sendAdminFeedbackNotification`); test chỉ mock các hàm gateway cần dùng:
```javascript
const emailGateway = {
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue(),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(),
};
const service = new OrdersService({ ordersRepository: repo, emailGateway, /* ... */ });
```

**Arrange-Act-Assert pattern**:
```javascript
test('tạo đơn hàng thành công khi tồn kho đủ', async () => {
  // Arrange
  const mockOrder = { id: 1, status: 'pending', total: 500000 };
  repo.findProductWithDefaultVariant.mockResolvedValue(product);
  repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
  repo.createOrder.mockResolvedValue(mockOrder);

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

**Tất cả test tiers** (Integration, API HTTP, E2E) đều dùng `techstore_test`:

```javascript
// src/__integration__/setup.js
require('module-alias/register');
require('dotenv').config();

process.env.NODE_ENV = 'development'; // nới lỏng rate limit 10x
process.env.DB_NAME = 'techstore_test';
process.env.PORT = '9998';
// JWT_SECRET, JWT_REFRESH_SECRET hardcoded cho test
```

**Data isolation**: Mỗi integration test file tự tạo data với prefix `__INT_TEST_` trong `beforeAll` và tự xóa trong `afterAll`. Không truncate tables chung — giữ seed data không bị mất.

**Port conflicts**: Mỗi test tier dùng port server riêng:
- Integration: 9998
- API HTTP: 9997
- E2E: 9996

Để chạy đồng thời nhiều tiers, các ports này phải không bị chiếm. Nếu bị conflict: `npm run kill` (backend) hoặc đổi port trong setup file.

**Supertest setup (API/E2E)**:
```javascript
// src/__api__/http-setup.js — helper dùng chung trong mỗi test file
const { app, request, createTestUser, createTestProduct } = require('./http-setup');

// createTestUser(overrides) → { user, token }    — prefix email '__http_test_'
// createTestProduct(overrides) → { product, variant, cat, brand }  — prefix '__HTTP_Product_'
// Tất cả data cleanup qua globalTeardown (prefix '__HTTP_')
```
