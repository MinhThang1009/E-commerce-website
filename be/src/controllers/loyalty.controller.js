const { LoyaltyHistory, User } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Get user loyalty points and history
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

module.exports = {
  getLoyaltyInfo,
};
