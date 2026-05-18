/**
 * @file reviewsController.js
 * @layer Controller
 * @module reviews
 * @description Xử lý HTTP request/response cho reviews
 */
class ReviewsController {
  constructor({ reviewsService }) {
    this.reviewsService = reviewsService;
  }

  createReview = async (req, res, next) => {
    try {
      const { productId, rating, title, comment, images } = req.body;
      const { review } = await this.reviewsService.createReview({
        userId: req.user.id, productId, rating, title, comment, images,
      });
      res.status(201).json({ status: 'success', data: review });
    } catch (err) { next(err); }
  };

  updateReview = async (req, res, next) => {
    try {
      const { review } = await this.reviewsService.updateReview({
        userId: req.user.id,
        reviewId: req.params.id,
        patch: req.body,
      });
      res.status(200).json({ status: 'success', data: review });
    } catch (err) { next(err); }
  };

  deleteReview = async (req, res, next) => {
    try {
      const result = await this.reviewsService.deleteReview({
        userId: req.user.id,
        reviewId: req.params.id,
      });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  getProductReviews = async (req, res, next) => {
    try {
      const data = await this.reviewsService.getProductReviews({
        productId: req.params.productId,
        ...req.query,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getUserReviews = async (req, res, next) => {
    try {
      const data = await this.reviewsService.getUserReviews({
        userId: req.user.id,
        ...req.query,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getAllReviews = async (req, res, next) => {
    try {
      const data = await this.reviewsService.getAllReviews(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  verifyReview = async (req, res, next) => {
    try {
      const result = await this.reviewsService.verifyReview({
        reviewId: req.params.id,
        isVerified: req.body.isVerified,
      });
      res.status(200).json({ status: 'success', message: result.message, data: result.data });
    } catch (err) { next(err); }
  };

  markReviewHelpful = async (req, res, next) => {
    try {
      const result = await this.reviewsService.markReviewHelpful({
        userId: req.user.id,
        reviewId: req.params.id,
        helpful: req.body.helpful,
      });
      res.status(200).json({ status: 'success', message: result.message, data: result.data });
    } catch (err) { next(err); }
  };
}

module.exports = ReviewsController;
