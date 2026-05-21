// Unit tests cho SequelizeReviewsRepository
// Mock toàn bộ Sequelize models — không chạm DB
const SequelizeReviewsRepository = require('./sequelize-reviews-repository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findAndCountAll: jest
      .fn()
      .mockResolvedValue(defaults.findAndCountAll ?? { count: 0, rows: [] }),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    update: jest.fn().mockResolvedValue([1]),
  };
}

function makeInstanceWith(extra = {}) {
  return {
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    increment: jest.fn().mockResolvedValue(true),
    decrement: jest.fn().mockResolvedValue(true),
    ...extra,
  };
}

function makeRepo(overrides = {}) {
  const deps = {
    Review: makeModel(),
    Product: makeModel(),
    User: makeModel(),
    Order: makeModel(),
    OrderItem: makeModel(),
    ...overrides,
  };
  return { repo: new SequelizeReviewsRepository(deps), deps };
}

// ════════════════════════════════════════════════════════════════════════════
// Review CRUD
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeReviewsRepository — Review CRUD', () => {
  test('findReviewByPk — gọi Review.findByPk với id đúng', async () => {
    const mockReview = { id: 5, rating: 4 };
    const { repo, deps } = makeRepo({ Review: makeModel({ findByPk: mockReview }) });

    const result = await repo.findReviewByPk(5);

    expect(deps.Review.findByPk).toHaveBeenCalledWith(5);
    expect(result).toBe(mockReview);
  });

  test('findReviewByIdAndUserId — gọi findOne với where {id, userId}', async () => {
    const mockReview = { id: 3, userId: 7 };
    const { repo, deps } = makeRepo({ Review: makeModel({ findOne: mockReview }) });

    const result = await repo.findReviewByIdAndUserId(3, 7);

    expect(deps.Review.findOne).toHaveBeenCalledWith({ where: { id: 3, userId: 7 } });
    expect(result).toBe(mockReview);
  });

  test('findReviewByUserAndProduct — gọi findOne với where {userId, productId}', async () => {
    const { repo, deps } = makeRepo();
    await repo.findReviewByUserAndProduct(2, 9);

    expect(deps.Review.findOne).toHaveBeenCalledWith({ where: { userId: 2, productId: 9 } });
  });

  test('findReviewByPkWithUser — gọi findByPk với include User', async () => {
    const { repo, deps } = makeRepo();
    await repo.findReviewByPkWithUser(10);

    expect(deps.Review.findByPk).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        include: expect.arrayContaining([expect.objectContaining({ as: 'user' })]),
      }),
    );
  });

  test('findProductReviews — gọi findAndCountAll với productId và options', async () => {
    const mockResult = { count: 2, rows: [{ id: 1 }, { id: 2 }] };
    const { repo, deps } = makeRepo({ Review: makeModel({ findAndCountAll: mockResult }) });

    const result = await repo.findProductReviews(42, {
      whereClause: { rating: 5 },
      limit: 10,
      offset: 0,
      sortColumn: 'createdAt',
      sortOrder: 'DESC',
    });

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ productId: 42, rating: 5 }),
        limit: 10,
        offset: 0,
      }),
    );
    expect(result).toBe(mockResult);
  });

  test('findUserReviews — gọi findAndCountAll với userId và include Product', async () => {
    const { repo, deps } = makeRepo();
    await repo.findUserReviews(5, { limit: 5, offset: 0 });

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5 },
        limit: 5,
        offset: 0,
      }),
    );
  });

  test('findAllReviews — gọi findAndCountAll với include User và Product', async () => {
    const { repo, deps } = makeRepo();
    await repo.findAllReviews({ whereConditions: { rating: { $gte: 3 } }, limit: 20, offset: 0 });

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ rating: { $gte: 3 } }),
        limit: 20,
      }),
    );
  });

  test('createReview — gọi Review.create với payload', async () => {
    const payload = { userId: 1, productId: 2, rating: 5, comment: 'Tốt lắm' };
    const created = { id: 99, ...payload };
    const { repo, deps } = makeRepo({ Review: makeModel({ create: created }) });

    const result = await repo.createReview(payload);

    expect(deps.Review.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(created);
  });

  test('saveReview — gọi review.save()', async () => {
    const { repo } = makeRepo();
    const review = makeInstanceWith();

    await repo.saveReview(review);

    expect(review.save).toHaveBeenCalledTimes(1);
  });

  test('deleteReview — gọi review.destroy()', async () => {
    const { repo } = makeRepo();
    const review = makeInstanceWith();

    await repo.deleteReview(review);

    expect(review.destroy).toHaveBeenCalledTimes(1);
  });

  test('incrementReview — gọi review.increment(field)', async () => {
    const { repo } = makeRepo();
    const review = makeInstanceWith();

    await repo.incrementReview(review, 'helpfulCount');

    expect(review.increment).toHaveBeenCalledWith('helpfulCount');
  });

  test('decrementReview — gọi review.decrement(field)', async () => {
    const { repo } = makeRepo();
    const review = makeInstanceWith();

    await repo.decrementReview(review, 'helpfulCount');

    expect(review.decrement).toHaveBeenCalledWith('helpfulCount');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Product methods
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeReviewsRepository — Product', () => {
  test('findProductById — gọi Product.findByPk với id', async () => {
    const mockProd = { id: 7, name: 'Giày Nike' };
    const { repo, deps } = makeRepo({ Product: makeModel({ findByPk: mockProd }) });

    const result = await repo.findProductById(7);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(7);
    expect(result).toBe(mockProd);
  });

  test('getProductRatingsAggregate — tính avg và count đúng từ danh sách ratings', async () => {
    const reviews = [{ rating: 4 }, { rating: 5 }, { rating: 3 }];
    const { repo, deps } = makeRepo({ Review: makeModel({ findAll: reviews }) });

    const result = await repo.getProductRatingsAggregate(1);

    expect(deps.Review.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 1 }, attributes: ['rating'] }),
    );
    expect(result.count).toBe(3);
    expect(result.avg).toBeCloseTo(4, 5);
  });

  test('getProductRatingsAggregate — trả về {avg: 0, count: 0} khi không có review', async () => {
    const { repo } = makeRepo({ Review: makeModel({ findAll: [] }) });

    const result = await repo.getProductRatingsAggregate(999);

    expect(result).toEqual({ avg: 0, count: 0 });
  });

  test('updateProductRating — gọi Product.update với rating và reviewCount khi count được cung cấp', async () => {
    const { repo, deps } = makeRepo();
    await repo.updateProductRating(5, 4.5, 10);

    expect(deps.Product.update).toHaveBeenCalledWith(
      { rating: 4.5, reviewCount: 10 },
      { where: { id: 5 } },
    );
  });

  test('updateProductRating — gọi Product.update chỉ với rating khi count = undefined', async () => {
    const { repo, deps } = makeRepo();
    await repo.updateProductRating(5, 4.5);

    expect(deps.Product.update).toHaveBeenCalledWith({ rating: 4.5 }, { where: { id: 5 } });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Purchase verification
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeReviewsRepository — Purchase verification', () => {
  test('hasUserPurchasedProduct — trả true khi tìm thấy delivered order với sản phẩm', async () => {
    const mockOrder = { id: 1, userId: 2, status: 'delivered' };
    const { repo, deps } = makeRepo({ Order: makeModel({ findOne: mockOrder }) });

    const result = await repo.hasUserPurchasedProduct(2, 10);

    expect(deps.Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 2, status: 'delivered' }),
      }),
    );
    expect(result).toBe(true);
  });

  test('hasUserPurchasedProduct — trả false khi không tìm thấy order', async () => {
    const { repo } = makeRepo({ Order: makeModel({ findOne: null }) });

    const result = await repo.hasUserPurchasedProduct(2, 999);

    expect(result).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Default parameter branches (lines 39-63)
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeReviewsRepository — default parameter branches', () => {
  test('findProductReviews — dùng whereClause rỗng và limit/offset/sort undefined khi không truyền options', async () => {
    // Branch: { whereClause = {}, limit, offset, sortColumn, sortOrder } = {}
    // → các giá trị = undefined/default khi không truyền options
    const { repo, deps } = makeRepo();
    deps.Review.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findProductReviews(10);

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 10 },
        limit: undefined,
        offset: undefined,
      }),
    );
  });

  test('findProductReviews — whereClause rỗng (default {}) không thêm điều kiện phụ vào where', async () => {
    // Branch: whereClause = {} (default) → spread rỗng vào where
    const { repo, deps } = makeRepo();
    deps.Review.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findProductReviews(15, {
      limit: 5,
      offset: 0,
      sortColumn: 'createdAt',
      sortOrder: 'ASC',
    });

    // where chỉ chứa productId (không có rating hay điều kiện khác)
    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { productId: 15 },
      }),
    );
  });

  test('findUserReviews — dùng limit/offset undefined khi không truyền options', async () => {
    // Branch: { limit, offset } = {} → limit = undefined, offset = undefined
    const { repo, deps } = makeRepo();
    deps.Review.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findUserReviews(3);

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 3 },
        limit: undefined,
        offset: undefined,
      }),
    );
  });

  test('findAllReviews — dùng whereConditions rỗng và limit/offset undefined khi không truyền options', async () => {
    // Branch: { whereConditions = {}, limit, offset } = {} → defaults
    const { repo, deps } = makeRepo();
    deps.Review.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findAllReviews();

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        limit: undefined,
        offset: undefined,
      }),
    );
  });

  test('findAllReviews — whereConditions rỗng (default) khi chỉ truyền limit/offset', async () => {
    // Branch: whereConditions = {} (default)
    const { repo, deps } = makeRepo();
    deps.Review.findAndCountAll.mockResolvedValue({ count: 5, rows: [] });

    await repo.findAllReviews({ limit: 10, offset: 0 });

    expect(deps.Review.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        limit: 10,
        offset: 0,
      }),
    );
  });
});
