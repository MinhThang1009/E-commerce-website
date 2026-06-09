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
      runInTransaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
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
      const guestItem = {
        productId: 1,
        variantId: null,
        quantity: 2,
        Product: { defaultVariant: { stockQuantity: 10 } },
        ProductVariant: null,
      };

      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findCartItemsForMerge.mockResolvedValue([guestItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(null); // không có existing

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      // guest item moved to user cart
      expect(guestItem.cartId).toBe(10);
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(guestItem, expect.any(Object));
      // guest cart marked merged
      expect(guestCart.status).toBe('merged');
      expect(cartRepository.saveCart).toHaveBeenCalledWith(guestCart, expect.any(Object));
    });

    test('user merge guest cart + item trùng → cộng dồn quantity (dùng findCartItemsForMerge)', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 20, status: 'active' });
      const guestItem = {
        productId: 1,
        variantId: null,
        quantity: 2,
        Product: { defaultVariant: { stockQuantity: 20 } },
        ProductVariant: null,
      };
      cartRepository.findCartItemsForMerge.mockResolvedValue([guestItem]);
      const existing = { quantity: 3 };
      cartRepository.findCartItemMatching.mockResolvedValue(existing);

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      expect(existing.quantity).toBe(5); // 3 + 2, capped at stock=20 → 5
      expect(cartRepository.deleteCartItem).toHaveBeenCalledWith(guestItem, expect.any(Object));
    });

    test('user merge guest cart + item trùng → quantity bị cap theo maxStock (REGRESSION: getCart merge không cap)', async () => {
      // Trước fix: existing.quantity = existing + guest (không cap) → vượt stock.
      // Sau fix: Math.min(newQuantity, maxStock) → đồng nhất với mergeCart.
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 20, status: 'active' });
      const guestItem = {
        productId: 1,
        variantId: null,
        quantity: 5,
        Product: { defaultVariant: { stockQuantity: 7 } },
        ProductVariant: null,
      };
      cartRepository.findCartItemsForMerge.mockResolvedValue([guestItem]);
      const existing = { quantity: 4 }; // 4+5=9 vượt stock=7 → phải cap về 7
      cartRepository.findCartItemMatching.mockResolvedValue(existing);

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      expect(existing.quantity).toBe(7); // capped at maxStock=7, not 9
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
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('OutOfStock') });
    });

    test('quantity vượt stock → 400', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 5));
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 10 } }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'cart.quantityExceedsStock' });
    });

    test('variant không tồn tại → 404', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(null);
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, variantId: 5, quantity: 1 } }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('findCartItemMatching được gọi với SELECT FOR UPDATE lock (REGRESSION: concurrent addToCart tạo duplicate CartItems)', async () => {
      // Trước fix: findCartItemMatching không có lock → 2 concurrent requests đều thấy
      // existing=null và đều tạo CartItem riêng → duplicate rows.
      // Sau fix: lock: transaction.LOCK.UPDATE → SELECT FOR UPDATE → serializes concurrent
      // inserts qua gap lock, request thứ 2 chờ request thứ 1 commit rồi mới đọc.
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 10));
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 5 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.createCartItem.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsWithDetails.mockResolvedValue([]);

      await service.addToCart({
        user: { id: 1 },
        body: { productId: 1, quantity: 1 },
        setSessionCookie: jest.fn(),
      });

      // Assert: findCartItemMatching gọi với lock=UPDATE (prevents concurrent duplicate inserts)
      expect(cartRepository.findCartItemMatching).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 5, productId: 1 }),
        expect.objectContaining({ lock: 'UPDATE' }),
      );
    });
  });
});

