# Hooks — Global Custom Hooks — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Danh sách files](#11-danh-sách-files)
- [2. use-api-state.ts](#2-use-api-statets)
  - [2.1 useApiState — Standardized async state wrapper](#21-useapistate--standardized-async-state-wrapper)
- [3. use-notifications.ts](#3-use-notificationsts)
  - [3.1 Wrapper ngắn gọn cho uiStore](#31-wrapper-ngắn-gọn-cho-uistore)
- [4. use-token-refresh.ts](#4-use-token-refreshts)
  - [4.1 Auto-refresh JWT](#41-auto-refresh-jwt)
- [5. use-scroll-to-top.ts](#5-use-scroll-to-topts)
  - [5.1 Scroll to top on navigation](#51-scroll-to-top-on-navigation)
- [6. use-debounce.ts](#6-use-debouncets)
  - [6.1 Generic debounce hook](#61-generic-debounce-hook)
- [7. Key Gotchas](#7-key-gotchas)

---

# 1. Tổng quan

5 hook files (5 exported hooks — `use-api-state.ts` exports 1: `useApiState`).

## 1.1 Danh sách files

```
hooks/
  use-api-state.ts       — 1 hook: useApiState
  use-notifications.ts   — Wrapper ngắn gọn cho ui-store notifications
  use-token-refresh.ts   — Auto-refresh JWT mỗi 5 phút + khi tab focus
  use-scroll-to-top.ts   — Scroll to top on route change
  use-debounce.ts        — Generic debounce hook
```

**Feature-specific hooks** sống trong `features/<name>/hooks/` — không đặt ở đây.

---

# 2. use-api-state.ts

## 2.1 useApiState — Standardized async state wrapper

Wrap TanStack Query result hoặc async state để cung cấp trạng thái nhất quán.

```ts
import { useApiState } from '@/hooks/use-api-state';

const { data, isLoading, isError, isSuccess, isEmpty, error, retry, canRetry } = useApiState({
  data: query.data,
  isLoading: query.isLoading,
  error: query.error,
  refetch: query.refetch,
  isArray: true, // isEmpty check dùng Array.isArray + length === 0
});
```

**Return:**
| Field | Type | Mô tả |
|---|---|---|
| `data` | `T \| undefined` | Dữ liệu gốc |
| `isLoading` | `boolean` | Đang fetch |
| `isError` | `boolean` | Có lỗi |
| `isSuccess` | `boolean` | `!isLoading && !isError && data !== undefined` |
| `isEmpty` | `boolean` | Data empty (array length 0 hoặc object keys 0) |
| `error` | `unknown` | Error object gốc |
| `retry` | `() => void` | Gọi `refetch` nếu `canRetry` |
| `canRetry` | `boolean` | `true` khi error là `NETWORK_ERROR` hoặc `SERVER_ERROR` |

---

# 3. use-notifications.ts

## 3.1 Wrapper ngắn gọn cho uiStore

```ts
import { useNotifications } from '@/hooks/use-notifications';

const { showNotification, hideNotification, clearAllNotifications } = useNotifications();

showNotification({ message: 'Đã lưu', type: 'success', duration: 3000 });
hideNotification(id);
clearAllNotifications();
```

Dùng thay vì gọi `useUiStore().addNotification(...)` trực tiếp.

---

# 4. use-token-refresh.ts

## 4.1 Auto-refresh JWT

```ts
// Signature
export const useTokenRefresh = (): void

// Mount 1 lần ở App level
function App() {
  useTokenRefresh();
  return <AppRoutes />;
}
```

**Behavior:**

- Kiểm tra token validity ngay khi mount
- `setInterval` mỗi **5 phút** để check và refresh nếu expired
- `visibilitychange` event: refresh khi user switch tab về (tab trở lại visible)
- Token expired + refresh thất bại → `useAuthStore.getState().logout()`

---

# 5. use-scroll-to-top.ts

## 5.1 Scroll to top on navigation

```ts
// Signature
export const useScrollToTop = (): void

// Mount trong MainLayout
function MainLayout() {
  useScrollToTop();
  return <><Header /><Outlet /><Footer /></>;
}
```

Watch `pathname` từ `useLocation()` — mỗi khi pathname thay đổi → `window.scrollTo({ top: 0, behavior: 'smooth' })`.

---

# 6. use-debounce.ts

## 6.1 Generic debounce hook

```ts
// Signature
function useDebounce<T>(value: T, delay: number): T

// Dùng trong search input
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce<string>(query, 300);

// Pass debouncedQuery vào queryKey để tránh gọi API mỗi keystroke
useQuery({ queryKey: ['search', debouncedQuery], ... });
```

Generic — hoạt động với mọi type `T`. Standard delay: **300ms**.

---

# 7. Key Gotchas

- **`useTokenRefresh` mount 1 lần duy nhất** ở App level (`App.tsx`). Nếu mount nhiều lần → nhiều intervals đồng thời → multiple refresh calls.
- **`useScrollToTop` mount trong `MainLayout`** — không mount trong từng page vì MainLayout wrap tất cả user routes.
- **`useDebounce` delay 300ms** là standard — chỉ thay đổi khi có lý do cụ thể (slow network testing, accessibility).
- **`useApiState.canRetry`** chỉ `true` cho `NETWORK_ERROR` + `SERVER_ERROR` — không retry 4xx errors (client errors).
