# Warranty Package Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (Singleton)](#12-pattern-singleton)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 getAll](#31-getall)
  - [3.2 getByProduct](#32-getbyproduct)
  - [3.3 remove](#33-remove)
- [4. API Endpoints](#4-api-endpoints)
  - [4.1 Routes](#41-routes)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý danh mục gói bảo hành tùy chọn mà user có thể chọn khi thêm sản phẩm vào giỏ hàng. Warranty price không được tính trong cart — chỉ được cộng vào order total khi `orders` service tạo đơn.

## 1.2 Pattern (Singleton)

Module nhỏ, singleton pattern — không nhận DI injection:

```js
// module.js
module.exports = () => ({
  basePath: '/warranty-packages',
  router: require('@modules/warranty-package/routes'),
  subscribeEvents() {},
});
```

Service và repository được `require()` trực tiếp.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/warranty-package/
  module.js                                    — singleton, không nhận deps
  routes.js                                    — singleton router, 6 routes
  controllers/
    warranty-package-controller.js
    warranty-package-controller.test.js
  services/
    warranty-package-service.js                — ~59 lines: plain functions (getAll, getByProduct, getById, create, update, remove)
    warranty-package-service.test.js
  repositories/
    i-warranty-package-repository.js
    sequelize-warranty-package-repository.js
    warranty-package-repository.test.js
  validators/
    warranty-package-validator.js              — createSchema, updateSchema (Zod)
  dtos/
    warranty-package-dto.js
```

---

# 3. Business Logic Chính

## 3.1 getAll

```js
getAll({ page, limit, isActive });
```

Paginated. Filter `isActive` (string `'true'/'false'` → convert to boolean). Public endpoint chỉ hiển thị `isActive = true` (filter ở route/controller level).

## 3.2 getByProduct

```js
getByProduct(productId);
```

Verify product tồn tại (`repo.productExists`). Lấy `ProductWarrantyPackage` join records, trả về array `{ ...warrantyPackage, isDefault: boolean }`.

## 3.3 remove

```js
remove(id);
```

Trước khi xóa → `repo.isUsedByProduct(id)` check FK constraint. Nếu đang được dùng bởi product → throw 400. Đây là guard để tránh FK error — nên set `isActive = false` thay vì xóa thật.

---

# 4. API Endpoints

## 4.1 Routes

Base path: `/api/warranty-packages`. Singleton router (không factory).

**Public (không cần auth):**

| Method | Path                  | Auth | Mô tả                                         |
| ------ | --------------------- | ---- | --------------------------------------------- |
| GET    | `/`                   | —    | Danh sách gói bảo hành (có filter `isActive`) |
| GET    | `/product/:productId` | —    | Gói bảo hành cho sản phẩm cụ thể              |
| GET    | `/:id`                | —    | Chi tiết gói theo ID                          |

**Admin (dùng `adminAuthenticate` middleware):**

| Method | Path   | Auth              | Mô tả                                               |
| ------ | ------ | ----------------- | --------------------------------------------------- |
| POST   | `/`    | adminAuthenticate | Tạo gói bảo hành mới                                |
| PUT    | `/:id` | adminAuthenticate | Cập nhật gói                                        |
| DELETE | `/:id` | adminAuthenticate | Xóa gói (không xóa được nếu đang được product dùng) |

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

Singleton — không nhận inject từ `app.js`. Service `require()` trực tiếp:

- `sequelize-warranty-package-repository.js` (singleton)
- `WarrantyPackage`, `Product`, `ProductWarrantyPackage` models (require trực tiếp trong repository)

## 5.2 Used by (module khác dùng module này)

- `cart` — user chọn warranty package khi thêm sản phẩm vào giỏ (lưu `warrantyPackageId` trong CartItem)
- `orders` — đọc `WarrantyPackage.price` khi tính order total (`findActiveWarrantyPackagesByIds()` trong orders repository)
- `catalog` — hiển thị available warranty packages trong product detail

---

# 6. Gotchas & Edge Cases

- **`adminAuthenticate` khác `authenticate + authorize('admin')`:** Write operations dùng `adminAuthenticate` middleware từ `@middlewares/admin-auth`. Đây là pattern của singleton modules. Không đổi sang `authenticate + authorize('admin')` trừ khi migrate sang DI pattern.
- **Warranty price tính trong orders, không cart:** Cart chỉ lưu `warrantyPackageId`. Orders service gọi `findActiveWarrantyPackagesByIds()` khi tạo đơn để lấy price. `cart.total` không bao gồm warranty fee.
- **Xóa gói đang dùng bởi product:** `remove()` check `isUsedByProduct` — throw 400. Cách đúng là set `isActive = false`. FK constraint cũng block nếu có `CartItem` đang reference.
- **Singleton + direct require:** Không refactor sang DI trừ khi có lý do rõ ràng.
- **`getByProduct` trả về `isDefault`:** Field `isDefault` từ `ProductWarrantyPackage` join table — mỗi product có thể đánh dấu 1 warranty package là default (pre-selected trong UI).

---

# 7. Tests

| File                                               | Loại        | Mô tả                            |
| -------------------------------------------------- | ----------- | -------------------------------- |
| `services/warranty-package-service.test.js`        | Unit        | CRUD, getByProduct, remove guard |
| `controllers/warranty-package-controller.test.js`  | Unit        | HTTP layer                       |
| `repositories/warranty-package-repository.test.js` | Unit        | Repository queries               |
| `src/__integration__/warranty.integration.test.js` | Integration | DB integration                   |
