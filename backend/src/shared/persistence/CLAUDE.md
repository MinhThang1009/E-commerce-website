# UnitOfWork Pattern — TechStore Backend

← Quay lại [`shared/CLAUDE.md`](../CLAUDE.md) | [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. API](#2-api)
  - [2.1 runInTransaction](#21-runintransaction)
  - [2.2 lockRow](#22-lockrow)
- [3. Usage](#3-usage)
- [4. Gotchas](#4-gotchas)

---

# 1. Tổng quan

`unit-of-work.js` cung cấp 2 helpers để quản lý database transactions và row locking. Được inject qua DI vào các module cần transaction safety.

---

# 2. API

## 2.1 runInTransaction

```javascript
await unitOfWork.runInTransaction(async (transaction) => {
  // tất cả operations đều nhận transaction này
}, options);
```

- Nếu `options.transaction` đã có → reuse (nested call không tạo SAVEPOINT mới)
- Nếu không → `sequelize.transaction(async tx => work(tx))`
- Rollback tự động nếu `work` throw

## 2.2 lockRow

```javascript
const variant = await unitOfWork.lockRow(ProductVariant, { id: variantId }, transaction);
```

`SELECT ... FOR UPDATE` — lock row để tránh race condition. **Phải gọi trong transaction.**

---

# 3. Usage

```javascript
// orders-service.js
await unitOfWork.runInTransaction(async (tx) => {
  const variant = await unitOfWork.lockRow(ProductVariant, { id }, tx);
  if (variant.stockQuantity < quantity) throw new BusinessError('Không đủ hàng');
  await variant.decrement('stockQuantity', { by: quantity, transaction: tx });
  await Order.create({ ... }, { transaction: tx });
});
```

---

# 4. Gotchas

- `SELECT FOR UPDATE` chỉ có tác dụng trong InnoDB transaction — đảm bảo MySQL dùng InnoDB engine
- Nested transaction reuse (không tạo SAVEPOINT) — tránh deadlock khi gọi lồng nhau
- Dùng khi: giảm stock, đổi điểm loyalty, apply discount code (tránh oversell/double-redeem)
