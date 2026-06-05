# AI Feature — TechStore Frontend

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

AI chatbot widget floating — không có route riêng, embed vào `App.tsx` qua `ChatWidgetPortal` để hiển thị trên mọi trang. Hỗ trợ: text chat, hiển thị gợi ý sản phẩm từ vector search, quick action buttons (suggestion chips), add-to-cart trực tiếp từ chat. Chat history persist qua navigation qua Zustand + localStorage.

## 1.2 Routes

Không có routes riêng. Widget render dưới dạng portal overlay cố định góc dưới phải màn hình.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/ai/
  api/
    chatbot-api.ts        — TanStack Query mutations: gửi message, add-to-cart via chat

  components/
    ChatWidgetPortal.tsx      — Fixed-position div chứa widget; quản lý render overlay cố định góc dưới phải
    ChatWidget.css            — Glassmorphism + animation styles
    ChatbotErrorBoundary.tsx  — Error boundary — hiển thị fallback thay vì crash toàn trang
    ChatHeader.tsx            — Header wrapper của widget (clear chat + load history demo button)
    ChatMessages.tsx          — Scrollable message list, auto-scroll xuống khi có tin mới
    MessageBubble.tsx         — Styled wrapper cho message content (copy button, products, actions, suggestions)
    ChatInput.tsx             — Textarea auto-resize + send button + char counter (max 500)
    AIProductCard.tsx         — Product card hiển thị trong chat (add-to-cart, format giá VND)
    icons/                    — SVG icon components: SendIcon, ChatIcon, CloseIcon, UserIcon, LoadingIcon, EyeIcon, GridIcon, ImageIcon, LightningIcon, StarIcon, index.ts

  hooks/                      — (rỗng, chưa có feature-specific hooks)

  types/
    message.types.ts          — Message interface (re-export ProductRecommendation/ChatAction từ chatbot-api.ts)

  index.ts                    — Barrel export
```

---

# 3. State Management

## 3.1 Server state (React Query)

Chỉ có mutations — **không có query hooks**. Chat history không fetch từ server, quản lý hoàn toàn qua chatStore + localStorage.

## 3.2 Client state (Zustand)

- `chatStore` (`src/stores/chat-store.ts`) — `messages[]` (persist localStorage), `sessionId` (persist localStorage), `chatHistory` per userId. **Lưu ý:** store có `isOpen` nhưng `ChatWidgetPortal` không dùng — widget dùng local `useState`. Store chỉ là source of truth cho messages/session, không phải toàn bộ chat UI.
- `authStore` — lấy `user.id`/`user` để hiển thị greeting + avatar và check login trước add-to-cart (qua hook `useAuthStore`).
- TanStack Query key `['cart']` — invalidate sau `useAddToCartViaChatbotMutation` (không import `cartStore` trực tiếp).

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                                   | Mô tả                                                                                                                               |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/chatbot/message`                     | Gửi tin nhắn; body: `{ message, userId?, sessionId, context? }`; timeout 30s (Axios) / 25s client-side (Promise.race — fires first) |
| POST   | `/chatbot/cart/add`                    | Thêm sản phẩm vào giỏ từ chat; body: `{ productId, quantity, sessionId, variantId? }`                                               |
| POST   | `/chatbot/session/register`            | (demo) Đăng ký sessionId — gọi trực tiếp `fetch`, không qua `apiClient`                                                             |
| GET    | `/chatbot/session/:sessionId/messages` | (demo) Load lịch sử messages từ DB — gọi trực tiếp `fetch`, dùng cho auto-poll + load history                                       |

## 4.2 Query hooks

**Mutations (chatbot-api.ts):**

- `useSendChatbotMessageMutation()` — gửi message, nhận `{ response, suggestions?, products?, actions?, sessionId? }`
- `useAddToCartViaChatbotMutation()` — add to cart; `onSuccess` invalidate `['cart']`

---

# 5. Components chính

