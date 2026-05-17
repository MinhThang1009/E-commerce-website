const axios = require('axios');
const { Product, Category, Brand, ChatMessage, ProductImage, ProductVariant, sequelize } = require('../../models');
const { Op } = require('sequelize');
const vectorStoreService = require('./vectorStore');
const { enrichProductData } = require('./vectorStore');
const logger = require('../../utils/logger');
const { getRedisClient } = require('../../config/redis');

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
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.model = 'google/gemini-2.0-flash-001';
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
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
      Brand.findAll({ attributes: ['name'], raw: true }),
      Category.findAll({ attributes: ['name'], raw: true }),
    ]);
    this._brandsCache = brands.map(b => b.name);
    this._categoriesCache = categories.map(c => c.name);
    this._catalogCacheExpiry = Date.now() + 5 * 60 * 1000;
  }

  initializeChatbot() {
    try {
      if (this.apiKey && this.apiKey !== 'demo-key') {
        logger.info(`OpenRouter AI khởi tạo thành công với model: ${this.model}`);
      } else {
        logger.warn('Không tìm thấy OpenRouter API key, sử dụng phản hồi dự phòng');
      }
    } catch (error) {
      logger.error('Khởi tạo Chatbot thất bại:', error.message || error);
    }
  }

  // Gộp phân loại intent + chuẩn hóa query thành 1 LLM call — nếu off_topic, trả về ngay không cần gọi thêm
  async preprocessMessage(message) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      return { rewrittenQuery: message, intent: 'general' };
    }
    try {
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `Xử lý câu hỏi mua sắm tiếng Việt cho cửa hàng công nghệ. Thực hiện 2 nhiệm vụ và trả về JSON:
1. Chuẩn hóa câu hỏi: sửa lỗi chính tả, mở rộng từ viết tắt (ip→iPhone, pm→Pro Max, ss→Samsung, mb→MacBook, xl→Xiaomi, op→OPPO, rl→realme, r5→AMD Ryzen 5, r7→AMD Ryzen 7, sp→sản phẩm, bh→bảo hành, đh→đơn hàng)
2. Phân loại intent: product_search|pricing|order_inquiry|policy|support|general|off_topic
Format bắt buộc: {"rewrittenQuery": "câu đã chuẩn hóa", "intent": "product_search"}`
            },
            { role: 'user', content: message }
          ],
          response_format: { type: 'json_object' },
          temperature: 0,
          max_tokens: 200,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      const content = response.data.choices?.[0]?.message?.content;
      if (!content) return { rewrittenQuery: message, intent: 'general' };
      const result = JSON.parse(content);
      return {
        rewrittenQuery: result.rewrittenQuery || message,
        intent: result.intent || 'general',
      };
    } catch (error) {
      logger.error('Lỗi preprocessMessage:', error.message);
      return { rewrittenQuery: message, intent: 'general' };
    }
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

      // Bước 0.5: Nếu off_topic → trả về ngay, không tốn thêm 2 API call
      if (intent === 'off_topic') {
        const fallback = this.getFallbackResponse(message);
        await this._persistMessages(sessionId, userId, message, fallback.response, intent, Date.now() - startTime, true);
        return { ...fallback, intent: 'off_topic' };
      }

      // Bước 0.6: Kiểm tra query result cache (chỉ cho intent product_search/recommendation)
      if (CACHEABLE_INTENTS.includes(intent)) {
        try {
          const redis = await getRedisClient();
          const cacheKey = `chatbot:${(userId || 'anon')}:${searchMessage.toLowerCase().trim()}`;
          const cached = await redis.get(cacheKey);
          if (cached) {
            logger.debug('[Chatbot] Cache HIT — trả kết quả từ cache');
            const cachedResult = JSON.parse(cached);
            await this._persistMessages(sessionId, userId, message, cachedResult.response || '', intent, Date.now() - startTime, false);
            return cachedResult;
          }
        } catch {
          // Cache miss hoặc Redis lỗi → tiếp tục pipeline bình thường
        }
      }

      // Bước 1: Load lịch sử hội thoại theo sessionId
      const entry = sessionId ? this.conversationHistory.get(sessionId) : null;
      const history = entry ? entry.messages : [];

      // Bước 2: Tìm kiếm sản phẩm liên quan qua Vector Store (Retrieval)
      logger.debug(`Tìm kiếm Vector Store với: "${searchMessage}"`);
      let relevantProducts = [];
      try {
        const searchResults = await vectorStoreService.search(searchMessage, 10);
        relevantProducts = searchResults.map(res => ({ ...res.metadata, score: res.score }));
      } catch (vectorError) {
        logger.warn('Vector store fail, fallback getAllProducts:', vectorError.message);
        const allProducts = await this.getAllProducts();
        relevantProducts = allProducts.slice(0, 10);
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug(`📦 Tìm thấy ${relevantProducts.length} sản phẩm liên quan qua RAG`);
      }

      // Bước 3: Gọi LLM với RAG context + lịch sử hội thoại (Generation)
      const aiResponse = await this.getAIResponse(
        searchMessage,
        relevantProducts,
        { ...context, originalMessage: message },
        history
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
      await this._persistMessages(sessionId, userId, message, aiResponse.response || '', intent, responseTimeMs, false);

      // Cache kết quả cho intent product_search/recommendation
      if (CACHEABLE_INTENTS.includes(intent)) {
        try {
          const redis = await getRedisClient();
          const cacheKey = `chatbot:${(userId || 'anon')}:${searchMessage.toLowerCase().trim()}`;
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
  async _persistMessages(sessionId, userId, userMessage, assistantReply, intent, responseTimeMs, isFallback) {
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

  // Lấy phản hồi AI thông qua OpenRouter với RAG context + lịch sử hội thoại
  async getAIResponse(userMessage, products, context, history = []) {
    if (!this.apiKey || this.apiKey === 'demo-key') {
      return this.getFallbackResponse(userMessage);
    }

    try {
      await this._ensureCatalogCache();

      // Sanitize trước khi đưa vào prompt — ngăn user override system instruction qua newline injection
      const sanitizedMessage = userMessage
        .replace(/"/g, "'")         // Thay double quotes thành single
        .replace(/\n{2,}/g, '\n')   // Giới hạn consecutive newlines (max 1)
        .trim()
        .substring(0, 1000);        // Hard cap phòng user gửi quá dài

      // Prompt hướng dẫn + RAG context (được đưa vào user message cuối)
      const ragContextMessage = this.createPrompt(sanitizedMessage, products, context);

      const systemContent = `Bạn là nhân viên tư vấn của TechStore — cửa hàng công nghệ chuyên điện thoại, máy tính bảng và laptop.
QUY TẮC BẮT BUỘC:
1. CHỈ tư vấn sản phẩm có trong DANH SÁCH SẢN PHẨM được cung cấp trong tin nhắn.
2. TUYỆT ĐỐI không bịa tên sản phẩm, giá, hoặc thông số kỹ thuật ngoài danh sách.
3. Nếu sản phẩm không có trong danh sách, nói rõ: "Cửa hàng hiện chưa có [tên sản phẩm] ạ."
4. Trả lời bằng tiếng Việt, thân thiện (mình/em - bạn/anh/chị).
5. Trả về đúng định dạng JSON được yêu cầu trong tin nhắn.
6. Danh mục: ${(this._categoriesCache || []).join(', ')} — Thương hiệu: ${(this._brandsCache || []).join(', ')}`;

      // History nằm giữa system prompt và user message để LLM có ngữ cảnh các lượt chat trước
      const messages = [
        { role: 'system', content: systemContent },
        ...history,
        { role: 'user', content: ragContextMessage },
      ];

      if (process.env.NODE_ENV !== 'production') {
        logger.debug('🤖 Đang gửi yêu cầu đến OpenRouter API (RAG + history)...');
      }

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.3,
          max_tokens: 800,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.FRONTEND_URL,
            'X-Title': 'TechStore Chatbot',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // choices[] có thể rỗng khi OpenRouter content filter kích hoạt
      const aiText = response.data.choices?.[0]?.message?.content;
      if (!aiText) {
        logger.warn('OpenRouter trả về choices rỗng — dùng fallback response');
        return this.getFallbackResponse(userMessage);
      }

      if (process.env.NODE_ENV !== 'production') {
        logger.debug('Đã nhận phản hồi từ OpenRouter API');
      }

      // Phân tích phản hồi AI để trích xuất gợi ý sản phẩm
      return this.parseAIResponse(aiText, products, userMessage);
    } catch (error) {
      logger.error('Chi tiết lỗi OpenRouter API:', error.response?.data || error.message);
      return this.simpleKeywordMatch(userMessage, products);
    }
  }

  // Tạo prompt đầy đủ với product list và hướng dẫn JSON response
  createPrompt(userMessage, products, context) {
    const productList = products
      .map(
        (p) =>
          // p.price: từ vector store metadata; p.basePrice: từ getAllProducts() fallback — cần hỗ trợ cả 2
          `- ${p.name} (${p.category || p.categories?.[0]?.name || 'Sản phẩm'}): ${p.shortDescription || 'Mô tả đang cập nhật'} - Giá: ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ - Còn lại: ${p.stockQuantity !== undefined ? p.stockQuantity : (p.inStock ? 'Còn hàng' : 'Hết hàng')}`
      )
      .join('\n');

    return `
DANH SÁCH SẢN PHẨM HIỆN CÓ (Dữ liệu thực tế):
${productList}

THÔNG TIN CỬA HÀNG (TechStore):
- Bảo hành: 12 tháng chính hãng, hỗ trợ tại trung tâm
- Giao hàng: Miễn phí toàn quốc, giao nhanh nội thành
- Đổi trả: 30 ngày nếu lỗi nhà sản xuất
- Hỗ trợ kỹ thuật: Tư vấn cấu hình, so sánh, hỗ trợ sau mua hàng

TIN NHẮN KHÁCH HÀNG: "${userMessage}"

QUY TẮC SO KHỚP SẢN PHẨM (BẮT BUỘC):
1. Thương hiệu + Dòng sản phẩm + Hậu tố phiên bản là 3 yếu tố phân biệt.
   - Bản thường, Pro, Pro Max, Plus, Ultra, e, Lite → KHÁC NHAU HOÀN TOÀN.
   - Số thế hệ (13, 14, 15, 16, 17…) → KHÁC NHAU HOÀN TOÀN.
2. Máy tính bảng: WiFi, 4G, 5G cùng model → KHÁC NHAU.
3. Laptop: Cùng tên nhưng khác chip (i3/i5/i7, R5/R7, M3/M4/M5) → KHÁC NHAU.
4. NẾU KHÔNG CÓ trong danh sách: Nói rõ "chưa có" rồi gợi ý tương đương.
5. KHÔNG BỊA tên, giá, thông số ngoài danh sách.

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
      // response_format: json_object đảm bảo valid JSON — strip code fences phòng model wrap bằng markdown
      const clean = aiText.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
      const parsed = JSON.parse(clean);

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
            const rVersions = versionKeywords.filter(v => rName.includes(v));
            const pVersions = versionKeywords.filter(v => pName.includes(v));
            if (rVersions.length !== pVersions.length || !rVersions.every(v => pVersions.includes(v))) {
              return false;
            }

            // Kiểm tra số phiên bản chính — so sánh bằng word boundary, tránh "15" match "150"
            const numbersP = pName.match(/\b\d+\b/g);
            const numbersR = rName.match(/\b\d+\b/g);
            if (numbersP && numbersR && numbersP[0] !== numbersR[0]) return false;

            // So khớp theo từng từ để tránh "iPhone 15" match nhầm "iPhone 150"
            const pWords = new Set(pName.split(/\s+/));
            const rWords = new Set(rName.split(/\s+/));
            const intersection = [...pWords].filter(w => rWords.has(w) && w.length > 1);
            const minSize = Math.min(pWords.size, rWords.size);
            return minSize > 0 && intersection.length >= minSize * 0.8;
          });

          if (product) {
            // product.price: từ vector store metadata; product.basePrice: từ getAllProducts() fallback
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
              rating: null,  // Tính từ review table thực tế khi cần hiển thị
              discount: resolvedCompare && resolvedCompare > resolvedPrice
                ? Math.round((resolvedCompare - resolvedPrice) / resolvedCompare * 100)
                : 0,
            });
          } else {
            // Hallucination detection: LLM đề xuất sản phẩm không có trong retrieved context
            logger.warn(`[RAG] Hallucination detected: LLM đề xuất "${productName}" nhưng không có trong retrieved context`);
          }
        });
      }

      return {
        response: parsed.response || 'Tôi có thể giúp bạn tìm sản phẩm phù hợp!',
        products: matchedProducts,
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

    matchedProducts.sort((a, b) => b.matchScore - a.matchScore);

    const uniqueProducts = matchedProducts.filter(
      (product, index, self) => index === self.findIndex((p) => p.id === product.id)
    );

    if (uniqueProducts.length > 0) {
      const topProducts = uniqueProducts.slice(0, 5);
      const productList = topProducts
        .map((p) => `• ${p.name} - ${(p.price ?? p.basePrice)?.toLocaleString('vi-VN')} đ`)
        .join('\n');

      return {
        response: `🔍 Mình tìm thấy một số sản phẩm phù hợp với yêu cầu của bạn nè: \n\n${productList} \n\nBạn muốn xem kỹ hơn sản phẩm nào không?`,
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
            discount: c && c > p ? Math.round((c - p) / c * 100) : 0,
          };
        }),
        suggestions: ['Xem chi tiết', 'Sản phẩm khác', 'Tư vấn thêm'],
        intent: 'product_search',
      };
    }

    // Query "hàng mới" cần sort theo ngày tạo, không phải similarity score
    if (
      lowerMessage.includes('sản phẩm mới') ||
      lowerMessage.includes('hàng mới') ||
      lowerMessage.includes('mới nhất') ||
      lowerMessage.includes('new')
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
        response: `🌟 Đây là những sản phẩm mới nhất vừa cập bến cửa hàng mình nè: \n\n${productList} \n\nBạn ưng ý mẫu nào không?`,
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
            discount: c && c > p ? Math.round((c - p) / c * 100) : 0,
          };
        }),
        suggestions: ['Xem chi tiết', 'Sản phẩm khuyến mãi', 'Tư vấn thêm'],
        intent: 'product_search',
      };
    }

    return this.getFallbackResponse(userMessage);
  }

  // Lấy tất cả sản phẩm từ database (fallback khi vector store fail)
  async getAllProducts() {
    try {
      const products = await Product.findAll({
        where: { status: 'active' },
        include: [
          { model: Category, attributes: ['name'], as: 'categories' },
          { model: Category, attributes: ['name'], as: 'category' },
          { model: ProductImage, as: 'productImages', attributes: ['imageUrl', 'isThumbnail'], required: false },
          { model: ProductVariant, as: 'variants', attributes: ['stockQuantity'], required: false },
        ],
        attributes: [
          'id',
          'name',
          'shortDescription',
          'description',
          'basePrice',
          'compareAtPrice',
          'stockQuantity',
          'slug',
          'createdAt',
        ],
        limit: 200,
        order: [['createdAt', 'DESC']],
      });

      return products.map((p) => enrichProductData(p.toJSON()));
    } catch (error) {
      logger.error('Lỗi khi lấy danh sách sản phẩm:', error);
      return [];
    }
  }

  _evictStaleSessions() {
    const now = Date.now();
    for (const [key, val] of this.conversationHistory) {
      if (now - val.lastAccess > SESSION_TTL_MS) {
        this.conversationHistory.delete(key);
      }
    }
    if (this.conversationHistory.size > MAX_SESSIONS) {
      const sorted = [...this.conversationHistory.entries()]
        .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
      const toRemove = sorted.length - MAX_SESSIONS;
      for (let i = 0; i < toRemove; i++) {
        this.conversationHistory.delete(sorted[i][0]);
      }
    }
  }

  // Phản hồi dự phòng khi AI không khả dụng hoặc câu hỏi ngoài scope
  getFallbackResponse(userMessage) {
    return {
      response:
        'Chào bạn! Mình là nhân viên hỗ trợ của TechStore. Mình có thể giúp gì cho bạn hôm nay? Bạn đang tìm kiếm sản phẩm nào hay cần tư vấn gì không nè? 😊',
      suggestions: [
        'Xem sản phẩm mới',
        'Sản phẩm khuyến mãi',
        'Hỗ trợ mua hàng',
        'Tư vấn sản phẩm',
      ],
      intent: 'general',
    };
  }
}

module.exports = new GeminiChatbotService();
