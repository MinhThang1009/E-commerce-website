/**
 * @file searchHistoryService.js
 * @layer Service
 * @module searchHistory
 * @description Business logic layer cho searchHistory
 */
const { AppError } = require('@shared/errors');
const repo = require('@modules/search-history/repositories/sequelize-search-history-repository');

const ONE_HOUR_MS = 60 * 60 * 1000;

// Lưu lịch sử tìm kiếm, bỏ qua nếu cùng keyword đã tồn tại trong 1 giờ qua (dedup)
const saveSearch = async ({ keyword, resultsCount, sessionId, userId }) => {
  const since = new Date(Date.now() - ONE_HOUR_MS);
  const existing = await repo.findDuplicate({ keyword, userId, sessionId, since });
  if (existing) return { created: false, data: existing };

  const created = await repo.create({ userId, keyword, resultsCount, sessionId });
  return { created: true, data: created };
};

const getHistory = ({ userId, limit = 10 }) =>
  repo.findByUser({ userId, limit: parseInt(limit, 10) });

const deleteOne = async ({ id, userId }) => {
  const item = await repo.findOneByUserAndId({ id, userId });
  if (!item) throw new AppError('Không tìm thấy lịch sử tìm kiếm', 404);
  await item.destroy();
};

const clearAll = ({ userId }) => repo.destroyByUser({ userId });

module.exports = { saveSearch, getHistory, deleteOne, clearAll };
