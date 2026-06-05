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

Luồng thanh toán 3-step wizard (Giao hàng → Thanh toán → Xác nhận) với framer-motion `AnimatePresence` transition giữa các bước. Nhập địa chỉ giao hàng (hỗ trợ autofill từ địa chỉ đã lưu), chọn phương thức thanh toán (COD, VNPay, MoMo, trả góp), áp mã giảm giá, xem order summary, xác nhận đơn hàng. Sau khi tạo đơn → redirect sang cổng thanh toán tương ứng hoặc trang orders.

Feature không có `api/`, `types/` riêng — dùng trực tiếp hooks từ các features khác. Có `components/` chứa 4 sub-components tách ra từ CheckoutPage.

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
  components/
    CheckoutShippingForm.tsx    — Form thông tin giao hàng + chọn địa chỉ đã lưu
    CheckoutPaymentMethod.tsx   — Chọn phương thức thanh toán + modal trả góp
    CheckoutOrderSummary.tsx    — Cột phải: items, mã giảm giá, tổng cộng, nút thanh toán
    CheckoutStepIndicator.tsx   — Animated progress bar (3 bước, framer-motion)

  pages/
    CheckoutPage.tsx            — 3-step wizard orchestrator: điều phối state + render step hiện tại qua AnimatePresence

  index.ts                      — Barrel export (CheckoutPage + 3 sub-components: CheckoutOrderSummary, CheckoutPaymentMethod, CheckoutShippingForm). CheckoutStepIndicator KHÔNG trong barrel (import relative).
```

---

# 3. State Management

## 3.1 Server state (React Query)

Không có query keys riêng. Dùng trực tiếp từ features khác.

## 3.2 Client state (Zustand)

- `cartStore` — `items` và `clearLocalCart` (gọi sau khi tạo đơn thành công). Subtotal được tính locally qua `reduce()` — không lấy từ store.
- `authStore` — `user` (autofill form: firstName, lastName, email, phone), `isAuthenticated`
- `uiStore` — `addNotification` (thông báo thành công/lỗi)
- Form state: `useState` local trong `CheckoutPage` — **không persist** (intentional, tránh stale data khi reload)

---

# 4. API Calls

## 4.1 Endpoints sử dụng

Không có endpoint riêng — dùng từ features khác:

| Method | Path                         | Feature | Mô tả                               |
| ------ | ---------------------------- | ------- | ----------------------------------- |
| GET    | `/cart/count`                | cart    | Số lượng items (sync badge)         |
| GET    | `/users/me/addresses`        | users   | Danh sách địa chỉ đã lưu (autofill) |
| POST   | `/orders`                    | orders  | Tạo đơn hàng                        |
| POST   | `/discount-codes/apply`      | orders  | Validate + áp mã giảm giá           |
| POST   | `/payments/momo/create-url`  | payment | Tạo URL thanh toán MoMo             |
| POST   | `/payments/vnpay/create-url` | payment | Tạo URL thanh toán VNPay            |

## 4.2 Query hooks

**Queries (từ features khác):**

- `useGetCartCountQuery()` từ `features/cart` — count badge
- `useGetAddressesQuery()` từ `features/users` — địa chỉ đã lưu
- `useGetAvailableDiscountCodesQuery()` từ `features/orders` — Danh sách mã giảm giá khả dụng để hiển thị picker

**Mutations (từ features khác):**

- `useCreateOrderMutation()` từ `features/orders` — tạo đơn hàng
- `useApplyDiscountCodeMutation()` từ `features/orders` — áp mã giảm giá
- `useCreateMomoUrlMutation()` từ `features/payment` — tạo URL MoMo
- `useCreateVNPayUrlMutation()` từ `features/payment` — tạo URL VNPay

---

# 5. Components chính

`CheckoutPage` là 3-step wizard sử dụng framer-motion `AnimatePresence` để animate transition giữa các bước. State `currentStep` (0/1/2) quyết định step nào hiển thị. Repay flow bỏ qua step 0 (shipping).

## Sub-components (trong `components/`)

| Component               | Mô tả                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CheckoutShippingForm`  | Step 0 — Form giao hàng: firstName, lastName, email, phone, address (qua `AddressPicker` với geocoding LocationIQ). Hỗ trợ autofill từ địa chỉ đã lưu. |
| `CheckoutPaymentMethod` | Step 1 — Chọn phương thức thanh toán (COD, VNPay, MoMo, trả góp). Có modal trả góp (Dialog + HTML table).                                              |
| `CheckoutOrderSummary`  | Step 2 — Hiển thị items (`CartItem` từ `features/cart`, `isCheckout={true}`), áp mã giảm giá, tổng cộng, nút thanh toán (`PremiumButton`).             |
| `CheckoutStepIndicator` | Animated progress bar hiển thị 3 bước với trạng thái completed/active/pending. Dùng framer-motion cho animation circle + check icon.                   |