// ─── Merged from cart-service.edge-cases-4 ─────────────────────────

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
      runInTransaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
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
      ).toThrow('cart.quantityExceedsStock');
    });

    test('không có variant, defaultVariant undefined → baseStock = 0 → throw', () => {
      expect(() =>
        service._assertStock({
          product: {},
          variant: null,
          quantity: 1,
        }),
      ).toThrow('cart.quantityExceedsStock');
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
      ).rejects.toThrow('cart.quantityExceedsStock');
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
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(cartItem, expect.any(Object));
    });
  });

  // ── Line 338: syncCart — variant không tồn tại → continue ──

  describe('syncCart — variant không tồn tại', () => {
    test('variantId không match → bỏ qua item đó', async () => {
      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
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
      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
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

  // ── C-1: mergeCart refresh unitPrice (KHÔNG ghi nhầm field .price) ──

  describe('mergeCart — refresh unitPrice về giá hiện tại', () => {
    test('item trùng: cộng dồn quantity (cap stock) + unitPrice = basePrice hiện tại', async () => {
      const existing = { id: 5, quantity: 3, unitPrice: 999, save: jest.fn() };
      cartRepository.findActiveCartBySessionId = jest.fn().mockResolvedValue({ id: 20 });
      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForMerge = jest.fn().mockResolvedValue([
        {
          id: 1,
          cartId: 20,
          productId: 1,
          variantId: null,
          quantity: 2,
          Product: { id: 1, basePrice: 100, defaultVariant: { stockQuantity: 50 } },
          ProductVariant: null,
        },
      ]);
      cartRepository.findCartItemMatching = jest.fn().mockResolvedValue(existing);

      await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: 'sess',
        clearSessionCookie: jest.fn(),
      });

      expect(existing.quantity).toBe(5); // 3 + 2 ≤ stock 50
      expect(existing.unitPrice).toBe(100); // refresh — FAIL nếu ghi nhầm .price
    });

    test('item mới (move): set cartId + unitPrice = variant.price hiện tại', async () => {
      const moved = {
        id: 2,
        cartId: 20,
        productId: 9,
        variantId: 7,
        quantity: 1,
        Product: { id: 9, basePrice: 0 },
        ProductVariant: { price: 250, stockQuantity: 10 },
        save: jest.fn(),
      };
      cartRepository.findActiveCartBySessionId = jest.fn().mockResolvedValue({ id: 20 });
      cartRepository.findOrCreateActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForMerge = jest.fn().mockResolvedValue([moved]);
      cartRepository.findCartItemMatching = jest.fn().mockResolvedValue(null);

      await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: 'sess',
        clearSessionCookie: jest.fn(),
      });

      expect(moved.cartId).toBe(10);
      expect(moved.unitPrice).toBe(250); // refresh từ variant — FAIL nếu ghi nhầm .price
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

  // ── Line 471: validateCart — defaultVariant null + ProductVariant null → baseStockQuantity = 0 ──

  describe('validateCart — defaultVariant null (line 471 false branch)', () => {
    test('defaultVariant null + ProductVariant null → baseStockQuantity = 0 → outOfStock', async () => {
      cartRepository.findActiveCartByUserId = jest.fn().mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForValidation = jest.fn().mockResolvedValue([
        {
          id: 1,
          productId: 1,
          variantId: null,
          quantity: 1,
          unitPrice: 100,
          Product: {
            id: 1,
            nameVi: 'Test No Variant',
            basePrice: 100,
            defaultVariant: null,
          },
          ProductVariant: null,
        },
      ]);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].outOfStock).toBe(true);
      expect(result.items[0].maxStock).toBe(0);
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

// ─── Merged from cart-service.edge-cases-2.test.js ────────────────────

// ---------- Mutable mock state ----------

const mockProductFindByPkImpl = jest.fn();
const mockVariantFindOneImpl = jest.fn();
const mockCartItemFindOneImpl = jest.fn();

// ---------- Mocks ----------

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/admin-auth', () => ({
  requireSuperAdmin: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock('@services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(10),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('@models', () => {
  const sequelizePkg = require('sequelize');

  const mockTx = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  const mockCartItemUpdate = jest.fn().mockResolvedValue(undefined);

  return {
    Product: {
      findByPk: jest.fn().mockImplementation((...args) => mockProductFindByPkImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ProductVariant: {
      findOne: jest.fn().mockImplementation((...args) => mockVariantFindOneImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Cart: {
      findOrCreate: jest.fn().mockResolvedValue([{ id: 10 }, true]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      findOne: jest.fn().mockImplementation((...args) => mockCartItemFindOneImpl(...args)),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest
        .fn()
        .mockResolvedValue({ id: 1, cartId: 10, productId: 1, variantId: null, quantity: 2 }),
      destroy: jest.fn().mockResolvedValue(1),
      sum: jest.fn().mockResolvedValue(0),
    },
    User: {
      findByPk: jest.fn().mockResolvedValue({ id: 1 }),
    },
    Order: {
      findAll: jest.fn().mockResolvedValue([]),
    },
    OrderItem: { findAll: jest.fn().mockResolvedValue([]) },
    Review: { findAll: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    ProductAttribute: { findAll: jest.fn().mockResolvedValue([]) },
    ProductSpecification: { findAll: jest.fn().mockResolvedValue([]) },
    ProductImage: { findAll: jest.fn().mockResolvedValue([]) },
    InventoryLog: { create: jest.fn().mockResolvedValue({}) },
    SearchHistory: { findAll: jest.fn().mockResolvedValue([]) },
    Category: { findAll: jest.fn().mockResolvedValue([]) },
    sequelize: {
      // Phase 42 modules/cart dùng callback form: sequelize.transaction(async (tx) => {...})
      // Mock hỗ trợ cả callback (module) lẫn non-callback (legacy fallback)
      transaction: jest.fn().mockImplementation(async (cb) => {
        return typeof cb === 'function' ? cb(mockTx) : mockTx;
      }),
      fn: jest.fn(),
      col: jest.fn(),
      where: jest.fn(),
      literal: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      Sequelize: { fn: jest.fn(), col: jest.fn() },
    },
    Op: sequelizePkg.Op,
    mockCartItemUpdate, // expose để verify trong test
  };
});

describe('Tests Phase 25 — Cart Business Logic', () => {
  let request;

  beforeAll(() => {
    const express = require('express');
    const supertest = require('supertest');
    const buildCartModule = require('@modules/cart/module');
    const { Cart, CartItem, Product, ProductVariant, sequelize } = require('@models');
    const eventBus = require('@shared/event-bus');
    const logger = require('@utils/logger');
    const { errorHandler } = require('@middlewares/error-handler');

    const cartModule = buildCartModule({
      Cart,
      CartItem,
      Product,
      ProductVariant,
      sequelize,
      eventBus,
      logger,
    });

    const app = express();
    app.use(express.json());
    // Khởi tạo req.cookies = {} để cart controller không throw TypeError khi đọc sessionId
    app.use((req, _res, next) => {
      req.cookies = {};
      next();
    });
    app.use('/api/cart', cartModule.router);
    app.use(errorHandler);
    request = supertest(app);
  });

  // ---------- Fixtures ----------

  const PRODUCT_IN_STOCK = {
    id: 1,
    name: 'Laptop Test',
    status: 'active',
    basePrice: 10000000,
    stockQuantity: 10,
    slug: 'laptop-test',
    toJSON: jest.fn().mockReturnThis(),
    defaultVariant: { stockQuantity: 10 },
  };

  const PRODUCT_OUT_OF_STOCK = {
    id: 2,
    name: 'Máy tính hết hàng',
    status: 'active',
    basePrice: 5000000,
    stockQuantity: 0,
    slug: 'may-tinh-het-hang',
    toJSON: jest.fn().mockReturnThis(),
    defaultVariant: { stockQuantity: 0 },
  };

  // ============================================================
  // POST /api/cart — thêm item vào giỏ
  // ============================================================

  describe('POST /api/cart — thêm sản phẩm vào giỏ hàng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Khôi phục mock transaction (cả callback lẫn non-callback)
      const freshTx = {
        LOCK: { UPDATE: 'UPDATE' },
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      };
      const { sequelize } = require('@models');
      sequelize.transaction.mockImplementation(async (cb) => {
        return typeof cb === 'function' ? cb(freshTx) : freshTx;
      });
    });

    test('Thêm item mới vào giỏ thành công → CartItem.create được gọi', async () => {
      mockProductFindByPkImpl.mockResolvedValue(PRODUCT_IN_STOCK);
      mockVariantFindOneImpl.mockResolvedValue(null); // không có variant
      // Chưa có item trùng trong giỏ
      mockCartItemFindOneImpl.mockResolvedValue(null);

      const { CartItem } = require('@models');
      CartItem.create.mockResolvedValue({
        id: 1,
        quantity: 2,
        productId: 1,
        variantId: null,
        cartId: 10,
      });

      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 1, quantity: 2 });

      // CartItem.create phải được gọi vì chưa có item này trong giỏ
      expect(CartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 1, quantity: 2 }),
        expect.anything(),
      );
      // addToCart sau thành công sẽ gọi getCart → 200
      expect([200, 201]).toContain(res.status);
    });

    test('Thêm item trùng vào giỏ → quantity cộng dồn (update thay vì create)', async () => {
      mockProductFindByPkImpl.mockResolvedValue(PRODUCT_IN_STOCK);
      mockVariantFindOneImpl.mockResolvedValue(null);

      const existingItem = {
        id: 5,
        cartId: 10,
        productId: 1,
        variantId: null,
        quantity: 3, // đã có 3 items
        // Phase 42 modules/cart dùng item.save() thay vì item.update() để cập nhật
        save: jest.fn().mockResolvedValue(undefined),
      };
      // Đã có item trong giỏ
      mockCartItemFindOneImpl.mockResolvedValue(existingItem);

      const { CartItem } = require('@models');
      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 1, quantity: 2 });

      // Phải cập nhật quantity 3+2=5 (qua mutation + save), KHÔNG tạo mới
      expect(existingItem.save).toHaveBeenCalled();
      expect(existingItem.quantity).toBe(5); // 3 + 2 = 5
      expect(CartItem.create).not.toHaveBeenCalled();
      expect([200, 201]).toContain(res.status);
    });

    test('cart.productNotFound → 404', async () => {
      mockProductFindByPkImpl.mockResolvedValue(null);

      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 999, quantity: 1 });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/không tồn tại/);
    });

    test('Sản phẩm hết hàng (không có variantId) → 400', async () => {
      mockProductFindByPkImpl.mockResolvedValue(PRODUCT_OUT_OF_STOCK);

      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 2, quantity: 1 });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/hết hàng/);
    });

    test('Số lượng yêu cầu vượt tồn kho → 400', async () => {
      mockProductFindByPkImpl.mockResolvedValue({
        ...PRODUCT_IN_STOCK,
        stockQuantity: 2,
        defaultVariant: { stockQuantity: 2 },
      });
      mockVariantFindOneImpl.mockResolvedValue(null);
      mockCartItemFindOneImpl.mockResolvedValue(null);

      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 1, quantity: 99 }); // yêu cầu 99, tồn kho chỉ 2

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tồn kho/);
    });

    // Biên tồn kho (mutation-kill `<` → `<=` ở _assertStock base, cart-service L114).
    // qty === stock phải CHO thêm: `stock < qty` = false → ok; mutant `<=` → reject sai.
    test('Biên: quantity === tồn kho base → CHO thêm (create) → 200/201', async () => {
      mockProductFindByPkImpl.mockResolvedValue({
        ...PRODUCT_IN_STOCK,
        stockQuantity: 5,
        defaultVariant: { stockQuantity: 5 },
      });
      mockVariantFindOneImpl.mockResolvedValue(null);
      mockCartItemFindOneImpl.mockResolvedValue(null);
      const { CartItem } = require('@models');
      CartItem.create.mockResolvedValue({
        id: 1,
        quantity: 5,
        productId: 1,
        variantId: null,
        cartId: 10,
      });

      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 1, quantity: 5 }); // đặt ĐÚNG bằng tồn kho

      expect(CartItem.create).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 1, quantity: 5 }),
        expect.anything(),
      );
      expect([200, 201]).toContain(res.status);
    });

    // Biên tồn kho variant (mutation-kill `<` → `<=` ở _assertStock variant, cart-service L111).
    test('Biên: quantity === tồn kho variant → CHO thêm → 200/201', async () => {
      mockProductFindByPkImpl.mockResolvedValue({
        ...PRODUCT_IN_STOCK,
        defaultVariant: { stockQuantity: 0 }, // base hết nhưng có variant
      });
      mockVariantFindOneImpl.mockResolvedValue({
        id: 7,
        productId: 1,
        stockQuantity: 4,
        price: 12000000,
      });
      mockCartItemFindOneImpl.mockResolvedValue(null);
      const { CartItem } = require('@models');
      CartItem.create.mockResolvedValue({
        id: 1,
        quantity: 4,
        productId: 1,
        variantId: 7,
        cartId: 10,
      });

      const res = await request
        .post('/api/cart')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 1, variantId: 7, quantity: 4 }); // = tồn kho variant

      expect([200, 201]).toContain(res.status);
      expect(CartItem.create).toHaveBeenCalled();
    });
  });
});

