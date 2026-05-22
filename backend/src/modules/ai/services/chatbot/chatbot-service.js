/**
 * @file chatbot-service.js
 * @layer Service
 * @module ai
 *
 * ChatbotService — trung tâm điều phối giao tiếp với LLM và quản lý lịch sử hội thoại.
 *
 * Service này làm 3 việc chính:
 *   1. **Gọi LLM (getAIResponse)**: gửi request đến OpenRouter/OpenAI-compatible API,
 *      có cơ chế tự động chuyển provider khi gặp lỗi (provider rotation).
 *   2. **Quản lý lịch sử hội thoại (session memory)**: lưu trữ các tin nhắn trong
 *      phiên hội thoại, giới hạn số lượng để tránh tốn quá nhiều bộ nhớ.
 *   3. **Lưu tin nhắn vào DB (_persistMessages)**: ghi lịch sử để admin xem analytics.
 *
 * Singleton pattern (`module.exports = new ChatbotService()`):
 * Toàn bộ app dùng chung 1 instance — tránh khởi tạo lại, giữ session memory nhất quán.
 *
 * **Session memory — tại sao không dùng DB?**
 * Lưu lịch sử trong Map (RAM) nhanh hơn nhiều so với query DB mỗi tin nhắn.
 * Đánh đổi: mất history khi restart server — chấp nhận được cho demo/thesis.
 *
 * **Tại sao giới hạn 500 sessions, TTL 30 phút?**
 * Không có giới hạn → server chạy lâu tích lũy hàng nghìn sessions → RAM tăng vô hạn (memory leak).
 * 500 sessions × (10 turns × 2 messages × ~200 bytes) ≈ 2MB — chấp nhận được cho production.
 * TTL 30 phút: session không hoạt động sau 30 phút bị xóa → giải phóng RAM tự động.
 */
const axios = require('axios');
// try/catch nhất quán với module.js — nếu vector-store fail load, Path B dùng [] thay vì crash
let vectorStoreService = null;
try {
  vectorStoreService = require('@services/vector-store/vector-store');
} catch {
  // vectorStoreService = null → Path B fallback về empty products
}
const { detectLanguage } = require('@modules/ai/services/chatbot/language/language-detector');
const { expandAbbreviations, classifyIntent } = require('@modules/ai/services/core/ai-policy');
const logger = require('@utils/logger');
const promptBuilder = require('@modules/ai/services/chatbot/prompt/prompt-builder');
const responseParser = require('@modules/ai/services/chatbot/prompt/response-parser');
const keywordFallback = require('@modules/ai/services/chatbot/keyword/keyword-fallback');

// ════════════════════════════════════════════════════════════════════════════════
// CÁC HẰNG SỐ CẤU HÌNH — tập trung ở đầu file để dễ điều chỉnh
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Số lượt hội thoại tối đa lưu trong session memory mỗi session.
 * 1 turn = 1 lượt hỏi đáp = 2 messages (1 user + 1 assistant).
 * 10 turns = 20 messages tổng.
 *
 * Tại sao giới hạn 10?
 * LLM có giới hạn context window — nếu inject quá nhiều history vào prompt,
 * LLM sẽ chậm hơn và tốn nhiều token (= tốn tiền API quota hơn).
 * 10 turns đủ để LLM nhớ ngữ cảnh hội thoại vừa rồi.
 */
const MAX_HISTORY_TURNS = 10;

/**
 * Số sessions tối đa lưu đồng thời trong conversationHistory Map.
 *
 * Khi vượt ngưỡng → _evictStaleSessions() xóa session ít dùng nhất (LRU).
 * 500 sessions × ~4KB/session ≈ 2MB RAM — chấp nhận được cho production.
 */
const MAX_SESSIONS = 500;

/**
 * Thời gian tối đa (milliseconds) một session có thể không hoạt động.
 * Session không có tin nhắn mới sau 30 phút → _evictStaleSessions() xóa.
 * 30 * 60 * 1000 = 1.800.000 ms = 30 phút.
 */
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Temperature (mức độ ngẫu nhiên) của LLM khi sinh câu trả lời tư vấn sản phẩm.
 *
 * Thang đo 0-2: 0 = hoàn toàn deterministic (cùng input → cùng output),
 *               1 = cân bằng, 2 = rất creative/ngẫu nhiên.
 * 0.3 = thấp → câu trả lời ổn định, ít "sáng tạo" quá mức → giảm nguy cơ hallucination.
 * Phù hợp cho usecase tư vấn sản phẩm: cần chính xác, không cần sáng tạo.
 */
const LLM_TEMPERATURE = 0.3;

/**
 * Số token tối đa cho response của LLM khi tư vấn sản phẩm.
 *
 * 800 tokens ≈ ~600 từ tiếng Anh / ~400 từ tiếng Việt.
 * Đủ cho câu trả lời đầy đủ kèm danh sách 3-5 sản phẩm.
 * Không đặt quá cao: tốn quota API và tăng latency (LLM sinh text chậm hơn).
 */
const LLM_MAX_TOKENS = 800;

