# Content Feature — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Routes](#12-routes)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. State Management](#3-state-management)
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

Xử lý contact/feedback form. News, banner và admin pages tương ứng đã bị xóa cùng với backend modules — feature này chỉ còn `ContactPage` và mutation gửi feedback. `FeedbackModal` trong `src/components/common/` dùng chung mutation với `ContactPage`.

## 1.2 Routes

| Route      | Page          |
| ---------- | ------------- |
| `/contact` | `ContactPage` |

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/content/
  api/
    contact-api.ts    — Mutation gửi feedback/liên hệ; export useSendFeedbackMutation

  pages/
    ContactPage.tsx   — /contact: form liên hệ (tên, email, điện thoại?, chủ đề, nội dung)

  index.ts            — Barrel export
```

---

# 3. State Management

Không dùng TanStack Query queries hay Zustand stores — chỉ có 1 mutation (fire-and-forget).

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                | Mô tả                     |
| ------ | ------------------- | ------------------------- |
| POST   | `/contact/feedback` | Gửi form liên hệ/feedback |

## 4.2 Query hooks

**Mutations:**

- `useSendFeedbackMutation()` — gửi form liên hệ; body: `{ name, email, phone?, subject, content }`

---

# 5. Components chính

| Component     | Mô tả                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `ContactPage` | Form liên hệ: tên, email, điện thoại (optional), chủ đề, nội dung. Dùng `useSendFeedbackMutation`. |

---

# 6. Types

```typescript
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

Không có external dependency ngoài `api-client`.

## 7.2 Used by

- `src/components/common/FeedbackModal.tsx` — dùng `useSendFeedbackMutation` (cùng mutation với ContactPage)

---

# 8. Gotchas & Edge Cases

- **`useSendFeedbackMutation`** dùng cho cả `ContactPage` và `FeedbackModal` trong `src/components/common/` — hai nơi dùng cùng mutation, cùng endpoint.
- **News, banner, admin content pages đã xóa**: `NewsListPage`, `NewsDetailPage`, `news-api.ts`, `banner-api.ts`, `features/admin/pages/content/` (BannersPage, NewsPage, CreateNewsPage) đã bị xóa cùng với backend modules. Không tạo lại.

---

# 9. Tests

- `frontend/src/__tests__/features/content/` — component tests ContactPage
- `backend/__tests__/modules/content/` — unit tests content service
- `backend/__api__/content.api.test.js` — API HTTP tests
