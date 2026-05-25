// Cart service — branch coverage cho các nhánh chưa cover:
// Line 52:  img.variantId (camelCase fallback)
// Line 104: _assertStock khi product.defaultVariant = null
// Line 267: updateCartItem variant stock vượt
// Line 338: syncCart variant không tồn tại
// Line 361: syncCart product.basePrice falsy → fallback 0
// Line 412-415: mergeCart không có defaultVariant / không có ProductVariant
// Line 470-471: validateCart Product.basePrice null → ?? 0
// Line 488: validateCart name fallback chain (nameVi → nameEn → name → '')

const CartService = require('./cart-service');

describe('CartService — branch coverage bổ sung', () => {
  let cartRepository;
  let service;

  beforeEach(() => {
    cartRepository = {
      findCartWithItems: jest.fn().mockResolvedValue(null),
      findActiveCartBySessionId: jest.fn().mockResolvedValue(null),
      findOrCreateActiveCart: jest.fn(),
      findOrCreateActiveCartByUserId: jest.fn(),
      findCartItemByCartAndProduct: jest.fn().mockResolvedValue(null),
      findProductById: jest.fn(),
      findVariantByIdAndProductId: jest.fn(),
      createCartItem: jest.fn().mockResolvedValue({ id: 1 }),
      saveCartItem: jest.fn().mockResolvedValue(),
      deleteCartItem: jest.fn().mockResolvedValue(),
      findCartItemById: jest.fn(),
      findCartItemByIdWithCartAndStock: jest.fn().mockResolvedValue(null),
      clearCartItems: jest.fn().mockResolvedValue(),
      getCartItemCount: jest.fn().mockResolvedValue(0),
      findActiveCartByUserId: jest.fn().mockResolvedValue(null),
      findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
      findCartItemsByCartId: jest.fn().mockResolvedValue([]),
      sumCartItemQuantity: jest.fn().mockResolvedValue(0),
      findCartItemsForValidation: jest.fn().mockResolvedValue([]),
      findCartItemsForMerge: jest.fn().mockResolvedValue([]),
      findCartItemMatching: jest.fn().mockResolvedValue(null),
      saveCart: jest.fn().mockResolvedValue(),
      runInTransaction: jest.fn(async (work) => work({})),
    };
    service = new CartService({
      cartRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  // ── Line 52: img.variantId (camelCase) khi img.variant_id không match ──

  describe('getCart — ảnh variant match bằng camelCase variantId', () => {
    test('ưu tiên img.variantId khi img.variant_id không khớp', async () => {
      const rawItem = {
        id: 1,
        cartId: 10,
        productId: 1,
        variantId: 5,
        quantity: 1,
        unitPrice: 100,
        Product: {
          id: 1,
          nameVi: 'SP Test',
          slug: 'sp-test',
          basePrice: 100,
          status: 'active',
          variants: [{ stockQuantity: 10 }],
          defaultVariant: { stockQuantity: 10, price: 100 },
          productImages: [
            { variant_id: 999, variantId: 5, imageUrl: 'camel.jpg', isThumbnail: false },
            { variant_id: null, variantId: null, imageUrl: 'thumb.jpg', isThumbnail: true },
          ],
        },
        ProductVariant: { id: 5, price: 100, stockQuantity: 10 },
      };
      const cartItem = {
        ...rawItem,
        toJSON: () => JSON.parse(JSON.stringify(rawItem)),
      };

      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsWithDetails = jest.fn().mockResolvedValue([cartItem]);

      const result = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.data.items[0].Product.thumbnail).toBe('camel.jpg');
    });
  });

  // ── Line 104: _assertStock khi product.defaultVariant = null ──

  describe('_assertStock — product không có defaultVariant', () => {
    test('không có variant, defaultVariant null → baseStock = 0 → throw khi quantity > 0', () => {
      expect(() =>
        service._assertStock({
          product: { defaultVariant: null },
          variant: null,
          quantity: 1,
        }),
      ).toThrow('Số lượng vượt quá số lượng tồn kho');
    });

    test('không có variant, defaultVariant undefined → baseStock = 0 → throw', () => {
      expect(() =>
        service._assertStock({
          product: {},
          variant: null,
          quantity: 1,
        }),
      ).toThrow('Số lượng vượt quá số lượng tồn kho');
    });
  });

  // ── Line 267: updateCartItem — ProductVariant stock < quantity ──

  describe('updateCartItem — variant stock vượt', () => {
    test('ProductVariant.stockQuantity < quantity → throw 400', async () => {
      const cartItem = {
        id: 1,
        cartId: 10,
        productId: 1,
        variantId: 5,
        quantity: 1,
        Cart: { userId: 1, sessionId: null },
        Product: {
          id: 1,
          defaultVariant: { stockQuantity: 100 },
        },
        ProductVariant: { id: 5, stockQuantity: 2 },
        save: jest.fn(),
      };
      cartRepository.findCartItemByIdWithCartAndStock = jest.fn().mockResolvedValue(cartItem);

      await expect(
        service.updateCartItem({ user: { id: 1 }, cookieSessionId: null, itemId: 1, quantity: 5 }),
      ).rejects.toThrow('Số lượng vượt quá số lượng tồn kho');
    });
  });

  // ── Line 267: updateCartItem — ProductVariant stock ĐỦ (nhánh false) ──

  describe('updateCartItem — variant stock đủ → update thành công', () => {
    test('ProductVariant.stockQuantity >= quantity → không throw, save', async () => {
      const cartItem = {
        id: 1,
        cartId: 10,
        productId: 1,
        variantId: 5,
        quantity: 1,
        Cart: { userId: 1, sessionId: null },
        Product: {
          id: 1,
          defaultVariant: { stockQuantity: 100 },
        },
        ProductVariant: { id: 5, stockQuantity: 10 },
        save: jest.fn().mockResolvedValue(),
      };
      cartRepository.findCartItemByIdWithCartAndStock = jest.fn().mockResolvedValue(cartItem);
      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsWithDetails = jest.fn().mockResolvedValue([]);

      await service.updateCartItem({
        user: { id: 1 },
        cookieSessionId: null,
        itemId: 1,
        quantity: 5,
      });

      expect(cartItem.quantity).toBe(5);
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(cartItem);
    });
  });

  // ── Line 338: syncCart — variant không tồn tại → continue ──

  describe('syncCart — variant không tồn tại', () => {
    test('variantId không match → bỏ qua item đó', async () => {
      cartRepository.findOrCreateActiveCartByUserId = jest
        .fn()
        .mockResolvedValue({ id: 10 });
      cartRepository.findProductById = jest.fn().mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 10 },
      });
      cartRepository.findVariantByIdAndProductId = jest.fn().mockResolvedValue(null);

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 1, variantId: 999, quantity: 2 }],
      });

      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });
  });

  // ── Line 361: syncCart — product.basePrice falsy → || 0 ──

  describe('syncCart — product.basePrice falsy', () => {
    test('basePrice null → unitPrice = 0', async () => {
      cartRepository.findOrCreateActiveCartByUserId = jest
        .fn()
        .mockResolvedValue({ id: 10 });
      cartRepository.findProductById = jest.fn().mockResolvedValue({
        id: 1,
        basePrice: null,
        defaultVariant: { stockQuantity: 5 },
      });

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 1, variantId: null, quantity: 2 }],
      });

      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ unitPrice: 0 }),
        expect.any(Object),
      );
    });
  });

  // ── Lines 412-415: mergeCart — không có defaultVariant, không có ProductVariant ──

  describe('mergeCart — session item không có defaultVariant và ProductVariant', () => {
    test('defaultVariant null + ProductVariant null → maxStock = 0', async () => {
      const sessionCart = { id: 20, status: 'active' };
      const userCart = { id: 10 };

      cartRepository.findActiveCartBySessionId = jest.fn().mockResolvedValue(sessionCart);
      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue(userCart);
      cartRepository.findCartItemsForMerge = jest.fn().mockResolvedValue([
        {
          id: 1,
          cartId: 20,
          productId: 1,
          variantId: null,
          quantity: 2,
          Product: { id: 1, basePrice: 100, defaultVariant: null },
          ProductVariant: null,
        },
      ]);
      cartRepository.findCartItemMatching = jest.fn().mockResolvedValue({
        id: 5,
        quantity: 3,
        save: jest.fn(),
      });

      await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: 'sess-123',
        clearSessionCookie: jest.fn(),
      });

      expect(cartRepository.saveCartItem).toHaveBeenCalled();
      expect(cartRepository.deleteCartItem).toHaveBeenCalled();
    });
  });

  // ── Lines 470-471: validateCart — Product.basePrice null → ?? 0 ──

  describe('validateCart — Product.basePrice null (fallback ?? 0)', () => {
    test('không có ProductVariant, basePrice null → currentPrice = 0', async () => {
      cartRepository.findActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForValidation = jest.fn().mockResolvedValue([
        {
          id: 1,
          productId: 1,
          variantId: null,
          quantity: 1,
          unitPrice: 0,
          Product: {
            id: 1,
            nameVi: 'Test',
            basePrice: null,
            defaultVariant: { stockQuantity: 5 },
          },
          ProductVariant: null,
        },
      ]);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].currentPrice).toBe(0);
      expect(result.items[0].outOfStock).toBe(false);
    });
  });

  // ── Line 470-471: validateCart — Product.basePrice truthy (nhánh chính của ??) ──

  describe('validateCart — Product.basePrice truthy (không cần ?? 0)', () => {
    test('không có ProductVariant, basePrice có giá trị → currentPrice đúng', async () => {
      cartRepository.findActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForValidation = jest.fn().mockResolvedValue([
        {
          id: 1,
          productId: 1,
          variantId: null,
          quantity: 1,
          unitPrice: 200,
          Product: {
            id: 1,
            nameVi: 'Test',
            basePrice: 200,
            defaultVariant: { stockQuantity: 5 },
          },
          ProductVariant: null,
        },
      ]);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].currentPrice).toBe(200);
    });
  });

  // ── Line 488: validateCart — name fallback chain ──

  describe('validateCart — name fallback chain', () => {
    const makeItem = (nameOverrides) => ({
      id: 1,
      productId: 1,
      variantId: null,
      quantity: 1,
      unitPrice: 100,
      Product: {
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 5 },
        ...nameOverrides,
      },
      ProductVariant: null,
    });

    test('nameVi null, nameEn có → dùng nameEn', async () => {
      cartRepository.findActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForValidation = jest
        .fn()
        .mockResolvedValue([makeItem({ nameVi: null, nameEn: 'English Name', name: 'raw' })]);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].name).toBe('English Name');
    });

    test('nameVi null, nameEn null, name có → dùng name', async () => {
      cartRepository.findActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForValidation = jest
        .fn()
        .mockResolvedValue([makeItem({ nameVi: null, nameEn: null, name: 'fallback' })]);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].name).toBe('fallback');
    });

    test('tất cả null → empty string', async () => {
      cartRepository.findActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForValidation = jest
        .fn()
        .mockResolvedValue([makeItem({ nameVi: null, nameEn: null, name: null })]);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].name).toBe('');
    });
  });
});
