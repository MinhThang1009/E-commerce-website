/**
 * @file IWishlistRepository.js
 * @layer Repository
 * @module wishlist
 * @description Data access layer cho wishlist
 */
// IWishlistRepository — interface wishlist data access. Service phụ thuộc
// interface này, không phụ thuộc Wishlist/Product model trực tiếp.

class IWishlistRepository {
  async findByUserIdWithProducts(_userId) { throw new Error('not implemented'); }
  async findItem(_userId, _productId) { throw new Error('not implemented'); }
  async createItem(_payload) { throw new Error('not implemented'); }
  async deleteItem(_item) { throw new Error('not implemented'); }
  async clearByUserId(_userId) { throw new Error('not implemented'); }
  async findProductById(_id) { throw new Error('not implemented'); }
}

module.exports = IWishlistRepository;
