# Auth Feature — TechStore Frontend

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

Xác thực người dùng: đăng nhập email/password, Google OAuth, đăng ký, quên mật khẩu, đặt lại mật khẩu, xác minh email qua OTP. Export `useAuth` hook được dùng rộng rãi toàn app để kiểm tra trạng thái đăng nhập, role, và thực hiện logout.

## 1.2 Routes

| Route              | Page                 | Guard                                         |
| ------------------ | -------------------- | --------------------------------------------- |
| `/login`           | `LoginPage`          | `PublicOnlyRoute` (redirect `/` nếu đã login) |
| `/register`        | `RegisterPage`       | `PublicOnlyRoute`                             |
| `/forgot-password` | `ForgotPasswordPage` | `PublicOnlyRoute`                             |
| `/reset-password`  | `ResetPasswordPage`  | Public                                        |
| `/verify-email`    | `VerifyEmailPage`    | Public                                        |

Route guards nằm trong `src/components/routing/` (không thuộc feature này):

- `ProtectedRoute` — redirect `/login` nếu chưa đăng nhập
- `AdminRoute` — redirect `/` nếu không có role `admin` hoặc `manager`
- `PublicOnlyRoute` — redirect `/` nếu đã đăng nhập

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/auth/
  api/
    auth-api.ts           — Tất cả TanStack Query hooks: login, register, logout, refresh, OTP, forgot/reset password

  components/
    AuthProvider.tsx      — Provider khởi tạo auth state khi app mount (restore session từ storage)
    GoogleLoginButton.tsx — Nút đăng nhập Google OAuth
    LoginSuccess.tsx      — Component hiển thị brief confirmation sau login thành công

  hooks/
    use-auth.ts           — Custom hook wrap authStore + logout side effects (clear cart, wishlist, queryClient)

  pages/
    LoginPage.tsx         — /login: form email+password + Google OAuth button
    RegisterPage.tsx      — /register: form firstName, lastName, email, password, phone?
    ForgotPasswordPage.tsx — /forgot-password: nhập email → gửi link reset
    ResetPasswordPage.tsx — /reset-password: nhận token từ query param → nhập mật khẩu mới
    VerifyEmailPage.tsx   — /verify-email: nhập OTP 6 số, có nút resend

  types/
    auth.types.ts         — AuthState, LoginCredentials, RegisterData, AuthResponse

  index.ts                — Barrel export (useAuth, AuthProvider, hooks, pages)
```

---

# 3. State Management

## 3.1 Server state (React Query)

Query key duy nhất: `['auth', 'currentUser']` cho `useGetCurrentUserQuery`.

## 3.2 Client state (Zustand)

`authStore` (`src/stores/auth-store.ts`):

- `user: User | null` — persist `localStorage`
- `token: string | null` — persist `sessionStorage` (mất khi đóng tab — intentional security decision)
- `isAuthenticated: boolean`
- `isLoading: boolean`
- `justLoggedIn: boolean` — flag trigger merge cart sau login. Phải gọi `clearJustLoggedIn()` sau khi xử lý. Nếu quên → merge lặp lại mỗi lần navigate.

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                        | Mô tả                                                               |
| ------ | --------------------------- | ------------------------------------------------------------------- |
| POST   | `/auth/login`               | Đăng nhập email + password → `{ user, token }`                      |
| POST   | `/auth/google`              | Đăng nhập Google OAuth (truyền Google ID token) → `{ user, token }` |
| POST   | `/auth/register`            | Tạo tài khoản → gửi email xác minh                                  |
| POST   | `/auth/logout`              | Đăng xuất; `onSuccess`: `queryClient.clear()`                       |
| POST   | `/auth/refresh-token`       | Refresh access token                                                |
| POST   | `/auth/forgot-password`     | Gửi email reset password                                            |
| POST   | `/auth/reset-password`      | Đặt lại mật khẩu bằng token từ email                                |
| POST   | `/auth/resend-verification` | Gửi lại email xác minh                                              |
| POST   | `/auth/verify-otp`          | Xác minh OTP `{ email, otp }`                                       |
| GET    | `/auth/me`                  | Lấy thông tin user hiện tại                                         |

## 4.2 Query hooks

**Queries:**

- `useGetCurrentUserQuery(options?)` — `GET /auth/me`; query key: `['auth', 'currentUser']`

**Mutations:**

- `useLoginMutation()` — đăng nhập email/password; parse `BackendResponse` → `AuthResponse`
- `useGoogleLoginMutation()` — Google OAuth
- `useRegisterMutation()` — tạo tài khoản
- `useForgotPasswordMutation()` — gửi email reset
- `useResetPasswordMutation()` — đặt lại mật khẩu với token
- `useLogoutMutation()` — đăng xuất; `onSuccess` gọi `queryClient.clear()`
- `useRefreshTokenMutation()` — refresh token (thường gọi qua api-client interceptor)
- `useResendVerificationMutation()` — gửi lại OTP
- `useVerifyOtpMutation()` — verify OTP 6 số

---

# 5. Components chính

| Component           | Mô tả                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuthProvider`      | Mount ở root app — khởi tạo auth state, restore session từ localStorage/sessionStorage. Không render UI.                                                               |
| `GoogleLoginButton` | Tích hợp Google OAuth. Server nhận Google ID token, trả về `{ user, token }` qua `POST /auth/google`.                                                                  |
| `useAuth` (hook)    | Wrap `authStore` + `useLogoutMutation`. Expose: `logout()` (full cleanup), `isAdmin()`, `isManager()`, `getUserFullName()`, `isLoggedIn`, `hasToken`, `needsUserInfo`. |

