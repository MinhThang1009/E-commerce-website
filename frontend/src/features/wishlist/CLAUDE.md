# Wishlist Feature — TechStore Frontend

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

Cho phép user thêm/xóa sản phẩm vào danh sách yêu thích và xem trang wishlist. Toggle wishlist button được tích hợp trực tiếp trên `ProductCard` (catalog feature). Cần đăng nhập — không có guest wishlist. Route: `/wishlist`.

---

# 2. Cấu trúc Files

```
api/
  wishlist-api.ts   — TanStack Query hooks + export wishlistKeys

pages/
  WishlistPage.tsx  — /wishlist: grid sản phẩm đã lưu + nút clear all

index.ts            — Barrel export
```

Không có `components/`, `types/` riêng.

---

# 3. State Management

## Server state (TanStack Query)

```typescript
export const wishlistKeys = {
  all: ['wishlist'] as const,
  list: () => [...wishlistKeys.all, 'list'] as const,
  check: (productId: string) => [...wishlistKeys.all, 'check', productId] as const,
};
```

Tất cả mutations invalidate `wishlistKeys.all` để refetch cả list và check queries.

## Client state (Zustand)

- `wishlistStore` — local product IDs `items: string[]`. **Không persist** (không localStorage). Dùng để check trạng thái UI nhanh (toggle button on/off) mà không cần query API mỗi lần.
- `authStore` — `isAuthenticated` để enable/disable queries

---

# 4. API Calls

## Queries

| Hook                                         | Endpoint                              | Mô tả                                                                                               |
| -------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `useGetWishlistQuery(_arg?, options?)`       | `GET /api/wishlists`                  | Danh sách sản phẩm yêu thích đầy đủ (trả về `Product[]`). Luôn pass `{ enabled: isAuthenticated }`. |
| `useCheckWishlistQuery(productId, options?)` | `GET /api/wishlists/check/:productId` | Kiểm tra 1 sản phẩm có trong wishlist không. Trả về `{ inWishlist: boolean }`.                      |

`useGetWishlistQuery` có thêm options `refetchOnFocus` và `refetchOnReconnect`.

## Mutations

| Hook                              | Endpoint                           | Mô tả                                                 |
| --------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| `useAddToWishlistMutation()`      | `POST /api/wishlists`              | Body: `{ productId }`. Invalidate `wishlistKeys.all`. |
| `useRemoveFromWishlistMutation()` | `DELETE /api/wishlists/:productId` | Invalidate `wishlistKeys.all`.                        |
| `useClearWishlistMutation()`      | `DELETE /api/wishlists`            | Xóa toàn bộ wishlist. Invalidate `wishlistKeys.all`.  |

---

# 5. Components chính

## Pages

| Page           | Route       | Mô tả                                                                                                                                      |
| -------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `WishlistPage` | `/wishlist` | Grid 2-4 columns responsive. Hiển thị `ProductCard` từ catalog feature. Nút "Xóa tất cả" với confirm dialog. Empty state với link về shop. |

**Clear flow trong `WishlistPage`:**

1. Gọi `clearWishlistLocal()` (Zustand — optimistic)
2. Gọi `clearWishlist()` (server mutation)

## Components

Không có components riêng. Toggle wishlist button trên `ProductCard` (catalog feature) gọi `useAddToWishlistMutation` / `useRemoveFromWishlistMutation` trực tiếp qua wishlist hooks.

---

# 6. Types

```typescript
// wishlist-api.ts
interface WishlistResponse {
  status: string;
  data: Product[]; // Product type từ features/catalog
}

interface CheckWishlistResponse {
  status: string;
  data: {
    inWishlist: boolean;
  };
}
```

`wishlistStore` chỉ lưu `items: string[]` (product IDs) — không phải full Product objects.

---

# 7. Dependencies

**Feature này phụ thuộc vào:**

- `features/catalog` — import `Product` type trong `wishlist-api.ts`; import `ProductCard` trong `WishlistPage`
- `stores/wishlist-store` — `clearWishlistLocal()` trong `WishlistPage`
- `components/common/LoadingSpinner` — loading state
- `components/common/PremiumButton` — CTA button
- `@heroicons/react/24/outline` — `HeartIcon`

**Feature này được dùng bởi:**

- `features/catalog` — `ProductCard` import `useAddToWishlistMutation`, `useRemoveFromWishlistMutation`, `useCheckWishlistQuery` để hiển thị toggle button
- `stores/wishlist-store` — sync wishlist IDs sau login qua `setWishlist()`

---

# 8. Gotchas & Edge Cases

- **Không có `useToggleWishlistMutation`** — phải dùng `useAddToWishlistMutation` hoặc `useRemoveFromWishlistMutation` tùy context. Check trạng thái qua `wishlistStore.items.includes(productId)` trước khi chọn mutation.
- **`wishlistStore` không persist** — reload trang → local IDs reset. Server data vẫn còn, `Header` re-fetch và gọi `setWishlist()` sau login. Mục đích của store chỉ là optimistic UI check.
- **Không có guest wishlist sync** — khác với cart, guest click wishlist → redirect `/login`. Logic này implement trong `ProductCard` (catalog feature).
- **Sau logout:** `authStore.logout()` gọi `wishlistStore.clearWishlistLocal()` tự động — không cần gọi thủ công trong component.
- **`useGetWishlistQuery` chỉ enable khi login:** luôn pass `{ enabled: isAuthenticated }` để tránh gọi API khi chưa có auth token.
- **`WishlistResponse.data` là `Product[]`** — wishlist API trả về full product data (không chỉ IDs), có thể render thẳng vào `ProductCard`.
- **Tên arg đầu tiên `_arg?: undefined`** trong `useGetWishlistQuery` — đây là placeholder để giữ options ở vị trí thứ 2. Gọi `useGetWishlistQuery(undefined, { enabled: false })` hoặc `useGetWishlistQuery(void 0, { enabled: false })`.

---

# 9. Tests

- `frontend/src/__tests__/stores.test.tsx` — wishlist-store actions
