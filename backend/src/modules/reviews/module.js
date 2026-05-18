/**
 * @file module.js
 * @layer Module
 * @module reviews
 * @description Entry point reviews module — khởi tạo dependencies và đăng ký routes
 */
const ReviewsController = require('@modules/reviews/controllers/reviews-controller');
const ReviewsService = require('@modules/reviews/services/reviews-service');
const SequelizeReviewsRepository = require('@modules/reviews/repositories/sequelize-reviews-repository');
const buildRoutes = require('@modules/reviews/routes');

module.exports = ({ Review, ReviewFeedback, Product, User, Order, OrderItem, eventBus, logger }) => {
  if (!Review) throw new Error('reviews module: Review model bắt buộc');
  if (!ReviewFeedback) throw new Error('reviews module: ReviewFeedback model bắt buộc');

  const reviewsRepository = new SequelizeReviewsRepository({
    Review, ReviewFeedback, Product, User, Order, OrderItem,
  });
  const reviewsService = new ReviewsService({ reviewsRepository, eventBus, logger });
  const reviewsController = new ReviewsController({ reviewsService });
  const router = buildRoutes({ reviewsController });

  return {
    basePath: '/reviews',
    router,
    subscribeEvents() {},
  };
};
