/**
 * @file IImageRepository.js
 * @layer Repository
 * @module image
 * @description Interface (port) cho image repository
 */
class IImageRepository {
  async create(_data) { throw new Error('not implemented'); }
  async findById(_id) { throw new Error('not implemented'); }
  async findByProduct(_productId) { throw new Error('not implemented'); }
  async findAll(_where) { throw new Error('not implemented'); }
  async findByFilePath(_filePath) { throw new Error('not implemented'); }
}

module.exports = IImageRepository;
