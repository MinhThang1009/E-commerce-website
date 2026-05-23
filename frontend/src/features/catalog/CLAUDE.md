# Catalog Feature — TechStore Frontend

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

Feature lớn nhất — toàn bộ trải nghiệm mua sắm frontend: danh sách sản phẩm với filter/sort, trang chi tiết sản phẩm, lọc theo danh mục/thương hiệu/thuộc tính, deals, new arrivals, best sellers, recently viewed products, search history. Cũng export nhiều components dùng trong admin create/edit product form.

## 1.2 Routes

| Route                  | Page                |
| ---------------------- | ------------------- |
| `/shop`                | `ShopPage`          |
| `/products/:productId` | `ProductDetailPage` |
| `/categories`          | `CategoriesPage`    |
| `/categories/:slug`    | `CategoryPage`      |
| `/brands`              | `BrandsPage`        |
| `/new-arrivals`        | `NewArrivalsPage`   |
| `/best-sellers`        | `BestSellersPage`   |
| `/deals`               | `DealsPage`         |

---

# 2. Cấu trúc Files

## 2.1 File listing

Thứ tự đọc khuyến nghị: types → api → utils → hooks → components → pages.

```
features/catalog/
  api/
    product-api.ts          — 13 hooks; tất cả responses qua transformProductsResponse(); export productKeys
    category-api.ts         — 8 hooks (5 queries + 3 mutations admin); export categoryKeys
    brand-api.ts            — 6 hooks (3 queries + 3 mutations admin)
    search-history-api.ts   — 4 hooks (1 query + 3 mutations)
    attribute-api.ts        — Class-based attributeService (KHÔNG phải hooks)

  hooks/
    use-product-variants.ts     — Variant selection UI: chọn color/size, tính giá, disable hết hàng
    use-product-price-range.ts  — Tính price range hiển thị từ danh sách variants
    use-product-attributes.ts   — Quản lý attributes UI; debug mode qua localStorage
    use-product-form.ts         — Form state cho create/edit product (admin, multi-step)

  utils/
    product-transform.ts    — transformProductsResponse(): normalize API responses về display format
    product-helpers.ts      — price range calc, stock check, variant selection logic
    product-naming.ts       — tạo tên động từ variant config (vd: "iPhone 15 Pro 256GB Đen")
    sample-product-data.ts  — dữ liệu mẫu cho form

  components/
    ProductCard.tsx               — Card: ảnh, tên, giá (gạch khi discount), wishlist icon, quick add-to-cart
    ProductListCard.tsx           — Card dạng list (thay vì grid)
    ProductGrid.tsx               — Grid wrapper với loading skeleton
    ProductFilters.tsx            — Sidebar filter tổng hợp (price slider + category + attribute checkboxes)
    FilterPanel.tsx               — Variant của ProductFilters (modal/panel)
    ProductPrice.tsx              — Hiển thị giá đúng theo variant đang chọn
    ProductVariantSelector.tsx    — Chọn color/storage, disable khi hết hàng
    EnhancedVariantSelector.tsx   — Variant selector nâng cao với state phức tạp hơn
    ProductGallery.tsx            — Gallery ảnh product detail (thumbnails + main)
    ProductImageGallery.tsx       — Variant của gallery
    RecentlyViewedProducts.tsx    — Horizontal carousel 10 sản phẩm gần nhất (từ catalogStore)
    ProductDetailsSection.tsx     — Tabs specs/FAQ/reviews trong product detail
    DynamicProductTitle.tsx       — Title động theo variant đang chọn
    DynamicProductName.tsx        — Variant của DynamicProductTitle
    SimpleDynamicTitle.tsx        — Phiên bản đơn giản hơn
    AttributeModal.tsx            — Modal thêm/sửa attribute (admin)
    DynamicAttributeSelector.tsx  — Attribute selector động (admin product form)
    SimpleAttributeSelector.tsx   — Phiên bản đơn giản
    EnhancedProductBasicForm.tsx  — Enhanced form cơ bản (admin)
    ProductBasicInfoForm.tsx      — Form thông tin cơ bản (admin)
    ProductCategoryForm.tsx       — Form chọn danh mục (admin)
    ProductPricingForm.tsx        — Form giá (admin)
    ProductImagesForm.tsx         — Form upload ảnh (admin)
    ProductSpecificationsForm.tsx — Form specifications (admin)
    ProductAttributesSection.tsx  — Section attributes (admin)
    HierarchicalAttributesForm.tsx — Form attributes hierarchical (admin)
    HierarchicalVariantsForm.tsx  — Form variants hierarchical (admin)
    ProductVariantsSection.tsx    — Section variants (admin)
    VariantModal.tsx              — Modal tạo/sửa variant (admin)
    ProductSeoForm.tsx            — Form SEO (admin)
    ProductFAQForm.tsx            — Form FAQ (admin)
    ProductFAQSection.tsx         — Section FAQ hiển thị (admin)
    FormActions.tsx               — Action buttons cho form (admin)
    TabNavigation.tsx             — Tab navigation component (admin)
    ValidationAlerts.tsx          — Alert validation errors (admin)
    Base64ImageWarning.tsx        — Warning khi dùng base64 image

  pages/
    ShopPage.tsx           — /shop: grid sản phẩm, FilterPanel bên trái, sort dropdown, URL params
    ProductDetailPage.tsx  — /products/:productId: gallery, variant selector, add-to-cart, tabs
    CategoriesPage.tsx     — /categories: grid danh mục với thumbnail
    CategoryPage.tsx       — /categories/:slug: sản phẩm trong danh mục
    BrandsPage.tsx         — /brands: grid thương hiệu
    NewArrivalsPage.tsx    — /new-arrivals: sản phẩm mới nhất
    BestSellersPage.tsx    — /best-sellers: top bán chạy
    DealsPage.tsx          — /deals: sản phẩm đang giảm giá

  types/
    product.types.ts       — Product, ProductVariant, ProductFilters interfaces
    category.types.ts      — Category interface

  index.ts                 — Barrel export (productKeys, hooks, components, pages)
```

