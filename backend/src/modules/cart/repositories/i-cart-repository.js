/**
 * @file ICartRepository.js
 * @layer Repository
 * @module cart
 * @description Data access layer cho cart
 */
// ICartRepository — interface cart + cart-item data access. Service chỉ
// phụ thuộc interface này, KHÔNG require Cart/CartItem/Product/Variant model
// trực tiếp.
//
// Models cross-module — ngắn hạn (Phase 42.4 catalog sprint sẽ refactor lại
// để cart gọi catalog service thay vì repo đọc Product trực tiếp).

class ICartRepository {
  // -------- Cart aggregate root --------
  async findActiveCartByUserId(_userId) {
    throw new Error('not implemented');
  }
  async findActiveCartBySessionId(_sessionId) {
    throw new Error('not implemented');
  }
  async findOrCreateActiveCartByUserId(_userId, _options) {
    throw new Error('not implemented');
  }
  async findOrCreateActiveCartBySessionId(_sessionId, _options) {
    throw new Error('not implemented');
  }
  async saveCart(_cart, _options) {
    throw new Error('not implemented');
  }

  // -------- Cart item operations --------
  async findCartItemById(_id, _options) {
    throw new Error('not implemented');
  }
  async findCartItemsByCartId(_cartId, _options) {
    throw new Error('not implemented');
  }
  async findCartItemMatching(_query, _options) {
    throw new Error('not implemented');
  }
  async createCartItem(_payload, _options) {
    throw new Error('not implemented');
  }
  async saveCartItem(_item, _options) {
    throw new Error('not implemented');
  }
  async deleteCartItem(_item, _options) {
    throw new Error('not implemented');
  }
  async clearCartItems(_cartId, _options) {
    throw new Error('not implemented');
  }
  async sumCartItemQuantity(_cartId) {
    throw new Error('not implemented');
  }

  // -------- Catalog access (cross-module shortcut, sẽ refactor Sprint 4) --------
  async findProductById(_id) {
    throw new Error('not implemented');
  }
  async findVariantByIdAndProductId(_variantId, _productId) {
    throw new Error('not implemented');
  }
  async findCartItemsWithDetails(_cartId) {
    throw new Error('not implemented');
  }
  async findCartItemByIdWithCartAndStock(_id) {
    throw new Error('not implemented');
  }

  // -------- Transaction --------
  async runInTransaction(_work) {
    throw new Error('not implemented');
  }
}

module.exports = ICartRepository;
