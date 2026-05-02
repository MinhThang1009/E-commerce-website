const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');

// Route công khai
router.get('/', newsController.getAllNews);
router.get('/slug/:slug', newsController.getNewsBySlug);
router.get('/slug/:slug/related', newsController.getRelatedNews);
router.get('/:id', newsController.getNewsById);

// Route của admin
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
