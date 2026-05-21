# Shared — Core Infrastructure

> Building blocks dùng bởi mọi module. Import qua alias `@shared`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Thứ tự đọc](#1-thứ-tự-đọc)
- [2. errors/ — Error Class Hierarchy](#2-errors--error-class-hierarchy)
- [3. event-bus.js — In-Process Pub/Sub](#3-event-busjs--in-process-pubsub)
- [4. admin-audit.js — Admin Audit Logging](#4-admin-auditjs--admin-audit-logging)
- [5. persistence/unit-of-work.js — Transaction Wrapper](#5-persistenceunit-of-workjs--transaction-wrapper)
- [6. index.js — Barrel Export](#6-indexjs--barrel-export)

---

## 1. Thứ tự đọc

1. `errors/index.js` — error hierarchy (dùng nhiều nhất, đọc trước)
2. `event-bus.js` — pub-sub inter-module
3. `admin-audit.js` — audit logging
4. `persistence/unit-of-work.js` — transaction wrapper

---

## 2. errors/ — Error Class Hierarchy

```
Error (native)
  └── AppError                  ← Base, isOperational=true
        ├── NotFoundError       ← 404
        ├── ValidationError     ← 400
        ├── BusinessError       ← 422, có domainCode (machine-readable)
        └── DomainError         ← alias của BusinessError (backward compat, không tạo mới)
```

**Pattern dùng:**

```js
const { AppError, NotFoundError, BusinessError, ValidationError } = require('@shared/errors');

// Resource không tìm thấy
throw new NotFoundError('Product', productId);
// → message: "Product with id '42' does not exist"

// Business rule violation (constructor: message, domainCode)
throw new BusinessError('errors.cart.outOfStock', 'OUT_OF_STOCK');
// → 422, domainCode = 'OUT_OF_STOCK'

// Generic HTTP error
throw new AppError('errors.auth.unauthorized', 401);
// → message là i18n key, errorHandler translate
```

`AppError.isOperational = true` → errorHandler trả message cho client.
Non-operational errors (bugs, unexpected) → errorHandler trả 500 generic message (prod không expose details).

---

## 3. event-bus.js — In-Process Pub/Sub

Cross-module communication mà không import lẫn nhau trực tiếp.

```js
// Subscribe (trong module.subscribeEvents() hoặc module factory)
eventBus.subscribe('order.created', async ({ payload }) => {
  await inventoryService.logChange(payload.orderId);
});

// Publish (trong service)
eventBus.publish({ type: 'order.created', payload: { orderId }, occurredAt: new Date() });
```

- `Promise.allSettled` — 1 handler lỗi không block handlers khác
- `eventBus.clear()` — xóa toàn bộ subscribers (dùng trong test isolation)

**Events hiện tại (6):**

| Event                 | Publisher | Subscriber                    |
| --------------------- | --------- | ----------------------------- |
| `order.created`       | orders    | inventory (log change)        |
| `order.cancelled`     | orders    | inventory (restore stock log) |
| `auth.userRegistered` | auth      | — (publish-only hiện tại)     |
| `order.delivered`     | orders    | — (publish-only hiện tại)     |
| `payment.succeeded`   | payment   | — (publish-only hiện tại)     |
| `inventory.restocked` | inventory | — (publish-only hiện tại)     |

---

## 4. admin-audit.js — Admin Audit Logging

Ghi log admin actions ra file (Winston) và database (`AuditLog` model).

```js
// Inject vào admin module qua app.js
AdminAuditService.logUserAction(adminUser, 'delete', targetUserId, changes, ip);
AdminAuditService.logProductAction(adminUser, 'create', productId, name, changes, ip);
AdminAuditService.logOrderAction(adminUser, 'cancel', orderId, orderCode, changes, ip);
AdminAuditService.logDiscountCodeAction(adminUser, 'deactivate', discountId, code, changes, ip);
AdminAuditService.logReviewAction(adminUser, 'delete', reviewId, userId, productId, ip);
AdminAuditService.logSuccessfulLogin(adminUser, ip);
AdminAuditService.logFailedAuth(email, reason, ip);
AdminAuditService.logDashboardAccess(adminUser, endpoint, filters); // chỉ file log, không ghi DB
```

**Implementation notes:**

- Dùng `AsyncLocalStorage` để track IP per-request — không race condition giữa concurrent requests
- Lazy-require `@models` trong function body → tránh circular dependency khi startup
- DB errors không interrupt request (wrapped try-catch, log `.warn()`)

---

## 5. persistence/unit-of-work.js — Transaction Wrapper

Service dùng thay vì gọi `sequelize.transaction()` trực tiếp.

```js
const { unitOfWork } = require('@shared');

await unitOfWork.runInTransaction(async (tx) => {
  // SELECT FOR UPDATE — chống race condition (oversell, double redeem)
  const variant = await unitOfWork.lockRow(ProductVariant, { id: variantId }, tx);
  variant.stockQuantity -= quantity;
  await variant.save({ transaction: tx });
  await OrderItem.create({ ... }, { transaction: tx });
});

// Nested transaction: reuse parent tx, không tạo SAVEPOINT mới
await unitOfWork.runInTransaction(async (tx) => { ... }, { transaction: parentTx });
```

`lockRow(Model, where, tx)` → `findOne({ where, lock: tx.LOCK.UPDATE, transaction: tx })`.

---

## 6. index.js — Barrel Export

```js
const {
  AppError,
  BusinessError,
  ValidationError,
  NotFoundError,
  DomainError,
  eventBus,
  Result,
  unitOfWork,
  logger,
  sequelize,
} = require('@shared');
```

`Result` — utility class cho pattern Result/Option (ít dùng trực tiếp, chủ yếu dùng trong DDD-lite modules nếu cần).
