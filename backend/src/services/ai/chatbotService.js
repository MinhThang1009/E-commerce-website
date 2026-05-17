const axios = require('axios');
const {
  Product,
  Category,
  Brand,
  ChatMessage,
  ProductImage,
  ProductVariant,
  sequelize,
} = require('../../models');
const vectorStoreService = require('./vectorStore');
const { detectLanguage } = require('./languageDetector');
const { expandAbbreviations, classifyIntent } = require('../../modules/ai/domain/policies/AIPolicy');
const logger = require('../../utils/logger');
const { getRedisClient } = require('../../config/redis');
const promptBuilder = require('./promptBuilder');
const responseParser = require('./responseParser');
const keywordFallback = require('./keywordFallback');

// Cache TTL cho chatbot query result (5 phút)
const CHATBOT_CACHE_TTL = 5 * 60;
// Chỉ cache intent tìm sản phẩm — KHÔNG cache order_inquiry, policy, pricing (data realtime)
const CACHEABLE_INTENTS = ['product_search'];

// Số lượt hội thoại tối đa giữ trong bộ nhớ (10 turns = 20 messages: user + assistant)
const MAX_HISTORY_TURNS = 10;
// Giới hạn số sessions trong memory — evict oldest khi vượt ngưỡng
const MAX_SESSIONS = 500;
// Session hết hạn sau 30 phút không hoạt động
const SESSION_TTL_MS = 30 * 60 * 1000;

