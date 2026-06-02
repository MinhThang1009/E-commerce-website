/**
 * @file routes.js
 * @layer Route
 * @module reviews
 * @description HTTP endpoints của reviews
 */
const express = require('express');
const { authenticate } = require('@middlewares/authenticate');
const { authorize } = require('@middlewares/authorize');
const { validateRequest } = require('@middlewares/validate-request');
const { reviewSchema } = require('@modules/reviews/validators/reviews-validator');

// Reviews module routes — basePath '/reviews' (mount /api/reviews).
// URL không đổi so với routes/review.js cũ.
module.exports = ({ reviewsController }) => {
  const router = express.Router();

  /**
   * @swagger
   * /api/reviews/product/{productId}:
   *   get:
   *     summary: Lấy đánh giá của sản phẩm
   *     tags: [Reviews]
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: integer
   * /api/reviews/user:
   *   get:
   *     summary: Lấy đánh giá của người dùng hiện tại
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   * /api/reviews:
   *   post:
   *     summary: Tạo đánh giá mới
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   * /api/reviews/{id}:
   *   put:
   *     summary: Cập nhật đánh giá
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *   delete:
   *     summary: Xóa đánh giá
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   * /api/reviews/admin/all:
   *   get:
   *     summary: Lấy tất cả đánh giá (admin)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   * /api/reviews/admin/{id}/verify:
   *   patch:
   *     summary: Xác minh đánh giá (admin)
   *     tags: [Reviews]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   */
  // Public
  router.get('/product/:productId', reviewsController.getProductReviews);

  // User authenticated
  router.use('/user', authenticate);
  router.get('/user', reviewsController.getUserReviews);

  router.post('/', authenticate, validateRequest(reviewSchema), reviewsController.createReview);
  router.put('/:id', authenticate, validateRequest(reviewSchema), reviewsController.updateReview);
  router.delete('/:id', authenticate, reviewsController.deleteReview);

  // Back-office: xem tất cả đánh giá → admin (giám sát) + staff; kiểm duyệt (verify) → staff
  router.get(
    '/admin/all',
    authenticate,
    authorize('admin', 'staff'),
    reviewsController.getAllReviews,
  );
  router.patch(
    '/admin/:id/verify',
    authenticate,
    authorize('staff'),
    reviewsController.verifyReview,
  );

  return router;
};
