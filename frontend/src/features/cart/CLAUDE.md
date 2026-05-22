# Cart Feature — TechStore Frontend

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

Quản lý giỏ hàng: guest (local state, persist localStorage) và authenticated user (server-synced). Tự động merge local cart vào server cart khi login. Export `cartKeys` và hooks để features khác (orders, checkout, ai) invalidate và sử dụng.

## 1.2 Routes

| Route   | Page       |
| ------- | ---------- |
| `/cart` | `CartPage` |

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/cart/
  api/
    cart-api.ts           — Tất cả TanStack Query hooks + export cartKeys

  components/
    CartItem.tsx          — Single item row: thumbnail, tên, variant attributes, quantity stepper (+/-), giá, nút xóa

  hooks/
    use-cart-merge.ts     — Watch justLoggedIn flag → add local items lên server sau login, merge server cart
    use-cart-sync.ts      — Sync server cart → cartStore khi fetch thành công; clear khi logout

  pages/
    CartPage.tsx          — /cart: danh sách CartItem + voucher input + order summary + nút checkout

  types/
    cart.types.ts         — CartItem, ServerCart, ServerCartItem, AddToCartPayload interfaces

  index.ts                — Barrel export (cartKeys, hooks, CartItem, CartPage)
```

---

# 3. State Management

## 3.1 Server state (React Query)

```typescript
export const cartKeys = {
  all: ['cart'] as const,
  count: ['cart', 'count'] as const,
  validate: ['cart', 'validate'] as const,
};
```

Sau mọi mutation → invalidate `cartKeys.all` + `cartKeys.count` để Header badge cập nhật ngay.

## 3.2 Client state (Zustand)

`cartStore` (`src/stores/cart-store.ts`):

- `items: CartItem[]` — persist `localStorage` key `cartItems` (guest cart)
- `isOpen: boolean` — sidebar drawer state (dùng ở Header)
- `serverCart: BackendCart | null` — snapshot từ server
- `totalItems`, `subtotal` — derived từ items
- `isLoading: boolean`

Actions: `addItem`, `removeItem`, `updateQuantity`, `clearLocalCart`, `initializeCart`, `setServerCart`.

`authStore` — kiểm tra `isAuthenticated` (enable query), đọc `justLoggedIn` (trigger merge).

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path              | Mô tả                                                       |
| ------ | ----------------- | ----------------------------------------------------------- |
| GET    | `/cart`           | Fetch server cart                                           |
| GET    | `/cart/count`     | Chỉ lấy số lượng items (dùng ở Header badge)                |
| GET    | `/cart/validate`  | Validate cart items — kiểm tra tồn kho + giá hiện tại       |
| POST   | `/cart`           | Thêm item; body: `{ productId, variantId?, quantity? }`     |
| PUT    | `/cart/items/:id` | Cập nhật quantity; body: `{ quantity }`                     |
| DELETE | `/cart/items/:id` | Xóa 1 item                                                  |
| DELETE | `/cart`           | Xóa toàn bộ giỏ                                             |
| POST   | `/cart/sync`      | Đẩy local items lên server (ghi đè)                         |
| POST   | `/cart/merge`     | Merge guest session cart + server cart (server deduplicate) |

## 4.2 Query hooks

**Queries:**

- `useGetCartQuery(options?)` — fetch server cart; luôn pass `{ enabled: isAuthenticated }`
- `useGetCartCountQuery(options?)` — chỉ lấy count; dùng ở Header badge
- `useValidateCartQuery(options?)` — validate items tồn kho/giá; dùng trước khi checkout

**Mutations:**

- `useAddToCartMutation()` — thêm item vào giỏ
- `useUpdateCartItemMutation()` — cập nhật quantity `{ id, data: { quantity } }`
- `useRemoveCartItemMutation()` — xóa 1 item theo id
- `useClearCartMutation()` — xóa toàn bộ giỏ server
- `useSyncCartMutation()` — push local items lên server (đăng nhập lần đầu/thiết bị mới)
- `useMergeCartMutation()` — merge guest + server cart (gọi sau login nếu không có local items)

---

# 5. Components chính

| Component  | Mô tả                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `CartItem` | Row item: thumbnail (link đến product detail), tên, variant attributes (badges), quantity stepper (disable khi >= maxStock), giá × quantity, nút xóa. Props: `isCheckout` (readonly mode), `maxStock`. |
| `CartPage` | Danh sách `CartItem` (2/3 layout), order summary bên phải với: voucher input (gọi `useApplyDiscountCodeMutation` từ feature orders), subtotal, discount, total, nút checkout.                          |

Cart sidebar (mini drawer) render trong `Header` component (`src/components/layout/`) — không phải component riêng của feature này.

---

# 6. Types

```typescript
// types/cart.types.ts
interface CartItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  attributes?: Record<string, string>;
  variantId?: string;
  inStock?: boolean;
  stockQuantity?: number;
  cartId?: string;
}

