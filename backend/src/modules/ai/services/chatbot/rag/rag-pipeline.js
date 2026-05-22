/**
 * @file rag-pipeline.js
 * @layer Service
 * @module ai
 *
 * RAG Pipeline — bộ điều phối toàn bộ quá trình tư vấn sản phẩm của chatbot.
 *
 * RAG là viết tắt của Retrieval-Augmented Generation:
 *   - Retrieval (Truy xuất): tìm kiếm sản phẩm liên quan từ vector store
 *   - Augmented (Tăng cường): bổ sung thông tin sản phẩm vào câu hỏi của user
 *   - Generation (Sinh văn bản): gọi LLM để tạo câu trả lời dựa trên thông tin truy xuất được
 *
 * Không có RAG, LLM chỉ trả lời dựa trên kiến thức huấn luyện (có thể sai/cũ).
 * Với RAG, LLM trả lời dựa trên sản phẩm thực tế trong DB → chính xác hơn nhiều.
 *
 * Luồng xử lý (5 bước):
 *   1. Validate    — kiểm tra tin nhắn hợp lệ (không rỗng, không quá 2000 ký tự)
 *   2. Normalize   — mở rộng viết tắt: "ip" → "iPhone", "ss" → "Samsung"
 *   3. Off-topic   — nếu hỏi về thời tiết/bóng đá/... → trả lời cố định, bỏ qua bước 4-5
 *   4. Retrieve    — tìm sản phẩm liên quan bằng hybrid search (song song với LLM rewrite)
 *   5. Generate    — giao cho chatbotService xây prompt + gọi LLM + trả về kết quả
 */
const {
  validateMessage,
  expandAbbreviations,
  isOffTopic,
  classifyIntent,
  isPromptInjection,
} = require('@modules/ai/services/core/ai-policy');
const { AppError } = require('@shared/errors');
const logger = require('@utils/logger');

/**
 * RAGPipeline — bộ điều phối luồng Retrieve-Augment-Generate cho AI chatbot.
 *
 * Nhận tin nhắn từ user → truy xuất sản phẩm liên quan → giao cho chatbotService
 * để gọi LLM và sinh câu trả lời cuối cùng.
 *
 * Được khởi tạo qua DI trong module.js — không tự require chatbotService hay vectorStore.
 */
class RAGPipeline {
  /**
   * Khởi tạo RAGPipeline với các dependency được inject từ bên ngoài.
   *
   * Tại sao inject thay vì require trực tiếp?
   * Để dễ test: trong unit test có thể truyền mock thay vì chatbotService thật.
   *
   * @param {Object} deps - Các dependency cần thiết.
   * @param {Object} deps.chatbotService - Service gọi LLM và quản lý session (bắt buộc).
   * @param {Object|null} [deps.vectorStore=null] - Vector store để tìm kiếm ngữ nghĩa;
   *   nếu null thì bỏ qua bước Retrieval, chatbot vẫn hoạt động nhưng không có sản phẩm liên quan.
   */
  constructor({ chatbotService, vectorStore = null }) {
    if (!chatbotService) throw new Error('RAGPipeline: chatbotService bắt buộc');
    this.chatbotService = chatbotService;
    this.vectorStore = vectorStore;
  }

