/**
 * @file aiService.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 * @depends-on sequelize-ai-repository, ragPipeline, vectorStoreService, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const { AppError } = require('@shared/errors');

// AI Service — orchestrate chatbot interactions qua RagPipeline + product
// search/deals/trending qua aiRepository.
//
// 4 endpoint chính (handleMessage, recommendations, analytics, addToCart).
// Logic phức tạp giữ ở services/ai/* qua adapter; service chỉ orchestrate.
class AIService {
  constructor({ aiRepository, ragPipeline, logger }) {
    this.repo = aiRepository;
    this.ragPipeline = ragPipeline;
    this.logger = logger;
  }

  async handleMessage({ message, userId, sessionId, context }) {
    return this.ragPipeline.run({ message, userId, sessionId, context });
  }

  async getRecommendations({ type = 'personal', limit = 5 }) {
    if (type === 'deals') return this.repo.findActiveDeals(parseInt(limit, 10));
    return this.repo.findFeaturedProducts(parseInt(limit, 10));
  }

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

  async addToCart({ productId, variantId, quantity, sessionId, userId }) {
    const product = await this.repo.findProductForCart(productId);
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);
    const totalStock = (product.variants || []).reduce((s, v) => s + (v.stockQuantity || 0), 0);
    if (product.status !== 'active' || (totalStock <= 0 && product.stockQuantity <= 0)) {
      throw new AppError('Sản phẩm đã hết hàng hoặc ngừng kinh doanh', 400);
    }
    const cartItem = await this.repo.addToCart({ userId, productId, variantId, quantity });
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
