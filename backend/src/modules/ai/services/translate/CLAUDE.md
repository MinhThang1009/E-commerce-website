# Translate Sub-Service — AI Module

← Quay lại [`ai/CLAUDE.md`](../../CLAUDE.md) | [`backend/CLAUDE.md`](../../../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. File Map](#2-file-map)
- [3. translate-service.js](#3-translate-servicejs)
  - [3.1 translateBatch](#31-translatebatch)
  - [3.2 translateWithOpenRouter](#32-translatewithopenrouter)
  - [3.3 translateWithMyMemory](#33-translatewithmymemory)
- [4. Gotchas](#4-gotchas)

---

# 1. Tổng quan

Dịch mảng strings từ tiếng Việt sang tiếng Anh — dùng trong RAG pipeline để chuẩn hóa query trước khi embedding/search. Provider chính là OpenRouter (LLM-based); fallback về MyMemory free API khi OpenRouter không khả dụng.

---

# 2. File Map

```
translate/
  translate-service.js   — 3 functions; export { translateBatch }
```

---

# 3. translate-service.js

Không class, không singleton — export named function. Không nhận DI; đọc config từ env trực tiếp.

**Config từ env:**

- `OPENROUTER_API_KEY` — nếu thiếu hoặc `'demo-key'` → skip thẳng sang MyMemory
- `TRANSLATE_MODEL` — model ID trên OpenRouter; default `'deepseek/deepseek-v4-flash:free'`
- `FRONTEND_URL` — dùng làm `HTTP-Referer` header; default `'http://localhost:5173'`

## 3.1 translateBatch

```js
translateBatch(texts, from='vi', to='en') → Promise<string[]>
```

Entry point duy nhất được export. Flow:

1. Nếu `texts` rỗng → return ngay
2. Nếu có `OPENROUTER_API_KEY` (và không phải `demo-key`) → gọi `translateWithOpenRouter`
3. Nếu OpenRouter trả kết quả giống hệt input (không có item nào thực sự được dịch) → fallback MyMemory
4. Fallback: `translateWithMyMemory`

**Detect OpenRouter thất bại:** `result.some((r, i) => r !== texts[i])` — nếu không có item nào khác với input thì coi như OpenRouter không dịch được.

## 3.2 translateWithOpenRouter

```js
translateWithOpenRouter(texts, from, to, apiKey) → Promise<string[]>
```

Gọi `POST https://openrouter.ai/api/v1/chat/completions`. Temperature 0, max_tokens 3000, timeout 30s.

**Prompt strategy:** gửi `JSON.stringify(texts)` trong 1 request duy nhất, yêu cầu LLM trả JSON array cùng thứ tự. Giữ nguyên technical specs, số, đơn vị, tên model/brand.

**Parse response:** thử JSON.parse trực tiếp; nếu có markdown fence ` ```json ``` ` thì strip trước. Nếu parse fail → return `texts` gốc (không throw).

**Normalize output:** chấp nhận cả mảng trực tiếp lẫn object `{ translations }` / `{ result }` / `{ items }`. Validate length === texts.length; fallback từng item về original nếu không phải string.

**Error handling:** catch HTTP errors → log warning, return `texts` gốc (không throw).

## 3.3 translateWithMyMemory

```js
translateWithMyMemory(texts, from, to) → Promise<string[]>
```

Sequential loop — không parallel, có delay 200ms giữa các item để tránh rate limit.

**MyMemory API:** `GET https://api.mymemory.translated.net/get?q=<text>&langpair=vi|en`. Free, không cần API key. Giới hạn ~500 words/ngày per IP.

**Fallback per-item:** nếu API lỗi, trả về `PLEASE SELECT`, hoặc kết quả giống hệt input → return text gốc (không throw).

---

# 4. Gotchas

- **Không throw** — `translateBatch` luôn trả về mảng cùng length, fallback về original string khi mọi provider đều fail.
- **Sequential trong MyMemory** — delay 200ms/item để tránh rate limit; với mảng lớn (> 20 items) thì chậm đáng kể.
- **`TRANSLATE_MODEL` default là free model** — `deepseek/deepseek-v4-flash:free` có thể bị rate limit cao hơn paid models.
- **"Không dịch được" detection heuristic** — nếu tất cả items giống input (ví dụ: mọi thứ đã là tiếng Anh) thì OpenRouter bị bỏ qua dù thực ra đã chạy thành công. Edge case hiếm nhưng cần lưu ý.
- **MyMemory 500 words/ngày limit** — chỉ dùng được cho development/demo; production cần OpenRouter key hợp lệ.
