# Middlewares — Express Middleware Stack

> Middleware stack cho Express. Import qua alias `@middlewares`. **Thứ tự mount trong `app.js` rất quan trọng.**

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mount order](#1-mount-order)
- [2. authenticate.js](#2-authenticatejs)
- [3. authorize.js](#3-authorizejs)
- [4. admin-auth.js](#4-admin-authjs)
- [5. rate-limiter.js](#5-rate-limiterjs)
- [6. error-handler.js](#6-error-handlerjs)
- [7. detect-locale.js](#7-detect-localejs)
- [8. validate-request.js](#8-validate-requestjs)

---

## 1. Mount order

```
helmet → cors → csrf-check → morgan
→ authLimiter (chỉ trên /api/auth)
→ detect-locale → json/urlencoded parser → cookieParser
→ sanitizeBody (XSS) → compression
→ [module routes]
    └→ authenticate → authorize → validateRequest → controller
→ errorHandler (cuối cùng — bắt buộc)
```

`errorHandler` phải là middleware cuối cùng trong `app.js`. Mount sai vị trí → errors không bị catch.

---

## 2. authenticate.js

Xác thực JWT. Sets `req.user = { id, role, isActive, isEmailVerified, ... }`.

```js
router.get('/profile', authenticate, handler); // Yêu cầu đăng nhập
router.post('/cart', optionalAuthenticate, handler); // Guest + user đều OK
```

- `authenticate` — 401 nếu không có/invalid token
- `optionalAuthenticate` — tiếp tục nếu không có token (`req.user = undefined`)

---

## 3. authorize.js

RBAC — dùng **sau** `authenticate`:

```js
router.delete('/products/:id', authenticate, authorize('admin'), handler);
```

- 401 nếu `req.user` undefined (chưa authenticate)
- 403 nếu `req.user.role` không nằm trong allowed list

---

## 4. admin-auth.js

JWT verify + role check dành cho back-office. Tách riêng khỏi `authenticate.js`.
Cho phép **2 role**: `admin` (quản trị hệ thống) + `staff` (nhân viên bán hàng) — hằng `BACKOFFICE_ROLES`. Phân quyền chi tiết theo từng route bằng `requireRole`.

```js
adminRouter.use(adminAuthenticate); // Tất cả admin routes (admin + staff)
adminRouter.delete('/users/:id', requireSuperAdmin, handler); // Chỉ role === 'admin'
adminRouter.post('/products', requireRole('staff'), handler); // Chỉ staff (admin bị 403 — xem-only)
adminRouter.get('/dashboard', requireRole('admin', 'staff'), handler); // Cả hai (xem chung)
```

- `adminAuthenticate` — verify JWT + kiểm tra `role ∈ {admin, staff}` (vào panel)
- `requireRole(...roles)` — factory giới hạn route theo role cụ thể (chain sau `adminAuthenticate`)
- `requireSuperAdmin` = `requireRole('admin')` — chỉ admin (users, analytics/user-growth)
- **RBAC**: admin = xem-only back-office + quản lý users; staff = CRUD nghiệp vụ (products/orders/inventory/discount/reviews/catalog/payment-refund). Xem bảng canonical ở root `CLAUDE.md`.

---

## 5. rate-limiter.js

5 limiters. Tất cả dùng `Map` JavaScript nội bộ.

| Limiter          | Limit (prod) | Limit (dev) | Window | Mục tiêu                         |
| ---------------- | ------------ | ----------- | ------ | -------------------------------- |
| `apiLimiter`     | 100 req      | 1000 req    | 15 min | Toàn bộ `/api` (prod only)       |
| `authLimiter`    | 10 req       | 100 req     | 60 min | `/api/auth`                      |
| `otpLimiter`     | 5 req        | 5 req       | 15 min | OTP / password reset (per email) |
| `chatbotLimiter` | 20 req       | 20 req      | 60 sec | Chatbot AI                       |
| `chatLimiter`    | 30 req       | 30 req      | 5 min  | Chat history                     |

`otpLimiter` dùng `req.body.email` làm key (fallback `req.ip`).

---

## 6. error-handler.js

**Phải mount cuối cùng** trong `app.js`. Normalize mọi error type → consistent JSON response.

Normalize map:

| Error type                                | HTTP status        |
| ----------------------------------------- | ------------------ |
| `SequelizeUniqueConstraintError`          | 409                |
| `SequelizeValidationError`                | 422                |
| `JsonWebTokenError` / `TokenExpiredError` | 401                |
| `MulterError(LIMIT_FILE_SIZE)`            | 400                |
| `AppError` (isOperational)                | `error.statusCode` |
| Unexpected errors                         | 500                |

Dev: trả full error + stack. Prod: chỉ message; non-operational errors → "unknown error" (không expose internals).

---

## 7. detect-locale.js

Sets `req.locale = 'vi' | 'en'`. Mount sớm trong stack (trước module routes).

Priority:

1. `?lang=en` query param
2. `Accept-Language` header
3. Default `'vi'`

---

## 8. validate-request.js

Zod schema validation. Validate và replace `req[source]` với parsed data (unknown fields bị strip tự động).

```js
router.post(
  '/products',
  validateRequest(
    z.object({ name: z.string().min(1), price: z.number().positive() }),
    400, // HTTP status khi validation fail (default 400)
    'body', // source: 'body' | 'query' | 'params'
  ),
  handler,
);
```
