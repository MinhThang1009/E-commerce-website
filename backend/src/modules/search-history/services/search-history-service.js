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
  // Bỏ qua dedup khi không có cả userId lẫn sessionId — tránh IDOR: findDuplicate không có scope
  // sẽ match record của user/session khác có cùng keyword
  // Bỏ qua hoàn toàn khi không có userId lẫn sessionId — row tạo ra không thể truy cập hay xóa được
  if (!userId && !sessionId) return { created: false, data: null };

  // ACCEPTED RISK: findDuplicate + create không atomic (TOCTOU).
  // Hai request đồng thời cùng keyword+userId có thể tạo duplicate trong window 1h.
  // Chấp nhận vì: (1) search history là analytics-grade, không ảnh hưởng tính đúng đắn nghiệp vụ;
  // (2) cron cleanup xóa orphan records định kỳ; (3) dedup-window 1h làm giảm xác suất.
  const existing = await repo.findDuplicate({ keyword, userId, sessionId, since });
  if (existing) return { created: false, data: existing };

  const created = await repo.create({ userId, keyword, resultsCount, sessionId });
  return { created: true, data: created };
};

const getHistory = ({ userId, limit = 10 }) =>
  repo.findByUser({ userId, limit: Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100) });

const deleteOne = async ({ id, userId }) => {
  const item = await repo.findOneByUserAndId({ id, userId });
  if (!item) throw new AppError('searchHistory.notFound', 404);
  await item.destroy();
};

const clearAll = ({ userId }) => repo.destroyByUser({ userId });

module.exports = { saveSearch, getHistory, deleteOne, clearAll };
