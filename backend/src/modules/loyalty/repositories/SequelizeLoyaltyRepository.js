/**
 * @file SequelizeLoyaltyRepository.js
 * @layer Repository
 * @module loyalty
 * @description Data access layer cho loyalty
 */
const ILoyaltyRepository = require('./ILoyaltyRepository');

// Sequelize impl của ILoyaltyRepository — User points + LoyaltyHistory.
// Hỗ trợ SELECT FOR UPDATE để chống race condition khi nhiều request đồng thời
// đổi điểm (Rule 12 plan.md).
class SequelizeLoyaltyRepository extends ILoyaltyRepository {
  constructor({ User, LoyaltyHistory, sequelize }) {
    super();
    this.User = User;
    this.LoyaltyHistory = LoyaltyHistory;
    this.sequelize = sequelize;
  }

  async findUserPointsById(id, options = {}) {
    return this.User.findByPk(id, {
      attributes: ['id', 'loyaltyPoints'],
      ...options,
    });
  }

  async decrementPoints(user, amount, options = {}) {
    return user.decrement('loyaltyPoints', { by: amount, ...options });
  }

  async findHistory(userId, { limit, offset } = {}) {
    return this.LoyaltyHistory.findAndCountAll({
      where: { userId },
      limit, offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async createHistoryRecord(payload, options = {}) {
    return this.LoyaltyHistory.create(payload, options);
  }

  async runInTransactionWithLock(work) {
    return this.sequelize.transaction((t) => work(t));
  }
}

module.exports = SequelizeLoyaltyRepository;
