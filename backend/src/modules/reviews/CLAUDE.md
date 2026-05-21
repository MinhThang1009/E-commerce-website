# Reviews Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 createReview](#31-createreview)
  - [3.2 updateReview](#32-updatereview)
  - [3.3 deleteReview](#33-deletereview)
  - [3.4 verifyReview (admin)](#34-verifyreview-admin)
  - [3.5 getProductReviews (public)](#35-getproductreviews-public)
  - [3.6 \_refreshProductRating (helper)](#36-_refreshproductrating-helper)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Cho phép khách hàng đã mua hàng đánh giá sản phẩm. Enforce **verified purchase**: chỉ user có `OrderItem` với `productId` tương ứng và `Order.status = 'delivered'` mới được tạo review. Sau mỗi thao tác CRUD, `Product.rating` và `Product.reviewCount` được tính lại ngay lập tức. Admin có thể toggle `isVerified` để duyệt/từ chối review.

## 1.2 DI Pattern

DI đầy đủ:

```js
const repo = new SequelizeReviewsRepository({ Review, Product, User, Order, OrderItem });
const service = new ReviewsService({ reviewsRepository: repo, eventBus, logger });
const controller = new ReviewsController({ reviewsService: service });
```

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/reviews/
  module.js                                    — factory DI
  routes.js                                    — 7 routes
  controllers/
    reviews-controller.js
    reviews-controller.test.js
  services/
    reviews-service.js                         — ~178 lines
    reviews-service.test.js
    reviews-service.unit.test.js
    reviews-service.edge-cases.test.js
  repositories/
    i-reviews-repository.js
    sequelize-reviews-repository.js
    reviews-repository.test.js
  validators/
    reviews-validator.js                       — reviewSchema: productId, rating (1-5 int), title, comment, images[]
  dtos/
    reviews-dto.js
```

---

# 3. Business Logic Chính

## 3.1 createReview

```
1. findProductById(productId)  → 404 nếu không tồn tại
2. hasUserPurchasedProduct(userId, productId):
   JOIN Order (status='delivered') + OrderItem (productId)
   → 403 nếu chưa mua
3. findReviewByUserAndProduct(userId, productId):
   - Nếu đã có review → update (upsert behavior, KHÔNG báo lỗi duplicate)
   - Nếu chưa có → createReview()
   Set isVerified = true khi create/update
4. findReviewByPkWithUser(review.id)  ← reload với User data
5. _refreshProductRating(productId)   ← cập nhật Product.rating + reviewCount
```

## 3.2 updateReview

Chỉ owner mới update. `findReviewByIdAndUserId(reviewId, userId)` → 404 nếu không tìm thấy (bao gồm cả trường hợp không phải owner). Sau update → `_refreshProductRating()`.

Fields có thể update: `rating`, `title`, `content` (từ `comment`), `images`. `isVerified` luôn được set `true` sau update.

## 3.3 deleteReview

Chỉ owner mới delete. `findReviewByIdAndUserId(reviewId, userId)` — không có admin-delete endpoint. Sau delete → `_refreshProductRating()`.

## 3.4 verifyReview (admin)

Toggle `review.isVerified = true/false`. Không ảnh hưởng đến `Product.rating` hay `Product.reviewCount`.

## 3.5 getProductReviews (public)

Paginated. Query params: `page`, `limit`, `sort`, `rating` (filter), `verified` (filter).

Sort options:

- `newest` (default): `createdAt DESC`
- `oldest`: `createdAt ASC`
- `highest_rating`: `rating DESC`
- `lowest_rating`: `rating ASC`

## 3.6 \_refreshProductRating (helper)

Private helper, gọi sau mỗi CREATE/UPDATE/DELETE:

```js
const reviews = await Review.findAll({ where: { productId }, attributes: ['rating'] });
const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
Product.update({ rating: avg, reviewCount: reviews.length }, { where: { id: productId } });
```

Tính trực tiếp từ tất cả reviews — không dùng SQL AVG(). Nếu `reviews.length === 0` → `{ avg: 0, count: 0 }`.

---

# 4. API Endpoints

Base path: `/api/reviews`

| Method | Path                  | Auth                              | Mô tả                                                |
| ------ | --------------------- | --------------------------------- | ---------------------------------------------------- |
| GET    | `/product/:productId` | — (public)                        | Danh sách reviews của sản phẩm (paginated)           |
| GET    | `/user`               | authenticate                      | Reviews của user hiện tại (paginated)                |
| POST   | `/`                   | authenticate                      | Tạo review (upsert nếu đã có review cho sản phẩm đó) |
| PUT    | `/:id`                | authenticate                      | Cập nhật review (chỉ owner)                          |
| DELETE | `/:id`                | authenticate                      | Xóa review (chỉ owner)                               |
| GET    | `/admin/all`          | authenticate + authorize('admin') | Tất cả reviews (có filter `?verified=true/false`)    |
| PATCH  | `/admin/:id/verify`   | authenticate + authorize('admin') | Toggle `isVerified`                                  |

**Query params `GET /product/:productId`:** `page`, `limit`, `sort` (newest/oldest/highest_rating/lowest_rating), `rating` (1-5), `verified` (true/false)

**Body `POST /` và `PUT /:id`:** `{ productId, rating: 1-5, title, comment, images?: string[] }` — validated bởi `reviewSchema`

**Body `PATCH /admin/:id/verify`:** `{ isVerified: boolean }`

---

# 5. Dependencies

## 5.1 Depends on

Inject từ `app.js`:

- **Models:** `Review`, `Product`, `User`, `Order`, `OrderItem`
- **eventBus, logger** (inject nhưng service chưa dùng)

`Order` và `OrderItem` cần để verify purchase trong repository — cross-model read shortcut, không gọi orders service.

## 5.2 Used by

- `catalog` — đọc `Product.rating` và `Product.reviewCount` để hiển thị (được update bởi `_refreshProductRating`)
- `admin` — review moderation UI

---

# 6. Gotchas & Edge Cases

- **`createReview` là upsert:** Nếu user đã review sản phẩm → update review cũ thay vì báo duplicate. Không có unique constraint enforced tại service layer.
- **Order status phải là `delivered`:** `processing` hay `shipped` chưa đủ điều kiện review. `hasUserPurchasedProduct` join `Order` với `where status = 'delivered'`.
- **`isVerified` vs `isHidden`:** Hai fields độc lập. `isVerified = false` → hiện nhưng không có badge "Verified Purchase". Giá trị `isVerified` mặc định khi user tạo/update là `true`.
- **`avgRating` update sau mỗi review CRUD:** `_refreshProductRating()` gọi inline trong service, không qua model hooks. Nếu `rating` sai trên Product → kiểm tra xem có code path nào bỏ qua `_refreshProductRating` không.
- **Không có `GET /check-purchased` endpoint:** FE xác định "đã mua" bằng cách thử `POST /` — service trả 403 nếu chưa mua. Không thêm endpoint check riêng.
- **Admin không thể delete review qua HTTP:** `deleteReview` service tìm `findReviewByIdAndUserId` — admin không có userId khớp → 404. Admin delete phải xử lý direct DB hoặc thêm endpoint riêng.
- **`_refreshProductRating` dùng in-memory AVG:** Load tất cả ratings của product rồi tính JS. Với product có nhiều reviews → xem xét dùng SQL AVG() nếu performance issue.

---

# 7. Tests

| File                                              | Loại        | Mô tả                                   |
| ------------------------------------------------- | ----------- | --------------------------------------- |
| `services/reviews-service.test.js`                | Unit        | Happy path: create, update, delete, get |
| `services/reviews-service.unit.test.js`           | Unit        | Isolated unit tests                     |
| `services/reviews-service.edge-cases.test.js`     | Unit        | Edge cases: upsert, purchase check      |
| `controllers/reviews-controller.test.js`          | Unit        | HTTP layer                              |
| `repositories/reviews-repository.test.js`         | Unit        | Repository queries                      |
| `src/__integration__/reviews.integration.test.js` | Integration | DB integration                          |
| `src/__api__/reviews.api.test.js`                 | HTTP        | End-to-end HTTP                         |
