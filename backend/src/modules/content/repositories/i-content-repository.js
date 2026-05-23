/**
 * @file IContentRepository.js
 * @layer Repository
 * @module content
 * @description Interface cho content repository
 */
class IContentRepository {
  async createFeedback(_payload) {
    throw new Error('not implemented');
  }
}

module.exports = IContentRepository;
