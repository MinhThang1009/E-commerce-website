# Chatbot Sub-Services — AI Module

← Quay lại [`ai/CLAUDE.md`](../../CLAUDE.md) | [`backend/CLAUDE.md`](../../../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. File Map](#2-file-map)
- [3. Request Flow](#3-request-flow)
- [4. Từng file](#4-từng-file)
  - [4.1 chatbot-service.js](#41-chatbot-servicejs)
    - [4.2 rag/rag-pipeline.js](#42-ragrag-pipelinejs)
  - [4.4 prompt/prompt-builder.js](#44-promptprompt-builderjs)
  - [4.5 prompt/response-parser.js](#45-promptresponse-parserjs)
  - [4.6 keyword/keyword-fallback.js](#46-keywordkeyword-fallbackjs)
  - [4.7 language/language-detector.js](#47-languagelanguage-detectorjs)
- [5. Gotchas](#5-gotchas)

---

# 1. Tổng quan

RAG pipeline và các sub-services xử lý một chat message: validate → normalize → retrieve → augment → generate. Khu vực code phức tạp nhất trong module `ai`.

---

# 2. File Map

```
chatbot/
  chatbot-service.js          — Singleton; LLM HTTP client, session memory (Map)
  rag/
    rag-pipeline.js           — Orchestrator: validate → expand → search → rewrite → generate
  prompt/
    prompt-builder.js         — Pure fn: tạo RAG prompt từ products + userMessage
    response-parser.js        — Parse JSON response từ LLM, fallback nếu malformed
  keyword/
    keyword-fallback.js       — Fallback khi LLM không khả dụng hoặc parse fail
  language/
    language-detector.js      — Detect vi/en từ text (dấu → vi, keyword list → vi, else en)
```

---

# 3. Request Flow

```
POST /api/chatbot/message
  → AIService.handleMessage()
      → RAGPipeline.run(message, userId, sessionId)
            ① validate (AIPolicy: độ dài, off-topic, spam)
            ② expandAbbreviations (ip → iPhone, ss → Samsung...)
            ③ parallel: chatbotService.rewriteQuery(msg) + vectorStore.hybridSearch(msg)
            ④ nếu rewritten query khác → hybridSearch lại với query mới
            ⑤ chatbotService.handleMessage() → ChatbotService.getAIResponse()
                  → promptBuilder.createPrompt(msg, products)
                  → LLM HTTP call (provider rotation: 429/402/500/503 → thử next)
                  → responseParser.parseAIResponse(llmText, products)
                  → fallback: keywordFallback.simpleKeywordMatch()
```

---

# 4. Từng file

## 4.1 chatbot-service.js

**Singleton** (`module.exports = new ChatbotService()`).

Responsibilities:

- LLM HTTP calls với **provider rotation** (env: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`)
- **Session memory**: `Map<sessionId, { messages[], lastAccess }>` — reset khi restart
  - `MAX_HISTORY_TURNS = 10` (20 messages), `MAX_SESSIONS = 500`, `SESSION_TTL_MS = 30 phút`
- **Catalog data**: brands + categories load từ DB, refresh định kỳ

## 4.2 rag/rag-pipeline.js

Orchestrator. Constructor nhận `{ chatbotService, vectorStore }` — cả hai inject (không require trực tiếp).

Flow: validate → expand → parallel search+rewrite → merge results → generate.

`vectorStore` optional (null trong test) — pipeline degrade gracefully, trả empty products.

## 4.4 prompt/prompt-builder.js

Pure function `createPrompt(userMessage, products, context)`.

Inject product list (tên, giá, stock, category, brand, slug) + store info + matching rules + version warning vào system prompt. Không dùng instance state.

## 4.5 prompt/response-parser.js

`parseAIResponse(text, products, userMessage)`:

1. Strip markdown code fences nếu có
2. `JSON.parse` — nếu fail → regex extract `{...}` block → nếu vẫn fail → fallback `simpleKeywordMatch`
3. Validate fields: `response` (string), `products` (array), `intent` (string)

## 4.6 keyword/keyword-fallback.js

`simpleKeywordMatch(userMessage, products)` — tokenize message, match với `product.name + brand + category`. Name weight ×3 (tên quan trọng hơn).

`getFallbackResponse(lang)` — trả message xin lỗi khi không match được gì.

Dùng khi: LLM providers đều lỗi hoặc `parseAIResponse` fail.

## 4.7 language/language-detector.js

`detectLanguage(text)` — 3 rules theo thứ tự:

1. Có dấu Unicode tiếng Việt (`àáâ...`) → `'vi'`
2. Match danh sách từ không dấu phổ biến (`gia`, `bao nhieu`, `dien thoai`...) → `'vi'`
3. Else → `'en'`

Dùng bởi: `keywordFallback`, `chatbotService` (chọn ngôn ngữ response).

---

# 5. Gotchas

- **Session memory mất khi restart** — không persist. Đủ cho demo/KLTN.
- **Provider rotation chỉ retry HTTP errors** (429/402/500/503/network) — lỗi khác (400 bad request) → break ngay, không retry.
- **`rewriteQuery` fail không block** — RAGPipeline dùng original query nếu LLM rewrite lỗi.
- **`vectorStore = null` trong unit tests** — RAGPipeline handle null bằng cách skip search, trả empty products list.
- **`chatbotService` là singleton** — không reinitialize trong test; dùng `jest.spyOn` thay vì new instance.
