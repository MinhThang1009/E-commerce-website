# Types — TypeScript Type Definitions — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Convention](#11-convention)
- [2. Barrel import](#2-barrel-import)
  - [2.1 Import qua barrel](#21-import-qua-barrel)
  - [2.2 Re-exports từ features (index.ts)](#22-re-exports-từ-features-indexts)
- [3. Local files](#3-local-files)
  - [3.1 common.types.ts — API contracts](#31-commontypests--api-contracts)
  - [3.2 user.types.ts — User & Address](#32-usertypests--user--address)
  - [3.3 ui.types.ts — UI state](#33-uitypests--ui-state)
  - [3.4 discount.types.ts — DiscountCode](#34-discounttypests--discountcode)
- [4. Key Gotchas](#4-key-gotchas)

---

# 1. Tổng quan

## 1.1 Convention

```
src/types/                    ← Shared types dùng xuyên suốt nhiều features
  common.types.ts             — API contracts (PaginatedResponse, ApiError, ApiResponse...)
  user.types.ts               — User, Address
  ui.types.ts                 — Notification, UIState, AddNotificationPayload
  discount.types.ts           — DiscountCode
  index.ts                    — Barrel re-export (local + re-exports từ feature types)

src/features/<name>/types/    ← Domain types — đặt ở đây, không đặt vào src/types/
```

---

# 2. Barrel import

## 2.1 Import qua barrel

```ts
import { Product, Category, Order, OrderStatus, User, PaginatedResponse } from '@types';
// hoặc
import type { CartItem, AuthResponse, Notification } from '@/types';
```

## 2.2 Re-exports từ features (index.ts)

| Type                                                                                     | Nguồn                                                     |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `Product`, `ProductVariant`, `Category`, `Brand`, `ProductWithVariants`                  | `features/catalog/types/product.types` + `category.types` |
| `Cart`, `CartItem`, `ServerCart`, `ServerCartItem`, `CartState`, `UpdateCartItemPayload` | `features/cart/types/cart.types`                          |
| `Order`, `OrderItem`, `OrderStatus`, `PaymentStatus`, `PaymentMethod`                    | `features/orders/types/order.types`                       |
| `Review`, `ReviewsResponse`                                                              | `features/reviews/types/review.types`                     |
| `AuthState`, `AuthResponse`                                                              | `features/auth/types/auth.types`                          |
| `User`, `Address`                                                                        | `./user.types`                                            |
| `PaginatedResponse`, `ApiError`, `ApiResponse`, `PaginationParams`                       | `./common.types`                                          |
| `Notification`, `UIState`, `AddNotificationPayload`                                      | `./ui.types`                                              |

---

# 3. Local files

## 3.1 common.types.ts — API contracts

```typescript
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApiError {
  status: number;
  message: string;
  errors?: Record<string, string[]>;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

interface PaginationParams {
  page: number;
  limit: number;
}

type ThemeMode = 'light' | 'dark';
```

## 3.2 user.types.ts — User & Address

```typescript
interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: 'customer' | 'admin';
  isEmailVerified: boolean;
  createdAt: string;
}

interface Address {
  id: string;
  firstName: string;
  lastName: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  phone?: string;
  isDefault: boolean;
}
```

## 3.3 ui.types.ts — UI state

```typescript
interface Notification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  title?: string;
  duration?: number;
}

interface UIState {
  notifications: Notification[];
  theme: 'light' | 'dark';
  isSearchOpen: boolean;
  isMobileMenuOpen: boolean;
  isLoading: boolean;
}

interface AddNotificationPayload {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  title?: string;
  duration?: number;
}
```

## 3.4 discount.types.ts — DiscountCode

```typescript
interface DiscountCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  usageLimit?: number;
  usageCount: number;
  expiresAt?: string;
  isActive: boolean;
}
```

---

# 4. Key Gotchas

- **Domain types phải ở trong feature** (`features/<name>/types/`) — không define mới ở `src/types/`. File `index.ts` chỉ re-export, không define domain types.
- **`User.role`** có 2 values: `'customer'`, `'admin'`. Code kiểm tra admin role dùng: `role === 'admin'`.
- **`PaginatedResponse<T>`** là type chuẩn cho mọi list API — dùng type này thay vì define inline.
- **`WishlistItem` trong `common.types.ts`** là type cũ/legacy — wishlist store thực tế chỉ dùng `string[]` (product IDs). Không dùng `WishlistItem` cho wishlist store logic.
- **`AddNotificationPayload`** vs `Notification`: `Notification` có `id` (auto-generated bởi store), `AddNotificationPayload` không có `id` — dùng `AddNotificationPayload` khi gọi `addNotification()`.
