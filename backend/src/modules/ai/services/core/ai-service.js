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
 * 2 chức năng chính:
 *   1. handleMessage — xử lý tin nhắn chatbot qua RAG pipeline (delegate chatbotService)
 *   2. addToCart     — thêm sản phẩm vào giỏ hàng qua chatbot (verify stock + ghi analytics)
 * + các session delegator (clearSession/getSessionMessages/registerSession) wired tại routes.js.
 *
 * Tại sao cần tầng service này nếu chỉ delegate cho chatbotService + repo?
 * Theo kiến trúc Layered: Controller không được gọi trực tiếp Repository hay ChatbotService.
 * Tầng Service là nơi tập trung business rules (ví dụ: kiểm tra tồn kho trước khi addToCart).
 *
 * @depends-on sequelize-ai-repository, chatbotService, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const { AppError } = require('@shared/errors');

/**
 * AIService — điều phối chức năng AI: chatbot RAG + add-to-cart (+ session delegators).
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
   * @param {Object} deps.chatbotService - ChatbotService xử lý toàn bộ RAG pipeline.
   * @param {Object} deps.logger - Logger để ghi log (Winston).
   */
  constructor({ aiRepository, chatbotService, logger }) {
    this.repo = aiRepository;
    this.chatbotService = chatbotService;
    this.logger = logger;
  }

  /**
   * Xử lý tin nhắn chatbot — delegate hoàn toàn cho ChatbotService.
   *
   * Tại sao chỉ có 1 dòng gọi chatbotService.handleMessage()?
   * Toàn bộ logic phức tạp (validate, normalize, search, generate) nằm trong ChatbotService.
   * AIService chỉ là trung gian giữa Controller (HTTP layer) và ChatbotService (AI layer).
   *
   * @param {Object} params - Tham số đầu vào.
   * @param {string} params.message - Tin nhắn từ user (ví dụ: "iPhone 16 giá bao nhiêu?").
   * @param {number|null} [params.userId] - ID user đã đăng nhập; null nếu khách vãng lai.
   * @param {string|null} [params.sessionId] - Session ID để nhớ lịch sử hội thoại.
   * @returns {Promise<Object>} Kết quả từ ChatbotService:
   *   `{ response: string, products: Array, suggestions: Array, intent: string }`
   */
  async handleMessage({ message, userId, sessionId }) {
    return this.chatbotService.handleMessage(message, userId, sessionId);
  }

  clearSession(sessionId) {
    return this.chatbotService.clearSession(sessionId);
  }

  async getSessionMessages(sessionId) {
    return this.chatbotService.getSessionMessages(sessionId);
  }

  registerSession(sessionId) {
    return this.chatbotService.registerSession(sessionId);
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
    const totalStock = (product.variants || []).reduce((s, v) => s + (v.stockQuantity || 0), 0);

    // Từ chối nếu sản phẩm không active HOẶC hết hàng hoàn toàn
    if (product.status !== 'active' || (totalStock <= 0 && product.stockQuantity <= 0)) {
      throw new AppError('Sản phẩm đã hết hàng hoặc ngừng kinh doanh', 400);
    }

    // Kiểm tra tồn kho của variant cụ thể nếu được chỉ định
    // totalStock > 0 không đảm bảo variant được chọn còn hàng (VD: Xanh hết, Đỏ còn)
    if (variantId) {
      const targetVariant = (product.variants || []).find(
        (v) => String(v.id) === String(variantId),
      );
      if (targetVariant && targetVariant.stockQuantity <= 0) {
        throw new AppError('Biến thể sản phẩm đã hết hàng', 400);
      }
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
