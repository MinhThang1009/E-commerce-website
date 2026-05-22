# Checkout Feature — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Routes](#12-routes)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. State Management](#3-state-management)
  - [3.1 Server state (React Query)](#31-server-state-react-query)
  - [3.2 Client state (Zustand)](#32-client-state-zustand)
- [4. API Calls](#4-api-calls)
  - [4.1 Endpoints sử dụng](#41-endpoints-sử-dụng)
  - [4.2 Query hooks](#42-query-hooks)
- [5. Components chính](#5-components-chính)
- [6. Types](#6-types)
- [7. Dependencies](#7-dependencies)
  - [7.1 Depends on](#71-depends-on)
  - [7.2 Used by](#72-used-by)
- [8. Gotchas & Edge Cases](#8-gotchas--edge-cases)
- [9. Tests](#9-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Luồng thanh toán single-page với nhiều section: nhập địa chỉ giao hàng (hỗ trợ autofill từ địa chỉ đã lưu), chọn phương thức thanh toán (COD, VNPay, MoMo, trả góp, chuyển khoản), áp mã giảm giá, xem order summary, xác nhận đơn hàng. Sau khi tạo đơn → redirect sang cổng thanh toán tương ứng hoặc trang orders.

Feature tối giản — **không có** `api/`, `components/`, `types/` riêng. Dùng trực tiếp hooks từ các features khác.

## 1.2 Routes

| Route                                     | Page           | Guard                                       |
| ----------------------------------------- | -------------- | ------------------------------------------- |
| `/checkout`                               | `CheckoutPage` | `ProtectedRoute` (phải đăng nhập)           |
| `/checkout?buyNow=true`                   | `CheckoutPage` | Buy Now flow (1 sản phẩm từ sessionStorage) |
| `/checkout?repayOrder=:id&amount=:amount` | `CheckoutPage` | Repay flow (bỏ qua form địa chỉ)            |

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/checkout/
  pages/
    CheckoutPage.tsx    — Toàn bộ checkout flow: form địa chỉ, payment selection, mã giảm giá, order summary, submit

  index.ts              — Barrel export
```

---

# 3. State Management

## 3.1 Server state (React Query)

Không có query keys riêng. Dùng trực tiếp từ features khác.

## 3.2 Client state (Zustand)

- `cartStore` — `items`, `subtotal`, `totalItems` (hiển thị order summary); `clearLocalCart` sau khi tạo đơn thành công
- `authStore` — `user` (autofill form: firstName, lastName, email, phone), `isAuthenticated`
- `uiStore` — `addNotification` (thông báo thành công/lỗi)
- Form state: `useState` local trong `CheckoutPage` — **không persist** (intentional, tránh stale data khi reload)

---

# 4. API Calls

## 4.1 Endpoints sử dụng

Không có endpoint riêng — dùng từ features khác:

| Method | Path                        | Feature | Mô tả                               |
| ------ | --------------------------- | ------- | ----------------------------------- |
| GET    | `/cart`                     | cart    | Lấy items hiện tại                  |
| GET    | `/cart/count`               | cart    | Số lượng items (sync badge)         |
| GET    | `/cart/validate`            | cart    | Validate tồn kho + giá trước submit |
| DELETE | `/cart`                     | cart    | Xóa giỏ sau thanh toán              |
| GET    | `/users/me/addresses`       | users   | Danh sách địa chỉ đã lưu (autofill) |
| POST   | `/orders`                   | orders  | Tạo đơn hàng                        |
| POST   | `/discount-codes/validate`  | orders  | Validate + áp mã giảm giá           |
| POST   | `/payment/momo/create-url`  | payment | Tạo URL thanh toán MoMo             |
| POST   | `/payment/vnpay/create-url` | payment | Tạo URL thanh toán VNPay            |

## 4.2 Query hooks

**Queries (từ features khác):**

- `useGetCartQuery()` từ `features/cart` — items hiện tại
- `useGetCartCountQuery()` từ `features/cart` — count badge
- `useValidateCartQuery()` từ `features/cart` — validate trước submit
- `useGetAddressesQuery()` từ `features/users` — địa chỉ đã lưu

**Mutations (từ features khác):**

- `useCreateOrderMutation()` từ `features/orders` — tạo đơn hàng
- `useApplyDiscountCodeMutation()` từ `features/orders` — áp mã giảm giá
- `useCreateMomoUrlMutation()` từ `features/payment` — tạo URL MoMo
- `useCreateVNPayUrlMutation()` từ `features/payment` — tạo URL VNPay
- `useClearCartMutation()` từ `features/cart` — xóa giỏ

---

# 5. Components chính

`CheckoutPage` là component duy nhất — không có components con riêng trong feature.

`CheckoutPage` render các shared components từ `src/components/common/`:

- `AddressPicker` — địa chỉ với geocoding (LocationIQ API), tính tọa độ để tính phí ship
- `Input` — form fields
- `PremiumButton` — submit button
- `CartItem` (từ `features/cart`) — hiển thị items trong order summary, `isCheckout={true}` để ẩn quantity stepper

---

# 6. Types

Không có `types/` riêng. Import từ:

- `features/orders` — `CreateOrderRequest`, `Order`
- `features/cart` — `CartItem`, `BackendCart`
- `features/users` — `Address` (dùng trong autofill select)
- `src/types/user.types.ts` — `User`

---

# 7. Dependencies

## 7.1 Depends on

- `features/orders` — `useCreateOrderMutation`, `useApplyDiscountCodeMutation`
- `features/cart` — `CartItem`, `cartKeys`, `useGetCartCountQuery`, `useValidateCartQuery`, `useClearCartMutation`
- `features/payment` — `useCreateMomoUrlMutation`, `useCreateVNPayUrlMutation`
- `features/users` — `useGetAddressesQuery`
- `stores/cart-store` — items, subtotal, clearLocalCart
- `stores/auth-store` — user profile, isAuthenticated
- `stores/ui-store` — addNotification
- `components/common/AddressPicker` — geocoding, tính phí ship theo khoảng cách

## 7.2 Used by

Không có feature nào import từ checkout.

---

# 8. Gotchas & Edge Cases

- **Checkout là protected route** — guest click checkout → redirect `/login` → redirect back `/checkout`.
- **Payment flow MoMo/VNPay:** `CheckoutPage` → `useCreateOrderMutation` → `useCreateMomoUrlMutation/VNPay` → `window.location.href = payUrl` (redirect toàn trang ra cổng thanh toán). Callback → backend → redirect về `/orders/:id`.
- **Repay flow:** query param `?repayOrder=<id>&amount=<amount>` → skip form địa chỉ, set `currentOrder = { id, total, isRepay: true }`, trực tiếp tạo payment URL cho đơn đã có.
- **Buy Now flow:** query param `?buyNow=true` + `sessionStorage['buyNowItem']` → dùng 1 item từ sessionStorage thay vì toàn bộ cart. `sessionStorage` cleanup sau khi dùng.
- **Form state không persist:** refresh trang checkout → mất form data. Intentional.
- **COD/installment flow:** tạo order → redirect `/orders`.
- **Bank transfer flow:** tạo order → navigate `/payment-qr?orderId=&amount=&numberOrder=` → `PaymentQRPage` trong feature `payment`.
- **Phí ship tính từ khoảng cách:** `AddressPicker` trả về lat/lon từ geocoding (LocationIQ) → tính Haversine distance từ kho hàng (21.0378, 105.7827) → 15k cho 3km đầu, +5k/km tiếp theo, max 100k.
- **`shippingCost` không gửi lên backend** — backend tự tính theo Phase 7.3. FE chỉ hiển thị estimate.
- **Validate cart trước submit:** `useValidateCartQuery` — bắt items hết hàng trước khi user confirm.
- **Discount code từ CartPage:** navigate với `location.state = { voucherCode, discountAmount }` → CheckoutPage tự động apply nếu state có voucher.

---

# 9. Tests

- `frontend/src/__tests__/features/checkout/` — component tests CheckoutPage (form validation, payment selection)
- `backend/__api__/orders.api.test.js` — API tests tạo đơn hàng, discount code
