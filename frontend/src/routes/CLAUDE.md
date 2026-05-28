# Routes — Routing Configuration — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Files](#11-files)
- [2. paths.ts — Route Constants](#2-pathsts--route-constants)
  - [2.1 Static routes (ROUTES object)](#21-static-routes-routes-object)
  - [2.2 Dynamic route builders (buildRoute object)](#22-dynamic-route-builders-buildroute-object)
- [3. AppRoutes.tsx — Router Config](#3-approutestsx--router-config)
  - [3.1 Cấu trúc route tree](#31-cấu-trúc-route-tree)
  - [3.2 Lazy loading pattern](#32-lazy-loading-pattern)
  - [3.3 Admin route lazy loading](#33-admin-route-lazy-loading)
- [4. Route Guards](#4-route-guards)
  - [4.1 3 loại guards](#41-3-loại-guards)
  - [4.2 Re-export](#42-re-export)
- [5. Key Gotchas](#5-key-gotchas)

---

# 1. Tổng quan

## 1.1 Files

```
routes/
  paths.ts        — ROUTES constants + buildRoute helpers
  AppRoutes.tsx   — React Router v7 route tree với lazy loading
```

---

# 2. paths.ts — Route Constants

## 2.1 Static routes (ROUTES object)

```ts
import { ROUTES, buildRoute } from '@/routes/paths';
// hoặc: import { ROUTES } from '@routes/paths';

// Trang công khai
ROUTES.HOME; // '/'
ROUTES.SHOP; // '/shop'
ROUTES.PRODUCT_DETAIL; // '/products/:productId'
ROUTES.CART; // '/cart'
ROUTES.CATEGORIES; // '/categories'
ROUTES.CATEGORY; // '/categories/:slug'
ROUTES.BRANDS; // '/brands'
ROUTES.DEALS; // '/deals'
ROUTES.NEW_ARRIVALS; // '/new-arrivals'
ROUTES.BEST_SELLERS; // '/best-sellers'
ROUTES.ABOUT; // '/about'
ROUTES.CONTACT; // '/contact'
ROUTES.FAQS; // '/faqs'
ROUTES.SHIPPING_RETURNS; // '/shipping-returns'
ROUTES.TRACK_ORDER; // '/track-order'
ROUTES.PRIVACY_POLICY; // '/privacy-policy'
ROUTES.TERMS; // '/terms'
// Auth
ROUTES.LOGIN; // '/login'
ROUTES.REGISTER; // '/register'
ROUTES.FORGOT_PASSWORD; // '/forgot-password'
ROUTES.RESET_PASSWORD; // '/reset-password'
ROUTES.VERIFY_EMAIL; // '/verify-email'
ROUTES.VERIFY_EMAIL_TOKEN; // '/verify-email/:token'

// Protected (cần đăng nhập)
ROUTES.CHECKOUT; // '/checkout'
ROUTES.CHECKOUT_PAYMENT; // '/checkout/payment'
ROUTES.PAYMENT_QR; // '/payment-qr'
ROUTES.PROFILE; // '/profile'
ROUTES.ORDERS; // '/orders'
ROUTES.WISHLIST; // '/wishlist'

// Lỗi
ROUTES.UNAUTHORIZED; // '/unauthorized'

// Admin
ROUTES.ADMIN; // '/admin'
ROUTES.ADMIN_DASHBOARD; // '/admin/dashboard'
ROUTES.ADMIN_PRODUCTS; // '/admin/products'
ROUTES.ADMIN_PRODUCTS_CREATE; // '/admin/products/create'
ROUTES.ADMIN_PRODUCTS_EDIT; // '/admin/products/edit/:id'
ROUTES.ADMIN_CATEGORIES; // '/admin/categories'
ROUTES.ADMIN_ORDERS; // '/admin/orders'
ROUTES.ADMIN_USERS; // '/admin/users'
ROUTES.ADMIN_USER_DETAIL; // '/admin/users/:id'
ROUTES.ADMIN_DISCOUNT_CODES; // '/admin/discount-codes'
ROUTES.ADMIN_BRANDS; // '/admin/brands'
ROUTES.ADMIN_INVENTORY; // '/admin/inventory'
```

## 2.2 Dynamic route builders (buildRoute object)

```ts
buildRoute.productDetail(id)                              // '/products/123'
buildRoute.category(slug)                                 // '/categories/dien-thoai'
buildRoute.shopSearch(query)                              // '/shop?search=iphone'
buildRoute.shopCategory(slug)                             // '/shop?category=laptop'
buildRoute.shopBrand(id)                                  // '/shop?brand=1'
buildRoute.verifyEmail(email?)                            // '/verify-email?email=...'
buildRoute.paymentQr(orderId, amount, numberOrder)        // '/payment-qr?orderId=...&amount=...&numberOrder=...'
buildRoute.checkoutRepay(orderId, amount)                 // '/checkout?repayOrder=...&amount=...'
buildRoute.adminProductEdit(id)                           // '/admin/products/edit/123'
buildRoute.adminUserDetail(id)                            // '/admin/users/123'
buildRoute.adminOrderDetail(id)                           // '/admin/orders/123'
buildRoute.adminOrdersPending()                           // '/admin/orders?status=pending'
buildRoute.adminProductDetail(id)                         // '/admin/products/123'
```

---

# 3. AppRoutes.tsx — Router Config

## 3.1 Cấu trúc route tree

```
Suspense (fallback: <LoadingSpinner fullScreen />)
└── Routes
    ├── MainLayout (path="/")
    │   ├── Public routes:
    │   │   /, /shop, /products/:productId, /cart
    │   │   /categories, /categories/:slug
    │   │   /brands, /deals, /new-arrivals, /best-sellers
    │   │   /about, /contact, /faqs, /shipping-returns, /track-order
    │   │   /privacy-policy, /terms
    │   │   /verify-email, /verify-email/:token
    │   │   /unauthorized
    │   │
    │   ├── PublicOnlyRoute (redirect → '/' nếu authenticated):
    │   │   /login, /register, /forgot-password, /reset-password
    │   │
    │   ├── ProtectedRoute (redirect → '/login' nếu chưa authenticated):
    │   │   /checkout, /checkout/payment, /payment-qr
    │   │   /profile, /orders, /wishlist
    │   │
    │   └── catch-all: NotFoundPage
    │
    └── AdminRoute + AdminLayout (path="/admin")
        /admin → redirect /admin/dashboard
        /admin/dashboard
        /admin/products, /admin/products/create, /admin/products/edit/:id
        /admin/categories, /admin/orders, /admin/users, /admin/users/:id
        /admin/discount-codes
        /admin/brands, /admin/inventory
```

## 3.2 Lazy loading pattern

```ts
// Tất cả page components đều lazy-loaded
const LoginPage = lazy(() => import('@/features/auth/pages/LoginPage'));
const ShopPage = lazy(() => import('@/features/catalog/pages/ShopPage'));
const AdminDashboardPage = lazy(() => import('@/features/admin/pages/DashboardPage'));

// Suspense wrap toàn bộ Routes
<Suspense fallback={<LoadingSpinner fullScreen />}>
  <Routes>...</Routes>
</Suspense>
```

## 3.3 Admin route lazy loading

Admin pages nằm **sâu trong feature folder**, không phải `pages/Admin*.tsx`:

```ts
// Admin pages pattern
lazy(() => import('@/features/admin/pages/DashboardPage'));
lazy(() => import('@/features/admin/pages/catalog/ProductsPage'));
lazy(() => import('@/features/admin/pages/orders/OrdersPage'));
```

---

# 4. Route Guards

## 4.1 3 loại guards

| Guard             | Location                                     | Logic chi tiết                                                                                                                            |
| ----------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ProtectedRoute`  | `src/components/routing/ProtectedRoute.tsx`  | `!isAuthenticated` → Navigate to `ROUTES.LOGIN` với `state={{ from: location }}`. Optional `requiredRoles[]` prop để check thêm.          |
| `AdminRoute`      | `src/components/routing/AdminRoute.tsx`      | Có token nhưng không có user → fetch via `useGetCurrentUserQuery`. Check `role !== 'admin'` → `/unauthorized`. Không có token → `/login`. |
| `PublicOnlyRoute` | `src/components/routing/PublicOnlyRoute.tsx` | `isAuthenticated` → Navigate to `ROUTES.HOME`.                                                                                            |

## 4.2 Re-export

Guards được re-export từ `features/auth`:

```ts
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from '@/features/auth';
```

---

# 5. Key Gotchas

- **Không hardcode paths:** dùng `ROUTES.SHOP` thay vì `'/shop'`, `buildRoute.productDetail(id)` thay vì `'/products/' + id`.
- **`/cart` là public route** — không bọc `ProtectedRoute`. Cart mutations require auth nhưng page view thì không. Khác với `/checkout` là protected.
- **`/verify-email` không protected** — user có thể truy cập sau khi đăng ký (chưa authenticated).
- **Admin redirect:** `/admin` → `Navigate to ROUTES.ADMIN_DASHBOARD` (không phải page riêng).
- **Lazy loading tất cả pages** — khi thêm page mới phải `lazy()` wrap và thêm vào Routes.
- **`AdminRoute` wrap `AdminLayout`** — AdminLayout render `<Outlet />` cho sub-routes của admin.
