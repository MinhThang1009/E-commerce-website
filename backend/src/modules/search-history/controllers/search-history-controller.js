/**
 * @file searchHistoryController.js
 * @layer Controller
 * @module searchHistory
 * @description Xử lý HTTP request/response cho searchHistory
 */
const service = require('@modules/search-history/services/search-history-service');

const saveSearch = async (req, res, next) => {
  try {
    const { keyword, resultsCount, sessionId } = req.body;
    const userId = req.user ? req.user.id : null;

    if (!keyword) return res.status(200).json({ status: 'success' });

    const result = await service.saveSearch({ keyword, resultsCount, sessionId, userId });
    const status = result.created ? 201 : 200;
    res.status(status).json({ status: 'success', data: result.data });
  } catch (error) {
    next(error);
  }
};

const getSearchHistory = async (req, res, next) => {
  try {
    const history = await service.getHistory({ userId: req.user.id, limit: req.query.limit });
    res.status(200).json({ status: 'success', data: history });
  } catch (error) {
    next(error);
  }
};

const deleteSearchHistory = async (req, res, next) => {
  try {
    await service.deleteOne({ id: req.params.id, userId: req.user.id });
    res.status(200).json({ status: 'success', message: 'Xóa lịch sử tìm kiếm thành công' });
  } catch (error) {
    next(error);
  }
};

const clearAllSearchHistory = async (req, res, next) => {
  try {
    await service.clearAll({ userId: req.user.id });
    res.status(200).json({ status: 'success', message: 'Xóa tất cả lịch sử tìm kiếm thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports = { saveSearch, getSearchHistory, deleteSearchHistory, clearAllSearchHistory };
