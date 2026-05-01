const express = require('express');
const router = express.Router();
const searchHistoryController = require('../controllers/searchHistory.controller');
const { authenticate } = require('../middlewares/authenticate');

// Guest can save search (if sessionId is provided or just silent)
router.post('/', (req, res, next) => {
  // Try to authenticate but don't fail if not logged in
  authenticate(req, res, () => {
    searchHistoryController.saveSearch(req, res, next);
  });
});

// Private routes (requires login)
router.get('/', authenticate, searchHistoryController.getSearchHistory);
router.delete('/:id', authenticate, searchHistoryController.deleteSearchHistory);
router.delete('/', authenticate, searchHistoryController.clearAllSearchHistory);

module.exports = router;
