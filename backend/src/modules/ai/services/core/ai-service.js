/**
 * @file ai-service.js
 * @layer Service
 * @module ai
 *
 * AIService — tầng orchestration của AI module.
 *
 * "Orchestration" nghĩa là điều phối: service này KHÔNG chứa logic phức tạp,
 * chỉ nhận request từ controller rồi gọi đúng component xử lý.
 *
 * 4 chức năng chính:
 *   1. handleMessage    — xử lý tin nhắn chatbot qua RAG pipeline
 *   2. getRecommendations — lấy sản phẩm gợi ý (deals hoặc featured)
 *   3. trackAnalytics   — ghi lại sự kiện phân tích (user click, add to cart...)
 *   4. addToCart        — thêm sản phẩm vào giỏ hàng qua chatbot
 *
 * Tại sao cần tầng service này nếu chỉ delegate cho ragPipeline + repo?
 * Theo kiến trúc Layered: Controller không được gọi trực tiếp Repository hay RAGPipeline.
 * Tầng Service là nơi tập trung business rules (ví dụ: kiểm tra tồn kho trước khi addToCart).
 *
 * @depends-on sequelize-ai-repository, ragPipeline, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const { AppError } = require('@shared/errors');

/**
 * AIService — điều phối 4 chức năng AI: chatbot, recommendations, analytics, add-to-cart.
 *
 * Nhận dependency qua constructor (Dependency Injection) thay vì require trực tiếp,
 * giúp dễ dàng thay thế bằng mock khi viết unit test.
 */
class AIService {
  /**
   * Khởi tạo AIService với các dependency được inject từ module.js.
   *
   * @param {Object} deps - Các dependency cần thiết.
   * @param {Object} deps.aiRepository - Repository để query DB (sản phẩm, giỏ hàng, analytics).
   * @param {Object} deps.ragPipeline - RAG pipeline xử lý tin nhắn chatbot.
   * @param {Object} deps.logger - Logger để ghi log (Winston).
   */
  constructor({ aiRepository, ragPipeline, logger }) {
    this.repo = aiRepository;
    this.ragPipeline = ragPipeline;
    this.logger = logger;
  }

  /**
   * Xử lý tin nhắn chatbot — delegate hoàn toàn cho RAGPipeline.
   *
   * Tại sao chỉ có 1 dòng gọi ragPipeline.run()?
   * Toàn bộ logic phức tạp (validate, normalize, search, generate) nằm trong RAGPipeline.
   * AIService chỉ là trung gian giữa Controller (HTTP layer) và RAGPipeline (AI layer).
   *
   * @param {Object} params - Tham số đầu vào.
   * @param {string} params.message - Tin nhắn từ user (ví dụ: "iPhone 16 giá bao nhiêu?").
   * @param {number|null} [params.userId] - ID user đã đăng nhập; null nếu khách vãng lai.
   * @param {string|null} [params.sessionId] - Session ID để nhớ lịch sử hội thoại.
   * @returns {Promise<Object>} Kết quả từ RAGPipeline:
   *   `{ response: string, products: Array, suggestions: Array, intent: string }`
   */
  async handleMessage({ message, userId, sessionId }) {
    return this.ragPipeline.run({ message, userId, sessionId });
  }

  /**
   * Lấy danh sách sản phẩm gợi ý cho trang chủ chatbot.
   *
   * Có 2 loại gợi ý:
   *   - 'deals': sản phẩm đang có khuyến mãi (compareAtPrice > price)
   *   - các loại khác: sản phẩm nổi bật (isFeatured = true)
   *
   * Tại sao dùng parseInt(limit, 10)?
   * Tham số `limit` đến từ query string HTTP ("?limit=5") nên là string.
   * parseInt đảm bảo truyền vào DB là số nguyên thay vì string.
   * Tham số thứ hai (10) là radix — chỉ định hệ thập phân, tránh parse nhầm octal.
   *
   * @param {Object} params - Tham số đầu vào.
   * @param {string} [params.type='personal'] - Loại gợi ý: 'deals' hoặc các giá trị khác.
   * @param {string|number} [params.limit=5] - Số lượng sản phẩm trả về (tối đa).
   * @returns {Promise<Array>} Danh sách sản phẩm gợi ý.
   */
  async getRecommendations({ type = 'personal', limit = 5 }) {
    if (type === 'deals') return this.repo.findActiveDeals(parseInt(limit, 10));
    return this.repo.findFeaturedProducts(parseInt(limit, 10));
  }

