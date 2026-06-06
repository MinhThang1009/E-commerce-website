// Reviews service — mutation-kill: assert OUTCOME (i18n message, sort mapping,
// whereClause filter, includeCount branch, patch chỉ-khi-defined, images||[],
// verifyReview ternary). KHÔNG tautological.

const ReviewsService = require('./reviews-service');

function makeRepo(overrides = {}) {
  return {
    findProductById: jest.fn().mockResolvedValue({ id: 1 }),
    hasUserPurchasedProduct: jest.fn().mockResolvedValue(true),
    findReviewByUserAndProduct: jest.fn().mockResolvedValue(null),
    findReviewByIdAndUserId: jest.fn(),
    findReviewByPk: jest.fn(),
    findReviewByPkWithUser: jest.fn().mockResolvedValue({ id: 5 }),
    findProductReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findUserReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findAllReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    createReview: jest.fn().mockResolvedValue({ id: 5 }),
    saveReview: jest.fn((r) => Promise.resolve(r)),
    deleteReview: jest.fn().mockResolvedValue(),
    getProductRatingsAggregate: jest.fn().mockResolvedValue({ avg: 4.5, count: 10 }),
    updateProductRating: jest.fn().mockResolvedValue(),
    runInTransaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
    ...overrides,
  };
}