---

# 6. Types

```typescript
// types/auth.types.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  justLoggedIn: boolean;
}
interface LoginCredentials {
  email: string;
  password: string;
}
interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}
interface AuthResponse {
  user: User;
  token: string;
}
```

`User` type dùng chung từ `src/types/user.types.ts`.

---

# 7. Dependencies

## 7.1 Depends on

- `stores/auth-store` — single source of truth cho auth state
- `stores/cart-store` — `initializeCart()` khi logout (xóa local cart server data)
- `stores/wishlist-store` — `clearWishlistLocal()` khi logout
- `lib/query-client` — `queryClient.clear()` khi logout
- `lib/api-client` — interceptor tự động gọi `useRefreshTokenMutation` khi 401

## 7.2 Used by

- **Toàn app** — `useAuth()` hook dùng ở `AdminLayout`, `Header`, `ProtectedRoute`, `AdminRoute`, `CheckoutPage`, `CartPage`...
- `features/cart/hooks/use-cart-merge.ts` — watch `justLoggedIn` để trigger merge
- `features/cart/hooks/use-cart-sync.ts` — `isAuthenticated` để enable cart query
- `features/ai/api/chatbot-service.ts` — `useAuthStore.getState()` để lấy token

---

# 8. Gotchas & Edge Cases

- **Token storage:** access token lưu `sessionStorage` (mất khi đóng tab) — intentional security decision. User data lưu `localStorage` (persist để tránh re-fetch khi reload).
- **`justLoggedIn` flag:** set `true` khi `loginSuccess` action chạy. `MainLayout` watch flag để trigger `useCartMerge`. Sau khi merge xong → gọi `clearJustLoggedIn()`. Không reset = merge lại mỗi lần navigate.
- **Auto-refresh:** api-client interceptor (`src/lib/api-client.ts`) tự động refresh token khi nhận 401 — trừ các endpoint auth (`/auth/login`, `/auth/register`, etc.) để tránh infinite loop.
- **`useLogoutMutation` `onSuccess`** gọi `queryClient.clear()` — xóa toàn bộ TanStack Query data. `useAuth.logout()` còn thêm: clear `wishlistStore`, `cartStore`, xóa các `localStorage` keys (`wishlist`, `recentSearches`, `cartItems`).
- **`PublicOnlyRoute`** bắt buộc cho login/register pages — nếu thiếu, user đã đăng nhập vào được trang login → race condition với authStore.
- **Google OAuth flow:** server trả token trong response body — không phải query params. FE dùng `useGoogleLoginMutation` để nhận `{ user, token }`.
- **`AdminRoute`** cho phép cả `admin` lẫn `manager` — không chỉ `admin`. Kiểm tra trong `useAuth.isAdmin()` bao gồm cả role `manager`.
- **`parseAuthResponse`:** backend response có thể có dạng `{ status: 'success', user, token }` — được normalize về `{ user, token }` trước khi trả về từ mutation.

---

# 9. Tests

- `frontend/src/__tests__/features/auth/` — component tests cho LoginPage, RegisterPage, VerifyEmailPage
- `backend/__tests__/modules/auth/` — unit tests auth service (login, register, OTP, refresh)
- `backend/__api__/auth.api.test.js` — API HTTP tests
