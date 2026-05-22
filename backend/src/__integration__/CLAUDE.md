# Integration Tests — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. So sánh với các tầng test khác](#2-so-sánh-với-các-tầng-test-khác)
- [3. Setup / Teardown](#3-setup--teardown)
- [4. Naming convention cho test data](#4-naming-convention-cho-test-data)
- [5. File types](#5-file-types)
- [6. Special tests](#6-special-tests)
- [7. Cách chạy](#7-cách-chạy)
- [8. Gotchas](#8-gotchas)

---

# 1. Mục đích

Integration tests kiểm thử service/repository layer với **MySQL thật** — không mock Sequelize, không mock services. Xác minh:

- Business logic đúng khi kết hợp với DB thật (constraints, transactions, FK)
- Repository queries trả về đúng data
- Cross-module flows hoạt động end-to-end ở service layer (không qua HTTP)

Trả lời câu hỏi: **"Service X có hoạt động đúng với DB thật không?"** (không phải "endpoint trả 200 không?").

---

# 2. So sánh với các tầng test khác

| Aspect        | Unit tests       | Integration                  | API HTTP             | E2E                  |
| ------------- | ---------------- | ---------------------------- | -------------------- | -------------------- |
| DB            | Mock Sequelize   | MySQL thật                   | MySQL thật           | MySQL thật           |
| HTTP layer    | Không            | Không (service trực tiếp)    | Supertest            | Supertest            |
| Config        | `jest.config.js` | `jest.integration.config.js` | `jest.api.config.js` | `jest.e2e.config.js` |
| maxWorkers    | Parallel         | 1                            | 1                    | 1                    |
| Timeout       | 5s               | 30s                          | 30s                  | 60s                  |
| Port server   | —                | 9998                         | 9997                 | 9996                 |
| Chạy trong CI | Có               | Không                        | Không                | Không                |
| Runtime       | ~10s             | ~50s                         | ~140s                | ~20s                 |

---

# 3. Setup / Teardown

**`setup.js`** — chạy qua `setupFiles` trong `jest.integration.config.js`, **trước mỗi test file**:

```js
process.env.NODE_ENV = 'development'; // Nới lỏng rate limiters 10x
process.env.DB_NAME = 'techstore'; // DB thật, không phải DB test riêng
process.env.PORT = '9998';
```

Không bootstrap Express server — tests import service/repository trực tiếp.

**`teardown.js`** — `globalTeardown` trong config, chạy **1 lần sau tất cả tests**:

- Đóng DB connection pool
- Cleanup test data còn sót (`__INT_TEST_` prefix)

Mỗi test file tự quản lý data trong `beforeAll` / `afterAll`:

```js
beforeAll(async () => {
  await sequelize.authenticate();
  // tạo data
});
afterAll(async () => {
  await Product.destroy({ where: { nameVi: { [Op.like]: '__INT_TEST_%' } }, force: true });
});
```

---

# 4. Naming convention cho test data

Prefix `__INT_TEST_` cho **tất cả** data tạo trong integration tests — phân biệt với seed data thật, an toàn khi cleanup:

```js
const product = await Product.create({
  nameVi: `__INT_TEST_product_${Date.now()}`,
  nameEn: `__INT_TEST_product_en_${Date.now()}`,
  // ...
});

// Cleanup trong afterAll
await Product.destroy({
  where: { nameVi: { [Op.like]: '__INT_TEST_%' } },
  force: true,
});
```

---

# 5. File types

| Pattern                                   | Mô tả                                          | Ví dụ                                   |
| ----------------------------------------- | ---------------------------------------------- | --------------------------------------- |
| `<module>.integration.test.js`            | Test service layer hoặc repository với DB thật | `orders.integration.test.js`            |
| `<module>-edge-cases.integration.test.js` | Edge cases và error paths                      | `orders-edge-cases.integration.test.js` |
| `<module>-extra.integration.test.js`      | Additional coverage cho module                 | `orders-extra.integration.test.js`      |

**Danh sách modules có coverage:**
`admin`, `ai-chatbot`, `attribute` (×2), `auth` (×3), `cart` (×2), `catalog`, `catalog-recently-viewed`, `content`, `discount-code` (×2), `image`, `inventory` (×2), `orders` (×3), `payment`, `reviews` (×3), `search-history` (×2), `upload` (×2), `users` (×2), `wishlist` (×2)

---

# 6. Special tests

| File                                   | Mô tả                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `order-flow.integration.test.js`       | Full flow: Guest cart → Login → Merge → Checkout → Order → Payment IPN   |
| `concurrent.integration.test.js`       | Race conditions: oversell prevention (SELECT FOR UPDATE)                 |
| `concurrent-extra.integration.test.js` | Additional concurrency: concurrent cart operations, discount code race   |
| `schema-drift.integration.test.js`     | Phát hiện mismatch giữa Sequelize model attributes và DB columns thực tế |

---

# 7. Cách chạy

```bash
# Từ thư mục backend/ — MySQL phải chạy, DB 'techstore' phải có seed data
npm run test:integration                                          # Toàn bộ 42 suites/228 tests
npm run test:integration -- --testPathPattern=orders             # Chỉ orders
npm run test:integration -- --testPathPattern=concurrent         # Race condition tests
npm run test:integration -- --testPathPattern=schema-drift       # Schema drift check
```

---

# 8. Gotchas

- **Không chạy song song với `npm run dev`** — cùng DB `techstore` có thể conflict data
- **DB phải có seed data** — một số tests đọc categories, brands, admin user từ seed (chạy `npm run db:seed` trước)
- **`NODE_ENV=development` trong setup.js** — bắt buộc để nới lỏng rate limiters 10x; `NODE_ENV=test` sẽ khiến một số test timeout vì rate limit quá chặt
- **`schema-drift.integration.test.js` fail** nếu có migration pending chưa chạy — luôn `npm run db:migrate` trước
- **`maxWorkers=1`** trong config — không được tăng lên, race condition sẽ xảy ra trên cùng DB
- **Không chạy trong CI** — workflow không có MySQL service, chỉ unit tests chạy trên CI (xem `.github/workflows/CLAUDE.md`)
- **`require('module-alias/register')`** phải ở đầu `setup.js` — để `@models`, `@services` aliases hoạt động khi tests load
