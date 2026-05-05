// ILoyaltyRepository — interface loyalty points data access.
class ILoyaltyRepository {
  async findUserPointsById(_id, _options) { throw new Error('not implemented'); }
  async decrementPoints(_user, _amount, _options) { throw new Error('not implemented'); }
  async findHistory(_userId, _options) { throw new Error('not implemented'); }
  async createHistoryRecord(_payload, _options) { throw new Error('not implemented'); }
  async runInTransactionWithLock(_work) { throw new Error('not implemented'); }
}

module.exports = ILoyaltyRepository;
