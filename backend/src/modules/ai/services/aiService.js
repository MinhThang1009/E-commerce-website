const { AppError } = require('../../../shared/errors');

// AI Service — orchestrate chatbot interactions qua RagPipeline + product
// search/deals/trending qua aiRepository.
//
// Sprint 11 thin scope: 5 endpoint chính (handleMessage, productSearch,
// recommendations, analytics, addToCart). Logic phức tạp giữ ở legacy
// services/ai/* qua adapter; service chỉ orchestrate.
class AiService {
  constructor({ aiRepository, ragPipeline, ruleBasedChatbot, logger }) {
    this.repo = aiRepository;
    this.ragPipeline = ragPipeline;
    this.ruleBasedChatbot = ruleBasedChatbot;
    this.logger = logger;
  }

  async handleMessage({ message, userId, sessionId, context }) {
    return this.ragPipeline.run({ message, userId, sessionId, context });
  }

  // AI product search — dùng rule-based extract params + repo search.
  async productSearch({ query, limit = 20 }) {
    if (!query || !query.trim()) {
      throw new AppError('Query không được để trống', 400);
    }
    const params = this.ruleBasedChatbot.extractSearchParams(query);
    const products = await this.repo.searchProducts({
      keyword: params.keyword,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      categoryName: params.category,
      limit,
    });
    return products;
  }

  async getRecommendations({ type = 'personal', limit = 5 }) {
    if (type === 'deals') return this.repo.findActiveDeals(parseInt(limit, 10));
    return this.repo.findFeaturedProducts(parseInt(limit, 10));
  }
}

module.exports = AiService;
