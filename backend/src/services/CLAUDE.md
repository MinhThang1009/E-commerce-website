# Services — Shared External Services

> Các service dùng chung toàn app (không thuộc module nào). Inject qua DI trong `app.js`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Thứ tự đọc](#1-thứ-tự-đọc)
- [2. email.js](#2-emailjs)
- [3. vector-store/vector-store.js](#3-vector-storevector-storejs)
- [4. embedding/unified-embedding.js](#4-embeddingunified-embeddingjs)

---

## 1. Thứ tự đọc

1. `email.js` — SMTP email sender (singleton, ~306 lines)
2. `vector-store/vector-store.js` — Hybrid semantic + keyword search (~587 lines)
3. `embedding/unified-embedding.js` — Multi-provider embedding API (~265 lines)

---

## 2. email.js

Gửi email qua nodemailer (Gmail SMTP hoặc custom SMTP). **Singleton** — transporter được khởi tạo 1 lần (singleton).

**7 functions export** (`sendEmail` low-level + 6 hàm dưới):

| Hàm                                                         | Trigger                        |
| ----------------------------------------------------------- | ------------------------------ |
| `sendOtpEmail(email, otp, lang)`                            | Xác thực email / đăng ký       |
| `sendResetPasswordEmail(email, token, lang)`                | Reset mật khẩu                 |
| `sendOrderConfirmationEmail(email, order, lang)`            | Đặt hàng thành công            |
| `sendOrderStatusUpdateEmail(email, order, lang)`            | Cập nhật trạng thái đơn        |
| `sendOrderCancellationEmail(email, order, lang)`            | Hủy đơn                        |
| `sendAdminFeedbackNotification(adminEmail, feedback, lang)` | Forward contact form lên admin |

**Env vars:** `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USERNAME`, `EMAIL_PASSWORD`, `EMAIL_FROM`, `EMAIL_FROM_NAME`, `FRONTEND_URL`

**Dùng bởi:** `auth` (OTP/reset), `orders` (confirm/status/cancel), `content` (feedback notify)

**Gotchas:**

- HTML templates tự escape user input (`escapeHtml()`) — chống XSS trong nội dung email
- Pool: 3 connections, 100 messages/connection — không tạo connection mới mỗi lần gửi

---

## 3. vector-store/vector-store.js

Hybrid search engine: cosine similarity (semantic) + BM25-inspired keyword search. Lưu vectors trong mảng JavaScript, persist sang `data/vector-db.json`.

**Key methods:**

| Method                                        | Mô tả                                        |
| --------------------------------------------- | -------------------------------------------- |
| `upsertProduct(product)`                      | Embed product → lưu vào store → ghi disk     |
| `hybridSearch(query, limit=5, minScore=0.45)` | Fuse semantic + keyword, boost overlap +0.05 |
| `clear()`                                     | Xóa toàn bộ vectors (dùng trong test)        |

**Dùng bởi:**

- `ai` module — chatbot product search
- `Product` model hooks — auto-upsert khi create/update/destroy
- `scripts/index-products.js` — bulk re-index

**Gotchas:**

- Constructor gọi `load()` async fire-and-forget; methods `await this.loadPromise` — không block startup
- Dimension cố định **1024D** — phải match embedding provider (Jina v3)
- Backward compat: đọc được cả `item.vector` (format mới) và `item.vectorEn` (format cũ)
- Auto-rebuild khi vector count lệch >5% so với active products — log "Rebuilding vector store..." là bình thường

---

## 4. embedding/unified-embedding.js

Provider-agnostic embedding API. **Fallback chain: Jina v3 → HF e5-large-instruct → HF e5-large.**

**Key interface:**

```js
const embedding = require('@services/embedding/unified-embedding');

// type: 'passage' (indexing) hoặc 'query' (search)
const vector = await embedding.generateEmbedding('iPhone 15 Pro', 'passage');

embedding.isAvailable(); // true nếu ≥1 provider configured
embedding.activeName; // tên provider đang active (vd: 'Jina v3')
```

**Env vars:** `JINA_API_KEY`, `HF_API_KEY`

**Dùng bởi:** `vector-store/vector-store.js` — chỉ 1 consumer duy nhất
