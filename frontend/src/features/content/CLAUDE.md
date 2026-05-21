# Content Feature — TechStore Frontend

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

Hiển thị nội dung editorial: tin tức/blog (list + detail), trang liên hệ, và quản lý banner cho HomePage. Cung cấp API hooks cho banner CRUD (dùng bởi admin). Admin pages cho news/banner quản lý nằm trong `features/admin/pages/content/` — không phải feature này.

## 1.2 Routes

| Route         | Page             |
| ------------- | ---------------- |
| `/news`       | `NewsListPage`   |
| `/news/:slug` | `NewsDetailPage` |
| `/contact`    | `ContactPage`    |

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/content/
  api/
    news-api.ts       — CRUD + queries cho bài viết; export newsKeys
    banner-api.ts     — CRUD + queries cho banners; export bannerKeys
    contact-api.ts    — Mutation gửi feedback/liên hệ

  components/
    ProductPickerModal.tsx    — Modal tìm kiếm + chọn sản phẩm embed vào bài viết (chỉ dùng trong admin editor)

  pages/
    NewsListPage.tsx   — /news: grid bài viết với search, filter theo category, pagination
    NewsDetailPage.tsx — /news/:slug: full bài viết rich text + related articles
    ContactPage.tsx    — /contact: form liên hệ (tên, email, điện thoại?, chủ đề, nội dung)

  types/
    news.types.ts      — News, NewsFilters, NewsResponse, SingleNewsResponse interfaces

  index.ts             — Barrel export
```

---

# 3. State Management

## 3.1 Server state (React Query)

Query keys từng api file:

```typescript
// news-api.ts
export const newsKeys = {
  all: ['news'] as const,
  lists: () => [...newsKeys.all, 'list'] as const,
  list: (filters: unknown) => [...newsKeys.lists(), filters] as const,
  details: () => [...newsKeys.all, 'detail'] as const,
  detail: (id: string) => [...newsKeys.details(), id] as const,
  slug: (slug: string) => [...newsKeys.all, 'slug', slug] as const,
  related: (slug: string) => [...newsKeys.all, 'related', slug] as const,
};

// banner-api.ts
export const bannerKeys = {
  all: ['banners'] as const,
  lists: () => [...bannerKeys.all, 'list'] as const,
  list: (params: unknown) => [...bannerKeys.lists(), params] as const,
};
```

## 3.2 Client state (Zustand)

Không dùng Zustand stores.

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                       | Mô tả                                                           |
| ------ | -------------------------- | --------------------------------------------------------------- |
| GET    | `/news`                    | Danh sách bài viết (page, limit, search, category, isPublished) |
| GET    | `/news/:id`                | Chi tiết bài viết theo ID                                       |
| GET    | `/news/slug/:slug`         | Chi tiết bài viết theo slug                                     |
| GET    | `/news/slug/:slug/related` | Bài viết liên quan                                              |
| POST   | `/news`                    | Admin: tạo bài viết mới                                         |
| PUT    | `/news/:id`                | Admin: cập nhật bài viết                                        |
| DELETE | `/news/:id`                | Admin: xóa bài viết                                             |
| GET    | `/banners`                 | Danh sách banners (position?, isActive?)                        |
| POST   | `/banners`                 | Admin: tạo banner                                               |
| PATCH  | `/banners/:id`             | Admin: cập nhật banner (PATCH không phải PUT)                   |
| DELETE | `/banners/:id`             | Admin: xóa banner                                               |
| POST   | `/contact/feedback`        | Gửi form liên hệ/feedback                                       |

## 4.2 Query hooks

**Queries:**

- `useGetNewsQuery(params?)` — danh sách bài viết, params: `{ page?, limit?, search?, category?, isPublished? }`
- `useGetNewsByIdQuery(id)` — chi tiết theo ID
- `useGetNewsBySlugQuery(slug)` — chi tiết theo slug (dùng trong `NewsDetailPage`)
- `useGetRelatedNewsQuery(slug)` — bài viết liên quan (dùng trong `NewsDetailPage`)
- `useGetBannersQuery(params?)` — banners theo position/isActive

**Mutations:**

- `useCreateNewsMutation()` — tạo bài viết (admin)
- `useUpdateNewsMutation()` — cập nhật bài viết; invalidate `newsKeys.all` + `newsKeys.detail(id)`
- `useDeleteNewsMutation()` — xóa bài viết
- `useCreateBannerMutation()` — tạo banner (admin)
- `useUpdateBannerMutation()` — cập nhật banner với PATCH (admin)
- `useDeleteBannerMutation()` — xóa banner (admin)
- `useSendFeedbackMutation()` — gửi form liên hệ; body: `{ name, email, phone?, subject, content }`

---

# 5. Components chính

| Component            | Mô tả                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `NewsListPage`       | Grid bài viết: search input, filter tabs theo category, pagination. Load `useGetNewsQuery`.                       |
| `NewsDetailPage`     | Full bài viết với rich text HTML (sanitize qua `DOMPurify`), breadcrumb, related articles carousel bên dưới.      |
| `ContactPage`        | Form liên hệ: tên, email, điện thoại (optional), chủ đề, nội dung. Dùng `useSendFeedbackMutation`.                |
| `ProductPickerModal` | Modal admin-only: tìm kiếm sản phẩm + embed link vào nội dung bài viết. **Không render trong user-facing pages.** |

---

# 6. Types

```typescript
// types/news.types.ts
interface News {
  id: string;
  title: string;
  slug: string;
  content: string; // HTML từ rich text editor
  thumbnail?: string;
  description?: string;
  category: string;
  viewCount: number;
  tags?: string;
  isPublished: boolean;
  userId: string;
  author?: User;
  createdAt: string;
  updatedAt: string;
}
interface NewsFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isPublished?: boolean;
}
interface NewsResponse {
  status: 'success' | 'error';
  count: number;
  totalPages: number;
  currentPage: number;
  news: News[];
}
interface SingleNewsResponse {
  status: 'success' | 'error';
  news: News;
}