/**
 * Timeout (milliseconds) cho request đến LLM khi sinh câu trả lời chính.
 * 30 giây đủ cho LLM xử lý prompt phức tạp và trả về JSON response đầy đủ.
 * Nếu timeout → provider đó bị coi là lỗi, chuyển sang provider tiếp theo.
 */
const LLM_REQUEST_TIMEOUT_MS = 30000;

/**
 * Số token tối đa cho response của LLM khi rewrite query.
 * 80 tokens đủ cho 1 dòng text ngắn — rewrite chỉ cần trả về query đã chuẩn hóa.
 * Giữ nhỏ để rewrite nhanh (ít token = ít thời gian sinh).
 */
const LLM_REWRITE_MAX_TOKENS = 80;

/**
 * Timeout (milliseconds) cho request LLM rewrite query.
 * Ngắn hơn LLM_REQUEST_TIMEOUT_MS vì rewrite chạy song song với vector search.
 * Nếu rewrite mất > 8 giây → bỏ qua, dùng query gốc, không block request chính.
 */
const LLM_REWRITE_TIMEOUT_MS = 8000;

// ════════════════════════════════════════════════════════════════════════════════
// CLASS DEFINITION
// ════════════════════════════════════════════════════════════════════════════════

/**
 * ChatbotService — singleton quản lý LLM calls và session memory cho chatbot.
 *
 * **Provider rotation — tại sao cần nhiều providers?**
 * Một LLM provider (OpenRouter/OpenAI) có thể tạm ngừng hoạt động hoặc hết quota.
 * Có nhiều providers → tự động chuyển sang provider tiếp theo khi gặp lỗi.
 * Hiện tại có 1 provider (cấu hình qua env), nhưng code hỗ trợ mở rộng.
 *
 * **Khi nào retry, khi nào không?**
 * Retry (chuyển provider tiếp): HTTP 429 (rate limit), 402 (quota hết),
 *   500/503 (server lỗi), network error (không kết nối được) — lỗi tạm thời.
 * Không retry: HTTP 400 (bad request — request sai format), 401 (auth fail — key sai)
 *   — lỗi cố định, dùng provider tiếp theo cũng sẽ lỗi tương tự.
 *
 * **Session memory structure:**
 * ```
 * conversationHistory: Map<sessionId, {
 *   messages: Array<{ role: 'user'|'assistant', content: string }>,
 *   lastAccess: number  // timestamp (Date.now()) lần cuối có tin nhắn mới
 * }>
 * ```
 */
class ChatbotService {
  constructor() {
    // ── Cấu hình providers từ environment variables ───────────────────────────
    // Hỗ trợ 1 provider hiện tại, có thể mở rộng bằng cách push thêm vào array
    this.providers = [];
    if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
      this.providers.push({
        key: process.env.LLM_API_KEY,
        url: `${process.env.LLM_BASE_URL}/chat/completions`,
        model: process.env.LLM_MODEL || 'openai/gpt-4.5',
      });
    }

    // ── Session memory — Map lưu lịch sử hội thoại theo sessionId ────────────
    // Lưu trong RAM (Map), không persist → mất khi restart server.
    this.conversationHistory = new Map();

    // ── DI: models được inject sau khi singleton tạo, qua initialize() ────────
    // Không require('@models') trực tiếp để tuân theo DI principle.
    // initialize() được gọi từ app.js ngay sau require singleton này.
    this.Brand = null;
    this.Category = null;
    this.ChatMessage = null;

    // ── Catalog cache: brands + categories, TTL 5 phút ───────────────────────
    // Tránh query DB mỗi request chatbot (Issue #7).
    this._catalogCache = null;
    this._catalogCacheExpiry = 0;

    // ── Delegate các extracted functions ─────────────────────────────────────
    // Các hàm này được tách ra file riêng để dễ test độc lập.
    // Gán lên instance để tests có thể gọi chatbotService.createPrompt() trực tiếp
    // (tránh phải mock require() — khó hơn nhiều trong Jest).
    this.createPrompt = promptBuilder.createPrompt;
    this.parseAIResponse = responseParser.parseAIResponse;
    this.simpleKeywordMatch = keywordFallback.simpleKeywordMatch;
    this.getFallbackResponse = keywordFallback.getFallbackResponse;

