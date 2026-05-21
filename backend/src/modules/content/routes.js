/**
 * @file routes.js
 * @layer Route
 * @module content
 * @description HTTP endpoints của content
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');
const { validateRequest } = require('@middlewares/validate-request');
const { httpCacheHeaders } = require('@middlewares/cache');
const {
  createBannerSchema,
  updateBannerSchema,
  createNewsSchema,
  updateNewsSchema,
  feedbackSchema,
} = require('@modules/content/validators/content-validator');

// Content module: 3 sub-domain với URL prefix khác nhau (/banners, /news,
// /contact). Module.js wire 3 router riêng, app.js mount mỗi router tại đúng
// basePath tương ứng.
module.exports = ({ contentController }) => {
  /**
   * @swagger
   * /api/banners:
   *   get:
   *     summary: Lấy danh sách banner
   *     tags: [Content]
   *   post:
   *     summary: Tạo banner mới (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   * /api/banners/{id}:
   *   get:
   *     summary: Lấy banner theo ID
   *     tags: [Content]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   patch:
   *     summary: Cập nhật banner (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa banner (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  const banner = express.Router();
  banner.get('/', httpCacheHeaders(900), contentController.getAllBanners);
  banner.get('/:id', httpCacheHeaders(900), contentController.getBannerById);
  banner.use(authenticate);
  banner.use(authorize('admin'));
  banner.post('/', validateRequest(createBannerSchema, 422), contentController.createBanner);
  banner.patch('/:id', validateRequest(updateBannerSchema, 422), contentController.updateBanner);
  banner.delete('/:id', contentController.deleteBanner);

  /**
   * @swagger
   * /api/news:
   *   get:
   *     summary: Lấy danh sách tin tức
   *     tags: [Content]
   *   post:
   *     summary: Tạo tin tức mới (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   * /api/news/slug/{slug}:
   *   get:
   *     summary: Lấy tin tức theo slug
   *     tags: [Content]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   * /api/news/slug/{slug}/related:
   *   get:
   *     summary: Lấy tin tức liên quan
   *     tags: [Content]
   *     parameters:
   *       - in: path
   *         name: slug
   *         required: true
   *         schema:
   *           type: string
   * /api/news/{id}:
   *   get:
   *     summary: Lấy tin tức theo ID
   *     tags: [Content]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   put:
   *     summary: Cập nhật tin tức (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa tin tức (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  const news = express.Router();
  news.get('/', contentController.getAllNews);
  news.get('/slug/:slug', contentController.getNewsBySlug);
  news.get('/slug/:slug/related', contentController.getRelatedNews);
  news.get('/:id', contentController.getNewsById);
  news.post(
    '/',
    authenticate,
    authorize('admin'),
    validateRequest(createNewsSchema, 422),
    contentController.createNews,
  );
  news.put(
    '/:id',
    authenticate,
    authorize('admin'),
    validateRequest(updateNewsSchema, 422),
    contentController.updateNews,
  );
  news.delete('/:id', authenticate, authorize('admin'), contentController.deleteNews);

  /**
   * @swagger
   * /api/contact/feedback:
   *   post:
   *     summary: Gửi phản hồi/liên hệ
   *     tags: [Content]
   */
  const contact = express.Router();
  contact.post('/feedback', validateRequest(feedbackSchema, 422), contentController.sendFeedback);

  return { banner, news, contact };
};
