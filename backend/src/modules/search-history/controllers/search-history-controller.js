/**
 * @file searchHistoryController.js
 * @layer Controller
 * @module searchHistory
 * @description Xử lý HTTP request/response cho searchHistory
 */
const service = require('@modules/search-history/services/search-history-service');
const { t } = require('@utils/i18n');

const saveSearch = async (req, res, next) => {
  try {
    const { keyword, resultsCount, sessionId } = req.body;
    const userId = req.user ? req.user.id : null;

    const result = await service.saveSearch({ keyword, resultsCount, sessionId, userId });
    // Khi không có userId lẫn sessionId: save bị bỏ qua (tránh orphan row) — thêm flag saved:false
    if (!result.created && result.data === null) {
      return res.status(200).json({ status: 'success', saved: false });
    }
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
    res.status(200).json({ status: 'success', message: t('searchHistory.deleted', req.locale) });
  } catch (error) {
    next(error);
  }
};

const clearAllSearchHistory = async (req, res, next) => {
  try {
    await service.clearAll({ userId: req.user.id });
    res.status(200).json({ status: 'success', message: t('searchHistory.cleared', req.locale) });
  } catch (error) {
    next(error);
  }
};

module.exports = { saveSearch, getSearchHistory, deleteSearchHistory, clearAllSearchHistory };
