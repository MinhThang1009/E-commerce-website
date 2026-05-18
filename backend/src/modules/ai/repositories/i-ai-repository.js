/**
 * @file IAiRepository.js
 * @layer Repository
 * @module ai
 * @description Data access layer cho ai
 */
// IAIRepository — interface AI data access (Product searches qua catalog,
// minimal cho thesis scope). Phase 5 cleanup có thể tách analytics events
// table riêng cho AI tracking.
class IAIRepository {
  async searchProducts(_options) { throw new Error('not implemented'); }
  async findActiveDeals(_limit) { throw new Error('not implemented'); }
  async findFeaturedProducts(_limit) { throw new Error('not implemented'); }
}

module.exports = IAIRepository;
