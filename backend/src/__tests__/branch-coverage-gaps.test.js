/**
 * Phủ tất cả nhánh branch còn thiếu coverage.
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

// ═══ orders-repo: L214 (variant null), L371 (default options) ════════════════
const SequelizeOrdersRepo = require('@modules/orders/repositories/sequelize-orders-repository');
describe('orders-repo branches', () => {
  let repo;
  beforeEach(() => {
    repo = new SequelizeOrdersRepo({
      Order: { findAll: jest.fn() },
      OrderItem: { create: jest.fn() },
      Product: {},
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Cart: { findOrCreate: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() },
      CartItem: { findOne: jest.fn() },
      User: { findByPk: jest.fn() },
      DiscountCode: { findOne: jest.fn() },
      InventoryLog: { bulkCreate: jest.fn() },
      sequelize: {},
    });
  });

  test('variant soft-deleted → skip restore (L214)', async () => {
    repo.Order.findAll.mockResolvedValue([
      {
        id: 1,
        status: 'pending',
        paymentMethod: 'momo',
        appliedDiscount: null,
        items: [{ variantId: 5, quantity: 2, ProductVariant: null }],
        save: jest.fn(),
      },
    ]);
    jest.spyOn(repo, 'restoreVariantStock').mockResolvedValue();
    await repo.cancelPendingOrdersByUser(1, {});
    expect(repo.restoreVariantStock).not.toHaveBeenCalled();
  });

  test('decrementDiscountCodeUsage no options (L371)', async () => {
    const code = { decrement: jest.fn().mockResolvedValue() };
    await repo.decrementDiscountCodeUsage(code);
    expect(code.decrement).toHaveBeenCalledWith('usedCount', {});
  });
});

// ═══ search-history: L13 (sessionId branch) ══════════════════════════════════
describe('search-history branches', () => {
  test('sessionId truthy, userId falsy → where.sessionId (L13)', async () => {
    const { SearchHistory } = require('@models');
    const origFindOne = SearchHistory.findOne;
    SearchHistory.findOne = jest.fn().mockResolvedValue(null);
    const mod = require('@modules/search-history/repositories/sequelize-search-history-repository');
    await mod.findDuplicate({ keyword: 'test', sessionId: 'sess-1', since: new Date() });
    expect(SearchHistory.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sessionId: 'sess-1' }) }),
    );
    SearchHistory.findOne = origFindOne;
  });
});

// ═══ ai-controller: L56, L66 (catch next(err)) ══════════════════════════════
describe('ai-controller branches', () => {
  test('addToCart error → next(err) (L66)', async () => {
    const AIController = require('@modules/ai/controllers/ai-controller');
    const ctrl = new AIController({
      aiService: { addToCart: jest.fn().mockRejectedValue(new Error('x')) },
      logger: require('@utils/logger'),
    });
    const next = jest.fn();
    await ctrl.addToCart({ body: { productId: 1 }, user: { id: 1 } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ═══ ai-repo: L102, L135, L138 (stock errors) ═══════════════════════════════
describe('ai-repo branches', () => {
  let repo;
  beforeEach(() => {
    const AIRepo = require('@modules/ai/repositories/sequelize-ai-repository');
    repo = new AIRepo({
      Product: { findByPk: jest.fn() },
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Category: {},
      sequelize: { transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })) },
    });
  });

  test('default variant out of stock → throw (L102)', async () => {
    const { Cart, CartItem } = require('@models');
    const origCartFind = Cart.findOne;
    const origItemFind = CartItem.findOne;
    Cart.findOne = jest.fn().mockResolvedValue({ id: 1 });
    CartItem.findOne = jest.fn().mockResolvedValue(null);
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      variants: [{ id: 10, isDefault: true, stockQuantity: 0 }],
    });
    await expect(repo.addToCart({ userId: 1, productId: 1 })).rejects.toMatchObject({
      statusCode: 400,
    });
    Cart.findOne = origCartFind;
    CartItem.findOne = origItemFind;
  });

  test('specific variant quantity exceeds stock → throw (L135)', async () => {
    const { Cart, CartItem } = require('@models');
    const origCartFind = Cart.findOne;
    const origItemFind = CartItem.findOne;
    Cart.findOne = jest.fn().mockResolvedValue({ id: 1, addItem: jest.fn() });
    CartItem.findOne = jest.fn().mockResolvedValue({ quantity: 5, update: jest.fn() });
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      variants: [{ id: 10, stockQuantity: 3, price: 100 }],
      productImages: [],
    });
    repo.ProductVariant.findOne.mockResolvedValue({ id: 10, stockQuantity: 3, price: 100 });
    await expect(
      repo.addToCart({ userId: 1, productId: 1, variantId: 10, quantity: 1 }),
    ).rejects.toThrow();
    Cart.findOne = origCartFind;
    CartItem.findOne = origItemFind;
  });

  test('no variant, product stock exceeded → throw (L138)', async () => {
    const { Cart, CartItem } = require('@models');
    const origCartFind = Cart.findOne;
    const origItemFind = CartItem.findOne;
    Cart.findOne = jest.fn().mockResolvedValue({ id: 1, addItem: jest.fn() });
    CartItem.findOne = jest.fn().mockResolvedValue({ quantity: 5, update: jest.fn() });
    repo.Product.findByPk.mockResolvedValue({
      id: 1,
      status: 'active',
      stockQuantity: 3,
      basePrice: 100,
      variants: [],
      productImages: [],
    });
    await expect(repo.addToCart({ userId: 1, productId: 1, quantity: 1 })).rejects.toThrow();
    Cart.findOne = origCartFind;
    CartItem.findOne = origItemFind;
  });
});

// ═══ chatbot-service: L917-918 (clearSession DB destroy catch) ═══════════════
describe('chatbot-service branches', () => {
  test('clearSession: DB destroy fails → catches (L917-918)', async () => {
    const svc = require('@modules/ai/services/chatbot/chatbot-service');
    svc.conversationHistory.set('test-sess', { messages: [], lastAccess: Date.now() });
    svc.ChatMessage = { destroy: jest.fn().mockRejectedValue(new Error('DB down')) };
    const result = await svc.clearSession('test-sess');
    expect(result).toBe(true);
  });
});

// ═══ cart-service: L447-448 (stale item delete + continue) ═══════════════════
describe('cart-service branches', () => {
  test('mergeCart: stale item (no Product/Variant) → delete + continue (L447-448)', async () => {
    const CartService = require('@modules/cart/services/cart-service');
    const cartRepo = {
      findOrCreateActiveCartByUserId: jest.fn().mockResolvedValue({ id: 1, items: [] }),
      findActiveCartBySessionId: jest.fn().mockResolvedValue({
        id: 2,
        items: [],
        save: jest.fn(),
      }),
      findCartItemsForMerge: jest
        .fn()
        .mockResolvedValue([
          { id: 100, productId: 1, variantId: null, Product: null, ProductVariant: null },
        ]),
      findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
      findCartItemMatching: jest.fn().mockResolvedValue(null),
      saveCartItem: jest.fn(),
      deleteCartItem: jest.fn().mockResolvedValue(),
      saveCart: jest.fn(),
      runInTransaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    };
    const svc = new CartService({
      cartRepository: cartRepo,
      eventBus: { publish: jest.fn() },
      logger: require('@utils/logger'),
    });
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.deleteCartItem).toHaveBeenCalled();
  });
});

// ═══ reviews-service: parseInt fallbacks (L130, 152-153, 168-169) ════════════
describe('reviews-service branches', () => {
  let svc;
  const repo = {
    findProductReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findPendingReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findUserReviews: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductById: jest.fn().mockResolvedValue({ id: 1 }),
  };
  beforeEach(() => {
    jest.clearAllMocks();
    const Svc = require('@modules/reviews/services/reviews-service');
    svc = new Svc({
      reviewsRepository: repo,
      eventBus: { publish: jest.fn() },
      logger: require('@utils/logger'),
    });
  });

  test('getProductReviews: NaN → fallback (L129-130)', async () => {
    await svc.getProductReviews({ productId: 1, page: 'x', limit: 'y' });
    expect(repo.findProductReviews).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });
  test('getUserReviews: NaN → fallback (L168-169)', async () => {
    await svc.getUserReviews({ userId: 1, page: 'x', limit: 'y' });
    expect(repo.findUserReviews).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });
});

// ═══ discount-code-service: L42 (parseInt fallback) ══════════════════════════
describe('discount-code-service branches', () => {
  test('getAll: NaN limit → fallback 10 (L42)', async () => {
    const discountRepo = require('@modules/discount-code/repositories/sequelize-discount-code-repository');
    const origFindAll = discountRepo.findAll;
    discountRepo.findAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });
    const svc = require('@modules/discount-code/services/discount-code-service');
    await svc.getAllDiscountCodes({ page: 'x', limit: 'y' });
    expect(discountRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    discountRepo.findAll = origFindAll;
  });
});

// ═══ catalog-category: L61 (self-parent) ═════════════════════════════════════
describe('catalog-category branches', () => {
  test('updateCategory: parentId === id → throw (L61)', async () => {
    const Svc = require('@modules/catalog/services/catalog-service');
    const repo = {
      findCategoryById: jest.fn().mockResolvedValue({ id: 5, save: jest.fn() }),
      findCategoryBySlug: jest.fn(),
      findAllBrands: jest.fn().mockResolvedValue([]),
      findAllCategories: jest.fn().mockResolvedValue([]),
      countProductsByBrand: jest.fn().mockResolvedValue([]),
    };
    const svc = new Svc({
      catalogRepository: repo,
      eventBus: { publish: jest.fn() },
      logger: require('@utils/logger'),
    });
    await expect(svc.updateCategory({ id: 5, patch: { parentId: 5 } })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
