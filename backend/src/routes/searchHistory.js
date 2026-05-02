const express = require('express');
const router = express.Router();
const searchHistoryController = require('../controllers/searchHistory');
const { authenticate } = require('../middlewares/authenticate');

// Khách có thể lưu tìm kiếm (nếu có sessionId hoặc để im lặng)
router.post('/', (req, res, next) => {
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
