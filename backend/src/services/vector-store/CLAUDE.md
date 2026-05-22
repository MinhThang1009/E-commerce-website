# Vector Store — TechStore Backend

← Quay lại [`services/CLAUDE.md`](../CLAUDE.md) | [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. Architecture](#2-architecture)
- [3. API chính](#3-api-chính)
  - [3.1 upsertProduct](#31-upsertproduct)
  - [3.2 hybridSearch](#32-hybridsearch)
  - [3.3 Các methods khác](#33-các-methods-khác)
- [4. Auto-rebuild](#4-auto-rebuild)
- [5. Integration với Product model](#5-integration-với-product-model)
- [6. Gotchas](#6-gotchas)

---

# 1. Tổng quan

`HybridVectorStore` — singleton class. Kết hợp vector similarity search (cosine) và keyword search (BM25-like) để tìm sản phẩm phù hợp nhất với query.

---

# 2. Architecture

- **Storage:** Mảng JavaScript `this.items` + persist JSON sang `backend/data/vector-db.json`
- **Load:** Async on constructor (`this.loadPromise`), mọi method await trước khi xử lý
- **Vectors:** 1024-dimensional, generated bởi `EmbeddingService`
- **Hybrid scoring:** cosine similarity + keyword score, boost +0.05 nếu overlap, inject keyword-only results với score thấp

---

# 3. API chính

## 3.1 upsertProduct

```javascript
await vectorStore.upsertProduct(product);
```

Build embedding text từ: name + brand + category + description + price + stockQuantity (≤1500 chars), generate 1024d vector, lưu vào items. Tự động gọi bởi Product model hooks.

## 3.2 hybridSearch

```javascript
const results = await vectorStore.hybridSearch(query, (limit = 5), (minScore = 0.45));
// returns: [{ vector, text, metadata: { id, name, slug, price, thumbnail, inStock, ... }, score, lowConfidence? }]
```

Chạy song song `_vectorSearch` (cosine similarity) và `_keywordSearch` (token matching, name weight ×3). Kết hợp + sort theo score tổng hợp. Keyword-only results được inject với flag `lowConfidence: true`.

## 3.3 Các methods khác

- `clear()` — test utility
- `cosineSimilarity(v1, v2)` — pure math
- `save()` — persist to disk (fire-and-forget sau mỗi upsert)

---

# 4. Auto-rebuild

`server.js` gọi `checkVectorStoreSync()` sau khi start:

- So sánh `items.length` với active products count
- Nếu deviation >5% → exec `npm run ai:rebuild-vectors`

Manual rebuild: `npm run ai:rebuild-vectors` (`scripts/index-products.js`, cần `module-alias/register` ở đầu)

---

# 5. Integration với Product model

`product.js` model hooks:

- `afterCreate`: `vectorStore.upsertProduct(product)` (async, non-blocking)
- `afterUpdate`: `vectorStore.upsertProduct(product)` nếu relevant fields thay đổi
- `afterDestroy`: remove product từ items array

Lazy require tránh circular dependency.

---

# 6. Gotchas

- Backward compat: đọc được `item.vector` (mới) lẫn `item.vectorEn` (cũ)
- File `data/vector-db.json` lớn (~MB) — không commit thay đổi runtime của file này
- Memory footprint tỷ lệ với số lượng sản phẩm active × 1024 × 4 bytes
- Không có cơ chế cleanup khi product bị soft-delete — cần manual rebuild định kỳ
- Concurrent upserts: không có lock — race condition có thể xảy ra với bulk import
