# Auth Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern (4 adapters)](#12-di-pattern-4-adapters)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Auth flows](#31-auth-flows)
  - [3.2 Business rules](#32-business-rules)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Xử lý toàn bộ authentication: đăng ký tài khoản, đăng nhập email/Google OAuth, quản lý JWT access/refresh token pair, xác thực email qua OTP 6 chữ số, reset password qua OTP, và logout.

## 1.2 DI Pattern (4 adapters)

Module dùng DI đầy đủ với adapter pattern — 4 adapters được định nghĩa **inline trong `module.js`** (không phải file riêng):

```js
// module.js wires:
module.exports = ({ User, eventBus, logger, emailService }) => {
  // emailGateway   → { sendOtpEmail, sendResetPasswordEmail } (wraps emailService)
  // googleVerifier → { verifyIdToken, verifyAccessToken }     (wraps OAuth2Client + axios)
  // tokenSigner    → { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken }
  //                  (wraps jsonwebtoken)
  // → new AuthService({ authRepository, emailGateway, googleVerifier, tokenSigner, ... })
  // → new AuthController({ authService })
  // → buildRoutes({ authController })
};
```

Adapter giúp `AuthService` không phụ thuộc bất kỳ external library cụ thể — dễ mock trong unit test.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/auth/
  module.js                                — DI wiring + 4 inline adapters
  routes.js                                — HTTP endpoints (basePath '/auth')
  controllers/
    auth-controller.js                     — Thin handlers, delegate sang authService
  services/
    auth-service.js                        — Business logic auth (~400 lines)
  repositories/
    i-auth-repository.js                   — Interface
    sequelize-auth-repository.js           — User, OTP, RefreshToken Sequelize queries
  validators/
    auth-validator.js                      — Zod: registerSchema, loginSchema, forgotPasswordSchema,
                                             resetPasswordSchema, emailSchema
  dtos/
    auth-dto.js                            — toUserDto() loại bỏ password/OTP fields
  CLAUDE.md
```

> Không có thư mục `adapters/` riêng — adapters được định nghĩa inline trong `module.js`.

---

# 3. Business Logic Chính

## 3.1 Auth flows

**`auth-service.js`** xử lý toàn bộ:

- `register({ email, password, firstName, lastName, phone })` — tạo User, gửi OTP qua email (không block nếu email fail), publish `auth.userRegistered` event
- `login({ email, password, ip })` — verify password (bcrypt), kiểm tra `isEmailVerified` + `isActive`, tạo access token + refresh token
- `googleLogin({ token })` — verify `id_token` qua `OAuth2Client` (thử trước), fallback verify `accessToken` qua axios GET Google userinfo API. Auto-create user nếu chưa tồn tại. Merge account nếu email trùng.
- `logout({ refreshToken })` — revoke refresh token family `rt_family_revoked:<familyId>` (clear phía client, không blacklist access token)
- `verifyOtp({ email, otp })` — timing-safe compare OTP 6 chữ số, set `isEmailVerified=true`, clear OTP fields
- `resendVerification({ email })` — tạo OTP mới hết hạn 10 phút, gửi email. Trả generic message ngay cả khi user không tồn tại (chống enumeration).
- `refreshToken({ refreshToken })` — verify refresh token, check family không bị revoke, tạo access token mới + refresh token mới (rotate), revoke token cũ
- `forgotPassword({ email })` — tạo OTP reset 6 chữ số hết hạn 10 phút, gửi email reset password
- `resetPassword({ email, otp, newPassword })` — verify OTP reset, update password hash, clear OTP fields
- `getCurrentUser(userId)` — query user từ DB (không tin vào JWT payload cho thông tin user)

## 3.2 Business rules

- **JWT access token**: HS256, payload `{ id, role, jti: randomUUID() }`, TTL từ env `JWT_EXPIRES_IN`
- **JWT refresh token**: payload `{ id, jti: randomUUID(), familyId: uuid }`, TTL từ env `JWT_REFRESH_EXPIRES_IN`
- **Token rotation**: Mỗi lần refresh → tạo token pair mới, revoke token cũ. Nếu refresh token cũ bị reuse → revoke toàn bộ family → force logout tất cả devices
- **Logout**: Revoke refresh token family; access token không bị blacklist — token vẫn valid cho đến hết TTL (xử lý clear phía client)
- **OTP**: 6 chữ số random (`crypto.randomInt(100000, 1000000)`), TTL 10 phút, so sánh timing-safe
- **Google OAuth dual mode**: `verifyIdToken()` cho Google `id_token` (mobile), `verifyAccessToken()` cho Google `access_token` (web flow)
- **Password hash**: bcrypt, cost factor từ env `BCRYPT_ROUNDS` (default 12, test dùng 4)
- **User enumeration protection**: `resendVerification` và `forgotPassword` luôn trả generic success message dù user không tồn tại

---

# 4. API Endpoints

Base path: `/api/auth`

| Method | Path                        | Auth         | Rate Limit | Mô tả                                       |
| ------ | --------------------------- | ------------ | ---------- | ------------------------------------------- |
| POST   | `/auth/register`            | —            | —          | Đăng ký tài khoản mới                       |
| POST   | `/auth/login`               | —            | —          | Đăng nhập email/password                    |
| POST   | `/auth/google`              | —            | —          | Đăng nhập/đăng ký qua Google OAuth          |
| POST   | `/auth/logout`              | authenticate | —          | Đăng xuất (revoke refresh token family)     |
| POST   | `/auth/verify-otp`          | —            | otpLimiter | Xác thực email bằng OTP 6 chữ số            |
| POST   | `/auth/resend-verification` | —            | otpLimiter | Gửi lại OTP xác thực email                  |
| POST   | `/auth/refresh-token`       | —            | —          | Lấy access token mới (rotate refresh token) |
| POST   | `/auth/forgot-password`     | —            | otpLimiter | Yêu cầu reset password                      |
| POST   | `/auth/reset-password`      | —            | —          | Đặt lại mật khẩu bằng OTP                   |
| GET    | `/auth/me`                  | authenticate | —          | Lấy thông tin user hiện tại                 |

**`otpLimiter`** áp dụng cho: `/verify-otp`, `/resend-verification`, `/forgot-password`. `/reset-password` **không** có rate limit.

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

- `User` model — inject từ `app.js`, share với `users` module
- `emailService` — gửi OTP email + reset password email (inject từ app.js)
- `eventBus` — publish `auth.userRegistered` (bắt buộc)

## 5.2 Used by (module khác dùng module này)

- **Tất cả modules** — `src/middlewares/authenticate.js` verify JWT từ mọi protected request. Middleware này **không nằm trong auth module** — là shared middleware.
- `admin` module — `adminAuthenticate` middleware dùng JWT infrastructure tương tự

**Events published:**

- `auth.userRegistered` — payload `{ userId, email }`. Hiện không có subscriber nào.

---

# 6. Gotchas & Edge Cases

- **`authenticate` middleware không trong auth module**: Nằm ở `src/middlewares/authenticate.js`, dùng chung toàn app. Auth module chỉ tạo token; middleware verify là tầng riêng.
- **Adapters inline trong `module.js`**: Không có file `jwt-token-signer.js` riêng biệt. Mọi adapter đều inline trong `module.js`.
- **Logout chỉ revoke refresh token**: Access token không bị blacklist — vẫn valid cho đến hết TTL. Client có trách nhiệm xóa token khỏi storage ngay khi logout.
- **Family ID rotation — security behavior**: Reuse refresh token cũ sau khi đã rotate → revoke toàn bộ family `rt_family_revoked:<familyId>` → force logout tất cả devices. Intentional, không bypass.
- **`/reset-password` không có rate limit**: Endpoint này validate OTP trước khi reset — brute force bị chặn bởi OTP TTL 10 phút và OTP bị clear sau dùng.
- **Google OAuth fallback**: `verifyIdToken()` thất bại → thử `verifyAccessToken()`. Nếu cả hai fail → `AppError 401`. Không lưu kết quả verify.
- **OTP timing-safe compare**: Dùng `crypto.timingSafeEqual` để tránh timing attack. OTP được pad thành 6 chữ số trước khi compare.
- **`bcrypt` cost 4 trong test**: Set env `BCRYPT_ROUNDS=4` để test nhanh hơn. Production không được dùng giá trị thấp hơn 10.

---

# 7. Tests

| File                                                      | Loại        | Mô tả                                       |
| --------------------------------------------------------- | ----------- | ------------------------------------------- |
| `services/auth-service.test.js`                           | Unit        | Happy path flows                            |
| `services/auth-service.edge-cases.test.js`                | Unit        | Edge cases batch 1                          |
| `services/auth-service.edge-cases-2.test.js`              | Unit        | Edge cases batch 2                          |
| `services/auth-service.edge-cases-3.test.js`              | Unit        | Edge cases batch 3                          |
| `services/auth-service.edge-cases-4.test.js`              | Unit        | Edge cases batch 4                          |
| `controllers/auth-controller.unit.test.js`                | Unit        | HTTP layer                                  |
| `dtos/auth-dto.test.js`                                   | Unit        | DTO transformation                          |
| `repositories/auth-repository.test.js`                    | Unit        | Repository queries                          |
| `src/__integration__/auth.integration.test.js`            | Integration | DB integration (MySQL thật)                 |
| `src/__integration__/auth-edge-cases.integration.test.js` | Integration | Integration edge cases                      |
| `src/__integration__/auth-extra.integration.test.js`      | Integration | Integration extra scenarios                 |
| `src/__api__/auth.http.test.js`                           | API HTTP    | End-to-end HTTP                             |
| `src/__api__/auth-security.http.test.js`                  | API HTTP    | Security scenarios (token reuse, blacklist) |
| `src/__api__/auth-edge-cases.http.test.js`                | API HTTP    | HTTP edge cases                             |
| `src/__api__/auth-deep.http.test.js`                      | API HTTP    | Deep HTTP scenarios                         |
