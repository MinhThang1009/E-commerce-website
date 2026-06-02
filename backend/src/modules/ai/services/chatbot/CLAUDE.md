# Chatbot Sub-Services — AI Module

← Quay lại [`ai/CLAUDE.md`](../../CLAUDE.md) | [`backend/CLAUDE.md`](../../../../../CLAUDE.md)

## Mục lục

- [1. Tổng quan](#1-tổng-quan)
- [2. File Map](#2-file-map)
- [3. Request Flow](#3-request-flow)
- [4. Từng file](#4-từng-file)
  - [4.1 chatbot-service.js](#41-chatbot-servicejs)
  - [4.2 prompt/prompt-builder.js](#42-promptprompt-builderjs)
  - [4.3 prompt/response-parser.js](#43-promptresponse-parserjs)
  - [4.4 keyword/keyword-fallback.js](#44-keywordkeyword-fallbackjs)
  - [4.5 language/language-detector.js](#45-languagelanguage-detectorjs)
- [5. Gotchas](#5-gotchas)

---

# 1. Tổng quan

`chatbot-service.js` là singleton xử lý toàn bộ RAG pipeline: validate → normalize → retrieve → augment → generate. Khu vực code phức tạp nhất trong module `ai`.

---

# 2. File Map

```
chatbot/
  chatbot-service.js          — Singleton; full RAG flow + LLM HTTP client + session memory
  prompt/
    prompt-builder.js         — Pure fn: tạo RAG prompt từ products + userMessage
    response-parser.js        — Parse JSON response từ LLM, fallback nếu malformed
  keyword/
    keyword-fallback.js       — Fallback khi LLM không khả dụng hoặc parse fail
  query/
    fuzzy-expander.js         — Expand viết tắt từ product catalog (prefix + edit-distance); fallback khi không có LLM provider
  language/
    language-detector.js      — Detect vi/en từ text (dấu → vi, keyword list → vi, else en)
```

---

# 3. Request Flow

```
POST /api/chatbot/message
  → AIService.handleMessage()
      → chatbotService.handleMessage(message, userId, sessionId)
            ① validateMessage (AppError 400 nếu không hợp lệ)
            ② expandAbbreviations (ip → iPhone, ss → Samsung...)
            ③ isPromptInjection → early return; offTopic = classifyIntent(normalizedQuery)==='off_topic' via _preprocessMessage, KHÔNG gọi isOffTopic trực tiếp
            ④ load conversationHistory từ Map (session memory)
            ⑤ _enrichQueryFromHistory(normalizedQuery, history) TRƯỚC parallel
                 → append tên SP từ ≤2 assistant messages gần nhất khi query
                   có đại từ chỉ định (đó/này/kia/nó) hoặc follow-up ngắn ≤50 ký tự → enrichedQuery
               parallel: rewriteQuery LLM + hybridSearch(enrichedQuery)
               → nếu rewrite khác → hybridSearch lại, chọn kết quả tốt hơn
               → fallback minScore=0 topK=3 nếu 0 kết quả
            ⑥ augmentAndGenerate() → promptBuilder.buildAugmentedPrompt(msg, products)
                  → LLM HTTP call (provider rotation: 429/402/500/503 → thử next)
                  → responseParser.parseLLMOutput(llmText, products)
                  → fallback: keywordFallback.simpleKeywordMatch()
            ⑦ persist: cập nhật session Map + ChatMessage DB (fire-and-forget)
               → assistant message lưu kèm metadata=JSON.stringify({products,suggestions})
                 khi KHÔNG phải fallback/off-topic
```

---

# 4. Từng file

## 4.1 chatbot-service.js

**Singleton** (`module.exports = new ChatbotService()`).

Responsibilities:

- **Full RAG pipeline** trong `handleMessage()` — 7 bước (xem Request Flow)
- LLM HTTP calls với **provider rotation** (env: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL_1` primary + `LLM_MODEL_2` + `LLM_MODEL_3` fallback). Provider dùng `LLM_BASE_URL` (OpenAI-compatible, vd llm.chiasegpu.vn) — KHÔNG phải OpenRouter (OpenRouter là của translate-service)
- **Ngân sách tổng LLM** `LLM_TOTAL_TIMEOUT_MS` (env, mặc định = `LLM_REQUEST_TIMEOUT_MS` 30s) bọc `augmentAndGenerate` qua `Promise.race` — quá hạn → fallback `simpleKeywordMatch` (chống treo khi endpoint chậm + rotation cộng dồn). `LLM_REQUEST_TIMEOUT_MS`/`LLM_REWRITE_TIMEOUT_MS` cũng env-configurable
- **Session memory**: `Map<sessionId, { messages[], lastAccess }>` — reset khi restart
  - `MAX_HISTORY_TURNS = 10` (20 messages), `MAX_SESSIONS = 500`, `SESSION_TTL_MS = 30 phút`
- **Catalog data**: brands + categories load từ DB, cache **TTL 5 phút** (`_catalogCacheExpiry = now + 5 * 60 * 1000`)
- `vectorStoreService` — lazy require tại module level, `null` nếu load thất bại

## 4.2 prompt/prompt-builder.js

Pure function `buildAugmentedPrompt(userMessage, products)`.

Inject product list (tên, giá, stock, category, brand, slug) + store info + matching rules + version warning vào system prompt. Không dùng instance state.

## 4.3 prompt/response-parser.js

`parseLLMOutput(rawLLMOutput, products, userMessage)`:

1. Strip markdown code fences nếu có
2. `JSON.parse` — nếu fail → regex extract `{...}` block → nếu vẫn fail → fallback `simpleKeywordMatch`
3. Map tên sản phẩm LLM trả về → object thực trong DB (fuzzy match 4 bước: exact, version keywords, numbers, word overlap ≥80%)
4. Dedup theo ID
5. `extractProductsFromText`: bổ sung SP LLM đề cập trong response text nhưng bỏ sót khỏi `matchedProducts` — dùng phrase boundary regex + dedup prefix (xét cả alreadyMatchedIds để tránh inject SP ngắn hơn khi SP dài hơn đã matched).

## 4.5 keyword/keyword-fallback.js

`simpleKeywordMatch(userMessage, products)` — tokenize message, match với `product.name + brand + category`. Name weight ×3 (tên quan trọng hơn).

`getFallbackResponse(lang)` — trả message xin lỗi khi không match được gì.

Dùng khi: LLM providers đều lỗi hoặc `parseLLMOutput` fail.

## 4.6 language/language-detector.js

`detectLanguage(text)` — 3 rules theo thứ tự:

1. Có dấu Unicode tiếng Việt (`àáâ...`) → `'vi'`
2. Match danh sách từ không dấu phổ biến (`gia`, `bao nhieu`, `dien thoai`...) → `'vi'`
3. Else → `'en'`

Dùng bởi: `keywordFallback`, `chatbotService` (chọn ngôn ngữ response).

---

# 5. Gotchas

- **Session memory mất khi restart** — không persist. Đủ cho demo/KLTN.
- **Provider rotation chỉ retry HTTP errors** (429/402/500/503/network) — lỗi khác (400 bad request) → break ngay, không retry.
- **`rewriteQuery` fail không block** — dùng `.catch(() => null)`, fallback về normalizedQuery. Khi LLM DOWN: dùng `fuzzyExpandQuery` (prefix + edit-distance so với product catalog) trước khi trả null — cải thiện recall cho typo và partial names.
- **`clearSession(sessionId)`** — xóa session khỏi `conversationHistory` Map. Nếu không có `sessionId` → xóa toàn bộ. Dùng cho demo/debug qua `POST /chatbot/session/clear`.
- **`vectorStoreService = null`** — `handleMessage` skip bước retrieval, trả empty products list. `jest.mock('@services/vector-store/vector-store')` trong tests.
- **`chatbotService` là singleton** — không reinitialize trong test; dùng `jest.spyOn` thay vì new instance.
- **Validation throw AppError** — `handleMessage` re-throw AppError (có `statusCode`) trong outer catch để controller xử lý HTTP status đúng.
