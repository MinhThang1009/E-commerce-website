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
      runInTransaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
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
        service.createReview({ userId: 1, productId: 99, rating: 5, title: 'T', comment: 'C' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user chưa mua sản phẩm → 403', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(false);

      await expect(
        service.createReview({ userId: 1, productId: 1, rating: 5, title: 'T', comment: 'C' }),
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
        userId: 1,
        productId: 1,
        rating: 5,
        title: 'Tốt',
        comment: 'Rất tốt',
        images: [],
      });

      expect(reviewsRepository.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, productId: 1, rating: 5, isVerified: true }),
        expect.objectContaining({ transaction: expect.anything() }),
      );
      expect(result.review).toBe(newReview);
    });

    test('findReviewByUserAndProduct gọi với SELECT FOR UPDATE lock (REGRESSION: concurrent POST tạo duplicate review)', async () => {
      // Trước fix: findReviewByUserAndProduct không có lock → 2 concurrent requests đều
      // thấy existing=null và đều createReview → duplicate reviews, product.rating sai.
      // Sau fix: lock: tx.LOCK.UPDATE → serializes concurrent upsert.
      const newReview = { id: 10, rating: 5 };
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue(newReview);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(newReview);

      await service.createReview({ userId: 1, productId: 1, rating: 5, title: 'T', comment: 'C' });

      expect(reviewsRepository.findReviewByUserAndProduct).toHaveBeenCalledWith(
        1,
        1,
        expect.objectContaining({ lock: 'UPDATE' }),
      );
    });

    test('user đã có review → cập nhật review cũ thay vì tạo mới', async () => {
      const existingReview = { id: 5, rating: 3, title: 'Cũ', content: 'Cũ', images: [] };
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(existingReview);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(existingReview);

      await service.createReview({
        userId: 1,
        productId: 1,
        rating: 5,
        title: 'Mới',
        comment: 'Tốt hơn',
        images: ['img.jpg'],
      });

      expect(reviewsRepository.createReview).not.toHaveBeenCalled();
      expect(existingReview.rating).toBe(5);
      expect(existingReview.title).toBe('Mới');
      expect(existingReview.content).toBe('Tốt hơn');
      expect(existingReview.isVerified).toBe(true);
      expect(reviewsRepository.saveReview).toHaveBeenCalledWith(
        existingReview,
        expect.objectContaining({ transaction: expect.anything() }),
      );
    });

    test('images mặc định là [] khi không truyền', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue({ id: 1 });
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue({ id: 1 });

      await service.createReview({ userId: 1, productId: 1, rating: 4, title: 'T', comment: 'C' });

      expect(reviewsRepository.createReview).toHaveBeenCalledWith(
        expect.objectContaining({ images: [] }),
        expect.objectContaining({ transaction: expect.anything() }),
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
        service.updateReview({ userId: 1, reviewId: 99, patch: {} }),
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
      const review = {
        id: 1,
        rating: 3,
        title: 'T',
        content: 'C',
        images: [],
        isVerified: false,
        productId: 1,
      };
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
      const review = {
        id: 1,
        rating: 4,
        title: 'T',
        content: 'C',
        images: originalImages,
        productId: 1,
      };
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

      await expect(service.deleteReview({ userId: 1, reviewId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
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

      await expect(service.getProductReviews({ productId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('trả về pagination đúng', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 25, rows: [] });

      const result = await service.getProductReviews({ productId: 1, page: 2, limit: 10 });

      expect(result.total).toBe(25);
      expect(result.pages).toBe(3);
      expect(result.currentPage).toBe(2);
    });

    test('page=0 → offset không âm (REGRESSION: page=0 gây offset âm → 500)', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      const result = await service.getProductReviews({ productId: 1, page: 0, limit: 10 });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ offset: 0 }),
      );
      expect(result.currentPage).toBe(1);
    });

    test('sort "highest_rating" → sortColumn=rating, sortOrder=DESC', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, sort: 'highest_rating' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortColumn: 'rating', sortOrder: 'DESC' }),
      );
    });

    test('sort không hợp lệ → mặc định createdAt DESC', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, sort: 'invalid_sort' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortColumn: 'createdAt', sortOrder: 'DESC' }),
      );
    });

    test('filter theo rating → whereClause.rating = số nguyên', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, rating: '4' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ whereClause: expect.objectContaining({ rating: 4 }) }),
      );
    });

    test('filter verified=true → whereClause.isVerified=true', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.findProductReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductReviews({ productId: 1, verified: 'true' });

      expect(reviewsRepository.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ whereClause: expect.objectContaining({ isVerified: true }) }),
      );
    });
  });

  // -------- verifyReview --------

  describe('verifyReview', () => {
    test('review không tồn tại → 404', async () => {
      reviewsRepository.findReviewByPk.mockResolvedValue(null);

      await expect(service.verifyReview({ reviewId: 99, isVerified: true })).rejects.toMatchObject({
        statusCode: 404,
      });
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
});
