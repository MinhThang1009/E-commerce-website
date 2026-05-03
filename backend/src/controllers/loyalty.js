const { LoyaltyHistory, User, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Lấy điểm tích lũy và lịch sử tích điểm của người dùng
const getLoyaltyInfo = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const user = await User.findByPk(userId, {
      attributes: ['id', 'loyaltyPoints'],
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    const { count, rows: history } = await LoyaltyHistory.findAndCountAll({
      where: { userId },
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: {
        points: user.loyaltyPoints,
        history: {
          total: count,
          pages: Math.ceil(count / limit),
          currentPage: parseInt(page),
          items: history,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/loyalty/redeem — Đổi điểm tích lũy lấy giảm giá
// points đã được validate (số nguyên dương) bởi redeemPointsSchema trước khi vào đây
const redeemPoints = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { points } = req.body;

    // SELECT FOR UPDATE để tránh race condition khi nhiều request đổi điểm đồng thời
    await sequelize.transaction(async (t) => {
      const user = await User.findByPk(userId, {
        attributes: ['id', 'loyaltyPoints'],
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

      // Trừ điểm từ tài khoản
      await user.decrement('loyaltyPoints', { by: points, transaction: t });

      // Ghi lịch sử giao dịch
      await LoyaltyHistory.create(
        {
          userId,
          points: -points,
          type: 'spend',
          description: `Đổi ${points} điểm lấy giảm giá`,
        },
        { transaction: t }
      );

      // Đọc lại số điểm sau khi decrement
      await user.reload({ transaction: t });

      res.status(200).json({
        status: 'success',
        message: `Đổi ${points} điểm thành công`,
        data: {
          pointsRedeemed: points,
          remainingPoints: user.loyaltyPoints,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLoyaltyInfo,
  redeemPoints,
};
