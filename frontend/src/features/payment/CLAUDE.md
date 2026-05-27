# Payment Feature — TechStore Frontend

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

Tích hợp cổng thanh toán: tạo URL redirect sang MoMo/VNPay, hiển thị trang QR chuyển khoản ngân hàng (VietQR) với countdown timer 15 phút, poll trạng thái thanh toán. Route: `/payment-qr`.

**Payment flow tổng quát:**

- **MoMo/VNPay:** `CheckoutPage` → mutation tạo URL → `window.location.href = payUrl` (redirect toàn trang) → callback → backend → redirect về `/orders?payment=success|failed`
- **Bank transfer:** `CheckoutPage` → navigate `/payment-qr?orderId=&amount=&numberOrder=` → user chuyển khoản thủ công → poll `useGetOrderByIdQuery` mỗi 5s → auto-navigate về `/orders` khi `paymentStatus === 'paid'`

---

# 2. Cấu trúc Files

```
api/
  momo-api.ts        — Mutation tạo URL thanh toán MoMo (POST /api/payments/momo/create-url)
  vnpay-api.ts       — Mutation tạo URL thanh toán VNPay (POST /api/payments/vnpay/create-url)

components/
  BankTransferQR.tsx — QR image VietQR từ env vars VITE_BANK_CODE + VITE_BANK_ACCOUNT_NUMBER

pages/
  PaymentQRPage.tsx  — /payment-qr: QR + countdown 15 phút + poll status; DEV test card panel

index.ts             — Barrel export
```

---

# 3. State Management

## Server state (TanStack Query)

Chỉ có mutations. Polling dùng `useGetOrderByIdQuery` import từ feature `orders`.

## Client state (Zustand)

- `uiStore` — `addNotification()` cho toast thành công/thất bại
- Timer countdown và `isExpired` là local state (`useState`) trong `PaymentQRPage`
- `selectedCard` (DEV test card index) là local state

---

# 4. API Calls

## Queries

Không có query hooks riêng. Polling status dùng `useGetOrderByIdQuery` từ feature `orders` với `{ refetchInterval: 5000 }`.

## Mutations

| Hook                          | File           | Endpoint                              | Response field    |
| ----------------------------- | -------------- | ------------------------------------- | ----------------- |
| `useCreateMomoUrlMutation()`  | `momo-api.ts`  | `POST /api/payments/momo/create-url`  | `data.payUrl`     |
| `useCreateVNPayUrlMutation()` | `vnpay-api.ts` | `POST /api/payments/vnpay/create-url` | `data.paymentUrl` |

**Payload:**

```typescript
// MoMo
{ orderId: string }

// VNPay
{ orderId: string; amount?: number; bankCode?: string }
```

---

# 5. Components chính

## Pages

| Page            | Route         | Query params                     | Mô tả                                                                                                                                                                                                                         |
| --------------- | ------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PaymentQRPage` | `/payment-qr` | `?orderId=&amount=&numberOrder=` | Hiển thị thông tin đơn hàng + countdown 15 phút. Nút "Thanh toán VNPay" redirect sang cổng. Nút hủy đơn. Auto-navigate về `/orders` khi payment thành công (poll mỗi 5s) hoặc đơn bị hủy. DEV mode: hiển thị test card panel. |

**Logic tự động hóa trong `PaymentQRPage`:**

- Poll `useGetOrderByIdQuery` mỗi 5 giây → nếu `paymentStatus === 'paid'` → hiện overlay success → countdown 3s → navigate `/orders`
- Poll → nếu `status === 'cancelled'` → toast warning → navigate `/orders`
- Countdown 15 phút: nếu hết giờ → `isExpired = true` → auto-cancel order → navigate `/cart` sau 1.5s

## Components

| Component        | Mô tả                                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BankTransferQR` | Generate `https://img.vietqr.io/image/{BANK_CODE}-{ACCOUNT_NUMBER}-compact.jpg?amount=&addInfo=&accountName=` từ env vars. Hiển thị thông tin ngân hàng (tên ngân hàng, số tài khoản, chủ tài khoản, số tiền, nội dung chuyển khoản) với copy-to-clipboard. |

`BankTransferQR` không được import bởi `CheckoutPage` hoặc `PaymentQRPage` — hiện là dead code, được export từ `index.ts` nhưng chưa dùng ở đâu trong runtime.

---

# 6. Types

Không có `types/` directory riêng — types inline trong api files:

```typescript
// momo-api.ts
// Body: { orderId: string }
// Response: { data?: { payUrl?: string } }

// vnpay-api.ts
// Body: { orderId: string; amount?: number; bankCode?: string }
// Response: { data?: { paymentUrl?: string } }
```

`BankTransferQR` props:

```typescript
interface BankTransferQRProps {
  amount: number;
  orderId: string;
  numberOrder: string;
}
```

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `features/orders` — `useGetOrderByIdQuery` (polling), `useCancelOrderMutation` (auto-cancel khi timeout)
- `lucide-react` — `Copy`, `Check` icons trong `BankTransferQR`
- `lib/api-client` — HTTP requests
- `stores/ui-store` — `addNotification()`

**Feature này được dùng bởi:**

- `features/checkout` — import `useCreateMomoUrlMutation`, `useCreateVNPayUrlMutation` (KHÔNG import `BankTransferQR`)
- `routes/AppRoutes.tsx` — mount `PaymentQRPage` tại `/payment-qr` (ProtectedRoute)

---

# 8. Gotchas & Edge Cases

- **Field name MoMo vs VNPay khác nhau:** MoMo → `data.payUrl`; VNPay → `data.paymentUrl`. Không nhầm khi destructure response.
- **`BankTransferQR` KHÔNG hardcode bank info** — lấy từ env vars `VITE_BANK_CODE`, `VITE_BANK_ACCOUNT_NUMBER`, `VITE_BANK_NAME`, `VITE_BANK_ACCOUNT_NAME`. Thiếu env → QR image 404 (fallback về giá trị mặc định Techcombank/19031546128019).
- **Countdown timer 15 phút là UI-only** — backend không tự hủy đơn khi hết giờ. FE phải chủ động gọi `useCancelOrderMutation` khi `isExpired = true`.
- **Test card numbers** trong `PaymentQRPage` chỉ render khi `import.meta.env.DEV === true` — tree-shaken hoàn toàn ở production build. 3 test cards: NCB success, NCB error, Visa success.
- **`PaymentQRPage` đọc params từ `useSearchParams()`** — thiếu `orderId` hoặc `amountParam` → render invalid link screen.
- **Auto-cancel khi timeout** chỉ gọi khi chưa `isCancelling` và `order.status !== 'cancelled'` (tránh duplicate cancel call).
- **VietQR URL format:** `https://img.vietqr.io/image/{bankCode}-{accountNumber}-compact.jpg` — `addInfo` là `numberOrder` (mã đơn hàng làm nội dung chuyển khoản), `roundedAmount` là số nguyên (không có decimal).
