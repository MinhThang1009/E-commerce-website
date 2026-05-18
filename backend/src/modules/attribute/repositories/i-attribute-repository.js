/**
 * @file IAttributeRepository.js
 * @layer Repository
 * @module attribute
 * @description Interface (port) cho attribute repository
 */
class IAttributeRepository {
  async findAllGroups() { throw new Error('not implemented'); }
  async findProductWithGroups(_productId) { throw new Error('not implemented'); }
  async createGroup(_data) { throw new Error('not implemented'); }
  async findGroupById(_id) { throw new Error('not implemented'); }
  async createValue(_data) { throw new Error('not implemented'); }
  async findValueById(_id) { throw new Error('not implemented'); }
  async createProductGroupAssignment(_data) { throw new Error('not implemented'); }
  async findRecentVariants(_productId) { throw new Error('not implemented'); }
}

module.exports = IAttributeRepository;
