/**
 * @file IWarrantyPackageRepository.js
 * @layer Repository
 * @module warranty-package
 * @description Interface (port) cho warranty-package repository
 */
class IWarrantyPackageRepository {
  async findAll(_options) { throw new Error('not implemented'); }
  async findById(_id) { throw new Error('not implemented'); }
  async findByProduct(_productId) { throw new Error('not implemented'); }
  async productExists(_productId) { throw new Error('not implemented'); }
  async isUsedByProduct(_warrantyPackageId) { throw new Error('not implemented'); }
  async create(_data) { throw new Error('not implemented'); }
}

module.exports = IWarrantyPackageRepository;
