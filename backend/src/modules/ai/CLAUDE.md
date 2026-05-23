# AI Module — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../../../CLAUDE.md)

## Mục lục

- [1. Mục đích & Trách nhiệm](#1-mục-đích--trách-nhiệm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 DI Pattern](#12-di-pattern)
- [2. Cấu trúc Files](#2-cấu-trúc-files)
  - [2.1 File listing](#21-file-listing)
- [3. Business Logic Chính](#3-business-logic-chính)
  - [3.1 AIService — 4 methods chính](#31-aiservice--4-methods-chính)
  - [3.2 RAG Pipeline — chi tiết flow](#32-rag-pipeline--chi-tiết-flow)
  - [3.3 ChatbotService — LLM gateway và session](#33-chatbotservice--llm-gateway-và-session)
  - [3.4 AIPolicy — input validation và intent classification](#34-aipolicy--input-validation-và-intent-classification)
  - [3.5 Product Name Generator](#35-product-name-generator)
- [4. API Endpoints](#4-api-endpoints)
- [5. Dependencies](#5-dependencies)
  - [5.1 Depends on (module này dùng)](#51-depends-on-module-này-dùng)
  - [5.2 Used by (module khác dùng module này)](#52-used-by-module-khác-dùng-module-này)
- [6. Gotchas & Edge Cases](#6-gotchas--edge-cases)
- [7. Tests](#7-tests)

---

# 1. Mục đích & Trách nhiệm

## 1.1 Purpose

Cung cấp AI chatbot tư vấn sản phẩm công nghệ qua RAG (Retrieval-Augmented Generation) pipeline, recommendations sản phẩm (deals/featured), add-to-cart qua chatbot, và analytics tracking. Module cũng expose `product-name-generator` để `attribute` module inject qua setter.

## 1.2 DI Pattern

Module nhận full DI từ `app.js`:

```js
// module.js wires:
module.exports = ({ Product, ProductVariant, Category, chatbotService, sequelize, logger }) => {
  const aiRepository = new SequelizeAIRepository({ Product, ProductVariant, Category, sequelize });
  const ragPipeline = new RAGPipeline({ chatbotService, vectorStore: vectorStoreService });
  const aiService = new AIService({ aiRepository, ragPipeline, logger });
  const aiController = new AIController({ aiService, logger });
};
```

`vectorStoreService` được require trực tiếp từ `@services/vector-store/vector-store` trong module.js bằng try/catch — nếu không load được thì là `null`. Đây là shared service, không thuộc module này.

Hai dependencies bắt buộc (throw Error nếu thiếu): `Product`, `chatbotService`.

---

# 2. Cấu trúc Files

## 2.1 File listing

```
modules/ai/
  module.js                                      — DI wiring
  routes.js                                      — HTTP endpoints (basePath '/chatbot')
  controllers/
    ai-controller.js                             — 4 handlers: handleMessage, getRecommendations,
                                                   trackAnalytics, addToCart
  repositories/
    i-ai-repository.js                           — Interface
    sequelize-ai-repository.js                   — Product search, deals, addToCart, analytics event
  services/
    core/
      ai-service.js                              — Orchestration layer (~65 lines, 4 methods)
      ai-policy.js                               — Pure rules: validateMessage, expandAbbreviations,
                                                   isOffTopic, classifyIntent
    chatbot/
      chatbot-service.js                         — LLM HTTP client, session memory (Map)
      rag/
        rag-pipeline.js                          — RAG main flow: Validate→Normalize→Retrieve→Generate
      language/
        language-detector.js                     — Detect Vietnamese / English input
      keyword/
        keyword-fallback.js                      — Fallback response khi LLM không available
      prompt/
        prompt-builder.js                        — Build system prompt + RAG context
        response-parser.js                       — Parse structured JSON response từ LLM
    product/
      product-name-generator.js                  — Sinh tên sản phẩm từ selected attributes
      product-enricher.js                        — Enrich product data trước khi upsert vector store
    embedding/
      embedding.js                               — HTTP client gọi OpenRouter embedding API
      vi-embedding.js                            — Vietnamese-specific embedding preprocessing
    translate/
      translate-service.js                       — Dịch Vi→En (DeepL + OpenRouter fallback)
  validators/
    ai-validator.js
  dtos/
    ai-dto.js
  CLAUDE.md
```

> `@services/vector-store/` và `@services/embedding/` là shared services — không thuộc module này.

---

# 3. Business Logic Chính

## 3.1 AIService — 4 methods chính

**`services/core/ai-service.js`** (~65 lines) chỉ orchestrate, không chứa logic phức tạp:

- `handleMessage({ message, userId, sessionId })` — delegate hoàn toàn cho `ragPipeline.run()`, trả về `{ response, products, suggestions, intent }`
- `getRecommendations({ type, limit })` — `type='deals'` → `repo.findActiveDeals(limit)`; mọi type khác → `repo.findFeaturedProducts(limit)`
- `trackAnalytics({ event, userId, sessionId, productId, value, metadata, timestamp })` — ghi event vào `ChatMessage`-like analytics table qua `repo.createAnalyticsEvent()`
- `addToCart({ productId, variantId, quantity, sessionId, userId })` — verify product active + stock không bằng 0, insert CartItem qua repo, ghi analytics event `product_added_to_cart`

## 3.2 RAG Pipeline — chi tiết flow

**`services/chatbot/rag/rag-pipeline.js`** xử lý mỗi `POST /chatbot/message`:

```
1. validateMessage() — kiểm tra không rỗng, ≤2000 ký tự
2. expandAbbreviations() — ip→iPhone, ss→Samsung, mb→MacBook, r5→AMD Ryzen 5...
3. isOffTopic() — regex check (thời tiết, bóng đá, âm nhạc...) → early return, không gọi LLM
4. Song song: LLM rewrite query + hybridSearch(normalizedQuery, 10)
5. Nếu LLM rewrite khác → refined hybridSearch(rewrittenQuery, 10), chọn kết quả tốt hơn
6. Fallback: nếu 0 kết quả trên threshold → hybridSearch(query, 3, minScore=0)
7. chatbotService.handleMessage() với { retrievedProducts, normalizedQuery, llmRewrittenQuery }
```

Kết quả trả về: `{ response: string, products: Array, suggestions: Array, intent: string }`.

## 3.3 ChatbotService — LLM gateway và session

**`services/chatbot/chatbot-service.js`** là singleton (module.exports = new ChatbotService()):

- **Provider rotation**: Cấu hình qua env `LLM_API_KEY + LLM_BASE_URL + LLM_MODEL`. Thử lần lượt từng provider khi 429/402/500/503. Fallback `simpleKeywordMatch` khi hết tất cả providers.
- **Conversation history**: `Map<sessionId, { messages, lastAccess }>`. Max 10 turns (20 messages), max 500 sessions, TTL 30 phút. Reset khi server restart.
- **Catalog data**: brands + categories load từ DB khi cần.
- **Persist messages**: Lưu cặp user/assistant vào `ChatMessage` model sau mỗi response (kể cả fallback).
- **LLM response format**: `response_format: { type: 'json_object' }`, temperature 0.3, max_tokens 800.

## 3.4 AIPolicy — input validation và intent classification

**`services/core/ai-policy.js`** — pure functions, không có side effects:

- `validateMessage(msg)` — không rỗng, ≤2000 ký tự
- `expandAbbreviations(text)` — regex-based expansion cho brand/model abbreviations
- `isOffTopic(msg)` — regex pattern: thời tiết, bóng đá, âm nhạc, phim, nấu ăn, sức khỏe, tin tức
- `classifyIntent(text)` — 6 intents: `off_topic`, `order_inquiry`, `policy`, `pricing`, `product_search`, `general`
- `isPromptInjection(text)` — detect prompt injection attempts trong user input

## 3.5 Product Name Generator

**`services/product/product-name-generator.js`** — singleton, inject vào `attribute` module qua setter:

- `generateProductName(baseName, selectedAttributes, separator)` — load AttributeValue có `affectsName=true`, sort theo `attributeGroup.sortOrder` + `sortOrder`, join với separator
- `generateVariantName(baseName, attributesCombination, separator)` — wrapper cho `generateProductName`
- `previewProductName(baseName, selectedAttributes, options)` — preview không lưu DB, optional `includeDetails`
- `getNameAffectingAttributes(productId)` — list tất cả AttributeValue có `affectsName=true` và `isActive=true`
- `batchGenerateNames(items, separator)` — generate cho nhiều sản phẩm/biến thể

---

# 4. API Endpoints

Base path: `/api/chatbot`

| Method | Path                       | Auth                 | Rate Limit                                        | Mô tả                                        |
| ------ | -------------------------- | -------------------- | ------------------------------------------------- | -------------------------------------------- |
| POST   | `/chatbot/message`         | optionalAuthenticate | chatbotLimiter (20 req/60s, prod và dev như nhau) | Gửi message nhận RAG response                |
| GET    | `/chatbot/recommendations` | optionalAuthenticate | —                                                 | Gợi ý sản phẩm (`?type=deals` hoặc featured) |
| POST   | `/chatbot/analytics`       | authenticate         | —                                                 | Track analytics event (yêu cầu login)        |
| POST   | `/chatbot/cart/add`        | authenticate         | —                                                 | Thêm sản phẩm vào giỏ qua chatbot            |

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

- `chatbotService` — inject vào `RAGPipeline` (bắt buộc, throw nếu thiếu)
- `@services/vector-store/vector-store` — hybrid search (require trực tiếp trong module.js, try/catch)
- `Product`, `ProductVariant`, `Category` models — inject qua DI từ app.js
- `sequelize` — transaction support trong repository

## 5.2 Used by (module khác dùng module này)

- `attribute` module — inject `product-name-generator` qua `setNameGenerator()` setter
- `admin` module — chatbot stats (query `ChatMessage` model trực tiếp)
- `Product` model hooks — `afterCreate/afterUpdate/afterDestroy` tự động upsert/remove vector store

**Events**: Module không publish và không subscribe event nào (`subscribeEvents()` là empty function).

---

# 6. Gotchas & Edge Cases

- **`chatbotService` bắt buộc** — `module.js` throw Error nếu thiếu. `Product` cũng bắt buộc.
- **`vectorStoreService` optional** — require trong try/catch, có thể là `null`. `RAGPipeline` handle null vector store bằng cách bỏ qua retrieval step.
- **Off-topic check dùng regex thuần** — intentional, không gọi LLM để tránh tốn quota. Không thay bằng LLM call.
- **`POST /chatbot/analytics` yêu cầu `authenticate`** — không phải public endpoint.
- **Không có `GET /chatbot/history`** — endpoint này không tồn tại trong routes.js.
- **Conversation history reset khi restart** — Map không persist. Đủ cho demo/KLTN.
- **Cross-module import bị hook block** — không được `require('@modules/ai/services/...')` trực tiếp từ module khác ngoài `module.js`. Inject qua DI hoặc setter.
- **`product-name-generator.js` định nghĩa associations inline** — tự define `AttributeValue.belongsTo(AttributeGroup)` nếu chưa có, để tránh phụ thuộc thứ tự load.

---

# 7. Tests

| File                                                         | Loại        | Mô tả                                                 |
| ------------------------------------------------------------ | ----------- | ----------------------------------------------------- |
| `services/core/ai-service.test.js`                           | Unit        | Orchestration layer (4 methods)                       |
| `services/core/ai-policy.test.js`                            | Unit        | Off-topic, intent classification, abbreviation expand |
| `services/chatbot/chatbot-service.test.js`                   | Unit        | LLM gateway + session management                      |
| `services/chatbot/chatbot-cache-session.test.js`             | Unit        | Session catalog data management                       |
| `services/chatbot/chatbot.test.js`                           | Unit        | Chatbot integration tests                             |
| `services/chatbot/rag/rag-pipeline.test.js`                  | Unit        | RAG pipeline flow                                     |
| `services/chatbot/language/language-detector.test.js`        | Unit        | Language detection                                    |
| `services/chatbot/keyword/keyword-fallback.test.js`          | Unit        | Fallback response                                     |
| `services/chatbot/prompt/prompt-builder.test.js`             | Unit        | Prompt building                                       |
| `services/chatbot/prompt/response-parser.test.js`            | Unit        | Response parsing                                      |
| `services/chatbot/prompt/response-parser.edge-cases.test.js` | Unit        | Response parser edge cases                            |
| `services/product/product-name-generator.test.js`            | Unit        | Name generator                                        |
| `services/product/product-enricher.test.js`                  | Unit        | Product enricher                                      |
| `services/embedding/embedding.test.js`                       | Unit        | Embedding service                                     |
| `services/embedding/vi-embedding.test.js`                    | Unit        | Vietnamese embedding                                  |
| `services/translate/translate-service.test.js`               | Unit        | Translation service                                   |
| `controllers/ai-controller.test.js`                          | Unit        | HTTP layer                                            |
| `controllers/ai-controller.chatbot.test.js`                  | Unit        | Chatbot HTTP scenarios                                |
| `repositories/ai-repository.test.js`                         | Unit        | Repository queries                                    |
| `repositories/ai-repository.addToCart.test.js`               | Unit        | Add to cart qua repository                            |
| `src/__integration__/ai-chatbot.integration.test.js`         | Integration | DB integration (MySQL thật)                           |
| `src/__api__/ai-chatbot.http.test.js`                        | API HTTP    | End-to-end HTTP                                       |
| `src/__api__/ai-edge-cases.http.test.js`                     | API HTTP    | HTTP edge cases                                       |
