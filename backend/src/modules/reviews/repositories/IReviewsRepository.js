// IReviewsRepository — interface review data access. Service phụ thuộc
// interface, không phụ thuộc Review/Product/User/Order/OrderItem/ReviewFeedback.

class IReviewsRepository {
  // Review CRUD
  async findReviewByPk(_id) { throw new Error('not implemented'); }
  async findReviewByIdAndUserId(_id, _userId) { throw new Error('not implemented'); }
  async findReviewByUserAndProduct(_userId, _productId) { throw new Error('not implemented'); }
  async findReviewByPkWithUser(_id) { throw new Error('not implemented'); }
  async findProductReviews(_productId, _options) { throw new Error('not implemented'); }
  async findUserReviews(_userId, _options) { throw new Error('not implemented'); }
  async findAllReviews(_options) { throw new Error('not implemented'); }
  async createReview(_payload) { throw new Error('not implemented'); }
  async saveReview(_review) { throw new Error('not implemented'); }
  async deleteReview(_review) { throw new Error('not implemented'); }
  async incrementReview(_review, _field) { throw new Error('not implemented'); }
  async decrementReview(_review, _field) { throw new Error('not implemented'); }

  // Product side-effects
  async findProductById(_id) { throw new Error('not implemented'); }
  async getProductRatingsAggregate(_productId) { throw new Error('not implemented'); }
  async updateProductRating(_productId, _avg, _count) { throw new Error('not implemented'); }

  // Purchase verification (Order)
  async hasUserPurchasedProduct(_userId, _productId) { throw new Error('not implemented'); }

  // ReviewFeedback (helpful votes)
  async findFeedback(_reviewId, _userId) { throw new Error('not implemented'); }
  async createFeedback(_payload) { throw new Error('not implemented'); }
  async saveFeedback(_feedback) { throw new Error('not implemented'); }
}

module.exports = IReviewsRepository;
