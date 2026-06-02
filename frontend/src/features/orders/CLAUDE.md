# Orders Feature — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
- [3. State Management](#3-state-management)
- [4. API Calls](#4-api-calls)
- [5. Components chính](#5-components-chính)
- [6. Types](#6-types)
- [7. Dependencies](#7-dependencies)
- [8. Gotchas & Edge Cases](#8-gotchas--edge-cases)
- [9. Tests](#9-tests)

---

# 1. Mục đích & Trách nhiệm

Hiển thị danh sách đơn hàng, xem chi tiết, hủy đơn, thanh toán lại, xác nhận nhận hàng. Có trang tracking công khai không cần login. Cung cấp `useCreateOrderMutation` và `useApplyDiscountCodeMutation` được dùng bởi `CheckoutPage` (feature checkout). Routes: `/orders`, `/track-order`.

---

# 2. Cấu trúc Files

```
api/
  order-api.ts        — Tất cả TanStack Query hooks + orderKeys (const internal, KHÔNG export khỏi module/barrel); import cartKeys từ cart feature

components/
  OrderDetails.tsx    — Chi tiết đơn hàng: items, địa chỉ, payment info, tracking, trạng thái timeline (stepper)

pages/
  OrdersPage.tsx      — /orders: danh sách đơn có pagination, action buttons (hủy/repay/xác nhận), trigger ReviewModal
  TrackOrderPage.tsx  — /track-order: tra cứu theo mã + email (public, không cần auth, dùng fetch() trực tiếp)

types/
  order.types.ts      — Order, OrderItem, OrderStatus, PaymentStatus, PaymentMethod, CheckoutData types

index.ts              — Barrel export
```

---

# 3. State Management

## Server state (TanStack Query)

```typescript
export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (params: { page?: number; limit?: number }) => [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  byNumber: (number: string) => [...orderKeys.all, 'number', number] as const,
};

// Key cho query discount codes từ checkout
export const discountAvailableKey = ['discount-codes', 'available'] as const;
// Admin mutations invalidate ['discount-codes'] root → bust query này tự động
```

## Client state (Zustand)

- `authStore` — `user` (để enable queries, hiển thị guard nếu chưa login)
- `cartStore` — `clearLocalCart()` gọi sau payment success redirect; `cartKeys` (named export từ `@/features/cart`) để invalidate sau tạo đơn
- `uiStore` — notifications (toast sau cancel/confirm)

---

# 4. API Calls

## Queries

| Hook                                       | Endpoint                       | Mô tả                                                                       |
| ------------------------------------------ | ------------------------------ | --------------------------------------------------------------------------- |
| `useGetUserOrdersQuery(params?, options?)` | `GET /api/orders?page=&limit=` | Danh sách đơn hàng của user có pagination                                   |
| `useGetOrderByIdQuery(id, options?)`       | `GET /api/orders/:id`          | Chi tiết đơn hàng — hỗ trợ `refetchInterval` option để polling              |
| `useGetAvailableDiscountCodesQuery()`      | `GET /api/discount-codes`      | Danh sách mã giảm giá khả dụng — dùng bởi `CheckoutPage` để hiển thị picker |

`useGetOrderByIdQuery` hỗ trợ `refetchInterval` — được dùng bởi `PaymentQRPage` (feature payment) để poll payment status mỗi 5 giây.

## Mutations

| Hook                             | Endpoint                         | Mô tả                                                                                            |
| -------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `useCreateOrderMutation()`       | `POST /api/orders`               | Tạo đơn hàng mới — `onSuccess`: invalidate `orderKeys.all` + `cartKeys.all` + `cartKeys.count`   |
| `useCancelOrderMutation()`       | `POST /api/orders/:id/cancel`    | Hủy đơn hàng — invalidate detail + list                                                          |
| `useRepayOrderMutation()`        | `POST /api/orders/:id/repay`     | Tạo lại URL thanh toán cho đơn đã tạo                                                            |
| `useApplyDiscountCodeMutation()` | `POST /api/discount-codes/apply` | Áp mã giảm giá — nhận `{ code, orderAmount }`, trả về `{ discountAmount, discountCodeId, code }` |
| `useConfirmReceivedMutation()`   | `POST /api/orders/:id/receive`   | Xác nhận đã nhận hàng                                                                            |

---

# 5. Components chính

## Pages

| Page             | Route          | Mô tả                                                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OrdersPage`     | `/orders`      | Danh sách đơn hàng có pagination. Actions: hủy (`pending`/`processing`), **repay** (chỉ đơn `pending` chưa trả tiền + online, không COD — guard khớp BE `_canRepay`), xác nhận nhận (`shipped` hoặc `processing` chưa xử lý). Sau xác nhận → trigger `ReviewModal` từ feature `reviews`. Xử lý redirect sau VNPay/MoMo payment qua URL param `?payment=success\|failed`. |
| `TrackOrderPage` | `/track-order` | Form nhập mã đơn + email. Public — không cần login. Dùng `fetch()` trực tiếp (không qua `apiClient`). Stepper timeline hiển thị tiến độ đơn hàng.                                                                                                                                                                                                                        |

## Components

| Component      | Mô tả                                                                                                                                                                                                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OrderDetails` | Expandable detail panel trong `OrdersPage`. Hiển thị: stepper tiến trình (pending→processing→shipped→delivered), địa chỉ giao hàng, thông tin thanh toán, danh sách items (product thumbnail, variant), payment summary (subtotal, shipping, discount, total). Nếu đơn `delivered` → hiện nút "Viết đánh giá" per item. |

---

# 6. Types

```typescript
// types/order.types.ts
type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
// ⚠️ PaymentMethod type trong source không sync với backend — Order.paymentMethod typed as `string` cho linh hoạt
// Backend thực tế dùng: 'cod' | 'vnpay' | 'momo' | 'installment' | 'bank_transfer'
type PaymentMethod = 'credit_card' | 'paypal' | 'bank_transfer' | 'cash_on_delivery'; // Stub cũ, chỉ dùng trong CheckoutData (unused)

interface Order {
  id: string;
  number: string;
  userId: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  trackingNumber?: string;
  shippingProvider?: string;
  estimatedDelivery?: string;
  items?: OrderItem[];
  // Shipping/billing address: shippingFirstName, shippingLastName, shippingAddress1, shippingCity, shippingState, shippingZip, shippingCountry, shippingPhone...
  // Billing tương tự với prefix "billing"
  createdAt: string;
  updatedAt: string;
}

interface OrderItem {
  id: string;
  orderId?: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  price: number;
  unitPrice?: number;
  quantity: number;
  subtotal: number;
  image?: string;
  attributes?: Record<string, string>;
  Product?: { id: string; name: string; images: string[]; price: number; thumbnail?: string };
  createdAt?: string;
  updatedAt?: string;
}

interface CreateOrderRequest {
  // Shipping + billing address fields
  paymentMethod: string;
  notes?: string;
  discountCode?: string;
  items?: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
}
```

**Lưu ý:** `api/order-api.ts` định nghĩa thêm `OrdersResponse`, `ApplyDiscountRequest`, `ApplyDiscountResponse`, `CreateOrderResponse`, `AvailableDiscountCode`. ⚠️ **Xung đột type ngầm `OrdersResponse`:** tồn tại 2 định nghĩa cùng tên — `types/order.types.ts:89` (`{ orders, totalPages }`) và `api/order-api.ts:80` (`{ status, data, total, page, limit }`). Barrel `index.ts` re-export CẢ HAI: wildcard `export * from './types/order.types'` + named `export type { OrdersResponse } from './api/order-api'` → bản named (api) THẮNG. Consumer phải dùng `.data` (KHÔNG phải `.orders`). `AvailableDiscountCode` shape: `{ id, code, type, value, minOrderAmount, maxDiscountAmount, endDate }` — dùng bởi `CheckoutPage` khi render discount picker.

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `features/cart` — import `cartKeys` để invalidate sau tạo đơn; import `useClearCartMutation`
- `features/reviews` — import `ReviewModal` để trigger sau xác nhận nhận hàng

**Feature này được dùng bởi:**

- `features/checkout` — import `useCreateOrderMutation`, `useApplyDiscountCodeMutation`
- `features/payment` — import `useGetOrderByIdQuery` để poll payment status

---

# 8. Gotchas & Edge Cases

- **`TrackOrderPage` dùng `fetch()` trực tiếp** — không qua `apiClient`, không attach Bearer token. Endpoint public, guest có thể tra cứu bằng mã đơn + email.
- **`useGetOrderByIdQuery` hỗ trợ `refetchInterval`** — `PaymentQRPage` dùng hook này với `{ refetchInterval: 5000 }` để poll payment status.
- **`useApplyDiscountCodeMutation` endpoint là `/api/discount-codes/apply`** — không phải `/orders/apply-discount`. Nhận `{ code, orderAmount }` — phải truyền orderAmount để server tính % discount.
- **`useConfirmReceivedMutation`** — `OrdersPage` nhận phản hồi sau khi xác nhận.
- **`useCreateOrderMutation` invalidate `cartKeys`** — import `cartKeys` từ cart feature để invalidate cả `cartKeys.all` và `cartKeys.count` sau khi đặt hàng.
- **Cross-feature import hợp lệ:** `OrdersPage` → `ReviewModal` từ feature `reviews` — đây là cross-feature import duy nhất được phép trong dự án.
- **`Order` interface có flat address fields** — `shippingFirstName`, `shippingAddress1`... không phải nested object `shippingAddress: { firstName, address1 }`.
- **`OrdersPage` xử lý payment redirect:** detect `?payment=success|failed` trong URL sau khi VNPay/MoMo redirect về → clear cart + show notification → `navigate('/orders', { replace: true })`.
- **Nút "Xác nhận nhận hàng"** hiển thị khi `status === 'shipped'` hoặc `status === 'processing'` chưa xử lý. Logic này tránh duplicate confirm.
