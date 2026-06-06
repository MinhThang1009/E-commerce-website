# Inventory Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Restock](#31-restock)
  - [3.2 Inventory logs listing](#32-inventory-logs-listing)
  - [3.3 Event handler (order.cancelled)](#33-event-handler-ordercancelled)
  - [3.4 Business rules](#34-business-rules)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Theo dõi tồn kho theo biến thể sản phẩm (`ProductVariant`). Ghi immutable log (`InventoryLog`) mỗi khi stock thay đổi. Lắng nghe event `order.cancelled` từ `orders` module để ghi inventory log. Cho phép admin nhập kho (`restock`) và xem lịch sử thay đổi tồn kho.

**Phân công trách nhiệm rõ ràng**:

- **Stock tăng (restock)**: Thực hiện trong `inventory` service — trong transaction.
- **Stock giảm (đặt hàng)**: Thực hiện trong `orders` service — trong transaction với `SELECT FOR UPDATE`. Inventory chỉ nhận event sau đó để ghi inventory log.

## 1.2 DI Pattern

Module DI đầy đủ qua constructor injection. Subscribe event tại thời điểm `subscribeEvents()` được gọi (trong `app.js` sau khi tất cả modules khởi tạo):

```js
// module.js
return {
  basePath: '/inventory',
  router,
  subscribeEvents() {
    eventBus.subscribe('order.cancelled', async (event) => {
      for (const item of event.payload.items) {
        await inventoryRepository.createInventoryLog({
          productId: item.productId,
          variantId: item.variantId || null,
          changeType: 'cancellation',
          changeAmount: item.quantity,
          previousStock: 0, // audit-only placeholder
          newStock: 0,
          ...
        });
      }
    });
  },
};
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/inventory/
  module.js
  routes.js
  controllers/
    inventory-controller.js
  services/
    inventory-service.js                 — ~115 lines: restock + logs listing
  repositories/
    sequelize-inventory-repository.js    — CRUD InventoryLog, stock queries
    i-inventory-repository.js            — interface
  dtos/
    inventory-dto.js                     — pass-through DTOs
  CLAUDE.md
```

---

# 3. Business Logic Chính

## 3.1 Restock

**`restockProduct({ productId, variantId, quantity, note, adminId })`**:

1. Validate `quantity`: phải là số nguyên dương — nếu không → 400
2. Tìm `Product` — không tồn tại → 404
3. Nếu có `variantId`: tìm `ProductVariant` với cả `id` VÀ `productId` (đảm bảo variant thuộc đúng product) — không tồn tại → 404
4. Tính `previous` stock, cộng `qty` vào `stockable.stockQuantity`
5. **Trong transaction**:
   - Save `stockable` (variant hoặc product) với stock mới
   - Nếu là variant: `sumVariantStockByProductId` → update `Product.stockQuantity` cho đồng bộ
   - Tạo `InventoryLog` (changeType: `'restock'`)
     Trả về: `{ productId, variantId, previousStock, newStock, quantity, log }`.

## 3.2 Inventory logs listing

**`getInventoryLogs({ page, limit, productId, changeType })`**:

- Filter: `productId`, `changeType`
- `page` clamp ≥ 1 (page=0 / âm / không hợp lệ → mặc định 1, tránh MySQL "Row offset cannot be negative")
- Max 100 records per page
- Include: `Product` (id, nameVi, nameEn, slug), `ProductVariant` (id, sku), `User` (id, firstName, lastName) as `'creator'`
- Order: `createdAt DESC`

## 3.3 Event handler (order.cancelled)

Subscribe trong `subscribeEvents()` — không trong service:

```
order.cancelled → iterate event.payload.items → createInventoryLog(changeType: 'cancellation')
```

**Quan trọng**: Stock đã được restore trong `orders.cancelOrder` inline (trong transaction trước khi event fire). Inventory chỉ ghi inventory log. `previousStock = 0` và `newStock = 0` là placeholder — không phải giá trị thực.

Lỗi khi ghi log → `logger.warn` và tiếp tục (không fail silently với critical operations).

## 3.4 Business rules

- **InventoryLog là immutable**: Chỉ INSERT, không UPDATE/DELETE. `updatedAt: false` trên model — đây là inventory trail tài chính.
- **Stock decrement KHÔNG trong inventory service**: Stock giảm khi đặt hàng phải nằm trong `orders` service với `SELECT FOR UPDATE` trong transaction. KHÔNG bao giờ decrement stock ngoài `unitOfWork`.
- **Sync `Product.stockQuantity`**: Khi restock variant → tính tổng tất cả variants (`sumVariantStockByProductId`) → ghi vào `Product.stockQuantity`. Giữ đồng bộ để catalog hiển thị đúng.
- **Validate variant belongs to product**: `findVariantByIdAndProductId(variantId, productId)` — kiểm tra cả hai điều kiện. Tránh restock nhầm variant của product khác.

---

# 4. API Endpoints

Base path: `/api/inventory`

`router.use(authenticate)` cho toàn router; phân quyền theo từng route (Pha 0 — tồn kho là nghiệp vụ bán hàng): nhập kho → `staff`, xem nhật ký → `admin` + `staff` (giám sát). Không có endpoint public.

| Method | Path                           | Auth                                      | Mô tả                                                           |
| ------ | ------------------------------ | ----------------------------------------- | --------------------------------------------------------------- |
| POST   | `/products/:productId/restock` | authenticate + authorize('staff')         | Nhập kho cho product hoặc variant cụ thể (staff)                |
| GET    | `/logs`                        | authenticate + authorize('admin','staff') | Danh sách inventory logs (admin xem-only + staff; max 100/page) |

> **Restock dup ĐÃ GỠ (2026-06-05):** trước đây `admin` module có `restockProduct` RIÊNG (`POST /api/admin/products/:productId/restock`, impl độc lập không qua DI) — FE không gọi (FE dùng `/admin/products/:id/stock` = `updateProductStock`). Đã gỡ, **consolidate về inventory** (canonical, qua DI + đã test-strengthen). Giờ restock CHỈ qua `POST /api/inventory/products/:productId/restock`. (Admin vẫn còn `updateProductStock` = SET stock, KHÁC restock = ADD stock.)

---

# 5. Dependencies

## 5.1 Depends on

- Models inject từ app.js: `Product`, `ProductVariant`, `InventoryLog`, `User`
- `sequelize` — transactions cho restock
- `eventBus` — subscribe `order.cancelled`
- `logger`

## 5.2 Used by

**Subscribe events từ:**

- `orders` — publish `order.cancelled` → inventory ghi inventory log

**Publish events:** không có (event `inventory.restocked` đã xóa khỏi implementation).

**Direct dependency:**

- `admin` — admin UI nhập kho qua `POST /api/inventory/products/:id/restock` (canonical) + cập nhật tồn qua `PATCH /api/admin/products/:id/stock` (updateProductStock); xem logs qua `GET /api/inventory/logs`
- `catalog` — stock display trong product detail (đọc trực tiếp từ `ProductVariant.stockQuantity`, không qua inventory API)

---

# 6. Gotchas & Edge Cases

- **`InventoryLog` immutable**: KHÔNG bao giờ UPDATE hoặc DELETE log entry. `updatedAt: false` là intentional. Đây là inventory trail tài chính — cần cho reconciliation.
- **`previousStock = 0` trong cancellation log**: Log cho `order.cancelled` dùng `previousStock: 0` và `newStock: 0` — placeholder, không phải giá trị thực. Stock đã restore trong `orders` flow trước khi event fire.
- **Stock decrement PHẢI trong orders service với SELECT FOR UPDATE**: KHÔNG bao giờ decrement stock bên ngoài `unitOfWork`. Race condition → oversell. Pattern: `SELECT FOR UPDATE → check stock → decrement → commit`.
- **`subscribeEvents()` gọi sau tất cả modules init**: Nếu inventory module throw trong constructor → event subscription không xảy ra → `order.cancelled` sẽ không có inventory log. Kiểm tra logs khi deploy.
- **Restock variant cộng tổng vào Product**: `sumVariantStockByProductId` tính tổng ALL variants, không phải chỉ variant vừa restock. Nếu muốn product.stockQuantity phản ánh đúng → phải restock qua service, không update variant trực tiếp.
- **`saveStockable()` trong repository vs direct save**: Một số paths khác update `ProductVariant` trực tiếp (orders, admin) không qua inventory service → `Product.stockQuantity` có thể lệch. Sync chỉ đảm bảo khi đi qua `restockProduct`.
- **`sumVariantStockByProductId` forward `opts` (ĐÃ FIX)**: repository signature là `sumVariantStockByProductId(productId, options = {})` và spread `...options` vào query → SUM chạy TRONG transaction restock, đọc tổng tồn nhất quán. (Trước đây opts bị bỏ qua → đã sửa ở phiên fix 9 bug.)
- **⚠️ Restock chưa lock variant (INV-2, known limitation):** `restockProduct` load product/variant NGOÀI transaction + KHÔNG `SELECT FOR UPDATE` → 2 restock đồng thời cùng variant có thể lost-update (cả hai đọc previous=N, +qty, ghi N+qty → mất 1 lần). Rủi ro thấp (admin/staff thao tác thủ công, hiếm đồng thời) + self-correcting. Fix đúng: load + lock variant TRONG tx (`SELECT FOR UPDATE`) rồi mới read-modify-write — giống pattern decrement ở `orders`.
- **InventoryLog `changeType: 'cancellation'` có amount dương**: `changeAmount = item.quantity` là dương (số lượng trả về kho) — convention ghi số lượng, không phải delta âm.

---

# 7. Tests

| File                                        | Loại | Mô tả                   |
| ------------------------------------------- | ---- | ----------------------- |
| `services/inventory-service.test.js`        | Unit | Restock logic, validate |
| `controllers/inventory-controller.test.js`  | Unit | HTTP layer              |
| `repositories/inventory-repository.test.js` | Unit | Repository queries      |
