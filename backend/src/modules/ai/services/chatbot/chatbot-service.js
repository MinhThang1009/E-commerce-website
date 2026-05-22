/**
 * @file chatbot-service.js
 * @layer Service
 * @module ai
 * @description LLM gateway + session management + Redis cache cho AI chatbot.
 *
 * Singleton service xử lý giao tiếp với LLM providers (OpenRouter/OpenAI-compatible),
 * quản lý lịch sử hội thoại in-memory, cache kết quả qua Redis, và persist messages vào DB.
 *
 * Được RAGPipeline gọi qua ChatbotLLMGateway (Adapter pattern) — không import trực tiếp.
 *
 * **Flow chính — 7 bước (xem handleMessage() để biết chi tiết từng bước):**
 * ```
 * [1] Chuẩn hóa query + phân loại intent (expand viết tắt, regex classify)
 * [2] Off-topic → trả response cố định ngay, không tốn LLM call
 * [3] Cache check (Redis) — chỉ cache product_search, TTL 5 phút
 * [4] Load lịch sử hội thoại từ session memory (in-memory Map)
 * [5] Retrieval — hybrid search (semantic + keyword) lấy sản phẩm liên quan
 * [6] Generation — gọi LLM với RAG context + lịch sử hội thoại
 * [7] Persist messages vào DB + cập nhật session memory + cache response
 * ```
 *
 * **Session memory — tại sao giới hạn 500 sessions, TTL 30 phút?**
 * Lịch sử hội thoại lưu in-memory (Map) — không persist khi server restart (đủ cho demo/KLTN).
 * Không có giới hạn → server chạy lâu sẽ tích lũy hàng nghìn sessions → rò rỉ bộ nhớ (memory leak).
 * 500 sessions × (10 turns × 2 messages × ~200 bytes) ≈ 2MB — chấp nhận được.
 * TTL 30 phút: session không hoạt động sau 30 phút → xóa để giải phóng RAM.
 *
 * **Cache Redis shared key — ưu và nhược điểm:**
 * Ưu: 100 user cùng hỏi "iPhone 15 giá bao nhiêu" → chỉ gọi LLM 1 lần, 99 lần còn lại dùng cache.
 * Nhược: cache không theo user → không thể personalize response; data sản phẩm thay đổi trong 5 phút
 *         → user có thể nhận response hơi cũ (chấp nhận được cho product_search).
 */
const axios = require('axios');
const {
  Product,
  Category,
  Brand,
  ChatMessage,
  ProductImage,
  ProductVariant,
  sequelize,
} = require('@models');
const vectorStoreService = require('@services/vector-store/vector-store');
const { detectLanguage } = require('@modules/ai/services/chatbot/language/language-detector');
const { expandAbbreviations, classifyIntent } = require('@modules/ai/services/core/ai-policy');
const logger = require('@utils/logger');
const { getRedisClient } = require('@config/redis');
const promptBuilder = require('@modules/ai/services/chatbot/prompt/prompt-builder');
const responseParser = require('@modules/ai/services/chatbot/prompt/response-parser');
const keywordFallback = require('@modules/ai/services/chatbot/keyword/keyword-fallback');

/**
 * TTL (giây) cho Redis cache của chatbot response.
 * 5 phút đủ để tận dụng cache khi nhiều user hỏi cùng câu, nhưng không quá cũ khi giá/stock thay đổi.
 * Chú ý: redis.setEx nhận tham số tính bằng giây (khác với setTimeout/setInterval tính bằng ms).
 */
const CHATBOT_CACHE_TTL = 5 * 60;

/**
 * Danh sách intent được phép cache Redis.
 * Chỉ cache product_search vì đây là truy vấn không phụ thuộc user hay thời gian thực.
 * Không cache: order_inquiry (trạng thái đơn realtime), policy (có thể sửa bất kỳ lúc nào),
 * pricing (giá có thể thay đổi trong ngày).
 */
const CACHEABLE_INTENTS = ['product_search'];

/**
 * TTL (milliseconds) cho catalog cache in-memory (brands + categories).
 * Catalog ít thay đổi → cache 5 phút để tránh query DB mỗi lần gọi LLM.
 * Đơn vị ms vì dùng với Date.now() (khác với CHATBOT_CACHE_TTL dùng với redis.setEx).
 */
