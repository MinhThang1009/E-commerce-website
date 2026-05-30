# Reviews Feature — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
- [3. State Management](#3-state-management)
- [4. API Calls](#4-api-calls)
- [5. Components chính](#5-components-chính)
- [6. Types](#6-types)
- [7. Dependencies](#7-dependencies)
- [8. Gotchas & Edge Cases](#8-gotchas--edge-cases)
- [9. Tests](#9-tests)

---

# 1. Mục đích & Trách nhiệm

Hiển thị đánh giá sản phẩm (rating summary, danh sách với pagination, filter), cho phép user tạo/sửa/xóa đánh giá. Không có route/page riêng — toàn bộ là embedded components. `ReviewModal` được export cho `OrdersPage` (orders feature) — đây là cross-feature import được phép duy nhất trong dự án.

---

# 2. Cấu trúc Files

```
api/
  review-api.ts        — TanStack Query hooks (reviewKeys là const nội bộ, không export)

components/
  ReviewSection.tsx    — Container chính — embed vào ProductDetailPage (catalog feature)
  ProductReviews.tsx   — Wrapper: ReviewSummary + ReviewList
  ReviewSummary.tsx    — Rating trung bình + bar chart phân phối theo từng sao (1-5)
  ReviewList.tsx       — Render danh sách review items có pagination
  ReviewForm.tsx       — Form tạo đánh giá: rating (1-5 sao), title, comment. Chỉ hiện khi authenticated
  ReviewModal.tsx      — Modal wrapper cho ReviewForm — export cho OrdersPage

types/
  review.types.ts      — Review interface (dùng trong components)

index.ts               — Barrel export
```

---

# 3. State Management

## Server state (TanStack Query)

```typescript
// const nội bộ trong review-api.ts — KHÔNG export ra barrel
const reviewKeys = {
  all: ['reviews'] as const,
  product: (productId: string) => [...reviewKeys.all, 'product', productId] as const,
  productFiltered: (productId: string, filters: ReviewFilters) =>
    [...reviewKeys.product(productId), filters] as const,
  user: (params?: { page?: number; limit?: number }) =>
    [...reviewKeys.all, 'user', params] as const,
};
```

## Client state (Zustand)

---

# 4. API Calls

## Queries

| Hook                                        | Endpoint                                                         | Mô tả                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `useGetProductReviewsQuery(args, options?)` | `GET /api/reviews/product/:productId?page=&limit=&rating=&sort=` | Danh sách đánh giá của sản phẩm với filter. Enabled khi `productId` có giá trị và không phải `'undefined'`. |

`args` của `useGetProductReviewsQuery`:

```typescript
type Args = { productId: string } & ReviewFilters;
// ReviewFilters: page?, limit?, rating?, verified?, withImages?, sort?
// sort: 'newest' | 'oldest' | 'highest_rating' | 'lowest_rating'
```

## Mutations

| Hook                        | Endpoint            | Mô tả                                                                                           |
| --------------------------- | ------------------- | ----------------------------------------------------------------------------------------------- |
| `useCreateReviewMutation()` | `POST /api/reviews` | Tạo đánh giá — invalidate `reviewKeys.product(productId)` + `['products', 'detail', productId]` |

`useCreateReviewMutation` payload:

```typescript
interface CreateReviewData {
  productId: string;
  rating: number; // 1–5
  title: string;
  comment: string;
  images?: string[];
}
```

---

# 5. Components chính

## Pages

Không có pages riêng — toàn bộ là components embedded.

## Components

| Component        | Dùng bởi                          | Mô tả                                                                                                                                                                                     |
| ---------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ReviewSection`  | `ProductDetailPage` (catalog)     | Container chính. Quản lý state hiển thị form (toggle `showReviewForm`). Wrap `ReviewForm` + `ReviewList`. `refreshKey` để force re-render list sau submit thành công.                     |
| `ProductReviews` | Có thể embed trực tiếp            | Wrapper chứa `ReviewSummary` + `ReviewList`.                                                                                                                                              |
| `ReviewSummary`  | `ProductReviews`                  | Hiển thị rating trung bình + thanh phân phối 5 sao (horizontal bar chart).                                                                                                                |
| `ReviewList`     | `ReviewSection`, `ProductReviews` | Danh sách review items có pagination, filter sort/rating.                                                                                                                                 |
| `ReviewForm`     | `ReviewSection`                   | Form tạo đánh giá standalone. Validate: rating ≥ 1; title: 5–100 chars; comment: 10–1000 chars. Hiện message "cần đăng nhập" nếu `!isAuthenticated`.                                      |
| `ReviewModal`    | `OrdersPage` (cross-feature)      | Modal wrapper cho review form. Dùng `Modal` component từ common. Validate: rating ≥ 1; comment required. Footer với Cancel + Submit buttons. `onSuccess` callback để caller refresh data. |

---

# 6. Types

**Cảnh báo: Có 2 `Review` type không tương thích trong feature này.**

```typescript
// types/review.types.ts — dùng trong components
interface Review {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string; // Field "comment"
  isVerifiedPurchase: boolean; // Field "isVerifiedPurchase"
  likes: number;
  dislikes: number;
  createdAt: string;
  updatedAt: string;
}

// api/review-api.ts — API response shape (khác với types/)
interface Review {
  id: string;
  productId: string;
  userId: string;
  user: { id: string; firstName: string; lastName: string; avatar?: string };
  // KHÔNG có "userName" — dùng user.firstName + user.lastName
  rating: number;
  title: string;
  content: string; // Field "content" (KHÁC với "comment")
  isVerified: boolean; // Field "isVerified" (KHÁC với "isVerifiedPurchase")
  images?: string[];
  likes: number;
  dislikes: number;
  createdAt: string;
  updatedAt: string;
}

// Khi access reviews từ API response → dùng .content, .isVerified, .user.firstName
// Khi dùng trong components với types/ → dùng .comment, .isVerifiedPurchase, .userName
```

`ReviewsResponse` (api):

```typescript
interface ReviewsResponse {
  data: {
    reviews: Review[];
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}
```

`ReviewsResponse` (types/):

```typescript
interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  ratingsSummary: {
    average: number;
    count: number;
    distribution: { 1: n; 2: n; 3: n; 4: n; 5: n };
  };
}
```

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `components/common/Modal` — `ReviewModal`
- `components/common/Rating` — `Rating` component (interactive 5-star) trong `ReviewModal`
- `components/common/PremiumButton` — submit/cancel buttons
- `hooks/use-notifications` — toast trong `ReviewForm`, `ReviewModal`
- `stores/auth-store` — check `isAuthenticated`
- `utils/error-utils` — `getErrorMsg()`

**Feature này được dùng bởi:**

- `features/catalog` — `ProductDetailPage` import `ReviewSection`
- `features/orders` — `OrdersPage` import `ReviewModal` (cross-feature import được phép)

---

# 8. Gotchas & Edge Cases

- **2 `Review` type không tương thích:** `types/review.types.ts` dùng `comment` + `isVerifiedPurchase` + `userName`; `api/review-api.ts` dùng `content` + `isVerified` + `user.firstName`. Xác định đang ở tầng nào trước khi đọc code.
- **`useCreateReviewMutation` invalidate 2 query keys** — cả `reviewKeys.product(productId)` lẫn `['products', 'detail', productId]` để cập nhật rating summary trên product card.
- **`ReviewModal` là cross-feature import** từ `OrdersPage` (orders → reviews) — pattern hợp lệ duy nhất của dự án. Không tạo thêm cross-feature imports khác.
- **`useGetProductReviewsQuery` guard `productId !== 'undefined'`** — tránh gọi API khi component chưa nhận được productId từ route params.
- **Không có `useVoteReview` hook** — nếu cần thêm vote (like/dislike), phải tạo hook mới trong `review-api.ts`.
- **`ReviewForm` validation client-side:** title 5–100 chars; comment 10–1000 chars. Server có validation riêng — đừng bỏ validate client.
- **`refreshKey` trong `ReviewSection`** — `useState(0)`, increment sau submit thành công → force remount `ReviewList` → fetch lại. Pattern này bypass TanStack Query để đảm bảo hiển thị review mới nhất ngay.

---

# 9. Tests

- `frontend/src/__tests__/catalog-detail-pages.test.tsx` — ProductDetail page bao gồm review section
- `frontend/src/__tests__/cart-orders-pages.test.tsx` — ReviewModal từ OrdersPage
