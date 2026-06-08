/**
 * Branch coverage gaps — batch 2.
 * Phủ tất cả nhánh branch còn thiếu sau batch 1.
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
// catalog-product-methods: 12 branches (parseInt fallbacks, variantName chains)
// ═══════════════════════════════════════════════════════════════════════════════
describe('catalog-product-methods branches', () => {
  const CatalogService = require('@modules/catalog/services/catalog-service');
  let svc, repo;

  function makeProductRow(overrides = {}) {
    const data = {
      id: 1,
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      status: 'active',
      basePrice: '29990000',
      compareAtPrice: '33000000',
      stockQuantity: 5,
      isFeatured: true,
      productImages: [],
      variants: [],
      categories: [],
      reviews: [],
      model: null,
      ...overrides,
    };
    return { ...data, toJSON: () => ({ ...data }) };
  }

  beforeEach(() => {
    repo = {
      findAllCategoriesSorted: jest.fn(),
      getCategoryProductCounts: jest.fn().mockResolvedValue({}),
      findCategoryById: jest.fn(),
      findCategoryBySlug: jest.fn(),
      createCategory: jest.fn(),
      saveCategory: jest.fn(),
      deleteCategory: jest.fn(),
      countProductsByCategoryId: jest.fn(),
      findProductsByCategoryId: jest.fn(),
      findAllBrands: jest.fn(),
      findBrandIdsByCategoryId: jest.fn(),
      findBrandById: jest.fn(),
      findBrandBySlug: jest.fn(),
      createBrand: jest.fn(),
      saveBrand: jest.fn(),
      deleteBrand: jest.fn(),
      countProductsByBrandId: jest.fn(),
      findProductsByBrandId: jest.fn(),
      findProductsList: jest.fn(),
      findProductByIdWithFullDetails: jest.fn(),
      findProductBySlugWithFullDetails: jest.fn(),
      findProductByPk: jest.fn(),
      findProductBySlug: jest.fn(),
      findFeaturedProducts: jest.fn(),
      findRelatedProducts: jest.fn(),
      findRelatedProductsFallback: jest.fn(),
      searchProducts: jest.fn(),
      findProductSuggestions: jest.fn(),
      findNewArrivals: jest.fn(),
      findBestSellersRaw: jest.fn(),
      findProductsByIdsOrdered: jest.fn(),
      findDeals: jest.fn(),
      findProductVariantsByProductId: jest.fn(),
      findProductRatingsSummary: jest
        .fn()
        .mockResolvedValue({ average: 0, count: 0, distribution: {} }),
      getProductPriceRange: jest.fn(),
      findAttributeValuesByName: jest.fn().mockResolvedValue([]),
      findOtherAttributes: jest.fn().mockResolvedValue([]),
      findRecentlyViewedByUser: jest.fn(),
      upsertRecentlyViewed: jest.fn().mockResolvedValue(),
      pruneRecentlyViewed: jest.fn().mockResolvedValue(),
      findCategoryByIdOrSlug: jest.fn(),
      countProductsByBrand: jest.fn().mockResolvedValue([]),
    };
    svc = new CatalogService({ catalogRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  // L137: variantName + displayName both falsy → ''
  // L145: variantName falsy → fullName = mainName
  test('getProductBySlug: variant без variantName/displayName → fullName = mainName (L137,145)', async () => {
    const product = makeProductRow({
      variants: [
        {
          id: 10,
          isDefault: true,
          price: 100,
          compareAtPrice: null,
          stockQuantity: 5,
          sku: 'S1',
          variantName: null,
          displayName: null,
          attributes: {},
        },
      ],
      productImages: [
        { id: 1, imageUrl: 'a.jpg', isThumbnail: true, variantId: null, color: null },
      ],
    });
    repo.findProductBySlugWithFullDetails.mockResolvedValue(product);
    const result = await svc.getProductBySlug({ slug: 'iphone-15-pro' });
    expect(result.payload.data.name).toBe('iPhone 15 Pro');
    expect(result.payload.data.currentVariant.name).toBe('');
  });

  // L326: getFeaturedProducts NaN limit → DEFAULT_LIST_LIMIT (8)
  test('getFeaturedProducts: NaN limit → fallback 8 (L326)', async () => {
    repo.findFeaturedProducts.mockResolvedValue([]);
    await svc.getFeaturedProducts({ limit: 'abc' });
    expect(repo.findFeaturedProducts).toHaveBeenCalledWith(8);
  });

  // L333: getRelatedProducts NaN id → throw
  test('getRelatedProducts: NaN id → throw 404 (L333)', async () => {
    await expect(svc.getRelatedProducts({ id: 'abc' })).rejects.toMatchObject({ statusCode: 404 });
  });

  // L337: getRelatedProducts NaN limit → fallback 4
  test('getRelatedProducts: NaN limit → fallback 4 (L337)', async () => {
    repo.findProductByPk.mockResolvedValue({ id: 1, status: 'active', categoryId: 5 });
    repo.findRelatedProducts.mockResolvedValue([]);
    repo.findRelatedProductsFallback.mockResolvedValue([]);
    await svc.getRelatedProducts({ id: '1', limit: 'abc' });
    expect(repo.findRelatedProducts).toHaveBeenCalledWith(1, 4, 5);
  });

  // L361-362: searchProducts NaN limit/page → fallback
  test('searchProducts: NaN limit/page → fallback 10/1 (L361-362)', async () => {
    repo.searchProducts.mockResolvedValue({ count: 0, rows: [] });
    await svc.searchProducts({ q: 'test', page: 'x', limit: 'y' });
    expect(repo.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });

  // L406: getNewArrivals NaN limit → fallback 8
  test('getNewArrivals: NaN limit → fallback 8 (L406)', async () => {
    repo.findNewArrivals.mockResolvedValue([]);
    await svc.getNewArrivals({ limit: 'abc' });
    expect(repo.findNewArrivals).toHaveBeenCalledWith(8);
  });

  // L434: getBestSellers NaN limit → fallback 10
  test('getBestSellers: NaN limit → fallback 10 (L434)', async () => {
    repo.findBestSellersRaw.mockResolvedValue([]);
    repo.findNewArrivals.mockResolvedValue([]);
    await svc.getBestSellers({ limit: 'abc' });
    expect(repo.findBestSellersRaw).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  // L478: getProductVariants NaN id → throw
  test('getProductVariants: NaN id → throw 404 (L478)', async () => {
    await expect(svc.getProductVariants({ id: 'abc' })).rejects.toMatchObject({ statusCode: 404 });
  });

  // L488: getProductReviewsSummary NaN id → throw
  test('getProductReviewsSummary: NaN id → throw 404 (L488)', async () => {
    await expect(svc.getProductReviewsSummary({ id: 'abc' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  // L542: getRecentlyViewed NaN limit → fallback 10
  test('getRecentlyViewed: NaN limit → fallback 10 (L542)', async () => {
    repo.findRecentlyViewedByUser.mockResolvedValue([]);
    await svc.getRecentlyViewed({ userId: 1, limit: 'abc' });
    expect(repo.findRecentlyViewedByUser).toHaveBeenCalledWith(1, 10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// sequelize-catalog-repository: L597-615 (findProductRatingsSummary)
// ═══════════════════════════════════════════════════════════════════════════════
describe('sequelize-catalog-repository: findProductRatingsSummary (L597-615)', () => {
  const CatalogRepo = require('@modules/catalog/repositories/sequelize-catalog-repository');
  let repo;

  beforeEach(() => {
    repo = new CatalogRepo({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      Category: {},
      Brand: {},
      Review: {
        findOne: jest.fn(),
        findAll: jest.fn(),
      },
      ProductAttribute: {},
      Attribute: {},
      RecentlyViewedProduct: {},
      sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn(), Op: {} },
    });
  });

  test('row null → count=0, average=0 (L613-614)', async () => {
    repo.Review.findOne.mockResolvedValue(null);
    const result = await repo.findProductRatingsSummary(1);
    expect(result).toEqual({
      count: 0,
      average: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  test('row với data → parse count/average/distribution (L613-624)', async () => {
    repo.Review.findOne.mockResolvedValue({
      count: '25',
      average: '4.23456',
      r1: '1',
      r2: '2',
      r3: '3',
      r4: '9',
      r5: '10',
    });
    const result = await repo.findProductRatingsSummary(1);
    expect(result.count).toBe(25);
    expect(result.average).toBe(4.2);
    expect(result.distribution).toEqual({ 1: 1, 2: 2, 3: 3, 4: 9, 5: 10 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// catalog-brand-methods: L10 (default param), L69 (parseInt fallback)
// ═══════════════════════════════════════════════════════════════════════════════
describe('catalog-brand-methods branches', () => {
  const CatalogService = require('@modules/catalog/services/catalog-service');
  let svc, repo;

  beforeEach(() => {
    repo = {
      findAllCategoriesSorted: jest.fn(),
      getCategoryProductCounts: jest.fn().mockResolvedValue({}),
      findCategoryById: jest.fn(),
      findCategoryBySlug: jest.fn(),
      createCategory: jest.fn(),
      saveCategory: jest.fn(),
      deleteCategory: jest.fn(),
      countProductsByCategoryId: jest.fn(),
      findProductsByCategoryId: jest.fn(),
      findAllBrands: jest.fn().mockResolvedValue([]),
      findBrandIdsByCategoryId: jest.fn().mockResolvedValue([]),
      findBrandById: jest.fn(),
      findBrandBySlug: jest.fn(),
      createBrand: jest.fn(),
      saveBrand: jest.fn(),
      deleteBrand: jest.fn(),
      countProductsByBrandId: jest.fn(),
      findProductsByBrandId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findProductsList: jest.fn(),
      findProductByIdWithFullDetails: jest.fn(),
      findProductBySlugWithFullDetails: jest.fn(),
      findProductByPk: jest.fn(),
      findProductBySlug: jest.fn(),
      findFeaturedProducts: jest.fn(),
      findRelatedProducts: jest.fn(),
      findRelatedProductsFallback: jest.fn(),
      searchProducts: jest.fn(),
      findProductSuggestions: jest.fn(),
      findNewArrivals: jest.fn(),
      findBestSellersRaw: jest.fn(),
      findProductsByIdsOrdered: jest.fn(),
      findDeals: jest.fn(),
      findProductVariantsByProductId: jest.fn(),
      findProductRatingsSummary: jest.fn(),
      getProductPriceRange: jest.fn(),
      findAttributeValuesByName: jest.fn().mockResolvedValue([]),
      findOtherAttributes: jest.fn().mockResolvedValue([]),
      findRecentlyViewedByUser: jest.fn(),
      upsertRecentlyViewed: jest.fn(),
      pruneRecentlyViewed: jest.fn(),
      findCategoryByIdOrSlug: jest.fn(),
      countProductsByBrand: jest.fn().mockResolvedValue([]),
    };
    svc = new CatalogService({ catalogRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  // L10: getAllBrands() gọi không tham số → default = {}
  test('getAllBrands: no args → default empty obj (L10)', async () => {
    await svc.getAllBrands();
    expect(repo.findAllBrands).toHaveBeenCalledWith({ filter: { hasProducts: true } });
  });

  // L69: getProductsByBrand NaN limit → fallback 10
  test('getProductsByBrand: NaN limit → fallback 10 (L69)', async () => {
    repo.findBrandBySlug.mockResolvedValue({ id: 1 });
    await svc.getProductsByBrand({ slug: 'apple', limit: 'abc', page: 'x' });
    expect(repo.findProductsByBrandId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// catalog-category-methods: L93 (parseInt fallback)
// ═══════════════════════════════════════════════════════════════════════════════
describe('catalog-category-methods branches', () => {
  const CatalogService = require('@modules/catalog/services/catalog-service');
  let svc, repo;

  beforeEach(() => {
    repo = {
      findAllCategoriesSorted: jest.fn(),
      getCategoryProductCounts: jest.fn().mockResolvedValue({}),
      findCategoryById: jest.fn(),
      findCategoryBySlug: jest.fn(),
      createCategory: jest.fn(),
      saveCategory: jest.fn(),
      deleteCategory: jest.fn(),
      countProductsByCategoryId: jest.fn(),
      findProductsByCategoryId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      findAllBrands: jest.fn(),
      findBrandIdsByCategoryId: jest.fn(),
      findBrandById: jest.fn(),
      findBrandBySlug: jest.fn(),
      createBrand: jest.fn(),
      saveBrand: jest.fn(),
      deleteBrand: jest.fn(),
      countProductsByBrandId: jest.fn(),
      findProductsByBrandId: jest.fn(),
      findProductsList: jest.fn(),
      findProductByIdWithFullDetails: jest.fn(),
      findProductBySlugWithFullDetails: jest.fn(),
      findProductByPk: jest.fn(),
      findProductBySlug: jest.fn(),
      findFeaturedProducts: jest.fn(),
      findRelatedProducts: jest.fn(),
      findRelatedProductsFallback: jest.fn(),
      searchProducts: jest.fn(),
      findProductSuggestions: jest.fn(),
      findNewArrivals: jest.fn(),
      findBestSellersRaw: jest.fn(),
      findProductsByIdsOrdered: jest.fn(),
      findDeals: jest.fn(),
      findProductVariantsByProductId: jest.fn(),
      findProductRatingsSummary: jest.fn(),
      getProductPriceRange: jest.fn(),
      findAttributeValuesByName: jest.fn().mockResolvedValue([]),
      findOtherAttributes: jest.fn().mockResolvedValue([]),
      findRecentlyViewedByUser: jest.fn(),
      upsertRecentlyViewed: jest.fn(),
      pruneRecentlyViewed: jest.fn(),
      findCategoryByIdOrSlug: jest.fn(),
      countProductsByBrand: jest.fn().mockResolvedValue([]),
    };
    svc = new CatalogService({ catalogRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  // L93: getProductsByCategory NaN limit → fallback 10
  test('getProductsByCategory: NaN limit → fallback 10 (L93)', async () => {
    repo.findCategoryById.mockResolvedValue({ id: 5 });
    await svc.getProductsByCategory({ id: 5, limit: 'abc', page: 'x' });
    expect(repo.findProductsByCategoryId).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ limit: 10 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ai-controller: L56 (clearSession catch), L66 (registerSession catch)
// ═══════════════════════════════════════════════════════════════════════════════
describe('ai-controller branches', () => {
  const AIController = require('@modules/ai/controllers/ai-controller');

  test('clearSession error → next(err) (L56)', async () => {
    const ctrl = new AIController({
      aiService: { clearSession: jest.fn().mockRejectedValue(new Error('fail')) },
      logger,
    });
    const next = jest.fn();
    await ctrl.clearSession({ body: { sessionId: 's1' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('registerSession error → next(err) (L66)', async () => {
    const ctrl = new AIController({
      aiService: {
        registerSession: jest.fn().mockImplementation(() => {
          throw new Error('fail');
        }),
      },
      logger,
    });
    const next = jest.fn();
    await ctrl.registerSession({ body: { sessionId: 's1' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// chatbot-service: L938 (userId filter in getSessionMessages)
// ═══════════════════════════════════════════════════════════════════════════════
describe('chatbot-service: getSessionMessages userId filter (L938)', () => {
  test('userId truthy → where.userId set', async () => {
    const svc = require('@modules/ai/services/chatbot/chatbot-service');
    const mockFindAll = jest.fn().mockResolvedValue([]);
    svc.ChatMessage = { findAll: mockFindAll, destroy: jest.fn() };
    await svc.getSessionMessages('sess-1', 50, 42);
    const where = mockFindAll.mock.calls[0][0].where;
    expect(where.userId).toBe(42);
  });

  test('userId falsy → where.userId NOT set', async () => {
    const svc = require('@modules/ai/services/chatbot/chatbot-service');
    const mockFindAll = jest.fn().mockResolvedValue([]);
    svc.ChatMessage = { findAll: mockFindAll, destroy: jest.fn() };
    await svc.getSessionMessages('sess-2', 50, null);
    const where = mockFindAll.mock.calls[0][0].where;
    expect(where.userId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// cart-service: L153,157 (getCart inline merge — defaultVariant null, maxStock=0)
//              L425 (mergeCart sessionCart null race)
//              L453 (mergeCart currentPrice Product-only path)
// ═══════════════════════════════════════════════════════════════════════════════
describe('cart-service extra branches', () => {
  const CartService = require('@modules/cart/services/cart-service');
  let cartRepo, svc;

  beforeEach(() => {
    cartRepo = {
      findOrCreateActiveCartByUserId: jest.fn(),
      findActiveCartBySessionId: jest.fn(),
      findCartItemsForMerge: jest.fn(),
      findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
      findCartItemMatching: jest.fn(),
      saveCartItem: jest.fn(),
      deleteCartItem: jest.fn(),
      saveCart: jest.fn(),
      runInTransaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    };
    svc = new CartService({ cartRepository: cartRepo, eventBus: { publish: jest.fn() }, logger });
  });

  // L153: defaultVariant null → baseStockQuantity = 0
  // L157: maxStock = 0, ProductVariant null → existing.quantity = newQuantity (no cap)
  test('getCart merge: defaultVariant null + maxStock=0 → quantity uncapped (L153,157)', async () => {
    const userCart = { id: 1 };
    const guestCart = { id: 2, status: 'active', save: jest.fn() };
    cartRepo.findOrCreateActiveCartByUserId.mockResolvedValue(userCart);
    cartRepo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    cartRepo.findCartItemsForMerge.mockResolvedValueOnce([{ id: 10 }]).mockResolvedValueOnce([
      {
        id: 10,
        productId: 1,
        variantId: null,
        quantity: 3,
        Product: { id: 1, defaultVariant: null, basePrice: 100 },
        ProductVariant: null,
      },
    ]);
    cartRepo.findCartItemMatching.mockResolvedValue({ quantity: 2, save: jest.fn() });
    await svc.getCart({ user: { id: 1 }, cookieSessionId: 'sess-1' });
    const savedItem = cartRepo.saveCartItem.mock.calls[0][0];
    expect(savedItem.quantity).toBe(5);
  });

  // L425: mergeCart → sessionCart null inside transaction (race condition)
  test('mergeCart: sessionCart null in tx → early return (L425)', async () => {
    cartRepo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 1, items: [] });
    cartRepo.findActiveCartBySessionId.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce(null);
    cartRepo.findCartItemsWithDetails.mockResolvedValue([]);
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.findCartItemsForMerge).not.toHaveBeenCalled();
  });

  // L453: mergeCart currentPrice — ProductVariant null → Product.basePrice path
  test('mergeCart: ProductVariant null → currentPrice from Product.basePrice (L453)', async () => {
    const sessionCart = { id: 2, status: 'active' };
    cartRepo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 1, items: [] });
    cartRepo.findActiveCartBySessionId
      .mockResolvedValueOnce(sessionCart)
      .mockResolvedValueOnce(sessionCart);
    cartRepo.findCartItemsForMerge.mockResolvedValue([
      {
        id: 10,
        productId: 1,
        variantId: null,
        quantity: 1,
        Product: { id: 1, basePrice: '25000000', defaultVariant: null },
        ProductVariant: null,
      },
    ]);
    cartRepo.findCartItemMatching.mockResolvedValue(null);
    cartRepo.findCartItemsWithDetails.mockResolvedValue([]);
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.saveCartItem).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// orders-service: L348 (_lockedPrice fallback), L504 (productImages map)
// ═══════════════════════════════════════════════════════════════════════════════
describe('orders-service extra branches', () => {
  const OrdersService = require('@modules/orders/services/orders-service');
  let svc, repo;

  beforeEach(() => {
    repo = {
      findVariantBasic: jest.fn(),
      findActiveCartByUserId: jest.fn(),
      findCartItemsByCartId: jest.fn(),
      lockVariantStock: jest.fn(),
      lockProductStock: jest.fn(),
      decrementVariantStock: jest.fn(),
      decrementProductStock: jest.fn(),
      incrementDiscountCodeUsage: jest.fn(),
      createOrder: jest
        .fn()
        .mockResolvedValue({
          id: 1,
          number: 'ORD-001',
          total: 100,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: 'cod',
        }),
      createOrderItem: jest.fn().mockResolvedValue({ id: 1 }),
      clearCartItems: jest.fn(),
      getActiveDiscountByCode: jest.fn(),
      findOrderByIdForUser: jest.fn(),
      findOrdersByUser: jest.fn(),
      findOrderByNumber: jest.fn(),
      findOrderByPkWithItemsAndUser: jest.fn(),
      cancelPendingOrdersByUser: jest.fn(),
      runInTransaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    };
    svc = new OrdersService({
      ordersRepository: repo,
      emailGateway: { sendOrderConfirmation: jest.fn() },
      eventBus: { publish: jest.fn() },
      logger,
      constants: {},
    });
  });

  // L504: getOrderById — productImages with no thumbnail → fallback to first image
  test('getOrderById: no isThumbnail image → fallback to [0].imageUrl (L504)', async () => {
    const order = {
      id: 1,
      userId: 1,
      status: 'pending',
      toJSON: () => ({
        id: 1,
        userId: 1,
        status: 'pending',
        items: [
          {
            Product: {
              productImages: [
                { imageUrl: 'first.jpg', isThumbnail: false },
                { imageUrl: 'second.jpg', isThumbnail: false },
              ],
            },
          },
        ],
      }),
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    const result = await svc.getOrderById({ orderId: 1, userId: 1, role: 'customer' });
    expect(result.items[0].Product.thumbnail).toBe('first.jpg');
  });

  // L504: getOrderById — productImages empty → thumbnail = null
  test('getOrderById: productImages empty array → thumbnail null (L504)', async () => {
    const order = {
      id: 1,
      userId: 1,
      status: 'pending',
      toJSON: () => ({
        id: 1,
        userId: 1,
        status: 'pending',
        items: [
          {
            Product: { productImages: [] },
          },
        ],
      }),
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    const result = await svc.getOrderById({ orderId: 1, userId: 1, role: 'customer' });
    expect(result.items[0].Product.thumbnail).toBeNull();
  });
});
