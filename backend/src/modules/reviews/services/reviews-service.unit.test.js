const ReviewsService = require('./reviews-service');

describe('ReviewsService', () => {
  let reviewsRepository;
  let service;

  beforeEach(() => {
    reviewsRepository = {
      findReviewByPk: jest.fn(),
      findReviewByIdAndUserId: jest.fn(),
      findReviewByUserAndProduct: jest.fn(),
      findReviewByPkWithUser: jest.fn(),
      findProductReviews: jest.fn(),
      findUserReviews: jest.fn(),
      findAllReviews: jest.fn(),
      createReview: jest.fn(),
      saveReview: jest.fn((r) => Promise.resolve(r)),
      deleteReview: jest.fn().mockResolvedValue(),
      incrementReview: jest.fn().mockResolvedValue(),
      decrementReview: jest.fn().mockResolvedValue(),
      findProductById: jest.fn(),
      getProductRatingsAggregate: jest.fn().mockResolvedValue({ avg: 4.5, count: 10 }),
      updateProductRating: jest.fn().mockResolvedValue(),
      hasUserPurchasedProduct: jest.fn(),
    };
    service = new ReviewsService({
      reviewsRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('createReview', () => {
    test('product không tồn tại → 404', async () => {
      reviewsRepository.findProductById.mockResolvedValue(null);
      await expect(
        service.createReview({ userId: 1, productId: 99, rating: 5, title: 't', comment: 'c' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('chưa mua → 403', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(false);
      await expect(
        service.createReview({ userId: 1, productId: 1, rating: 5, title: 't', comment: 'c' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('chưa có review → tạo mới + refresh product rating', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue({ id: 5 });
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue({ id: 5, rating: 5 });

      const result = await service.createReview({
        userId: 1,
        productId: 1,
        rating: 5,
        title: 't',
        comment: 'c',
      });

      expect(reviewsRepository.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ rating: 5, title: 't', content: 'c', isVerified: true }),
      );
      expect(reviewsRepository.updateProductRating).toHaveBeenCalledWith(1, 4.5, 10);
      expect(result.review.id).toBe(5);
    });

    test('đã có review → update + refresh rating', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      const existing = { id: 5, productId: 1 };
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(existing);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue({ id: 5 });

      await service.createReview({ userId: 1, productId: 1, rating: 4, title: 't', comment: 'c' });

      expect(existing.rating).toBe(4);
      expect(reviewsRepository.saveReview).toHaveBeenCalledWith(existing);
      expect(reviewsRepository.createReview).not.toHaveBeenCalled();
    });
  });

  describe('updateReview', () => {
    test('không tìm thấy → 404', async () => {
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.updateReview({ userId: 1, reviewId: 5, patch: { rating: 4 } }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('hợp lệ → cập nhật field cung cấp + refresh rating (không count)', async () => {
      const review = { id: 5, productId: 10, rating: 3, title: 't', content: 'c', images: [] };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({
        userId: 1,
        reviewId: 5,
        patch: { rating: 5, title: 'new title' },
      });

      expect(review.rating).toBe(5);
      expect(review.title).toBe('new title');
      expect(review.content).toBe('c'); // không touch
      expect(reviewsRepository.updateProductRating).toHaveBeenCalledWith(10, 4.5);
    });
  });

  describe('deleteReview', () => {
    test('không tìm thấy → 404', async () => {
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(null);
      await expect(service.deleteReview({ userId: 1, reviewId: 5 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('hợp lệ → xóa + refresh rating', async () => {
      const review = { id: 5, productId: 10 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);

      await service.deleteReview({ userId: 1, reviewId: 5 });

      expect(reviewsRepository.deleteReview).toHaveBeenCalledWith(review);
      expect(reviewsRepository.updateProductRating).toHaveBeenCalledWith(10, 4.5, 10);
    });
  });

  describe('getProductReviews', () => {
    test('product không tồn tại → 404', async () => {
      reviewsRepository.findProductById.mockResolvedValue(null);
      await expect(service.getProductReviews({ productId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('sort=highest_rating + filter rating + verified', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 5, rows: [] });

      await service.getProductReviews({
        productId: 1,
        page: 2,
        limit: 5,
        sort: 'highest_rating',
        rating: '4',
        verified: 'true',
      });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          whereClause: { rating: 4, isVerified: true },
          sortColumn: 'rating',
          sortOrder: 'DESC',
          limit: 5,
          offset: 5,
        }),
      );
    });
  });

  describe('verifyReview', () => {
    test('không tìm thấy → 404', async () => {
      reviewsRepository.findReviewByPk.mockResolvedValue(null);
      await expect(service.verifyReview({ reviewId: 5, isVerified: true })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('isVerified=true → cập nhật + message verified', async () => {
      const review = { id: 5 };
      reviewsRepository.findReviewByPk.mockResolvedValue(review);
      const result = await service.verifyReview({ reviewId: 5, isVerified: true });
      expect(review.isVerified).toBe(true);
      expect(result.message).toBe('reviews.verified');
    });
  });
});
