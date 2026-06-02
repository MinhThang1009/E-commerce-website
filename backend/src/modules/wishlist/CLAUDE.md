# Wishlist Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Pattern (DI đầy đủ)](#12-pattern-di-đầy-đủ)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 getWishlist](#31-getwishlist)
  - [3.2 addToWishlist](#32-addtowishlist)
  - [3.3 removeFromWishlist](#33-removefromwishlist)
  - [3.4 checkWishlist](#34-checkwishlist)
  - [3.5 clearWishlist](#35-clearwishlist)
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

Cho phép user lưu sản phẩm yêu thích server-side (chỉ khi đăng nhập). Sync hai chiều với `wishlistStore` (Zustand) trên client. Guest wishlist lưu local trong Zustand — không persist server.

## 1.2 Pattern (DI đầy đủ)

```js
const repo = new SequelizeWishlistRepository({ Wishlist, Product });
const service = new WishlistService({ wishlistRepository: repo, eventBus, logger });
const controller = new WishlistController({ wishlistService: service });
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/wishlist/
  module.js                                    — factory DI
  routes.js                                    — 5 routes, tất cả require authenticate
  controllers/
    wishlist-controller.js
    wishlist-controller.test.js
  services/
    wishlist-service.js                        — ~90 lines: getWishlist, addToWishlist, removeFromWishlist, checkWishlist, clearWishlist
    wishlist-service.test.js
    wishlist-service.unit.test.js
  repositories/
    i-wishlist-repository.js
    sequelize-wishlist-repository.js
    wishlist-repository.test.js
  dtos/
    wishlist-dto.js                            — pass-through DTO (service đã build product shape)
```

---

# 3. Business Logic Chính

## 3.1 getWishlist

Load `Wishlist` items kèm `Product` (include variants, defaultVariant, productImages). Transform:

- Tính `stockQuantity` = tổng stock từ tất cả variants (hoặc defaultVariant nếu không có variants)
- Set `inStock = stockQuantity > 0`
- Map `productImages` → `images[]` + `thumbnail` (primary image hoặc first)
- Xóa `productImages`, `defaultVariant`, `variants` khỏi response

## 3.2 addToWishlist

1. Verify product tồn tại
2. `findItem(userId, productId)` — nếu đã có → return `{ alreadyExists: true }` (không throw)
3. Nếu chưa có → `createItem({ userId, productId })`

## 3.3 removeFromWishlist

Tìm item, verify tồn tại (throw 404 nếu không có), xóa.

## 3.4 checkWishlist

```js
checkWishlist({ userId, productId }) → { inWishlist: boolean }
```

Dùng cho product detail page để hiển thị icon wishlist filled/empty.

## 3.5 clearWishlist

`clearByUserId(userId)` — xóa toàn bộ records của user.

---

# 4. API Endpoints

## 4.1 Routes

Base path: `/api/wishlists`. Tất cả require `authenticate` (global middleware trên router).

| Method | Path                | Auth         | Mô tả                                           |
| ------ | ------------------- | ------------ | ----------------------------------------------- |
| GET    | `/`                 | authenticate | Danh sách sản phẩm yêu thích (kèm product info) |
| POST   | `/`                 | authenticate | Thêm sản phẩm vào wishlist                      |
| GET    | `/check/:productId` | authenticate | Kiểm tra sản phẩm có trong wishlist không       |
| DELETE | `/:productId`       | authenticate | Xóa 1 sản phẩm khỏi wishlist                    |
| DELETE | `/`                 | authenticate | Xóa toàn bộ wishlist                            |

**Lưu ý route order:** `/check/:productId` phải đứng trước `/:productId` trong router để không bị conflict.

**Body `POST /`:** `{ productId: number }`

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

Inject từ `app.js`:

- **Models:** `Wishlist`, `Product`
- **eventBus, logger**

## 5.2 Used by (module khác dùng module này)

- `catalog` — hiển thị wishlist icon (filled/empty) trên product cards (FE gọi `GET /check/:productId` hoặc load toàn bộ wishlist khi login)

---

# 6. Gotchas & Edge Cases

- **`addToWishlist` là non-throwing nếu đã tồn tại:** Service trả `{ alreadyExists: true }` thay vì throw. FE không cần check trước khi add — luôn an toàn để gọi `POST /`.
- **Guest wishlist không có API:** Gọi bất kỳ endpoint nào mà không có auth → 401. Guest wishlist chỉ trong Zustand local store.
- **Sync local → server khi login:** FE chịu trách nhiệm — đọc Zustand store, loop qua từng productId, gọi `POST /api/wishlists`. Module không biết về guest wishlist content.
- **`DELETE /` xóa toàn bộ, không có confirmation:** FE phải confirm dialog trước khi gọi.
- **`getWishlist` tính stock từ variants:** `stockQuantity = sum(variant.stockQuantity)`. Nếu product không có variants → dùng `defaultVariant.stockQuantity`.
- **Route order quan trọng:** `GET /check/:productId` đứng trước `DELETE /:productId` để Express không nhầm `check` là productId. Đây đã được xử lý đúng trong `routes.js`.
- **Error messages dùng i18n key (WL-1):** Mọi `throw new AppError(...)` truyền **key** (`wishlist.productNotFound`, `wishlist.notInWishlist`), KHÔNG hardcode chuỗi tiếng Việt — error-handler `t(msg) || msg` chỉ translate khi `msg` là key (raw VN sẽ lọt nguyên si sang user tiếng Anh).
- **Unique constraint chống race add:** Index `uq_wishlists_user_product` (model) đảm bảo không có 2 record (userId, productId) trùng — `addToWishlist` race-condition (check-then-create) → create thứ 2 ném `SequelizeUniqueConstraintError` → 409, không tạo duplicate.

---

# 7. Tests

| File                                                                        | Loại        | Mô tả                                      |
| --------------------------------------------------------------------------- | ----------- | ------------------------------------------ |
| `services/wishlist-service.test.js`                                         | Unit        | Happy path: get, add, remove, check, clear |
| `services/wishlist-service.unit.test.js`                                    | Unit        | Isolated unit tests                        |
| `controllers/wishlist-controller.test.js`                                   | Unit        | HTTP layer                                 |
| `repositories/wishlist-repository.test.js`                                  | Unit        | Repository queries                         |
| `src/__integration__/wishlist.integration.test.js`                          | Integration | DB integration                             |
| `src/__api__/wishlist.http.test.js` + `wishlist-comprehensive.http.test.js` | HTTP        | End-to-end HTTP                            |
