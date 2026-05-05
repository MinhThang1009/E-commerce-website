const ReviewsController = require('./controllers/reviewsController');
const ReviewsService = require('./services/reviewsService');
const SequelizeReviewsRepository = require('./repositories/SequelizeReviewsRepository');
const buildRoutes = require('./routes');

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
