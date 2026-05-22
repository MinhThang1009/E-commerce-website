// Phase 42.4 — Unit tests cho CartService (modules/cart)
// Mock toàn bộ cartRepository → test pure business logic không hit DB.

const CartService = require('./cart-service');

describe('CartService', () => {
  let cartRepository;
  let eventBus;
  let logger;
  let service;

  // Helper: build product mock với defaultVariant
  const mkProduct = (basePrice = 100, stock = 10) => ({
    id: 1,
    basePrice,
    defaultVariant: { stockQuantity: stock, price: basePrice },
    name: 'Sản phẩm A',
  });

  beforeEach(() => {
    cartRepository = {
      findActiveCartByUserId: jest.fn(),
      findActiveCartBySessionId: jest.fn(),
      findOrCreateActiveCartByUserId: jest.fn(),
      findOrCreateActiveCartBySessionId: jest.fn(),
      saveCart: jest.fn((c) => Promise.resolve(c)),
      findCartItemById: jest.fn(),
      findCartItemsByCartId: jest.fn().mockResolvedValue([]),
      findCartItemMatching: jest.fn(),
      createCartItem: jest.fn(),
      saveCartItem: jest.fn((i) => Promise.resolve(i)),
      deleteCartItem: jest.fn().mockResolvedValue(),
      clearCartItems: jest.fn().mockResolvedValue(),
      sumCartItemQuantity: jest.fn(),
      findProductById: jest.fn(),
      findVariantByIdAndProductId: jest.fn(),
      findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
      findCartItemByIdWithCartAndStock: jest.fn(),
      findCartItemsForValidation: jest.fn().mockResolvedValue([]),
      findCartItemsForMerge: jest.fn().mockResolvedValue([]),
      runInTransaction: jest.fn((work) => work({})),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    service = new CartService({ cartRepository, eventBus, logger });
  });

  describe('getCart', () => {
    test('guest không có sessionId → empty cart', async () => {
      const result = await service.getCart({ user: null, cookieSessionId: null });
      expect(result).toEqual({
        data: { id: null, items: [], totalItems: 0, subtotal: 0 },
      });
    });

    test('guest có sessionId → tạo cart bằng sessionId', async () => {
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 5 });
      const result = await service.getCart({ user: null, cookieSessionId: 'sess-1' });
      expect(cartRepository.findOrCreateActiveCartBySessionId).toHaveBeenCalledWith('sess-1');
      expect(result.data.id).toBe(5);
    });

    test('user đã login + có guest cart → merge guest items vào user cart', async () => {
      const userCart = { id: 10 };
      const guestCart = { id: 20, status: 'active' };
      const guestItem = { productId: 1, variantId: null, quantity: 2 };

      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findCartItemsByCartId.mockResolvedValue([guestItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(null); // không có existing

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      // guest item moved to user cart
      expect(guestItem.cartId).toBe(10);
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(guestItem);
      // guest cart marked merged
      expect(guestCart.status).toBe('merged');
      expect(cartRepository.saveCart).toHaveBeenCalledWith(guestCart);
    });

    test('user merge guest cart + item trùng → cộng dồn quantity', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 20, status: 'active' });
      const guestItem = { productId: 1, variantId: null, quantity: 2 };
      cartRepository.findCartItemsByCartId.mockResolvedValue([guestItem]);
      const existing = { quantity: 3 };
      cartRepository.findCartItemMatching.mockResolvedValue(existing);

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      expect(existing.quantity).toBe(5);
      expect(cartRepository.deleteCartItem).toHaveBeenCalledWith(guestItem);
    });
  });

  describe('getCartCount', () => {
    test('guest không có sessionId → 0', async () => {
      const result = await service.getCartCount({ user: null, cookieSessionId: null });
      expect(result).toEqual({ count: 0 });
    });

    test('guest có sessionId → gọi findActiveCartBySessionId (line 150)', async () => {
      // Trường hợp này cần cookieSessionId truthy để vượt qua early-return ở line 149
      // và đi vào line 150: cart = await this.cartRepository.findActiveCartBySessionId(cookieSessionId)
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 7 });
      cartRepository.sumCartItemQuantity.mockResolvedValue(4);

      const result = await service.getCartCount({ user: null, cookieSessionId: 'sess-abc' });

      expect(cartRepository.findActiveCartBySessionId).toHaveBeenCalledWith('sess-abc');
      expect(result).toEqual({ count: 4 });
    });

    test('guest có sessionId nhưng cart không tồn tại → 0', async () => {
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null);

      const result = await service.getCartCount({ user: null, cookieSessionId: 'sess-xyz' });

      expect(cartRepository.findActiveCartBySessionId).toHaveBeenCalledWith('sess-xyz');
      expect(result).toEqual({ count: 0 });
    });

    test('user có cart → trả tổng quantity', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.sumCartItemQuantity.mockResolvedValue(7);
      const result = await service.getCartCount({ user: { id: 1 } });
      expect(result.count).toBe(7);
    });

    test('user không có cart → 0', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue(null);
      const result = await service.getCartCount({ user: { id: 1 } });
      expect(result.count).toBe(0);
    });
  });

  describe('addToCart', () => {
    test('product không tồn tại → 404', async () => {
      cartRepository.findProductById.mockResolvedValue(null);
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 99 } }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('product hết hàng + không có variant → 400', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 0));
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 1 } }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hết hàng') });
    });

    test('quantity vượt stock → 400', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 5));
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 10 } }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('tồn kho') });
    });

    test('variant không tồn tại → 404', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(null);
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, variantId: 5, quantity: 1 } }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });
});
