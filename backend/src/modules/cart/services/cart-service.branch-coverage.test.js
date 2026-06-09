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
const CartService = require('./cart-service');

describe('CartService — branch coverage', () => {
  let cartRepo, svc;

  beforeEach(() => {
    cartRepo = {
      findOrCreateActiveCartByUserId: jest.fn(),
      findActiveCartBySessionId: jest.fn(),
      findCartItemsForMerge: jest.fn(),
      findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
      findCartItemMatching: jest.fn(),
      saveCartItem: jest.fn(),
      deleteCartItem: jest.fn().mockResolvedValue(),
      saveCart: jest.fn(),
      runInTransaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    };
    svc = new CartService({ cartRepository: cartRepo, eventBus: { publish: jest.fn() }, logger });
  });

  test('mergeCart: stale item (no Product/Variant) → delete + continue', async () => {
    cartRepo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 1, items: [] });
    cartRepo.findActiveCartBySessionId.mockResolvedValue({ id: 2, items: [], save: jest.fn() });
    cartRepo.findCartItemsForMerge.mockResolvedValue([
      { id: 100, productId: 1, variantId: null, Product: null, ProductVariant: null },
    ]);
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.deleteCartItem).toHaveBeenCalled();
  });

  test('getCart merge: defaultVariant null + maxStock=0 → quantity uncapped', async () => {
    cartRepo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 1 });
    cartRepo.findActiveCartBySessionId.mockResolvedValue({
      id: 2,
      status: 'active',
      save: jest.fn(),
    });
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
    expect(cartRepo.saveCartItem.mock.calls[0][0].quantity).toBe(5);
  });

  test('mergeCart: sessionCart null in tx → early return', async () => {
    cartRepo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 1, items: [] });
    cartRepo.findActiveCartBySessionId.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce(null);
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.findCartItemsForMerge).not.toHaveBeenCalled();
  });

  test('mergeCart: Product.basePrice null → currentPrice fallback 0', async () => {
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
        Product: { id: 1, basePrice: null, defaultVariant: null },
        ProductVariant: null,
      },
    ]);
    cartRepo.findCartItemMatching.mockResolvedValue(null);
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.saveCartItem.mock.calls[0][0].unitPrice).toBe(0);
  });

  test('mergeCart: ProductVariant null → currentPrice from Product.basePrice', async () => {
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
    await svc.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-1',
      clearSessionCookie: jest.fn(),
    });
    expect(cartRepo.saveCartItem).toHaveBeenCalled();
  });
});
