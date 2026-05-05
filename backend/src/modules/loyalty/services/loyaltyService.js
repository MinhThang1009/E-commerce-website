const { AppError } = require('../../../shared/errors');

// Loyalty Service — điểm tích lũy. SELECT FOR UPDATE chống race condition khi
// đổi điểm đồng thời (Rule 12 plan.md).
class LoyaltyService {
  constructor({ loyaltyRepository, eventBus, logger }) {
    this.loyaltyRepository = loyaltyRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async getLoyaltyInfo({ userId, page = 1, limit = 10 }) {
    const user = await this.loyaltyRepository.findUserPointsById(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;
    const { count, rows } = await this.loyaltyRepository.findHistory(userId, {
      limit: lim, offset: off,
    });

    return {
      points: user.loyaltyPoints,
      history: {
        total: count,
        pages: Math.ceil(count / lim),
        currentPage: parseInt(page, 10),
        items: rows,
      },
    };
  }

  // Đổi điểm — wrap trong transaction + lock row user để chống race.
  async redeemPoints({ userId, points }) {
    return this.loyaltyRepository.runInTransactionWithLock(async (t) => {
      const user = await this.loyaltyRepository.findUserPointsById(userId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });

      if (!user) {
        throw new AppError('Không tìm thấy người dùng', 404);
      }

      if (user.loyaltyPoints < points) {
        throw new AppError(
          `Số điểm không đủ. Hiện có: ${user.loyaltyPoints}, yêu cầu đổi: ${points}`,
          400
        );
      }

      await this.loyaltyRepository.decrementPoints(user, points, { transaction: t });
      await this.loyaltyRepository.createHistoryRecord({
        userId,
        points: -points,
        type: 'spend',
        description: `Đổi ${points} điểm lấy giảm giá`,
      }, { transaction: t });

      await user.reload({ transaction: t });

      return {
        message: `Đổi ${points} điểm thành công`,
        data: {
          pointsRedeemed: points,
          remainingPoints: user.loyaltyPoints,
        },
      };
    });
  }
}

module.exports = LoyaltyService;