| Component              | Mô tả                                                                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatWidgetPortal`     | Fixed-position div chứa toàn bộ widget; `isOpen` là local `useState` trong component này (không phải chatStore); quản lý layout, gọi `useSendChatbotMessageMutation`, xử lý typing indicator (isLoading message), error handling với i18n messages |
| `ChatMessages`         | Scrollable list với auto-scroll xuống cuối khi có message mới                                                                                                                                                                                      |
| `ChatInput`            | Textarea auto-resize + submit; char counter (max 500, cảnh báo >450); Enter gửi / Shift+Enter xuống dòng; disabled khi isLoading                                                                                                                   |
| `ChatbotErrorBoundary` | Bắt lỗi render — fallback thay vì crash toàn trang                                                                                                                                                                                                 |

---

# 6. Types

```typescript
// types/message.types.ts
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  isLoading?: boolean; // true khi đang chờ response (typing indicator)
  suggestions?: string[]; // quick reply chips
  products?: ProductRecommendation[];
  actions?: ChatAction[];
}

// api/chatbot-api.ts
interface ProductRecommendation {
  id: string | number;
  name: string;
  nameVi?: string;
  nameEn?: string;
  slug?: string;
  price: number;
  compareAtPrice?: number;
  thumbnail?: string;
  rating: number | null;
  inStock: boolean;
  discount: number;
  stockQuantity?: number;
}
interface ChatbotResponse {
  response: string;
  suggestions?: string[];
  products?: ProductRecommendation[];
  actions?: ChatAction[];
  sessionId?: string;
}
interface ChatAction {
  type: string;
  label: string;
  url?: string;
  data?: Record<string, unknown>;
}
interface SendChatbotMessageRequest {
  message: string;
  userId?: number | string;
  sessionId: string;
  context?: Record<string, unknown>;
}
```

---

# 7. Dependencies

## 7.1 Depends on

- `stores/chat-store` — messages state, persist localStorage
- `stores/auth-store` — `user` cho greeting/avatar, check login trước add-to-cart
- TanStack Query key `['cart']` — invalidate qua `queryClient.invalidateQueries` sau add-to-cart (không import `cart-store` trực tiếp)

## 7.2 Used by

- `src/App.tsx` — render `ChatWidgetPortal` (bọc trong `ChatbotErrorBoundary`) để widget xuất hiện trên mọi trang
- `features/admin/api/admin-dashboard-api.ts` — query key `adminDashboardKeys.chatbotStats` (`chatbot-stats`) đọc thống kê chatbot

---

# 8. Gotchas & Edge Cases

- **API duy nhất qua `chatbot-api.ts`** (TanStack Query mutations). Một số call demo-mode (`/chatbot/session/register`, `/chatbot/session/:id/messages`) gọi `fetch` trực tiếp trong `ChatWidgetPortal`, KHÔNG qua `apiClient` — chủ ý vì là tính năng demo/sync DB.
- **Demo mode** (`?demo=true`) persist trong `sessionStorage['demo_mode']`: patch `window.history` để inject `?demo=true` vào mọi navigation, auto-poll DB mỗi 3s lấy tin mới, và hiện nút "load history" trong header. `?demo=false` → tắt.
- **Widget size cố định** (Tailwind classes, không resize/persist): `sm:w-96 md:max-w-md`, cao `h-[680px]` (mobile `h-[75vh]`, min `480px`, max `88vh`).
- **Chat messages persist qua navigation** — chatStore Zustand giữ state trong memory + localStorage (`chat_messages`, `chat_session_id`), không reset khi navigate.
- **Widget render:** `ChatWidgetPortal` là fixed-position div — z-index luôn cao nhất (z-50 button, z-[9999] panel), không bị clip bởi `overflow: hidden` của parent.
- **Rate limit backend:** `chatbotLimiter` = 20 req/60s, không có dev override.
- **Typing indicator:** khi gửi, ChatWidget push `{ isLoading: true }` vào store ngay lập tức, sau đó replace bằng response thực. Nếu lỗi → replace bằng error message.
- **`isLoading` trong Message type** chỉ dùng tạm thời cho typing indicator — không persist vào localStorage.

---

# 9. Tests

Không có test file riêng trong `features/ai/`. Chatbot được test ở backend:

- `backend/src/modules/ai/services/`, `controllers/`, `repositories/` (co-located `*.test.js`) — unit tests AI service, chatbot, vector search
- `backend/src/modules/ai/controllers/ai-controller.chatbot.test.js` — test `/chatbot/message`; `backend/src/__api__/ai-chatbot.http.test.js` — API HTTP tests