  /**
   * Chạy toàn bộ RAG pipeline từ đầu đến cuối cho một tin nhắn của user.
   *
   * Đây là entry point duy nhất của RAGPipeline — AIService gọi vào đây.
   *
   * **Tại sao có bước off-topic check trước retrieval?**
   * Nếu user hỏi "hôm nay trời có mưa không?" thì không cần tìm kiếm sản phẩm hay gọi LLM.
   * Trả lời cố định ngay → tiết kiệm ~2-4 giây + không tốn API quota.
   *
   * **Tại sao chạy LLM rewrite và hybrid search song song?**
   * LLM rewrite mất 1-3 giây (gọi API bên ngoài).
   * Hybrid search mất 0.5-1 giây (query vector DB).
   * Chạy tuần tự: 1-3s + 0.5-1s = 1.5-4 giây.
   * Chạy song song: max(1-3s, 0.5-1s) = 1-3 giây → tiết kiệm 0.5-1 giây mỗi request.
   *
   * @param {Object} params - Tham số đầu vào.
   * @param {string} params.message - Tin nhắn gốc từ user, ví dụ: "ip16 giá bao nhiêu?".
   * @param {number|null} [params.userId] - ID user đã đăng nhập; null nếu khách vãng lai.
   * @param {string|null} [params.sessionId] - Session ID để nhớ lịch sử hội thoại;
   *   null nếu không cần lưu lịch sử.
   * @param {Object} [params.context={}] - Thông tin bổ sung truyền xuống chatbotService
   *   (ví dụ: locale, thông tin từ middleware).
   * @returns {Promise<Object>} Kết quả gồm:
   *   - `response` {string}: câu trả lời bằng ngôn ngữ của user
   *   - `products` {Array}: danh sách sản phẩm liên quan (có thể rỗng)
   *   - `suggestions` {Array}: gợi ý câu hỏi tiếp theo
   *   - `intent` {string}: phân loại ý định (product_search, pricing, off_topic...)
   * @throws {AppError} HTTP 400 nếu tin nhắn rỗng hoặc vượt quá 2000 ký tự.
   */
  async run({ message, userId, sessionId, context = {} }) {
    // ── Bước 1: Kiểm tra tin nhắn hợp lệ ────────────────────────────────────────
    // validateMessage trả về { valid: true } hoặc { valid: false, reason: "..." }
    // Nếu không hợp lệ → ném lỗi 400 ngay, không xử lý tiếp
    const validation = validateMessage(message);
    if (!validation.valid) throw new AppError(validation.reason, 400);

    // ── Bước 2: Chuẩn hóa query ──────────────────────────────────────────────────
    // Mở rộng viết tắt thông dụng để tăng độ chính xác khi tìm kiếm
    // Ví dụ: "ip16 pro max bnh" → "iPhone 16 Pro Max bao nhiêu"
    const normalizedQuery = expandAbbreviations(message);

    // ── Bước 3: Kiểm tra off-topic + prompt injection → trả lời cố định, bỏ qua retrieval ──
    // Cả hai trường hợp đều không cần search sản phẩm → skip retrieval để tiết kiệm ~3s latency
    if (isOffTopic(normalizedQuery) || isPromptInjection(message)) {
      return this.chatbotService.handleMessage(message, userId, sessionId, {
        ...context,
        normalizedQuery,
        preClassifiedIntent: 'off_topic',
      });
    }

    // ── Bước 4: Retrieval — tìm sản phẩm liên quan ───────────────────────────────
    // retrievedProducts = null nghĩa là chưa có kết quả (khác với [] = tìm rồi nhưng không thấy)
    let retrievedProducts = null;
    let rewrittenQuery = null; // Query đã được LLM cải thiện (nếu có)

    if (this.vectorStore) {
      try {
        // ── Bước 4a: Chạy song song LLM rewrite + hybrid search ─────────────────
        // Cú pháp Promise.all([promiseA, promiseB]) nghĩa là:
        // Chạy cả hai cùng lúc, đợi khi cả hai xong mới tiếp tục.
        // Kết quả trả về là mảng [kết quả của promiseA, kết quả của promiseB].
        //
        // .catch(() => null) ở rewriteQuery: nếu LLM rewrite lỗi → trả null thay vì crash.
        // Không dùng try/catch ở đây vì sẽ phá vỡ Promise.all — Promise.all chỉ reject
        // khi có ít nhất một promise reject; .catch() đổi reject thành resolve(null).
        const [llmRewrite, initialResults] = await Promise.all([
          this.chatbotService.rewriteQuery(normalizedQuery).catch(() => null),
          this.vectorStore.hybridSearch(normalizedQuery, 10),
        ]);

        // ── Bước 4b: Nếu LLM cải thiện được query → tìm kiếm lại với query mới ──
        // LLM rewrite giúp chuẩn hóa thêm (sửa lỗi chính tả, thêm từ đầy đủ)
        // Ví dụ: "ip17 pro bao nh" → "iPhone 17 Pro bao nhiêu tiền"
        if (llmRewrite && llmRewrite.toLowerCase() !== normalizedQuery.toLowerCase()) {
          rewrittenQuery = llmRewrite;
          logger.debug(`[RAGPipeline] LLM rewrite: "${normalizedQuery}" → "${llmRewrite}"`);
          try {
            const refinedResults = await this.vectorStore.hybridSearch(llmRewrite, 10);
            // Ưu tiên kết quả từ query đã rewrite; nếu rỗng thì dùng kết quả ban đầu
            const results = refinedResults.length > 0 ? refinedResults : initialResults;
            // r.metadata chứa thông tin sản phẩm; r.score là điểm tương đồng ngữ nghĩa
            retrievedProducts = results.map((r) => ({
              ...r.metadata,
              score: r.score,
              // Giữ lại cờ lowConfidence từ hybrid search (keyword-only results)
              ...(r.lowConfidence && { lowConfidence: true }),
            }));
          } catch {
            // Nếu tìm kiếm với query rewritten lỗi → fallback về kết quả ban đầu
            retrievedProducts = initialResults.map((r) => ({ ...r.metadata, score: r.score }));
          }
        } else {
          // LLM không cải thiện được query → dùng kết quả tìm kiếm ban đầu
          retrievedProducts = initialResults.map((r) => ({ ...r.metadata, score: r.score }));
        }

        // ── Bước 4c: Fallback khi tất cả sản phẩm đều dưới ngưỡng score ─────────
        // hybridSearch mặc định chỉ trả về sản phẩm có độ tương đồng đủ cao (minScore).
        // Nếu không có sản phẩm nào vượt ngưỡng → hạ ngưỡng về 0, lấy top-3 gần nhất.
        // Tại sao chỉ lấy 3 và đánh dấu lowConfidence?
        // Kết quả kém chính xác → chỉ gợi ý, không khẳng định; LLM sẽ dùng flag này
        // để cảnh báo user rằng sản phẩm có thể không đúng nhu cầu.
        if (retrievedProducts.length === 0) {
          logger.warn('[RAGPipeline] Không có kết quả trên threshold — hạ minScore lấy top-3');
          try {
            const fallbackQuery = rewrittenQuery || normalizedQuery;
            // Tham số thứ 3 = 0: minScore = 0, lấy mọi kết quả dù điểm thấp
            const lowResults = await this.vectorStore.hybridSearch(fallbackQuery, 3, 0);
            retrievedProducts = lowResults.map((r) => ({
              ...r.metadata,
              score: r.score,
              lowConfidence: true, // Cờ báo cho prompt-builder biết kết quả này ít tin cậy
            }));
          } catch {
            retrievedProducts = []; // Nếu vẫn lỗi → không có sản phẩm nào
          }
        }

        logger.debug(`[RAGPipeline] Retrieved ${retrievedProducts.length} products`);
      } catch (err) {
        // Vector store lỗi (DB không khởi động được, network lỗi...) → tiếp tục không có sản phẩm
        // Chatbot vẫn trả lời được (dù chất lượng kém hơn) thay vì crash toàn bộ request
        logger.warn(
          '[RAGPipeline] Vector search thất bại, tiếp tục không có retrieval:',
          err.message,
        );
      }
    }

    // ── Bước 5: Augment + Generate — giao cho chatbotService ─────────────────────
    // Truyền retrievedProducts và normalizedQuery vào context để chatbotService
    // không phải tìm kiếm lại (đã làm ở bước 4).
    //
    // Cú pháp ...(condition && { key: value }) nghĩa là:
    //   Nếu condition = true (giá trị truthy) → thêm { key: value } vào object
    //   Nếu condition = false/null/undefined  → không thêm gì (spread của false = không có gì)
    // Ví dụ: ...(retrievedProducts !== null && { retrievedProducts })
    //   → chỉ truyền retrievedProducts khi bước retrieval đã chạy (kể cả khi kết quả rỗng)
    //   → không truyền khi vectorStore = null (test environment) để chatbotService tự xử lý
    return this.chatbotService.handleMessage(message, userId, sessionId, {
      ...context,
      normalizedQuery,
      preClassifiedIntent: classifyIntent(normalizedQuery),
      ...(retrievedProducts !== null && { retrievedProducts }),
      ...(rewrittenQuery && { llmRewrittenQuery: rewrittenQuery }),
    });
  }
}

module.exports = RAGPipeline;