    this._initializeChatbot();
  }

  /**
   * Ghi log trạng thái khởi tạo chatbot khi server start.
   *
   * Gọi 1 lần trong constructor — chỉ log, không throw dù không có provider.
   * 0 providers vẫn OK: chatbot hoạt động bằng keyword fallback thay vì LLM.
   * Admin sẽ thấy log "Không tìm thấy AI provider" và biết cần cấu hình env.
   */
  _initializeChatbot() {
    try {
      if (this.providers.length > 0) {
        logger.info(
          `AI khởi tạo thành công — ${this.providers.length} providers (${this.providers.map((p) => p.model).join(', ')})`,
        );
      } else {
        logger.warn('Không tìm thấy AI provider nào, sử dụng phản hồi dự phòng');
      }
    } catch (error) {
      logger.error('Khởi tạo Chatbot thất bại:', error.message || error);
    }
  }

  /**
   * Gọi LLM để chuẩn hóa và cải thiện query của user.
   *
   * Tại sao dùng LLM để rewrite thay vì chỉ expandAbbreviations?
   * expandAbbreviations chỉ xử lý viết tắt đã biết (ip→iPhone).
   * LLM có thể hiểu ngữ cảnh sâu hơn:
   *   "ip17 pro bao nh" → "iPhone 17 Pro bao nhiêu tiền" (sửa lỗi chính tả + expand đầy đủ)
   *   "ss fold 6 vs ip16 pm" → "Samsung Galaxy Z Fold 6 vs iPhone 16 Pro Max"
   *
   * **Tại sao chạy song song với hybridSearch trong RAGPipeline?**
   * LLM rewrite mất 1-3 giây. Nếu chạy tuần tự trước hybridSearch:
   *   rewrite (1-3s) → search (0.5-1s) → tổng 1.5-4 giây thêm vào latency.
   * Chạy song song: cả hai chạy cùng lúc → tổng chỉ là max(1-3s, 0.5-1s) = 1-3 giây.
   *
   * **Nếu LLM rewrite lỗi thì sao?**
   * Trả về null → pipeline dùng query gốc (đã qua expandAbbreviations).
   * Timeout ngắn (8s) để không làm chậm toàn bộ request khi LLM rewrite chậm.
   *
   * @param {string} message - Query gốc (đã qua expandAbbreviations).
   * @returns {Promise<string|null>} Query đã cải thiện, hoặc null nếu lỗi/không thay đổi được.
   */
  async rewriteQuery(message) {
    // Không có provider → không thể rewrite, trả null ngay
    if (this.providers.length === 0) return null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const res = await axios.post(
          provider.url,
          {
            model: provider.model,
            messages: [
              {
                role: 'system',
                content:
                  'You are a query normalizer for a tech store. Expand abbreviations and fix typos in the user\'s shopping query. Return ONLY 1 line of normalized text in the SAME language as input, NO explanation. Examples: "ip17 pro bnh" → "iPhone 17 Pro bao nhiêu", "ss s25 how much" → "Samsung S25 how much".',
              },
              { role: 'user', content: message },
            ],
            max_tokens: LLM_REWRITE_MAX_TOKENS,
            temperature: 0, // Temperature = 0: deterministic, không ngẫu nhiên — rewrite cần ổn định
          },
          {
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
            },
            timeout: LLM_REWRITE_TIMEOUT_MS,
          },
        );

        // Trích xuất text từ response (?.[] là optional chaining — tránh lỗi nếu thiếu field)
        const rewritten = res.data.choices?.[0]?.message?.content?.trim();
        // Chỉ trả về nếu LLM thực sự thay đổi query (khác với input) — tránh vô ích
        if (rewritten) return rewritten !== message ? rewritten : null;
        continue; // LLM trả về rỗng → thử provider tiếp theo
      } catch (err) {
        const status = err.response?.status;
        // Lỗi tạm thời → thử provider tiếp theo
        if (status === 429 || status === 402 || status === 500 || status === 503 || !err.response) {
          logger.debug(`[LLM Rewrite] Provider ${i + 1} lỗi (${status || err.code}), thử tiếp...`);
          continue;
        }
        // Lỗi không phục hồi (400 bad request, 401 auth fail) → dừng, không thử tiếp
        logger.debug(`[LLM Rewrite] Provider ${i + 1} lỗi không phục hồi được (${status}), dừng`);
        break;
      }
    }
    return null; // Tất cả providers đều lỗi hoặc không cải thiện được → dùng query gốc
  }

  /**
   * Xử lý một tin nhắn của user — entry point chính của ChatbotService.
   *
   * Được RAGPipeline gọi sau khi đã search sản phẩm (Path A — thông thường),
   * hoặc có thể gọi trực tiếp không qua RAGPipeline (Path B — legacy/testing).
   *
   * **Flow 6 bước chi tiết:**
   * ```
   * Bước 1 — Chuẩn hóa query:
   *   expandAbbreviations("ip15") → "iPhone 15"
   *   classifyIntent("iPhone 15 giá") → "product_search"
   *   (bỏ qua nếu RAGPipeline đã làm — context.normalizedQuery + context.preClassifiedIntent)
   *
   * Bước 2 — Off-topic early return:
   *   intent === 'off_topic' → trả response cố định ngay
   *   Không gọi LLM, không search sản phẩm → tiết kiệm quota + giảm latency
   *
   * Bước 3 — Load session history:
   *   Lấy messages[] từ conversationHistory Map theo sessionId
   *   Inject vào LLM prompt ở bước 5 → chatbot "nhớ" ngữ cảnh hội thoại trước
   *
   * Bước 4 — Retrieval (chỉ khi không qua RAGPipeline):
   *   Path A (chính): RAGPipeline đã search → dùng context.retrievedProducts
   *   Path B (legacy): gọi hybridSearch + rewriteQuery song song
   *
   * Bước 5 — Generation:
   *   getAIResponse(query, products, context, history)
   *   → build system prompt + RAG context → gọi LLM → parse JSON response
   *
   * Bước 6 — Persist:
   *   Cập nhật conversationHistory Map (session memory)
   *   _persistMessages() → lưu vào bảng ChatMessage (DB) cho analytics
   * ```
   *
   * @param {string} message - Tin nhắn gốc từ user.
   * @param {number|null} [userId=null] - ID user đã đăng nhập; null nếu khách vãng lai.
   * @param {string|null} [sessionId=null] - Session ID để track conversation history.
   *   null → không lưu/load history, chatbot không nhớ cuộc hội thoại.
   * @param {Object} [context={}] - Context từ RAGPipeline (bỏ qua bước đã làm):
   *   - `normalizedQuery` {string}: query đã expand abbreviations
   *   - `preClassifiedIntent` {string}: intent đã phân loại
   *   - `retrievedProducts` {Array}: sản phẩm đã search (skip bước retrieval)
   *   - `llmRewrittenQuery` {string}: query đã LLM rewrite (dùng cho generation)
   * @returns {Promise<Object>} Kết quả:
   *   `{ response: string, products: Array, suggestions: Array, intent: string }`
   */
  async handleMessage(message, userId = null, sessionId = null, context = {}) {
    const startTime = Date.now(); // Ghi thời điểm bắt đầu để tính response time
    try {
      // ── Bước 1: Chuẩn hóa query + phân loại intent ─────────────────────────
      logger.debug(`📝 Câu truy vấn gốc: "${message}"`);

      // Nếu RAGPipeline đã làm bước này → dùng kết quả sẵn có, không làm lại
      // (tránh gọi expandAbbreviations 2 lần cho cùng 1 request)
      const rewrittenQuery = context.normalizedQuery || expandAbbreviations(message);
      const intent = context.preClassifiedIntent || classifyIntent(rewrittenQuery);
      const searchMessage = rewrittenQuery;

      // Log query cuối cùng để debug — ưu tiên LLM-rewritten nếu có
      const displayQuery = context.llmRewrittenQuery || rewrittenQuery;
      if (displayQuery && displayQuery.toLowerCase() !== message.toLowerCase()) {
        logger.debug(`✨ Câu truy vấn đã viết lại: "${displayQuery}" (intent: ${intent})`);
      }

      // ── Bước 1b: Kiểm tra prompt injection — trả về fallback ngay, không gọi LLM ──
      if (this._isPromptInjection(message)) {
        logger.warn('[Security] Phát hiện prompt injection, từ chối xử lý');
        const isEn = detectLanguage(message) === 'en';
        const injectionResponse = {
          response: isEn
            ? 'I can only help with tech product inquiries.'
            : 'Mình chỉ có thể hỗ trợ tư vấn sản phẩm công nghệ ạ.',
          products: [],
          suggestions: isEn ? ['View phones', 'View laptops'] : ['Xem điện thoại', 'Xem laptop'],
          intent: 'off_topic',
        };
        this._persistMessages(
          sessionId,
          userId,
          message,
          injectionResponse.response,
          'off_topic',
          Date.now() - startTime,
          true,
        ).catch((err) => logger.warn('[Chatbot] Lưu injection message thất bại:', err.message));
        return injectionResponse;
      }

      // ── Bước 2: Off-topic → trả về response cố định, bỏ qua LLM ───────────
      // Tại sao không gọi LLM cho câu hỏi off-topic?
      // Câu trả lời luôn giống nhau ("nằm ngoài phạm vi hỗ trợ") → không cần LLM.
      // Tiết kiệm ~2-3 giây latency và không tốn quota API.
      if (intent === 'off_topic') {
        const lang = detectLanguage(message);
        const isEn = lang === 'en';
        const offTopicResponse = {
          response: isEn
            ? 'This question is outside my area of expertise 😅 I can only help with tech products like phones, laptops, smartwatches... Would you like to explore any products?'
            : 'Câu hỏi này nằm ngoài phạm vi mình có thể hỗ trợ ạ 😅 Mình chỉ tư vấn được về sản phẩm công nghệ như điện thoại, laptop, đồng hồ thông minh... Bạn cần tìm hiểu sản phẩm nào không?',
          products: [],
          suggestions: isEn
            ? ['View phones', 'View laptops', 'Deals & promotions', 'Get advice']
            : ['Xem điện thoại', 'Xem laptop', 'Sản phẩm khuyến mãi', 'Tư vấn thêm'],
          intent: 'off_topic',
        };
        // Persist off-topic message vào DB cho analytics (fire-and-forget — không block response)
        this._persistMessages(
          sessionId,
          userId,
          message,
          offTopicResponse.response,
          intent,
          Date.now() - startTime,
          true,
        ).catch((err) => logger.warn('[Chatbot] Lưu off-topic message thất bại:', err.message));
        return offTopicResponse;
      }

      // ── Bước 3: Load lịch sử hội thoại từ session memory ───────────────────
      // sessionEntry = { messages: [...], lastAccess: timestamp } hoặc null nếu chưa có
      const sessionEntry = sessionId ? this.conversationHistory.get(sessionId) : null;
      const conversationHistory = sessionEntry ? sessionEntry.messages : [];
      // conversationHistory được inject vào LLM ở bước 5 → LLM "nhớ" cuộc hội thoại

      // ── Bước 4: Retrieval — lấy sản phẩm liên quan ─────────────────────────
      let relevantProducts = [];
      let finalQuery = searchMessage;

      if (context.retrievedProducts) {
        // Path A (thông thường): RAGPipeline đã search, kết quả được truyền qua context
        // → dùng trực tiếp, không search lại (tiết kiệm thời gian + tránh kết quả khác nhau)
        relevantProducts = context.retrievedProducts;
        // Dùng LLM-rewritten query (nếu có) để xây prompt tốt hơn
        if (context.llmRewrittenQuery) finalQuery = context.llmRewrittenQuery;
      } else {
        // Path B (legacy): handleMessage gọi trực tiếp không qua RAGPipeline
        // Chạy song song LLM rewrite + vector search để giảm tổng thời gian chờ
        // Giải thích Promise.all: xem comment tương tự trong rag-pipeline.js
        const [llmRewrite, initialSearchResults] = await Promise.all([
          this.rewriteQuery(searchMessage),
          vectorStoreService.hybridSearch(searchMessage, 10).catch(() => []),
        ]);

        finalQuery = llmRewrite || searchMessage;
        if (llmRewrite && llmRewrite !== searchMessage) {
          logger.debug(`✨ [LLM Rewrite] "${searchMessage}" → "${llmRewrite}"`);
          try {
            const refinedResults = await vectorStoreService.hybridSearch(llmRewrite, 10);
            // Dùng kết quả của query rewritten nếu có; fallback về kết quả ban đầu nếu rỗng
            relevantProducts =
              refinedResults.length > 0
                ? refinedResults.map((r) => ({ ...r.metadata, score: r.score }))
                : initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
          } catch {
            // hybridSearch với query rewritten lỗi → fallback về kết quả ban đầu
            relevantProducts = initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
          }
        } else {
          relevantProducts = initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
        }

        // Không có sản phẩm nào vượt ngưỡng score → hạ ngưỡng, lấy top-3 gần nhất
        // Đánh dấu lowConfidence = true để prompt-builder cảnh báo LLM
        if (relevantProducts.length === 0) {
          logger.warn('Retrieval score < threshold cho mọi item — hạ threshold lấy top-3');
          try {
            const lowScoreResults = await vectorStoreService.hybridSearch(finalQuery, 3, 0);
            relevantProducts = lowScoreResults.map((r) => ({
              ...r.metadata,
              score: r.score,
              lowConfidence: true,
            }));
          } catch {
            relevantProducts = [];
          }
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`📦 Tìm thấy ${relevantProducts.length} sản phẩm liên quan qua RAG`);
      }

      // ── Bước 5: Generation — gọi LLM để sinh câu trả lời ──────────────────
      // getAIResponse nhận: query đã normalize, sản phẩm liên quan,
      //   context bổ sung, và lịch sử hội thoại (để LLM nhớ ngữ cảnh)
      const aiResponse = await this.getAIResponse(
        finalQuery,
        relevantProducts,
        { ...context, originalMessage: message },
        conversationHistory,
      );

      // ── Bước 6: Persist — cập nhật session memory + lưu DB ─────────────────
      if (sessionId) {
        // Thêm tin nhắn mới vào history, cắt bỏ tin cũ nếu vượt quá MAX_HISTORY_TURNS
        // slice(-(MAX_HISTORY_TURNS * 2)): lấy 20 phần tử cuối (10 turns × 2 messages)
        // Dấu - trước số nghĩa là đếm từ cuối mảng
        // Sanitize trước khi lưu vào history — history sẽ được inject vào LLM turn sau.
        // Dùng displayQuery (đã normalize) nếu có, fallback về message gốc.
        const userContentForHistory = this._sanitizeMessage(displayQuery || message);
        const updatedMessages = [
          ...conversationHistory,
          { role: 'user', content: userContentForHistory },
          { role: 'assistant', content: aiResponse.response || '' },
        ].slice(-(MAX_HISTORY_TURNS * 2));

        // Cập nhật lastAccess để _evictStaleSessions biết session này vừa dùng
        this.conversationHistory.set(sessionId, {
          messages: updatedMessages,
          lastAccess: Date.now(),
        });

        // Dọn dẹp session cũ/không dùng sau mỗi lần cập nhật
        this._evictStaleSessions();
      }

      const responseTimeMs = Date.now() - startTime;
      // Lưu cặp tin nhắn vào DB — thực sự non-blocking (fire-and-forget)
      // Không await → lỗi DB không làm chậm response trả về user
      this._persistMessages(
        sessionId,
        userId,
        message,
        aiResponse.response || '',
        intent,
        responseTimeMs,
        false, // isFallback = false vì đã qua LLM thành công
      ).catch((err) => logger.warn('[Chatbot] Lưu tin nhắn thất bại (non-blocking):', err.message));

      return aiResponse;
    } catch (error) {
      // Lỗi không mong đợi → log và trả về fallback thay vì crash
      logger.error('Lỗi chatbot:', error);
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Lưu cặp tin nhắn user + assistant vào bảng ChatMessage trong DB.
   *
   * **Tại sao lưu cả 2 messages cùng lúc (bulkCreate) thay vì riêng lẻ?**
   * 1 DB call thay vì 2 → giảm overhead, đặc biệt quan trọng với MySQL.
   *
   * **Tại sao non-blocking (chỉ log warning, không throw)?**
   * Nếu DB lỗi (connection dropped, disk full), chatbot vẫn phải trả lời được user.
   * Analytics là "nice to have" — mất dữ liệu analytics ít nghiêm trọng hơn
   * so với chatbot không hoạt động.
   *
   * @param {string|null} sessionId - Session ID (null → skip, không lưu).
   * @param {number|null} userId - ID user (null nếu anonymous).
   * @param {string} userMessage - Tin nhắn gốc từ user.
   * @param {string} assistantReply - Câu trả lời của chatbot.
   * @param {string} intent - Intent đã classify (product_search, off_topic...).
   * @param {number} responseTimeMs - Thời gian xử lý (ms) — dùng cho analytics dashboard.
   * @param {boolean} isFallback - true nếu không qua LLM (keyword fallback hoặc off-topic).
   * @returns {Promise<void>}
   */
  async _persistMessages(
    sessionId,
    userId,
    userMessage,
    assistantReply,
    intent,
    responseTimeMs,
    isFallback,
  ) {
    try {
      // Không lưu nếu không có sessionId hoặc model chưa được inject
      if (!sessionId || !this.ChatMessage) return;
      await this.ChatMessage.bulkCreate([
        {
          sessionId,
          userId: userId || null,
          content: userMessage,
          role: 'user',
          messageType: 'ai_chatbot',
          intent,
          isFallback: false, // Tin nhắn của user không phải fallback
        },
        {
          sessionId,
          userId: userId || null,
          content: assistantReply,
          role: 'assistant',
          messageType: 'ai_chatbot',
          intent,
          responseTimeMs, // Thời gian xử lý — dùng trong admin dashboard để monitor performance
          isFallback, // Đánh dấu nếu response này từ fallback (không qua LLM)
        },
      ]);
    } catch (dbError) {
      // Lỗi DB chỉ log cảnh báo — không ảnh hưởng flow trả lời user
      logger.warn('Không thể lưu chatbot messages vào DB:', dbError.message);
    }
  }

  /**
   * Gọi LLM với RAG context + lịch sử hội thoại để sinh câu trả lời.
   *
   * **Cấu trúc messages gửi cho LLM:**
   * ```
   * [
   *   { role: 'system', content: "Bạn là nhân viên tư vấn TechStore. QUY TẮC: ..." },
   *   { role: 'user',      content: "iPhone 15 giá bao nhiêu?" },      ← history turn 1
   *   { role: 'assistant', content: "iPhone 15 có giá 18.990.000đ..." }, ← history turn 1
   *   { role: 'user',      content: "..." },                            ← history turn 2...
   *   { role: 'user',      content: "<DANH SÁCH SẢN PHẨM>\n..." }     ← tin nhắn hiện tại (RAG prompt)
   * ]
   * ```
   * Inject history giúp LLM nhớ ngữ cảnh: "cái đó" → biết "cái đó" là sản phẩm vừa hỏi.
   *
   * **Provider rotation — chi tiết:**
   * Vòng lặp thử từng provider theo thứ tự trong this.providers[].
   * Khi provider thành công → return ngay (không thử provider khác).
   * Khi tất cả fail → simpleKeywordMatch() (fallback cuối cùng).
   *
   * @param {string} userMessage - Query đã sanitize (escape quotes, cắt 2000 ký tự).
   * @param {Array<Object>} products - Sản phẩm từ Retrieval (ground truth để inject vào prompt).
   * @param {Object} context - Context bổ sung (originalMessage, llmRewrittenQuery...).
   * @param {Array<Object>} [history=[]] - Lịch sử hội thoại: [{role: 'user'|'assistant', content}].
   * @returns {Promise<Object>} Kết quả: `{ response, products, suggestions, intent }`.
   */
  async getAIResponse(userMessage, products, context, history = []) {
    // Không có provider → keyword match với products đã retrieve (nhất quán với all-providers-fail path)
    if (this.providers.length === 0) {
      return this.simpleKeywordMatch(userMessage, products);
    }

    // ── Load thông tin cửa hàng từ cache (refresh 5 phút/lần) ───────────────
    let brandsStr = '';
    let categoriesStr = '';
    try {
      ({ brandsStr, categoriesStr } = await this._getCatalogData());
    } catch {
      /* Bỏ qua nếu DB lỗi — system prompt vẫn hoạt động không có danh sách này */
    }

    // ── Sanitize input trước khi đưa vào prompt (defense-in-depth) ──────────
    const sanitizedMessage = this._sanitizeMessage(userMessage);

    // ── Xây dựng RAG context prompt (phần "Augmented") ───────────────────────
    // createPrompt inject danh sách sản phẩm + thông tin cửa hàng vào câu hỏi user
    const ragContextMessage = this.createPrompt(sanitizedMessage, products, context);

    const storeName = process.env.STORE_NAME || 'TechStore';

    // ── System prompt — định nghĩa vai trò và quy tắc cho LLM ────────────────
    // System prompt được đặt ở đầu conversation — LLM tuân theo suốt cuộc hội thoại.
    // QUY TẮC quan trọng nhất: không bịa sản phẩm, trả lời đúng ngôn ngữ, format JSON.
    const systemContent = `Bạn là nhân viên tư vấn của ${storeName} — cửa hàng công nghệ chuyên điện thoại, máy tính bảng và laptop.
QUY TẮC BẮT BUỘC:
1. CHỈ tư vấn sản phẩm có trong DANH SÁCH SẢN PHẨM được cung cấp trong tin nhắn.
2. TUYỆT ĐỐI không bịa tên sản phẩm, giá, hoặc thông số kỹ thuật ngoài danh sách.
3. Nếu sản phẩm không có trong danh sách, nói rõ: "Cửa hàng hiện chưa có [tên sản phẩm] ạ."
4. Respond in the SAME language as the customer's message. If Vietnamese → reply Vietnamese (thân thiện: mình/em - bạn/anh/chị). If English → reply English (friendly tone).
5. Trả về đúng định dạng JSON được yêu cầu trong tin nhắn.
6. Danh mục: ${categoriesStr} — Thương hiệu: ${brandsStr}`;

    // ── Tổng hợp messages gửi cho LLM ────────────────────────────────────────
    // Thứ tự: system → history (cuộc hội thoại trước) → user (tin nhắn hiện tại + RAG context)
    const messages = [
      { role: 'system', content: systemContent },
      ...history, // Lịch sử hội thoại giúp LLM nhớ ngữ cảnh ("cái đó" → biết là gì)
      { role: 'user', content: ragContextMessage },
    ];

    // ── Provider rotation: thử lần lượt từng provider ────────────────────────
    for (let attempt = 0; attempt < this.providers.length; attempt++) {
      const provider = this.providers[attempt];
      try {
        if (process.env.NODE_ENV !== 'production') {
          logger.debug(
            `🤖 Gửi request tới ${provider.model} (provider ${attempt + 1}/${this.providers.length})...`,
          );
        }

        const response = await axios.post(
          provider.url,
          {
            model: provider.model,
            messages,
            response_format: { type: 'json_object' }, // Yêu cầu LLM trả về JSON thuần, không có text ngoài
            temperature: LLM_TEMPERATURE,
            max_tokens: LLM_MAX_TOKENS,
          },
          {
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
            },
            timeout: LLM_REQUEST_TIMEOUT_MS,
          },
        );

        // Trích xuất text response từ cấu trúc JSON của OpenAI-compatible API
        // response.data.choices[0].message.content = nội dung tin nhắn của LLM
        const aiText = response.data.choices?.[0]?.message?.content;
        if (!aiText) {
          // LLM trả về choices rỗng (hiếm nhưng có thể xảy ra) → thử provider tiếp theo
          logger.warn(`LLM trả về choices rỗng (${provider.model}) — thử provider tiếp theo`);
          continue;
        }

        if (process.env.NODE_ENV !== 'production')
          logger.debug(`Đã nhận phản hồi từ ${provider.model}`);

        // Parse JSON response và map tên sản phẩm về object thực trong DB
        return this.parseAIResponse(aiText, products, userMessage);
      } catch (error) {
        const status = error.response?.status;

        // Lỗi tạm thời → thử provider tiếp theo
        if (
          status === 429 || // Rate limit — quá nhiều request / phút
          status === 402 || // Quota hết — không còn credit
          status === 500 || // Server lỗi nội bộ
          status === 503 || // Service tạm không khả dụng
          !error.response // Network error (timeout, DNS fail, connection refused)
        ) {
          logger.warn(
            `[Rotation] getAIResponse provider ${attempt + 1}/${this.providers.length} (${provider.model}) lỗi ${status || error.code}, thử tiếp...`,
          );
          continue;
        }

        // Lỗi không phục hồi (400 = request sai format, 401 = API key không hợp lệ)
        // Thử provider tiếp theo cũng sẽ gặp lỗi tương tự → dừng ngay
        logger.error(
          `Chi tiết lỗi LLM API (${provider.model}):`,
          error.response?.data || error.message,
        );
        break;
      }
    }

    // Tất cả providers đều thất bại → fallback về keyword matching
    return this.simpleKeywordMatch(userMessage, products);
  }

  /**
   * Dọn dẹp session memory để tránh rò rỉ bộ nhớ (memory leak).
   *
   * **Memory leak là gì?**
   * Nếu không xóa session cũ, Map sẽ tích lũy sessions mãi mãi trong RAM.
   * Server chạy nhiều ngày → hàng nghìn sessions → RAM tăng vô hạn → server crash.
   *
   * **Evict là gì?**
   * "Evict" là loại bỏ entry cũ/không dùng khỏi bộ nhớ.
   * **Chiến lược LRU (Least Recently Used):**
   * Khi vẫn còn quá nhiều session sau khi xóa hết hạn → xóa những session
   * có lần truy cập CŨ NHẤT (ít dùng nhất) cho đến khi còn MAX_SESSIONS.
   * LRU là chiến lược tốt vì giữ lại những session đang active nhất.
   *
   * **Được gọi khi nào?**
   * Sau mỗi lần cập nhật conversationHistory (handleMessage bước 6).
   * Không gọi theo timer vì eviction xảy ra đủ thường xuyên theo request.
   */
  // ════════════════════════════════════════════════════════════════════════════
  // HELPER METHODS — DI, cache, sanitize, injection detection
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Inject Sequelize models từ app.js sau khi singleton được tạo.
   * Phải gọi trước request đầu tiên đến chatbot.
   *
   * @param {{ Brand, Category, ChatMessage }} models
   */
  initialize({ Brand, Category, ChatMessage }) {
    this.Brand = Brand;
    this.Category = Category;
    this.ChatMessage = ChatMessage;
  }

  /**
   * Lấy danh sách brands và categories với cache 5 phút.
   * Tránh query DB mỗi request chatbot.
   *
   * @returns {Promise<{ brandsStr: string, categoriesStr: string }>}
   */
  async _getCatalogData() {
    const now = Date.now();
    if (this._catalogCache && now < this._catalogCacheExpiry) {
      return this._catalogCache;
    }
    if (!this.Brand || !this.Category) return { brandsStr: '', categoriesStr: '' };
    const [brands, categories] = await Promise.all([
      this.Brand.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
      this.Category.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
    ]);
    this._catalogCache = {
      brandsStr: brands
        .map((b) => b.nameVi || b.nameEn)
        .filter(Boolean)
        .join(', '),
      categoriesStr: categories
        .map((c) => c.nameVi || c.nameEn)
        .filter(Boolean)
        .join(', '),
    };
    this._catalogCacheExpiry = now + 5 * 60 * 1000; // TTL 5 phút
    return this._catalogCache;
  }

  /**
   * Sanitize text trước khi lưu vào session history hoặc đưa vào LLM prompt.
   * Tách riêng để dùng nhất quán ở nhiều chỗ.
   *
   * @param {string} text
   * @returns {string}
   */
  _sanitizeMessage(text) {
    return text
      .replace(/"/g, "'")
      .replace(/\n{2,}/g, '\n')
      .trim()
      .substring(0, 2000);
  }

  /**
   * Phát hiện prompt injection patterns phổ biến.
   * Trả về true nếu phát hiện → caller nên từ chối xử lý.
   *
   * @param {string} text - Tin nhắn gốc từ user.
   * @returns {boolean}
   */
  _isPromptInjection(text) {
    const patterns = [
      /ignore\s+(all\s+)?(previous\s+)?instructions?/i,
      /\bsystem\s*:/i,
      /\bact\s+as\b/i,
      /\bforget\s+(all|everything|your)\b/i,
      /\bpretend\s+(to\s+be|you\s+are)\b/i,
      /\byou\s+are\s+now\b/i,
    ];
    return patterns.some((p) => p.test(text));
  }

  _evictStaleSessions() {
    if (this.conversationHistory.size === 0) return; // Không có session nào → không cần làm gì
    const now = Date.now();

    // ── Bước 1: Xóa session hết TTL (không hoạt động > 30 phút) ──────────────
    for (const [sessionId, sessionData] of this.conversationHistory) {
      if (now - sessionData.lastAccess > SESSION_TTL_MS) {
        this.conversationHistory.delete(sessionId);
      }
    }

    // ── Bước 2: Nếu vẫn còn > MAX_SESSIONS → xóa session ít dùng nhất (LRU) ──
    if (this.conversationHistory.size > MAX_SESSIONS) {
      // Chuyển Map entries thành mảng để có thể sort
      // entries() trả về [[sessionId1, data1], [sessionId2, data2], ...]
      const sortedByLeastRecentlyUsed = [...this.conversationHistory.entries()].sort(
        // Sort tăng dần theo lastAccess → phần tử đầu mảng = session CŨ NHẤT (ít dùng nhất)
        (a, b) => a[1].lastAccess - b[1].lastAccess,
      );

      // Tính số session cần xóa để đưa tổng về đúng MAX_SESSIONS
      const numberOfSessionsToRemove = sortedByLeastRecentlyUsed.length - MAX_SESSIONS;
      for (let i = 0; i < numberOfSessionsToRemove; i++) {
        // sortedByLeastRecentlyUsed[i][0] = sessionId của session thứ i (ít dùng nhất)
        this.conversationHistory.delete(sortedByLeastRecentlyUsed[i][0]);
      }
    }
  }
}

// Singleton: export 1 instance duy nhất cho toàn bộ app
// Tất cả modules import file này đều dùng chung instance → session memory nhất quán
module.exports = new ChatbotService();
