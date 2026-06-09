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

// -------- From: reviews-service.edge-cases.test.js --------
// Tests bổ sung cho ReviewsService — phủ các nhánh còn thiếu:
//   - getUserReviews: pagination + kết quả rỗng
//   - getAllReviews: filter verified + pagination
//   - _refreshProductRating với includeCount=false (updateReview path)

describe('ReviewsService — edge cases', () => {
  function makeRepo() {
    return {
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
      getProductRatingsAggregate: jest.fn().mockResolvedValue({ avg: 4.0, count: 5 }),
      updateProductRating: jest.fn().mockResolvedValue(),
      runInTransaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
      findFeedback: jest.fn(),
      createFeedback: jest.fn().mockResolvedValue(),
      saveFeedback: jest.fn((f) => Promise.resolve(f)),
      incrementReview: jest.fn().mockResolvedValue(),
      decrementReview: jest.fn().mockResolvedValue(),
    };
  }

  function makeService(repo) {
    return new ReviewsService({
      reviewsRepository: repo,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  }

  describe('ReviewsService — getUserReviews', () => {
    let reviewsRepository;
    let service;

    beforeEach(() => {
      reviewsRepository = makeRepo();
      service = makeService(reviewsRepository);
    });

    test('trả về pagination đúng', async () => {
      const rows = [
        { id: 1, rating: 5 },
        { id: 2, rating: 4 },
      ];
      reviewsRepository.findUserReviews.mockResolvedValue({ count: 2, rows });

      const result = await service.getUserReviews({ userId: 1, page: 1, limit: 10 });

      expect(result).toEqual({
        total: 2,
        pages: 1,
        currentPage: 1,
        reviews: rows,
      });
    });

    test('gọi findUserReviews với đúng userId, limit, offset', async () => {
      reviewsRepository.findUserReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getUserReviews({ userId: 5, page: 3, limit: 5 });

      expect(reviewsRepository.findUserReviews).toHaveBeenCalledWith(5, {
        limit: 5,
        offset: 10, // (3-1) * 5
      });
    });

    test('page/limit là string → parse đúng', async () => {
      reviewsRepository.findUserReviews.mockResolvedValue({ count: 0, rows: [] });

      const result = await service.getUserReviews({ userId: 1, page: '2', limit: '8' });

      expect(result.currentPage).toBe(2);
      expect(reviewsRepository.findUserReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ limit: 8, offset: 8 }),
      );
    });

    test('nhiều trang → pages tính đúng', async () => {
      reviewsRepository.findUserReviews.mockResolvedValue({ count: 25, rows: [] });

      const result = await service.getUserReviews({ userId: 1, page: 1, limit: 10 });

      expect(result.pages).toBe(3); // ceil(25/10)
      expect(result.total).toBe(25);
    });

    test('kết quả rỗng → reviews=[], total=0, pages=0', async () => {
      reviewsRepository.findUserReviews.mockResolvedValue({ count: 0, rows: [] });

      const result = await service.getUserReviews({ userId: 99, page: 1, limit: 10 });

      expect(result.reviews).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.pages).toBe(0); // ceil(0/10)
    });

    test('page mặc định 1, limit mặc định 10', async () => {
      reviewsRepository.findUserReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getUserReviews({ userId: 1 });

      expect(reviewsRepository.findUserReviews).toHaveBeenCalledWith(1, { limit: 10, offset: 0 });
    });
  });

  describe('ReviewsService — getAllReviews', () => {
    let reviewsRepository;
    let service;

    beforeEach(() => {
      reviewsRepository = makeRepo();
      service = makeService(reviewsRepository);
    });

    test('không filter → whereConditions rỗng', async () => {
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllReviews({ page: 1, limit: 10 });

      expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({ whereConditions: {} }),
      );
    });

    test('verified="true" → whereConditions.isVerified=true', async () => {
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 5, rows: [] });

      await service.getAllReviews({ page: 1, limit: 10, verified: 'true' });

      expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({
          whereConditions: { isVerified: true },
        }),
      );
    });

    test('verified="false" → whereConditions.isVerified=false', async () => {
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 2, rows: [] });

      await service.getAllReviews({ page: 1, limit: 10, verified: 'false' });

      expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({
          whereConditions: { isVerified: false },
        }),
      );
    });

    test('verified undefined → KHÔNG thêm isVerified vào whereConditions', async () => {
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllReviews({ page: 1, limit: 10, verified: undefined });

      expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({ whereConditions: {} }),
      );
    });

    test('trả về pagination đúng', async () => {
      const rows = [{ id: 3, rating: 3 }];
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 1, rows });

      const result = await service.getAllReviews({ page: 1, limit: 10 });

      expect(result.total).toBe(1);
      expect(result.pages).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.reviews).toBe(rows);
    });

    test('gọi findAllReviews với đúng limit và offset', async () => {
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllReviews({ page: 2, limit: 5 });

      expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 5, offset: 5 }),
      );
    });

    test('page mặc định 1, limit mặc định 10', async () => {
      reviewsRepository.findAllReviews.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllReviews({});

      expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 0 }),
      );
      const call = reviewsRepository.findAllReviews.mock.calls[0][0];
      expect(call.offset).toBe(0); // (1-1) * 10
    });
  });

  describe('ReviewsService — _refreshProductRating (includeCount=false)', () => {
    let reviewsRepository;
    let service;

    beforeEach(() => {
      reviewsRepository = makeRepo();
      service = makeService(reviewsRepository);
    });

    test('updateReview gọi _refreshProductRating với includeCount=false → updateProductRating chỉ nhận avg', async () => {
      const review = {
        id: 1,
        rating: 4,
        title: 'T',
        content: 'C',
        images: [],
        isVerified: false,
        productId: 7,
      };
      reviewsRepository.findReviewByIdAndUserId.mockResolvedValue(review);
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue(review);

      await service.updateReview({ userId: 1, reviewId: 1, patch: { rating: 5 } });

      // updateReview gọi _refreshProductRating(productId, false) → updateProductRating(id, avg) — bỏ qua count
      expect(reviewsRepository.updateProductRating).toHaveBeenCalledWith(7, 4.0);
      expect(reviewsRepository.updateProductRating).toHaveBeenCalledTimes(1);
    });

    test('createReview gọi _refreshProductRating với includeCount=true → updateProductRating nhận avg và count', async () => {
      reviewsRepository.findProductById.mockResolvedValue({ id: 1 });
      reviewsRepository.hasUserPurchasedProduct.mockResolvedValue(true);
      reviewsRepository.findReviewByUserAndProduct.mockResolvedValue(null);
      reviewsRepository.createReview.mockResolvedValue({ id: 10 });
      reviewsRepository.findReviewByPkWithUser.mockResolvedValue({ id: 10 });

      await service.createReview({ userId: 1, productId: 1, rating: 5, title: 'T', comment: 'C' });

      // createReview gọi _refreshProductRating(productId, true) → updateProductRating(id, avg, count)
      expect(reviewsRepository.updateProductRating).toHaveBeenCalledWith(1, 4.0, 5);
    });
  });
});

// -------- From: reviews-service.unit.test.js --------

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
      runInTransaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
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
        expect.objectContaining({ transaction: expect.anything() }),
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
      expect(reviewsRepository.saveReview).toHaveBeenCalledWith(
        existing,
        expect.objectContaining({ transaction: expect.anything() }),
      );
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