  /**
   * Ghi lại sự kiện phân tích hành vi người dùng vào DB.
   *
   * Analytics event được dùng cho admin dashboard — xem user thường hỏi gì,
   * click vào sản phẩm nào, thêm sản phẩm nào vào giỏ qua chatbot, v.v.
   *
   * @param {Object} params - Thông tin sự kiện.
   * @param {string} params.event - Tên sự kiện (ví dụ: 'product_viewed', 'product_added_to_cart').
   * @param {number|null} params.userId - ID user thực hiện sự kiện (null nếu anonymous).
   * @param {string|null} params.sessionId - Session ID của phiên chatbot.
   * @param {number|null} params.productId - ID sản phẩm liên quan (nếu có).
   * @param {number|null} params.value - Giá trị số kèm theo (ví dụ: số lượng, giá).
   * @param {Object|null} params.metadata - Dữ liệu bổ sung dạng JSON (tuỳ sự kiện).
   * @param {Date|string} params.timestamp - Thời điểm xảy ra sự kiện.
   * @returns {Promise<Object>} Bản ghi analytics đã được tạo trong DB.
   */
  async trackAnalytics({ event, userId, sessionId, productId, value, metadata, timestamp }) {
    return this.repo.createAnalyticsEvent({
      event,
      userId,
      sessionId,
      productId,
      value,
      metadata,
      timestamp,
    });
  }

  /**
   * Thêm sản phẩm vào giỏ hàng thông qua chatbot.
   *
   * Tại sao kiểm tra tồn kho ở đây thay vì trong repository?
   * Business rule "không được thêm sản phẩm hết hàng vào giỏ" thuộc về Service layer.
   * Repository chỉ lo việc đọc/ghi DB, không biết về business rules.
   *
   * Cách tính tổng tồn kho:
   * Mỗi sản phẩm có nhiều biến thể (variant: màu sắc, dung lượng...).
   * Tổng tồn kho = tổng stockQuantity của tất cả biến thể.
   * Nếu product.variants rỗng → dùng product.stockQuantity (sản phẩm không có biến thể).
   *
   * @param {Object} params - Thông tin thêm giỏ hàng.
   * @param {number} params.productId - ID sản phẩm cần thêm.
   * @param {number|null} params.variantId - ID biến thể (màu/dung lượng); null nếu không có biến thể.
   * @param {number} params.quantity - Số lượng cần thêm.
   * @param {string|null} params.sessionId - Session ID (dùng để ghi analytics).
   * @param {number} params.userId - ID user đang đăng nhập (bắt buộc — endpoint yêu cầu auth).
   * @returns {Promise<Object>} CartItem vừa được tạo trong DB.
   * @throws {AppError} 404 nếu sản phẩm không tồn tại.
   * @throws {AppError} 400 nếu sản phẩm hết hàng hoặc đã ngừng kinh doanh.
   */
  async addToCart({ productId, variantId, quantity, sessionId, userId }) {
    // Kiểm tra sản phẩm tồn tại và lấy thông tin tồn kho
    const product = await this.repo.findProductForCart(productId);
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);

    // Tính tổng tồn kho từ tất cả biến thể
    // Array.reduce(callback, initialValue): duyệt mảng và tích lũy kết quả
    // Ở đây: cộng dồn stockQuantity của từng variant, bắt đầu từ 0
    const totalStock = (product.variants || []).reduce((s, v) => s + (v.stockQuantity || 0), 0);

    // Từ chối nếu sản phẩm không active HOẶC hết hàng hoàn toàn
    if (product.status !== 'active' || (totalStock <= 0 && product.stockQuantity <= 0)) {
      throw new AppError('Sản phẩm đã hết hàng hoặc ngừng kinh doanh', 400);
    }

    // Thêm vào giỏ hàng
    const cartItem = await this.repo.addToCart({ userId, productId, variantId, quantity });

    // Ghi analytics event — dùng cho báo cáo "sản phẩm được thêm giỏ qua chatbot"
    await this.repo.createAnalyticsEvent({
      event: 'product_added_to_cart',
      userId,
      sessionId,
      productId,
      metadata: { quantity, source: 'chatbot' },
      timestamp: new Date(),
    });

    return cartItem;
  }
}

module.exports = AIService;
