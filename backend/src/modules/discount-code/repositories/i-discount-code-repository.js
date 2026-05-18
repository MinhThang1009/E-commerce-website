/**
 * @file IDiscountCodeRepository.js
 * @layer Repository
 * @module discount-code
 * @description Interface (port) cho discount-code repository
 */
class IDiscountCodeRepository {
  async findAll(_options) { throw new Error('not implemented'); }
  async findById(_id) { throw new Error('not implemented'); }
  async findOne(_where) { throw new Error('not implemented'); }
  async create(_data) { throw new Error('not implemented'); }
  async remove(_discountCode) { throw new Error('not implemented'); }
  async incrementUsedCount(_id) { throw new Error('not implemented'); }
}

module.exports = IDiscountCodeRepository;
