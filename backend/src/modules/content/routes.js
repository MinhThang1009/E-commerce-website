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
  newsletterSchema,
  feedbackSchema,
} = require('@modules/content/validators/content-validator');

// Content module: 5 sub-domain với URL prefix khác nhau (/banners, /news,
// /email-campaigns, /newsletter, /contact). Module.js wire 5 router riêng,
// app.js mount mỗi router tại đúng basePath tương ứng.
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
   * /api/email-campaigns:
   *   get:
   *     summary: Lấy danh sách email campaign (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *   post:
   *     summary: Tạo email campaign mới (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   * /api/email-campaigns/{id}/send:
   *   post:
   *     summary: Gửi email campaign (admin)
   *     tags: [Content]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/email-campaigns/{id}:
   *   delete:
   *     summary: Xóa email campaign (admin)
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
  const campaigns = express.Router();
  campaigns.use(authenticate);
  campaigns.use(authorize('admin'));
  campaigns.get('/', contentController.getAllCampaigns);
  campaigns.post('/', contentController.createCampaign);
  campaigns.post('/:id/send', contentController.sendCampaign);
  campaigns.delete('/:id', contentController.deleteCampaign);

  /**
   * @swagger
   * /api/newsletter/subscribe:
   *   post:
   *     summary: Đăng ký nhận bản tin
   *     tags: [Content]
   */
  const newsletter = express.Router();
  newsletter.post(
    '/subscribe',
    validateRequest(newsletterSchema, 422),
    contentController.subscribeNewsletter,
  );

  /**
   * @swagger
   * /api/contact/newsletter:
   *   post:
   *     summary: Đăng ký nhận bản tin qua trang liên hệ
   *     tags: [Content]
   * /api/contact/feedback:
   *   post:
   *     summary: Gửi phản hồi/liên hệ
   *     tags: [Content]
   */
  const contact = express.Router();
  contact.post(
    '/newsletter',
    validateRequest(newsletterSchema, 422),
    contentController.subscribeNewsletter,
  );
  contact.post('/feedback', validateRequest(feedbackSchema, 422), contentController.sendFeedback);

  return { banner, news, campaigns, newsletter, contact };
};
