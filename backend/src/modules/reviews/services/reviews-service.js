/**
 * @file reviewsService.js
 * @layer Service
 * @module reviews
 * @description Business logic layer cho reviews
 * @depends-on sequelize-reviews-repository, eventBus, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const { AppError } = require('@shared/errors');

// Reviews Service — review của user cho product. Business rules:
//   - Verified purchase: user phải có order delivered chứa product trước khi review
//   - 1 user / 1 product = 1 review (update nếu đã tồn tại)
//   - Tự động tính avg rating + reviewCount cho product khi review CRUD
class ReviewsService {
  constructor({ reviewsRepository, eventBus, logger }) {
    this.reviewsRepository = reviewsRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // Helper: cập nhật rating của product sau khi review CRUD
  async _refreshProductRating(productId, includeCount = true) {
    const { avg, count } = await this.reviewsRepository.getProductRatingsAggregate(productId);
    if (includeCount) {
      await this.reviewsRepository.updateProductRating(productId, avg, count);
    } else {
      await this.reviewsRepository.updateProductRating(productId, avg);
    }
    return { avg, count };
  }

  async createReview({ userId, productId, rating, title, comment, images }) {
    const product = await this.reviewsRepository.findProductById(productId);
    if (!product) {
      throw new AppError('reviews.productNotFound', 404);
    }

    const hasPurchased = await this.reviewsRepository.hasUserPurchasedProduct(userId, productId);
    if (!hasPurchased) {
      throw new AppError('reviews.purchaseRequired', 403);
    }

    let review;
    await this.reviewsRepository.runInTransaction(async (tx) => {
      const existing = await this.reviewsRepository.findReviewByUserAndProduct(userId, productId, {
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      });

      if (existing) {
        Object.assign(existing, {
          rating,
          title,
          content: comment,
          images: images || [],
          isVerified: true,
        });
        review = await this.reviewsRepository.saveReview(existing, { transaction: tx });
      } else {
        review = await this.reviewsRepository.createReview(
          {
            productId,
            userId,
            rating,
            title,
            content: comment,
            images: images || [],
            isVerified: true,
          },
          { transaction: tx },
        );
      }
    });

    const created = await this.reviewsRepository.findReviewByPkWithUser(review.id);
    await this._refreshProductRating(productId);

    return { review: created };
  }

  async updateReview({ userId, reviewId, patch }) {
    const review = await this.reviewsRepository.findReviewByIdAndUserId(reviewId, userId);
    if (!review) {
      throw new AppError('reviews.notFound', 404);
    }

    if (patch.rating !== undefined) review.rating = patch.rating;
    if (patch.title !== undefined) review.title = patch.title;
    if (patch.comment !== undefined) review.content = patch.comment;
    if (patch.images !== undefined) review.images = patch.images;
    review.isVerified = true;

    await this.reviewsRepository.saveReview(review);

    const updated = await this.reviewsRepository.findReviewByPkWithUser(review.id);
    await this._refreshProductRating(review.productId, false);

    return { review: updated };
  }

  async deleteReview({ userId, reviewId }) {
    const review = await this.reviewsRepository.findReviewByIdAndUserId(reviewId, userId);
    if (!review) {
      throw new AppError('reviews.notFound', 404);
    }

    const productId = review.productId;
    await this.reviewsRepository.deleteReview(review);
    await this._refreshProductRating(productId);

    return { message: 'reviews.deleted' };
  }

  async getProductReviews({ productId, page = 1, limit = 10, sort = 'newest', rating, verified }) {
    const sortMapping = {
      newest: ['createdAt', 'DESC'],
      oldest: ['createdAt', 'ASC'],
      highest_rating: ['rating', 'DESC'],
      lowest_rating: ['rating', 'ASC'],
    };
    const [sortColumn, sortOrder] = sortMapping[sort] || ['createdAt', 'DESC'];

    const product = await this.reviewsRepository.findProductById(productId);
    if (!product) {
      throw new AppError('reviews.productNotFound', 404);
    }

    const whereClause = {};
    if (rating) whereClause.rating = parseInt(rating, 10);
    if (verified !== undefined) whereClause.isVerified = verified === 'true';

    const { count, rows } = await this.reviewsRepository.findProductReviews(productId, {
      whereClause,
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
      sortColumn,
      sortOrder,
    });

    return {
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
      reviews: rows,
    };
  }

  async getUserReviews({ userId, page = 1, limit = 10 }) {
    const { count, rows } = await this.reviewsRepository.findUserReviews(userId, {
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    return {
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
      reviews: rows,
    };
  }

  async getAllReviews({ page = 1, limit = 10, verified }) {
    const whereConditions = {};
    if (verified !== undefined) whereConditions.isVerified = verified === 'true';

    const { count, rows } = await this.reviewsRepository.findAllReviews({
      whereConditions,
      limit: parseInt(limit, 10),
      offset: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    });

    return {
      total: count,
      pages: Math.ceil(count / limit),
      currentPage: parseInt(page, 10),
      reviews: rows,
    };
  }

  async verifyReview({ reviewId, isVerified }) {
    const review = await this.reviewsRepository.findReviewByPk(reviewId);
    if (!review) {
      throw new AppError('reviews.notFound', 404);
    }

    review.isVerified = isVerified;
    await this.reviewsRepository.saveReview(review);

    return {
      message: isVerified ? 'reviews.verified' : 'reviews.rejected',
      data: { id: review.id, isVerified },
    };
  }
}

module.exports = ReviewsService;
