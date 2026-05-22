# Pages — Static & Marketing Pages — TechStore Frontend

> Static/marketing pages không thuộc feature domain cụ thể. Entry: `src/pages/`.

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Convention](#11-convention)
  - [1.2 Khi nào đặt page vào đây vs features](#12-khi-nào-đặt-page-vào-đây-vs-features)
- [2. Danh sách Files](#2-danh-sách-files)
- [3. Pages chi tiết](#3-pages-chi-tiết)
  - [3.1 HomePage.tsx](#31-homepagetsx)
  - [3.2 NotFoundPage.tsx](#32-notfoundpagetsx)
  - [3.3 UnauthorizedPage.tsx](#33-unauthorizedpagetsx)
  - [3.4 AboutPage.tsx](#34-aboutpagetsx)
  - [3.5 PrivacyPolicyPage.tsx](#35-privacypolicypagetsx)
  - [3.6 TermsPage.tsx](#36-termspagetsx)
  - [3.7 FAQsPage.tsx](#37-faqspagetsx)
  - [3.8 ShippingReturnsPage.tsx](#38-shippingreturnspagetsx)
- [4. Routing](#4-routing)
- [5. i18n](#5-i18n)
- [6. Key Gotchas](#6-key-gotchas)

---

# 1. Tổng quan

## 1.1 Convention

```
src/pages/                          ← Static/marketing pages (ở đây)
src/features/<name>/pages/          ← Feature pages (cart, checkout, profile, admin...)
```

Tất cả pages đều lazy-loaded trong `AppRoutes.tsx` qua `React.lazy()`.

## 1.2 Khi nào đặt page vào đây vs features

| Đặt vào `src/pages/` khi                                  | Đặt vào `features/<name>/pages/` khi                     |
| --------------------------------------------------------- | -------------------------------------------------------- |
| Standalone/marketing page, không gắn với 1 feature cụ thể | Page thuộc domain rõ ràng (cart, orders, auth, admin...) |
| Chủ yếu static content hoặc i18n text                     | Page cần fetch API, state management của feature         |
| Không cần TanStack Query hooks từ feature                 | Page import từ feature-specific hooks/components         |
| Error pages, policy pages                                 | Pages với authenticated data                             |

---

# 2. Danh sách Files

```
src/pages/
  AboutPage.tsx               ← Trang giới thiệu công ty
  FAQsPage.tsx                ← Câu hỏi thường gặp (accordion)
  HomePage.tsx                ← Landing page — có API calls từ catalog feature
  NotFoundPage.tsx            ← 404 error page
  PrivacyPolicyPage.tsx       ← Chính sách quyền riêng tư
  ShippingReturnsPage.tsx     ← Chính sách vận chuyển & đổi trả
  TermsPage.tsx               ← Điều khoản sử dụng
  UnauthorizedPage.tsx        ← 403 unauthorized page
```

---

# 3. Pages chi tiết

## 3.1 HomePage.tsx

**Route:** `/`

**Đây là ngoại lệ có API calls:**

- `useGetFeaturedProductsQuery()` — từ `features/catalog`
- `useGetCategoriesQuery()` — từ `features/catalog`
- `useGetBrandsQuery()` — từ `features/catalog`

**Layout:**

1. `HeroSection` — hero banner từ `src/components/sections/`
2. Categories grid — hiển thị `productCount` cho từng danh mục
3. Brands marquee — autoplay horizontal scroll
4. Featured products section — product cards

**Design:**

- Unified canvas với gradient mesh ambient orbs
- Framer Motion animations (scroll-triggered, staggered)
- Bento grid layout cho categories

## 3.2 NotFoundPage.tsx

**Route:** `*` (catch-all trong `AppRoutes.tsx`)

**Content:** 404 page với `PremiumButton` điều hướng về home và shop. Không có API calls.

**Bao gồm:** illustration hoặc animation, links về trang chủ và shop.

## 3.3 UnauthorizedPage.tsx

**Route:** `/unauthorized`

**Trigger:** `AdminRoute` guard redirect về đây khi user đăng nhập nhưng không đủ quyền (role không phải `admin` hoặc `manager`).

**Content:** Thông báo 403, link về trang chủ. Không có API calls.

## 3.4 AboutPage.tsx

**Route:** `/about`

**Content:**

- Thông tin công ty TechStore
- Team members với DiceBear avatars (external CDN)
- Product showcase (CDN URLs)
- CTA section

**Đặc điểm:**

- DiceBear avatars: `https://api.dicebear.com/9.x/avataaars/svg?seed=<name>` — external dependency
- Product collage images từ TGDD CDN (exception có lý do: showcase products thật)

## 3.5 PrivacyPolicyPage.tsx

**Route:** `/privacy-policy`

**Content:** Static HTML content về chính sách quyền riêng tư. Không có API calls. Tất cả text qua `useTranslation()`.

## 3.6 TermsPage.tsx

**Route:** `/terms`

**Content:** Điều khoản sử dụng. Static, không có API calls.

## 3.7 FAQsPage.tsx

**Route:** `/faqs`

**Content:** Câu hỏi thường gặp dạng accordion. Static content, không có API calls.

## 3.8 ShippingReturnsPage.tsx

**Route:** `/shipping-returns`

**Content:** Chính sách vận chuyển và đổi trả. Static, không có API calls.

---

# 4. Routing

Tất cả pages được lazy-loaded trong `AppRoutes.tsx`:

```tsx
const HomePage = lazy(() => import('@pages/HomePage'));
const NotFoundPage = lazy(() => import('@pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('@pages/UnauthorizedPage'));
const AboutPage = lazy(() => import('@pages/AboutPage'));
const PrivacyPolicyPage = lazy(() => import('@pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('@pages/TermsPage'));
const FAQsPage = lazy(() => import('@pages/FAQsPage'));
const ShippingReturnsPage = lazy(() => import('@pages/ShippingReturnsPage'));
```

Routes trong MainLayout:

- `HomePage` tại `/`
- `NotFoundPage` là catch-all `*`
- `UnauthorizedPage` tại `/unauthorized`
- Các static pages: `/about`, `/privacy-policy`, `/terms`, `/faqs`, `/shipping-returns`

---

# 5. i18n

Tất cả user-visible text phải dùng `useTranslation()`:

```tsx
const { t } = useTranslation();
return <h1>{t('about.title')}</h1>;
```

Keys phải có trong cả `src/locales/vi.json` và `src/locales/en.json`.

Các static pages (`PrivacyPolicyPage`, `TermsPage`, `FAQsPage`, `ShippingReturnsPage`) có thể chứa văn bản dài — nên tổ chức theo namespace hoặc nested keys trong locale files.

---

# 6. Key Gotchas

- **Lazy-loaded bắt buộc:** tất cả pages này dùng `lazy(() => import(...))` trong `AppRoutes.tsx` — không import trực tiếp.
- **`HomePage` là ngoại lệ có API:** page duy nhất trong `pages/` có TanStack Query hooks. Các pages khác là pure static.
- **`HomePage` dùng `sections/`:** `HeroSection` từ `src/components/sections/` — không import từ features.
- **`AboutPage` dùng DiceBear API:** avatars dùng external CDN `https://api.dicebear.com/9.x/` — cần internet.
- **`AboutPage` có external images:** CDN URLs từ TGDD — exception có lý do (showcase products thật). Không dùng Unsplash/placeholder images cho showcase products.
- **`UnauthorizedPage` không có redirect tự động:** user phải chủ động click về home. `AdminRoute` redirect về `/unauthorized` khi thiếu quyền.
- **Khi thêm page mới:** marketing/standalone → đặt vào đây. Feature-specific (cần fetch API theo domain) → đặt vào `features/<name>/pages/`.
- **Static pages không có loading state:** không có API calls → không cần Suspense riêng (đã wrapped trong `AppRoutes.tsx` Suspense).
- **`@pages` alias:** `src/pages/` được alias là `@pages` trong Vite config — dùng `@pages/HomePage` khi import.
