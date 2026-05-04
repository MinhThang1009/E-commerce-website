const express = require('express');
const router = express.Router();
const newsController = require('../controllers/news');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { validateRequest } = require('../middlewares/validateRequest');
const { createNewsSchema, updateNewsSchema } = require('../validators/news');

// Route công khai
router.get('/', newsController.getAllNews);
router.get('/slug/:slug', newsController.getNewsBySlug);
router.get('/slug/:slug/related', newsController.getRelatedNews);
router.get('/:id', newsController.getNewsById);

// Route của admin — yêu cầu auth + validate input
router.post(
  '/',
  authenticate,
  authorize('admin'),
  validateRequest(createNewsSchema, 422),
  newsController.createNews
);

router.put(
  '/:id',
  authenticate,
  authorize('admin'),
  validateRequest(updateNewsSchema, 422),
  newsController.updateNews
);

router.delete(
  '/:id',
  authenticate,
  authorize('admin'),
  newsController.deleteNews
);

module.exports = router;
