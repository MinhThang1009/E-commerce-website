# Embedding Service — TechStore Backend

← Quay lại [`services/CLAUDE.md`](../CLAUDE.md) | [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Provider Chain](#2-provider-chain)
- [3. API](#3-api)
- [4. Configuration](#4-configuration)
- [5. Gotchas](#5-gotchas)

---

# 1. Tổng quan

`unified-embedding.js` — singleton service cung cấp text embedding cho vector search. Hỗ trợ nhiều provider với automatic fallback chain.

---

# 2. Provider Chain

Thứ tự ưu tiên (build từ env vars):

| Priority | Provider    | Model                            | Env var        |
| -------- | ----------- | -------------------------------- | -------------- |
| 1        | Jina v3     | `jina-embeddings-v3`             | `JINA_API_KEY` |
| 2        | HF Instruct | `multilingual-e5-large-instruct` | `HF_API_KEY`   |
| 3        | HF Base     | `multilingual-e5-large`          | `HF_API_KEY`   |

Tất cả providers output 1024-dimensional vectors. Dimension validation throw nếu sai.

Provider fallback: nếu provider 1 lỗi → thử provider 2, v.v. Provider cuối lỗi → throw.

---

# 3. API

```javascript
const embeddingService = require('@services/embedding/unified-embedding');

// Generate embedding
const vector = await embeddingService.generateEmbedding(text, 'query');
// type: 'query' (search queries) hoặc 'passage' (documents/products)

// Check availability
if (!embeddingService.isAvailable()) {
  /* no provider configured */
}

// Active provider name
console.log(embeddingService.activeName); // 'jina' | 'multilingual-e5-large-instruct' | ...
```

---

# 4. Configuration

Env vars:

- `JINA_API_KEY` — Jina v3 API key (primary)
- `HF_API_KEY` — HuggingFace Inference API key (fallback)

Prefix strategy:

- Jina: task type `retrieval.passage` / `retrieval.query`
- HF Instruct: prefix `passage: ` / `Instruct: Given a product search query, retrieve relevant Vietnamese e-commerce products\nQuery: `
- HF Base: prefix `passage: ` / `query: `

---

# 5. Gotchas

- Nếu không có env var nào → `isAvailable()` trả false, `generateEmbedding()` throw
- Dùng bởi: VectorStore (`@services/vector-store`), AI module chatbot (qua VectorStore)
- Rate limiting của provider không được xử lý tự động — retry logic là trách nhiệm của caller
- `activeName` chỉ cho biết provider được config đầu tiên, không phải provider đang thực sự xử lý request