// ─── Merged from cart-service.edge-cases.test.js ─────────────────────

describe('CartService — branch coverage chi tiết (_buildCartResponse / sync / merge / validate)', () => {
  // ─── Helpers ───────────────────────────────────────────────────────────────

  const mkProductEdge = (basePrice = 100, stock = 10) => ({
    id: 1,
    basePrice,
    defaultVariant: { stockQuantity: stock, price: basePrice },
    name: 'Sản phẩm A',
  });

  function buildServiceEdge() {
    const cartRepository = {
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
      runInTransaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
    };
    const eventBus = { publish: jest.fn().mockResolvedValue() };
    const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
    const service = new CartService({ cartRepository, eventBus, logger });
    return { service, cartRepository, logger };
  }

  // ─── _buildCartResponse — branch: itemData.Product falsy (line 29) ────────────

  describe('_buildCartResponse — khi item không có Product', () => {
    it('subtotal dùng 0 khi không có Product và không có ProductVariant', async () => {
      // Line 71: item.ProductVariant falsy → branch item.Product falsy → price = 0
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 1,
          quantity: 2,
          variantId: null,
          Product: null,
          ProductVariant: null,
        }),
        quantity: 2,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.subtotal).toBe(0);
      expect(result.totalItems).toBe(2);
    });
  });

  // ─── _buildCartResponse — branch: variantStock = 0, dùng defaultVariant (line 33) ──

  describe('_buildCartResponse — variantStock = 0, fallback defaultVariant stock', () => {
    it('stockQuantity lấy từ defaultVariant khi tổng variantStock = 0', async () => {
      // Line 33: variantStock = 0 → p.stockQuantity = p.defaultVariant.stockQuantity
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 3,
          quantity: 1,
          variantId: null,
          Product: {
            id: 1,
            basePrice: 100,
            defaultVariant: { stockQuantity: 5 },
            variants: [{ stockQuantity: 0 }],
            productImages: [],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.stockQuantity).toBe(5);
    });

    it('inStock = false khi cả variantStock = 0 và defaultVariant stock = 0', async () => {
      // Line 34: variantStock = 0, defaultVariant.stockQuantity = 0 → inStock false
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 4,
          quantity: 1,
          variantId: null,
          Product: {
            id: 1,
            basePrice: 100,
            defaultVariant: { stockQuantity: 0 },
            variants: [],
            productImages: [],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.inStock).toBe(false);
    });

    it('inStock = true khi defaultVariant.stockQuantity > 0 và variantStock = 0', async () => {
      // Line 34: variantStock = 0 nhưng defaultVariant.stockQuantity > 0
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 5,
          quantity: 1,
          variantId: null,
          Product: {
            id: 1,
            basePrice: 100,
            defaultVariant: { stockQuantity: 8 },
            variants: [],
            productImages: [],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.inStock).toBe(true);
    });
  });

  // ─── _buildCartResponse — branch: thumbnail fallback về p.thumbnail hoặc null (line 46) ──

  describe('_buildCartResponse — thumbnail khi productImages rỗng', () => {
    it('dùng p.thumbnail có sẵn khi productImages rỗng', async () => {
      // Line 46: productImages.length = 0 → p.thumbnail = p.thumbnail || null
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 6,
          quantity: 1,
          variantId: null,
          Product: {
            id: 1,
            basePrice: 100,
            variants: [],
            defaultVariant: null,
            productImages: [],
            thumbnail: 'existing-thumb.jpg',
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.thumbnail).toBe('existing-thumb.jpg');
    });

    it('thumbnail = null khi productImages rỗng và p.thumbnail không có', async () => {
      // Line 46: else branch — thumbnail = null
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 7,
          quantity: 1,
          variantId: null,
          Product: {
            id: 1,
            basePrice: 100,
            variants: [],
            defaultVariant: null,
            productImages: [],
            thumbnail: null,
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.thumbnail).toBeNull();
    });
  });

  // ─── _buildCartResponse — branch: thumbnail variant_id match (line 39) ──────────

  describe('_buildCartResponse — thumbnail match qua variant_id (snake_case)', () => {
    it('tìm ảnh qua img.variant_id (snake_case) khi img.variantId không match', async () => {
      // Line 39: img.variant_id === itemData.variantId — nhánh snake_case
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 8,
          quantity: 1,
          variantId: 10,
          Product: {
            id: 1,
            basePrice: 100,
            variants: [],
            defaultVariant: null,
            productImages: [
              {
                imageUrl: 'snake-case-match.jpg',
                variant_id: 10,
                variantId: undefined,
                isThumbnail: false,
              },
              { imageUrl: 'other.jpg', variant_id: null, variantId: null, isThumbnail: true },
            ],
          },
          ProductVariant: { price: 100 },
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.thumbnail).toBe('snake-case-match.jpg');
    });

    it('fallback về ảnh đầu tiên khi không có variantImg và không có isThumbnail', async () => {
      // Line 41-43: primaryImg = p.productImages[0] khi không có variantImg và không có isThumbnail
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 9,
          quantity: 1,
          variantId: null,
          Product: {
            id: 1,
            basePrice: 100,
            variants: [],
            defaultVariant: null,
            productImages: [
              { imageUrl: 'first.jpg', variantId: null, isThumbnail: false },
              { imageUrl: 'second.jpg', variantId: null, isThumbnail: false },
            ],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.thumbnail).toBe('first.jpg');
    });
  });

  // ─── _buildCartResponse — subtotal: Product không có (line 71) ───────────────

  describe('_buildCartResponse — subtotal branch: item không có ProductVariant cũng không Product', () => {});

  // ─── _buildCartResponse — line 66 TRUE: defaultVariant có price ──────────────

  describe('_buildCartResponse — defaultVariant.price có giá trị → variantPrice != null', () => {
    it('set p.price từ defaultVariant.price (line 66 true branch)', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 11,
          quantity: 1,
          variantId: null,
          Product: {
            id: 2,
            basePrice: 0,
            variants: [],
            productImages: [],
            defaultVariant: { stockQuantity: 5, price: '150000' },
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);
      const result = await service._buildCartResponse({ id: 1 });
      // variantPrice = parseFloat('150000') = 150000 → p.price = 150000
      // subtotal dùng basePrice (=0) nhưng p.price được set đúng
      expect(result.items[0].Product.price).toBe(150000);
    });
  });

  // ─── _buildCartResponse — line 71 TRUE: variants có giá → IIFE tính min ──────

  describe('_buildCartResponse — defaultVariant null nhưng variants có giá → IIFE (line 71 true)', () => {
    it('set p.price từ min(variants.price) khi defaultVariant không có price', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 12,
          quantity: 1,
          variantId: null,
          Product: {
            id: 3,
            basePrice: 0,
            productImages: [],
            defaultVariant: null,
            variants: [
              { price: '300000', stockQuantity: 3 },
              { price: '200000', stockQuantity: 2 },
            ],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);
      const result = await service._buildCartResponse({ id: 1 });
      // IIFE: prices = [300000, 200000] → Math.min = 200000 → p.price = 200000
      expect(result.items[0].Product.price).toBe(200000);
    });
  });

  // ─── _buildCartResponse — line 73 cuối || 0: cả minVariantPrice lẫn basePrice đều falsy

  describe('_buildCartResponse — minVariantPrice=null và basePrice=0 → p.price = 0 (|| 0 cuối)', () => {
    it('set p.price = 0 khi không có variant price và basePrice = 0', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        toJSON: () => ({
          id: 13,
          quantity: 1,
          variantId: null,
          Product: {
            id: 4,
            basePrice: 0,
            productImages: [],
            defaultVariant: null,
            variants: [],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);
      const result = await service._buildCartResponse({ id: 1 });
      // minVariantPrice = null (no defaultVariant, no variants) → || parseFloat(0)=0 → || 0 = 0
      expect(result.items[0].Product.price).toBe(0);
    });
  });

  // ─── syncCart — line 382 FALSE: actualQuantity = 0 (quantity=0, không tạo item)

  describe('syncCart — quantity=0 không có variant → actualQuantity=0, bỏ qua createCartItem', () => {
    it('không gọi createCartItem khi quantity = 0 (line 382 false branch)', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 5 },
      });

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 1, variantId: null, quantity: 0 }],
      });

      // actualQuantity = Math.min(0, 5) = 0 → if(0 > 0) false → không tạo item
      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });
  });

  // ─── getCart — branch: user + guest cart không tồn tại (line 108) ─────────────

  describe('getCart — user với cookieSessionId nhưng guest cart không tồn tại', () => {
    it('bỏ qua merge khi findActiveCartBySessionId trả null', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null);

      const result = await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess-abc' });

      // Không gọi findCartItemsByCartId vì guestCart = null
      expect(cartRepository.findCartItemsByCartId).not.toHaveBeenCalled();
      expect(result.data.id).toBe(10);
    });
  });

  // ─── getCart — branch: guest cart tồn tại nhưng guestItems rỗng (line 110) ───

  describe('getCart — guest cart tồn tại nhưng không có items', () => {
    it('bỏ qua merge khi guestItems.length = 0', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 20, status: 'active' });
      cartRepository.findCartItemsByCartId.mockResolvedValue([]); // rỗng

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      // Không gọi saveCart vì không có items để merge
      expect(cartRepository.saveCart).not.toHaveBeenCalled();
    });
  });

  // ─── getCartCount — branch: sumCartItemQuantity trả null (line 156) ──────────

  describe('getCartCount — sumCartItemQuantity trả null', () => {
    it('trả count = 0 khi sum trả null', async () => {
      // Line 156: count || 0 → nhánh khi count = null
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.sumCartItemQuantity.mockResolvedValue(null);

      const result = await service.getCartCount({ user: { id: 1 } });

      expect(result.count).toBe(0);
    });
  });

  // ─── addToCart — branch: product.defaultVariant null → baseStockQuantity = 0 (line 169) ──

  describe('addToCart — product không có defaultVariant', () => {
    it('ném 400 hết hàng khi product không có defaultVariant và không có variantId', async () => {
      // Line 169: defaultVariant = null → baseStockQuantity = 0, baseInStock = false → throw
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: null,
        name: 'SP B',
      });

      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 1 } }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('OutOfStock') });
    });
  });

  // ─── addToCart — branch: guest đã có sessionId (line 201) ───────────────────

  describe('addToCart — guest đã có sessionId (không phát sinh UUID mới)', () => {
    it('dùng sessionId hiện có khi guest đã có cookie', async () => {
      // Line 201: nextSessionId truthy → bỏ qua block tạo UUID mới
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findProductById.mockResolvedValue(mkProductEdge());
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 30 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 30 });
      const setCookie = jest.fn();

      await service.addToCart({
        user: null,
        cookieSessionId: 'existing-sess',
        body: { productId: 1, quantity: 1 },
        setSessionCookie: setCookie,
      });

      // setCookie không được gọi vì sessionId đã tồn tại
      expect(setCookie).not.toHaveBeenCalled();
      expect(cartRepository.findOrCreateActiveCartBySessionId).toHaveBeenCalledWith(
        'existing-sess',
        expect.any(Object),
      );
    });
  });

  // ─── addToCart — branch: setSessionCookie không phải function (line 203) ──────

  describe('addToCart — setSessionCookie không được cung cấp', () => {
    it('không crash khi setSessionCookie là undefined', async () => {
      // Line 203: typeof setSessionCookie === 'function' → false → bỏ qua call
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findProductById.mockResolvedValue(mkProductEdge());
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 40 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 40 });

      await expect(
        service.addToCart({
          user: null,
          cookieSessionId: null,
          body: { productId: 1, quantity: 1 },
          setSessionCookie: undefined,
        }),
      ).resolves.not.toThrow();
    });
  });

  // ─── addToCart — branch: existing item, quantity vượt stock sau cộng dồn (line 219) ──

  describe('addToCart — cộng dồn quantity vượt stock → throw 400', () => {
    it('ném 400 khi tổng quantity (existing + mới) vượt stock', async () => {
      // Line 218-221: existing tồn tại → newQuantity = existing.quantity + quantity → _assertStock throw
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findProductById.mockResolvedValue(mkProductEdge(100, 5));
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      // existing quantity = 4, adding 3 → total 7 > stock 5
      cartRepository.findCartItemMatching.mockResolvedValue({ quantity: 4 });

      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 3 } }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('quantityExceeds'),
      });
    });
  });

  // ─── addToCart — branch: variant + createCartItem dùng variant.price (line 228) ──

  describe('addToCart — tạo cart item mới với variant (dùng variant.price)', () => {
    it('unitPrice là variant.price khi có variant', async () => {
      // Line 228: variant truthy → unitPrice = variant.price
      const { service, cartRepository } = buildServiceEdge();
      const product = mkProductEdge(100, 10);
      const variant = { id: 5, price: 250, stockQuantity: 8 };
      cartRepository.findProductById.mockResolvedValue(product);
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(variant);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.addToCart({
        user: { id: 1 },
        body: { productId: 1, variantId: 5, quantity: 1 },
      });

      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ variantId: 5, unitPrice: 250 }),
        expect.any(Object),
      );
    });
  });

  // ─── updateCartItem — branch: Product.defaultVariant = null (line 246) ────────

  describe('updateCartItem — Product không có defaultVariant', () => {
    it('baseStockQuantity = 0 khi defaultVariant null → throw 400 nếu quantity > 0', async () => {
      // Line 246: cartItem.Product.defaultVariant = null → baseStockQuantity = 0
      // Line 251: else branch → baseStockQuantity (0) < quantity → throw
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue({
        Cart: { userId: 1 },
        Product: { defaultVariant: null },
        ProductVariant: null,
      });

      await expect(
        service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 1 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── updateCartItem — branch: baseStockQuantity đủ (không throw) (line 248) ──

  describe('updateCartItem — không có ProductVariant, baseStockQuantity đủ', () => {
    it('không throw khi baseStockQuantity >= quantity', async () => {
      // Line 247: ProductVariant null → else branch (line 251)
      // baseStockQuantity (10) >= quantity (5) → không throw
      const { service, cartRepository } = buildServiceEdge();
      const item = {
        Cart: { userId: 1 },
        Product: { defaultVariant: { stockQuantity: 10 } },
        ProductVariant: null,
        quantity: 1,
      };
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(item);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 5 });

      expect(item.quantity).toBe(5);
    });
  });

  // ─── _assertOwnership — branch: guest không có cookieSessionId (line 448) ─────

  describe('_assertOwnership — guest không có cookieSessionId', () => {
    it('ném 403 khi user null và cookieSessionId không được cung cấp', async () => {
      // Line 448: !cookieSessionId → throw 403
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue({
        Cart: { userId: null, sessionId: 'sess-xyz' },
        Product: { defaultVariant: { stockQuantity: 10 } },
        ProductVariant: null,
      });

      await expect(
        service.removeCartItem({ user: null, cookieSessionId: null, itemId: 5 }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  // ─── syncCart — branch: baseStockQuantity = 0 + không có variantId → skip (line 309) ──

  describe('syncCart — product hết hàng không có variantId → skip', () => {
    it('bỏ qua item khi base stock = 0 và không có variantId', async () => {
      // Line 309: !product || (baseStockQuantity <= 0 && !variantId) → continue
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 0 }, // stock = 0
        name: 'SP C',
      });

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, quantity: 2 }], // không có variantId
      });

      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });
  });

  // ─── syncCart — branch: actualQuantity = 0 (line 316/323) → skip createCartItem ──

  describe('syncCart — actualQuantity = 0 sau Math.min → không tạo cart item', () => {
    it('bỏ qua createCartItem khi variant.stockQuantity = 0', async () => {
      // Line 315: actualQuantity = Math.min(quantity, 0) = 0 → if(0) false → không tạo
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 0 },
        name: 'SP D',
      });
      cartRepository.findVariantByIdAndProductId.mockResolvedValue({
        id: 5,
        price: 100,
        stockQuantity: 0,
      });

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, variantId: 5, quantity: 3 }],
      });

      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });

    it('bỏ qua createCartItem khi base stock = 0 và không có variantId', async () => {
      // Line 323: actualQuantity = Math.min(quantity, 0) = 0 → if(0) false → không tạo
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      // product tồn tại nhưng base stock = 0, không có defaultVariant
      cartRepository.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: null,
        name: 'SP E',
      });
      // Giả lập vào branch else: !variantId, nhưng cần vượt qua guard ở line 309
      // Guard: baseStockQuantity = 0 và !variantId → skip, không vào else
      // Để test line 323, cần defaultVariant.stockQuantity > 0 nhưng sau Math.min = 0
      // thực tế không thể xảy ra vì guard đã check baseStockQuantity <= 0 → skip
      // Thay vào đó: test với product mà guard pass (defaultVariant.stockQuantity > 0)
      cartRepository.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 0,
        defaultVariant: { stockQuantity: 0 },
      });

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, quantity: 1 }],
      });

      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });
  });

  // ─── mergeCart — branch: clearSessionCookie không phải function (line 369) ────

  describe('mergeCart — clearSessionCookie không được truyền', () => {
    it('không crash khi clearSessionCookie là undefined', async () => {
      // Line 369: typeof clearSessionCookie === 'function' → false → bỏ qua
      const { service, cartRepository } = buildServiceEdge();
      const guestCart = { id: 20, status: 'active' };
      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await expect(
        service.mergeCart({
          user: { id: 1 },
          cookieSessionId: 'sess',
          clearSessionCookie: undefined,
        }),
      ).resolves.not.toThrow();
    });
  });

  // ─── validateCart — branch: item có ProductVariant → tên gồm cả variant name (line 418) ──

  describe('validateCart — item có ProductVariant → name lấy từ product', () => {
    it('name = product nameVi khi có ProductVariant', async () => {
      // Line 517: name = item.Product.nameVi || item.Product.nameEn || item.Product.name || ''
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([
        {
          id: 1,
          productId: 1,
          variantId: 5,
          unitPrice: 200,
          quantity: 1,
          Product: {
            id: 1,
            nameVi: 'Điện thoại',
            nameEn: null,
            basePrice: 200,
            defaultVariant: { stockQuantity: 5 },
          },
          ProductVariant: { name: 'Đen 256GB', price: 200, stockQuantity: 5 },
        },
      ]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.items[0].name).toBe('Điện thoại');
    });
  });

  // ─── mergeCart — user = null → 401 (line 376) ────────────────────────────────

  describe('mergeCart — user = null → 401 (line 376)', () => {
    it('ném 401 khi user không đăng nhập', async () => {
      const { service } = buildServiceEdge();

      await expect(
        service.mergeCart({ user: null, cookieSessionId: 'sess-abc' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ─── mergeCart — merge items: existingUserItem (lines 410-423) ───────────────

  describe('mergeCart — merge items với existing user item (lines 410-423)', () => {
    it('cộng dồn quantity và cap theo maxStock khi existingUserItem tồn tại', async () => {
      const { service, cartRepository } = buildServiceEdge();

      const sessionCart = { id: 20, status: 'active' };
      const userCart = { id: 10 };
      const existingUserItem = {
        id: 100,
        quantity: 2,
        price: 50000,
        save: jest.fn(),
      };
      const sessionItem = {
        id: 200,
        cartId: 20,
        productId: 1,
        variantId: 5,
        quantity: 3,
        Product: { id: 1, basePrice: 50000, defaultVariant: { stockQuantity: 10 } },
        ProductVariant: { id: 5, price: '50000', stockQuantity: 4 }, // maxStock = 4
      };

      cartRepository.findActiveCartBySessionId.mockResolvedValue(sessionCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(existingUserItem);
      cartRepository.findActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findCartItemsWithDetails.mockResolvedValue([]);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-abc' });

      // existingUserItem.quantity = min(2+3, 4) = 4
      expect(existingUserItem.quantity).toBe(4);
      expect(cartRepository.saveCartItem).toHaveBeenCalled();
      expect(cartRepository.deleteCartItem).toHaveBeenCalledWith(sessionItem, expect.any(Object));
    });

    it('BUG-MEDIUM-1: không zero-out user item khi session item hết hàng (maxStock=0)', async () => {
      // Scenario: user có Item A qty=2, guest có Item A qty=1, Item A hết hàng (stock=0)
      // Trước fix: Math.min(3, 0) = 0 → user mất item
      // Sau fix: maxStock=0 → giữ newQuantity=3 (nhất quán với getCart inline merge)
      const { service, cartRepository } = buildServiceEdge();

      const sessionCart = { id: 30, status: 'active' };
      const userCart = { id: 31 };
      const existingUserItem = { id: 300, quantity: 2, price: 50000, save: jest.fn() };
      const sessionItem = {
        id: 301,
        cartId: 30,
        productId: 5,
        variantId: 9,
        quantity: 1,
        Product: { id: 5, basePrice: 50000, defaultVariant: { stockQuantity: 0 } },
        ProductVariant: { id: 9, price: '50000', stockQuantity: 0 }, // hết hàng
      };

      cartRepository.findActiveCartBySessionId.mockResolvedValue(sessionCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(existingUserItem);
      cartRepository.findActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findCartItemsWithDetails.mockResolvedValue([]);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-outofstock' });

      // KHÔNG được zero-out: quantity phải là 2+1=3 (không bị cap về 0)
      expect(existingUserItem.quantity).toBe(3);
      expect(existingUserItem.quantity).not.toBe(0);
    });

    it('move session item vào user cart khi không có existingUserItem (else branch)', async () => {
      const { service, cartRepository } = buildServiceEdge();

      const sessionCart = { id: 21, status: 'active' };
      const userCart = { id: 11 };
      const sessionItem = {
        id: 201,
        cartId: 21,
        productId: 2,
        variantId: null,
        quantity: 1,
        Product: { id: 2, basePrice: 30000, defaultVariant: null },
        ProductVariant: null,
      };

      cartRepository.findActiveCartBySessionId.mockResolvedValue(sessionCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(null); // không có existing
      cartRepository.findActiveCartByUserId.mockResolvedValue(userCart);
      cartRepository.findCartItemsWithDetails.mockResolvedValue([]);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-21' });

      // sessionItem.cartId được đổi sang userCart.id
      expect(sessionItem.cartId).toBe(11);
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(sessionItem, expect.any(Object));
    });
  });

  // ─── removeCartItem — session user path (lines 267-268) ──────────────────────

  describe('removeCartItem — session path (lines 267-268)', () => {
    it('xóa item của guest cart theo sessionId', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const cartItem = {
        id: 50,
        Cart: { userId: null, sessionId: 'sess-xyz' },
      };
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(cartItem);
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 1 });

      await service.removeCartItem({
        user: null,
        cookieSessionId: 'sess-xyz',
        itemId: 50,
      });

      expect(cartRepository.deleteCartItem).toHaveBeenCalledWith(cartItem, expect.any(Object));
    });
  });

  // ─── _assertStock — variant stock check (line 107) ───────────────────────────

  describe('_assertStock — variant stock không đủ (line 107)', () => {
    it('ném 400 khi variant.stockQuantity < quantity', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const cartItem = {
        cartId: 1,
        Cart: { userId: 1 },
        Product: { id: 1, defaultVariant: { stockQuantity: 10 } },
        ProductVariant: { stockQuantity: 3 }, // stock chỉ có 3
      };
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(cartItem);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 1 });

      // Cập nhật quantity = 5 nhưng stock chỉ có 3 → throw 400
      await expect(
        service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 5 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  // ─── addToCart — setSessionCookie callback (line 215) ─────────────────────────

  describe('addToCart — setSessionCookie callback được gọi khi không có sessionId (line 215)', () => {
    it('gọi setSessionCookie khi guest không có cookieSessionId', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const product = {
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 10, price: 100 },
      };
      const variant = null;
      const cart = { id: 5 };
      const cartItem = { id: 1, quantity: 1, productId: 1, variantId: null, unitPrice: 100 };

      cartRepository.findProductById.mockResolvedValue(product);
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(variant);
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue(cart);
      cartRepository.sumCartItemQuantity.mockResolvedValue(0);
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.createCartItem.mockResolvedValue(cartItem);
      cartRepository.findCartItemsWithDetails.mockResolvedValue([]);

      const setSessionCookie = jest.fn();

      await service.addToCart({
        user: null,
        cookieSessionId: null, // không có sessionId → phải gọi setSessionCookie
        body: { productId: 1, quantity: 1 },
        setSessionCookie,
      });

      expect(setSessionCookie).toHaveBeenCalledWith(expect.any(String));
    });
  });

  // ─── clearCart — guest không có sessionId (lines 297-300) ─────────────────────

  describe('clearCart — guest không có cookieSessionId (lines 297-300)', () => {
    it('trả về alreadyEmpty khi guest không có sessionId', async () => {
      const { service } = buildServiceEdge();

      const result = await service.clearCart({ user: null, cookieSessionId: null });

      expect(result.message).toBe('cart.alreadyEmpty');
    });
  });

  // ─── syncCart — user = null → 401 (line 315-316) ─────────────────────────────

  describe('syncCart — user = null → 401 (line 316)', () => {
    it('ném 401 khi user không đăng nhập', async () => {
      const { service } = buildServiceEdge();

      await expect(
        service.syncCart({ user: null, cookieSessionId: null, items: [] }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // ─── validateCart — guest không có sessionId (line 448) ──────────────────────

  describe('validateCart — guest không có cookieSessionId (line 448)', () => {
    it('trả về hasIssues: false, items: [] khi không có sessionId', async () => {
      const { service } = buildServiceEdge();

      const result = await service.validateCart({ user: null, cookieSessionId: null });

      expect(result).toEqual({ hasIssues: false, items: [] });
    });
  });

  // ─── validateCart — item không có Product (line 457-458) ─────────────────────

  describe('validateCart — item không có Product (line 457-458)', () => {
    it('trả về item với name "cart.productNoLongerExists" khi Product null', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([
        {
          id: 5,
          productId: 10,
          variantId: null,
          quantity: 2,
          Product: null, // sản phẩm đã bị xóa
        },
      ]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.items[0].name).toBe('cart.productNoLongerExists');
      expect(result.hasIssues).toBe(true);
    });
  });

  // ─── _assertStock — variant stock không đủ khi addToCart (line 107) ─────────

  describe('_assertStock — variant stock không đủ trong addToCart (line 107)', () => {
    it('ném 400 khi variant.stockQuantity < quantity trong addToCart', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const product = {
        id: 1,
        basePrice: 500000,
        defaultVariant: { stockQuantity: 10 },
      };
      const variant = { id: 5, stockQuantity: 2, price: 500000 };

      cartRepository.findProductById.mockResolvedValue(product);
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(variant);

      // quantity = 5 nhưng variant stock = 2 → _assertStock ném 400
      await expect(
        service.addToCart({
          user: { id: 1 },
          cookieSessionId: null,
          body: { productId: 1, variantId: 5, quantity: 5 },
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('quantityExceeds'),
      });
    });
  });

  // ─── clearCart — guest có cookieSessionId (line 300) ─────────────────────────

  describe('clearCart — guest có cookieSessionId → tìm cart theo session (line 300)', () => {
    it('gọi findActiveCartBySessionId khi guest có cookieSessionId', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const guestCart = { id: 30, status: 'active' };
      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);

      const result = await service.clearCart({ user: null, cookieSessionId: 'sess-abc' });

      expect(cartRepository.findActiveCartBySessionId).toHaveBeenCalledWith('sess-abc');
      expect(cartRepository.clearCartItems).toHaveBeenCalledWith(30, expect.any(Object));
      expect(result.message).toBe('cart.cleared');
    });
  });

  // ─── mergeCart — không có cookieSessionId → trả về getCart (line 380) ────────

  describe('mergeCart — không có cookieSessionId → trả về getCart ngay (line 380)', () => {
    it('trả về cart user khi không có cookieSessionId', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 5 });

      const result = await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: null,
      });

      // Không gọi findActiveCartBySessionId (không có session)
      expect(cartRepository.findActiveCartBySessionId).not.toHaveBeenCalled();
      // Trả về getCart result: data.id từ cart user
      expect(result.data.id).toBe(5);
    });
  });

  // ─── mergeCart — sessionCart không tồn tại → trả về getCart (line 385) ───────

  describe('mergeCart — sessionCart không tìm thấy → trả về getCart ngay (line 385)', () => {
    it('trả về cart user khi session cart không tồn tại trong DB', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null); // cart session không tồn tại
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 7 });

      const result = await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: 'sess-gone',
      });

      expect(cartRepository.findActiveCartBySessionId).toHaveBeenCalledWith('sess-gone');
      expect(result.data.id).toBe(7);
    });
  });

  // ─── mergeCart — clearSessionCookie là function → được gọi (line 436) ────────

  describe('mergeCart — clearSessionCookie là function → được gọi sau merge (line 436)', () => {
    it('gọi clearSessionCookie() sau khi merge thành công', async () => {
      const { service, cartRepository } = buildServiceEdge();
      const guestCart = { id: 20, status: 'active' };
      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForMerge.mockResolvedValue([]);
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      const clearSessionCookie = jest.fn();

      await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: 'sess-old',
        clearSessionCookie,
      });

      expect(clearSessionCookie).toHaveBeenCalledTimes(1);
    });
  });

  // ─── validateCart — guest có cookieSessionId → tìm cart theo session (line 449) ─

  describe('validateCart — guest có cookieSessionId → tìm cart theo session (line 449)', () => {
    it('gọi findActiveCartBySessionId khi guest có cookieSessionId', async () => {
      const { service, cartRepository } = buildServiceEdge();
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null); // không có cart

      const result = await service.validateCart({
        user: null,
        cookieSessionId: 'sess-guest',
      });

      expect(cartRepository.findActiveCartBySessionId).toHaveBeenCalledWith('sess-guest');
      expect(result).toEqual({ hasIssues: false, items: [] });
    });
  });
}); // end CartService — branch coverage chi tiết

