# Unit Tests (Cross-Cutting) — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. Files và phạm vi](#2-files-và-phạm-vi)
- [3. Setup](#3-setup)
- [4. Cách chạy](#4-cách-chạy)
- [5. Naming convention](#5-naming-convention)
- [6. Gotchas](#6-gotchas)

---

# 1. Mục đích

`src/__tests__/` chứa unit test **cross-cutting** — kiểm thử logic không thuộc về một module duy nhất:

- Data integrity: Sequelize model field definitions, pagination constraints
- Security: JWT, token blacklist, rate limiter, path traversal prevention
- Cross-module branches: coverage gaps xuyên modules (inventory, orders, admin, vector store)
- DTOs & validators: Zod schema, DTO mapping
- Schema drift: phát hiện Sequelize model lệch với DB schema

Unit test **trong từng module** (ví dụ `modules/orders/services/*.test.js`) — **KHÔNG** nằm ở đây.

---

# 2. Files và phạm vi

| File                                    | Phạm vi                                                                                                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cart-catalog-exact-branches.test.js`   | Branch coverage chi tiết cart ↔ catalog (exact paths)                                                                                                      |
| `cart-catalog-service-branches.test.js` | Service-level branches trong cart và catalog service                                                                                                       |
| `cross-module-branches.test.js`         | Branches chưa cover: inventory, OrderAggregate, adminAudit, vectorStore, wishlist, AI/content repos                                                        |
| `data-integrity.test.js`                | Model field definitions (stockQuantity), pagination cap (limit ≤100), offset calculation                                                                   |
| `dtos-and-utils.test.js`                | DTOs + utility functions (catch-async, image-url, localize)                                                                                                |
| `middleware-email-gaps.test.js`         | Middleware coverage gaps + email service edge cases                                                                                                        |
| `model-service-gaps.test.js`            | Model ↔ Service coverage gaps còn thiếu                                                                                                                    |
| `models-and-dtos.test.js`               | Sequelize model definitions + DTO mapping (toJSON, fromDB)                                                                                                 |
| `repo-attributes-drift.test.js`         | Phát hiện schema drift giữa Sequelize attributes và DB columns                                                                                             |
| `routes.test.js`                        | Route registration sanity — endpoint phải tồn tại và map đúng method                                                                                       |
| `security.test.js`                      | authenticate middleware (blacklist, valid token, missing header), otpLimiter (429 sau 5 req), User.toJSON (không leak password), deleteFile path traversal |
| `services.test.js`                      | Shared service helpers (email, vector-store stubs)                                                                                                         |
| `validators.test.js`                    | Zod validators — valid/invalid payloads                                                                                                                    |
| `setup.js`                              | Jest `setupFiles`: set env vars (`NODE_ENV=test`, `JWT_SECRET`, `DB_NAME`, `PORT=9999`)                                                                    |

---

# 3. Setup

`setup.js` chạy trước tất cả tests qua `jest.config.js` `setupFiles`:

```js
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long';
process.env.DB_NAME = 'test_db';
process.env.PORT = '9999';
```

Mỗi test file tự mock các dependencies cần thiết:

- `jest.mock('@models')` — mock Sequelize, không gọi DB thật
- `jest.mock('@config/sequelize')` — mock sequelize.define để capture model attrs
- `jest.mock('@utils/logger')` — tắt console noise
- `clearMocks: true` trong jest.config.js — reset tất cả mocks giữa các test

---

# 4. Cách chạy

```bash
# Từ thư mục backend/
npm run test            # Tất cả unit tests + coverage (~10s)
npm run test:fast       # Không coverage
npx jest --testPathPattern=security   # Chạy 1 file theo pattern
npx jest --testPathPattern="__tests__/data-integrity"  # Chỉ data-integrity
```

Config: `jest.config.js` (root backend) — `testMatch` quét `src/__tests__/**/*.test.js` cộng với co-located tests trong modules, services, utils, shared, middlewares, models, jobs.

**Coverage thresholds** (từ `jest.config.js`):

- statements: 99%, branches: 97%, functions: 99%, lines: 99%

---

# 5. Naming convention

Tests viết bằng **tiếng Việt** (policy thesis project):

```js
describe('authenticate middleware', () => {
  it('trả về 401 khi thiếu Authorization header', async () => { ... });
  it('trả về 401 khi token đã bị blacklist', async () => { ... });
  it('cho phép request khi token hợp lệ', async () => { ... });
});
```

---

# 6. Mock middleware tập trung & phát hiện test thiếu

**Manual mock (chống churn hàng loạt):** Middleware dùng chung được mock tập trung tại
`src/middlewares/__mocks__/` — Jest TỰ dùng khi test gọi `jest.mock(...)` KHÔNG kèm factory:

```js
jest.mock('@middlewares/admin-auth'); // dùng __mocks__/admin-auth.js (đủ mọi export)
jest.mock('@middlewares/authorize'); // pass-through mọi role
```

Khi middleware thật thêm export mới (vd `requireRole`) → chỉ cập nhật **1 file** `__mocks__`,
không phải sửa từng test. Cần user khác mặc định → set `req.__mockUser` trong test
(vd thêm middleware `app.use((req,_r,n)=>{ req.__mockUser={id,role:'staff'}; n(); })`).
Test cần hành vi auth đặc thù (vd kiểm 401 theo header) thì vẫn dùng inline factory riêng.

**Phát hiện test thiếu/yếu khi thêm tính năng / fix bug:**

| Lệnh                                | Mục đích                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------- |
| `npm run test:changed`              | Chạy nhanh test của file vừa đổi (uncommitted) — biết vỡ ngay               |
| `npm run test:related -- <file...>` | Chạy test liên quan tới file cụ thể; file đổi không có test liên quan → gap |
| `npm run test:coverage:changed`     | Coverage chỉ trên code đổi từ `main` → lộ **dòng mới chưa được test phủ**   |

- **Patch coverage** (`test:coverage:changed`) là cách trực tiếp nhất phát hiện "thêm code mà quên test".
- **Mutation testing** (Stryker, chạy định kỳ) phát hiện test _yếu_ (code được phủ nhưng assert hời hợt) — coverage % không thấy.
- **Bug fix**: viết failing-test tái hiện bug TRƯỚC rồi mới fix (TDD).

---

# 7. Gotchas

- **Không gọi DB thật** — folder này chỉ dùng mock. Test cần DB thật → `src/__integration__/`.
- **`maxWorkers` không giới hạn** — unit tests chạy song song. Integration tests bắt buộc `maxWorkers=1`.
- **Coverage gates** — CI fail nếu thresholds drop. Thêm code mới phải kèm test.
- **`collectCoverageFrom` trong `jest.config.js`** exclude: migrations, config, server.js, app.js, interface files (`I*.js`, `i-*-repository.js`), DTOs, module.js, index.js barrels.
- **Co-located tests** (`modules/<name>/*.test.js`) cũng chạy cùng config này — không phân biệt folder khi coverage tính.