class ChatbotService {
  constructor() {
    // Unified provider list: third-party trước, Gemini keys fallback
    // Mỗi provider: { key, url, model }
    const geminiKeys = (process.env.GEMINI_API_KEYS || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    const geminiModel = 'gemini-2.0-flash';

    this.providers = [];
    if (process.env.LLM_API_KEY && process.env.LLM_BASE_URL) {
      this.providers.push({
        key: process.env.LLM_API_KEY,
        url: `${process.env.LLM_BASE_URL}/chat/completions`,
        model: process.env.LLM_MODEL || 'claude-sonnet-4-6',
      });
    }
    geminiKeys.forEach((k) => this.providers.push({ key: k, url: geminiUrl, model: geminiModel }));

    // Backward compat cho initializeChatbot log
    this.geminiKeys = geminiKeys;
    this._brandsCache = null;
    this._categoriesCache = null;
    this._catalogCacheExpiry = 0;
    // Lịch sử hội thoại lưu theo sessionId (in-memory Map)
    // Reset khi server restart — đủ cho demo, production dùng Redis
    this.conversationHistory = new Map();

    // Delegate extracted functions — giữ instance API cho tests gọi chatbotService.X()
    this.createPrompt = promptBuilder.createPrompt;
    this.parseAIResponse = responseParser.parseAIResponse;
    this.simpleKeywordMatch = keywordFallback.simpleKeywordMatch;
    this.getFallbackResponse = keywordFallback.getFallbackResponse;

    this.initializeChatbot();
  }

  // Load brands và categories từ DB, cache 5 phút
  async _ensureCatalogCache() {
    if (this._brandsCache && Date.now() < this._catalogCacheExpiry) return;
    const [brands, categories] = await Promise.all([
      Brand.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
      Category.findAll({ attributes: ['nameVi', 'nameEn'], raw: true }),
    ]);
    this._brandsCache = brands.map((b) => b.nameVi || b.nameEn).filter(Boolean);
    this._categoriesCache = categories.map((c) => c.nameVi || c.nameEn).filter(Boolean);
    this._catalogCacheExpiry = Date.now() + 5 * 60 * 1000;
  }

  initializeChatbot() {
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

  // LLM rewrite nhẹ: chỉ mở rộng viết tắt + chuẩn hóa query — chạy song song với vector search
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
            max_tokens: 80,
            temperature: 0,
          },
          {
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
            },
            timeout: 8000,
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

  async handleMessage(message, userId = null, sessionId = null, context = {}) {
    const startTime = Date.now(); // Đo thời gian xử lý cho analytics
    try {
      // Bước 1: Chuẩn hóa query + phân loại intent
      logger.debug(`📝 Câu truy vấn gốc: "${message}"`);
      // RAGPipeline truyền normalizedQuery + preClassifiedIntent qua context → skip duplicate work
      const rewrittenQuery = context.normalizedQuery || expandAbbreviations(message);
      const intent = context.preClassifiedIntent || classifyIntent(rewrittenQuery);
      const searchMessage = rewrittenQuery;

      if (rewrittenQuery && rewrittenQuery.toLowerCase() !== message.toLowerCase()) {
        logger.debug(`✨ Câu truy vấn đã viết lại: "${rewrittenQuery}" (intent: ${intent})`);
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
          // Product search không phụ thuộc user — dùng shared cache key để tận dụng tốt hơn
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
              this.conversationHistory.set(sessionId, { messages: updated, lastAccess: Date.now() });
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

      // Bước 4: Load lịch sử hội thoại
      const entry = sessionId ? this.conversationHistory.get(sessionId) : null;
      const history = entry ? entry.messages : [];

      // Bước 5: Retrieval — lấy sản phẩm liên quan qua hybrid search
      let relevantProducts = [];
      let finalQuery = searchMessage;

      if (context.retrievedProducts) {
        // RAGPipeline đã retrieve — dùng kết quả có sẵn, bỏ qua vector search trùng lặp
        relevantProducts = context.retrievedProducts;
        // Dùng LLM-rewritten query từ RAGPipeline nếu có — cải thiện generation prompt
        if (context.llmRewrittenQuery) finalQuery = context.llmRewrittenQuery;
      } else {
        // Legacy path: retrieval trực tiếp trong service
        const [llmRewrite, initialSearchResults] = await Promise.all([
          this._llmRewrite(searchMessage),
          vectorStoreService.hybridSearch(searchMessage, 10).catch(() => []),
        ]);

        finalQuery = llmRewrite || searchMessage;
        if (llmRewrite && llmRewrite !== searchMessage) {
          logger.debug(`✨ [LLM Rewrite] "${searchMessage}" → "${llmRewrite}"`);
          try {
            const refined = await vectorStoreService.hybridSearch(llmRewrite, 10);
            relevantProducts =
              refined.length > 0
                ? refined.map((r) => ({ ...r.metadata, score: r.score }))
                : initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
          } catch {
            relevantProducts = initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
          }
        } else {
          relevantProducts = initialSearchResults.map((r) => ({ ...r.metadata, score: r.score }));
        }

        if (relevantProducts.length === 0) {
          logger.warn('Retrieval score < threshold cho mọi item — hạ threshold lấy top-3');
          try {
            const anyResults = await vectorStoreService.hybridSearch(finalQuery, 3, 0);
            relevantProducts = anyResults.map((r) => ({
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

      // Bước 6: Gọi LLM với RAG context + lịch sử hội thoại (Generation)
      const aiResponse = await this.getAIResponse(
        finalQuery,
        relevantProducts,
        { ...context, originalMessage: message },
        history,
      );

      // Bước 7: Lưu lịch sử hội thoại + cache response
      if (sessionId) {
        const updatedHistory = [
          ...history,
          { role: 'user', content: message },
          { role: 'assistant', content: aiResponse.response || '' },
        ];
        const trimmed = updatedHistory.slice(-(MAX_HISTORY_TURNS * 2));
        this.conversationHistory.set(sessionId, { messages: trimmed, lastAccess: Date.now() });
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

      // Cache kết quả cho intent product_search/recommendation
      if (CACHEABLE_INTENTS.includes(intent)) {
        try {
          const redis = await getRedisClient();
          // Product search không phụ thuộc user — dùng shared cache key để tận dụng tốt hơn
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

  // Lưu cặp user/assistant message vào DB để tracking analytics và conversation history
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
   * Provider rotation: thử lần lượt từng provider, fallback simpleKeywordMatch khi hết quota.
   * @param {string} userMessage - Query đã sanitize.
   * @param {Array<Object>} products - Sản phẩm từ retrieval.
   * @param {Object} context - Context bổ sung.
   * @param {Array<Object>} [history=[]] - Lịch sử hội thoại (role/content pairs).
   * @returns {Promise<Object>} {response, products, suggestions, intent}.
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

    // Thử lần lượt từng key cho đến khi thành công
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
            temperature: 0.3,
            max_tokens: 800,
          },
          {
            headers: {
              Authorization: `Bearer ${provider.key}`,
              'Content-Type': 'application/json',
            },
            timeout: 30000,
          },
        );

        const aiText = response.data.choices?.[0]?.message?.content;
        if (!aiText) {
          logger.warn(`LLM trả về choices rỗng (${provider.model}) — thử provider tiếp theo`);
          continue;
        }

        if (process.env.NODE_ENV !== 'production') logger.debug(`Đã nhận phản hồi từ ${provider.model}`);
        return this.parseAIResponse(aiText, products, userMessage);
      } catch (error) {
        const status = error.response?.status;
        if (status === 429 || status === 402 || status === 500 || status === 503 || !error.response) {
          logger.warn(
            `[Rotation] getAIResponse provider ${attempt + 1}/${this.providers.length} (${provider.model}) lỗi ${status || error.code}, thử tiếp...`,
          );
          continue;
        }
        logger.error(`Chi tiết lỗi LLM API (${provider.model}):`, error.response?.data || error.message);
        break;
      }
    }
    return this.simpleKeywordMatch(userMessage, products);
  }


  _evictStaleSessions() {
    if (this.conversationHistory.size === 0) return;
    const now = Date.now();
    for (const [key, val] of this.conversationHistory) {
      if (now - val.lastAccess > SESSION_TTL_MS) {
        this.conversationHistory.delete(key);
      }
    }
    if (this.conversationHistory.size > MAX_SESSIONS) {
      const sorted = [...this.conversationHistory.entries()].sort(
        (a, b) => a[1].lastAccess - b[1].lastAccess,
      );
      const toRemove = sorted.length - MAX_SESSIONS;
      for (let i = 0; i < toRemove; i++) {
        this.conversationHistory.delete(sorted[i][0]);
      }
    }
  }

}

module.exports = new ChatbotService();
