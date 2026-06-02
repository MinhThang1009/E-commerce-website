# Frontend — TechStore E-Commerce

← Quay lại [`CLAUDE.md`](../CLAUDE.md)

> Feature-Based Architecture. Entry: `src/main.tsx` → `src/App.tsx` → `src/routes/AppRoutes.tsx`.

## Mục lục

- [1. Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
- [2. Feature-Based Pattern](#2-feature-based-pattern)
  - [2.1 Feature structure](#21-feature-structure)
  - [2.2 Shared vs Feature code](#22-shared-vs-feature-code)
- [3. State Management](#3-state-management)
  - [3.1 Server state (TanStack Query)](#31-server-state-tanstack-query)
  - [3.2 Client state (Zustand)](#32-client-state-zustand)
- [4. API Layer](#4-api-layer)
  - [4.1 api-client.ts](#41-api-clientts)
  - [4.2 React Query hooks pattern](#42-react-query-hooks-pattern)
- [5. Routing](#5-routing)
  - [5.1 Route guards](#51-route-guards)
  - [5.2 Lazy loading](#52-lazy-loading)
- [6. Features](#6-features)
- [7. Shared Components & Hooks](#7-shared-components--hooks)
- [8. Styling](#8-styling)
  - [8.1 Tailwind CSS](#81-tailwind-css)
  - [8.2 SCSS tokens](#82-scss-tokens)
- [9. i18n](#9-i18n)
- [10. Commands](#10-commands)
- [11. CLAUDE.md con](#11-claudemd-con)

---

# 1. Kiến trúc tổng quan

## 1.1 Data flow

```
Route → Page → Components
                  ├→ TanStack Query hooks (server state)
                  └→ Zustand stores (client state)
                       └→ apiClient (Axios) → Backend API
```

## 1.2 Tech stack

| Layer | Tech |
|---|---|
| Framework | React 19 + TypeScript + Vite 8 |
| Routing | React Router v7 |
| Server state | TanStack Query v5 |
| Client state | Zustand v5 + Immer |
| HTTP | Axios (qua `api-client.ts`) |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) + SCSS |
| i18n | i18next v26 + react-i18next |
| UI library | shadcn/ui (Radix UI + cva) |
| Rich text | Tiptap (TiptapEditor component, mode='simple'\|'full') |
| Charts | Recharts |
| Motion | Framer Motion v12 |
| Validation | Zod v4 (form schemas) |
| Icons | Lucide React |
| Date | dayjs v1 |
| Excel export | ExcelJS v4.4 |
| Maps | Leaflet v1 |

## 1.3 13 features — mỗi feature = 1 domain cô lập

- Không có cross-feature imports (ngoại lệ duy nhất: `orders → reviews` cho `ReviewModal`)
- Shared code trong `src/components/`, `src/stores/`, `src/hooks/`, `src/utils/`, `src/lib/`

---

# 2. Feature-Based Pattern

## 2.1 Feature structure

```
src/features/<name>/
  api/          ← TanStack Query hooks + Axios calls
  components/   ← Feature-specific UI components
  hooks/        ← Feature-specific React hooks
  pages/        ← Page-level components (lazy-loaded)
  types/        ← TypeScript interfaces
  index.ts      ← Barrel export (public API của feature)
  CLAUDE.md     ← Tổng quan, state, API hooks, gotchas
```

## 2.2 Shared vs Feature code

| Code | Nằm ở đâu |
|---|---|
| Shared UI primitives (Button, Modal, Input...) | `src/components/common/` |
| Layouts (Header, Footer, MainLayout) | `src/components/layout/` |
| Route guards | `src/components/routing/` |
| Zustand stores | `src/stores/` |
| Global hooks (useTokenRefresh, useNotifications...) | `src/hooks/` |
| Axios client, QueryClient config | `src/lib/` |
| Utility functions | `src/utils/` |
| TypeScript types dùng chung | `src/types/` |
| Feature-specific components, hooks, types | `src/features/<name>/` |

---

# 3. State Management

## 3.1 Server state (TanStack Query)

Tất cả data từ API được quản lý bởi TanStack Query:
- Query key conventions: mỗi feature định nghĩa `<name>Keys` object (ví dụ `cartKeys`, `orderKeys`)
- `staleTime`, `gcTime` set tùy feature
- Invalidation sau mutations dùng `queryClient.invalidateQueries({ queryKey: ... })`

## 3.2 Client state (Zustand)

6 stores trong `src/stores/`:

| Store | State chính | Persistence |
|---|---|---|
| `auth-store.ts` | `user`, `token`, `isAuthenticated`, `justLoggedIn` | sessionStorage(token) + localStorage(user) |
| `cart-store.ts` | `items[]`, `serverCart`, `isOpen`, `totalItems`, `subtotal` | localStorage(cartItems) |
| `catalog-store.ts` | `recentlyViewed[]` (max 10), `compareList[]` (max 4), `filters` | localStorage(recentlyViewed) |
| `chat-store.ts` | `messages[]`, `isOpen`, `sessionId`, `chatHistory` | localStorage(chat_messages, chat_session_id) |
| `ui-store.ts` | `notifications[]`, `theme`, `isSearchOpen`, `isMobileMenuOpen` | localStorage(theme) |
| `wishlist-store.ts` | `items[]` (product IDs only) | Không persist (server-synced) |

---

# 4. API Layer

## 4.1 api-client.ts

Tất cả HTTP calls đi qua `src/lib/api-client.ts`:
- `baseURL`: `VITE_API_URL || 'http://localhost:8888/api'`
- Timeout: 10s
- `withCredentials: true`
- Auto-inject `Authorization: Bearer <token>` (request interceptor — lấy từ `auth-store`)
- Auto-logout khi nhận 401 (response interceptor, bỏ qua auth endpoints để tránh loop)

## 4.2 React Query hooks pattern

```ts
// src/features/orders/api/order-api.ts
import apiClient from '@lib/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query keys object — tập trung để invalidation chính xác
export const orderKeys = {
  all: ['orders'] as const,
  list: () => [...orderKeys.all, 'list'] as const,
  detail: (id: string | number) => [...orderKeys.all, 'detail', id] as const,
};

export function useGetUserOrdersQuery() {
  return useQuery({
    queryKey: orderKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get('/orders');
      return data.data;
    },
  });
}
```

---

# 5. Routing

## 5.1 Route guards

3 guards trong `src/components/routing/`:

| Guard | Logic |
|---|---|
| `ProtectedRoute` | Redirect `/login` nếu `!isAuthenticated` |
| `AdminRoute` | Redirect `ROUTES.UNAUTHORIZED` nếu `role ∉ allowedRoles`. Prop `allowedRoles` mặc định `['admin','staff']` (back-office); trang quản lý users truyền `['admin']` |
| `PublicOnlyRoute` | Redirect `/` nếu đã authenticated (login, register pages) |

## 5.2 Lazy loading

Tất cả page components đều `lazy()` — Suspense fallback là `<LoadingSpinner fullScreen />`.

Các route paths được định nghĩa trong `src/routes/paths.ts` (constants + `buildRoute` helpers).

**Public routes:** `/`, `/shop`, `/products/:id`, `/cart`, `/categories/*`, `/brands`, `/deals`, `/new-arrivals`, `/best-sellers`, `/about`, `/contact`, `/faqs`, `/track-order`

**Auth routes (PublicOnly):** `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`

**Protected routes:** `/checkout`, `/payment-qr`, `/profile`, `/orders`, `/wishlist`

**Admin routes (AdminRoute):** `/admin/dashboard`, `/admin/products/*`, `/admin/orders`, `/admin/users/*`, `/admin/categories`, `/admin/brands`, `/admin/inventory`, `/admin/discount-codes`

---

# 6. Features

| Feature | Route prefix | Mô tả | CLAUDE.md |
|---|---|---|---|
| `admin` | `/admin/*` | Dashboard, CRUD products/orders/users, analytics | [CLAUDE.md](src/features/admin/CLAUDE.md) |
| `ai` | global widget (no route) | AI chatbot widget, RAG chat interface | [CLAUDE.md](src/features/ai/CLAUDE.md) |
| `auth` | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Đăng nhập, đăng ký, quên mật khẩu, Google OAuth | [CLAUDE.md](src/features/auth/CLAUDE.md) |
| `cart` | `/cart` | Giỏ hàng, guest/auth merge | [CLAUDE.md](src/features/cart/CLAUDE.md) |
| `catalog` | `/shop`, `/products/:id`, `/categories/*`, `/brands`, `/deals`, `/new-arrivals`, `/best-sellers` | Shop, product detail, categories, brands | [CLAUDE.md](src/features/catalog/CLAUDE.md) |
| `checkout` | `/checkout`, `/checkout/payment` | Checkout flow, address, discount code | [CLAUDE.md](src/features/checkout/CLAUDE.md) |
| `content` | `/contact` | Form liên hệ/feedback | [CLAUDE.md](src/features/content/CLAUDE.md) |
| `orders` | `/orders`, `/track-order` | Danh sách đơn, chi tiết đơn, track order | [CLAUDE.md](src/features/orders/CLAUDE.md) |
| `payment` | `/payment-qr` | Thanh toán QR code (MoMo/VNPay) | [CLAUDE.md](src/features/payment/CLAUDE.md) |
| `reviews` | embedded (no route) | Review modal, star rating | [CLAUDE.md](src/features/reviews/CLAUDE.md) |
| `upload` | embedded (no route) | File upload component (dùng trong admin) | [CLAUDE.md](src/features/upload/CLAUDE.md) |
| `users` | `/profile` | Profile, địa chỉ, đổi mật khẩu | [CLAUDE.md](src/features/users/CLAUDE.md) |
| `wishlist` | `/wishlist` | Danh sách yêu thích | [CLAUDE.md](src/features/wishlist/CLAUDE.md) |

**Admin pages nằm ở đâu:**
- `features/admin/pages/` — dashboard, inventory, discount-codes, users
- Trang admin của domain khác nằm trong feature đó: `features/catalog/pages/catalog/` (products, brands, categories CRUD), `features/orders/pages/orders/`

---

# 7. Shared Components & Hooks

```
src/components/
  common/        ← UI primitives: Button, Modal, Input, Card, Badge, Pagination, Rating, Table...
  layout/        ← Header, Footer, MainLayout, PageLayout, Grid (AdminLayout nằm trong features/admin/components/)
  routing/       ← ProtectedRoute, AdminRoute, PublicOnlyRoute
  sections/      ← HomePage sections (HeroSection)
  icons/         ← Custom icon components

src/hooks/       ← Global hooks (5 hook files, 5 exported hooks):
  use-token-refresh.ts  ← Auto-refresh JWT trước khi hết hạn
  use-debounce.ts       ← Debounce value
  use-notifications.ts  ← Notification queue + toast logic
  use-api-state.ts      ← Wrapper cho loading/error/data state pattern
  use-scroll-to-top.ts  ← Scroll to top on route change
```

---

# 8. Styling

## 8.1 Tailwind CSS

- Dùng `tailwind-merge` + `clsx` cho className merging
- Utility: `cn()` trong `src/utils/cn.ts`
- Dark mode class: `dark` trên root element, token `#09090b`

## 8.2 SCSS tokens

- `src/styles/index.scss` — global CSS variables + Tailwind base imports
- `src/styles/` — SCSS tokens cho spacing, colors, typography

---

# 9. i18n

Tất cả user-visible strings PHẢI dùng `t('key')`:

```ts
const { t } = useTranslation();
return <p>{t('checkout.bankTransfer.title')}</p>;
```

Keys phải có trong **cả 2 files**:
- `src/locales/vi.json`
- `src/locales/en.json`

Thiếu 1 file → user switch lang → hiển thị key thô. Dùng `node scripts/check-i18n.js` để kiểm tra parity.

i18n init: `src/config/i18n.ts` — import trong `src/App.tsx` trước mọi component render.

---

# 10. Commands

```bash
# Từ thư mục frontend/
npm run dev           # Vite dev server (port 5175)
npm run build         # Production build
npm run build:check   # Production build (mode=production, dry-run)
npm run typecheck     # tsc --noEmit — phải pass trước khi commit
npm run lint          # ESLint --max-warnings 0
npm run lint:fix      # ESLint --fix
npm run format        # Prettier --write src/
npm run format:check  # Prettier --check
npm test              # Jest (jest.config.cjs) — watch mode
npm run test:ci       # CI mode + coverage + forceExit
npm run test:coverage # Coverage report
npm run preview       # Preview production build
```

---

# 11. CLAUDE.md con

```
frontend/CLAUDE.md                           ← File này: overview, conventions
frontend/src/
  config/CLAUDE.md                           ← i18n initialization
  locales/CLAUDE.md                          ← i18n vi.json / en.json
  lib/CLAUDE.md                              ← api-client, query-client
  stores/CLAUDE.md                           ← 6 Zustand stores
  routes/CLAUDE.md                           ← paths.ts, AppRoutes.tsx, lazy loading
  components/CLAUDE.md                       ← shared UI components
  hooks/CLAUDE.md                            ← 5 global hooks
  pages/CLAUDE.md                            ← static/marketing pages
  utils/CLAUDE.md                            ← 13 utility files
  types/CLAUDE.md                            ← global TypeScript types
  styles/CLAUDE.md                           ← SCSS tokens, global styles, chart tokens
  constants/CLAUDE.md                        ← PAGINATION, UPLOAD, SHIPPING, chart-colors
  schemas/CLAUDE.md                          ← Zod validation schemas (auth, checkout)
  __tests__/CLAUDE.md                        ← Component tests (Jest + RTL, 21 suites)
  features/admin/CLAUDE.md                   ← Admin dashboard, CRUD pages
  features/ai/CLAUDE.md                      ← AI chatbot widget
  features/auth/CLAUDE.md                    ← Login, register, forgot password
  features/cart/CLAUDE.md                    ← Giỏ hàng
  features/catalog/CLAUDE.md                 ← Shop, product detail, categories, brands
  features/checkout/CLAUDE.md                ← Checkout flow
  features/content/CLAUDE.md                 ← Form liên hệ/feedback
  features/orders/CLAUDE.md                  ← Orders list, order detail
  features/payment/CLAUDE.md                 ← Payment QR page
  features/reviews/CLAUDE.md                 ← Product reviews
  features/upload/CLAUDE.md                  ← File upload
  features/users/CLAUDE.md                   ← Profile, address management
  features/wishlist/CLAUDE.md                ← Danh sách yêu thích
```