---

# 3. State Management

## 3.1 Server state (React Query)

Filter/sort/page dùng **URL search params** — không lưu trong store. `productKeys` exported để admin feature invalidate danh sách sản phẩm public.

```typescript
export const productKeys = {
  all: ['products'],
  lists: () => [...productKeys.all, 'list'],
  detail: (id) => [...productKeys.all, 'detail', id],
  slug: (slug) => [...productKeys.all, 'slug', slug],
  featured: (params?) => [...productKeys.all, 'featured', params],
  newArrivals: (params?) => [...productKeys.all, 'new-arrivals', params],
  bestSellers: (params?) => [...productKeys.all, 'best-sellers', params],
  deals: (params?) => [...productKeys.all, 'deals', params],
  related: (id) => [...productKeys.all, 'related', id],
  variants: (id) => [...productKeys.all, 'variants', id],
  reviewsSummary: (id) => [...productKeys.all, 'reviews-summary', id],
  search: (params) => [...productKeys.all, 'search', params],
  filters: (params?) => [...productKeys.all, 'filters', params],
  recentlyViewed: (params?) => [...productKeys.all, 'recently-viewed', params],
};
```

## 3.2 Client state (Zustand)

`catalogStore` (`src/stores/catalog-store.ts`) chỉ lưu:

- `recentlyViewed: Product[]` — max 10 full Product objects, persist localStorage
- `compareList: Product[]` — max 4 full Product objects, không persist

