# Lib — Core Client Infrastructure — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
  - [1.1 Files](#11-files)
- [2. api-client.ts](#2-api-clientts)
  - [2.1 Cấu hình Axios instance](#21-cấu-hình-axios-instance)
  - [2.2 Request interceptor — Auto token injection](#22-request-interceptor--auto-token-injection)
  - [2.3 Response interceptor — 401 auto-logout](#23-response-interceptor--401-auto-logout)
- [3. query-client.ts](#3-query-clientts)
  - [3.1 Mount trong App](#31-mount-trong-app)
  - [3.2 Default options](#32-default-options)
- [4. Key Gotchas](#4-key-gotchas)

---

# 1. Tổng quan

## 1.1 Files

```
lib/
  api-client.ts    — Axios instance dùng chung cho tất cả HTTP calls
  query-client.ts  — TanStack Query v5 client config
```

---

# 2. api-client.ts

## 2.1 Cấu hình Axios instance

```ts
import apiClient from '@lib/api-client';

// Tất cả API calls đi qua instance này — không dùng axios trực tiếp
const { data } = await apiClient.get('/products');
```

| Config            | Value                                           |
| ----------------- | ----------------------------------------------- |
| `baseURL`         | `VITE_API_URL \|\| 'http://localhost:8888/api'` |
| `timeout`         | 10 000ms                                        |
| `withCredentials` | `true` (gửi httpOnly cookie cho refresh token)  |
| `Content-Type`    | `application/json`                              |

## 2.2 Request interceptor — Auto token injection

Inject `Authorization: Bearer <token>` vào mọi request. Token lấy qua `getValidToken()` từ `utils/token-manager.ts`:

- Kiểm tra token hiện tại còn hạn không (decode JWT payload, check `exp`)
- Nếu token expired → gọi `/api/auth/refresh-token` để lấy token mới
- **Deduplicate:** nhiều requests cùng lúc trigger refresh → chỉ 1 refresh call thực sự gửi đi, các request còn lại queue và chờ token mới

## 2.3 Response interceptor — 401 auto-logout

| Điều kiện                                                      | Hành động                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| HTTP 401 + **không phải** auth endpoint                        | Gọi `handleUnauthorizedError()` → `handleAutoLogout()` → logout + redirect `/login` |
| HTTP 401 + auth endpoint (login/register/refresh-token/google) | Không auto-logout — trả lỗi về component để xử lý                                   |

**Auth endpoints miễn trừ:** regex `/\/(login|register|refresh-token|google)/` match URL.

---

# 3. query-client.ts

## 3.1 Mount trong App

```tsx
// src/App.tsx
import { queryClient } from '@lib/query-client';
<QueryClientProvider client={queryClient}>
  <App />
</QueryClientProvider>;
```

## 3.2 Default options

| Option                 | Value   | Ý nghĩa                                                               |
| ---------------------- | ------- | --------------------------------------------------------------------- |
| `staleTime`            | 5 phút  | Data được coi fresh — không refetch nếu < 5 phút kể từ lần fetch cuối |
| `gcTime`               | 10 phút | Data bị garbage collect sau 10 phút không dùng                        |
| `retry` (queries)      | `1`     | Retry failed query 1 lần                                              |
| `retry` (mutations)    | `0`     | Không retry mutations (side effects có thể duplicate)                 |
| `refetchOnWindowFocus` | `false` | Không auto-refetch khi user focus lại tab                             |

---

# 4. Key Gotchas

- **Không dùng `axios` trực tiếp** trong feature code — luôn import `apiClient` để có token injection + interceptors.
- **`chatbot-service.ts`** là ngoại lệ cũ (dùng axios trực tiếp). Không copy pattern này.
- **`withCredentials: true`** cần thiết cho httpOnly cookie (refresh token flow) — nếu remove → refresh token endpoint nhận không có cookie → 401.
- **Token refresh deduplication** trong `utils/token-manager.ts`: queue cơ chế dùng `failedQueue[]` — khi `isRefreshing = true`, requests mới push vào queue và chờ `processQueue()` gọi với token mới.
- **`refetchOnWindowFocus: false`**: data không tự cập nhật khi user switch tab về. Cần manual `invalidateQueries` sau mutations.
- **`staleTime = 5 phút`**: với data cần real-time (ví dụ: payment status) → override tại query level bằng `refetchInterval`, không đổi global config.
- **Mutations retry = 0**: mọi thất bại (network, server error) đều trả lỗi ngay — xử lý trong `onError` của `useMutation`.
