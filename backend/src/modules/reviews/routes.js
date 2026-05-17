const express = require('express');
const { authenticate } = require('../../middlewares/authenticate');
const { authorize } = require('../../middlewares/authorize');
const { validateRequest } = require('../../middlewares/validateRequest');
const { reviewSchema, reviewHelpfulSchema } = require('./validators/reviewsValidator');

// Reviews module routes — basePath '/reviews' (mount /api/reviews).
// URL không đổi so với routes/review.js cũ.
module.exports = ({ reviewsController }) => {
  const router = express.Router();

  // Public
  router.get('/product/:productId', reviewsController.getProductReviews);

  // User authenticated
  router.use('/user', authenticate);
  router.get('/user', reviewsController.getUserReviews);

  router.post('/', authenticate, validateRequest(reviewSchema), reviewsController.createReview);
  router.put('/:id', authenticate, validateRequest(reviewSchema), reviewsController.updateReview);
  router.delete('/:id', authenticate, reviewsController.deleteReview);
  router.put(
    '/:id/helpful',
    authenticate,
    validateRequest(reviewHelpfulSchema),
    reviewsController.markReviewHelpful,
  );

  // Admin
  router.get('/admin/all', authenticate, authorize('admin'), reviewsController.getAllReviews);
  router.patch(
    '/admin/:id/verify',
    authenticate,
    authorize('admin'),
    reviewsController.verifyReview,
  );

  return router;
};
