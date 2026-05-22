# Stores — Zustand Client State — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Pattern chung](#11-pattern-chung)
  - [1.2 Khi nào dùng store vs TanStack Query](#12-khi-nào-dùng-store-vs-tanstack-query)
- [2. auth-store.ts](#2-auth-storets)
  - [2.1 State shape](#21-state-shape)
  - [2.2 Actions](#22-actions)
  - [2.3 Persistence](#23-persistence)
  - [2.4 Dùng bởi](#24-dùng-bởi)
- [3. cart-store.ts](#3-cart-storets)
  - [3.1 State shape](#31-state-shape)
  - [3.2 Actions](#32-actions)
  - [3.3 Persistence](#33-persistence)
  - [3.4 convertServerCartItem](#34-convertservercartitem)
- [4. catalog-store.ts](#4-catalog-storets)
  - [4.1 State shape](#41-state-shape)
  - [4.2 Actions](#42-actions)
  - [4.3 Persistence](#43-persistence)
- [5. chat-store.ts](#5-chat-storets)
  - [5.1 State shape](#51-state-shape)
  - [5.2 Actions](#52-actions)
  - [5.3 Persistence](#53-persistence)
  - [5.4 Exported helpers](#54-exported-helpers)
- [6. ui-store.ts](#6-ui-storets)
  - [6.1 State shape](#61-state-shape)
  - [6.2 Actions](#62-actions)
  - [6.3 Persistence](#63-persistence)
  - [6.4 Usage pattern](#64-usage-pattern)
- [7. wishlist-store.ts](#7-wishlist-storets)
  - [7.1 State shape](#71-state-shape)
  - [7.2 Actions](#72-actions)
  - [7.3 Persistence](#73-persistence)
- [8. Key Gotchas](#8-key-gotchas)

---

# 1. Tổng quan

## 1.1 Pattern chung

Tất cả 6 stores:

- **Zustand v5 + Immer** middleware (mutate state trực tiếp trong `set()`)
- Export **1 hook duy nhất** mỗi file: `useAuthStore`, `useCartStore`, v.v.
- Không access `store.getState()` trực tiếp trong React components — chỉ qua hook với selector
- Exception: trong utility functions ngoài React tree → dùng `useAuthStore.getState()` là bình thường

## 1.2 Khi nào dùng store vs TanStack Query

| Loại state                                           | Dùng                                    |
| ---------------------------------------------------- | --------------------------------------- |
| Server data (API response, product list, orders...)  | TanStack Query — `features/<name>/api/` |
| Auth state, JWT token, user object                   | `auth-store`                            |
| Cart items (local optimistic + server sync)          | `cart-store`                            |
| Recently viewed, compare list, catalog filters       | `catalog-store`                         |
| Chatbot messages, session ID                         | `chat-store`                            |
| Theme, toast notifications, mobile menu, search open | `ui-store`                              |
| Wishlist product IDs (optimistic)                    | `wishlist-store`                        |

---

# 2. auth-store.ts

## 2.1 State shape

```ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  justLoggedIn: boolean; // Flag: trigger cart merge sau khi login
}
```

## 2.2 Actions

| Action                                | Mô tả                                                                                                                                               |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loginStart()`                        | Set `isLoading = true`, clear error                                                                                                                 |
| `loginSuccess(payload: AuthResponse)` | Set user + token + `isAuthenticated = true` + `justLoggedIn = true`                                                                                 |
| `loginFailure(error: string)`         | Set error, clear loading                                                                                                                            |
| `logout()`                            | Clear user + token + `isAuthenticated = false`. Xóa `localStorage('user', 'cartItems', 'token', 'refreshToken')` + `sessionStorage('access_token')` |
| `updateUser(data: Partial<User>)`     | Patch user object sau profile update — phải gọi thủ công                                                                                            |
| `updateAccessToken(token: string)`    | Cập nhật token sau refresh — gọi bởi `token-manager.ts`                                                                                             |
| `clearError()`                        | Clear error state                                                                                                                                   |
| `clearJustLoggedIn()`                 | Reset flag sau khi cart merge xong                                                                                                                  |

## 2.3 Persistence

| Key            | Storage          | Ghi chú                                 |
| -------------- | ---------------- | --------------------------------------- |
| `access_token` | `sessionStorage` | Mất khi đóng tab — intentional security |
| `user`         | `localStorage`   | Persist qua sessions (JSON serialized)  |

**Init:** Token đọc từ `sessionStorage` và validate JWT expiry tại startup. Expired token → `token = null`, `isAuthenticated = false`.

## 2.4 Dùng bởi

`api-client.ts` (inject Authorization header), `ProtectedRoute`/`AdminRoute`/`PublicOnlyRoute`, `token-manager.ts`, `auth-utils.ts`, tất cả features cần user info.

---

# 3. cart-store.ts

## 3.1 State shape

```ts
interface CartState {
  items: CartItem[];
  serverCart: ServerCart | null;
  totalItems: number; // Derived — tự tính, không set thủ công
  subtotal: number; // Derived — tự tính, không set thủ công
  isOpen: boolean; // Cart sidebar drawer state (không dùng hiện tại)
  isLoading: boolean;
}
```

## 3.2 Actions

| Action                                        | Mô tả                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `setServerCart(cart: ServerCart)`             | Sync từ server response — convert server items sang local format, update localStorage     |
| `addItem(item: CartItem)`                     | Add hoặc tăng quantity (match theo `productId` + `attributes`)                            |
| `removeItem(id: string)`                      | Xóa item theo `id`                                                                        |
| `updateQuantity({id, quantity})`              | Cập nhật số lượng item                                                                    |
| `clearLocalCart()`                            | Xóa tất cả items + xóa `localStorage('cartItems')`                                        |
| `initializeCart()`                            | Load từ localStorage khi page refresh — gọi trong `Header` khi server cart = 0            |
| `mergeWithLocalCart(serverCart)`              | Merge local items vào server cart sau login (server items ưu tiên, local items tăng thêm) |
| `toggleCart()` / `openCart()` / `closeCart()` | Drawer state                                                                              |
| `setLoading(boolean)`                         | Loading indicator                                                                         |

## 3.3 Persistence

`localStorage('cartItems')` — offline/guest cart. Format: `CartItem[]` serialized JSON.

## 3.4 convertServerCartItem

```ts
import { convertServerCartItem } from '@stores/cart-store';
// Chuyển ServerCartItem → CartItem local format
```

Export helper dùng trong feature cart khi cần map server data.

---

# 4. catalog-store.ts

## 4.1 State shape

```ts
interface CatalogState {
  recentlyViewed: Product[]; // Max 10 items, most recent first
  compareList: Product[]; // Max 4 items
  filters: CatalogFilters;
}

interface CatalogFilters {
  priceRange: [number, number]; // Default [0, 10_000_000] VND
  categories: string[];
  attributes: Record<string, string[]>; // e.g. { color: ['Đen', 'Trắng'] }
  sortBy: string; // Default 'newest'
}
```

## 4.2 Actions

| Action                             | Mô tả                                                             |
| ---------------------------------- | ----------------------------------------------------------------- |
| `addToRecentlyViewed(product)`     | Thêm vào đầu list, dedup theo `id`, cắt bớt nếu > 10              |
| `clearRecentlyViewed()`            | Xóa list + `localStorage('recentlyViewed')`                       |
| `addToCompareList(product)`        | Max 4 — reject nếu đã đủ hoặc đã có                               |
| `removeFromCompareList(productId)` | Xóa khỏi compare list                                             |
| `clearCompareList()`               | Xóa toàn bộ compare list                                          |
| `setPriceRange([min, max])`        | Cập nhật filter giá                                               |
| `setCategories(ids[])`             | Cập nhật filter danh mục                                          |
| `setAttributes(attrs)`             | Cập nhật filter thuộc tính                                        |
| `setSortBy(key)`                   | Đổi sort key                                                      |
| `clearFilters()`                   | Reset về `INITIAL_FILTERS`                                        |
| `loadRecentlyViewed()`             | Load từ `localStorage('recentlyViewed')` — gọi 1 lần khi app init |

## 4.3 Persistence

`localStorage('recentlyViewed')` — recently viewed products survive page reload.

---

# 5. chat-store.ts

## 5.1 State shape

```ts
interface ChatState {
  messages: Message[];
  isOpen: boolean;
  sessionId: string; // UUID, persist qua reload
  chatHistory: Record<string, Message[]>; // Key: userId — per-user history
}
```

## 5.2 Actions

| Action                                        | Mô tả                                       |
| --------------------------------------------- | ------------------------------------------- |
| `addMessage(message)`                         | Push message vào cuối array                 |
| `setMessages(messages[])`                     | Replace toàn bộ messages                    |
| `clearMessages(newSessionId)`                 | Xóa messages + set session ID mới           |
| `toggleChat()` / `openChat()` / `closeChat()` | Widget visibility                           |
| `saveChatHistory(userId)`                     | Lưu `messages` vào `chatHistory[userId]`    |
| `loadChatHistory(userId)`                     | Restore `messages` từ `chatHistory[userId]` |

## 5.3 Persistence

| Key               | Storage        | Ghi chú                                        |
| ----------------- | -------------- | ---------------------------------------------- |
| `chat_messages`   | `localStorage` | Messages survive page reload                   |
| `chat_session_id` | `localStorage` | Session ID gửi lên backend để maintain context |

**`sessionId`:** UUID dùng để backend group messages theo session. Nếu user clear messages → tạo `sessionId` mới.

## 5.4 Exported helpers

```ts
import { createSessionId, saveMessagesToStorage, saveSessionIdToStorage } from '@stores/chat-store';
```

---

# 6. ui-store.ts

## 6.1 State shape

```ts
interface UIState {
  notifications: Notification[];
  theme: 'light' | 'dark';
  isSearchOpen: boolean;
  isMobileMenuOpen: boolean;
  isLoading: boolean;
}

interface Notification {
  id: string; // auto-generated: Date.now().toString()
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  duration?: number;
}
```

## 6.2 Actions

| Action                        | Mô tả                                           |
| ----------------------------- | ----------------------------------------------- |
| `addNotification(payload)`    | Push notification với auto-generated ID         |
| `removeNotification(id)`      | Xóa 1 notification                              |
| `clearNotifications()`        | Xóa tất cả                                      |
| `setTheme('light' \| 'dark')` | Đổi theme + persist vào `localStorage('theme')` |
| `toggleSearch()`              | Toggle search bar state                         |
| `toggleMobileMenu()`          | Toggle mobile menu                              |
| `setLoading(boolean)`         | Global loading flag                             |

## 6.3 Persistence

`localStorage('theme')` — init từ `localStorage` trước, nếu chưa có → detect `prefers-color-scheme` từ OS.

## 6.4 Usage pattern

```ts
// Direct store access
const { addNotification } = useUiStore();
addNotification({ message: 'Đã lưu thành công', type: 'success', duration: 3000 });

// Qua wrapper hook (khuyến nghị)
const { showNotification } = useNotifications();
showNotification({ message: 'Đã lưu', type: 'success', duration: 3000 });
```

---

# 7. wishlist-store.ts

## 7.1 State shape

```ts
interface WishlistState {
  items: string[]; // Chỉ product IDs — không lưu full Product objects
}
```

## 7.2 Actions

| Action                               | Mô tả                                                       |
| ------------------------------------ | ----------------------------------------------------------- |
| `setWishlist(items: string[])`       | Replace toàn bộ list — gọi sau khi fetch wishlist từ server |
| `addToWishlistLocal(productId)`      | Optimistic add (chạy trước API call)                        |
| `removeFromWishlistLocal(productId)` | Optimistic remove                                           |
| `clearWishlistLocal()`               | Clear khi logout                                            |

## 7.3 Persistence

**Không persist** — server-synced. Local actions là optimistic updates cho đến khi API confirm. `Header` component sync wishlist từ server sau mỗi login.

---

# 8. Key Gotchas

- **`justLoggedIn` flag** trong auth-store: bật sau `loginSuccess`, tắt sau `clearJustLoggedIn()`. `MainLayout` dùng flag này để trigger `useCartMerge` — chỉ merge 1 lần sau login.
- **`cartItems` localStorage** bị xóa khi `logout()` trong auth-store — không cần xóa thủ công.
- **`serverCart` vs `items`:** `items` là mảng flat đã convert từ server, `serverCart` là raw server response. Khi authenticated, luôn dùng `serverCart` count cho display.
- **Wishlist không persist:** khi user refresh trang, `Header` re-fetch wishlist từ server và gọi `setWishlist()`. Không cần seed từ localStorage.
- **`chatHistory`** (không persist) — chỉ giữ được trong session đang mở. `messages` + `sessionId` persist qua localStorage.