function makeService(repo) {
  return new ReviewsService({
    reviewsRepository: repo,
    eventBus: { publish: jest.fn() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });
}

describe('ReviewsService — mutation kill', () => {
  // ── _refreshProductRating: includeCount branch + return ────────
  describe('_refreshProductRating', () => {
    test('includeCount=true → updateProductRating(id, avg, count) [3 args] + return {avg,count}', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      const result = await service._refreshProductRating(7, true);

      expect(repo.updateProductRating).toHaveBeenCalledWith(7, 4.5, 10);
      expect(result).toEqual({ avg: 4.5, count: 10 });
    });

    test('includeCount=false → updateProductRating(id, avg) [2 args, KHÔNG count]', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service._refreshProductRating(7, false);

      expect(repo.updateProductRating).toHaveBeenCalledWith(7, 4.5);
      expect(repo.updateProductRating).not.toHaveBeenCalledWith(7, 4.5, 10);
    });
  });

  // ── createReview: message + upsert images + refresh count ──────
  describe('createReview', () => {
    test('product không tồn tại → 404 reviews.productNotFound (L36)', async () => {
      const repo = makeRepo({ findProductById: jest.fn().mockResolvedValue(null) });
      const service = makeService(repo);
      await expect(service.createReview({ userId: 1, productId: 99, rating: 5 })).rejects.toThrow(
        'reviews.productNotFound',
      );
    });

    test('chưa mua → 403 reviews.purchaseRequired (L41)', async () => {
      const repo = makeRepo({ hasUserPurchasedProduct: jest.fn().mockResolvedValue(false) });
      const service = makeService(repo);
      await expect(service.createReview({ userId: 1, productId: 1, rating: 5 })).rejects.toThrow(
        'reviews.purchaseRequired',
      );
    });

    test('review mới → createReview với content/isVerified + refresh count (3 args)', async () => {
      const repo = makeRepo();
      repo.createReview.mockResolvedValue({ id: 5 });
      const service = makeService(repo);

      const result = await service.createReview({
        userId: 1,
        productId: 1,
        rating: 4,
        title: 't',
        comment: 'nội dung',
        images: ['a.jpg'],
      });

      expect(repo.createReview).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 1,
          userId: 1,
          rating: 4,
          content: 'nội dung',
          images: ['a.jpg'],
          isVerified: true,
        }),
        expect.objectContaining({ transaction: expect.anything() }),
      );
      expect(repo.updateProductRating).toHaveBeenCalledWith(1, 4.5, 10); // includeCount true
      expect(result.review).toEqual({ id: 5 });
    });

    test('review đã tồn tại → Object.assign cập nhật + saveReview (upsert)', async () => {
      const existing = { id: 8, rating: 1, content: 'cũ' };
      const repo = makeRepo({
        findReviewByUserAndProduct: jest.fn().mockResolvedValue(existing),
      });
      const service = makeService(repo);

      await service.createReview({
        userId: 1,
        productId: 1,
        rating: 5,
        title: 'mới',
        comment: 'nội dung mới',
        images: ['b.jpg'],
      });

      expect(existing.rating).toBe(5);
      expect(existing.content).toBe('nội dung mới');
      expect(existing.images).toEqual(['b.jpg']);
      expect(existing.isVerified).toBe(true);
      expect(repo.saveReview).toHaveBeenCalledWith(
        existing,
        expect.objectContaining({ transaction: expect.anything() }),
      );
      expect(repo.createReview).not.toHaveBeenCalled();
    });

    test('images undefined → images = [] (kill L52 images||[])', async () => {
      const existing = { id: 8 };
      const repo = makeRepo({
        findReviewByUserAndProduct: jest.fn().mockResolvedValue(existing),
      });
      const service = makeService(repo);

      await service.createReview({ userId: 1, productId: 1, rating: 5, comment: 'c' });

      expect(existing.images).toEqual([]); // mutant ||→&& cho [], cond→true/false cho true/false
    });
  });

  // ── updateReview: message + patch chỉ-khi-defined + count=false ─
  describe('updateReview', () => {
    test('không tìm thấy (hoặc không owner) → 404 reviews.notFound (L77)', async () => {
      const repo = makeRepo({ findReviewByIdAndUserId: jest.fn().mockResolvedValue(null) });
      const service = makeService(repo);
      await expect(
        service.updateReview({ userId: 1, reviewId: 5, patch: { rating: 5 } }),
      ).rejects.toThrow('reviews.notFound');
    });

    test('patch chỉ có rating → CHỈ rating đổi, title/content/images GIỮ NGUYÊN (L81 conditionals)', async () => {
      const review = {
        id: 5,
        productId: 3,
        rating: 1,
        title: 'titleCũ',
        content: 'contentCũ',
        images: ['old.jpg'],
      };
      const repo = makeRepo({
        findReviewByIdAndUserId: jest.fn().mockResolvedValue(review),
        findReviewByPkWithUser: jest.fn().mockResolvedValue({ id: 5 }),
      });
      const service = makeService(repo);

      await service.updateReview({ userId: 1, reviewId: 5, patch: { rating: 4 } });

      expect(review.rating).toBe(4);
      expect(review.title).toBe('titleCũ'); // mutant if→true sẽ set undefined
      expect(review.content).toBe('contentCũ');
      expect(review.images).toEqual(['old.jpg']);
      expect(review.isVerified).toBe(true);
    });

    test('patch comment → map sang review.content', async () => {
      const review = { id: 5, productId: 3, content: 'cũ' };
      const repo = makeRepo({
        findReviewByIdAndUserId: jest.fn().mockResolvedValue(review),
        findReviewByPkWithUser: jest.fn().mockResolvedValue({ id: 5 }),
      });
      const service = makeService(repo);

      await service.updateReview({ userId: 1, reviewId: 5, patch: { comment: 'mới' } });

      expect(review.content).toBe('mới');
    });

    test('refresh KHÔNG kèm count (includeCount=false) + return {review: updated}', async () => {
      const review = { id: 5, productId: 3 };
      const repo = makeRepo({
        findReviewByIdAndUserId: jest.fn().mockResolvedValue(review),
        findReviewByPkWithUser: jest.fn().mockResolvedValue({ id: 5, reloaded: true }),
      });
      const service = makeService(repo);

      const result = await service.updateReview({ userId: 1, reviewId: 5, patch: { rating: 4 } });

      expect(repo.updateProductRating).toHaveBeenCalledWith(3, 4.5); // KHÔNG count
      expect(result).toEqual({ review: { id: 5, reloaded: true } });
    });
  });

  // ── deleteReview: message + refresh count ──────────────────────
  describe('deleteReview', () => {
    test('không tìm thấy → 404 reviews.notFound (L97)', async () => {
      const repo = makeRepo({ findReviewByIdAndUserId: jest.fn().mockResolvedValue(null) });
      const service = makeService(repo);
      await expect(service.deleteReview({ userId: 1, reviewId: 5 })).rejects.toThrow(
        'reviews.notFound',
      );
    });

    test('xóa → deleteReview + refresh count (3 args) + message reviews.deleted', async () => {
      const review = { id: 5, productId: 3 };
      const repo = makeRepo({ findReviewByIdAndUserId: jest.fn().mockResolvedValue(review) });
      const service = makeService(repo);

      const result = await service.deleteReview({ userId: 1, reviewId: 5 });

      expect(repo.deleteReview).toHaveBeenCalledWith(review);
      expect(repo.updateProductRating).toHaveBeenCalledWith(3, 4.5, 10);
      expect(result.message).toBe('reviews.deleted');
    });
  });

  // ── getProductReviews: 404 + sort mapping + whereClause filter ─
  describe('getProductReviews', () => {
    test('product không tồn tại → 404 reviews.productNotFound (L118)', async () => {
      const repo = makeRepo({ findProductById: jest.fn().mockResolvedValue(null) });
      const service = makeService(repo);
      await expect(service.getProductReviews({ productId: 99 })).rejects.toThrow(
        'reviews.productNotFound',
      );
    });

    test.each([
      ['newest', 'createdAt', 'DESC'],
      ['oldest', 'createdAt', 'ASC'],
      ['highest_rating', 'rating', 'DESC'],
      ['lowest_rating', 'rating', 'ASC'],
    ])(
      'sort=%s → repo nhận sortColumn=%s sortOrder=%s (L109/110/112)',
      async (sort, col, order) => {
        const repo = makeRepo();
        const service = makeService(repo);

        await service.getProductReviews({ productId: 1, sort });

        expect(repo.findProductReviews).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ sortColumn: col, sortOrder: order }),
        );
      },
    );

    test('sort không hợp lệ → fallback createdAt DESC', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.getProductReviews({ productId: 1, sort: 'invalid_xyz' });

      expect(repo.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ sortColumn: 'createdAt', sortOrder: 'DESC' }),
      );
    });

    test('filter rating → whereClause.rating = parseInt (L122)', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.getProductReviews({ productId: 1, rating: '5' });

      expect(repo.findProductReviews).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ whereClause: { rating: 5 } }),
      );
    });

    test('KHÔNG filter rating → whereClause KHÔNG có rating (kill cond→true)', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.getProductReviews({ productId: 1 });

      const arg = repo.findProductReviews.mock.calls[0][1];
      expect(arg.whereClause).not.toHaveProperty('rating');
    });

    test('verified="true" → isVerified=true ; verified="false" → isVerified=false (L123)', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.getProductReviews({ productId: 1, verified: 'true' });
      expect(repo.findProductReviews.mock.calls[0][1].whereClause).toEqual({ isVerified: true });

      repo.findProductReviews.mockClear();
      await service.getProductReviews({ productId: 1, verified: 'false' });
      expect(repo.findProductReviews.mock.calls[0][1].whereClause).toEqual({ isVerified: false });
    });

    test('KHÔNG truyền verified → whereClause KHÔNG có isVerified', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.getProductReviews({ productId: 1 });

      expect(repo.findProductReviews.mock.calls[0][1].whereClause).not.toHaveProperty('isVerified');
    });

    test('pagination: total/pages/currentPage đúng', async () => {
      const repo = makeRepo({
        findProductReviews: jest.fn().mockResolvedValue({ count: 25, rows: [{ id: 1 }] }),
      });
      const service = makeService(repo);

      const result = await service.getProductReviews({ productId: 1, page: '2', limit: '10' });

      expect(result.total).toBe(25);
      expect(result.pages).toBe(3); // ceil(25/10)
      expect(result.currentPage).toBe(2);
      expect(repo.findProductReviews.mock.calls[0][1].offset).toBe(10); // (2-1)*10
    });
  });

  // ── getAllReviews: verified filter ─────────────────────────────
  describe('getAllReviews', () => {
    test('verified="true" → whereConditions.isVerified=true', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await service.getAllReviews({ verified: 'true' });

      expect(repo.findAllReviews.mock.calls[0][0].whereConditions).toEqual({ isVerified: true });
    });
  });

  // ── verifyReview: message ternary + data shape ─────────────────
  describe('verifyReview', () => {
    test('không tìm thấy → 404 reviews.notFound (L176)', async () => {
      const repo = makeRepo({ findReviewByPk: jest.fn().mockResolvedValue(null) });
      const service = makeService(repo);
      await expect(service.verifyReview({ reviewId: 5, isVerified: true })).rejects.toThrow(
        'reviews.notFound',
      );
    });

    test('isVerified=true → message reviews.verified + data', async () => {
      const review = { id: 5, isVerified: false };
      const repo = makeRepo({ findReviewByPk: jest.fn().mockResolvedValue(review) });
      const service = makeService(repo);

      const result = await service.verifyReview({ reviewId: 5, isVerified: true });

      expect(review.isVerified).toBe(true);
      expect(repo.saveReview).toHaveBeenCalledWith(review);
      expect(result.message).toBe('reviews.verified');
      expect(result.data).toEqual({ id: 5, isVerified: true });
    });

    test('isVerified=false → message reviews.rejected', async () => {
      const review = { id: 5, isVerified: true };
      const repo = makeRepo({ findReviewByPk: jest.fn().mockResolvedValue(review) });
      const service = makeService(repo);

      const result = await service.verifyReview({ reviewId: 5, isVerified: false });

      expect(result.message).toBe('reviews.rejected');
      expect(result.data).toEqual({ id: 5, isVerified: false });
    });
  });
});
