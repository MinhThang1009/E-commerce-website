# E2E Tests — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. So sánh với API HTTP / Integration](#2-so-sánh-với-api-http--integration)
- [3. User flows](#3-user-flows)
- [4. Setup & teardown](#4-setup--teardown)
- [5. Shared helpers (e2e-setup.js)](#5-shared-helpers-e2e-setupjs)
- [6. Cách chạy](#6-cách-chạy)
- [7. Naming convention](#7-naming-convention)
- [8. Gotchas](#8-gotchas)

---

# 1. Mục đích

E2E tests xác minh **user flows hoàn chỉnh** — nhiều endpoints nối tiếp nhau tạo thành một hành trình người dùng thực tế. Kiểm tra:

- Luồng đăng ký → xác thực → đăng nhập → mua hàng → thanh toán → xem đơn
- Admin login → CRUD sản phẩm → upload ảnh → cập nhật inventory

Trả lời câu hỏi: **"Toàn bộ user journey có hoạt động không?"** (không phải "endpoint X trả 200 không?").

---

# 2. So sánh với API HTTP / Integration

| Aspect              | E2E                                    | API HTTP               | Integration         |
| ------------------- | -------------------------------------- | ---------------------- | ------------------- |
| Focus               | User journey (5–15 steps)              | HTTP endpoint contract | DB + business logic |
| Số endpoints / test | Nhiều (5–15 bước)                      | 1–2                    | 2–5                 |
| State giữa steps    | Có (token, orderId, cartId carry over) | Không                  | Không               |
| Số suites / tests   | 5 / 100                                | 39 / 700               | 36 / 184            |
| Runtime             | ~20s                                   | ~190s                  | ~50s                |
| Timeout             | 60s                                    | 30s                    | 30s                 |
| Port                | 9996                                   | 9997                   | 9998                |

---

# 3. User flows

| File                                | Flow                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `auth-flow.e2e.test.js`             | Register → verify email (OTP) → login → refresh token → logout → token invalid              |
| `shopping-flow.e2e.test.js`         | Browse catalog → add to cart → apply discount → checkout → place order → write review       |
| `checkout-flow.e2e.test.js`         | Cart → discount code → payment COD → payment VNPay IPN → payment MoMo IPN → order DELIVERED |
| `admin-flow.e2e.test.js`            | Admin login → create product → upload image → update inventory → manage users               |
| `wishlist-profile-flow.e2e.test.js` | Add to wishlist → move to cart → update profile → add address → set default address         |

---

# 4. Setup & teardown

**`setup.js`** — `setupFiles` trong `jest.e2e.config.js`, chạy **trước mỗi test file**:

```js
process.env.NODE_ENV = 'development';
process.env.DB_NAME = 'techstore_test';
process.env.PORT = '9996';
```

**`e2e-setup.js`** — import thủ công trong từng test file, cung cấp helpers `createE2EUser`, `createE2EAdmin`, `createE2EProduct`.

**`teardown.js`** — `globalTeardown`, chạy **1 lần sau tất cả tests**:

- Cleanup records prefix `__E2E_`
- Close DB pool

Mỗi test file dùng `beforeAll` / `afterAll` với biến module-level để share state giữa steps:

```js
let userId, token, orderId, cartId;
beforeAll(async () => {
  /* tạo user + product */
});
it('step 1: add to cart', async () => {
  cartId = res.body.cartId;
});
it('step 2: checkout', async () => {
  /* dùng cartId từ step 1 */
});
```

---

# 5. Shared helpers (e2e-setup.js)

```js
const { app, request, createE2EUser, createE2EAdmin, createE2EProduct } = require('../e2e-setup');
```

| Export                        | Mô tả                                                                                          |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `app`                         | Express app instance                                                                           |
| `request`                     | Supertest instance                                                                             |
| `createE2EUser(overrides)`    | Tạo customer + login → `{ user, token }`. Prefix `__E2E_`, password mặc định `E2ETest1!`       |
| `createE2EAdmin(overrides)`   | Wrapper `createE2EUser({ role: 'admin' })`                                                     |
| `createE2EProduct(overrides)` | Tạo category + brand + product + variant → `{ product, variant, cat, brand }`. Prefix `__E2E_` |

---

# 6. Cách chạy

```bash
# Từ thư mục backend/ — MySQL phải chạy, DB 'techstore_test' phải có seed data
npm run test:e2e                                      # Full 5 suites/100 tests (~20s)
npm run test:e2e -- --testPathPattern=checkout-flow  # Chỉ checkout flow
npm run test:e2e -- --testPathPattern=auth-flow      # Chỉ auth flow
```

Config: `jest.e2e.config.js` — `maxWorkers=1`, timeout 60s.

---

# 7. Naming convention

Prefix data: **`__E2E_`** cho tất cả records tạo trong E2E tests.

```js
const { user, token } = await createE2EUser({ email: '__e2e_checkout@t.com' });
```

Tests viết theo kiểu step-by-step, mô tả flow rõ ràng:

```js
describe('Checkout flow — COD payment', () => {
  it('Bước 1: thêm sản phẩm vào giỏ', async () => { ... });
  it('Bước 2: apply discount code', async () => { ... });
  it('Bước 3: đặt hàng COD', async () => { ... });
  it('Bước 4: xác nhận đơn hàng giao thành công', async () => { ... });});
```

---

# 8. Gotchas

- **Phụ thuộc thứ tự steps trong 1 flow** — KHÔNG skip step. Mỗi `it()` build trên state của step trước (token, orderId, etc.)
- **State chia sẻ qua `describe` block** — dùng biến module-level `let token, orderId` cẩn thận; mỗi flow là 1 file riêng để tránh conflict
- **Prefix `__E2E_`** bắt buộc cho tất cả test data (emails, product names, addresses) — cleanup script xóa theo prefix này
- **Không chạy trong CI** mặc định — cần MySQL service
- **Payment mocking**: VNPay/MoMo IPN callbacks được simulate bằng cách POST đến endpoint `/api/payments/vnpay-ipn` và `/api/payments/momo-ipn` với chữ ký giả lập (test environment bỏ qua verify signature)
- **Email service mock**: không gửi mail thật — `jest.mock('@services/email')` trong `e2e-setup.js`
- **Port 9996** — riêng cho E2E, không conflict với API (9997) hay integration (9998)
