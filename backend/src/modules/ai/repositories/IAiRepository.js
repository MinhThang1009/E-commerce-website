// IAiRepository — interface AI data access (Product searches qua catalog,
// minimal cho thesis scope). Phase 5 cleanup có thể tách analytics events
// table riêng cho AI tracking.
class IAiRepository {
  async searchProducts(_options) { throw new Error('not implemented'); }
  async findActiveDeals(_limit) { throw new Error('not implemented'); }
  async findFeaturedProducts(_limit) { throw new Error('not implemented'); }
}

module.exports = IAiRepository;
