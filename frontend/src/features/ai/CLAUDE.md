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

AI chatbot widget floating — không có route riêng, embed vào `MainLayout` qua `ChatWidgetPortal` để hiển thị trên mọi trang. Hỗ trợ: text chat, voice input (Web Speech API với `lang: 'vi-VN'`), hiển thị gợi ý sản phẩm từ vector search, quick action buttons, add-to-cart trực tiếp từ chat. Chat history persist qua navigation qua Zustand + localStorage.

## 1.2 Routes

Không có routes riêng. Widget render dưới dạng portal overlay cố định góc dưới phải màn hình.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
features/ai/
  api/
    chatbot-api.ts        — TanStack Query mutations: gửi message, track analytics, add-to-cart via chat
    chatbot-service.ts    — LEGACY: class-based service dùng axios trực tiếp (không qua apiClient)

  components/
    ChatWidget.tsx            — Root container: quản lý size/position dùng react-rnd (resizable + draggable)
    ChatWidget.css            — Animation, resize handle styles
    ChatWidgetPortal.tsx      — Render widget vào document.body qua React Portal
    ChatbotErrorBoundary.tsx  — Error boundary — hiển thị fallback thay vì crash toàn trang
    ChatHeader.tsx            — Header wrapper của widget
    ChatHeaderContent.tsx     — Nội dung header: title, apply changes, nút đóng
    ChatMessages.tsx          — Scrollable message list, auto-scroll xuống khi có tin mới
    ChatMessage.tsx           — Single message bubble (user / ai)
    MessageBubble.tsx         — Styled wrapper cho message content
    ChatInput.tsx             — Text input + voice button (Web Speech API) + send button
    ChatSuggestions.tsx       — Suggested quick replies bên dưới message AI
    ChatProductList.tsx       — List nhiều ChatProductCard
    ChatProductCard.tsx       — Product card trong chat: ảnh, tên, giá, nút "Xem" + "Thêm giỏ"
    AIProductCard.tsx         — Product card mở rộng (dùng ngoài chat context)
    AIStatusIndicator.tsx     — Chỉ báo trạng thái AI (thinking/online)
    ChatToggleButton.tsx      — FAB button góc dưới phải để toggle chat
    ChatResizeIndicator.tsx   — Visual indicator cho resize handle
    ChatEmptyState.tsx        — Empty state khi chưa có tin nhắn (gợi ý ban đầu)
    ChatQuickActions.tsx      — Quick action buttons phía trên input
    ChatActionButtons.tsx     — Action buttons trong message AI (view cart, checkout...)
    icons/                    — SVG icon components: SendIcon, BotIcon, UserIcon, LoadingIcon, TrashIcon, HelpIcon...

  hooks/
    use-chat-widget.ts        — Hook chính: toggle/close chat, CRUD messages, persist size vào localStorage
    use-speech-recognition.ts — Web Speech API wrapper với lang: 'vi-VN'

  constants/
    chat-widget.ts            — CHAT_WIDGET_CONFIG: DEFAULT_SIZE 384×600, MIN 300×400, MAX 800×800; STORAGE_KEYS; getGreetingMessage()
    prompt-templates.ts       — Template prompts gợi ý ban đầu

  types/
    message.types.ts          — Message interface (re-export/định nghĩa lại từ chatbot-api.ts types)

  index.ts                    — Barrel export
