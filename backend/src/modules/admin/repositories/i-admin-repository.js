/**
 * @file IAdminRepository.js
 * @layer Repository
 * @module admin
 * @description Interface (port) cho admin repository — quản lý users, products, orders, analytics
 */
class IAdminRepository {
  // Users
  async countUsers(_where) {
    throw new Error('not implemented');
  }
  async findUsers(_options) {
    throw new Error('not implemented');
  }
  async findUserById(_id, _options) {
    throw new Error('not implemented');
  }
  async updateUser(_user, _data) {
    throw new Error('not implemented');
  }
  async deleteUser(_user) {
    throw new Error('not implemented');
  }

  // Products
  async countProducts(_where) {
    throw new Error('not implemented');
  }
  async findProducts(_options) {
    throw new Error('not implemented');
  }
  async findProductById(_id, _options) {
    throw new Error('not implemented');
  }
  async createProduct(_data) {
    throw new Error('not implemented');
  }
  async updateProductById(_id, _data, _options) {
    throw new Error('not implemented');
  }
  async deleteProduct(_product) {
    throw new Error('not implemented');
  }

  // Orders
  async countOrders(_where) {
    throw new Error('not implemented');
  }
  async findOrders(_options) {
    throw new Error('not implemented');
  }
  async findOrderById(_id, _options) {
    throw new Error('not implemented');
  }
  async updateOrder(_order, _data) {
    throw new Error('not implemented');
  }

  // Reviews
  async findReviews(_options) {
    throw new Error('not implemented');
  }
  async deleteReview(_review) {
    throw new Error('not implemented');
  }

  // Analytics
  async aggregateOrderItems(_options) {
    throw new Error('not implemented');
  }
  async getAuditLogs(_options) {
    throw new Error('not implemented');
  }
}

module.exports = IAdminRepository;
