# Components — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Common Components](#2-common-components)
- [3. Layout Components](#3-layout-components)
- [4. Routing Components](#4-routing-components)
- [5. Section Components](#5-section-components)
- [6. Icons](#6-icons)
- [7. Usage Patterns](#7-usage-patterns)
- [8. CLAUDE.md con](#8-claudemd-con)

---

# 1. Tổng quan

## Cấu trúc thư mục

```
src/components/
  common/     — UI primitives (Button, Modal, Input, Card, Rating, TiptapEditor...)
  layout/     — Page structure (Header, Footer, MainLayout, PageLayout, PageTransition, MobileBottomNav)
  routing/    — Route guards (ProtectedRoute, AdminRoute, PublicOnlyRoute)
  sections/   — Homepage sections (HeroSection)
  ui/         — shadcn/ui primitives (alert, badge, button, card, checkbox, dialog, input, label, select, sheet, switch, tabs, tooltip)
  icons/      — SVG icon components + NAVIGATION_ICONS map
```

## Import pattern

```ts
// Barrel import cho common (khuyến nghị)
import { Button, Modal, Input, Badge, Rating } from '@components/common';

// Direct import cho layout/routing (không có barrel)
import MainLayout from '@components/layout/MainLayout';
import Header from '@components/layout/Header';

// Route guards re-export từ features/auth (dùng trong AppRoutes.tsx)
import { ProtectedRoute, AdminRoute, PublicOnlyRoute } from '@/features/auth';
```

---

# 2. Common Components

## Danh sách components

| Component          | Props quan trọng                                                                                                                                | Dùng khi                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `Button`           | `variant: primary/secondary/outline/ghost/danger`, `size: sm/md/lg`, `isLoading`, `leftIcon/rightIcon`, `fullWidth`, `as`, `to`                 | Tất cả CTA buttons. `as={Link} to="..."` để render dạng Link                            |
| `PremiumButton`    | Glass/Liquid Glass effect; `variant: primary/secondary/outline/ghost`, `size: small/middle/large`, `iconType`, `isProcessing`, `processingText` | Landing page CTA, upgrade prompts, nơi cần visual premium                               |
| `Modal`            | `isOpen`, `onClose`, `title?`, `size: sm/md/lg/xl`, `footer?`, `closeOnClickOutside` (default true)                                             | Dialog overlay — `createPortal` vào `document.body`, block scroll khi mở, đóng bằng ESC |
| `Input`            | `label?`, `error?`, `helperText?`, `leftIcon?`, `rightIcon?`, `fullWidth`                                                                       | Form text fields                                                                        |
| `Select`           | `options: {value, label}[]`, `value`, `onChange`, `label?`, `error?`, `disabled?`                                                               | Dropdown select                                                                         |
| `Badge`            | `variant: primary/success/warning/error/info/neutral`, `size?`                                                                                  | Status labels nhỏ                                                                       |
| `Pagination`       | `currentPage`, `totalPages`, `onPageChange`, `siblingCount?`                                                                                    | Phân trang                                                                              |
| `Rating`           | `value`, `readOnly?`, `onChange?`, `interactive?`, `size?`                                                                                      | 5-sao rating display/input                                                              |
| `LoadingSpinner`   | `size: sm/md/lg/large`, `fullScreen?`                                                                                                           | Loading states                                                                          |
| `LoadingState`     | Export: `LoadingSpinner`, `FullPageLoading`, `ProductCardSkeleton`, `CategoryCardSkeleton`                                                      | Loading/skeleton states                                                                 |
| `ErrorState`       | Export: `ErrorState({ error, onRetry?, size? })`, `EmptyState({ title, description? })`                                                         | API error display + empty data states                                                   |
| `TiptapEditor`     | `value`, `onChange`, `mode: 'simple'\|'full'`, `placeholder?`                                                                                   | Tiptap WYSIWYG editor (simple: basic toolbar, full: extended + image)                   |
| `SearchBar`        | `isExpanded`, `onClose`, `className?`                                                                                                           | Header search với debounce 300ms, navigate đến `/shop?search=...`                       |
| `ImageUpload`      | `onUpload`, `maxSize?`, `accept?`                                                                                                               | Admin/user image upload với preview                                                     |
| `AddressPicker`    | `value`, `onChange`                                                                                                                             | Province/district/ward cascading selects (API địa chỉ VN)                               |
| `Notifications`    | Không có props — đặt 1 lần trong `App.tsx`                                                                                                      | Global toast container — reads `ui-store.notifications`                                 |
| `LanguageSwitcher` | —                                                                                                                                               | Header i18n toggle (vi/en) — lưu vào `localStorage('language')`                         |
| `ThemeToggle`      | —                                                                                                                                               | Header dark/light mode toggle — dùng View Transitions API cho circular reveal effect    |
| `FeedbackModal`    | `isOpen`, `onClose`, `onSubmit`                                                                                                                 | Thu thập feedback người dùng                                                            |
| `PageHero`         | `common/PageHero.tsx`                                                                                                                           | Hero banner đầu trang (không nằm trong barrel — import trực tiếp)                       |

## Barrel export

```ts
// common/index.ts export phần lớn common components — dùng barrel khi có thể
import { Button, Modal, PremiumButton, Badge } from '@components/common';
// hoặc: import { Button } from '@/components/common';
```

> **Card** không nằm trong `common/` — import từ `@/components/ui` (shadcn/ui): `import { Card } from '@/components/ui';`

> **Các component KHÔNG có trong barrel** (import trực tiếp): `SearchBar`, `ImageUpload`, `AddressPicker`, `FeedbackModal`, `PageHero`.

---

# 3. Layout Components

| Component         | Mô tả                                                                                                                                                                                                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MainLayout`      | Root layout cho user routes: `Header → AnimatePresence + PageTransition → <Outlet /> → Footer`. Mount `useScrollToTop()`. Trigger `useCartMerge(isAuthenticated, justLoggedIn)` sau login.                                                                                             |
| `PageTransition`  | Framer Motion wrapper cho route transitions (fade + slide). Keyed by `pathname` — AnimatePresence triggers enter/exit animations khi route thay đổi.                                                                                                                                   |
| `Header`          | Fixed top nav (z-50): logo, search bar, user dropdown (avatar/initials), cart/wishlist badge count, language/theme toggles, mobile hamburger menu. Scroll-aware: thêm `backdrop-blur` khi scroll > 10px. Cart count: ưu tiên server count khi authenticated, fallback về localStorage. |
| `Footer`          | Links danh mục, store info, social links, feedback form CTA.                                                                                                                                                                                                                           |
| `PageLayout`      | Per-page wrapper: SEO qua `react-helmet-async`, loading/error states. Props: `title`, `description?`, `keywords?`, `isLoading?`, `error?`, `showContainer?`, `noPaddingTop?`.                                                                                                          |
| `MobileBottomNav` | Fixed bottom nav cho mobile (lucide icons), cart badge count, điều hướng các tab theo `isAuthenticated`.                                                                                                                                                                               |

### MainLayout mount pattern

```tsx
// AppRoutes.tsx
<Route path="/" element={<MainLayout />}>
  <Route index element={<HomePage />} />
  ...
</Route>
```

### PageLayout pattern

```tsx
<PageLayout title="Sản phẩm" description="Mô tả SEO" isLoading={loading} error={error}>
  {/* Page content */}
</PageLayout>
```

---

# 4. Routing Components

| Component         | Logic                                                                                                                                                                                 | Redirect khi fail                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `ProtectedRoute`  | `!isAuthenticated` → redirect. Lưu `state={{ from: location }}` để redirect back sau login. Optional `requiredRoles?: string[]`.                                                      | `ROUTES.LOGIN`                                                    |
| `AdminRoute`      | Có token nhưng chưa có user → gọi `useGetCurrentUserQuery`. Check `role ∈ allowedRoles` (prop, mặc định `['admin','staff']`; users truyền `['admin']`). Hiện spinner trong khi fetch. | `ROUTES.LOGIN` (không có token), `ROUTES.UNAUTHORIZED` (sai role) |
| `PublicOnlyRoute` | `isAuthenticated` → redirect. Dùng cho login/register pages.                                                                                                                          | `ROUTES.HOME`                                                     |

### Dùng trong AppRoutes.tsx

```tsx
// Children pattern cho protected pages
<Route path="checkout" element={
  <ProtectedRoute>
    <CheckoutPage />
  </ProtectedRoute>
} />

// Outlet pattern cho admin layout
<Route path="admin" element={
  <AdminRoute><AdminLayout /></AdminRoute>
}>
  <Route path="dashboard" element={<AdminDashboardPage />} />
</Route>

// PublicOnlyRoute cho auth pages
<Route path="login" element={
  <PublicOnlyRoute><LoginPage /></PublicOnlyRoute>
} />
```

**Gotcha:** `AdminRoute` cố ý gọi `useGetCurrentUserQuery` kể cả khi `user` đã có trong store — intentional để verify token còn valid. Hook phải khai báo trước early return (React hooks rules).

---

# 5. Section Components

| Component     | Mô tả                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HeroSection` | Landing hero với gradient mesh background, product category cards (iPhone, MacBook, Watch, iPad), Framer Motion animations, 2 CTA buttons. Responsive design. |

Chỉ dùng trong `HomePage` (`src/pages/HomePage.tsx`).

---

# 6. Icons

## Cấu trúc

```
icons/
  CheckCircleIcon.tsx    — Check circle SVG
  PlusCircleIcon.tsx     — Plus circle SVG
  index.tsx              — NAVIGATION_ICONS map + tất cả icon exports
```

## NAVIGATION_ICONS

```ts
import { NAVIGATION_ICONS, NavigationIconKey } from '@/components/icons';
// Keys: 'home' | 'shop' | 'categories' | 'deals' | 'about'
const IconComponent = NAVIGATION_ICONS[item.key as NavigationIconKey];
return <IconComponent className="h-4 w-4" />;
```

## Named exports

```ts
import {
  ShopIcon,
  UserIcon,
  CartIcon,
  MenuIcon,
  CloseIcon,
  CheckCircleIcon,
  PlusCircleIcon,
} from '@/components/icons';
```

Tất cả icon accept `className` và `size` props. Đây là SVG components tự viết, không wrap thư viện.

**Lucide React:** icon library chính cho toàn bộ storefront + admin.

---

# 7. Usage Patterns

## Khi nào dùng Button vs PremiumButton

- **`Button`**: UI thông thường trong tất cả features — form submit, cancel, pagination
- **`PremiumButton`**: Landing page CTA, hero sections, nơi cần visual nổi bật (Glass effect).

## Khi nào dùng TiptapEditor modes

- **`mode='simple'`**: nội dung ngắn (product short description, FAQ, feedback) — basic toolbar
- **`mode='full'`**: product description trong admin — extended toolbar + image upload

## Notifications

Chỉ render `<Notifications />` 1 lần trong `App.tsx`. Components khác dùng `useNotifications()` hook (hoặc `useUiStore().addNotification()`) để dispatch toast.

---

# 8. CLAUDE.md con

Không có CLAUDE.md con trong các subdirectories của `components/`. Tất cả documentation tập trung tại file này.
