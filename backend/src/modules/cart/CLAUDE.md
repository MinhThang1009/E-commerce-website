# Cart Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Cart operations](#31-cart-operations)
  - [3.2 Business rules](#32-business-rules)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý giỏ hàng cho cả user đã đăng nhập lẫn guest (via `sessionId` cookie). Hỗ trợ gắn warranty package vào item, validate stock khi thêm/cập nhật, sync cart với server, và merge guest cart vào user cart khi đăng nhập.

## 1.2 DI Pattern

Module dùng DI đầy đủ qua constructor injection:

```js
// module.js
module.exports = ({
  Cart,
  CartItem,
  Product,
  ProductVariant,
  WarrantyPackage,
  sequelize,
  eventBus,
  logger,
}) => {
  const cartRepository = new SequelizeCartRepository({
    Cart,
    CartItem,
    Product,
    ProductVariant,
    WarrantyPackage,
    sequelize,
  });
  const cartService = new CartService({ cartRepository, eventBus, logger });
  const cartController = new CartController({ cartService });
  const router = buildRoutes({ cartController });
};
```

Tất cả 5 models + `sequelize` + `eventBus` + `logger` đều bắt buộc — throw Error nếu thiếu.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/cart/
  module.js                                — DI wiring
  routes.js                                — HTTP endpoints, tất cả dùng optionalAuthenticate
  controllers/
    cart-controller.js                     — Thin handlers, pass req context vào service
  services/
    cart-service.js                        — ~500 lines: merge logic, stock check, price calc
  repositories/
    i-cart-repository.js                   — Interface
    sequelize-cart-repository.js           — Queries: findOrCreate, merge, cartItems với details
  validators/
    cart-validator.js                      — Zod: addToCartSchema, updateCartItemSchema, syncCartSchema
  dtos/
    cart-dto.js
  CLAUDE.md
```

---

# 3. Business Logic Chính

## 3.1 Cart operations

**`cart-service.js`** (~500 lines):

- `getCart({ user, cookieSessionId })` — lấy cart kèm items, prices, warranty packages. Nếu user đã login và có `cookieSessionId` → tự động merge guest cart vào user cart trong flow này.
- `getCartCount({ user, cookieSessionId })` — đếm tổng quantity items.
- `addToCart({ user, cookieSessionId, body, setSessionCookie })` — thêm item (hoặc tăng quantity nếu đã có). Validate stock. Guest không có sessionId → tạo UUID mới, gọi callback `setSessionCookie` để controller set cookie.
- `updateCartItem({ user, cookieSessionId, itemId, quantity })` — cập nhật quantity, validate ownership + stock.
- `removeCartItem({ user, cookieSessionId, itemId })` — xóa 1 item, validate ownership.
- `clearCart({ user, cookieSessionId })` — xóa toàn bộ items của cart.
- `syncCart({ user, cookieSessionId, items })` — replace toàn bộ items trong cart bằng danh sách từ client (dùng cho offline sync).
- `mergeCart({ user, cookieSessionId })` — merge guest cart (`cookieSessionId`) vào user cart. Items trùng `productId + variantId` → cộng dồn quantity; items mới → append. Guest cart chuyển status `merged`.
- `validateCart({ user, cookieSessionId })` — check stock và availability cho mỗi item. Không lock. Trả danh sách items valid/invalid.

## 3.2 Business rules

- **Guest cart**: Dùng `sessionId` UUID cookie, cart status `active`. Không cần đăng nhập.
- **Merge logic trong `getCart`**: Khi user đăng nhập có cookie sessionId, `getCart` tự merge inline (không cần gọi `/merge` riêng). `/merge` endpoint là explicit call cho trường hợp post-login.
- **Merge deduplication**: Items trùng `productId + variantId` → cộng dồn quantity. Items không trùng → append. Sau merge, guest cart status = `merged`.
- **Ownership check**: `_assertOwnership` verify CartItem thuộc về đúng user (userId match) hoặc đúng session (sessionId match). Throw 403 nếu không match.
- **Stock check**: `_assertStock` tại `addToCart` và `updateCartItem`. Variant stock ưu tiên; nếu không có variant → dùng `product.defaultVariant.stockQuantity`. Không check tại `validateCart` time — chỉ cảnh báo.
- **Warranty package**: Optional, `warrantyPackageIds[]` trong CartItem. Validate tất cả IDs tồn tại và active khi add. Giá warranty tính lại khi checkout trong `orders` service — không cache trong CartItem.
- **Price trong CartItem**: `unitPrice` lưu snapshot tại thời điểm add (variant.price hoặc product.basePrice). Nhưng khi build response, giá hiển thị lấy từ `ProductVariant.price` hiện tại.
- **Cart status**: `active` → `merged` (sau merge) → `converted` (sau checkout) / `abandoned`.
- **`addToCart` transaction**: Toàn bộ findOrCreate cart + findOrCreate cartItem chạy trong 1 transaction.

---

# 4. API Endpoints

Base path: `/api/cart`

Tất cả endpoints dùng `optionalAuthenticate` (apply qua `router.use()`) — hoạt động cả guest lẫn logged-in user.

| Method | Path              | Auth                 | Mô tả                                             |
| ------ | ----------------- | -------------------- | ------------------------------------------------- |
| GET    | `/cart`           | optionalAuthenticate | Lấy giỏ hàng (kèm auto-merge nếu có cookie guest) |
| GET    | `/cart/count`     | optionalAuthenticate | Đếm tổng quantity items                           |
| POST   | `/cart`           | optionalAuthenticate | Thêm sản phẩm vào giỏ (validate stock)            |
| POST   | `/cart/sync`      | optionalAuthenticate | Replace toàn bộ items bằng danh sách từ client    |
| POST   | `/cart/merge`     | optionalAuthenticate | Explicit merge guest cart vào user cart           |
| GET    | `/cart/validate`  | optionalAuthenticate | Check stock/availability trước checkout           |
| PUT    | `/cart/items/:id` | optionalAuthenticate | Cập nhật quantity item (validate stock)           |
| DELETE | `/cart/items/:id` | optionalAuthenticate | Xóa 1 item                                        |
| DELETE | `/cart`           | optionalAuthenticate | Xóa toàn bộ giỏ hàng                              |

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

- `Cart`, `CartItem`, `Product`, `ProductVariant`, `WarrantyPackage` models — inject từ `app.js`
- `sequelize` — transactions trong `addToCart`
- `eventBus` — inject nhưng hiện không publish event (`subscribeEvents()` là empty)

## 5.2 Used by (module khác dùng module này)

- `orders` module — đọc CartItem để tạo OrderItem, xóa hoặc chuyển cart sang `converted` sau checkout
- Frontend checkout flow — gọi `GET /cart/validate` trước khi đặt hàng

**Events**: Module không publish và không subscribe event nào.

---

# 6. Gotchas & Edge Cases

- **`optionalAuthenticate` apply ở router level**: `router.use(optionalAuthenticate)` — không phải per-route. Guest dùng `sessionId` từ cookie `techstore_session`.
- **Auto-merge trong `getCart`**: Khi user đã login gọi `GET /cart` mà có cookie `sessionId` → service tự động merge guest cart inline. Không cần gọi `/merge` riêng.
- **Merge idempotent**: Gọi `POST /cart/merge` nhiều lần — sau lần đầu, guest cart status = `merged`, không còn active items. Lần 2 là no-op.
- **`setSessionCookie` callback**: `addToCart` nhận callback để controller set cookie. Pattern này tránh service biết về HTTP response. Test cần mock callback này.
- **Stock check không lock**: `validateCart()` chỉ check hiện tại, không lock. Lock thực sự (`SELECT FOR UPDATE`) xảy ra trong `orders` module khi tạo đơn. Race condition nhỏ là acceptable trade-off.
- **Warranty package price không cache**: `CartItem.warrantyPackageIds` là array IDs. Giá tính lại tại checkout trong orders service. Nếu warranty bị xóa/thay đổi giá giữa add và checkout → orders service xử lý.
- **Image resolution**: `_buildCartResponse` ưu tiên ảnh theo `variantId`, fallback về `isThumbnail=true`, cuối cùng là ảnh đầu tiên.
- **Price resolution**: Ưu tiên `defaultVariant.price`, fallback `min(variants.price)`, cuối cùng `product.basePrice`.
- **Cart module không subscribe event**: Comment trong `subscribeEvents()` ghi "hiện không subscribe event nào" — đây là trạng thái chủ động, không phải quên implement.

---

# 7. Tests

| File                                                      | Loại        | Mô tả                                 |
| --------------------------------------------------------- | ----------- | ------------------------------------- |
| `services/cart-service.test.js`                           | Unit        | Happy path                            |
| `services/cart-service.edge-cases.test.js`                | Unit        | Edge cases batch 1 (stock, merge)     |
| `services/cart-service.edge-cases-2.test.js`              | Unit        | Edge cases batch 2                    |
| `services/cart-service.edge-cases-3.test.js`              | Unit        | Edge cases batch 3                    |
| `controllers/cart-controller.test.js`                     | Unit        | HTTP layer                            |
| `repositories/cart-repository.test.js`                    | Unit        | Repository queries                    |
| `repositories/cart-repository.edge-cases.test.js`         | Unit        | Repository edge cases                 |
| `src/__integration__/cart.integration.test.js`            | Integration | DB integration (MySQL thật)           |
| `src/__integration__/cart-edge-cases.integration.test.js` | Integration | Integration edge cases                |
| `src/__api__/cart.http.test.js`                           | API HTTP    | End-to-end HTTP                       |
| `src/__api__/cart-edge-cases.http.test.js`                | API HTTP    | HTTP edge cases                       |
| `src/__api__/cart-extra.http.test.js`                     | API HTTP    | HTTP extra scenarios                  |
| `src/__api__/cart-orders-loyalty-deep.http.test.js`       | API HTTP    | Deep integration với orders + loyalty |