// banner-api.ts (inline types)
interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'home_hero' | 'home_middle' | 'sidebar';
  isActive: boolean;
  priority: number;
}

// contact-api.ts (inline types)
interface FeedbackRequest {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  content: string;
}
```

---

# 7. Dependencies

## 7.1 Depends on

- `DOMPurify` — sanitize HTML trong `NewsDetailPage` (`dangerouslySetInnerHTML`)
- `dayjs` — format ngày trong `NewsDetailPage`, `NewsListPage`

## 7.2 Used by

- `features/admin/pages/content/BannersPage.tsx` — `useGetBannersQuery`, `useCreateBannerMutation`, `useUpdateBannerMutation`, `useDeleteBannerMutation`
- `features/admin/pages/content/NewsPage.tsx` — `useGetNewsQuery`, `useDeleteNewsMutation`
- `features/admin/pages/content/CreateNewsPage.tsx` — `useCreateNewsMutation`, `ProductPickerModal`
- `src/pages/HomePage.tsx` — `useGetBannersQuery({ position: 'home_hero' })` để lấy banner hero
- `src/components/common/FeedbackModal.tsx` — `useSendFeedbackMutation` (dùng cùng mutation với ContactPage)

---

# 8. Gotchas & Edge Cases

- **`ProductPickerModal`** là component thuần admin — không render trong user-facing pages. Nếu thấy import trong user context → bug.
- **Rich text HTML** trong `NewsDetailPage` render qua `dangerouslySetInnerHTML` + `DOMPurify.sanitize()` — backend đã sanitize trước khi lưu nhưng FE vẫn sanitize lần nữa để phòng ngừa.
- **Banners** query tại điểm dùng (không global store) — `HomePage` gọi `useGetBannersQuery({ position: 'home_hero', isActive: true })` trực tiếp.
- **`useSendFeedbackMutation`** dùng cho cả `ContactPage` và `FeedbackModal` trong `src/components/common/` — hai nơi dùng cùng mutation, cùng endpoint.
- **`useUpdateBannerMutation` dùng PATCH** — khác với `useUpdateNewsMutation` dùng PUT.
- **Admin pages** cho news/banner nằm trong `features/admin/pages/content/`, không phải trong feature này.
- **`useGetRelatedNewsQuery`** nhận `slug` (không phải ID) — endpoint `GET /news/slug/:slug/related`.
- **Category filter** trong `NewsListPage` dùng string category name (không phải ID) — `params.category !== 'Tất cả'` mới append vào query.

---

# 9. Tests

- `frontend/src/__tests__/features/content/` — component tests NewsListPage, NewsDetailPage, ContactPage
- `backend/__tests__/modules/content/` — unit tests news/banner service
- `backend/__api__/content.api.test.js` — API HTTP tests
