/**
 * @file SequelizeReviewsRepository.js
 * @layer Repository
 * @module reviews
 * @description Data access layer cho reviews
 */
const IReviewsRepository = require('@modules/reviews/repositories/i-reviews-repository');

// Sequelize impl của IReviewsRepository — duy nhất layer truy cập Review/
// ReviewFeedback/Product/User/Order/OrderItem model.
class SequelizeReviewsRepository extends IReviewsRepository {
  constructor({ Review, ReviewFeedback, Product, User, Order, OrderItem }) {
    super();
    this.Review = Review;
    this.ReviewFeedback = ReviewFeedback;
    this.Product = Product;
    this.User = User;
    this.Order = Order;
    this.OrderItem = OrderItem;
  }

  // -------- Review CRUD --------

  async findReviewByPk(id) {
    return this.Review.findByPk(id);
  }

  async findReviewByIdAndUserId(id, userId) {
    return this.Review.findOne({ where: { id, userId } });
  }

  async findReviewByUserAndProduct(userId, productId) {
    return this.Review.findOne({ where: { userId, productId } });
  }

  async findReviewByPkWithUser(id) {
    return this.Review.findByPk(id, {
      include: [{
        model: this.User, as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
      }],
    });
  }

  async findProductReviews(productId, { whereClause = {}, limit, offset, sortColumn, sortOrder } = {}) {
    return this.Review.findAndCountAll({
      where: { productId, ...whereClause },
      include: [{
        model: this.User, as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'avatar'],
      }],
      limit, offset,
      order: [[sortColumn, sortOrder]],
    });
  }

  async findUserReviews(userId, { limit, offset } = {}) {
    return this.Review.findAndCountAll({
      where: { userId },
      include: [{
        model: this.Product,
        attributes: ['id', 'name', 'slug', 'thumbnail'],
      }],
      limit, offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async findAllReviews({ whereConditions = {}, limit, offset } = {}) {
    return this.Review.findAndCountAll({
      where: whereConditions,
      include: [
        { model: this.User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: this.Product, attributes: ['id', 'name', 'slug'] },
      ],
      limit, offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async createReview(payload) {
    return this.Review.create(payload);
  }

  async saveReview(review) {
    return review.save();
  }

  async deleteReview(review) {
    return review.destroy();
  }

  async incrementReview(review, field) {
    return review.increment(field);
  }

  async decrementReview(review, field) {
    return review.decrement(field);
  }

  // -------- Product --------

  async findProductById(id) {
    return this.Product.findByPk(id);
  }

  async getProductRatingsAggregate(productId) {
    const reviews = await this.Review.findAll({
      where: { productId },
      attributes: ['rating'],
    });
    if (reviews.length === 0) return { avg: 0, count: 0 };
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return { avg, count: reviews.length };
  }

  async updateProductRating(productId, avg, count) {
    const patch = count !== undefined
      ? { rating: avg, reviewCount: count }
      : { rating: avg };
    return this.Product.update(patch, { where: { id: productId } });
  }

  // -------- Purchase verification --------

  async hasUserPurchasedProduct(userId, productId) {
    const order = await this.Order.findOne({
      where: { userId, status: 'delivered' },
      include: [{
        model: this.OrderItem, as: 'items',
        where: { productId },
        required: true,
      }],
    });
    return !!order;
  }

  // -------- Feedback --------

  async findFeedback(reviewId, userId) {
    return this.ReviewFeedback.findOne({ where: { reviewId, userId } });
  }

  async createFeedback(payload) {
    return this.ReviewFeedback.create(payload);
  }

  async saveFeedback(feedback) {
    return feedback.save();
  }
}

module.exports = SequelizeReviewsRepository;
