const express = require('express');
const router = express.Router();
const searchHistoryController = require('./controllers/searchHistoryController');
const { authenticate } = require('../../middlewares/authenticate');
const { validateRequest } = require('../../middlewares/validateRequest');
const { saveSearchSchema } = require('./validators/searchHistoryValidator');

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
