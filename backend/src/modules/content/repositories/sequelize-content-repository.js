/**
 * @file SequelizeContentRepository.js
 * @layer Repository
 * @module content
 * @description Data access layer cho contact/feedback
 */
const IContentRepository = require('@modules/content/repositories/i-content-repository');

class SequelizeContentRepository extends IContentRepository {
  constructor({ Feedback }) {
    super();
    this.Feedback = Feedback;
  }

  async createFeedback(payload) {
    return this.Feedback.create(payload);
  }
}

module.exports = SequelizeContentRepository;
