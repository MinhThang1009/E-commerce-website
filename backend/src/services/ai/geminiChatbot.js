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
const { detectLanguage, enrichProductData } = vectorStoreService;
const { expandAbbreviations } = require('../../modules/ai/domain/policies/AiPolicy');
const logger = require('../../utils/logger');
const { getRedisClient } = require('../../config/redis');

// Extract JSON object từ response text — xử lý trường hợp model wrap bằng text hoặc markdown
function extractJSON(text) {
  const clean = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
  try {
    return JSON.parse(clean);
  } catch {}
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return null;
}

// Cache TTL cho chatbot query result (5 phút)
const CHATBOT_CACHE_TTL = 5 * 60;
// Chỉ cache intent tìm sản phẩm — KHÔNG cache order_inquiry, support (data realtime)
const CACHEABLE_INTENTS = ['product_search', 'recommendation'];

// Số lượt hội thoại tối đa giữ trong bộ nhớ (10 turns = 20 messages: user + assistant)
const MAX_HISTORY_TURNS = 10;
// Giới hạn số sessions trong memory — evict oldest khi vượt ngưỡng
const MAX_SESSIONS = 500;
// Session hết hạn sau 30 phút không hoạt động
const SESSION_TTL_MS = 30 * 60 * 1000;

class GeminiChatbotService {
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

