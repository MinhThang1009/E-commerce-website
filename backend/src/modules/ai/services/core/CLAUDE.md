# Core Sub-Services — AI Module

← Quay lại [`ai/CLAUDE.md`](../../CLAUDE.md) | [`backend/CLAUDE.md`](../../../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. File Map](#2-file-map)
- [3. Từng file](#3-từng-file)
  - [3.1 ai-service.js](#31-ai-servicejs)
  - [3.2 ai-policy.js](#32-ai-policyjs)
- [4. Gotchas](#4-gotchas)

---

# 1. Tổng quan

Hai file nền tảng của AI module: `ai-service.js` là orchestration layer giữa Controller và các sub-services; `ai-policy.js` là tập hợp pure functions kiểm tra/chuẩn hóa input chatbot. Không có logic AI phức tạp ở đây — logic đó nằm trong `chatbot/`.

---

# 2. File Map

```
core/
  ai-service.js     — Orchestration layer; 5 methods (2 core + 3 session delegators); nhận DI từ module.js
  ai-policy.js      — Pure functions: validate, normalize, classify intent, detect injection
```

---

# 3. Từng file

## 3.1 ai-service.js

**Class** `AIService` — nhận DI qua constructor, export class (không phải singleton).

Constructor deps: `{ aiRepository, chatbotService, logger }`.

**5 methods** (2 core + 3 session delegators wired tại `routes.js`):

| Method               | Signature                                                                                 | Mô tả                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `handleMessage`      | `({ message, userId, sessionId }) → Promise<{ response, products, suggestions, intent }>` | Delegate hoàn toàn cho `chatbotService.handleMessage()`                      |
| `addToCart`          | `({ productId, variantId, quantity, sessionId, userId }) → Promise<Object>`               | Verify stock + insert CartItem + ghi analytics event `product_added_to_cart` |
| `clearSession`       | `(sessionId) → ...`                                                                       | Delegate `chatbotService.clearSession()`                                     |
| `getSessionMessages` | `(sessionId) → Promise<...>`                                                              | Delegate `chatbotService.getSessionMessages()`                               |
| `registerSession`    | `(sessionId) → ...`                                                                       | Delegate `chatbotService.registerSession()`                                  |

**Business logic trong `addToCart`:** (1) tổng stock = `reduce(variants[].stockQuantity)` — throw `AppError 404` nếu product không tồn tại; `AppError 400` nếu `status !== 'active'` HOẶC (tổng stock ≤ 0 VÀ `product.stockQuantity` ≤ 0). (2) Nếu `variantId` cụ thể được truyền vào → kiểm thêm `variant.stockQuantity` của đúng variant đó, throw `AppError 400` nếu hết hàng. Repository `addToCart` bọc trong transaction để tránh race condition.

`limit` từ query string là string → `parseInt(limit, 10)` trước khi gọi repo.

## 3.2 ai-policy.js

**Pure functions** — không có side effects, không gọi DB hay external API. Export trực tiếp (không class).

**Exported:**

| Export                | Signature                                         | Mô tả                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateMessage`     | `(message) → { valid: boolean, reason?: string }` | Không rỗng, ≤ 500 ký tự, phải có ít nhất 1 chữ cái/chữ số                                                                                                                                                                                                   |
| `expandAbbreviations` | `(text) → string`                                 | Regex-based 3 lớp: (1) brand abbreviations `ip→iPhone, ss→Samsung, mb→MacBook, r5→AMD Ryzen 5, bnh→bao nhiêu, bh→bảo hành`; (2) EN→VI `smartphone→điện thoại, tablet→máy tính bảng`; (3) VI không dấu→có dấu `gia→giá, trieu→triệu, giao hang→giao hàng`... |
| `isOffTopic`          | `(message) → boolean`                             | Regex check: thời tiết, bóng đá, âm nhạc, phim, nấu ăn, sức khỏe, tin tức (cả vi + en)                                                                                                                                                                      |
| `classifyIntent`      | `(normalizedText) → string`                       | 6 intents theo thứ tự ưu tiên (xem bên dưới)                                                                                                                                                                                                                |
| `isPromptInjection`   | `(text) → boolean`                                | Detect 15 loại injection (24 regex, EN+VI) — đối chiếu OWASP LLM01:2025                                                                                                                                                                                     |
| `MAX_MESSAGE_LENGTH`  | `number`                                          | `500` (hằng số)                                                                                                                                                                                                                                             |

**6 intents của `classifyIntent` (thứ tự ưu tiên):**

1. `off_topic` — off-topic check trước (tránh "bóng đá Samsung" → `product_search`)
2. `order_inquiry` — đơn hàng, giao hàng, tracking
3. `policy` — bảo hành, đổi trả, chính sách
4. `pricing` — giá, bao nhiêu, tiền
5. `product_search` — tên brand/sản phẩm cụ thể, hoặc tư vấn/so sánh
6. `general` — mọi câu còn lại

**`ABBREV_MAP` regex flags:** `giu` (global + case-insensitive + Unicode). Pattern dùng `\b` word boundary và `(?=\d)` lookahead để tránh match sai. Map có 3 sections: brand abbreviations, EN→VI mappings, VI không dấu→có dấu (normalize query để intent classification và price filter hoạt động đúng khi user gõ thiếu dấu).

---

# 4. Gotchas

- **`ai-service.js` là class, không phải singleton** — được instantiate trong `module.js` với DI.
- **`ai-policy.js` không throw** — `validateMessage` trả `{ valid: false, reason }` thay vì throw; caller (`chatbotService.handleMessage`) quyết định cách xử lý (throw AppError 400).
- **`off_topic` check không gọi LLM** — intentional (< 1ms vs 1–3s LLM). Không thay bằng LLM call.
- **`isPromptInjection` được gọi trong `chatbotService.handleMessage` bước 3** — import từ `ai-policy.js`, thay thế `_isPromptInjection` private method cũ.
- **`addToCart` yêu cầu `userId`** — endpoint `/chatbot/cart/add` dùng `authenticate` middleware (không hỗ trợ guest).