`cartStore` — `addItem` từ ProductCard, ProductDetailPage (quick add).
`wishlistStore` — toggle wishlist từ ProductCard.

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                            | Mô tả                                   |
| ------ | ------------------------------- | --------------------------------------- |
| GET    | `/products`                     | Danh sách sản phẩm có filter/pagination |
| GET    | `/products/:id`                 | Chi tiết theo ID                        |
| GET    | `/products/slug/:slug`          | Chi tiết theo slug (SEO)                |
| GET    | `/products/featured`            | Sản phẩm nổi bật                        |
| GET    | `/products/new-arrivals`        | Hàng mới về                             |
| GET    | `/products/best-sellers`        | Bán chạy nhất                           |
| GET    | `/products/deals`               | Đang giảm giá                           |
| GET    | `/products/:id/related`         | Sản phẩm liên quan                      |
| GET    | `/products/:id/variants`        | Danh sách variants                      |
| GET    | `/products/:id/reviews/summary` | Tóm tắt rating                          |
| GET    | `/products/search`              | Full-text search                        |
| GET    | `/products/filters`             | Filter options có sẵn                   |
| GET    | `/products/recently-viewed`     | Sản phẩm đã xem gần đây                 |
| GET    | `/categories`                   | Danh sách danh mục                      |
| GET    | `/categories/tree`              | Cây danh mục                            |
| GET    | `/categories/:id`               | Chi tiết danh mục theo ID               |
| GET    | `/categories/slug/:slug`        | Chi tiết danh mục theo slug             |
| GET    | `/categories/featured`          | Danh mục nổi bật                        |
| POST   | `/categories`                   | Admin: tạo danh mục                     |
| PUT    | `/categories/:id`               | Admin: cập nhật danh mục                |
| DELETE | `/categories/:id`               | Admin: xóa danh mục                     |
| GET    | `/brands`                       | Danh sách thương hiệu                   |
| GET    | `/brands/:slug`                 | Chi tiết thương hiệu theo slug          |
| GET    | `/brands/:slug/products`        | Sản phẩm theo thương hiệu               |
| POST   | `/brands`                       | Admin: tạo thương hiệu                  |
| PUT    | `/brands/:id`                   | Admin: cập nhật thương hiệu             |
| DELETE | `/brands/:id`                   | Admin: xóa thương hiệu                  |
| GET    | `/search-history`               | Lịch sử tìm kiếm của user               |
| POST   | `/search-history`               | Lưu search history                      |
| DELETE | `/search-history/:id`           | Xóa 1 search item                       |
| DELETE | `/search-history`               | Xóa toàn bộ search history              |

## 4.2 Query hooks

**product-api.ts (13 hooks):**

- `useGetProductsQuery(filters?)` — list với filter/pagination
- `useGetProductByIdQuery(arg)` — arg polymorphic: `string` hoặc `{ id, skuId?, color? }`
- `useGetProductBySlugQuery(slug)` — detail theo slug
- `useGetFeaturedProductsQuery(params?)`
- `useGetNewArrivalsQuery(params?)`
- `useGetBestSellersQuery(params?)`
- `useGetDealsQuery(params?)`
- `useGetRelatedProductsQuery(id)`
- `useGetProductVariantsQuery(id)`
- `useGetProductReviewsSummaryQuery(id)`
- `useSearchProductsQuery(params)`
- `useGetProductFiltersQuery(params?)`
- `useGetRecentlyViewedQuery(params?)`

**category-api.ts:** `useGetAllCategoriesQuery`, `useGetCategoryTreeQuery` _(gửi `Cache-Control: no-cache` header — dùng cho admin để luôn nhận data mới nhất)_, `useGetCategoryByIdQuery(id)`, `useGetCategoryBySlugQuery(slug)`, `useGetFeaturedCategoriesQuery`, `useCreateCategoryMutation`, `useUpdateCategoryMutation`, `useDeleteCategoryMutation`

**brand-api.ts:** `useGetBrandsQuery`, `useGetBrandBySlugQuery(slug)`, `useGetProductsByBrandQuery(params)`, `useCreateBrandMutation`, `useUpdateBrandMutation`, `useDeleteBrandMutation`

**search-history-api.ts:** `useGetSearchHistoryQuery`, `useSaveSearchMutation`, `useDeleteSearchHistoryMutation`, `useClearAllSearchHistoryMutation`

**attribute-api.ts — class-based (không phải hooks):**

```typescript
// Gọi trực tiếp, không dùng như hook
attributeService.previewProductName(params);
attributeService.generateNameRealTime(params);
attributeService.getAttributeGroups();
attributeService.getProductAttributeGroups(productId);
attributeService.createAttributeGroup(data);
attributeService.addAttributeValue(groupId, data);
attributeService.assignAttributeGroupToProduct(productId, groupId);
```

---

# 5. Components chính