// api/cart-api.ts (shape từ server)
interface BackendCartItem {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  Product: { id; name; slug; price; thumbnail; inStock; stockQuantity };
  ProductVariant?: { id; name; price; stockQuantity };
}
interface BackendCart {
  id: string | null;
  items: BackendCartItem[];
  totalItems: number;
  subtotal: number;
}

interface CartValidationResult {
  hasIssues: boolean;
  items: Array<{
    id;
    productId;
    variantId?;
    name;
    savedPrice;
    currentPrice;
    quantity;
    maxStock;
    priceChanged: boolean;
    outOfStock: boolean;
    quantityExceedsStock: boolean;
    hasIssue: boolean;
  }>;
}
interface AddToCartRequest {
  productId: string;
  variantId?: string;
  quantity?: number;
}
```

---

# 7. Dependencies

## 7.1 Depends on

- `stores/cart-store` — persistent cart state
- `stores/auth-store` — `isAuthenticated`, `justLoggedIn`
- `stores/ui-store` — `addNotification` trong `use-cart-merge.ts`
- `features/orders` — `useApplyDiscountCodeMutation` (dùng trong `CartPage`)

## 7.2 Used by

- `features/checkout/pages/CheckoutPage.tsx` — `CartItem` component (readonly mode), `cartKeys`, `useGetCartCountQuery`, `useClearCartMutation`
- `features/orders` — invalidate `cartKeys.all` sau khi tạo đơn hàng
- `features/ai/api/chatbot-api.ts` — `useAddToCartViaChatbotMutation` invalidate `['cart']`
- `src/components/layout/Header.tsx` — `useGetCartCountQuery` (badge), `cartStore` (drawer items)

---

# 8. Gotchas & Edge Cases

- **Guest cart:** khi chưa login, cartStore dùng `localStorage`. Khi login → `use-cart-merge.ts` tự động add từng local item lên server (không dùng `useSyncCartMutation` vì sync ghi đè, thay vào đó dùng `addToCart` cho từng item), sau đó gọi `useMergeCartMutation` để deduplicate nếu không có local items.
- **`useGetCartQuery` chỉ enable khi login:** luôn pass `{ enabled: isAuthenticated }` — nếu quên, query bắn request lúc guest → 401.
- **`useSyncCartMutation` khác `useMergeCartMutation`:** sync = đẩy local items lên server sạch (ghi đè). Merge = kết hợp guest cart + server cart, server quyết định deduplicate. `use-cart-sync.ts` dùng sync; `use-cart-merge.ts` dùng merge.
- **`useValidateCartQuery`** gọi trước khi bước vào checkout để bắt items hết hàng hoặc giá thay đổi — không skip.
- **Race condition sync:** `use-cart-sync.ts` không overwrite local cart bằng empty server cart khi đang sync — tránh trường hợp server trả `[]` trước khi sync hoàn thành.
- **Không còn warranty packages:** CartItem không có `warrantyPackageIds`. Warranty module đã bị xóa.
- **`cartKeys` được export** — feature `orders` và `ai` import để invalidate cart sau khi tạo đơn/add từ chat.
- **CartPage xử lý MoMo return:** kiểm tra query param `?status=momo-return&resultCode=0` khi mount — nếu có, clear cart và redirect `/orders`.

---

# 9. Tests

- `frontend/src/__tests__/features/cart/` — component tests CartItem, CartPage
- `backend/__tests__/modules/cart/` — unit tests cart service
- `backend/__api__/cart.api.test.js` — API HTTP tests
