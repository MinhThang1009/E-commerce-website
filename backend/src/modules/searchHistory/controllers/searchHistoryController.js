/**
 * @file searchHistoryController.js
 * @layer Controller
 * @module searchHistory
 * @description Xử lý HTTP request/response cho searchHistory
 */
const { SearchHistory } = require('../../../models');
const { Op } = require('sequelize');
const { AppError } = require('../../../shared/errors');

// Lưu lịch sử tìm kiếm — bỏ qua nếu cùng keyword đã được lưu trong 1 giờ qua (tránh duplicate)
const saveSearch = async (req, res, next) => {
  try {
    const { keyword, resultsCount, sessionId } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!keyword) {
      return res.status(200).json({ status: 'success' }); // Không báo lỗi để đảm bảo tính nhất quán UI
    }

    // Kiểm tra duplicate: không lưu cùng keyword 2 lần trong 1 giờ cho cùng user/session
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const duplicateWhere = {
      keyword,
      createdAt: { [Op.gte]: oneHourAgo },
    };
    if (userId) {
      duplicateWhere.userId = userId;
    } else if (sessionId) {
      duplicateWhere.sessionId = sessionId;
    }

    const existing = await SearchHistory.findOne({ where: duplicateWhere });
    if (existing) {
      // Đã tồn tại trong 1 giờ qua — không lưu lại, trả 200 idempotent
      return res.status(200).json({ status: 'success', data: existing });
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

// Lấy lịch sử tìm kiếm của user hiện tại
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

// Xóa một mục lịch sử tìm kiếm theo id
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
