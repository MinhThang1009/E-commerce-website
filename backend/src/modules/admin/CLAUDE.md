# Admin Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (Singleton)](#12-pattern-singleton)
  - [1.3 Auth pattern](#13-auth-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Dashboard & Analytics](#31-dashboard--analytics)
  - [3.2 Product CRUD](#32-product-crud)
  - [3.3 Product import/export pipeline](#33-product-importexport-pipeline)
  - [3.4 Business rules](#34-business-rules)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Cung cấp toàn bộ chức năng quản trị hệ thống: dashboard analytics, CRUD tất cả entities (sản phẩm, đơn hàng, users, reviews, discount codes, tồn kho), import hàng loạt sản phẩm từ CSV/JSON, export data.

## 1.2 Pattern (Singleton)

Module là **singleton** — không nhận DI injection từ `app.js`:

```js
// module.js
module.exports = () => ({
  basePath: '/admin',
  router: require('@modules/admin/routes'),
  subscribeEvents() {},
});
```

`admin-service.js` và `sequelize-admin-repository.js` `require('@models')` trực tiếp — đây là intentional exception cho singleton modules. Pre-commit hook không block vì module này được khai báo là singleton exception.

## 1.3 Auth pattern

Tất cả routes dùng `adminAuthenticate` (từ `@middlewares/admin-auth`) — **KHÔNG phải** `authenticate` + `authorize('admin')`. Apply ở router level nên cover toàn bộ routes:

```js
router.use(adminAuthenticate);
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/admin/
  module.js                                       — Singleton wrapper, chỉ gắn router
  routes.js                                       — HTTP endpoints, import discountCodeController
  controllers/
    admin-controller.js                           — Re-export trực tiếp từ admin-service.js
    admin-import-controller.js                    — Upload (multer memoryStorage) + import/export
  services/
    admin-service.js                              — Business logic chính (~2000+ lines, HTTP-aware)
    product-import-service.js                     — Parse, validate, bulk insert CSV/JSON
  repositories/
    i-admin-repository.js                         — Interface (tài liệu)
    sequelize-admin-repository.js                 — CRUD + analytics aggregation, expose Op/Sequelize
    sequelize-product-import-repository.js        — Bulk insert riêng cho import flow
  utils/
    csv-parser.js                                 — parseCsv, validateRow, escapeCsvField, CSV_HEADERS
  validators/
    admin-validator.js                            — Zod schemas: pagination, stats, product, user, order
  dtos/
    admin-dto.js                                  — toDto() / toDtoList() wrapper Sequelize instance
  CLAUDE.md
```

---

# 3. Business Logic Chính

## 3.1 Dashboard & Analytics

Tất cả dùng Sequelize.fn aggregate (không phải raw SQL):

- `getDashboardStats()` — tổng users/products/orders/revenue, so sánh với tháng trước
- `getDetailedStats({ startDate, endDate, groupBy })` — stats theo khoảng thời gian, groupBy: `hour|day|week|month`
- `getOrderStatusAnalytics()` — phân bổ trạng thái đơn hàng
- `getTopProductsAnalytics()` — sản phẩm bán chạy nhất
- `getRevenueByCategoryAnalytics()` — doanh thu theo danh mục
- `getUserGrowthAnalytics()` — tăng trưởng users theo ngày/tháng
- `getPaymentMethodsAnalytics()` — phân bổ phương thức thanh toán
- `getLowStockAnalytics()` — sản phẩm sắp hết hàng
- `getChatbotStats()` — analytics chatbot AI (từ `ChatMessage` model)
- `exportReport()` — export báo cáo tổng hợp

## 3.2 Product CRUD

- `getAllProducts({ page, limit, sortBy, sortOrder })` — danh sách có phân trang
- `getProductById(id)` — chi tiết kèm categories, variants, specs, attributes
- `createProduct(data)` — tạo mới, sync vector store async sau khi tạo
- `updateProduct(id, data)` — cập nhật, sync vector store async
- `deleteProduct(id)` — xóa, remove khỏi vector store
- `cloneProduct(id)` — nhân bản sản phẩm (deep clone kèm variants, specs, images)
- `toggleProductStatus(id)` — bật/tắt hiển thị
- `updateProductStock(id, { variantId, stockQuantity })` — cập nhật tồn kho
- `restockProduct(productId, { variantId, quantity, note })` — nhập hàng, tạo InventoryLog

## 3.3 Product import/export pipeline

`product-import-service.js` có repository riêng `sequelize-product-import-repository.js`:

1. Parse file: CSV qua `utils/csv-parser.js` hoặc JSON (phân biệt theo `.ext` file upload)
2. Validate từng row — required fields: `name`, `base_price`, `category_slug`
3. Nếu toàn bộ rows fail → trả về `{ allFailed: true, errors }`, không insert gì
4. Bulk insert từng row trong transaction riêng (Product + ProductVariant + ProductImage + ProductCategory + ProductSpecification)
5. Sync vector store sau khi insert thành công (async `setImmediate`, fire-and-forget)

**Export**: Hỗ trợ CSV (default) và JSON (`?format=json`).

**CSV template**: Gồm 16 columns: `name, slug, short_description, base_price, category_slug, brand, status, stock_quantity, sku, weight_kg, image_urls, spec_cpu, spec_ram, spec_storage, spec_display, spec_battery`.

## 3.4 Business rules

- Admin không thể xóa chính mình — check `req.user.id !== targetUserId`
- Vector store sync: **create/update** dùng direct `await` với try/catch (block response nhưng lỗi không ảnh hưởng status code); **import** dùng `setImmediate` fire-and-forget (response trả về trước khi sync xong)
- `deepParseJSON()` / `deepParseJSONArray()` trong service: xử lý trường hợp field bị stringify nhiều lần (tối đa 5 lần)

---

# 4. API Endpoints

Base path: `/api/admin`. Tất cả require `adminAuthenticate`.

| Method | Path                                   | Rate Limit | Mô tả                                                           |
| ------ | -------------------------------------- | ---------- | --------------------------------------------------------------- |
| GET    | `/admin/dashboard`                     | —          | Stats tổng quan hệ thống                                        |
| GET    | `/admin/stats`                         | —          | Stats theo khoảng thời gian (`startDate`, `endDate`, `groupBy`) |
| GET    | `/admin/users`                         | —          | Danh sách users (phân trang, search, role filter)               |
| GET    | `/admin/users/:id`                     | —          | Chi tiết user (kèm addresses, orders)                           |
| PUT    | `/admin/users/:id`                     | —          | Cập nhật user                                                   |
| DELETE | `/admin/users/:id`                     | —          | Xóa user                                                        |
| GET    | `/admin/products`                      | —          | Danh sách sản phẩm (phân trang)                                 |
| GET    | `/admin/products/import-template`      | —          | Download CSV template                                           |
| POST   | `/admin/products/import`               | —          | Import từ CSV/JSON (multer memoryStorage, max 5MB)              |
| GET    | `/admin/products/export`               | —          | Export ra CSV hoặc JSON (`?format=json`)                        |
| GET    | `/admin/products/:id`                  | —          | Chi tiết sản phẩm (kèm variants, specs, attributes)             |
| POST   | `/admin/products`                      | —          | Tạo sản phẩm mới                                                |
| PUT    | `/admin/products/:id`                  | —          | Cập nhật sản phẩm                                               |
| DELETE | `/admin/products/:id`                  | —          | Xóa sản phẩm                                                    |
| POST   | `/admin/products/:id/clone`            | —          | Clone sản phẩm                                                  |
| PATCH  | `/admin/products/:id/status`           | —          | Toggle hiển thị                                                 |
| PATCH  | `/admin/products/:id/stock`            | —          | Cập nhật stock                                                  |
| POST   | `/admin/products/:productId/restock`   | —          | Nhập thêm hàng                                                  |
| GET    | `/admin/reviews`                       | —          | Danh sách tất cả reviews (phân trang)                           |
| DELETE | `/admin/reviews/:id`                   | —          | Xóa review                                                      |
| GET    | `/admin/orders`                        | —          | Danh sách đơn hàng (phân trang)                                 |
| PUT    | `/admin/orders/:id/status`             | —          | Cập nhật trạng thái đơn hàng                                    |
| PUT    | `/admin/orders/:id/cancel`             | —          | Hủy đơn hàng (admin)                                            |
| GET    | `/admin/discount-codes`                | —          | Danh sách mã giảm giá                                           |
| GET    | `/admin/discount-codes/:id`            | —          | Chi tiết mã giảm giá                                            |
| POST   | `/admin/discount-codes`                | —          | Tạo mã giảm giá mới                                             |
| PUT    | `/admin/discount-codes/:id`            | —          | Cập nhật mã giảm giá                                            |
| DELETE | `/admin/discount-codes/:id`            | —          | Xóa mã giảm giá                                                 |
| GET    | `/admin/analytics/order-status`        | —          | Phân bổ trạng thái đơn hàng                                     |
| GET    | `/admin/analytics/top-products`        | —          | Sản phẩm bán chạy                                               |
| GET    | `/admin/analytics/revenue-by-category` | —          | Doanh thu theo danh mục                                         |
| GET    | `/admin/analytics/user-growth`         | —          | Tăng trưởng users                                               |
| GET    | `/admin/analytics/payment-methods`     | —          | Phân bổ phương thức thanh toán                                  |
| GET    | `/admin/analytics/low-stock`           | —          | Sản phẩm sắp hết hàng                                           |
| GET    | `/admin/reports/export`                | —          | Export báo cáo tổng hợp                                         |
| GET    | `/admin/chatbot/stats`                 | —          | Chatbot analytics                                               |

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

- `discount-code` module — `discountCodeController` và `discountCodeValidator` import trực tiếp trong `routes.js` (cross-module import được cho phép ở routes layer)
- `@services/vector-store/` — sync vector store sau create/import product (async)
- `@models` — require trực tiếp (singleton exception): Product, User, Order, Review, Category, Brand, OrderItem, ProductVariant, ProductImage, ProductCategory, CartItem, Wishlist, Address, SearchHistory, RecentlyViewed, InventoryLog, ChatMessage
- `@modules/ai/services/product/product-enricher` — enrich data trước khi upsert vector store (require lazy trong try/catch block hoặc setImmediate tùy flow)

## 5.2 Used by (module khác dùng module này)

Không module nào depend vào admin (leaf node trong dependency graph).

---

# 6. Gotchas & Edge Cases

- **`adminAuthenticate` vs `authenticate`**: Dùng `adminAuthenticate` từ `@middlewares/admin-auth`, **không phải** `authenticate` + `authorize('admin')`. Đây là middleware hoàn toàn khác.
- **`admin-controller.js` chỉ re-export**: Controller layer chưa tách hoàn toàn — handlers là HTTP-aware (dùng `catchAsync(req, res, next)`). Comment TODO trong file: tách ra trong sprint riêng.
- **Import routes trước `/products/:id`**: Routes `/products/import-template`, `/products/import`, `/products/export` phải đăng ký trước `/products/:id` để Express không nhầm `import-template` là một product ID.
- **`product-import-service.js` có repo riêng**: Dùng `sequelize-product-import-repository.js`, không phải `sequelize-admin-repository.js`. Không nhầm lẫn.
- **`allFailed` flag trong import**: Nếu mọi row đều fail validation → trả về HTTP 422 với `{ allFailed: true }`. Không insert bất kỳ row nào.
- **Vector store sync — 2 cơ chế khác nhau**: Create/update product dùng direct `await` với try/catch — response chờ sync xong, lỗi chỉ log không ảnh hưởng status code. Import dùng `setImmediate` fire-and-forget — response trả về trước khi sync xong.
- **Multer memoryStorage**: File upload lưu trong RAM (không lưu disk). Giới hạn 5MB. Chỉ nhận `.csv` hoặc `.json`.
- **Discount code trong admin routes**: `routes.js` import trực tiếp `discountCodeController` từ `@modules/discount-code/controllers/...` — là cross-module import nhưng cho phép ở routes layer.

---

# 7. Tests

| File                                                       | Loại        | Mô tả                       |
| ---------------------------------------------------------- | ----------- | --------------------------- |
| `controllers/admin-controller.test.js`                     | Unit        | CRUD endpoints chính        |
| `controllers/admin-controller.analytics.test.js`           | Unit        | Analytics endpoints         |
| `controllers/admin-controller.edge-cases.test.js`          | Unit        | Edge cases batch 1          |
| `controllers/admin-controller.edge-cases-2.test.js`        | Unit        | Edge cases batch 2          |
| `controllers/admin-controller.edge-cases-3.test.js`        | Unit        | Edge cases batch 3          |
| `controllers/admin-controller.edge-cases-4.test.js`        | Unit        | Edge cases batch 4          |
| `controllers/admin-controller.edge-cases-5.test.js`        | Unit        | Edge cases batch 5          |
| `controllers/admin-controller.edge-cases-6.test.js`        | Unit        | Edge cases batch 6          |
| `controllers/admin-import-controller.test.js`              | Unit        | Import/export controller    |
| `controllers/admin-import-controller.edge-cases.test.js`   | Unit        | Import edge cases batch 1   |
| `controllers/admin-import-controller.edge-cases-2.test.js` | Unit        | Import edge cases batch 2   |
| `services/admin-service.unit.test.js`                      | Unit        | Service methods             |
| `repositories/admin-repository.test.js`                    | Unit        | Repository queries          |
| `src/__integration__/admin.integration.test.js`            | Integration | DB integration (MySQL thật) |
| `src/__api__/admin.http.test.js`                           | API HTTP    | End-to-end HTTP             |
| `src/__api__/admin-extra.http.test.js`                     | API HTTP    | HTTP edge cases             |
| `src/__api__/admin-comprehensive.http.test.js`             | API HTTP    | HTTP comprehensive          |
