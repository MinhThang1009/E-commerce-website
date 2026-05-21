/**
 * @file ISearchHistoryRepository.js
 * @layer Repository
 * @module search-history
 * @description Interface (port) cho search-history repository
 */
class ISearchHistoryRepository {
  async findDuplicate(_params) {
    throw new Error('not implemented');
  }
  async create(_params) {
    throw new Error('not implemented');
  }
  async findByUser(_params) {
    throw new Error('not implemented');
  }
  async findOneByUserAndId(_params) {
    throw new Error('not implemented');
  }
  async destroyByUser(_params) {
    throw new Error('not implemented');
  }
}

module.exports = ISearchHistoryRepository;
