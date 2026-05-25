/**
 * @file chatbot-service.js
 * @layer Service
 * @module ai
 *
 * ChatbotService — trung tâm điều phối giao tiếp với LLM và quản lý lịch sử hội thoại.
 *
 * Service này làm 3 việc chính:
 *   1. **Gọi LLM (augmentAndGenerate)**: gửi request đến OpenRouter/OpenAI-compatible API,
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
const { Op } = require('sequelize');
// try/catch nhất quán với module.js — nếu vector-store fail load, Path B dùng [] thay vì crash
let vectorStoreService = null;
try {
  vectorStoreService = require('@services/vector-store/vector-store');
} catch {
  // vectorStoreService = null → Path B fallback về empty products
}
const { detectLanguage } = require('@modules/ai/services/chatbot/language/language-detector');
const { validateMessage, expandAbbreviations, classifyIntent, isPromptInjection } = require('@modules/ai/services/core/ai-policy');
const { AppError } = require('@shared/errors');
const logger = require('@utils/logger');
const promptBuilder = require('@modules/ai/services/chatbot/prompt/prompt-builder');
const responseParser = require('@modules/ai/services/chatbot/prompt/response-parser');
const keywordFallback = require('@modules/ai/services/chatbot/keyword/keyword-fallback');
const { fuzzyExpandQuery } = require('@modules/ai/services/chatbot/query/fuzzy-expander');

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
    // Provider 1: LLM_API_KEY + LLM_BASE_URL + LLM_MODEL_1
    // Provider 2+: LLM_API_KEY_2 + LLM_BASE_URL_2 (fallback LLM_BASE_URL) + LLM_MODEL_2
    // Rotation: thử lần lượt, provider sau là fallback khi provider trước lỗi.
    this.providers = [];
    const baseUrl = process.env.LLM_BASE_URL;
    if (process.env.LLM_API_KEY && baseUrl) {
      this.providers.push({
        key: process.env.LLM_API_KEY,
        url: `${baseUrl}/chat/completions`,
        model: process.env.LLM_MODEL_1,
      });
    }
    if (process.env.LLM_MODEL_2) {
      this.providers.push({
        key: process.env.LLM_API_KEY_2 || process.env.LLM_API_KEY,
        url: `${process.env.LLM_BASE_URL_2 || baseUrl}/chat/completions`,
        model: process.env.LLM_MODEL_2,
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
    // Gán lên instance để tests có thể gọi chatbotService.buildAugmentedPrompt() trực tiếp
    // (tránh phải mock require() — khó hơn nhiều trong Jest).
    this.buildAugmentedPrompt = promptBuilder.buildAugmentedPrompt;
    this.parseLLMOutput = responseParser.parseLLMOutput;
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
   * Xử lý một tin nhắn của user — entry point chính của ChatbotService.
   *
   * Flow 7 bước: validate → normalize → injection/off-topic → load history
   *   → retrieve (hybrid search + LLM rewrite song song) → generate (LLM) → persist
   *
   * @param {string} message - Tin nhắn gốc từ user.
   * @param {number|null} [userId=null] - ID user đã đăng nhập; null nếu khách vãng lai.
   * @param {string|null} [sessionId=null] - Session ID để track conversation history.
   * @returns {Promise<Object>} `{ response, products, suggestions, intent }`
   */
  async handleMessage(message, userId = null, sessionId = null) {
    const startTime = Date.now();
    try {
      // ── Bước 1-3: Validate + Normalize + Security gates ───────────────────────
      logger.debug(`📝 Câu truy vấn gốc: "${message}"`);
      const prep = this._preprocessMessage(message);
      if (!prep.valid) throw new AppError(prep.reason, 400);

      const { normalizedQuery, intent, injection, offTopic } = prep;

      if (injection) {
        logger.warn('[Security] Phát hiện prompt injection, từ chối xử lý');
        const isEn = detectLanguage(message) === 'en';
        const injectionResponse = {
          response: isEn
            ? '🛡️ I can only help with tech product inquiries.'
            : '🛡️ Mình chỉ có thể hỗ trợ tư vấn sản phẩm công nghệ ạ.',
          products: [],
          suggestions: isEn ? ['View phones', 'View laptops'] : ['Xem điện thoại', 'Xem laptop'],
          intent: 'off_topic',
        };
        this._persistMessages(
          sessionId, userId, message, injectionResponse.response, 'off_topic', Date.now() - startTime, true,
        ).catch((err) => logger.warn('[Chatbot] Lưu injection message thất bại:', err.message));
        return injectionResponse;
      }

      if (offTopic) {
        const isEn = detectLanguage(message) === 'en';
        const offTopicResponse = {
          response: isEn
            ? 'ℹ️ This question is outside my area of expertise. I can only help with tech products like phones, laptops, smartwatches... Would you like to explore any products?'
            : 'ℹ️ Câu hỏi này nằm ngoài phạm vi mình có thể hỗ trợ ạ. Mình chỉ tư vấn được về sản phẩm công nghệ như điện thoại, laptop, đồng hồ thông minh... Bạn cần tìm hiểu sản phẩm nào không?',
          products: [],
          suggestions: isEn
            ? ['View phones', 'View laptops', 'Deals & promotions', 'Get advice']
            : ['Xem điện thoại', 'Xem laptop', 'Sản phẩm khuyến mãi', 'Tư vấn thêm'],
          intent: 'off_topic',
        };
        this._persistMessages(
          sessionId, userId, message, offTopicResponse.response, intent, Date.now() - startTime, true,
        ).catch((err) => logger.warn('[Chatbot] Lưu off-topic message thất bại:', err.message));
        return offTopicResponse;
      }

      // ── Bước 4: Load lịch sử hội thoại từ session memory ─────────────────────
      const sessionEntry = sessionId ? this.conversationHistory.get(sessionId) : null;
      const conversationHistory = sessionEntry ? sessionEntry.messages : [];

      // ── Bước 5: Retrieve — embedding-based hybrid search ────────────────────
      const enrichedQuery = this._enrichQueryFromHistory(normalizedQuery, conversationHistory);
      const { products: relevantProducts, finalQuery } = await this._retrieveProducts(enrichedQuery, normalizedQuery);

      // ── Bước 6: Generation — gọi LLM để sinh câu trả lời ────────────────────
      const aiResponse = await this.augmentAndGenerate(
        finalQuery,
        relevantProducts,
        conversationHistory,
      );

      // ── Bước 7: Persist — cập nhật session memory + lưu DB ──────────────────
      if (sessionId) {
        const userContentForHistory = this._sanitizeMessage(finalQuery || message);
        const updatedMessages = [
          ...conversationHistory,
          { role: 'user', content: userContentForHistory },
          { role: 'assistant', content: aiResponse.response || '' },
        ].slice(-(MAX_HISTORY_TURNS * 2));

        this.conversationHistory.set(sessionId, {
          messages: updatedMessages,
          lastAccess: Date.now(),
        });

        this._evictStaleSessions();
      }

      const responseTimeMs = Date.now() - startTime;
      this._persistMessages(
        sessionId, userId, message, aiResponse.response || '', intent, responseTimeMs, false,
        { products: aiResponse.products, suggestions: aiResponse.suggestions },
      ).catch((err) => logger.warn('[Chatbot] Lưu tin nhắn thất bại (non-blocking):', err.message));

      return aiResponse;
    } catch (error) {
      // Re-throw AppError để controller xử lý đúng HTTP status code (400, 404...)
      if (error.statusCode) throw error;
      logger.error('Lỗi chatbot:', error);
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Tiền xử lý tin nhắn: validate → normalize → classify → detect security gates.
   * Tách riêng để dễ test độc lập và trace trong scripts/preprocess-trace.js.
   *
   * @param {string} message - Tin nhắn gốc từ user.
   * @returns {{ valid: boolean, reason?: string, normalizedQuery?: string,
   *             intent?: string, injection?: boolean, offTopic?: boolean }}
   */
  _preprocessMessage(message) {
    const validation = validateMessage(message);
    if (!validation.valid) return { valid: false, reason: validation.reason };

    const normalizedQuery = expandAbbreviations(message);
    const intent = classifyIntent(normalizedQuery);
    const injection = isPromptInjection(message);
    const offTopic = intent === 'off_topic';

    return { valid: true, normalizedQuery, intent, injection, offTopic };
  }

  /**
   * Enrich query bằng context từ conversation history khi user dùng đại từ.
   *
   * Vấn đề: "cái đó có bao nhiêu RAM?" — vector search không biết "cái đó" là gì,
   * trả về products ngẫu nhiên → LLM nói "chưa có sản phẩm đó" dù Turn 1 đã xác nhận có.
   *
   * Fix: nếu query chứa đại từ chỉ định, append nội dung của 1-2 assistant messages
   * gần nhất vào query để vector search có ngữ cảnh đúng.
   *
   * @param {string} query - Query đã normalize.
   * @param {Array<{role:string, content:string}>} history - Conversation history.
   * @returns {string} Query gốc hoặc query đã enrich (nếu phát hiện đại từ).
   */
  _enrichQueryFromHistory(query, history) {
    if (!history || history.length === 0) return query;

    // Dùng [\p{L}\p{N}]* thay vì \w* để nhận ký tự Unicode tiếng Việt có dấu.
    // Pattern "[\p{L}\p{N}]*(?:đó|này|kia)" bắt MỌI cụm "X đó/này/kia" mà không cần liệt kê prefix.
    const PRONOUN_RE =
      /(?:^|\s)[\p{L}\p{N}]*(?:đó|này|kia)(?=[\s,?.!]|$)|(?:^|\s)nó(?=[\s,?.!]|$)|so sánh|cả hai|2 cái|hai cái/iu;
    const hasPronoun = PRONOUN_RE.test(query);

    // Implicit follow-up: câu hỏi ngắn không có subject rõ ràng nhưng rõ ràng hỏi về SP vừa đề cập.
    // Ví dụ: "có màu gì?", "giá bao nhiêu?", "còn hàng không?", "bảo hành mấy năm?"
    // Điều kiện: query ngắn (<= 50 ký tự) + không chứa brand/product name + history có data.
    const BRAND_RE = /iphone|samsung|macbook|xiaomi|oppo|realme|apple|dell|asus|acer|casio|citizen|laptop|tablet|điện thoại|đồng hồ|máy tính|smartwatch|earphone|headphone|airpod/i;
    const isImplicitFollowup = !hasPronoun
      && query.trim().length <= 50
      && !BRAND_RE.test(query);

    if (!hasPronoun && !isImplicitFollowup) return query;

    // Trích xuất TÊN SẢN PHẨM ĐẦU TIÊN từ mỗi assistant message gần nhất.
    //
    // Lý do chỉ lấy sản phẩm đầu tiên (không phải top 3):
    //   - Nếu lấy top 3 từ mỗi turn, turn có nhiều iPhone (T1/T2/T3) sẽ có 3 iPhone names
    //     trong khi turn về MacBook (T4) chỉ có 1 → iPhone dominate keyword ranking → MacBook
    //     không lên top 3 khi user so sánh.
    //   - Chỉ lấy top 1 đảm bảo mỗi turn được đại diện BẰNG NHAU trong enriched query.
    //
    // Hỗ trợ format:
    //   1. Keyword fallback: "• Điện thoại iPhone 17 - 24.990.000 đ"  → extract "Điện thoại iPhone 17"
    //   2. LLM response: lấy 60 ký tự đầu làm fallback (thường bắt đầu bằng tên sản phẩm)
    const extractTopProductFromResponse = (text) => {
      // Skip "not found" response — không có SP để extract, tránh noise vào enriched query
      if (text.startsWith('🚫') || /Cửa hàng hiện chưa có|không tìm thấy|ngoài phạm vi/i.test(text.substring(0, 80))) return null;
      const firstBullet = text
        .split('\n')
        .find((l) => l.includes('•'));
      if (firstBullet) {
        return firstBullet
          .replace(/^.*?•\s*/, '')
          .replace(/\s*-\s*[\d.,]+.*$/, '')
          .trim();
      }
      return text.substring(0, 60);
    };

    const recentContext = history
      .filter((m) => m.role === 'assistant')
      .slice(-2)
      .map((m) => extractTopProductFromResponse(m.content))
      .filter(Boolean)
      .join(' ');

    if (!recentContext.trim()) return query;
    logger.debug(`[Enrich] ${hasPronoun ? 'Pronoun' : 'Implicit follow-up'} detected, appending product names from history`);
    return `${query} ${recentContext}`;
  }

  /**
   * Bước 5 — Retrieval: embedding-based hybrid search để tìm sản phẩm liên quan.
   *
   * Pipeline nội bộ:
   *   1. Clean negation phrases khỏi query (tránh embedding bias từ brand bị phủ định)
   *   2. Song song: LLM rewrite query + hybridSearch(query) để giảm latency
   *   3. Nếu LLM rewrite khác query gốc → hybridSearch lần 2 với query đã rewrite
   *   4. Nếu 0 kết quả → hạ minScore về 0, lấy top-3 (fallback low-confidence)
   *
   * Tách riêng để handleMessage() không bị "ô nhiễm" bởi ~50 dòng retrieval logic.
   *
   * @param {string} enrichedQuery - Query đã enrich từ history (xử lý đại từ).
   * @param {string} normalizedQuery - Query đã normalize (để so sánh với LLM rewrite).
   * @returns {Promise<{ products: Array, finalQuery: string }>}
   */
  async _retrieveProducts(enrichedQuery, normalizedQuery) {
    if (!vectorStoreService) return { products: [], finalQuery: enrichedQuery };

    try {
      // Strip mệnh đề phủ định trước khi gửi lên embedding model.
      // "không cần iPhone, Samsung" → bias embedding về iPhone/Samsung dù là phủ định.
      const queryForRetrieval =
        enrichedQuery
          .replace(
            /(?:không\s+(?:cần|muốn|thích|dùng)|tránh|avoid|don't\s+want)\s+[\p{L}\p{N}\s,/]+?(?=\s+(?:gì|hay|hoặc|được|cũng|mà|nhưng|,|$)|\s*$)/igu,
            ' ',
          )
          .trim() || enrichedQuery;

      // Chạy song song LLM rewrite + hybridSearch để giảm latency
      const [llmRewrite, initialResults] = await Promise.all([
        this.rewriteQuery(queryForRetrieval).catch(() => null),
        vectorStoreService.hybridSearch(queryForRetrieval, 10),
      ]);

      let finalQuery = enrichedQuery;
      let products;

      if (llmRewrite && llmRewrite.toLowerCase() !== normalizedQuery.toLowerCase()) {
        finalQuery = llmRewrite;
        logger.debug(`✨ [LLM Rewrite] "${normalizedQuery}" → "${llmRewrite}"`);
        try {
          const refinedResults = await vectorStoreService.hybridSearch(llmRewrite, 10);
          const results = refinedResults.length > 0 ? refinedResults : initialResults;
          products = results.map((r) => ({
            ...r.metadata,
            score: r.score,
            ...(r.lowConfidence && { lowConfidence: true }),
          }));
        } catch {
          products = initialResults.map((r) => ({ ...r.metadata, score: r.score }));
        }
      } else {
        products = initialResults.map((r) => ({
          ...r.metadata,
          score: r.score,
          ...(r.lowConfidence && { lowConfidence: true }),
        }));
      }

      // Fallback: không có kết quả trên threshold → hạ minScore, lấy top-3
      if (products.length === 0) {
        logger.warn('[Chatbot] Không có kết quả trên threshold — hạ minScore lấy top-3');
        try {
          const lowResults = await vectorStoreService.hybridSearch(finalQuery, 3, 0);
          products = lowResults.map((r) => ({ ...r.metadata, score: r.score, lowConfidence: true }));
        } catch {
          products = [];
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`📦 Tìm thấy ${products.length} sản phẩm liên quan qua RAG`);
      }
      return { products, finalQuery };
    } catch (err) {
      logger.warn('[Chatbot] Vector search thất bại, tiếp tục không có retrieval:', err.message);
      return { products: [], finalQuery: enrichedQuery };
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
   * **Tại sao chạy song song với hybridSearch?**
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
    // Không có LLM provider → fuzzy expand từ product catalog thay thế
    if (this.providers.length === 0) {
      if (!vectorStoreService) return null;
      await vectorStoreService.loadPromise;
      const productNames = vectorStoreService.items.map(i => i.metadata?.name).filter(Boolean);
      const { expanded, changed } = fuzzyExpandQuery(message, productNames);
      if (changed) {
        logger.debug(`[FuzzyExpand] "${message}" → "${expanded}"`);
        return expanded;
      }
      return null;
    }

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
   * @param {string} userMessage - Query đã sanitize (escape quotes, cắt 500 ký tự).
   * @param {Array<Object>} products - Sản phẩm từ Retrieval (ground truth để inject vào prompt).
   * @param {Array<Object>} [history=[]] - Lịch sử hội thoại: [{role: 'user'|'assistant', content}].
   * @returns {Promise<Object>} Kết quả: `{ response, products, suggestions, intent }`.
   */
  async augmentAndGenerate(userMessage, products, history = []) {
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
    // buildAugmentedPrompt inject danh sách sản phẩm + thông tin cửa hàng vào câu hỏi user
    const augmentedPrompt = this.buildAugmentedPrompt(sanitizedMessage, products);

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
      { role: 'user', content: augmentedPrompt },
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

        const httpResponse = await axios.post(
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
        // httpResponse.data.choices[0].message.content = nội dung tin nhắn của LLM
        const rawLLMOutput = httpResponse.data.choices?.[0]?.message?.content;
        if (!rawLLMOutput) {
          // LLM trả về choices rỗng (hiếm nhưng có thể xảy ra) → thử provider tiếp theo
          logger.warn(`LLM trả về choices rỗng (${provider.model}) — thử provider tiếp theo`);
          continue;
        }

        if (process.env.NODE_ENV !== 'production')
          logger.debug(`Đã nhận phản hồi từ ${provider.model}`);

        // Parse JSON response và map tên sản phẩm về object thực trong DB
        return this.parseLLMOutput(rawLLMOutput, products, userMessage);
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
            `[Rotation] augmentAndGenerate provider ${attempt + 1}/${this.providers.length} (${provider.model}) lỗi ${status || error.code}, thử tiếp...`,
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
      .substring(0, 500);
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
    aiMeta = null,
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
          responseTimeMs,
          isFallback,
          ...(aiMeta ? { metadata: JSON.stringify(aiMeta) } : {}),
        },
      ]);
    } catch (dbError) {
      // Lỗi DB chỉ log cảnh báo — không ảnh hưởng flow trả lời user
      logger.warn('Không thể lưu chatbot messages vào DB:', dbError.message);
    }
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
  clearSession(sessionId) {
    if (!sessionId) {
      this.conversationHistory.clear();
      return true;
    }
    return this.conversationHistory.delete(sessionId);
  }

  getSessionHistory(sessionId) {
    const entry = this.conversationHistory.get(sessionId);
    return entry ? entry.messages : [];
  }

  // Session đang active trên UI — được cập nhật khi UI gọi registerSession()
  // Tại sao cần? getLatestSession() từ DB không biết session mới nếu chưa có message.
  // registerSession() cho phép terminal --watch theo đúng session UI ngay lập tức.
  _registeredSession = null;

  registerSession(sessionId) {
    this._registeredSession = sessionId;
    logger.debug(`[Session] UI registered session: ${sessionId}`);
  }

  async getLatestSession() {
    // Ưu tiên session được UI đăng ký (biết ngay khi UI tạo session mới)
    if (this._registeredSession) return this._registeredSession;
    if (!this.ChatMessage) return null;
    const latest = await this.ChatMessage.findOne({
      where: { messageType: 'ai_chatbot', role: 'user' },
      order: [['createdAt', 'DESC']],
      attributes: ['sessionId'],
      raw: true,
    });
    return latest?.sessionId || null;
  }

  async getSessionMessages(sessionId, limit = 50) {
    if (!sessionId || !this.ChatMessage) return [];
    return this.ChatMessage.findAll({
      where: { sessionId, role: { [Op.in]: ['user', 'assistant'] }, messageType: 'ai_chatbot' },
      order: [['createdAt', 'ASC']],
      limit,
      attributes: ['role', 'content', 'intent', 'metadata', 'createdAt'],
      raw: true,
    });
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
