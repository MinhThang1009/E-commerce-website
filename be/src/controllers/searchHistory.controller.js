const { SearchHistory } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Save search history
const saveSearch = async (req, res, next) => {
  try {
    const { keyword, resultsCount, sessionId } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!keyword) {
      return res.status(200).json({ status: 'success' }); // Silent fail for UI consistency
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

// Get search history
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

// Delete search history item
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

// Clear all search history for user
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
