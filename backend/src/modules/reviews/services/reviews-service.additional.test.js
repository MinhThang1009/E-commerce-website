// Tests bổ sung cho ReviewsService — phủ các nhánh còn thiếu:
//   - getUserReviews: pagination + kết quả rỗng
//   - getAllReviews: filter verified + pagination
//   - _refreshProductRating với includeCount=false (updateReview path)

const ReviewsService = require('./reviews-service');

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
    const rows = [{ id: 1, rating: 5 }, { id: 2, rating: 4 }];
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
      expect.objectContaining({ limit: 8, offset: 8 })
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

    expect(reviewsRepository.findUserReviews).toHaveBeenCalledWith(
      1,
      { limit: 10, offset: 0 }
    );
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
      expect.objectContaining({ whereConditions: {} })
    );
  });

  test('verified="true" → whereConditions.isVerified=true', async () => {
    reviewsRepository.findAllReviews.mockResolvedValue({ count: 5, rows: [] });

    await service.getAllReviews({ page: 1, limit: 10, verified: 'true' });

    expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        whereConditions: { isVerified: true },
      })
    );
  });

  test('verified="false" → whereConditions.isVerified=false', async () => {
    reviewsRepository.findAllReviews.mockResolvedValue({ count: 2, rows: [] });

    await service.getAllReviews({ page: 1, limit: 10, verified: 'false' });

    expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
      expect.objectContaining({
        whereConditions: { isVerified: false },
      })
    );
  });

  test('verified undefined → KHÔNG thêm isVerified vào whereConditions', async () => {
    reviewsRepository.findAllReviews.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllReviews({ page: 1, limit: 10, verified: undefined });

    expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
      expect.objectContaining({ whereConditions: {} })
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
      expect.objectContaining({ limit: 5, offset: 5 })
    );
  });

  test('page mặc định 1, limit mặc định 10', async () => {
    reviewsRepository.findAllReviews.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllReviews({});

    expect(reviewsRepository.findAllReviews).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 })
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
    const review = { id: 1, rating: 4, title: 'T', content: 'C', images: [], isVerified: false, productId: 7 };
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
