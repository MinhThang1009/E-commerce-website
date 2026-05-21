# Content Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern (Multi-Mount)](#12-di-pattern-multi-mount)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Banner management](#31-banner-management)
  - [3.2 News management](#32-news-management)
  - [3.3 Contact/Feedback](#33-contactfeedback)
  - [3.4 Business rules](#34-business-rules)
- [4. API Endpoints](#4-api-endpoints)
  - [4.1 Banners (`/api/banners`)](#41-banners-apibanners)
  - [4.2 News (`/api/news`)](#42-news-apinews)
  - [4.3 Contact (`/api/contact`)](#43-contact-apicontact)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Quản lý nội dung marketing và tương tác khách hàng: banner quảng cáo (có `position`, `priority`, `isActive`), bài tin tức (draft/published với `viewCount`, `slug`, tác giả), và form phản hồi/liên hệ từ khách hàng (gửi email thông báo cho admin).

## 1.2 DI Pattern (Multi-Mount)

Module dùng multi-mount pattern — trả về `mounts` array (giống `catalog`):

```js
// module.js
return {
  mounts: [
    { basePath: '/banners', router: routes.banner },
    { basePath: '/news', router: routes.news },
    { basePath: '/contact', router: routes.contact },
  ],
};
```

`routes.js` là **single file** (không phải thư mục `routes/`) export `{ banner, news, contact }`. Models inject qua DI: `Banner`, `News`, `Feedback`, `User`.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/content/
  module.js
  routes.js                              — single file, export { banner, news, contact }
  controllers/
    content-controller.js                — handlers cho cả 3 sub-domain
  services/
    content-service.js                   — ~265 lines: CRUD + slug generation + email notify
  repositories/
    sequelize-content-repository.js      — CRUD Banner, News, Feedback với filter
    i-content-repository.js              — interface (abstract base)
  validators/
    content-validator.js                 — Zod: createBannerSchema, updateBannerSchema, createNewsSchema, updateNewsSchema, feedbackSchema
  dtos/
    content-dto.js                       — pass-through DTOs
  CLAUDE.md
```

---

# 3. Business Logic Chính

## 3.1 Banner management

- `getAllBanners({ position, isActive })` — filter theo `position` và `isActive` qua DB WHERE. Cache `banners:active` (TTL 1 giờ) chỉ khi query `isActive=true` và không có `position` filter. Order: `priority DESC, createdAt DESC`.
- `getBannerById(id)`, `createBanner(data)`, `updateBanner(id, patch)`, `deleteBanner(id)`
- Write operations đều gọi `_invalidateBannerCache()` → xóa `banners:active`

## 3.2 News management

- `getAllNews({ page, limit, search, isPublished, category })` — phân trang. Cache `news:list:{page}:{limit}:{isPublished}:{category}:{search}` (TTL 15 phút) nhưng **skip cache** khi có `search` (tránh cache miss cho free-text). Include `author` (User model, as: `'author'`).
- `getNewsBySlug(slug)` — lấy theo slug, gọi `incrementNewsView(news)` (tăng `viewCount`). Cache `news:detail:{slug}` (TTL 30 phút). Kể cả khi trả cache vẫn increment view (fetch lại news để increment).
- `getNewsById(id)` — không cache, không increment (dành cho admin).
- `getRelatedNews(slug)` — lấy 3 tin cùng `categoryVi`; nếu thiếu → bổ sung bằng tin mới nhất.
- `createNews({ userId, payload })` — auto-generate slug từ title nếu không truyền: normalize dấu tiếng Việt → kebab-case → `${slug}-${Date.now().toString(36)}`. Nếu truyền slug thủ công → kiểm tra unique.
- `updateNews(id, patch)` — nếu đổi slug → kiểm tra unique trước.
- `deleteNews(id)` — soft-check tồn tại, xóa hard.

## 3.3 Contact/Feedback

- `sendFeedback({ payload })` — validate `name`, `email`, `subject`, `content` (required). Tạo `Feedback` record với `status: 'pending'`. Gửi email thông báo đến `adminEmail` fire-and-forget (lỗi email chỉ log warn, không fail request).

## 3.4 Business rules

- **Slug news**: Tự generate nếu không truyền. Format: `${kebab-slug}-${Date.now().toString(36)}`. Không dùng pattern `-2`, `-3`.
- **viewCount**: Tăng mỗi lần `GET /news/slug/:slug`. Endpoint `GET /news/:id` KHÔNG tăng — chỉ dành cho admin lookup.
- **Banner cache**: Cache chỉ khi `isActive=true` không có position filter (`cacheKey = isActiveOnlyQuery ? 'banners:active' : null`).
- **News cache**: Skip cache khi có `search` param — free-text không cache.
- **News draft**: `isPublished = false` → không hiển thị trong `getAllNews` public (filter trong DB WHERE).
- **Feedback email**: Gửi đến `adminEmail` inject từ DI hoặc `process.env.ADMIN_EMAIL`. Fail silent nếu không có.

---

# 4. API Endpoints

## 4.1 Banners (`/api/banners`)

Routes dùng `banner.use(authenticate)` + `banner.use(authorize('admin'))` sau GET endpoints — tất cả write routes kế thừa middleware này.

| Method | Path   | Auth                              | Cache HTTP | Mô tả                                           |
| ------ | ------ | --------------------------------- | ---------- | ----------------------------------------------- |
| GET    | `/`    | —                                 | 900s       | Danh sách banners (tham số: position, isActive) |
| GET    | `/:id` | —                                 | 900s       | Chi tiết banner                                 |
| POST   | `/`    | authenticate + authorize('admin') | —          | Tạo banner mới                                  |
| PATCH  | `/:id` | authenticate + authorize('admin') | —          | Cập nhật banner                                 |
| DELETE | `/:id` | authenticate + authorize('admin') | —          | Xóa banner                                      |

> Banner dùng `PATCH` (không phải `PUT`) — khác với news.

## 4.2 News (`/api/news`)

| Method | Path                  | Auth                              | Mô tả                                                                             |
| ------ | --------------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| GET    | `/`                   | —                                 | Danh sách tin tức published (tham số: page, limit, search, isPublished, category) |
| GET    | `/slug/:slug`         | —                                 | Chi tiết theo slug (tăng viewCount)                                               |
| GET    | `/slug/:slug/related` | —                                 | Tin tức liên quan cùng category                                                   |
| GET    | `/:id`                | —                                 | Chi tiết theo ID (không tăng viewCount)                                           |
| POST   | `/`                   | authenticate + authorize('admin') | Tạo bài tin tức (validate 422)                                                    |
| PUT    | `/:id`                | authenticate + authorize('admin') | Cập nhật bài tin tức (validate 422)                                               |
| DELETE | `/:id`                | authenticate + authorize('admin') | Xóa bài tin tức                                                                   |

## 4.3 Contact (`/api/contact`)

| Method | Path        | Auth | Mô tả                                    |
| ------ | ----------- | ---- | ---------------------------------------- |
| POST   | `/feedback` | —    | Gửi form phản hồi/liên hệ (validate 422) |

---

# 5. Dependencies

## 5.1 Depends on

- Models inject từ app.js: `Banner`, `News`, `Feedback`, `User`
- `emailService` — `sendAdminFeedbackNotification` (wrap qua `emailGateway` adapter inline trong `module.js`)
- `redisClient` — cache factory async (optional, null → cacheStore null)
- `eventBus`, `logger`
- `adminEmail` — từ DI inject hoặc `process.env.ADMIN_EMAIL`

## 5.2 Used by

- `admin` — content management: CRUD banners, news (qua admin routes)
- Frontend public pages — hiển thị banners, tin tức, form liên hệ

---

# 6. Gotchas & Edge Cases

- **Banner dùng `PATCH` không phải `PUT`**: `PATCH /:id` — khác với news (`PUT /:id`). Đừng nhầm khi test.
- **`routes.js` là single file**: Export object `{ banner, news, contact }` — KHÔNG có thư mục `routes/`.
- **Banner auth middleware chain**: `banner.use(authenticate)` + `banner.use(authorize('admin'))` apply cho tất cả routes phía sau — không phải per-route. GET đứng trước `use()` nên public.
- **viewCount bypass cache**: `getNewsBySlug` cache response nhưng vẫn fetch DB để gọi `incrementNewsView`. Nếu refactor cache phải giữ increment logic.
- **News search skip cache**: `!search` là condition để cache — khi có `search` không cache tránh explosion cache keys.
- **Slug timestamp suffix dùng `Date.now().toString(36)`**: Không phải decimal. Collision lý thuyết có thể xảy ra nếu 2 bài tạo đúng cùng millisecond.
- **`adminEmail` fail silent**: Email failure chỉ log error, request vẫn trả 200. Không re-throw.
- **`content-dto.js` có `toCampaignDto`**: Dead code — `EmailCampaign` model đã bị drop hoàn toàn. KHÔNG reference.
- **`Banner.findAllBanners` order**: `priority DESC, createdAt DESC` — banner có priority cao hơn hiển thị trước. Không revert order này.
- **`getRelatedNews` fallback**: Nếu không đủ 3 tin cùng category → bổ sung từ `findLatestNews(excludeIds)`. Không bao giờ trả `null` (luôn trả array).

---

# 7. Tests

| File                                             | Loại | Mô tả                                             |
| ------------------------------------------------ | ---- | ------------------------------------------------- |
| `services/content-service.test.js`               | Unit | Service logic: CRUD, slug gen, cache invalidation |
| `controllers/content-controller.test.js`         | Unit | HTTP layer: banner, news, feedback                |
| `controllers/content-controller.contact.test.js` | Unit | Feedback/contact edge cases                       |
| `validators/content-validator.test.js`           | Unit | Zod schema validation                             |
| `repositories/content-repository.test.js`        | Unit | Repository queries                                |
