# Shared — Core Infrastructure

> Building blocks dùng bởi mọi module. Import qua alias `@shared`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Thứ tự đọc](#1-thứ-tự-đọc)
- [2. errors/ — Error Class Hierarchy](#2-errors--error-class-hierarchy)
- [3. event-bus.js — In-Process Pub/Sub](#3-event-busjs--in-process-pubsub)
- [4. persistence/unit-of-work.js — Transaction Wrapper](#4-persistenceunit-of-workjs--transaction-wrapper)
- [5. index.js — Barrel Export](#5-indexjs--barrel-export)

---

## 1. Thứ tự đọc

1. `errors/index.js` — error hierarchy (dùng nhiều nhất, đọc trước)
2. `event-bus.js` — pub-sub inter-module
3. `persistence/unit-of-work.js` — transaction wrapper

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
// → message: "Product với id "42" không tồn tại"

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
// Ví dụ: inventory subscribe order.cancelled để ghi log
eventBus.subscribe('order.cancelled', async ({ payload }) => {
  await inventoryService.logChange(payload.orderId);
});

// Publish (trong service)
eventBus.publish({ type: 'order.created', payload: { orderId }, occurredAt: new Date() });
```

- `Promise.allSettled` — 1 handler lỗi không block handlers khác
- `eventBus.clear()` — xóa toàn bộ subscribers (dùng trong test isolation)

**Events hiện tại (3):**

| Event                 | Publisher | Subscriber                       |
| --------------------- | --------- | -------------------------------- |
| `order.created`       | orders    | — (chưa có subscriber chức năng) |
| `order.cancelled`     | orders    | inventory (restore stock log)    |
| `auth.userRegistered` | auth      | — (publish-only hiện tại)        |

---

## 4. persistence/unit-of-work.js — Transaction Wrapper

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

## 5. index.js — Barrel Export

```js
const {
  AppError,
  BusinessError,
  ValidationError,
  NotFoundError,
  DomainError,
  eventBus,
  unitOfWork,
  logger,
  sequelize,
} = require('@shared');
```

`index.js` spread toàn bộ `@shared/errors` (`AppError`, `DomainError`, `BusinessError`, `ValidationError`, `NotFoundError`) cộng `eventBus`, `sequelize`, `unitOfWork`, `logger`. Không có export `Result`.