const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Số lượt hội thoại tối đa giữ trong session memory per session.
 * 10 turns = 20 messages (mỗi turn có 2 messages: 1 user + 1 assistant).
 * Giới hạn để không vượt token limit của LLM khi inject history vào prompt.
 */
const MAX_HISTORY_TURNS = 10;

/**
 * Tổng số sessions tối đa trong conversationHistory Map.
 * Khi vượt ngưỡng → xóa session ít dùng nhất (LRU) để giải phóng RAM.
 * 500 sessions × ~4KB/session ≈ 2MB — chấp nhận được cho server production.
 */
const MAX_SESSIONS = 500;

/**
 * Thời gian (milliseconds) trước khi session bị coi là "stale" (không còn active).
 * Session không có tin nhắn mới sau 30 phút → _evictStaleSessions() sẽ xóa.
 */
const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Temperature cho LLM khi sinh response tư vấn sản phẩm.
 * 0.3 = thấp để câu trả lời ổn định, ít "sáng tạo" quá mức → giảm nguy cơ hallucination.
 * (Thang 0-2: 0 = deterministic, 1 = balanced, 2 = rất creative/ngẫu nhiên)
 */
const LLM_TEMPERATURE = 0.3;

/**
 * Số token tối đa cho response của LLM khi tư vấn sản phẩm.
 * 800 tokens ≈ ~600 từ — đủ cho câu trả lời đầy đủ kèm danh sách sản phẩm,
 * không quá dài làm tốn API quota và tăng latency.
 */
const LLM_MAX_TOKENS = 800;

/**
 * Timeout (milliseconds) cho request đến LLM khi sinh response chính (getAIResponse).
 * 30 giây đủ cho LLM suy nghĩ và trả về JSON response đầy đủ.
 */
const LLM_REQUEST_TIMEOUT_MS = 30000;

/**
 * Số token tối đa cho response của LLM khi rewrite query (_llmRewrite).
 * 80 tokens đủ cho 1 dòng text ngắn — rewrite chỉ cần trả về query đã chuẩn hóa.
 */
const LLM_REWRITE_MAX_TOKENS = 80;

/**
 * Timeout (milliseconds) cho request LLM rewrite query.
 * Ngắn hơn LLM_REQUEST_TIMEOUT_MS vì rewrite chạy song song với vector search —
 * nếu rewrite chậm quá sẽ làm tăng tổng latency của pipeline.
 */
const LLM_REWRITE_TIMEOUT_MS = 8000;

/**
 * Service singleton quản lý LLM calls, session memory, và Redis cache cho chatbot.
 *
 * **Provider rotation** — tự động chuyển sang provider tiếp theo khi gặp lỗi:
 * - HTTP 429 (rate limit), 402 (quota hết), 500/503 (server lỗi), network error → retry provider tiếp
 * - HTTP 400 (bad request), 401 (auth fail) → lỗi không phục hồi → break ngay, không retry
 *
 * **Session memory** — lưu lịch sử hội thoại per-session:
 * - Max MAX_HISTORY_TURNS turns = MAX_HISTORY_TURNS × 2 messages per session
 * - Max MAX_SESSIONS sessions tổng — xóa session ít dùng nhất (LRU) khi vượt
 * - TTL SESSION_TTL_MS (30 phút) — session không hoạt động → tự động xóa
 *
 * **Redis cache** — tránh gọi LLM lặp lại cho cùng câu hỏi:
 * - Chỉ cache intent product_search (không cache order/policy vì data realtime)
 * - TTL CHATBOT_CACHE_TTL giây (5 phút)
 * - Cache key shared (không theo userId) — nhiều user cùng câu hỏi dùng chung 1 cached response
 */
class ChatbotService {
  constructor() {
    // Provider list — cấu hình qua env LLM_API_KEY + LLM_BASE_URL + LLM_MODEL
    this.providers = [];
    if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
      this.providers.push({
        key: process.env.LLM_API_KEY,
        url: `${process.env.LLM_BASE_URL}/chat/completions`,
        model: process.env.LLM_MODEL || 'openai/gpt-4.5',
      });
    }
    this._brandsCache = null;
    this._categoriesCache = null;
    // Unix ms timestamp — catalog cache hết hạn khi Date.now() vượt qua giá trị này
    this._catalogCacheExpiry = 0;
    // Lịch sử hội thoại lưu theo sessionId (in-memory Map)
    // Reset khi server restart — đủ cho demo, production dùng Redis
    this.conversationHistory = new Map();

