/**
 * @file routes.js
 * @layer Route
 * @module searchHistory
 * @description HTTP endpoints của searchHistory
 */
const express = require('express');
const router = express.Router();
const searchHistoryController = require('@modules/search-history/controllers/search-history-controller');
const { authenticate } = require('@middlewares/authenticate');
const { validateRequest } = require('@middlewares/validate-request');
const { saveSearchSchema } = require('@modules/search-history/validators/search-history-validator');

// Khách có thể lưu tìm kiếm — validate query trước khi xử lý
router.post('/', validateRequest(saveSearchSchema, 422), (req, res, next) => {
  // Thử xác thực nhưng không báo lỗi nếu chưa đăng nhập
  authenticate(req, res, () => {
    searchHistoryController.saveSearch(req, res, next);
  });
});

// Các route riêng tư (yêu cầu đăng nhập)
router.get('/', authenticate, searchHistoryController.getSearchHistory);
router.delete('/:id', authenticate, searchHistoryController.deleteSearchHistory);
router.delete('/', authenticate, searchHistoryController.clearAllSearchHistory);

module.exports = router;
