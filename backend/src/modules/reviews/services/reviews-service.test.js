const ReviewsService = require('./reviews-service');

describe('ReviewsService', () => {
  let reviewsRepository;
  let service;

  beforeEach(() => {
    reviewsRepository = {
      findProductById: jest.fn(),
      hasUserPurchasedProduct: jest.fn(),
      findReviewByUserAndProduct: jest.fn(),
      createReview: jest.fn(),
      saveReview: jest.fn((r) => Promise.resolve(r)),
      findReviewByPkWithUser: jest.fn(),
      findReviewByIdAndUserId: jest.fn(),
      findReviewByPk: jest.fn(),
      deleteReview: jest.fn().mockResolvedValue(),
      findProductReviews: jest.fn(),
      findUserReviews: jest.fn(),
      findAllReviews: jest.fn(),
      getProductRatingsAggregate: jest.fn().mockResolvedValue({ avg: 4.5, count: 10 }),
      updateProductRating: jest.fn().mockResolvedValue(),
      findFeedback: jest.fn(),
      createFeedback: jest.fn().mockResolvedValue(),
      saveFeedback: jest.fn((f) => Promise.resolve(f)),
      incrementReview: jest.fn().mockResolvedValue(),
      decrementReview: jest.fn().mockResolvedValue(),
    };

    service = new ReviewsService({
      reviewsRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  // -------- createReview --------

  describe('createReview', () => {
    test('sản phẩm không tồn tại → 404', async () => {
      reviewsRepository.findProductById.mockResolvedValue(null);

      await expect(
        service.createReview({ userId: 1, productId: 99, rating: 5, title: 'T', comment: 'C' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user chưa mua sản phẩm → 403', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(false);

      await expect(
        service.createReview({ userId: 1, productId: 1, rating: 5, title: 'T', comment: 'C' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('user chưa có review → tạo review mới', async () => {
      const newReview = { id: 10, rating: 5 };
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue(newReview);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(newReview);

      const result = await service.createReview({
        userId: 1, productId: 1, rating: 5, title: 'Tốt', comment: 'Rất tốt', images: [],
      });

      expect(reviewsRepository.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, productId: 1, rating: 5, isVerified: true })
      );
      expect(result.review).toBe(newReview);
    });

    test('user đã có review → cập nhật review cũ thay vì tạo mới', async () => {
      const existingReview = { id: 5, rating: 3, title: 'Cũ', content: 'Cũ', images: [] };
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(existingReview);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(existingReview);

      await service.createReview({
        userId: 1, productId: 1, rating: 5, title: 'Mới', comment: 'Tốt hơn', images: ['img.jpg'],
      });

      expect(reviewsRepository.createReview).not.toHaveBeenCalled();
      expect(existingReview.rating).toBe(5);
      expect(existingReview.title).toBe('Mới');
      expect(existingReview.content).toBe('Tốt hơn');
      expect(existingReview.isVerified).toBe(true);
      expect(reviewsRepository.saveReview).toHaveBeenCalledWith(existingReview);
    });

    test('images mặc định là [] khi không truyền', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue({ id: 1 });
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue({ id: 1 });

      await service.createReview({ userId: 1, productId: 1, rating: 4, title: 'T', comment: 'C' });

      expect(reviewsRepository.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ images: [] })
      );
    });

    test('gọi _refreshProductRating sau khi tạo review', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue({ id: 1 });
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue({ id: 1 });

      await service.createReview({ userId: 1, productId: 1, rating: 5, title: 'T', comment: 'C' });

      expect(reviewsRepository.getProductRatingsAggregate).toHaveBeenCalledWith(1);
      expect(reviewsRepository.updateProductRating).toHaveBeenCalled();
    });
  });

  // -------- updateReview --------

  describe('updateReview', () => {
    test('review không thuộc user → 404', async () => {
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.updateReview({ userId: 1, reviewId: 99, patch: {} })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật rating khi patch.rating được cung cấp', async () => {
      const review = { id: 1, rating: 3, title: 'Cũ', content: 'C', images: [], productId: 1 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({ userId: 1, reviewId: 1, patch: { rating: 5 } });

      expect(review.rating).toBe(5);
    });

    test('không cập nhật rating khi patch.rating undefined', async () => {
      const review = { id: 1, rating: 3, title: 'Cũ', content: 'C', images: [], productId: 1 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({ userId: 1, reviewId: 1, patch: { title: 'Mới' } });

      expect(review.rating).toBe(3);
      expect(review.title).toBe('Mới');
    });

    test('cập nhật content từ patch.comment', async () => {
      const review = { id: 1, rating: 3, title: 'T', content: 'Cũ', images: [], productId: 1 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({ userId: 1, reviewId: 1, patch: { comment: 'Bình luận mới' } });

      expect(review.content).toBe('Bình luận mới');
    });

    test('set isVerified=true sau khi update', async () => {
      const review = { id: 1, rating: 3, title: 'T', content: 'C', images: [], isVerified: false, productId: 1 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({ userId: 1, reviewId: 1, patch: {} });

      expect(review.isVerified).toBe(true);
    });

    test('cập nhật images khi patch.images được cung cấp — covers line 65', async () => {
      const review = { id: 1, rating: 4, title: 'T', content: 'C', images: [], productId: 1 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);
      const newImages = ['uploads/reviews/img1.jpg', 'uploads/reviews/img2.jpg'];

      await service.updateReview({ userId: 1, reviewId: 1, patch: { images: newImages } });

      expect(review.images).toEqual(newImages);
    });

    test('không cập nhật images khi patch.images undefined', async () => {
      const originalImages = ['uploads/reviews/existing.jpg'];
      const review = { id: 1, rating: 4, title: 'T', content: 'C', images: originalImages, productId: 1 };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({ userId: 1, reviewId: 1, patch: { rating: 5 } });

      expect(review.images).toBe(originalImages); // không thay đổi
    });
  });

  // -------- deleteReview --------

  describe('deleteReview', () => {
    test('review không tồn tại → 404', async () => {
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.deleteReview({ userId: 1, reviewId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('xóa thành công → trả về message', async () => {
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue({ id: 1, productId: 5 });

      const result = await service.deleteReview({ userId: 1, reviewId: 1 });

      expect(reviewsRepository.deleteReview).toHaveBeenCalled();
      expect(result.message).toBe('reviews.deleted');
    });

    test('cập nhật rating sản phẩm sau khi xóa review', async () => {
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue({ id: 1, productId: 5 });

      await service.deleteReview({ userId: 1, reviewId: 1 });

      expect(reviewsRepository.getProductRatingsAggregate).toHaveBeenCalledWith(5);
    });
  });

  // -------- getProductReviews --------

  describe('getProductReviews', () => {
    test('sản phẩm không tồn tại → 404', async () => {
      reviewsRepository.findProductById.mockResolvedValue(null);

      await expect(
        service.getProductReviews({ productId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('trả về pagination đúng', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 25, rows: [] });

      const result = await service.getProductReviews({ productId: 1, page: 2, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.pages).toBe(3);
      expect(result.currentPage).toBe(2);
    });

    test('sort "highest_rating" → sortColumn=rating, sortOrder=DESC', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, sort: 'highest_rating' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortColumn: 'rating', sortOrder: 'DESC' })
      );
    });

    test('sort "most_helpful" → sortColumn=likes', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, sort: 'most_helpful' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortColumn: 'likes', sortOrder: 'DESC' })
      );
    });

    test('sort không hợp lệ → mặc định createdAt DESC', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, sort: 'invalid_sort' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortColumn: 'createdAt', sortOrder: 'DESC' })
      );
    });

    test('filter theo rating → whereClause.rating = số nguyên', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, rating: '4' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ whereClause: expect.objectContaining({ rating: 4 }) })
      );
    });

    test('filter verified=true → whereClause.isVerified=true', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, verified: 'true' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ whereClause: expect.objectContaining({ isVerified: true }) })
      );
    });
  });

  // -------- verifyReview --------

  describe('verifyReview', () => {
    test('review không tồn tại → 404', async () => {
      reviewsRepository.findReviewByPk.mockResolvedValue(null);

      await expect(
        service.verifyReview({ reviewId: 99, isVerified: true })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('isVerified=true → message xác nhận', async () => {
      const review = { id: 1, isVerified: false };
      reviewsRepository.findReviewByPk.mockResolvedValue(review);

      const result = await service.verifyReview({ reviewId: 1, isVerified: true });

      expect(review.isVerified).toBe(true);
      expect(result.message).toBe('reviews.verified');
      expect(result.data).toEqual({ id: 1, isVerified: true });
    });

    test('isVerified=false → message từ chối', async () => {
      const review = { id: 1, isVerified: true };
      reviewsRepository.findReviewByPk.mockResolvedValue(review);

      const result = await service.verifyReview({ reviewId: 1, isVerified: false });

      expect(result.message).toBe('reviews.rejected');
    });
  });

  // -------- markReviewHelpful --------

  describe('markReviewHelpful', () => {
    test('review không tồn tại → 404', async () => {
      reviewsRepository.findReviewByPk.mockResolvedValue(null);

      await expect(
        service.markReviewHelpful({ userId: 1, reviewId: 99, helpful: true })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user vote cho review của chính mình → 400', async () => {
      reviewsRepository.findReviewByPk.mockResolvedValue({ id: 1, userId: 5 });

      await expect(
        service.markReviewHelpful({ userId: 5, reviewId: 1, helpful: true })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('lần đầu vote helpful=true → tạo feedback + increment likes', async () => {
      const review = { id: 1, userId: 3, likes: 0, dislikes: 0 };
      reviewsRepository.findReviewByPk
        .mockResolvedValueOnce(review)
        .mockResolvedValueOnce({ id: 1, likes: 1, dislikes: 0 });
      reviewsRepository.findFeedback.mockResolvedValue(null);

      const result = await service.markReviewHelpful({ userId: 1, reviewId: 1, helpful: true });

      expect(reviewsRepository.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ reviewId: 1, userId: 1, isHelpful: true })
      );
      expect(reviewsRepository.incrementReview).toHaveBeenCalledWith(review, 'likes');
      expect(result.message).toBe('reviews.markedHelpful');
    });

    test('lần đầu vote helpful=false → tạo feedback + increment dislikes', async () => {
      const review = { id: 1, userId: 3, likes: 0, dislikes: 0 };
      reviewsRepository.findReviewByPk
        .mockResolvedValueOnce(review)
        .mockResolvedValueOnce({ id: 1, likes: 0, dislikes: 1 });
      reviewsRepository.findFeedback.mockResolvedValue(null);

      await service.markReviewHelpful({ userId: 1, reviewId: 1, helpful: false });

      expect(reviewsRepository.incrementReview).toHaveBeenCalledWith(review, 'dislikes');
      expect(reviewsRepository.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ isHelpful: false })
      );
    });

    test('đổi vote từ helpful=true sang false → swap likes/dislikes + cập nhật feedback', async () => {
      const review = { id: 1, userId: 3 };
      const existingFeedback = { isHelpful: true };
      reviewsRepository.findReviewByPk
        .mockResolvedValueOnce(review)
        .mockResolvedValueOnce({ id: 1, likes: 0, dislikes: 1 });
      reviewsRepository.findFeedback.mockResolvedValue(existingFeedback);

      await service.markReviewHelpful({ userId: 1, reviewId: 1, helpful: false });

      expect(reviewsRepository.decrementReview).toHaveBeenCalledWith(review, 'likes');
      expect(reviewsRepository.incrementReview).toHaveBeenCalledWith(review, 'dislikes');
      expect(existingFeedback.isHelpful).toBe(false);
      expect(reviewsRepository.saveFeedback).toHaveBeenCalledWith(existingFeedback);
    });

    test('vote lại cùng giá trị → không thay đổi gì', async () => {
      const review = { id: 1, userId: 3 };
      const existingFeedback = { isHelpful: true };
      reviewsRepository.findReviewByPk
        .mockResolvedValueOnce(review)
        .mockResolvedValueOnce({ id: 1, likes: 5, dislikes: 0 });
      reviewsRepository.findFeedback.mockResolvedValue(existingFeedback);

      await service.markReviewHelpful({ userId: 1, reviewId: 1, helpful: true });

      expect(reviewsRepository.incrementReview).not.toHaveBeenCalled();
      expect(reviewsRepository.decrementReview).not.toHaveBeenCalled();
      expect(reviewsRepository.saveFeedback).not.toHaveBeenCalled();
    });
  });
});
