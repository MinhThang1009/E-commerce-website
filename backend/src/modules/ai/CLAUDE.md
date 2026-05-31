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
  - [3.2 ChatbotService — Full RAG flow + LLM gateway + session](#32-chatbotservice--full-rag-flow--llm-gateway--session)
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
  const aiService = new AIService({ aiRepository, chatbotService, logger });
  const aiController = new AIController({ aiService, logger });
};
```

`vectorStoreService` được require trực tiếp trong `chatbot-service.js` bằng lazy require + try/catch — nếu không load được thì là `null`, chatbot vẫn hoạt động không có retrieval. Đây là shared service, không thuộc module này.

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
      CLAUDE.md                                  — services/core/CLAUDE.md
    chatbot/
      chatbot-service.js                         — Full RAG flow + LLM HTTP client + session memory (Map)
      language/
        language-detector.js                     — Detect Vietnamese / English input
      keyword/
        keyword-fallback.js                      — Fallback response khi LLM không available
      query/
        fuzzy-expander.js                        — Expand query (prefix + edit-distance) khi LLM unavailable
      prompt/
        prompt-builder.js                        — Build system prompt + RAG context
        response-parser.js                       — Parse structured JSON response từ LLM
      CLAUDE.md                                  — services/chatbot/CLAUDE.md
    product/
      product-name-generator.js                  — Sinh tên sản phẩm từ selected attributes
      CLAUDE.md                                  — services/product/CLAUDE.md
    embedding/
      CLAUDE.md                                  — services/embedding/CLAUDE.md (files đã xóa)
    translate/
      translate-service.js                       — Dịch Vi→En (DeepL + OpenRouter fallback)
      CLAUDE.md                                  — services/translate/CLAUDE.md
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

- `handleMessage({ message, userId, sessionId })` — delegate hoàn toàn cho `chatbotService.handleMessage()`, trả về `{ response, products, suggestions, intent }`
- `getRecommendations({ type, limit })` — `type='deals'` → `repo.findActiveDeals(limit)`; mọi type khác → `repo.findFeaturedProducts(limit)`
- `trackAnalytics({ event, userId, sessionId, productId, value, metadata, timestamp })` — ghi event vào `ChatMessage`-like analytics table qua `repo.createAnalyticsEvent()`
- `addToCart({ productId, variantId, quantity, sessionId, userId })` — verify product active + stock không bằng 0, insert CartItem qua repo, ghi analytics event `product_added_to_cart`

## 3.2 ChatbotService — Full RAG flow + LLM gateway + session

**`services/chatbot/chatbot-service.js`** là singleton (`module.exports = new ChatbotService()`). Đây là class duy nhất xử lý toàn bộ RAG pipeline:

**Flow 7 bước trong `handleMessage()`:**

1. `validateMessage()` — không rỗng, ≤500 ký tự → throw AppError 400 nếu không hợp lệ
2. `expandAbbreviations()` — chuẩn hóa query (ip→iPhone, ss→Samsung...)
3. `isPromptInjection` → early return; off-topic check là `classifyIntent(normalizedQuery) === 'off_topic'` trong `_preprocessMessage`, KHÔNG gọi `isOffTopic` trực tiếp → early return, không gọi retrieval hay LLM
4. Load session history từ `conversationHistory` Map
5. **Retrieval**: `_enrichQueryFromHistory(normalizedQuery, conversationHistory)` chạy TRƯỚC `_retrieveProducts` (append product names từ history khi query có đại từ đó/này/kia/nó hoặc follow-up ngắn ≤50 ký tự), rồi `Promise.all(rewriteQuery + hybridSearch)` song song, refined search nếu rewrite khác, fallback minScore=0 topK=3 nếu rỗng
6. **Generation**: `augmentAndGenerate()` → build prompt → LLM → parse JSON
7. **Persist**: cập nhật session memory + `ChatMessage` DB (fire-and-forget). Assistant message lưu kèm `metadata = JSON.stringify({ products, suggestions })` — từ migration `2026052501-add-metadata-to-chat-messages.js`

**Các concerns khác:**

- **Provider rotation**: `LLM_API_KEY + LLM_BASE_URL + LLM_MODEL_1` (primary) + `LLM_MODEL_2` (fallback). Retry khi 429/402/500/503. Fallback `simpleKeywordMatch` khi hết providers.
- **rewriteQuery fallback**: khi LLM down, dùng `fuzzyExpandQuery` (prefix + edit-distance so với product catalog) thay vì trả null.
- **Session memory**: `Map<sessionId, { messages, lastAccess }>`. Max 10 turns, 500 sessions, TTL 30 phút. LRU eviction. Reset khi restart.
- **Catalog cache**: brands + categories, TTL 5 phút (`_catalogCacheExpiry`).
- **LLM response format**: `response_format: { type: 'json_object' }`, temperature 0.3, max_tokens 800.

## 3.4 AIPolicy — input validation và intent classification

**`services/core/ai-policy.js`** — pure functions, không có side effects:

- `validateMessage(msg)` — không rỗng, ≤500 ký tự
- `expandAbbreviations(text)` — regex-based expansion cho brand/model abbreviations
- `isOffTopic(msg)` — regex pattern: thời tiết, bóng đá, âm nhạc, phim, nấu ăn, sức khỏe, tin tức
- `classifyIntent(text)` — 6 intents: `off_topic`, `order_inquiry`, `policy`, `pricing`, `product_search`, `general`
- `isPromptInjection(text)` — detect 15 loại injection (24 regex, EN+VI, OWASP LLM01:2025): direct override, data exfiltration, jailbreak, social engineering, stealth injection

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

| Method | Path                       | Auth                 | Rate Limit                                        | Mô tả                                                                                  |
| ------ | -------------------------- | -------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| POST   | `/chatbot/message`         | optionalAuthenticate | chatbotLimiter (20 req/60s, prod và dev như nhau) | Gửi message nhận RAG response                                                          |
| GET    | `/chatbot/recommendations` | optionalAuthenticate | —                                                 | Gợi ý sản phẩm (`?type=deals` hoặc featured)                                           |
| POST   | `/chatbot/analytics`       | authenticate         | —                                                 | Track analytics event (yêu cầu login)                                                  |
| POST   | `/chatbot/cart/add`        | authenticate         | —                                                 | Thêm sản phẩm vào giỏ qua chatbot                                                      |
| POST   | `/chatbot/session/clear`   | —                    | —                                                 | Xóa session history theo `sessionId` (hoặc toàn bộ nếu không có). Dùng cho demo/debug. |

---

# 5. Dependencies

## 5.1 Depends on (module này dùng)

- `chatbotService` — inject vào `AIService` (bắt buộc, throw nếu thiếu)
- `@services/vector-store/vector-store` — hybrid search (require trực tiếp trong chatbot-service.js, lazy try/catch)
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
- **`vectorStoreService` optional** — lazy require trong chatbot-service.js, có thể là `null`. `handleMessage` bỏ qua bước retrieval khi `vectorStoreService = null`.
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
| `services/chatbot/chatbot-service.test.js`                   | Unit        | Full RAG flow + LLM gateway + session management      |
| `services/chatbot/chatbot-cache-session.test.js`             | Unit        | Session catalog data management                       |
| `services/chatbot/chatbot.test.js`                           | Unit        | Chatbot integration tests                             |
| `services/chatbot/language/language-detector.test.js`        | Unit        | Language detection                                    |
| `services/chatbot/keyword/keyword-fallback.test.js`          | Unit        | Fallback response                                     |
| `services/chatbot/prompt/prompt-builder.test.js`             | Unit        | Prompt building                                       |
| `services/chatbot/prompt/response-parser.test.js`            | Unit        | Response parsing                                      |
| `services/chatbot/prompt/response-parser.edge-cases.test.js` | Unit        | Response parser edge cases                            |
| `services/product/product-name-generator.test.js`            | Unit        | Name generator                                        |
| `services/translate/translate-service.test.js`               | Unit        | Translation service                                   |
| `controllers/ai-controller.test.js`                          | Unit        | HTTP layer                                            |
| `controllers/ai-controller.chatbot.test.js`                  | Unit        | Chatbot HTTP scenarios                                |
| `repositories/ai-repository.test.js`                         | Unit        | Repository queries                                    |
| `repositories/ai-repository.addToCart.test.js`               | Unit        | Add to cart qua repository                            |
| `src/__integration__/ai-chatbot.integration.test.js`         | Integration | DB integration (MySQL thật)                           |
| `src/__api__/ai-chatbot.http.test.js`                        | API HTTP    | End-to-end HTTP                                       |
| `src/__api__/ai-edge-cases.http.test.js`                     | API HTTP    | HTTP edge cases                                       |
