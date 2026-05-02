const { SearchHistory } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Lưu lịch sử tìm kiếm
const saveSearch = async (req, res, next) => {
  try {
    const { keyword, resultsCount, sessionId } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!keyword) {
      return res.status(200).json({ status: 'success' }); // Không báo lỗi để đảm bảo tính nhất quán UI
    }

    const searchHistory = await SearchHistory.create({
      userId,
      keyword,
      resultsCount,
      sessionId,
    });

    res.status(201).json({
      status: 'success',
      data: searchHistory,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy lịch sử tìm kiếm
const getSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const history = await SearchHistory.findAll({
      where: { userId },
      limit: parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// Xóa một mục lịch sử tìm kiếm
const deleteSearchHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const historyItem = await SearchHistory.findOne({
      where: { id, userId },
    });

    if (!historyItem) {
      throw new AppError('Không tìm thấy lịch sử tìm kiếm', 404);
    }

    await historyItem.destroy();

    res.status(200).json({
      status: 'success',
      message: 'Xóa lịch sử tìm kiếm thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Xóa toàn bộ lịch sử tìm kiếm của user
const clearAllSearchHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await SearchHistory.destroy({ where: { userId } });

    res.status(200).json({
      status: 'success',
      message: 'Xóa tất cả lịch sử tìm kiếm thành công',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  saveSearch,
  getSearchHistory,
  deleteSearchHistory,
  clearAllSearchHistory,
};
