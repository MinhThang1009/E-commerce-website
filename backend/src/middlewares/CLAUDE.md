# Middlewares — Express Middleware Stack

> Middleware stack cho Express. Import qua alias `@middlewares`. **Thứ tự mount trong `app.js` rất quan trọng.**

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mount order](#1-mount-order)
- [2. authenticate.js](#2-authenticatejs)
- [3. authorize.js](#3-authorizejs)
- [4. admin-auth.js](#4-admin-authjs)
- [5. cache.js](#5-cachejs)
- [6. rate-limiter.js](#6-rate-limiterjs)
- [7. error-handler.js](#7-error-handlerjs)
- [8. detect-locale.js](#8-detect-localejs)
- [9. validate-request.js](#9-validate-requestjs)

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

- `authenticate` — 401 nếu không có/invalid/blacklisted token
- `optionalAuthenticate` — tiếp tục nếu không có token (`req.user = undefined`)

Kiểm tra 3 Redis keys theo thứ tự:

1. `bl:<jti>` — blacklist (invalidated on logout)
2. `pw_changed:<userId>` — reject tokens issued trước lần đổi mật khẩu gần nhất
3. Fallback: allow nếu Redis không available (fail open)

---

## 3. authorize.js

RBAC — dùng **sau** `authenticate`:

```js
router.delete('/products/:id', authenticate, authorize('admin', 'manager'), handler);
```

- 401 nếu `req.user` undefined (chưa authenticate)
- 403 nếu `req.user.role` không nằm trong allowed list

---

## 4. admin-auth.js

JWT verify + role check dành cho admin panel. Tách riêng khỏi `authenticate.js` để có thể inject `auditService` qua `AsyncLocalStorage`.

```js
adminRouter.use(adminAuthenticate); // Tất cả admin routes
adminRouter.delete('/users/:id', requireSuperAdmin, handler); // Chỉ role === 'admin'
```

- `adminAuthenticate` — verify JWT + kiểm tra `role in ['admin', 'manager']`
- `requireSuperAdmin` — chỉ cho `role === 'admin'` (chain sau `adminAuthenticate`)

---

## 5. cache.js

Redis cache-aside cho GET endpoints:

```js
router.get(
  '/products',
  cacheMiddleware(300, (req) => `cache:products:page${req.query.page || 1}`),
  httpCacheHeaders(300),
  handler,
);
```

- Cache hit: `X-Cache: HIT`, trả JSON từ Redis/memory
- Cache miss: `X-Cache: MISS`, monkey-patch `res.json()` để cache kết quả 200
- `invalidateCache('cache:products:*')` — xóa cache theo glob pattern
- `httpCacheHeaders(maxAge, { private?, noStore? })` — set `Cache-Control` header

---

## 6. rate-limiter.js

5 limiters. Tất cả dùng `ProxyStore`: bắt đầu với in-memory, tự upgrade lên Redis khi kết nối thành công (non-blocking).

| Limiter          | Limit (prod) | Limit (dev) | Window | Mục tiêu                         |
| ---------------- | ------------ | ----------- | ------ | -------------------------------- |
| `apiLimiter`     | 100 req      | 1000 req    | 15 min | Toàn bộ `/api` (prod only)       |
| `authLimiter`    | 10 req       | 100 req     | 60 min | `/api/auth`                      |
| `otpLimiter`     | 5 req        | 5 req       | 15 min | OTP / password reset (per email) |
| `chatbotLimiter` | 20 req       | 20 req      | 60 sec | Chatbot AI                       |
| `chatLimiter`    | 30 req       | 30 req      | 5 min  | Chat history                     |

`otpLimiter` dùng `req.body.email` làm key (fallback `req.ip`).

---

## 7. error-handler.js

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

## 8. detect-locale.js

Sets `req.locale = 'vi' | 'en'`. Mount sớm trong stack (trước module routes).

Priority:

1. `?lang=en` query param
2. `Accept-Language` header
3. Default `'vi'`

---

## 9. validate-request.js

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