    // Delegate extracted functions — giữ instance API cho tests gọi chatbotService.X()
    this.createPrompt = promptBuilder.createPrompt;
    this.parseAIResponse = responseParser.parseAIResponse;
    this.simpleKeywordMatch = keywordFallback.simpleKeywordMatch;
    this.getFallbackResponse = keywordFallback.getFallbackResponse;

    this._initializeChatbot();
  }

  /**
   * Load danh sách brands và categories từ DB, cache in-memory CATALOG_CACHE_TTL_MS (5 phút).
   * Dùng để inject vào system prompt — giúp LLM biết cửa hàng bán những gì.
   * Không query DB nếu cache còn hiệu lực (tránh N+1 queries mỗi lần gọi LLM).
   * @returns {Promise<void>}
   */
  async _ensureCatalogCache() {
    if (this._brandsCache && Date.now() < this._catalogCacheExpiry) return;
    const [brands, categories] = await Promise.all([
      Brand.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
      Category.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
    ]);
    this._brandsCache = brands.map((b) => b.nameVi || b.nameEn).filter(Boolean);
    this._categoriesCache = categories.map((c) => c.nameVi || c.nameEn).filter(Boolean);
    this._catalogCacheExpiry = Date.now() + CATALOG_CACHE_TTL_MS;
  }

  /**
   * Log trạng thái khởi tạo chatbot: có bao nhiêu LLM provider sẵn sàng.
   * Gọi 1 lần trong constructor — chỉ log, không throw nếu 0 providers.
   * 0 providers → chatbot vẫn hoạt động nhưng dùng fallback keyword match thay vì LLM.
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
   * [Input] Normalize + classify intent bằng rule-based (0ms, không tốn LLM call).
   * Expand abbreviations (ip→iPhone, ss→Samsung) rồi regex classify intent.
   * @param {string} message - Tin nhắn gốc từ user.
   * @returns {Promise<{rewrittenQuery: string, intent: string}>} Query đã normalize + intent.
   */
  async normalizeAndClassify(message) {
    const rewrittenQuery = expandAbbreviations(message);
    return { rewrittenQuery, intent: classifyIntent(rewrittenQuery) };
  }

  /**
   * [Normalize — LLM] Gọi LLM để chuẩn hóa query: mở rộng viết tắt, sửa lỗi chính tả.
   *
   * **Tại sao chạy song song với vector search?**
   * LLM rewrite mất ~1-3 giây. Nếu chạy tuần tự: rewrite → search → response = 1-3s thêm vào latency.
   * Chạy song song: [rewrite + search đồng thời] → khi cả 2 xong mới merge → tiết kiệm 1-3s.
   *
   * **Nếu LLM rewrite lỗi thì sao?**
   * Trả về null — pipeline dùng query gốc (đã qua expandAbbreviations). Không block request chính.
   * Timeout ngắn hơn (LLM_REWRITE_TIMEOUT_MS = 8s vs LLM_REQUEST_TIMEOUT_MS = 30s) để không
   * chờ quá lâu khi rewrite fail.
   *
   * Ví dụ: "ip17 pro bnh" → "iPhone 17 Pro bao nhiêu"
   *
   * @param {string} message - Query gốc từ user (đã qua expandAbbreviations).
   * @returns {Promise<string|null>} Query đã rewrite nếu LLM thay đổi được, null nếu lỗi hoặc không đổi.
   */
  async _llmRewrite(message) {
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
            temperature: 0,
          },
          {
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
            },
            timeout: LLM_REWRITE_TIMEOUT_MS,
          },
        );
        const rewritten = res.data.choices?.[0]?.message?.content?.trim();
        if (rewritten) return rewritten !== message ? rewritten : null;
        continue;
      } catch (err) {
        const status = err.response?.status;
        if (status === 429 || status === 402 || status === 500 || status === 503 || !err.response) {
          logger.debug(`[LLM Rewrite] Provider ${i + 1} lỗi (${status || err.code}), thử tiếp...`);
          continue;
        }
        logger.debug(`[LLM Rewrite] Provider ${i + 1} lỗi không phục hồi được (${status}), dừng`);
        break;
      }
    }
    return null;
  }

  /**
   * [Orchestration] Entry point chính của ChatbotService — điều phối toàn bộ flow xử lý tin nhắn.
   *
   * **Flow 7 bước:**
   * ```
   * Bước 1 — Chuẩn hóa query:
   *   expandAbbreviations("ip15") → "iPhone 15"
   *   classifyIntent("iPhone 15 giá") → "product_search"
   *   (skip nếu RAGPipeline đã làm — context.normalizedQuery + context.preClassifiedIntent)
   *
   * Bước 2 — Off-topic early return:
   *   intent === 'off_topic' → trả response cố định ngay (tiếng Việt hoặc English)
   *   Không gọi LLM, không search sản phẩm → tiết kiệm quota + giảm latency
   *
   * Bước 3 — Redis cache check:
   *   Chỉ check khi intent === 'product_search'
   *   Cache HIT → trả kết quả ngay, vẫn persist vào DB và lưu session history
   *   Cache MISS hoặc Redis lỗi → tiếp tục bước 4
   *
   * Bước 4 — Load session history:
   *   Lấy messages[] từ conversationHistory Map theo sessionId
   *   Dùng làm context cho LLM ở bước 6 — giúp chatbot nhớ cuộc hội thoại
   *
   * Bước 5 — Retrieval:
   *   Path A (chính): RAGPipeline đã search → dùng context.retrievedProducts
   *   Path B (legacy): không qua RAGPipeline → tự gọi hybridSearch + _llmRewrite song song
   *
   * Bước 6 — Generation:
   *   getAIResponse(finalQuery, products, context, conversationHistory)
   *   → build system prompt + RAG context → gọi LLM → parse JSON response
   *
   * Bước 7 — Persist + cache:
   *   Cập nhật conversationHistory Map (in-memory)
   *   _persistMessages() → lưu vào bảng ChatMessage (DB)
   *   Cache response vào Redis nếu product_search
   * ```
   *
   * **Path A vs Path B:**
   * Thông thường RAGPipeline gọi handleMessage() SAU khi đã search xong (Path A).
   * Path B chỉ dùng khi gọi handleMessage() trực tiếp không qua RAGPipeline (legacy/testing).
   *
   * @param {string} message - Tin nhắn gốc từ user.
   * @param {number|null} [userId=null] - ID user đã đăng nhập (null nếu anonymous).
   * @param {string|null} [sessionId=null] - Session ID để track conversation history (null → không lưu history).
   * @param {Object} [context={}] - Context từ RAGPipeline:
   *   - `normalizedQuery` {string}: query đã expand abbreviations (skip bước expand nếu có)
   *   - `preClassifiedIntent` {string}: intent đã classify (skip classifyIntent nếu có)
   *   - `retrievedProducts` {Array}: sản phẩm đã search (skip bước retrieval nếu có)
   *   - `llmRewrittenQuery` {string}: query đã LLM rewrite (dùng cho generation prompt)
   * @returns {Promise<Object>} `{response: string, products: Array, suggestions: Array, intent: string}`
   */
  async handleMessage(message, userId = null, sessionId = null, context = {}) {
    const startTime = Date.now(); // Đo thời gian xử lý cho analytics
    try {
      // Bước 1: Chuẩn hóa query + phân loại intent
      logger.debug(`📝 Câu truy vấn gốc: "${message}"`);
      // RAGPipeline truyền normalizedQuery + preClassifiedIntent qua context → skip duplicate work
      const rewrittenQuery = context.normalizedQuery || expandAbbreviations(message);
      const intent = context.preClassifiedIntent || classifyIntent(rewrittenQuery);
      const searchMessage = rewrittenQuery;

      // Log query cuối cùng: ưu tiên LLM-rewritten nếu có, fallback về code-expand
      const displayQuery = context.llmRewrittenQuery || rewrittenQuery;
      if (displayQuery && displayQuery.toLowerCase() !== message.toLowerCase()) {
        logger.debug(`✨ Câu truy vấn đã viết lại: "${displayQuery}" (intent: ${intent})`);
      }

      // Bước 2: Off-topic → early return, không tốn retrieval + LLM call
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
        await this._persistMessages(
          sessionId,
          userId,
          message,
          offTopicResponse.response,
          intent,
          Date.now() - startTime,
          true,
        );
        return offTopicResponse;
      }

      // Bước 3: Cache check (chỉ product_search/recommendation)
      if (CACHEABLE_INTENTS.includes(intent)) {
        try {
          const redis = await getRedisClient();
          // Cache key shared (không theo user) để nhiều user cùng câu hỏi dùng chung cache
          const cacheKey = `chatbot:shared:${searchMessage.toLowerCase().trim()}`;
          const cached = await redis.get(cacheKey);
          if (cached) {
            logger.debug('[Chatbot] Cache HIT — trả kết quả từ cache');
            const cachedResult = JSON.parse(cached);
            if (sessionId) {
              const entry = this.conversationHistory.get(sessionId);
              const history = entry ? entry.messages : [];
              const updated = [
                ...history,
                { role: 'user', content: message },
                { role: 'assistant', content: cachedResult.response || '' },
              ].slice(-(MAX_HISTORY_TURNS * 2));
              this.conversationHistory.set(sessionId, {
                messages: updated,
                lastAccess: Date.now(),
              });
              this._evictStaleSessions();
            }
            await this._persistMessages(
              sessionId,
              userId,
              message,
              cachedResult.response || '',
              intent,
              Date.now() - startTime,
              false,
            );
            return cachedResult;
          }
        } catch {
          // Cache miss hoặc Redis lỗi → tiếp tục pipeline bình thường
        }
      }

      // Bước 4: Load lịch sử hội thoại từ session memory
      const sessionEntry = sessionId ? this.conversationHistory.get(sessionId) : null;
      const conversationHistory = sessionEntry ? sessionEntry.messages : [];

      // Bước 5: Retrieval — lấy sản phẩm liên quan qua hybrid search
      let relevantProducts = [];
      let finalQuery = searchMessage;

      if (context.retrievedProducts) {
        // Path A (chính): RAGPipeline đã retrieve → dùng kết quả có sẵn, không search lại
        relevantProducts = context.retrievedProducts;
        // Dùng LLM-rewritten query từ RAGPipeline nếu có — cải thiện generation prompt
        if (context.llmRewrittenQuery) finalQuery = context.llmRewrittenQuery;
      } else {
        // Path B (legacy): retrieval trực tiếp, không qua RAGPipeline
        // Chạy song song LLM rewrite + vector search để giảm tổng thời gian chờ
        const [llmRewrite, initialSearchResults] = await Promise.all([
          this._llmRewrite(searchMessage),
          vectorStoreService.hybridSearch(searchMessage, 10).catch(() => []),
        ]);

        finalQuery = llmRewrite || searchMessage;
        if (llmRewrite && llmRewrite !== searchMessage) {
          logger.debug(`✨ [LLM Rewrite] "${searchMessage}" → "${llmRewrite}"`);
          try {
            const refinedResults = await vectorStoreService.hybridSearch(llmRewrite, 10);
            // Dùng kết quả của query rewritten nếu có; fallback về kết quả ban đầu
            relevantProducts =
              refinedResults.length > 0
                ? refinedResults.map((r) => ({ ...r.metadata, score: r.score }))
                : initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
          } catch {
            relevantProducts = initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
          }
        } else {
          relevantProducts = initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
        }

        // Không có kết quả nào vượt ngưỡng score → hạ ngưỡng về 0 lấy top-3 gần nhất
        // Tránh trả về danh sách trống hoàn toàn khi có thể tìm thấy gì đó liên quan
        if (relevantProducts.length === 0) {
          logger.warn('Retrieval score < threshold cho mọi item — hạ threshold lấy top-3');
          try {
            const lowScoreResults = await vectorStoreService.hybridSearch(finalQuery, 3, 0);
            relevantProducts = lowScoreResults.map((r) => ({
              ...r.metadata,
              score: r.score,
              lowConfidence: true, // Đánh dấu để LLM biết kết quả này kém chắc chắn
            }));
          } catch {
            relevantProducts = [];
          }
        }
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`📦 Tìm thấy ${relevantProducts.length} sản phẩm liên quan qua RAG`);
      }

      // Bước 6: Gọi LLM với RAG context + lịch sử hội thoại (Generation)
      const aiResponse = await this.getAIResponse(
        finalQuery,
        relevantProducts,
        { ...context, originalMessage: message },
        conversationHistory,
      );

      // Bước 7: Cập nhật session memory + persist vào DB + cache response
      if (sessionId) {
        const updatedMessages = [
          ...conversationHistory,
          { role: 'user', content: message },
          { role: 'assistant', content: aiResponse.response || '' },
        ].slice(-(MAX_HISTORY_TURNS * 2)); // Cắt bỏ tin nhắn cũ nếu vượt quá giới hạn
        this.conversationHistory.set(sessionId, {
          messages: updatedMessages,
          lastAccess: Date.now(),
        });
        this._evictStaleSessions();
      }

      const responseTimeMs = Date.now() - startTime;
      await this._persistMessages(
        sessionId,
        userId,
        message,
        aiResponse.response || '',
        intent,
        responseTimeMs,
        false,
      );

      // Cache kết quả cho intent product_search
      if (CACHEABLE_INTENTS.includes(intent)) {
        try {
          const redis = await getRedisClient();
          const cacheKey = `chatbot:shared:${searchMessage.toLowerCase().trim()}`;
          await redis.setEx(cacheKey, CHATBOT_CACHE_TTL, JSON.stringify(aiResponse));
        } catch {
          // Cache write thất bại → bỏ qua, không ảnh hưởng response
        }
      }

      return aiResponse;
    } catch (error) {
      logger.error('Lỗi chatbot:', error);
      return this.getFallbackResponse(message);
    }
  }

  /**
   * Lưu cặp tin nhắn user + assistant vào bảng ChatMessage để tracking analytics và lịch sử.
   * Non-blocking: lỗi DB chỉ log warning, không fail request chính.
   *
   * @param {string|null} sessionId - Session ID (null → skip persist).
   * @param {number|null} userId - ID user.
   * @param {string} userMessage - Tin nhắn gốc từ user.
   * @param {string} assistantReply - Câu trả lời của chatbot.
   * @param {string} intent - Intent đã classify (product_search, off_topic...).
   * @param {number} responseTimeMs - Thời gian xử lý (ms) — dùng cho analytics dashboard.
   * @param {boolean} isFallback - True nếu response từ fallback (không qua LLM).
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
      if (!sessionId) return;
      await ChatMessage.bulkCreate([
        {
          sessionId,
          userId: userId || null,
          content: userMessage,
          role: 'user',
          messageType: 'ai_chatbot',
          intent,
          isFallback: false,
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
        },
      ]);
    } catch (dbError) {
      // Không để lỗi DB ảnh hưởng flow chính — chỉ log cảnh báo
      logger.warn('Không thể lưu chatbot messages vào DB:', dbError.message);
    }
  }

  /**
   * [Generation] Gọi LLM với RAG context + conversation history, trả về response JSON.
   *
   * Build system prompt với: vai trò nhân viên tư vấn + quy tắc không hallucinate +
   * danh mục/thương hiệu từ catalog cache. Inject conversation history để LLM nhớ ngữ cảnh.
   *
   * Provider rotation: thử lần lượt từng provider, fallback simpleKeywordMatch khi hết quota.
   * Retry khi: 429 (rate limit), 402 (quota), 500/503 (server lỗi), network error.
   * Không retry khi: 400 (bad request), 401 (auth fail) — lỗi không phục hồi được.
   *
   * @param {string} userMessage - Query đã sanitize (cắt xuống 2000 ký tự, escape quotes).
   * @param {Array<Object>} products - Sản phẩm từ retrieval (đã có score + metadata).
   * @param {Object} context - Context bổ sung (originalMessage, llmRewrittenQuery...).
   * @param {Array<Object>} [history=[]] - Lịch sử hội thoại dạng [{role, content}].
   * @returns {Promise<Object>} `{response: string, products: Array, suggestions: Array, intent: string}`
   */
  async getAIResponse(userMessage, products, context, history = []) {
    if (this.providers.length === 0) {
      return this.getFallbackResponse(userMessage);
    }

    await this._ensureCatalogCache();

    const sanitizedMessage = userMessage
      .replace(/"/g, "'")
      .replace(/\n{2,}/g, '\n')
      .trim()
      .substring(0, 2000);

    const ragContextMessage = this.createPrompt(sanitizedMessage, products, context);

    const storeName = process.env.STORE_NAME || 'TechStore';
    const systemContent = `Bạn là nhân viên tư vấn của ${storeName} — cửa hàng công nghệ chuyên điện thoại, máy tính bảng và laptop.
QUY TẮC BẮT BUỘC:
1. CHỈ tư vấn sản phẩm có trong DANH SÁCH SẢN PHẨM được cung cấp trong tin nhắn.
2. TUYỆT ĐỐI không bịa tên sản phẩm, giá, hoặc thông số kỹ thuật ngoài danh sách.
3. Nếu sản phẩm không có trong danh sách, nói rõ: "Cửa hàng hiện chưa có [tên sản phẩm] ạ."
4. Respond in the SAME language as the customer's message. If Vietnamese → reply Vietnamese (thân thiện: mình/em - bạn/anh/chị). If English → reply English (friendly tone).
5. Trả về đúng định dạng JSON được yêu cầu trong tin nhắn.
6. Danh mục: ${(this._categoriesCache || []).join(', ')} — Thương hiệu: ${(this._brandsCache || []).join(', ')}`;

    const messages = [
      { role: 'system', content: systemContent },
      ...history,
      { role: 'user', content: ragContextMessage },
    ];

    // Thử lần lượt từng provider cho đến khi thành công
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
            response_format: { type: 'json_object' },
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

        const aiText = response.data.choices?.[0]?.message?.content;
        if (!aiText) {
          logger.warn(`LLM trả về choices rỗng (${provider.model}) — thử provider tiếp theo`);
          continue;
        }

        if (process.env.NODE_ENV !== 'production')
          logger.debug(`Đã nhận phản hồi từ ${provider.model}`);
        return this.parseAIResponse(aiText, products, userMessage);
      } catch (error) {
        const status = error.response?.status;
        if (
          status === 429 ||
          status === 402 ||
          status === 500 ||
          status === 503 ||
          !error.response
        ) {
          logger.warn(
            `[Rotation] getAIResponse provider ${attempt + 1}/${this.providers.length} (${provider.model}) lỗi ${status || error.code}, thử tiếp...`,
          );
          continue;
        }
        logger.error(
          `Chi tiết lỗi LLM API (${provider.model}):`,
          error.response?.data || error.message,
        );
        break;
      }
    }
    return this.simpleKeywordMatch(userMessage, products);
  }

  /**
   * Dọn dẹp session memory để tránh rò rỉ bộ nhớ khi server chạy lâu.
   * Được gọi tự động sau mỗi lần cập nhật lịch sử hội thoại.
   *
   * **Evict nghĩa là gì?**
   * "Evict" = đuổi/xóa — thuật ngữ cache để chỉ việc xóa entry cũ/không dùng ra khỏi bộ nhớ.
   * Tương tự như LRU (Least Recently Used) cache eviction trong các hệ thống cache.
   *
   * **Thực hiện 2 bước theo thứ tự:**
   * Bước 1 — Xóa session hết hạn: session không có tin nhắn mới trong SESSION_TTL_MS (30 phút) → xóa.
   * Bước 2 — Giới hạn tổng số session: nếu vẫn còn >MAX_SESSIONS (500) session sau bước 1,
   *   xóa những session có lần truy cập CŨ NHẤT cho đến khi còn đúng MAX_SESSIONS.
   *   (Chiến lược LRU: giữ lại những session đang active nhất — ít dùng nhất bị xóa trước)
   */
  _evictStaleSessions() {
    if (this.conversationHistory.size === 0) return;
    const now = Date.now();

    // Bước 1: Xóa session quá hạn (không hoạt động > SESSION_TTL_MS)
    for (const [sessionId, sessionData] of this.conversationHistory) {
      if (now - sessionData.lastAccess > SESSION_TTL_MS) {
        this.conversationHistory.delete(sessionId);
      }
    }

    // Bước 2: Nếu vẫn còn quá nhiều session → xóa session ít dùng nhất (LRU)
    if (this.conversationHistory.size > MAX_SESSIONS) {
      // Sort theo thời gian truy cập tăng dần (cũ nhất ở đầu)
      const sortedByLeastRecentlyUsed = [...this.conversationHistory.entries()].sort(
        (a, b) => a[1].lastAccess - b[1].lastAccess,
      );
      const numberOfSessionsToRemove = sortedByLeastRecentlyUsed.length - MAX_SESSIONS;
      for (let i = 0; i < numberOfSessionsToRemove; i++) {
        this.conversationHistory.delete(sortedByLeastRecentlyUsed[i][0]);
      }
    }
  }
}

module.exports = new ChatbotService();
