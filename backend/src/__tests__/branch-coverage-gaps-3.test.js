/**
 * Branch coverage gaps — batch 3. Fix các branch batch 1 chưa cover đúng.
 */
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_r, _s, n) => n(),
  apiLimiter: (_r, _s, n) => n(),
  authLimiter: (_r, _s, n) => n(),
  otpLimiter: (_r, _s, n) => n(),
}));

const logger = require('@utils/logger');

// ═══════════════════════════════════════════════════════════════════════════════
// ai-controller: L25 (handleMessage statusCode >= 500 → 'error' level)
// ═══════════════════════════════════════════════════════════════════════════════
describe('ai-controller: handleMessage error branches (L25)', () => {
  const AIController = require('@modules/ai/controllers/ai-controller');

  test('handleMessage: statusCode >= 500 → logger.error (L25 else)', async () => {
    const err500 = new Error('internal');
    err500.statusCode = 500;
    const ctrl = new AIController({
      aiService: { handleMessage: jest.fn().mockRejectedValue(err500) },
      logger,
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await ctrl.handleMessage(
      { body: { message: 'hi', sessionId: 's1' }, user: null, locale: 'vi' },
      res,
      jest.fn(),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Chatbot error:',
      expect.objectContaining({ statusCode: 500 }),
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('handleMessage: statusCode < 500 → logger.warn (L25 if)', async () => {
    const err400 = new Error('bad');
    err400.statusCode = 400;
    const ctrl = new AIController({
      aiService: { handleMessage: jest.fn().mockRejectedValue(err400) },
      logger,
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await ctrl.handleMessage(
      { body: { message: 'hi', sessionId: 's1' }, user: null, locale: 'vi' },
      res,
      jest.fn(),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Chatbot error:',
      expect.objectContaining({ statusCode: 400 }),
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ai-repo: L96-102 (default variant out of stock), L126-140 (existing cart item + stock)
// KHÁC batch 1 — mock Cart/CartItem đúng qua require('@models')
// ═══════════════════════════════════════════════════════════════════════════════
describe('ai-repo addToCart deep branches', () => {
  const AIRepo = require('@modules/ai/repositories/sequelize-ai-repository');
  const models = require('@models');
  let repo;

  beforeEach(() => {
    repo = new AIRepo({
      Product: { findByPk: jest.fn() },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // L96-102: !variantId → resolve default → variant data stockQuantity=0 → throw
  test('addToCart: default variant resolved, stock=0 → throw defaultVariantOutOfStock (L102)', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [
        { id: 10, stockQuantity: 5 },
        { id: 20, stockQuantity: 0 },
      ],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 20, price: 100 });

    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  // L131-135: existing cart item + variant + quantity exceeds stock → throw
  test('addToCart: existing item + variant stock exceeded → throw cartQuantityExceedsStock (L135)', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 3 }],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: 100 });
    repo.ProductVariant.findByPk.mockResolvedValue({ price: 100 });

    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue({ quantity: 2, update: jest.fn() });

    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 2 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  // L136-138: no variant, existing item, product stock exceeded → throw
  test('addToCart: no variant + existing item + product stock exceeded → throw (L138)', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 3,
      variants: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);

    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue({ quantity: 2, update: jest.fn() });

    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 2 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  // L140: existing item → update quantity (happy path, covers the update branch)
  test('addToCart: existing item + stock OK → update quantity (L140)', async () => {
    const updateFn = jest.fn().mockResolvedValue({ quantity: 3 });
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [{ id: 10, stockQuantity: 10 }],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, price: 100 });
    repo.ProductVariant.findByPk.mockResolvedValue({ price: 100 });

    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue({ quantity: 2, update: updateFn });

    await repo.addToCart({ userId: 1, productId: 1, quantity: 1 });
    expect(updateFn).toHaveBeenCalledWith({ quantity: 3 }, expect.any(Object));
  });

  // L142-145: no existing item → CartItem.create (happy path)
  test('addToCart: no existing item → CartItem.create (L142)', async () => {
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 10,
      variants: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue(null);

    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest.spyOn(models.CartItem, 'findOne').mockResolvedValue(null);
    jest.spyOn(models.CartItem, 'create').mockResolvedValue({ id: 1 });

    const result = await repo.addToCart({ userId: 1, productId: 1, quantity: 1 });
    expect(models.CartItem.create).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ai-repo: createAnalyticsEvent (L28 userId branch), addToCart variantId branches
// ═══════════════════════════════════════════════════════════════════════════════
describe('ai-repo extra branches', () => {
  const AIRepo = require('@modules/ai/repositories/sequelize-ai-repository');
  const models = require('@models');

  afterEach(() => jest.restoreAllMocks());

  // L28: createAnalyticsEvent — userId truthy vs falsy
  test('createAnalyticsEvent: userId truthy (L28 left branch)', async () => {
    jest.spyOn(models.ChatMessage, 'create').mockResolvedValue({ id: 1 });
    const repo = new AIRepo({ Product: {}, ProductVariant: {}, Category: {}, sequelize: {} });
    await repo.createAnalyticsEvent({ event: 'view', userId: 42, sessionId: 's1', productId: 1 });
    expect(models.ChatMessage.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 42 }));
  });

  test('createAnalyticsEvent: userId falsy → null (L28 right branch)', async () => {
    jest.spyOn(models.ChatMessage, 'create').mockResolvedValue({ id: 1 });
    const repo = new AIRepo({ Product: {}, ProductVariant: {}, Category: {}, sequelize: {} });
    await repo.createAnalyticsEvent({ event: 'view', userId: null, sessionId: 's1', productId: 1 });
    expect(models.ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  // L75-79: addToCart with explicit variantId
  test('addToCart: explicit variantId → variant not found → throw (L78)', async () => {
    const repo = new AIRepo({
      Product: {
        findByPk: jest.fn().mockResolvedValue({
          id: 1,
          status: 'active',
          stockQuantity: 10,
          variants: [{ id: 10, stockQuantity: 5 }],
        }),
      },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 99, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('addToCart: explicit variantId → variant stock=0 → throw variantOutOfStock (L79)', async () => {
    const repo = new AIRepo({
      Product: {
        findByPk: jest.fn().mockResolvedValue({
          id: 1,
          status: 'active',
          stockQuantity: 10,
          variants: [
            { id: 10, stockQuantity: 0 },
            { id: 20, stockQuantity: 5 },
          ],
        }),
      },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 10, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // L75: product.variants null + explicit variantId → || [] fallback → not found
  test('addToCart: product.variants null + variantId → || [] at L75 → throw variantNotFound', async () => {
    const repo = new AIRepo({
      Product: {
        findByPk: jest.fn().mockResolvedValue({
          id: 1,
          status: 'active',
          stockQuantity: 10,
          variants: null,
        }),
      },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 99, quantity: 1 }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  // L98: product.variants null → || [] fallback
  test('addToCart: product.variants null → || [] fallback at resolve (L98)', async () => {
    const repo = new AIRepo({
      Product: {
        findByPk: jest.fn().mockResolvedValue({
          id: 1,
          status: 'active',
          stockQuantity: 10,
          variants: null,
        }),
      },
      ProductVariant: {
        findByPk: jest.fn(),
        findOne: jest.fn().mockResolvedValue({ id: 10, price: 100 }),
      },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
    // variants=null → totalStock=0 (reduce on []), variants.length=0 → L72 checks product.stockQuantity=10>0
    // !resolvedVariantId=true → enters resolve, findOne returns variant
    // L98: (product.variants || []).find(...) → [].find() → undefined → !resolvedVariantData=true → throw
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  // L128: product.variants null → || [] fallback in existing item path
  test('addToCart: existing item + product.variants null → || [] fallback (L128)', async () => {
    const repo = new AIRepo({
      Product: {
        findByPk: jest.fn().mockResolvedValue({
          id: 1,
          status: 'active',
          stockQuantity: 10,
          variants: null,
        }),
      },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn().mockResolvedValue(null) },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
    jest.spyOn(models.Cart, 'findOrCreate').mockResolvedValue([{ id: 1 }]);
    jest
      .spyOn(models.CartItem, 'findOne')
      .mockResolvedValue({ quantity: 2, update: jest.fn().mockResolvedValue() });
    // variants=null, resolvedVariantId=null, no variant → enters existing block
    // L128: (null || []).find() → undefined → !resolvedVariantForStock → skip
    // L136: !resolvedVariantId (null) → true, 2+1=3 <= 10 → no throw → update
    await repo.addToCart({ userId: 1, productId: 1, quantity: 1 });
    expect(models.CartItem.findOne).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sequelize-catalog-repository: L272-275 (_buildSortOrder unsafe order/sort)
// ═══════════════════════════════════════════════════════════════════════════════
describe('sequelize-catalog-repository: _buildSortOrder branches (L272-275)', () => {
  const CatalogRepo = require('@modules/catalog/repositories/sequelize-catalog-repository');
  let repo;

  beforeEach(() => {
    repo = new CatalogRepo({
      Product: {
        findAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
        findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      },
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: { findOne: jest.fn(), findAll: jest.fn() },
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {}, where: jest.fn() },
    });
  });

  test('unsafe order → fallback DESC (L272-273)', () => {
    const result = repo._buildProductOrderClause('createdAt', 'INVALID');
    expect(result).toEqual([['createdAt', 'DESC']]);
  });

  test('unsafe sort → fallback createdAt (L275)', () => {
    const result = repo._buildProductOrderClause('hackedField', 'ASC');
    expect(result).toEqual([['createdAt', 'ASC']]);
  });

  test('null order → fallback DESC (L272 order null)', () => {
    const result = repo._buildProductOrderClause('name', null);
    expect(result).toEqual([['name', 'DESC']]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// reviews-service: L168-169 (getAllReviews NaN page/limit)
// ═══════════════════════════════════════════════════════════════════════════════
describe('reviews-service: getAllReviews NaN fallback (L168-169)', () => {
  const ReviewsService = require('@modules/reviews/services/reviews-service');
  let svc, reviewsRepo;

  beforeEach(() => {
    reviewsRepo = {
      findProductReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findPendingReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findUserReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findAllReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findProductById: jest.fn().mockResolvedValue({ id: 1 }),
    };
    svc = new ReviewsService({
      reviewsRepository: reviewsRepo,
      eventBus: { publish: jest.fn() },
      logger,
    });
  });

  test('getAllReviews: NaN page/limit → fallback 1/10 (L168-169)', async () => {
    await svc.getAllReviews({ page: 'x', limit: 'y' });
    expect(reviewsRepo.findAllReviews).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// search-history: L13 (both userId AND sessionId falsy → no where clause added)
// ═══════════════════════════════════════════════════════════════════════════════
describe('search-history: findDuplicate no userId no sessionId (L13 else)', () => {
  test('userId=null, sessionId=null → where has neither (L13 false branch)', async () => {
    const { SearchHistory } = require('@models');
    const origFindOne = SearchHistory.findOne;
    SearchHistory.findOne = jest.fn().mockResolvedValue(null);
    const mod = require('@modules/search-history/repositories/sequelize-search-history-repository');
    await mod.findDuplicate({ keyword: 'test', userId: null, sessionId: null, since: new Date() });
    const where = SearchHistory.findOne.mock.calls[0][0].where;
    expect(where.userId).toBeUndefined();
    expect(where.sessionId).toBeUndefined();
    SearchHistory.findOne = origFindOne;
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sequelize-catalog-repository: L598 (Review model null → throw)
// ═══════════════════════════════════════════════════════════════════════════════
describe('sequelize-catalog-repository: Review guard (L598)', () => {
  const CatalogRepo = require('@modules/catalog/repositories/sequelize-catalog-repository');

  test('findProductRatingsSummary: no Review model → throw (L598)', async () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
    await expect(repo.findProductRatingsSummary(1)).rejects.toThrow(
      'Review model bắt buộc trong constructor',
    );
  });

  test('findProductRatingsRows: no Review model → throw', async () => {
    const repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: null,
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
    await expect(repo.findProductRatingsRows(1)).rejects.toThrow(
      'Review model bắt buộc trong constructor',
    );
  });
});