| Component                | Mô tả                                                                                                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ProductCard`            | Card chính: ảnh (hover zoom), tên, giá (gạch khi có discount), wishlist toggle icon, quick add-to-cart button. Dùng ở ShopPage, CategoryPage, RecentlyViewed, AI chat. |
| `ProductFilters`         | Sidebar filter tổng hợp: price range slider, category checkboxes, attribute dynamic filters. State lưu trong URL params.                                               |
| `ProductPrice`           | Hiển thị giá theo variant đang chọn: gạch giá gốc khi có discount, badge "Giảm X%".                                                                                    |
| `ProductVariantSelector` | Chọn color/storage (dạng button groups), disable variant hết hàng, highlight selected.                                                                                 |
| `RecentlyViewedProducts` | Horizontal carousel 10 sản phẩm gần nhất lấy từ `catalogStore.recentlyViewed`.                                                                                         |
| `ProductDetailsSection`  | Tabs trong product detail: Thông số kỹ thuật (specs), FAQ, Reviews (render từ feature reviews).                                                                        |

---

# 6. Types

```typescript
// types/product.types.ts
interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
  categoryId: string;
  brandId?: string;
  variants?: ProductVariant[];
  isActive: boolean;
  specifications?: Array<{ name: string; value: string; category?: string }>;
  faqs?: Array<{ question: string; answer: string }>;
}
interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stockQuantity: number;
  stock?: number; // alias optional cho stockQuantity
  attributes: Record<string, string>; // { "Màu sắc": "Đen", "Dung lượng": "256GB" }
}
interface ProductFilters {
  priceRange?: [number, number];
  categories?: string[];
  sortBy?: string;
  page?: number;
  limit?: number;
  [key: string]: unknown; // Index signature cho dynamic attribute filters
}

// types/category.types.ts
interface Category {
  id: string;
  name: string;
  nameVi?: string;
  nameEn?: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  isActive?: boolean; // DB field (is_active, default true)
  sortOrder?: number; // DB field (sort_order, default 0)
  children?: Category[];
  productCount?: number;
  // image/level: chưa có trong DB, optional phòng future
}
```

---

# 7. Dependencies

## 7.1 Depends on

- `stores/catalog-store` — `recentlyViewed`, `compareList`
- `stores/cart-store` — `addItem` từ ProductCard, ProductDetailPage
- `stores/wishlist-store` — toggle wishlist
- `stores/auth-store` — check login cho search history

## 7.2 Used by

- `features/admin` — import nhiều form components (ProductBasicInfoForm, HierarchicalVariantsForm, etc.)
- `features/ai/components/ChatProductCard.tsx` — render product từ AI response
- `src/pages/` — `HomePage` dùng `useGetFeaturedProductsQuery`, `useGetNewArrivalsQuery`

---

# 8. Gotchas & Edge Cases

- **`catalogStore` KHÔNG lưu filter state** — filter/sort/page dùng URL params. Store chỉ quản lý `recentlyViewed[]` (max 10) và `compareList[]` (max 4).
- **`attribute-api.ts` là class-based service**, không phải TanStack Query — gọi `attributeService.method()`, không dùng như hook.
- **`useGetProductByIdQuery` nhận polymorphic arg**: `string` (chỉ ID) hoặc `{ id, skuId?, color? }` (chọn variant cụ thể khi navigate từ search/AI).
- **Sort backend** dùng `COALESCE(MIN(variant.price), base_price)` — không sort theo `basePrice` field. Không revert.
- **`transformProductsResponse()`** phải áp dụng cho tất cả product API responses — khi thêm endpoint mới, wrap qua transform.
- **`ProductFilters` type có index signature** `[key: string]: unknown` để cho phép dynamic attribute filters.
- **`use-product-attributes.ts`** có debug mode toggle qua `localStorage` key — console logs lạ là do debug mode đang bật.
- **`compareList` max 4** — thêm item thứ 5 bị reject với error toast.
- **`productKeys` được export** — admin feature import để invalidate danh sách sản phẩm public sau khi sửa/xóa sản phẩm.
- **Admin form components** nằm trong feature này vì chia sẻ types/utils với user-facing components — không phải kiến trúc lý tưởng nhưng giảm duplication.

---

# 9. Tests

- `frontend/src/__tests__/features/catalog/` — component tests ProductCard, ProductFilters, VariantSelector
- `backend/__tests__/modules/catalog/` — unit tests catalog service
- `backend/__api__/catalog.api.test.js` — API HTTP tests (products, categories, brands)