```

---

# 3. State Management

## 3.1 Server state (React Query)

Chỉ có mutations — **không có query hooks**. Chat history không fetch từ server, quản lý hoàn toàn qua chatStore + localStorage.

## 3.2 Client state (Zustand)

- `chatStore` (`src/stores/chat-store.ts`) — `messages[]` (persist localStorage), `sessionId` (persist localStorage), `chatHistory` per userId. Single source of truth cho toàn bộ chat UI.
- `authStore` — lấy `user.id` để load/save chat history theo user; `chatbot-service.ts` (legacy) gọi `useAuthStore.getState()` ngoài React context.
- `cartStore` — update sau `useAddToCartViaChatbotMutation`.

---

# 4. API Calls

## 4.1 Endpoints sử dụng

| Method | Path                 | Mô tả                                                                                 |
| ------ | -------------------- | ------------------------------------------------------------------------------------- |
| POST   | `/chatbot/message`   | Gửi tin nhắn; body: `{ message, userId?, sessionId, context? }`; timeout 30s          |
| POST   | `/chatbot/analytics` | Track sự kiện; body: `{ event, userId?, sessionId, productId?, value?, metadata? }`   |
| POST   | `/chatbot/cart/add`  | Thêm sản phẩm vào giỏ từ chat; body: `{ productId, quantity, sessionId, variantId? }` |

## 4.2 Query hooks

**Mutations (chatbot-api.ts):**

- `useSendChatbotMessageMutation()` — gửi message, nhận `{ response, suggestions?, products?, actions?, sessionId? }`
- `useTrackChatbotAnalyticsMutation()` — track analytics events
- `useAddToCartViaChatbotMutation()` — add to cart; `onSuccess` invalidate `['cart']`

---

# 5. Components chính

| Component                             | Mô tả                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatWidget`                          | Container chính: quản lý layout, gọi `useSendChatbotMessageMutation`, xử lý typing indicator (isLoading message), error handling với i18n messages |
| `ChatWidgetPortal`                    | Mount widget vào `document.body` — tránh z-index conflict với `overflow: hidden` của parent. Dùng `react-rnd` cho drag + resize.                   |
| `ChatToggleButton`                    | FAB button bottom-right, toggle open/close                                                                                                         |
| `ChatMessages`                        | Scrollable list với auto-scroll xuống cuối khi có message mới                                                                                      |
| `ChatInput`                           | Text field + voice button (Web Speech API) + submit; disabled khi isLoading                                                                        |
| `ChatProductList` + `ChatProductCard` | Hiển thị sản phẩm được AI gợi ý: ảnh, tên, giá, nút "Xem chi tiết" + "Thêm vào giỏ"                                                                |
| `ChatbotErrorBoundary`                | Bắt lỗi render — fallback thay vì crash toàn trang                                                                                                 |

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
- `stores/auth-store` — user.id cho chat history, token cho legacy chatbot-service
- `stores/cart-store` — invalidate sau add-to-cart
- `react-rnd` — drag + resize cho ChatWidget
- `Web Speech API` — voice input trong `use-speech-recognition.ts`

## 7.2 Used by

- `src/components/layout/MainLayout.tsx` — render `ChatWidgetPortal` để widget xuất hiện trên mọi trang
- `features/admin/api/admin-dashboard-api.ts` — `useGetChatbotStatsQuery` đọc analytics chatbot

---

# 8. Gotchas & Edge Cases

- **2 API layers song song:** `chatbot-api.ts` (TanStack Query — dùng chính) vs `chatbot-service.ts` (class-based legacy, axios trực tiếp, không qua `apiClient`). Khi thêm logic mới → dùng `chatbot-api.ts`.
- **`chatbot-service.ts` là LEGACY** — tự lấy token từ `useAuthStore.getState()`. Tồn tại vì code cũ còn tham chiếu — không xóa khi chưa migrate hết.
- **Widget size persist** vào `localStorage[CHAT_WIDGET_CONFIG.STORAGE_KEYS.SIZE]` = `'chatWidgetSize'`. Default 384×600, min 300×400, max 800×800.
- **Chat messages persist qua navigation** — chatStore Zustand giữ state trong memory + localStorage, không reset khi navigate.
- **Widget render qua Portal:** `ChatWidgetPortal` mount vào `document.body` — z-index luôn cao nhất (z-50 button, z-[9999] panel), không bị clip bởi `overflow: hidden` của parent.
- **Voice search:** `use-speech-recognition.ts` dùng Web Speech API với `lang: 'vi-VN'` — chỉ hoạt động trên HTTPS và Chrome/Edge. Không có fallback tự động.
- **Rate limit backend:** `chatbotLimiter` = 20 req/60s (dev: 200). Khi test local → set `NODE_ENV=development`.
- **Typing indicator:** khi gửi, ChatWidget push `{ isLoading: true }` vào store ngay lập tức, sau đó replace bằng response thực. Nếu lỗi → replace bằng error message.
- **`isLoading` trong Message type** chỉ dùng tạm thời cho typing indicator — không persist vào localStorage.

---

# 9. Tests

Không có test file riêng trong `features/ai/`. Chatbot được test ở backend:

- `backend/__tests__/modules/ai/` — unit tests AI service, vector search
- `backend/__api__/chatbot.api.test.js` — API tests cho `/chatbot/message`, `/chatbot/analytics`
