/**
 * @file routes.js
 * @layer Route
 * @module searchHistory
 * @description HTTP endpoints của searchHistory
 */
const express = require('express');
const router = express.Router();
const searchHistoryController = require('@modules/search-history/controllers/search-history-controller');
const { authenticate, optionalAuthenticate } = require('@middlewares/authenticate');
const { apiLimiter, destructiveLimiter } = require('@middlewares/rate-limiter');
const { validateRequest } = require('@middlewares/validate-request');
const {
  saveSearchSchema,
  deleteSearchParamSchema,
  getHistoryQuerySchema,
} = require('@modules/search-history/validators/search-history-validator');

/**
 * @swagger
 * /api/search-histories:
 *   get:
 *     summary: Lấy lịch sử tìm kiếm của người dùng
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Lưu từ khóa tìm kiếm
 *     tags: [Search History]
 *   delete:
 *     summary: Xóa toàn bộ lịch sử tìm kiếm
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 * /api/search-histories/{id}:
 *   delete:
 *     summary: Xóa một mục lịch sử tìm kiếm
 *     tags: [Search History]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
// Khách có thể lưu tìm kiếm — dùng destructiveLimiter (10 req/15min) thay vì apiLimiter
// vì endpoint là public write, cần bảo vệ chặt hơn để tránh flood search_history table
router.post(
  '/',
  destructiveLimiter,
  optionalAuthenticate,
  validateRequest(saveSearchSchema, 400),
  searchHistoryController.saveSearch,
);

// Các route riêng tư (yêu cầu đăng nhập)
router.get(
  '/',
  apiLimiter,
  authenticate,
  validateRequest(getHistoryQuerySchema, 400, 'query'),
  searchHistoryController.getSearchHistory,
);
router.delete(
  '/:id',
  apiLimiter,
  authenticate,
  validateRequest(deleteSearchParamSchema, 400, 'params'),
  searchHistoryController.deleteSearchHistory,
);
// destructiveLimiter (10 req/15min) thay vì apiLimiter cho bulk delete endpoint
router.delete('/', destructiveLimiter, authenticate, searchHistoryController.clearAllSearchHistory);

module.exports = router;
