/**
 * @file IOrdersRepository.js
 * @layer Repository
 * @module orders
 * @description Data access layer cho orders
 */
// IOrdersRepository — interface data access cho Orders module DDD-lite.
// Cover Order CRUD + cart/product reads (cross-module shortcut, sẽ refactor
// khi inventory/cart module DDD-lite hoàn tất) + DiscountCode/LoyaltyHistory/
// InventoryLog write.

class IOrdersRepository {
  // -------- Order --------
  async findOrderByPkBasic(_id, _options) {
    throw new Error('not implemented');
  }
  async findOrderByIdAndUserId(_id, _userId, _options) {
    throw new Error('not implemented');
  }
  async findOrderByPkWithItemsAndUser(_id) {
    throw new Error('not implemented');
  }
  async findOrderByNumberAndUserId(_number, _userId) {
    throw new Error('not implemented');
  }
  async findOrderByNumberWithUserEmail(_number) {
    throw new Error('not implemented');
  }
  async findUserOrdersWithItems(_userId, _options) {
    throw new Error('not implemented');
  }
  async findAllOrdersWithUser(_options) {
    throw new Error('not implemented');
  }
  async findOrderForCancel(_id, _userId) {
    throw new Error('not implemented');
  }
  async createOrder(_payload, _options) {
    throw new Error('not implemented');
  }
  async createOrderItem(_payload, _options) {
    throw new Error('not implemented');
  }
  async saveOrder(_order, _options) {
    throw new Error('not implemented');
  }
  async cancelPendingOrdersByUser(_userId, _options) {
    throw new Error('not implemented');
  }

  // -------- Cart (cross-module reads) --------
  async findOrCreateActiveCart(_userId, _options) {
    throw new Error('not implemented');
  }
  async findActiveCartBySessionId(_sessionId, _options) {
    throw new Error('not implemented');
  }
  async findCartByPkWithItemsDetails(_cartId, _options) {
    throw new Error('not implemented');
  }
  async findCartItemMatching(_query, _options) {
    throw new Error('not implemented');
  }
  async saveCartItem(_item, _options) {
    throw new Error('not implemented');
  }
  async deleteCartItem(_item, _options) {
    throw new Error('not implemented');
  }
  async saveCart(_cart, _options) {
    throw new Error('not implemented');
  }
  async findActiveCartsByUser(_userId) {
    throw new Error('not implemented');
  }
  async clearCartItems(_cartId) {
    throw new Error('not implemented');
  }

  // -------- Product/Variant — stock check + lock --------
  async findProductWithDefaultVariant(_id, _options) {
    throw new Error('not implemented');
  }
  async findVariantBasic(_id, _options) {
    throw new Error('not implemented');
  }
  async lockProduct(_id, _transaction) {
    throw new Error('not implemented');
  }
  async lockVariant(_id, _transaction) {
    throw new Error('not implemented');
  }
  async decrementProductStock(_product, _by, _options) {
    throw new Error('not implemented');
  }
  async decrementVariantStock(_variant, _by, _options) {
    throw new Error('not implemented');
  }
  async restoreProductStock(_product, _by, _options) {
    throw new Error('not implemented');
  }
  async restoreVariantStock(_variant, _by, _options) {
    throw new Error('not implemented');
  }

  // -------- Warranty --------

  // -------- DiscountCode --------
  async findActiveDiscountCode(_code, _options) {
    throw new Error('not implemented');
  }
  async incrementDiscountCodeUsage(_code, _options) {
    throw new Error('not implemented');
  }

  // -------- User loyalty --------
  async findUserById(_id, _options) {
    throw new Error('not implemented');
  }
  async updateUserPoints(_user, _points, _options) {
    throw new Error('not implemented');
  }

  // -------- InventoryLog --------
  async createInventoryLogs(_rows, _options) {
    throw new Error('not implemented');
  }

  // -------- Transaction --------
  async runInTransaction(_work) {
    throw new Error('not implemented');
  }
}

module.exports = IOrdersRepository;
