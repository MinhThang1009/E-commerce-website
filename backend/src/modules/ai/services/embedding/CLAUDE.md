# Embedding Sub-Services — AI Module

← Quay lại [`ai/CLAUDE.md`](../../CLAUDE.md) | [`backend/CLAUDE.md`](../../../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. File Map](#2-file-map)
- [3. Từng file](#3-từng-file)
  - [3.1 embedding.js](#31-embeddingjs)
  - [3.2 vi-embedding.js](#32-vi-embeddingjs)
- [4. Quan hệ với shared embedding](#4-quan-hệ-với-shared-embedding)
- [5. Gotchas](#5-gotchas)

---

# 1. Tổng quan

Hai HTTP client gọi embedding API bên ngoài. `embedding.js` dùng OpenRouter (English-first, model `text-embedding-3-small`); `vi-embedding.js` dùng HuggingFace với model `multilingual-e5-large` để xử lý tiếng Việt tốt hơn. Cả hai đều là singleton, không nhận DI.

> **Lưu ý quan trọng:** Đây là embedding services **trong `modules/ai/`** — khác hoàn toàn với `backend/src/services/embedding/` là shared embedding service dùng bởi vector store. Hai thứ này độc lập nhau.

---

# 2. File Map

```
embedding/
  embedding.js       — Singleton; OpenRouter API; generateEmbedding + generateBatchEmbeddings
  vi-embedding.js    — Singleton; HuggingFace API; generateEmbedding (query/passage prefix)
```

---

# 3. Từng file

## 3.1 embedding.js

**Singleton** (`module.exports = new EmbeddingService()`).

**Config từ env:**
- `OPENROUTER_API_KEY` — bắt buộc để hoạt động; nếu thiếu hoặc là `'demo-key'` → throw khi gọi
- Model cố định: `openai/text-embedding-3-small` qua `https://openrouter.ai/api/v1/embeddings`

**Exported methods:**

| Method | Signature | Mô tả |
|---|---|---|
| `generateEmbedding` | `(text) → Promise<number[]>` | Single text → embedding vector; retry 3 lần với backoff 500/1000/2000ms |
| `generateBatchEmbeddings` | `(texts) → Promise<number[][]>` | Mảng texts → mảng embedding vectors; timeout 60s (gấp đôi single); retry 3 lần |

**Retry policy:** exponential backoff `[500, 1000, 2000]ms` cho cả hai methods. Lần thử cuối throw error.

**Null check:** validate `response.data?.data?.[0]?.embedding` — throw nếu API trả format sai thay vì crash ngầm.

## 3.2 vi-embedding.js

**Singleton** (`module.exports = new VietnameseEmbeddingService()`).

**Config từ env:**
- `HF_API_KEY` — HuggingFace token; nếu thiếu → `isAvailable()` trả `false`, `generateEmbedding` throw
- Model: `intfloat/multilingual-e5-large` qua `https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large`
- `EXPECTED_DIM = 1024` — validate output dimensions

**Exported methods:**

| Method | Signature | Mô tả |
|---|---|---|
| `isAvailable` | `() → boolean` | Trả `true` nếu `HF_API_KEY` được set |
| `generateEmbedding` | `(text, type='query') → Promise<number[]>` | Prefix `'query: '` hoặc `'passage: '` trước text; retry 2 lần với backoff 500/1000ms |

**Prefix bắt buộc của `multilingual-e5-large`:**
- `type='query'` → prefix `'query: '` — dùng khi search (RAG retrieval)
- `type='passage'` → prefix `'passage: '` — dùng khi index documents (build vector store)

Prefix này là yêu cầu của model, không phải optional — bỏ qua làm giảm retrieval quality đáng kể.

**Dimension validation:** throw nếu output không đúng 1024 dims.

---

# 4. Quan hệ với shared embedding

`modules/ai/services/embedding/` (file này) khác với `src/services/embedding/` (shared service):

| | `modules/ai/services/embedding/` | `src/services/embedding/` |
|---|---|---|
| Dùng bởi | Có thể dùng trong AI module context | `vector-store` service (shared) |
| DI | Singleton, không nhận DI | Inject vào vector store |
| Scope | Module-local | Global shared service |

---

# 5. Gotchas

- **`demo-key` bị treat như thiếu key** — cả `embedding.js` lẫn logic khác check `=== 'demo-key'` để block request thực.
- **HuggingFace API không ổn định** — retry 2 lần (ít hơn OpenRouter 3 lần) vì HF thường hồi phục nhanh.
- **`vi-embedding.js` chỉ có `generateEmbedding` (không có batch)** — dùng cho real-time query embedding, không phải bulk indexing.
- **Nếu `HF_API_KEY` không có**, vector store fallback sang English embedding — log warning khi khởi tạo nhưng không throw.
- **Response format của multilingual-e5-large:** trả `[float, ...]` hoặc `[[float, ...]]` — code check `Array.isArray(response.data[0])` để normalize.
