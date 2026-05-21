/**
 * @file IContentRepository.js
 * @layer Repository
 * @module content
 * @description Data access layer cho content
 */
// IContentRepository — interface gộp 3 sub-domain content (banner, news,
// feedback). 3 sub-domain này có CRUD đơn giản không liên kết business logic,
// gộp vào 1 module để tránh micro-module nhỏ-không-cần-thiết theo memory rule
// feedback_thesis_scope.

class IContentRepository {
  // Banner
  async findAllBanners(_where) {
    throw new Error('not implemented');
  }
  async findBannerById(_id) {
    throw new Error('not implemented');
  }
  async createBanner(_payload) {
    throw new Error('not implemented');
  }
  async saveBanner(_banner) {
    throw new Error('not implemented');
  }
  async deleteBanner(_banner) {
    throw new Error('not implemented');
  }

  // News
  async findAllNews(_options) {
    throw new Error('not implemented');
  }
  async findNewsBySlug(_slug, _options) {
    throw new Error('not implemented');
  }
  async findNewsById(_id, _options) {
    throw new Error('not implemented');
  }
  async findNewsByCategory(_category, _exclude, _attrs) {
    throw new Error('not implemented');
  }
  async findLatestNews(_excludeIds, _attrs) {
    throw new Error('not implemented');
  }
  async createNews(_payload) {
    throw new Error('not implemented');
  }
  async saveNews(_news) {
    throw new Error('not implemented');
  }
  async deleteNews(_news) {
    throw new Error('not implemented');
  }
  async incrementNewsView(_news) {
    throw new Error('not implemented');
  }

  // Feedback
  async createFeedback(_payload) {
    throw new Error('not implemented');
  }
}

module.exports = IContentRepository;
