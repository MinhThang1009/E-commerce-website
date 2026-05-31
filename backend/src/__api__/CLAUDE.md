# API HTTP Tests — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. So sánh với Integration Tests](#2-so-sánh-với-integration-tests)
- [3. Setup / Teardown](#3-setup--teardown)
- [4. Shared helpers (http-setup.js)](#4-shared-helpers-http-setupjs)
- [5. Phân bổ files](#5-phân-bổ-files)
- [6. Cách chạy](#6-cách-chạy)
- [7. Naming convention](#7-naming-convention)
- [8. Gotchas](#8-gotchas)

---

# 1. Mục đích

API HTTP tests xác minh **HTTP contract** của từng endpoint qua Supertest — đi qua toàn bộ stack Express (routes → middleware → controller → service → DB). Kiểm tra:

- Endpoint trả đúng status code, body, headers
- Middleware chain hoạt động đúng: auth, validation, rate-limit
- Error handling đầy đủ: 400, 401, 403, 404, 422, 500
- Edge cases: payload xấu, token hết hạn, IP bị block, oversell

**Khác với Unit:** đi qua TOÀN BỘ Express stack (không mock gì).
**Khác với Integration:** focus vào HTTP layer (status code, response shape) thay vì business logic + DB constraint.

---

# 2. So sánh với Integration Tests

| Aspect     | API HTTP                           | Integration                     |
| ---------- | ---------------------------------- | ------------------------------- |
| Tool       | Supertest (HTTP request)           | Sequelize trực tiếp + Supertest |
| Focus      | HTTP contract (status, body shape) | Business logic + DB constraint  |
| Runtime    | ~190s                              | ~50s                            |
| Files      | `*.http.test.js`                   | `*.integration.test.js`         |
| DB         | MySQL thật (`techstore_test`)      | MySQL thật (`techstore_test`)   |
| Port       | 9997                               | 9998                            |
| maxWorkers | 1                                  | 1                               |

---

# 3. Setup / Teardown

**`setup.js`** — chạy qua `setupFiles`, **trước mỗi test file**:

```js
process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'techstore_test';
process.env.PORT = '9997';
```

**`http-setup.js`** — import thủ công trong từng test file, cung cấp helpers và app instance.

**`teardown.js`** — `globalTeardown`, chạy **1 lần sau tất cả tests**:

- Disconnect DB pool
- Cleanup records prefix `__HTTP_`

---

# 4. Shared helpers (http-setup.js)

`http-setup.js` export 4 thứ:

```js
const { app, request, createTestUser, createTestProduct } = require('../http-setup');
```

| Export                         | Mô tả                                                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `app`                          | Express app instance                                                                                             |
| `request`                      | Supertest instance gắn với app                                                                                   |
| `createTestUser(overrides)`    | Tạo user + login → trả `{ user, token }`. Prefix email `__http_test_`                                            |
| `createTestProduct(overrides)` | Tạo category + brand + product + variant → trả `{ product, variant, cat, brand }`. Prefix name `__HTTP_Product_` |

Tất cả data tạo bởi helpers đều dùng prefix `__HTTP_` để cleanup tự động.

---

# 5. Phân bổ files

| Module             | Files                                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth               | `auth.http.test.js`, `auth-deep.http.test.js`, `auth-edge-cases.http.test.js`, `auth-security.http.test.js`                                              |
| catalog            | `catalog.http.test.js`, `catalog-products.http.test.js`, `catalog-deep.http.test.js`, `catalog-extra.http.test.js`, `catalog-comprehensive.http.test.js` |
| cart               | `cart.http.test.js`, `cart-extra.http.test.js`, `cart-edge-cases.http.test.js`                                                                           |
| orders             | `orders.http.test.js`, `orders-edge-cases.http.test.js`, `orders-extra.http.test.js`                                                                     |
| admin              | `admin.http.test.js`, `admin-extra.http.test.js`, `admin-comprehensive.http.test.js`                                                                     |
| ai                 | `ai-chatbot.http.test.js`, `ai-edge-cases.http.test.js`                                                                                                  |
| attribute          | `attribute.http.test.js`, `attribute-extra.http.test.js`                                                                                                 |
| content            | `content.http.test.js`                                                                                                                                   |
| discount-code      | `discount-code.http.test.js`, `discount-edge-cases.http.test.js`                                                                                         |
| payment            | `payment.http.test.js`, `payment-edge-cases.http.test.js`, `payment-reviews-deep.http.test.js`                                                           |
| reviews            | `reviews.http.test.js`, `reviews-edge-cases.http.test.js`                                                                                                |
| wishlist           | `wishlist.http.test.js`, `wishlist-comprehensive.http.test.js`                                                                                           |
| users              | `users.http.test.js`, `users-comprehensive.http.test.js`                                                                                                 |
| multi-module       | `multi-module.http.test.js` — test flows xuyên nhiều modules                                                                                             |
| các module còn lại | `inventory`, `search-history`, `upload`, `rate-limit` — 1 file mỗi module                                                                                |

---

# 6. Cách chạy

```bash
# Từ thư mục backend/ — MySQL phải chạy, techstore_test phải có data:
#   npm run db:test:setup  → build từ seed_data.sql  |  npm run db:sync-test → copy techstore (data thật)
npm run test:api                              # Full 39 suites/700 tests (~190s)
npm run test:api -- --testPathPattern=auth   # Chỉ auth tests
npm run test:api -- --testPathPattern=catalog-deep  # Chỉ catalog-deep

# Cleanup nếu test rớt giữa chừng để lại data bẩn
npm run db:cleanup-test-data
```

Config: `jest.api.config.js` — `maxWorkers=1`, timeout 30s, `globalTeardown: './src/__api__/teardown.js'`.

---

# 7. Naming convention

Prefix data test: **`__HTTP_`** cho tất cả records tạo trong API tests.

```js
const { user, token } = await createTestUser({ email: '__http_admin@t.com', role: 'admin' });
// hoặc:
await User.create({ email: `__HTTP_test_${Date.now()}@t.com`, ... });
```

Test descriptions bằng **tiếng Việt**:

```js
it('trả về 401 khi không có token', async () => { ... });
it('trả về 404 khi sản phẩm không tồn tại', async () => { ... });
```

---

# 8. Gotchas

- **MySQL phải running** trước khi chạy — DB name lấy từ env `DB_NAME` (setup.js set `techstore_test`)
- **`maxWorkers=1`** bắt buộc — không chạy song song để tránh data race trên cùng DB
- **Cleanup test data** — dùng prefix `__HTTP_` để xóa. `npm run db:cleanup-test-data` xóa hết `__INT_TEST_`, `__HTTP_`, `__E2E_` records
- **Rate limiter tắt trong test** — `NODE_ENV=development` nới lỏng 10x; nếu test `rate-limit.http.test.js` cần test rate limit thật thì override lại trong test đó
- **Không reuse test data** giữa suites — mỗi `describe` block tự setup/teardown riêng
- **Không chạy trong CI** — chỉ chạy local hoặc pipeline dedicated có MySQL service
- **Port conflict** — nếu port 9997 đang dùng (dev server chạy?) → thay `PORT=9997` trong `.env.test` hoặc kill process