  // Rule-based preprocessing — 0ms, không cần LLM call
  async preprocessMessage(message) {
    const rewrittenQuery = expandAbbreviations(message);

    const lower = rewrittenQuery.toLowerCase();
    let intent = 'general';
    const hasProductName =
      /iphone|samsung|macbook|laptop|phone|computer|tablet|điện thoại|máy tính|đồng hồ|smartwatch|watch|ipad|oppo|xiaomi|realme|pixel|nokia|headphone|earbuds|airpods|galaxy|surface/.test(
        lower,
      );
    if (
      /thời tiết|bóng đá|âm nhạc|phim|nấu ăn|sức khỏe|tin tức|weather|football|soccer|music|movie|cooking|health|news/.test(
        lower,
      )
    ) {
      intent = 'off_topic';
    } else if (/đơn hàng|order|giao hàng|ship|track|delivery|shipping\s*status/.test(lower)) {
      intent = 'order_inquiry';
    } else if (/bảo hành|đổi trả|chính sách|policy|warranty|return|refund|exchange/.test(lower)) {
      intent = 'policy';
    } else if (hasProductName) {
      intent = 'product_search';
    } else if (
      /tư vấn|so sánh|nên mua|recommend|suggest|tốt nhất|compare|best|should\s*i\s*buy|which\s*one/.test(
        lower,
      )
    ) {
      intent = 'product_search';
    } else if (/giá|bao nhiêu|tiền|cost|price|how\s*much|affordable|budget|cheap/.test(lower)) {
      intent = 'pricing';
    }

    return { rewrittenQuery, intent };
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
        if (rewritten && rewritten !== message) return rewritten;
        return null;
      } catch (err) {
        const status = err.response?.status;
        if (status === 429 || status === 402) continue;
        return null;
      }
    }
    return null;
  }

  async handleMessage(message, userId = null, sessionId = null, context = {}) {
    const startTime = Date.now(); // Đo thời gian xử lý cho analytics
    try {
      // Bước 0: Chuẩn hóa query + phân loại intent (1 LLM call)
      logger.debug(`📝 Câu truy vấn gốc: "${message}"`);
      const { rewrittenQuery, intent } = await this.preprocessMessage(message);
      const searchMessage = rewrittenQuery || message;

      if (rewrittenQuery && rewrittenQuery.toLowerCase() !== message.toLowerCase()) {
        logger.debug(`✨ Câu truy vấn đã viết lại: "${rewrittenQuery}" (intent: ${intent})`);
      }

      // Bước 0.5: Nếu off_topic → báo rõ ngoài phạm vi, không tốn thêm 2 API call
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

      // Bước 0.6: Kiểm tra query result cache (chỉ cho intent product_search/recommendation)
      if (CACHEABLE_INTENTS.includes(intent)) {
        try {
          const redis = await getRedisClient();
          // Product search không phụ thuộc user — dùng shared cache key để tận dụng tốt hơn
          const cacheKey = `chatbot:shared:${searchMessage.toLowerCase().trim()}`;
          const cached = await redis.get(cacheKey);
          if (cached) {
            logger.debug('[Chatbot] Cache HIT — trả kết quả từ cache');
            const cachedResult = JSON.parse(cached);
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

      // Bước 1: Load lịch sử hội thoại theo sessionId
      const entry = sessionId ? this.conversationHistory.get(sessionId) : null;
      const history = entry ? entry.messages : [];

      // Bước 2: Retrieval — lấy sản phẩm liên quan qua RAG
      let relevantProducts = [];
      let finalQuery = searchMessage;

      if (context.retrievedProducts) {
        // RagPipeline đã retrieve — dùng kết quả có sẵn, bỏ qua vector search trùng lặp
        relevantProducts = context.retrievedProducts;
      } else {
        // Legacy path: retrieval trực tiếp trong service
        const [llmRewrite, initialSearchResults] = await Promise.all([
          this._llmRewrite(message),
          vectorStoreService.search(searchMessage, 10).catch(() => []),
        ]);

        finalQuery = llmRewrite || searchMessage;
        if (llmRewrite && llmRewrite !== searchMessage) {
          logger.debug(`✨ [LLM Rewrite] "${searchMessage}" → "${llmRewrite}"`);
          try {
            const refined = await vectorStoreService.search(llmRewrite, 10);
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
            const anyResults = await vectorStoreService.search(finalQuery, 3, 0);
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

      // Bước 3: Gọi LLM với RAG context + lịch sử hội thoại (Generation)
      const aiResponse = await this.getAIResponse(
        finalQuery,
        relevantProducts,
        { ...context, originalMessage: message },
        history,
      );

      // Bước 4: Lưu lịch sử hội thoại
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

  // Lấy phản hồi AI qua Gemini API với key rotation + retry khi quota hết
  async getAIResponse(userMessage, products, context, history = []) {
    if (this.providers.length === 0) {
      return this.getFallbackResponse(userMessage);
    }

    await this._ensureCatalogCache();

    const sanitizedMessage = userMessage
      .replace(/"/g, "'")
      .replace(/\n{2,}/g, '\n')
      .trim()
      .substring(0, 1000);

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
          logger.warn('Gemini trả về choices rỗng — dùng fallback response');
          return this.getFallbackResponse(userMessage);
        }

        if (process.env.NODE_ENV !== 'production') logger.debug('Đã nhận phản hồi từ Gemini API');
        return this.parseAIResponse(aiText, products, userMessage);
      } catch (error) {
        const status = error.response?.status;
        if (status === 429 || status === 402) {
          logger.warn(
            `[Rotation] getAIResponse provider ${attempt + 1}/${this.providers.length} (${provider.model}) quota hết, thử tiếp...`,
          );
          continue;
        }
        logger.error('Chi tiết lỗi Gemini API:', error.response?.data || error.message);
        break;
      }
    }
    return this.simpleKeywordMatch(userMessage, products);
  }

  // Tạo prompt đầy đủ với product list và hướng dẫn JSON response
  createPrompt(userMessage, products, context) {
    const productList = products
      .map(
        (p) =>
          `- ${p.lowConfidence ? '⚠️[low confidence] ' : ''}${p.name} (${p.category || 'Sản phẩm'}): ${p.shortDescription || 'Mô tả đang cập nhật'} - Giá: ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ - Tình trạng: ${p.inStock ? 'Còn hàng' : 'Hết hàng'}`,
      )
      .join('\n');

    // Context augmentation: phát hiện số version/thế hệ trong query,
    // báo LLM biết nếu không có sản phẩm nào khớp số đó trong retrieved context
    const queryVersions = userMessage.match(/\b\d{2,}\b/g) || [];
    const productNames = products.map((p) => p.name?.toLowerCase() || '');
    const missingVersions = queryVersions.filter(
      (v) => !productNames.some((name) => name.includes(v)),
    );
    const versionWarning =
      missingVersions.length > 0
        ? `\n⚠️ CẢNH BÁO: Query đề cập đến số "${missingVersions.join(', ')}" nhưng KHÔNG có sản phẩm nào trong danh sách chứa số này. Đây là retrieved context gần nhất, KHÔNG phải sản phẩm được hỏi.`
        : '';

    return `
DANH SÁCH SẢN PHẨM HIỆN CÓ (Dữ liệu thực tế — retrieved bởi semantic search):
${productList}
${versionWarning}

THÔNG TIN CỬA HÀNG (${process.env.STORE_NAME || 'TechStore'}):
- Bảo hành: ${process.env.STORE_WARRANTY || '12 tháng chính hãng'}
- Giao hàng: ${process.env.STORE_SHIPPING || 'Miễn phí toàn quốc'}
- Đổi trả: ${process.env.STORE_RETURN || '30 ngày nếu lỗi nhà sản xuất'}
- Hỗ trợ kỹ thuật: ${process.env.STORE_SUPPORT || 'Tư vấn cấu hình, so sánh, hỗ trợ sau mua hàng'}

TIN NHẮN KHÁCH HÀNG: "${userMessage}"

QUY TẮC SO KHỚP SẢN PHẨM (BẮT BUỘC):
1. Thương hiệu + Dòng sản phẩm + Hậu tố phiên bản là 3 yếu tố phân biệt.
   - Bản thường, Pro, Pro Max, Plus, Ultra, e, Lite → KHÁC NHAU HOÀN TOÀN.
   - Số thế hệ (13, 14, 15, 16, 17…) → KHÁC NHAU HOÀN TOÀN.
2. Máy tính bảng: WiFi, 4G, 5G cùng model → KHÁC NHAU.
3. Laptop: Cùng tên nhưng khác chip (i3/i5/i7, R5/R7, M3/M4/M5) → KHÁC NHAU.
4. NẾU CÓ ⚠️ CẢNH BÁO ở trên: BẮT BUỘC nói "Cửa hàng hiện chưa có [tên sản phẩm khách hỏi] ạ" trước, rồi mới gợi ý tương đương.
5. NẾU KHÔNG CÓ trong danh sách (không có cảnh báo): Nói rõ "chưa có" rồi gợi ý tương đương.
6. KHÔNG BỊA tên, giá, thông số ngoài danh sách.

Trả về ĐÚNG định dạng JSON sau:
{
  "response": "Câu trả lời thân thiện (dùng emoji phù hợp)",
  "matchedProducts": ["Tên chính xác sản phẩm trong danh sách"],
  "suggestions": ["Gợi ý câu tiếp theo"],
  "intent": "product_search|pricing|policy|support|general|off_topic"
}`;
  }

  // Phân tích phản hồi AI và khớp với sản phẩm thực tế
  parseAIResponse(aiText, products, userMessage) {
    try {
      const parsed = extractJSON(aiText);
      if (!parsed) throw new Error('Không parse được JSON từ response');

      // Tìm sản phẩm thực tế từ tên LLM đề xuất
      const matchedProducts = [];
      if (parsed.matchedProducts && Array.isArray(parsed.matchedProducts)) {
        parsed.matchedProducts.forEach((productName) => {
          const product = products.find((p) => {
            const pName = p.name.toLowerCase();
            const rName = productName.toLowerCase();

            // Exact match trước
            if (pName === rName) return true;

            // Phải có cùng từ khóa phiên bản (pro, max, plus, ultra...)
            const versionKeywords = ['pro', 'max', 'plus', 'ultra', 'mini', 'se', 'ti', 'super'];
            const rVersions = versionKeywords.filter((v) => rName.includes(v));
            const pVersions = versionKeywords.filter((v) => pName.includes(v));
            if (
              rVersions.length !== pVersions.length ||
              !rVersions.every((v) => pVersions.includes(v))
            ) {
              return false;
            }

            // Kiểm tra số phiên bản chính — so sánh bằng word boundary, tránh "15" match "150"
            const numbersP = pName.match(/\b\d+\b/g);
            const numbersR = rName.match(/\b\d+\b/g);
            if (numbersP && numbersR && numbersP[0] !== numbersR[0]) return false;

            // So khớp theo từng từ để tránh "iPhone 15" match nhầm "iPhone 150"
            const pWords = new Set(pName.split(/\s+/));
            const rWords = new Set(rName.split(/\s+/));
            const intersection = [...pWords].filter((w) => rWords.has(w) && w.length > 1);
            const minSize = Math.min(pWords.size, rWords.size);
            return minSize > 0 && intersection.length >= minSize * 0.8;
          });

          if (product) {
            // product.price: từ vector store metadata; product.basePrice: từ DB fallback
            const resolvedPrice = product.price ?? product.basePrice;
            const resolvedCompare = product.compareAtPrice;
            matchedProducts.push({
              id: product.id,
              name: product.name,
              slug: product.slug,
              price: resolvedPrice,
              compareAtPrice: resolvedCompare,
              thumbnail: product.thumbnail,
              inStock: product.inStock !== undefined ? product.inStock : true,
              stockQuantity: product.stockQuantity,
              rating: null, // Tính từ review table thực tế khi cần hiển thị
              discount:
                resolvedCompare && resolvedCompare > resolvedPrice
                  ? Math.round(((resolvedCompare - resolvedPrice) / resolvedCompare) * 100)
                  : 0,
            });
          } else {
            // Hallucination detection: LLM đề xuất sản phẩm không có trong retrieved context
            logger.warn(
              `[RAG] Hallucination detected: LLM đề xuất "${productName}" nhưng không có trong retrieved context`,
            );
          }
        });
      }

      // Deduplicate theo id — tránh React duplicate key warning
      const seen = new Set();
      const uniqueProducts = matchedProducts.filter((p) => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      return {
        response: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
        products: uniqueProducts,
        suggestions: parsed.suggestions || [
          'Xem tất cả sản phẩm',
          'Sản phẩm khuyến mãi',
          'Hỗ trợ mua hàng',
          'Liên hệ tư vấn',
        ],
        intent: parsed.intent || 'general',
      };
    } catch (error) {
      logger.error('[RAG] parseAIResponse JSON.parse failed:', error.message);
    }

    // Dự phòng: dùng khớp từ khóa đơn giản
    return this.simpleKeywordMatch(userMessage, products);
  }

  // Khớp từ khóa đơn giản (dùng khi AI không khả dụng hoặc parseAIResponse fail)
  simpleKeywordMatch(userMessage, products) {
    const lowerMessage = userMessage.toLowerCase().trim();
    const lang = detectLanguage(userMessage);
    const isEn = lang === 'en';
    let matchedProducts = [];

    const searchTerms = lowerMessage.split(' ').filter((term) => term.length > 2);
    searchTerms.push(lowerMessage);

    products.forEach((product) => {
      let matchScore = 0;
      const productName = product.name?.toLowerCase() || '';
      const productDesc = product.shortDescription?.toLowerCase() || '';

      searchTerms.forEach((term) => {
        if (productName.includes(term)) matchScore += 10;
        if (productDesc.includes(term)) matchScore += 5;
      });

      if (matchScore > 0) {
        matchedProducts.push({ ...product, matchScore });
      }
    });

    // Nếu query có số thế hệ/phiên bản (≥2 chữ số), chỉ giữ SP có đúng số đó trong tên
    // Tránh "iphone 18" match nhầm "iPhone 17"
    const versionNumbers = lowerMessage.match(/\b\d{2,}\b/g);
    if (versionNumbers) {
      const filtered = matchedProducts.filter((p) =>
        versionNumbers.some((v) => p.name?.toLowerCase().includes(v)),
      );
      // Chỉ áp dụng filter nếu còn kết quả — nếu không còn thì báo không có
      if (filtered.length === 0) {
        const productName = lowerMessage
          .replace(
            /giá bao nhiêu|bao nhiêu tiền|có không|có ko|có màu gì|bán không|mua ở đâu|thông số|how much|price|available|color|where to buy|specs?|\?/gi,
            '',
          )
          .trim();
        return {
          response: isEn
            ? `😔 We don't currently have ${productName} in stock. Would you like to see similar products?`
            : `😔 Cửa hàng hiện chưa có ${productName} ạ. Bạn có muốn xem các sản phẩm tương tự đang có không?`,
          products: [],
          suggestions: isEn
            ? ['View similar products', 'View all phones', 'Get advice']
            : ['Xem sản phẩm tương tự', 'Xem tất cả điện thoại', 'Tư vấn thêm'],
          intent: 'product_search',
        };
      }
      matchedProducts = filtered;
    }

    matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

    const uniqueProducts = matchedProducts.filter(
      (product, index, self) => index === self.findIndex((p) => p.id === product.id),
    );

    if (uniqueProducts.length > 0) {
      const topProducts = uniqueProducts.slice(0, 5);
      const productList = topProducts
        .map((p) => `• ${p.name} - ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ`)
        .join('\n');

      return {
        response: isEn
          ? `🔍 I found some products matching your request:\n\n${productList}\n\nWould you like more details on any of these?`
          : `🔍 Mình tìm thấy một số sản phẩm phù hợp với yêu cầu của bạn nè: \n\n${productList} \n\nBạn muốn xem kỹ hơn sản phẩm nào không?`,
        products: topProducts.slice(0, 3).map((product) => {
          const p = product.price ?? product.basePrice;
          const c = product.compareAtPrice;
          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: p,
            compareAtPrice: c,
            thumbnail: product.thumbnail,
            inStock: product.inStock,
            rating: null,
            discount: c && c > p ? Math.round(((c - p) / c) * 100) : 0,
          };
        }),
        suggestions: isEn
          ? ['View details', 'Other products', 'Get advice']
          : ['Xem chi tiết', 'Sản phẩm khác', 'Tư vấn thêm'],
        intent: 'product_search',
      };
    }

    // Query "hàng mới" cần sort theo ngày tạo, không phải similarity score
    if (
      /sản phẩm mới|hàng mới|mới nhất|new\s*(product|arrival|item)s?|latest|newest/.test(
        lowerMessage,
      )
    ) {
      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Đã nhận diện ý định "sản phẩm mới"');
      }

      // Sort theo createdAt mới nhất — products từ vector store có createdAt trong metadata
      const newProducts = [...products]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      const productList = newProducts
        .map((p) => `• ${p.name} - ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ`)
        .join('\n');

      return {
        response: isEn
          ? `🌟 Here are our latest arrivals:\n\n${productList}\n\nAnything catch your eye?`
          : `🌟 Đây là những sản phẩm mới nhất vừa cập bến cửa hàng mình nè: \n\n${productList} \n\nBạn ưng ý mẫu nào không?`,
        products: newProducts.slice(0, 3).map((product) => {
          const p = product.price ?? product.basePrice;
          const c = product.compareAtPrice;
          return {
            id: product.id,
            name: product.name,
            slug: product.slug,
            price: p,
            compareAtPrice: c,
            thumbnail: product.thumbnail,
            inStock: product.inStock,
            rating: null,
            discount: c && c > p ? Math.round(((c - p) / c) * 100) : 0,
          };
        }),
        suggestions: isEn
          ? ['View details', 'Deals & promotions', 'Get advice']
          : ['Xem chi tiết', 'Sản phẩm khuyến mãi', 'Tư vấn thêm'],
        intent: 'product_search',
      };
    }

    return this.getFallbackResponse(userMessage);
  }

  _evictStaleSessions() {
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

  // Phản hồi dự phòng khi AI không khả dụng hoặc câu hỏi ngoài scope
  getFallbackResponse(userMessage) {
    const storeName = process.env.STORE_NAME || 'TechStore';
    const lang = detectLanguage(userMessage);
    const isEn = lang === 'en';
    return {
      response: isEn
        ? `Hi there! I'm a support assistant at ${storeName}. How can I help you today? 😊`
        : `Chào bạn! Mình là nhân viên hỗ trợ của ${storeName}. Mình có thể giúp gì cho bạn hôm nay? 😊`,
      products: [],
      suggestions: isEn
        ? ['New arrivals', 'Deals & promotions', 'Shopping help', 'Product advice']
        : ['Xem sản phẩm mới', 'Sản phẩm khuyến mãi', 'Hỗ trợ mua hàng', 'Tư vấn sản phẩm'],
      intent: 'general',
    };
  }
}

module.exports = new GeminiChatbotService();