## Shared components sử dụng

- `AddressPicker` (`src/components/common/`) — geocoding, tính phí ship theo khoảng cách
- `Input`, `PremiumButton` (`src/components/common/`)
- `CartItem` (từ `features/cart`) — hiển thị items trong order summary

---

# 6. Types

Không có `types/` riêng. Import từ:

- `features/orders` — `CreateOrderRequest`, `Order`
- `features/cart` — `CartItem`
- `features/users` — `Address` (dùng trong autofill select)
- `src/types/user.types.ts` — `User`

---

# 7. Dependencies

## 7.1 Depends on

- `features/orders` — `useCreateOrderMutation`, `useApplyDiscountCodeMutation`
- `features/cart` — `CartItem`, `cartKeys`, `useGetCartCountQuery`
- `features/payment` — `useCreateMomoUrlMutation`, `useCreateVNPayUrlMutation`
- `features/users` — `useGetAddressesQuery`
- `stores/cart-store` — items, clearLocalCart (subtotal computed locally)
- `stores/auth-store` — user profile, isAuthenticated
- `stores/ui-store` — addNotification
- `components/common/AddressPicker` — geocoding, tính phí ship theo khoảng cách

## 7.2 Used by

Không có feature nào import từ checkout.

---

# 8. Gotchas & Edge Cases

- **Form validation dùng Zod:** `validateForm()` (local arrow closure trong `CheckoutPage`, không phải class method) dùng `shippingSchema` từ `src/schemas/checkout.ts`. Phone VN regex: `(0|+84)[0-9]{9}`. Address cần >= 3 comma-separated parts. **Billing = shipping** (`sameAsShipping` cố định `true`; checkbox toggle + validation billing riêng đã gỡ — dead code, xem §A 2026-06-05).
- **Checkout là protected route** — guest click checkout → redirect `/login` → redirect back `/checkout`.
- **Payment flow MoMo/VNPay:** `CheckoutPage` → `useCreateOrderMutation` → `useCreateMomoUrlMutation/VNPay` → `window.location.href = payUrl` (redirect toàn trang ra cổng thanh toán). Callback → backend → redirect về `/orders/:id`.
- **Repay flow:** query param `?repayOrder=<id>&amount=<amount>` → skip form địa chỉ, set `currentOrder = { id, total, isRepay: true }`, trực tiếp tạo payment URL cho đơn đã có.
- **Buy Now flow:** query param `?buyNow=true` + `sessionStorage['buyNowItem']` → dùng 1 item từ sessionStorage thay vì toàn bộ cart. `sessionStorage` cleanup sau khi dùng.
- **Form state không persist:** refresh trang checkout → mất form data. Intentional.
- **COD/installment flow:** tạo order → redirect `/orders`.
- **VNPay/MoMo flow:** tạo order → `window.location.href = paymentUrl` (cổng thanh toán). (`bank_transfer` đã gỡ khỏi `CheckoutPage` — KHÔNG có trong `paymentMethods` UI: chỉ cod/vnpay/momo/installment; nhánh dead xóa §A 2026-06-05. `PaymentQRPage`/`/payment-qr` chỉ còn dùng qua repay/route trực tiếp.)
- **Phí ship tính từ khoảng cách:** `AddressPicker` trả về lat/lon từ geocoding (LocationIQ) → tính Haversine distance từ kho hàng (21.0378, 105.7827) → 15k cho 3km đầu, +5k/km tiếp theo, max 100k.
- **`shippingCost` không gửi lên backend** — backend tự tính theo Phase 7.3. FE chỉ hiển thị estimate.
- **Validate cart trước submit:** validation xảy ra phía backend khi tạo đơn — không dùng `useValidateCartQuery` trên FE.
- **Discount code từ CartPage:** navigate với `location.state = { voucherCode, discountAmount }` → CheckoutPage tự động apply nếu state có voucher.

---

# 9. Tests

- `frontend/src/__tests__/checkout-payment-pages.test.tsx` — component tests CheckoutPage (form validation, payment selection)
- `backend/__api__/orders.api.test.js` — API tests tạo đơn hàng, discount code
