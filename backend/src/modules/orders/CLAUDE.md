# Orders Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 createOrder](#31-createorder)
  - [3.2 updateOrderStatus (admin)](#32-updateorderstatus-admin)
  - [3.3 cancelOrder (user)](#33-cancelorder-user)
  - [3.4 confirmReceived (user)](#34-confirmreceived-user)
  - [3.5 repayOrder](#35-repayorder)
  - [3.6 trackOrder (public)](#36-trackorder-public)
  - [3.7 estimateShipping](#37-estimateshipping)
  - [3.8 Order number format](#38-order-number-format)
  - [3.9 Shipping calculation](#39-shipping-calculation)
  - [3.10 Order status transitions](#310-order-status-transitions)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
  - [5.3 Events published](#53-events-published)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Xử lý toàn bộ vòng đời đơn hàng: tạo đơn từ giỏ hàng hoặc buy-now (với stock lock + SELECT FOR UPDATE), áp dụng discount code, hủy đơn (restore stock), thanh toán lại, xác nhận nhận hàng (user), và public order tracking.

## 1.2 DI Pattern

DI đầy đủ. `emailService` được wrap thành `emailGateway` adapter để dễ mock trong tests:

```js
const repo = new SequelizeOrdersRepository({
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  InventoryLog,
  sequelize,
});
const emailGateway = {
  sendOrderConfirmationEmail,
  sendOrderCancellationEmail,
  sendOrderStatusUpdateEmail,
};
const service = new OrdersService({
  ordersRepository: repo,
  emailGateway,
  eventBus,
  logger,
  constants,
});
const controller = new OrdersController({ ordersService: service });
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/orders/
  module.js                                     — factory DI, tạo emailGateway adapter
  routes.js                                     — 11 routes
  controllers/
    orders-controller.js                        — 11 handlers
    orders-controller.unit.test.js
  services/
    orders-service.js                           — ~885 lines: toàn bộ business logic
    orders-service.test.js
    orders-service.unit.test.js
    orders-service.edge-cases.test.js
    orders-service.edge-cases-2.test.js
    orders-service.edge-cases-3.test.js
    orders-service.edge-cases-4.test.js
  repositories/
    i-orders-repository.js
    sequelize-orders-repository.js              — cross-model queries (Order, Cart, Product, Variant...)
    orders-repository.test.js
    orders-repository.edge-cases.test.js
    orders-repository.edge-cases-2.test.js
  validators/
    orders-validator.js                         — createOrderSchema, updateOrderStatusSchema (Zod)
  dtos/
    orders-dto.js
```

---

# 3. Business Logic Chính

## 3.1 createOrder

Tạo đơn hàng từ giỏ hàng (cart flow) hoặc trực tiếp (buy-now flow):

```
runInTransaction(async (tx) => {
  // Cart flow: findOrCreate active cart, merge guest cart (session cookie)
  // Buy-now flow: load Product/Variant trực tiếp từ req.body.items

  Với từng item:
    lockVariant(variantId, tx) hoặc lockProduct(productId, tx)  ← SELECT FOR UPDATE
    Validate stockQuantity >= quantity
    decrementVariantStock() / decrementProductStock()
    Ghi pendingInventoryLog
    Tính subtotal, totalWeightKg

  Validate + apply discountCode (nếu có):
    - Manual methods (cod, bank_transfer, installment) → incrementDiscountCodeUsage() ngay
    - Online methods (momo, vnpay) → đợi IPN webhook xác nhận

  Lấy shippingCost từ req.body.shippingCost (FE-supplied, server tin tưởng giá trị này)
  cancelPendingOrdersByUser(userId)   ← hủy pending orders cũ của user

  createOrder() + createOrderItems() + createInventoryLogs()

  Cart flow + manual payment → clearUserCart()
})

eventBus.publish('order.created', payload)          ← outside transaction
emailGateway.sendOrderConfirmationEmail()            ← fire-and-forget
```

## 3.2 updateOrderStatus (admin)

```
1. findOrderByPkWithItemsAndUser(id)
2. order.status = newStatus
3. Nếu delivered + COD → order.paymentStatus = 'paid' tự động
4. saveOrder()
5. emailGateway.sendOrderStatusUpdateEmail() — fire-and-forget
```

## 3.3 cancelOrder (user)

Chỉ cancel được khi `status === 'pending'` hoặc `status === 'processing'`:

```
runInTransaction(async (tx) => {
  order.status = 'cancelled'
  Restore stock (variant hoặc product)
})
eventBus.publish('order.cancelled', payload)
emailGateway.sendOrderCancellationEmail() — fire-and-forget
```

## 3.4 confirmReceived (user)

User tự xác nhận đã nhận hàng. Chỉ cho phép từ status `shipped` hoặc `processing`. Gọi trên đơn đã `delivered` → throw 422:

```
Nếu status không phải 'shipped' hoặc 'processing' → throw 422
order.status = 'delivered'
Nếu COD → order.paymentStatus = 'paid'
saveOrder() + reload()
Trả về { data: order }
```

## 3.5 repayOrder

Chỉ hoạt động khi `status === 'pending'` hoặc `status === 'cancelled'` hoặc `paymentStatus === 'failed'`. Reset `status = 'pending'` và `paymentStatus = 'pending'`. Trả về `paymentUrl` để FE redirect.

## 3.6 trackOrder (public)

Không cần auth. Query params: `?number=ORD-...&email=user@email.com`. Trả về tracking steps và current status. Yêu cầu email khớp với email user của đơn hàng.

## 3.7 estimateShipping

Synchronous (không async). Input: `?subtotal=N` (tham số `weight` bị bỏ qua). Signature: `estimateShipping({ subtotal })`. Trả về `{ shippingCost: 0 | null, freeShippingThreshold }`.

## 3.8 Order number format

`ORD-{YYYYMMDD}-{4-digit decimal}` — ví dụ `ORD-20260523-4823`

Sử dụng `crypto.randomInt(1000, 9999)`.

## 3.9 Shipping calculation

Nếu `subtotal >= SHIPPING_FREE_THRESHOLD` → `shippingCost = 0`. Ngược lại → trả `null` (FE tự tính theo khoảng cách). Không có công thức weight-based trong service.

## 3.10 Order status transitions

```
pending → processing → shipped → delivered
  ↓           ↓
cancelled   cancelled
```

- `cancelled`: từ `pending` hoặc `processing` (user hoặc admin)
- `delivered`: từ `shipped` hoặc `processing` — qua `confirmReceived` (user) hoặc `updateOrderStatus` (admin). Gọi `confirmReceived` khi đã `delivered` → 422.
- `returned`: không có trong service hiện tại (chỉ là status value trong DB)

---

# 4. API Endpoints

Base path: `/api/orders`

**Lưu ý route order:** `/track`, `/shipping-estimate`, `/number/:number`, `/admin/all` phải đứng trước `/:id` để tránh conflict.

| Method | Path                 | Auth               | Mô tả                                               |
| ------ | -------------------- | ------------------ | --------------------------------------------------- |
| GET    | `/track`             | — (public)         | Tracking đơn theo `?number=ORD-...&email=...`       |
| POST   | `/`                  | authenticate       | Tạo đơn hàng mới                                    |
| GET    | `/`                  | authenticate       | Lịch sử đơn hàng của user (paginated, max 100/page) |
| GET    | `/shipping-estimate` | authenticate       | Ước tính phí vận chuyển                             |
| GET    | `/number/:number`    | authenticate       | Tìm đơn theo order number                           |
| GET    | `/:id`               | authenticate       | Chi tiết đơn hàng                                   |
| POST   | `/:id/cancel`        | authenticate       | Hủy đơn (pending/processing only)                   |
| POST   | `/:id/repay`         | authenticate       | Thanh toán lại đơn (pending/cancelled/failed)       |
| POST   | `/:id/receive`       | authenticate       | Xác nhận đã nhận hàng                               |
| GET    | `/admin/all`         | authorize('admin') | Tất cả đơn hàng (có filter `?status=...`)           |
| PATCH  | `/admin/:id/status`  | authorize('admin') | Cập nhật trạng thái đơn                             |

**Body `POST /`:** `createOrderSchema` (Zod) — shippingAddress, billingAddress, paymentMethod, discountCode?, pointsToUse?, items? (buy-now)

**Body `PATCH /admin/:id/status`:** `{ status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' }`

---

# 5. Dependencies

## 5.1 Depends on

Inject từ `app.js`:

- **Models:** `Order`, `OrderItem`, `Cart`, `CartItem`, `Product`, `ProductVariant`, `User`, `DiscountCode`, `InventoryLog`
- **sequelize:** cho transactions
- **emailService:** wrapped thành `emailGateway` adapter trong `module.js`
- **eventBus, logger**
- **constants:** `SHIPPING_FREE_THRESHOLD`

## 5.2 Used by

- `payment` — sau IPN success, update `order.paymentStatus` trực tiếp qua DB (không gọi orders service)
- `admin` — xem và quản lý đơn hàng
- `users` — `cancelPendingOrdersByUser()` khi user yêu cầu xóa tài khoản

## 5.3 Events published

| Event             | Khi nào                                                     | Subscriber                                    |
| ----------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `order.created`   | Sau tạo đơn thành công (outside transaction)                | (hiện chưa có subscriber chức năng)           |
| `order.cancelled` | Sau hủy đơn                                                 | `inventory` — ghi inventory log stock restore |
| `order.delivered` | (planned, không implemented — code không publish event này) | —                                             |

---

# 6. Gotchas & Edge Cases

- **SELECT FOR UPDATE bắt buộc:** `lockVariant(variantId, tx)` / `lockProduct(productId, tx)` trước khi decrement stock — không bỏ. Nếu bỏ → race condition oversell khi nhiều requests tạo đơn cùng lúc.
- **Discount `usedCount` tăng khi nào:** Manual methods (cod/bank_transfer/installment) → tăng ngay trong `createOrder` transaction. Online methods (momo/vnpay) → tăng trong `payment-service.js` sau IPN/return success.
- **Stock restore là inline trong cancelOrder:** Restore xảy ra trong `orders-service.js` trực tiếp — không qua inventory event. `order.cancelled` event chỉ để inventory ghi InventoryLog, không để restore stock.
- **`cancelPendingOrdersByUser()`:** Được gọi trong `createOrder()` để hủy pending order cũ trước khi tạo mới (1 user chỉ có 1 pending order tại một thời điểm). Không expose qua HTTP.
- **`emailGateway` là adapter:** Wrap `emailService` để dễ mock trong tests. Không gọi `emailService` trực tiếp trong service.
- **`confirmReceived` không idempotent:** Nếu `order.status === 'delivered'` → throw 422. Chỉ cho phép từ `shipped` hoặc `processing`.
- **productImages mapping:** `getUserOrders()` và `getOrderById()` map `productImages[]` → `thumbnail` + `images[]` + delete `productImages`. FE expect shape này.
- **`orders-service.js` dài:** Đọc `createOrder()` trước (lines 1–490), sau đó `updateOrderStatus()` + `cancelOrder()`. Helpers `_calcShippingCost`, `_buildTrackingSteps`, `_canCancel`... ở đầu file.

---

# 7. Tests

| File                                                  | Loại        | Mô tả                                           |
| ----------------------------------------------------- | ----------- | ----------------------------------------------- |
| `services/orders-service.test.js`                     | Unit        | Happy path: createOrder, cancel, update status  |
| `services/orders-service.unit.test.js`                | Unit        | Isolated unit tests                             |
| `services/orders-service.edge-cases.test.js`          | Unit        | Edge cases: oversell, invalid discount          |
| `services/orders-service.edge-cases-2.test.js`        | Unit        | Branch coverage: buy-now flow, guest cart merge |
| `services/orders-service.edge-cases-3.test.js`        | Unit        | confirmReceived, repayOrder branches            |
| `services/orders-service.edge-cases-4.test.js`        | Unit        | trackOrder, estimateShipping                    |
| `controllers/orders-controller.unit.test.js`          | Unit        | HTTP layer                                      |
| `repositories/orders-repository.test.js`              | Unit        | Repository queries                              |
| `repositories/orders-repository.edge-cases.test.js`   | Unit        | Repository edge cases                           |
| `repositories/orders-repository.edge-cases-2.test.js` | Unit        | Additional repository coverage                  |
| `src/__integration__/orders.integration.test.js`      | Integration | DB: transactions, stock lock                    |
| `src/__api__/orders.api.test.js`                      | HTTP        | End-to-end HTTP flows                           |