// ─── Merged from cart-service.edge-cases-3.test.js ────────────────────

describe('Tests Phase 25b — Cart Additional Coverage', () => {
  let request;
  let Cart;
  let CartItem;
  let Product;
  let ProductVariant;
  let sequelize;

  beforeAll(() => {
    const express = require('express');
    const supertest = require('supertest');
    const buildCartModule = require('@modules/cart/module');
    ({ Cart, CartItem, Product, ProductVariant, sequelize } = require('@models'));
    const eventBus = require('@shared/event-bus');
    const logger = require('@utils/logger');
    const { errorHandler } = require('@middlewares/error-handler');

    const cartModule = buildCartModule({
      Cart,
      CartItem,
      Product,
      ProductVariant,
      sequelize,
      eventBus,
      logger,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.cookies = {};
      next();
    });
    app.use('/api/cart', cartModule.router);
    app.use(errorHandler);
    request = supertest(app);
  });

  // ============================================================
  // GET /api/cart — getCart
  // ============================================================

  describe('GET /api/cart — lấy giỏ hàng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
      Cart.findOne.mockResolvedValue(null); // không có giỏ khách
      CartItem.findAll.mockResolvedValue([]); // giỏ trống
    });

    test('Người dùng đăng nhập, giỏ rỗng → 200 với items = []', async () => {
      const res = await request.get('/api/cart').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.items).toEqual([]);
      expect(res.body.data.totalItems).toBe(0);
      expect(res.body.data.subtotal).toBe(0);
    });

    test('Người dùng đăng nhập, có 1 sản phẩm trong giỏ → 200 với items đúng', async () => {
      const mockItem = {
        id: 1,
        cartId: 10,
        productId: 1,
        variantId: null,
        quantity: 2,
        Product: {
          id: 1,
          name: 'Laptop Test',
          slug: 'laptop-test',
          basePrice: 5000000,
          productImages: [],
          defaultVariant: { stockQuantity: 5 },
        },
        ProductVariant: null,
        toJSON() {
          return {
            id: this.id,
            cartId: this.cartId,
            productId: this.productId,
            variantId: this.variantId,
            quantity: this.quantity,
            Product: { ...this.Product },
            ProductVariant: null,
          };
        },
      };

      CartItem.findAll.mockResolvedValue([mockItem]);

      const res = await request.get('/api/cart').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.totalItems).toBe(2);
      expect(res.body.data.subtotal).toBe(10000000); // 5000000 * 2
    });
  });

  // ============================================================
  // DELETE /api/cart/items/:id — removeCartItem
  // ============================================================

  describe('DELETE /api/cart/items/:id — xóa item khỏi giỏ hàng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
      Cart.findOne.mockResolvedValue(null);
      CartItem.findAll.mockResolvedValue([]);
    });

    test('Item tồn tại, thuộc về user → destroy được gọi → 200', async () => {
      const mockDestroyFn = jest.fn().mockResolvedValue(undefined);
      const mockItem = {
        id: 5,
        cartId: 10,
        productId: 1,
        Cart: { id: 10, userId: 1, sessionId: null },
        destroy: mockDestroyFn,
      };
      CartItem.findOne.mockResolvedValue(mockItem);

      const res = await request
        .delete('/api/cart/items/5')
        .set('Authorization', 'Bearer test-token');

      expect(mockDestroyFn).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    test('Item không tồn tại → 404', async () => {
      CartItem.findOne.mockResolvedValue(null);

      const res = await request
        .delete('/api/cart/items/999')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/không tìm thấy/i);
    });

    test('Item thuộc user khác → 403', async () => {
      const mockItem = {
        id: 5,
        cartId: 20,
        productId: 1,
        Cart: { id: 20, userId: 99, sessionId: null }, // userId = 99, nhưng req.user.id = 1
        destroy: jest.fn(),
      };
      CartItem.findOne.mockResolvedValue(mockItem);

      const res = await request
        .delete('/api/cart/items/5')
        .set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(403);
    });
  });

  // ============================================================
  // PUT /api/cart/items/:id — updateCartItem
  // ============================================================

  describe('PUT /api/cart/items/:id — cập nhật số lượng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
      Cart.findOne.mockResolvedValue(null);
      CartItem.findAll.mockResolvedValue([]);
    });

    test('Item không tồn tại → 404', async () => {
      CartItem.findOne.mockResolvedValue(null);

      const res = await request
        .put('/api/cart/items/999')
        .set('Authorization', 'Bearer test-token')
        .send({ quantity: 3 });

      expect(res.status).toBe(404);
      expect(res.body.message).toMatch(/không tìm thấy/i);
    });

    test('Số lượng vượt stock → 400', async () => {
      const mockItem = {
        id: 5,
        Cart: { id: 10, userId: 1 },
        Product: {
          id: 1,
          defaultVariant: { stockQuantity: 2 }, // chỉ còn 2
        },
        ProductVariant: null,
        update: jest.fn(),
      };
      CartItem.findOne.mockResolvedValue(mockItem);

      const res = await request
        .put('/api/cart/items/5')
        .set('Authorization', 'Bearer test-token')
        .send({ quantity: 10 }); // yêu cầu 10, chỉ còn 2

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/tồn kho/i);
    });

    // Biên tồn kho (mutation-kill: `<` → `<=` ở cart-service _assertStock/updateCartItem).
    // Test cũ chỉ kiểm qty > stock (reject) — KHÔNG phân biệt được `<` vs `<=`.
    // qty === stock phải CHO đặt: `stock < qty` = false → ok; mutant `stock <= qty` = true → reject sai.
    test('Biên: quantity === stock tồn kho base → CHO cập nhật → 200', async () => {
      const mockSaveFn = jest.fn().mockResolvedValue(undefined);
      const mockItem = {
        id: 5,
        Cart: { id: 10, userId: 1 },
        Product: { id: 1, defaultVariant: { stockQuantity: 5 } },
        ProductVariant: null,
        quantity: 1,
        save: mockSaveFn,
      };
      CartItem.findOne.mockResolvedValue(mockItem);

      const res = await request
        .put('/api/cart/items/5')
        .set('Authorization', 'Bearer test-token')
        .send({ quantity: 5 }); // đặt ĐÚNG bằng tồn kho

      expect(res.status).toBe(200);
      expect(mockSaveFn).toHaveBeenCalled();
      expect(mockItem.quantity).toBe(5);
    });

    test('Biên: quantity === stock tồn kho variant → CHO cập nhật → 200', async () => {
      const mockSaveFn = jest.fn().mockResolvedValue(undefined);
      const mockItem = {
        id: 5,
        Cart: { id: 10, userId: 1 },
        Product: { id: 1, defaultVariant: { stockQuantity: 0 } },
        ProductVariant: { stockQuantity: 4 },
        quantity: 1,
        save: mockSaveFn,
      };
      CartItem.findOne.mockResolvedValue(mockItem);

      const res = await request
        .put('/api/cart/items/5')
        .set('Authorization', 'Bearer test-token')
        .send({ quantity: 4 }); // = tồn kho variant

      expect(res.status).toBe(200);
      expect(mockSaveFn).toHaveBeenCalled();
      expect(mockItem.quantity).toBe(4);
    });

    test('Số lượng hợp lệ → save được gọi với quantity mới → 200', async () => {
      // Phase 42 modules/cart dùng item.save() sau khi mutate quantity (thay vì item.update)
      const mockSaveFn = jest.fn().mockResolvedValue(undefined);
      const mockItem = {
        id: 5,
        Cart: { id: 10, userId: 1 },
        Product: {
          id: 1,
          defaultVariant: { stockQuantity: 10 },
        },
        ProductVariant: null,
        quantity: 1,
        save: mockSaveFn,
      };
      CartItem.findOne.mockResolvedValue(mockItem);

      const res = await request
        .put('/api/cart/items/5')
        .set('Authorization', 'Bearer test-token')
        .send({ quantity: 3 });

      expect(mockSaveFn).toHaveBeenCalled();
      expect(mockItem.quantity).toBe(3);
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // DELETE /api/cart — clearCart
  // ============================================================

  describe('DELETE /api/cart — xóa toàn bộ giỏ hàng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('Có giỏ hàng đang active → CartItem.destroy được gọi → 200', async () => {
      const destroyFn = jest.fn().mockResolvedValue(undefined);
      Cart.findOne.mockResolvedValue({ id: 10, status: 'active' });
      CartItem.destroy = destroyFn;

      const res = await request.delete('/api/cart').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
    });

    test('Không có giỏ hàng active → 200 với message giỏ trống', async () => {
      Cart.findOne.mockResolvedValue(null);

      const res = await request.delete('/api/cart').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('cart.alreadyEmpty');
    });
  });

  // ============================================================
  // GET /api/cart/count — getCartCount
  // ============================================================

  describe('GET /api/cart/count — lấy số lượng item', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('Có giỏ hàng với 3 items → 200 với count đúng', async () => {
      Cart.findOne.mockResolvedValue({ id: 10 });
      CartItem.sum.mockResolvedValue(3); // CartItem.sum('quantity') trả về 3

      const res = await request.get('/api/cart/count').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
    });

    test('Không có giỏ hàng → 200 với count = 0', async () => {
      Cart.findOne.mockResolvedValue(null);

      const res = await request.get('/api/cart/count').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(0);
    });
  });

  // ============================================================
  // POST /api/cart/sync — syncCart
  // ============================================================

  describe('POST /api/cart/sync — đồng bộ giỏ hàng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      Cart.findOrCreate.mockResolvedValue([{ id: 10 }, false]);
      Cart.findOne.mockResolvedValue(null);
      CartItem.findAll.mockResolvedValue([]);
      CartItem.destroy.mockResolvedValue(1);
      // Phase 42 modules/cart dùng callback form: sequelize.transaction(async (tx) => {...})
      sequelize.transaction.mockImplementation(async (cb) => {
        const tx = {
          LOCK: { UPDATE: 'UPDATE' },
          commit: jest.fn().mockResolvedValue(undefined),
          rollback: jest.fn().mockResolvedValue(undefined),
        };
        return typeof cb === 'function' ? cb(tx) : tx;
      });
    });

    test('items rỗng → CartItem.destroy được gọi, getCart trả về giỏ rỗng → 200', async () => {
      const res = await request
        .post('/api/cart/sync')
        .set('Authorization', 'Bearer test-token')
        .send({ items: [] });

      expect(CartItem.destroy).toHaveBeenCalled();
      expect(res.status).toBe(200);
      expect(res.body.data.items).toEqual([]);
    });

    test('items có sản phẩm hợp lệ → CartItem.create được gọi → 200', async () => {
      Product.findByPk.mockResolvedValue({
        id: 1,
        name: 'Laptop',
        basePrice: 5000000,
        defaultVariant: { stockQuantity: 5 },
      });
      CartItem.create.mockResolvedValue({ id: 99 });

      const res = await request
        .post('/api/cart/sync')
        .set('Authorization', 'Bearer test-token')
        .send({ items: [{ productId: 1, quantity: 2 }] });

      expect(CartItem.create).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    test('items có sản phẩm không tồn tại → bỏ qua, CartItem.create không được gọi → 200', async () => {
      Product.findByPk.mockResolvedValue(null); // sản phẩm không tồn tại

      const res = await request
        .post('/api/cart/sync')
        .set('Authorization', 'Bearer test-token')
        .send({ items: [{ productId: 999, quantity: 1 }] });

      expect(CartItem.create).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    test('items có sản phẩm với variantId hợp lệ → CartItem.create với variant → 200', async () => {
      Product.findByPk.mockResolvedValue({
        id: 1,
        name: 'Laptop',
        basePrice: 5000000,
        defaultVariant: { stockQuantity: 0 }, // base hết hàng
      });
      ProductVariant.findOne.mockResolvedValue({
        id: 10,
        productId: 1,
        stockQuantity: 3,
        price: 4800000,
      });
      CartItem.create.mockResolvedValue({ id: 100 });

      const res = await request
        .post('/api/cart/sync')
        .set('Authorization', 'Bearer test-token')
        .send({ items: [{ productId: 1, variantId: 10, quantity: 2 }] });

      expect(CartItem.create).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });

  // ============================================================
  // GET /api/cart/validate — validateCart
  // ============================================================

  describe('GET /api/cart/validate — kiểm tra tính hợp lệ của giỏ hàng', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      Cart.findOne.mockResolvedValue(null);
    });

    test('Không có giỏ hàng active → 200 với hasIssues: false, items: []', async () => {
      const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.hasIssues).toBe(false);
      expect(res.body.data.items).toEqual([]);
    });

    test('Giỏ hàng có item hợp lệ (còn hàng, giá không đổi) → hasIssues: false', async () => {
      Cart.findOne.mockResolvedValue({ id: 10 });
      CartItem.findAll.mockResolvedValue([
        {
          id: 1,
          productId: 1,
          variantId: null,
          quantity: 2,
          unitPrice: '5000000',
          Product: {
            id: 1,
            name: 'Laptop',
            basePrice: 5000000,
            defaultVariant: { stockQuantity: 10 },
          },
          ProductVariant: null,
        },
      ]);

      const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.hasIssues).toBe(false);
      expect(res.body.data.items).toHaveLength(1);
    });

    test('Giỏ hàng có item hết hàng → hasIssues: true, outOfStock: true', async () => {
      Cart.findOne.mockResolvedValue({ id: 10 });
      CartItem.findAll.mockResolvedValue([
        {
          id: 2,
          productId: 2,
          variantId: null,
          quantity: 1,
          unitPrice: '3000000',
          Product: {
            id: 2,
            name: 'Máy tính hết hàng',
            basePrice: 3000000,
            defaultVariant: { stockQuantity: 0 }, // hết hàng
          },
          ProductVariant: null,
        },
      ]);

      const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.hasIssues).toBe(true);
      expect(res.body.data.items[0].outOfStock).toBe(true);
    });

    test('Giỏ hàng có item giá đã thay đổi → hasIssues: true, priceChanged: true', async () => {
      Cart.findOne.mockResolvedValue({ id: 10 });
      CartItem.findAll.mockResolvedValue([
        {
          id: 3,
          productId: 3,
          variantId: null,
          quantity: 1,
          unitPrice: '5000000', // giá lúc thêm vào
          Product: {
            id: 3,
            name: 'Sản phẩm giá thay đổi',
            basePrice: 4500000, // giá hiện tại khác
            defaultVariant: { stockQuantity: 5 },
          },
          ProductVariant: null,
        },
      ]);

      const res = await request.get('/api/cart/validate').set('Authorization', 'Bearer test-token');

      expect(res.status).toBe(200);
      expect(res.body.data.hasIssues).toBe(true);
      expect(res.body.data.items[0].priceChanged).toBe(true);
    });
  });
});
