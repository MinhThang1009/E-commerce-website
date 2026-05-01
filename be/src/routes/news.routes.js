const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news.controller');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Public routes
router.get('/', newsController.getAllNews);
router.get('/slug/:slug', newsController.getNewsBySlug);
router.get('/slug/:slug/related', newsController.getRelatedNews);
router.get('/:id', newsController.getNewsById);

// Admin routes
router.post(
  '/',
  authenticate,
  authorize('admin'),
  newsController.createNews
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  newsController.updateNews
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  newsController.deleteNews
);

module.exports = router;
