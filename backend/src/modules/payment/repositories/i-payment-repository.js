/**
 * @file IPaymentRepository.js
 * @layer Repository
 * @module payment
 * @description Data access layer cho payment
 */
// IPaymentRepository — interface data access cho payment module.
// Cover Order updates (paymentStatus/paymentTransactionId/paymentProvider) +
// DiscountCode usedCount + Cart cleanup.

class IPaymentRepository {
  // Order
  async findOrderByPk(_id, _options) { throw new Error('not implemented'); }
  async findOrderByNumber(_number) { throw new Error('not implemented'); }
  async findOrderByPkWithItemsAndUser(_id) { throw new Error('not implemented'); }
  async lockOrder(_id, _transaction) { throw new Error('not implemented'); }
  async updateOrderPayment(_orderId, _patch, _options) { throw new Error('not implemented'); }
  async saveOrder(_order, _options) { throw new Error('not implemented'); }

  // User
  async findUserById(_id, _options) { throw new Error('not implemented'); }
  async saveUser(_user, _options) { throw new Error('not implemented'); }

  // DiscountCode usage tracking (after payment confirmed)
  async findOrderDiscountCode(_orderId, _options) { throw new Error('not implemented'); }
  async incrementDiscountCodeUsedCount(_codeId, _options) { throw new Error('not implemented'); }

  // Cart cleanup after successful payment
  async findActiveCartsByUser(_userId) { throw new Error('not implemented'); }
  async saveCart(_cart, _options) { throw new Error('not implemented'); }
  async clearCartItems(_cartId) { throw new Error('not implemented'); }

  // Transaction
  async runInTransaction(_work) { throw new Error('not implemented'); }
}

module.exports = IPaymentRepository;
