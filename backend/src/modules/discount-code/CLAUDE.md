# Discount Code Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (Singleton)](#12-pattern-singleton)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Apply discount code](#31-apply-discount-code)
  - [3.2 Admin CRUD](#32-admin-crud)
  - [3.3 Business rules](#33-business-rules)
- [4. API Endpoints](#4-api-endpoints)
  - [4.1 User endpoint (qua discount-code module routes)](#41-user-endpoint-qua-discount-code-module-routes)
  - [4.2 Admin endpoints (qua admin module routes)](#42-admin-endpoints-qua-admin-module-routes)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý mã giảm giá cho đơn hàng: admin tạo và cấu hình mã (`percent` hoặc `fixed`), user apply mã khi checkout để kiểm tra điều kiện hợp lệ và nhận về discount amount. Module không tự tăng `usedCount` — việc đó do `orders` module làm sau khi payment thành công.

## 1.2 Pattern (Singleton)

Module dùng singleton pattern — **không nhận DI injection** (exception so với phần lớn modules):

```js
// module.js
module.exports = () => ({
  basePath: '/discount-codes',
  router: require('@modules/discount-code/routes'),
  subscribeEvents() {},
});
```

Service và repository `require('@models')` trực tiếp (không qua DI). Pre-commit hook cho phép exception này.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/discount-code/
  module.js
  routes.js                              — chỉ có 1 route: POST /apply
  controllers/
    discount-code-controller.js          — functions xuất: getAllDiscountCodes, getById, create, update, delete, applyDiscountCode
  services/
    discount-code-service.js             — ~260 lines: validate + apply logic + admin CRUD (function exports, không phải class)
  repositories/
    sequelize-discount-code-repository.js — function exports: findAll, findById, findOne, create, remove, incrementUsedCount
    i-discount-code-repository.js         — interface
  validators/
    discount-code-validator.js           — Zod: createDiscountCodeSchema, updateDiscountCodeSchema, applyDiscountCodeSchema
  dtos/
    discount-code-dto.js                 — pass-through DTOs
  CLAUDE.md
```

> Service và repository dùng **function exports** (không phải class) — khác pattern của phần lớn modules.

---

# 3. Business Logic Chính

## 3.1 Apply discount code

**`applyDiscountCode(code, orderAmount)`** — validate theo thứ tự:

1. Tìm mã `{ code, isActive: true }` — không tồn tại hoặc inactive → 400
2. Kiểm tra `startDate`: nếu có và `now < startDate` → 400 "chưa đến thời gian"
3. Kiểm tra `endDate`: nếu có và `now > endDate` → 400 "đã hết hạn"
4. Kiểm tra `usageLimit`: nếu `usedCount >= usageLimit` (và `usageLimit` không null) → 400 "đã đạt giới hạn"
5. Kiểm tra `minOrderAmount`: `orderAmount < minOrderAmount` → 400
6. Tính `discountAmount`:
   - `type = 'percent'`: `orderAmount * value / 100`, cap bởi `maxDiscountAmount`
   - `type = 'fixed'`: giá trị cố định `value`
7. Cap: `discountAmount > orderAmount` → `discountAmount = orderAmount` (không giảm âm)

Trả về: `{ discountAmount, discountCodeId, code }`.

**KHÔNG tăng `usedCount` ở đây** — chỉ trả về discount amount để caller dùng.

## 3.2 Admin CRUD

Functions: `getAllDiscountCodes({ page, limit, search, isActive, sortBy, sortOrder })`, `getDiscountCodeById(id)`, `createDiscountCode(data, actor)`, `updateDiscountCode(id, data, actor)`, `deleteDiscountCode(id, actor)`.

Tất cả write operations ghi `AdminAuditService.logDiscountCodeAction(actor, action, id, code)`. `updateDiscountCode` phân biệt audit action `'DEACTIVATE'` (khi `isActive` đổi từ true → false) với `'UPDATE'` thông thường.

## 3.3 Business rules

- **`usedCount` tăng CHỈ sau PAID**: `POST /apply` chỉ validate, KHÔNG increment. `incrementUsedCount(id)` được gọi bởi `orders` module sau payment thành công.
- **Discount types**: `percent` (% của orderAmount, có thể cap bởi `maxDiscountAmount`) hoặc `fixed` (số tiền cố định).
- **No race condition protection**: Nếu 2 users apply code cuối cùng đồng thời → có thể overclaim nhẹ. Accepted risk — discount code không phải critical inventory.
- **Code unique**: Khi tạo/update kiểm tra `findOne({ code })` trước — nếu trùng → 400.

---

# 4. API Endpoints

## 4.1 User endpoint (qua discount-code module routes)

Base path: `/api/discount-codes`

| Method | Path     | Auth       | Mô tả                                            |
| ------ | -------- | ---------- | ------------------------------------------------ |
| POST   | `/apply` | — (public) | Validate mã và tính discount amount khi checkout |

Đây là endpoint **duy nhất** được mount qua discount-code module routes.

## 4.2 Admin endpoints (qua admin module routes)

Admin CRUD mount tại `/api/admin/discount-codes` trong `admin/routes.js` — **không** qua discount-code module routes.

| Method | Path                        | Auth              | Mô tả                                      |
| ------ | --------------------------- | ----------------- | ------------------------------------------ |
| GET    | `/admin/discount-codes`     | adminAuthenticate | Danh sách mã giảm giá (phân trang, search) |
| GET    | `/admin/discount-codes/:id` | adminAuthenticate | Chi tiết mã giảm giá                       |
| POST   | `/admin/discount-codes`     | adminAuthenticate | Tạo mã giảm giá mới                        |
| PUT    | `/admin/discount-codes/:id` | adminAuthenticate | Cập nhật mã giảm giá                       |
| DELETE | `/admin/discount-codes/:id` | adminAuthenticate | Xóa mã giảm giá (hard delete)              |

---

# 5. Dependencies

## 5.1 Depends on

Singleton — không nhận inject qua DI. Require trực tiếp:

- `DiscountCode` model qua `@models` (trong repository)
- `@shared/errors` — `AppError`
- `@shared/admin-audit` — `AdminAuditService`
- `@utils/catch-async` — trong controller

## 5.2 Used by

- `orders` — `applyDiscountCode` khi validate mã lúc tạo đơn; `incrementUsedCount` sau khi payment PAID
- `admin` — CRUD mã giảm giá; `discount-code-controller` và `discount-code-validator` import trực tiếp trong `admin/routes.js` (cross-module exception được phép ở routes layer)

---

# 6. Gotchas & Edge Cases

- **`usedCount` KHÔNG tăng khi `/apply`**: Đây là behavior đúng. `usedCount` chỉ tăng khi đơn hàng PAID (gọi `incrementUsedCount` từ orders module). Nếu thấy `usedCount` không tăng sau `/apply` → đúng rồi.
- **Admin CRUD không qua discount-code routes**: Nhìn vào `discount-code/routes.js` chỉ thấy `POST /apply`. Admin CRUD nằm trong `admin/routes.js` — tìm ở đó khi debug.
- **`POST /apply` không cần auth**: Public endpoint, không có `authenticate` middleware.
- **Service dùng function exports, không phải class**: `require('@modules/discount-code/services/discount-code-service')` trả về object `{ getAllDiscountCodes, applyDiscountCode, ... }` — không phải instance.
- **Repository singleton import**: `const discountCodeRepository = require('@modules/discount-code/repositories/sequelize-discount-code-repository')` — module-level singleton, không qua constructor injection.
- **`getOp()` export từ repository**: Service import `Op` qua `discountCodeRepository.getOp()` thay vì `require('sequelize')` trực tiếp — đây là pattern của singleton modules tránh direct sequelize dependency.
- **`discountCodeController` cross-module import**: `admin/routes.js` import controller từ `@modules/discount-code/controllers/...` — exception được phép ở routes layer.

---

# 7. Tests

| File                                            | Loại | Mô tả                                         |
| ----------------------------------------------- | ---- | --------------------------------------------- |
| `services/discount-code-service.test.js`        | Unit | Apply logic, validate thứ tự, CRUD, audit log |
| `repositories/discount-code-repository.test.js` | Unit | Repository CRUD, incrementUsedCount           |
| `routes.test.js`                                | Unit | Route validation middleware                   |
