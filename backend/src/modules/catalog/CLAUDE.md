# Catalog Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern (Multi-Mount)](#12-di-pattern-multi-mount)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 Product listing và filter](#31-product-listing-và-filter)
  - [3.2 Product detail và variant resolution](#32-product-detail-và-variant-resolution)
  - [3.3 Specialized product queries](#33-specialized-product-queries)
  - [3.4 Category và Brand](#34-category-và-brand)
  - [3.5 Business rules](#35-business-rules)
- [4. API Endpoints](#4-api-endpoints)
  - [4.1 Products (`/api/products`)](#41-products-apiproducts)
  - [4.2 Categories (`/api/categories`)](#42-categories-apicategories)
  - [4.3 Brands (`/api/brands`)](#43-brands-apibrands)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on](#51-depends-on)
  - [5.2 Used by](#52-used-by)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Module lớn nhất codebase. Cung cấp toàn bộ catalog API: danh sách/lọc/tìm kiếm sản phẩm (READ), cây danh mục, thương hiệu, sản phẩm đã xem gần đây (recently-viewed), CRUD Category/Brand. Gộp 3 sub-domain: Category, Brand, Product thành 1 module duy nhất. (Product WRITE đã gỡ — qua `admin` module `/api/admin/products`.)

## 1.2 DI Pattern (Multi-Mount)

Module trả về `mounts` array thay vì 1 router duy nhất — pattern đặc biệt, **chỉ catalog dùng** (content và các module khác dùng single router bình thường):

```js
// module.js
return {
  mounts: [
    { basePath: '/categories', router: routes.categories },
    { basePath: '/brands', router: routes.brands },
    { basePath: '/products', router: routes.products },
  ],
  subscribeEvents() {},
};
```

`app.js` iterate qua `mounts` khi mount. Models inject qua DI: `Category`, `Brand`, `Product`, `ProductAttribute`, `ProductVariant`, `ProductSpecification`, `ProductImage`, `Review`, `RecentlyViewed`.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/catalog/
  module.js
  routes.js                              — single file, export { categories, brands, products }
  controllers/
    catalog-controller.js                — ~333 lines: handlers cho cả 3 sub-domain
  services/
    catalog-service.js                   — Orchestrator (26 lines): class CatalogService + mixin pattern
    catalog-category-methods.js          — Category methods: list, tree, CRUD, slug lookup (142 lines)
    catalog-brand-methods.js             — Brand methods: list, CRUD, slug lookup (84 lines)
    catalog-product-methods.js           — Product methods: list, detail, filter, search (READ-only; write đã gỡ)
  repositories/
    sequelize-catalog-repository.js      — ~750 lines: complex joins + aggregation queries
    i-catalog-repository.js              — interface (abstract base)
  validators/
    catalog-validator.js                 — Zod schemas: categorySchema, createBrandSchema, updateBrandSchema, productSchema
  dtos/
    catalog-dto.js                       — pass-through DTOs (service đã shape data)
  CLAUDE.md
```

> `routes.js` là **single file** không phải thư mục — export object `{ categories, brands, products }`.

> **Pattern:** `catalog-service.js` định nghĩa class `CatalogService` (constructor + constant `RECENTLY_VIEWED_MAX`), sau đó mix methods vào prototype: `Object.assign(CatalogService.prototype, categoryMethods, brandMethods, productMethods)`. Mixin files export plain objects chứa methods — `this` trong mỗi method trỏ đến instance CatalogService (có `this.catalogRepository`, `this.eventBus`, `this.logger`). Khi sửa logic, sửa file mixin tương ứng, không sửa `catalog-service.js`.

---

# 3. Business Logic Chính

## 3.1 Product listing và filter

**`getAllProducts({ page, limit, sort, order, category, brand, search, minPrice, maxPrice, inStock, featured, status })`**:

- `category` chấp nhận cả slug lẫn numeric ID — service resolve slug → id trước khi query
- `brand` chấp nhận array, mix slug và id
- `inStock` filter dùng subquery: `SELECT DISTINCT product_id FROM product_variants WHERE stock_quantity > 0` — không dùng `Product.stockQuantity`
- Sort bằng `COALESCE(MIN(pv.price), base_price)` khi sort theo giá — xem gotcha quan trọng bên dưới

## 3.2 Product detail và variant resolution

**`getProductById({ id, skuId, queryColor, userId })`** và **`getProductBySlug({ slug, skuId, queryColor, userId })`**:

Variant resolution theo thứ tự ưu tiên:

1. Nếu có `skuId` → tìm variant theo ID
2. Nếu có `queryColor` (`?color=...` hoặc `?Màu sắc=...`) → match theo `attributes.color` / `attributes['Màu sắc']` (normalize NFC)
3. Fallback → `isDefault = true` hoặc `variants[0]`

Sau khi resolve variant → filter ảnh theo `variantId` hoặc color, merge `specifications` + `selectedVariant.attributes`, build `currentVariant` + `availableVariants`.

Nếu có `userId` → gọi `_trackRecentlyViewed` (fire-and-forget, max 20 entries per user).

## 3.3 Specialized product queries

| Method                                   | Logic                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `getFeaturedProducts(limit)`             | WHERE `isFeatured = true`                                                                             |
| `getNewArrivals(limit)`                  | ORDER BY `createdAt DESC`                                                                             |
| `getBestSellers({ limit, period })`      | Raw SQL: JOIN `order_items`, `orders` WHERE không cancelled **AND status='active'**, GROUP BY product |
| `getDeals({ limit, minDiscount, sort })` | WHERE `compareAtPrice IS NOT NULL`, discount >= minDiscount (%), `subQuery: false`                    |
| `getRelatedProducts(id)`                 | Same category (pass `categoryId`), status='active'; fallback → newest active nếu không có             |
| `searchProducts(q)`                      | LIKE trên name_vi, name_en, description_vi, short_description_vi, tags; filter status='active'        |
| `getProductSuggestions(q)`               | Prefix match trên name_vi, trả về id/name/slug/thumbnail; filter status='active'                      |
| `getProductFilters(categoryId)`          | priceRange + brands/colors/sizes từ `ProductAttribute`                                                |

## 3.4 Category và Brand

- `getAllCategories()` — filter chỉ giữ categories có `productCount > 0` **và** `isActive !== false`
- `getAllBrands({ categoryId, hasProducts })` — filter brands có active products khi `hasProducts = true`
- Không thể xóa category/brand đang có sản phẩm — 400 error
- `createCategory({ name, description, image, parentId, isActive, sortOrder })` — `sortOrder` default 0, `isActive` default true, `parentId` default null
- `updateCategory({ id, patch })` — patch chấp nhận `name`, `description`, `image`, `parentId`, `isActive`, `sortOrder`

## 3.5 Business rules

- **Sort giá**: `COALESCE(MIN(pv.price), base_price)` — KHÔNG sort theo `basePrice` trực tiếp. Rule cứng, không revert.
- **Variant product**: `isVariantProduct = true` → `basePrice = 0`, giá thực từ variants. `_pickDisplayPrice` chọn lowest variant price.
- **Recently viewed**: max 20 entries per user, ghi async (fire-and-forget), prune bằng `pruneRecentlyViewed` sau mỗi upsert.
- **getAllCategories vs getCategoryTree**: `getAllCategories` filter `productCount > 0 && isActive !== false`. `getCategoryTree` không filter — trả raw (dùng cho admin).

---

# 4. API Endpoints

## 4.1 Products (`/api/products`) — READ-only

Route order quan trọng — named paths phải đứng trước `/:id` để tránh bị catch nhầm.

> **Product WRITE đã gỡ khỏi catalog** (POST/PUT/DELETE `/api/products`) — dup với admin; CRUD sản phẩm đi qua `/api/admin/products` (`admin` module). Catalog chỉ còn READ. Category/Brand WRITE vẫn ở catalog (§4.2/§4.3).

| Method | Path                   | Auth                 | HTTP Headers | Mô tả                                                          |
| ------ | ---------------------- | -------------------- | ------------ | -------------------------------------------------------------- |
| GET    | `/`                    | —                    | 60s          | Danh sách sản phẩm (filter, sort, pagination)                  |
| GET    | `/recently-viewed`     | authenticate         | —            | Sản phẩm đã xem gần đây (tối đa 20)                            |
| GET    | `/featured`            | —                    | 600s         | Sản phẩm nổi bật                                               |
| GET    | `/new-arrivals`        | —                    | 300s         | Sản phẩm mới nhất                                              |
| GET    | `/best-sellers`        | —                    | —            | Sản phẩm bán chạy (tham số: period=week/month/year)            |
| GET    | `/deals`               | —                    | —            | Sản phẩm đang giảm giá                                         |
| GET    | `/filters`             | —                    | —            | Filter options (priceRange, brands, colors, sizes, attributes) |
| GET    | `/search`              | —                    | —            | Tìm kiếm full-text (tham số: q, page, limit)                   |
| GET    | `/suggestions`         | —                    | —            | Autocomplete gợi ý tên sản phẩm (tham số: q)                   |
| GET    | `/slug/:slug`          | optionalAuthenticate | 300s         | Chi tiết theo slug (hỗ trợ ?skuId, ?color)                     |
| GET    | `/:id/related`         | —                    | —            | Sản phẩm liên quan                                             |
| GET    | `/:id/variants`        | —                    | —            | Danh sách biến thể                                             |
| GET    | `/:id/reviews-summary` | —                    | —            | Tổng hợp rating (average, count, distribution)                 |
| GET    | `/:id`                 | optionalAuthenticate | 300s         | Chi tiết theo ID (hỗ trợ ?skuId, ?color)                       |

## 4.2 Categories (`/api/categories`)

| Method | Path            | Auth                              | HTTP Headers | Mô tả                                           |
| ------ | --------------- | --------------------------------- | ------------ | ----------------------------------------------- |
| GET    | `/`             | —                                 | 1800s        | Danh sách danh mục (có productCount, filter >0) |
| GET    | `/tree`         | —                                 | 1800s        | Cây danh mục phân cấp (raw, không filter)       |
| GET    | `/featured`     | —                                 | 1800s        | Danh mục nổi bật                                |
| GET    | `/slug/:slug`   | —                                 | —            | Danh mục theo slug (cũng chấp nhận numeric id)  |
| GET    | `/:id/products` | —                                 | —            | Sản phẩm trong danh mục                         |
| GET    | `/:id`          | —                                 | —            | Chi tiết danh mục                               |
| POST   | `/`             | authenticate + authorize('staff') | —            | Tạo danh mục                                    |
| PUT    | `/:id`          | authenticate + authorize('staff') | —            | Cập nhật danh mục                               |
| DELETE | `/:id`          | authenticate + authorize('staff') | —            | Xóa danh mục (fail nếu còn sản phẩm)            |

## 4.3 Brands (`/api/brands`)

| Method | Path                   | Auth                              | Mô tả                                                    |
| ------ | ---------------------- | --------------------------------- | -------------------------------------------------------- |
| GET    | `/`                    | —                                 | Danh sách thương hiệu (tham số: categoryId, hasProducts) |
| GET    | `/slug/:slug`          | —                                 | Thương hiệu theo slug                                    |
| GET    | `/slug/:slug/products` | —                                 | Sản phẩm của thương hiệu                                 |
| POST   | `/`                    | authenticate + authorize('staff') | Tạo thương hiệu                                          |
| PUT    | `/:id`                 | authenticate + authorize('staff') | Cập nhật thương hiệu                                     |
| DELETE | `/:id`                 | authenticate + authorize('staff') | Xóa thương hiệu (fail nếu còn sản phẩm)                  |

---

# 5. Dependencies

## 5.1 Depends on

- Models inject từ app.js: `Category`, `Brand`, `Product`, `ProductAttribute`, `ProductVariant`, `ProductSpecification`, `ProductImage`, `Review`, `RecentlyViewed`
- `sequelize` — complex queries, transactions, raw SQL
- `eventBus`, `logger`

## 5.2 Used by

- `cart` — `Product`, `ProductVariant` (price, stock khi thêm vào giỏ)
- `orders` — `Product`, `ProductVariant` (khi tạo đơn hàng)
- `ai` — catalog data cho vector search context; Product model hooks auto-upsert vào vector store
- `admin` — CRUD sản phẩm, danh mục, thương hiệu
- `reviews` — `Product` model (avgRating display)

---

# 6. Gotchas & Edge Cases

- **Sort giá bằng COALESCE (rule cứng)**: `ORDER BY COALESCE((SELECT MIN(pv.price) FROM product_variants pv WHERE pv.product_id = Product.id), basePrice)`. Sản phẩm có variant → hiển thị giá thấp nhất của variant, không phải `basePrice`. KHÔNG đổi thành `p.base_price`. KHÔNG revert.
- **`mounts` array (không phải `router`)**: `module.js` trả `{ mounts: [...] }`. `app.js` phải iterate. Đừng sửa thành single-router pattern.
- **`routes.js` là single file**: Export `{ categories, brands, products }` — không phải thư mục `routes/`.
- **Route order trong products router**: Named paths (`/recently-viewed`, `/featured`, `/deals`, ...) phải đứng trước `/:id`. Nếu thêm named path mới phải đặt trước `/:id`.
- **`optionalAuthenticate` chỉ trên `/slug/:slug` và `/:id`**: Dùng để track recently-viewed. Các product list endpoints không dùng.
- **`/recently-viewed` yêu cầu `authenticate` cứng**: Không dùng `optionalAuthenticate` — user không login không có history.
- **`getDeals` dùng `subQuery: false`**: ORDER BY literal expression trong MySQL cần `subQuery: false` — nếu remove sẽ lỗi "Unknown column in order clause".
- **`findBestSellersRaw` raw SQL**: Trả plain objects (không phải Sequelize instances) — sau đó fetch lại bằng `findProductsByIdsOrdered` để có associations.
- **Variant color matching dùng Unicode NFC normalize**: `queryColor.normalize('NFC').toLowerCase()`. Nếu có bug hiển thị sai variant theo màu → kiểm tra normalization trước.
- **Category slug endpoint dùng `findCategoryByIdOrSlug`**: Chấp nhận cả `slug` và numeric ID — tiện cho backward compatibility.

---

# 7. Tests

| File                                                              | Loại        | Mô tả                                        |
| ----------------------------------------------------------------- | ----------- | -------------------------------------------- |
| `services/catalog-service.test.js`                                | Unit        | Happy path toàn bộ service methods           |
| `services/catalog-service.edge-cases.test.js`                     | Unit        | Edge cases: filter, sort, variant resolution |
| `services/catalog-service.product.edge-cases.test.js`             | Unit        | Edge cases riêng cho product CRUD            |
| `services/catalog-service.skuid.test.js`                          | Unit        | skuId + color query resolution               |
| `services/catalog-product-service.test.js`                        | Unit        | Product service branches                     |
| `repositories/catalog-repository.test.js`                         | Unit        | Repository queries                           |
| `repositories/catalog-repository.edge-cases.test.js`              | Unit        | Repository edge cases                        |
| `repositories/catalog-repository.edge-cases-2.test.js`            | Unit        | Repository edge cases (batch 2)              |
| `controllers/catalog-controller.test.js`                          | Unit        | HTTP layer                                   |
| `controllers/catalog-controller.edge-cases.test.js`               | Unit        | Controller edge cases                        |
| `src/__integration__/catalog.integration.test.js`                 | Integration | DB integration (MySQL thật)                  |
| `src/__integration__/catalog-recently-viewed.integration.test.js` | Integration | Recently viewed integration                  |
| `src/__api__/catalog.http.test.js`                                | API HTTP    | End-to-end HTTP                              |
| `src/__api__/catalog-products.http.test.js`                       | API HTTP    | Product endpoints                            |
| `src/__api__/catalog-comprehensive.http.test.js`                  | API HTTP    | Comprehensive scenarios                      |
| `src/__api__/catalog-deep.http.test.js`                           | API HTTP    | Deep scenarios                               |
| `src/__api__/catalog-extra.http.test.js`                          | API HTTP    | Extra scenarios                              |
