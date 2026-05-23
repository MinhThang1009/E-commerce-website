# Payment Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 createMomoUrl / createVNPayUrl](#31-createmomourl--createvnpayurl)
  - [3.2 MoMo flow](#32-momo-flow)
  - [3.3 VNPay flow](#33-vnpay-flow)
  - [3.4 createRefund](#34-createrefund)
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

Tích hợp cổng thanh toán MoMo và VNPay: tạo payment URL để redirect user, nhận và xử lý IPN callback (server-to-server) và return URL (redirect sau thanh toán), cập nhật `Order.paymentStatus` sau payment, tăng `DiscountCode.usedCount` khi thanh toán online thành công, clear cart sau payment, và thực hiện hoàn tiền (chỉ VNPay).

## 1.2 DI Pattern

DI đầy đủ. Gateway adapters được tạo trong `module.js`:

```js
const momoGateway = { createPaymentUrl, verifySignature }; // wrap momoService
const vnpayGateway = { createPaymentUrl, verifyReturnUrl, refund }; // wrap vnpayService
const emailGateway = { sendOrderConfirmationEmail };

const service = new PaymentService({
  paymentRepository,
  momoGateway,
  vnpayGateway,
  emailGateway,
  logger,
  frontendUrl,
});
const controller = new PaymentController({ paymentService: service, logger });
```

`momoService` và `vnpayService` là Singleton (require trực tiếp, không DI) — được wrap lại thành gateway adapters trong `module.js`.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/payment/
  module.js                                    — factory DI, tạo gateway adapters
  routes.js                                    — 7 routes (4 public callbacks + 2 user + 1 admin)
  controllers/
    payment-controller.js                      — 7 handlers
    payment-controller.unit.test.js
  services/
    payment-service.js                         — orchestration MoMo + VNPay (~330 lines)
    payment-service.test.js
    momo-service.js                            — Singleton: HMAC-SHA256, gọi MoMo API
    momo-service.test.js
    vnpay-service.js                           — Singleton: HMAC-SHA512, URL encoding
    vnpay-service.unit.test.js
  repositories/
    i-payment-repository.js
    sequelize-payment-repository.js
    payment-repository.test.js
  validators/
    payment-validator.js                       — createUrlSchema (orderId int), refundSchema (Zod)
  dtos/
    payment-dto.js
```

---

# 3. Business Logic Chính

## 3.1 createMomoUrl / createVNPayUrl

```
1. findOrderByPk(orderId)
2. Validate order.userId === userId (tránh thanh toán đơn người khác)
3. momoGateway.createPaymentUrl({ orderId: order.number, amount: order.total, ... })
   hoặc vnpayGateway.createPaymentUrl({ orderId: order.number, amount, ipAddr, ... })
4. Trả về URL hoặc response data từ gateway
```

**MoMo:** Append timestamp vào `orderId` để đảm bảo uniqueness per attempt (`ORD-...-{timestamp6}`).

**VNPay:** Amount nhân 100 (VNPay dùng đơn vị xu). `ipAddr` lấy từ `x-forwarded-for` header.

## 3.2 MoMo flow

**Return URL (`GET /momo/return`):** Chỉ redirect — **KHÔNG mutate state**. Parse `resultCode` và `extraData` để tạo redirect URL.

**IPN (`POST /momo/ipn`) — state change chính:**

```
1. momoGateway.verifySignature(body)  ← HMAC-SHA256, dùng crypto.timingSafeEqual
2. Parse orderId từ extraData ("orderId=N")
3. Nếu resultCode == 0 (loose equality, number):
   runInTransaction:
     lockOrder(orderId, tx)           ← SELECT FOR UPDATE
     Validate amount match (tolerance 0.01)
     _canProcessPayment(order, transId)  ← idempotency: check transactionId + paymentStatus
     order.status = 'processing'
     order.paymentStatus = 'paid'
     order.paymentTransactionId = transId
     order.paymentProvider = 'momo'
4. Post-transaction (fire-and-forget):
   _clearUserCart(userId)
   _sendOrderConfirmationEmailSafe(orderId)
5. Response 204 nếu valid, 400 nếu signature fail
```

## 3.3 VNPay flow

**Return URL (`GET /vnpay/return`) — CÓ mutate state (khác MoMo):**

```
1. vnpayGateway.verifyReturnUrl(params)  ← HMAC-SHA512
2. Nếu checksum fail → redirect với "checksum-failed"
3. Nếu vnp_ResponseCode === '00' (strict equality, string):
   runInTransaction:
     findOrderByNumber(orderNumber)
     _canProcessPayment(order, transNo)
     order.status = 'processing'; paymentStatus = 'paid'; paymentProvider = 'vnpay'
   Post: _incrementDiscountCodeUsage(), _clearUserCart(), email
   Redirect → frontendUrl/orders?payment=success&order={number}
4. Nếu failed → redirect với code
```

**IPN (`GET /vnpay/ipn`) — server-to-server:**

```
1. verifyReturnUrl(params)  ← cùng method với return URL
2. Validate amount (vnp_Amount / 100, tolerance 0.01)
3. Nếu paymentStatus === 'paid' → RspCode '02' (already confirmed)
4. Nếu responseCode === '00' → update paid + post-processing
5. Nếu failed → update paymentStatus = 'failed'
6. Trả về { RspCode, Message } theo spec VNPay
```

## 3.4 createRefund

Admin-only, chỉ hỗ trợ VNPay:

```
1. _canRefund(order):
   - paymentStatus === 'refunded' → lỗi
   - paymentStatus !== 'paid' → lỗi
   - paymentTransactionId không có → lỗi
   - paymentProvider !== 'vnpay' → lỗi (MoMo chưa support)
2. Validate refundAmount (> 0, <= order.total)
3. vnpayGateway.refund({ orderId, amount, transDate, ipAddr })
4. order.paymentStatus = 'refunded'; saveOrder()
```

---

# 4. API Endpoints

Base path: `/api/payments`

**Webhook callbacks (public — không cần JWT, gateway signature verification trong service):**

| Method | Path            | Rate limit | Mô tả                                                             |
| ------ | --------------- | ---------- | ----------------------------------------------------------------- |
| GET    | `/momo/return`  | —          | MoMo redirect user về sau thanh toán (chỉ redirect, không mutate) |
| POST   | `/momo/ipn`     | 60 req/60s | MoMo server-to-server IPN (mutate state)                          |
| GET    | `/vnpay/return` | —          | VNPay redirect user về sau thanh toán (CÓ mutate state)           |
| GET    | `/vnpay/ipn`    | 60 req/60s | VNPay server-to-server IPN                                        |

**User endpoints:**

| Method | Path                | Auth         | Mô tả                  |
| ------ | ------------------- | ------------ | ---------------------- |
| POST   | `/momo/create-url`  | authenticate | Tạo URL redirect MoMo  |
| POST   | `/vnpay/create-url` | authenticate | Tạo URL redirect VNPay |

**Admin:**

| Method | Path      | Auth                              | Mô tả                 |
| ------ | --------- | --------------------------------- | --------------------- |
| POST   | `/refund` | authenticate + authorize('admin') | Hoàn tiền (chỉ VNPay) |

**Body `POST /momo/create-url` và `POST /vnpay/create-url`:** `{ orderId: number }` — validated bởi `createUrlSchema`

**Body `POST /refund`:** `{ orderId, amount?, reason?, ipAddr? }` — validated bởi `refundSchema`

---

# 5. Dependencies

## 5.1 Depends on

Inject từ `app.js`:

- **Models:** `Order`, `OrderItem`, `User`, `Cart`, `CartItem`, `DiscountCode`
- **Services:** `momoService`, `vnpayService` (Singleton — wrapped thành gateway adapters), `emailService`
- **sequelize:** cho transactions
- **logger**
- **frontendUrl:** URL redirect sau payment. Fallback `process.env.FRONTEND_URL`

## 5.2 Used by

- `orders` — user trigger payment sau khi tạo đơn (FE gọi create-url API trực tiếp)

## 5.3 Events published

Payment module **không publish bất kỳ EventBus event nào**. Toàn bộ post-payment actions (update `paymentStatus`, tăng `usedCount` discount, clear cart, gửi email) được thực hiện inline trong service — không qua EventBus.

---

# 6. Gotchas & Edge Cases

- **HMAC khác nhau giữa 2 gateway:** MoMo dùng HMAC-SHA256 (`momo-service.js`), VNPay dùng HMAC-SHA512 (`vnpay-service.js`). Không hoán đổi.
- **Success code khác nhau:** MoMo check `resultCode == 0` (loose equality — là number). VNPay check `vnp_ResponseCode === '00'` (strict equality — là string). Đây là spec của từng gateway.
- **MoMo return URL KHÔNG mutate state:** Chỉ redirect. State change xảy ra ở IPN handler (POST) có signature verification. VNPay return URL CÓ mutate state (theo VNPay spec).
- **VNPay IPN là GET:** Route `GET /vnpay/ipn`. Tài liệu VNPay cũ ghi POST — đã deprecated.
- **Idempotency bắt buộc:** `_canProcessPayment(order, transId)` check cả `paymentStatus !== 'paid'` và `transactionId chưa xử lý`. IPN có thể gửi nhiều lần — không bỏ check này.
- **Discount `usedCount` tăng ở payment module:** Với online payments (momo/vnpay), `usedCount` tăng trong `payment-service.js` sau IPN/return success — không tăng trong `orders-service.js` khi tạo đơn.
- **Hoàn tiền chỉ VNPay:** `_canRefund()` check `paymentProvider === 'vnpay'`. MoMo refund chưa implement.
- **MoMo sandbox env vars:** `DEV_PARTNER_CODE`, `DEV_ACCESS_KEY`, `DEV_SECRET_KEY`, `DEV_MOMO_ENDPOINT` cho test. Production dùng `MOMO_*`. Hai sets riêng biệt trong `momo-service.js`.
- **`frontendUrl`:** Phải khớp với domain đăng ký ở cổng thanh toán cho whitelist redirect URL.
- **`crypto.timingSafeEqual`:** MoMo signature verification dùng timing-safe compare — bảo vệ chống timing attack. Không đổi thành so sánh string thường.

---

# 7. Tests

| File                                              | Loại        | Mô tả                                    |
| ------------------------------------------------- | ----------- | ---------------------------------------- |
| `services/payment-service.test.js`                | Unit        | Orchestration, IPN handling, idempotency |
| `services/momo-service.test.js`                   | Unit        | MoMo HMAC-SHA256, URL creation           |
| `services/vnpay-service.unit.test.js`             | Unit        | VNPay HMAC-SHA512, URL encoding          |
| `controllers/payment-controller.unit.test.js`     | Unit        | HTTP layer                               |
| `repositories/payment-repository.test.js`         | Unit        | Repository queries                       |
| `src/__integration__/payment.integration.test.js` | Integration | DB integration                           |
| `src/__api__/payment.api.test.js`                 | HTTP        | End-to-end HTTP                          |
