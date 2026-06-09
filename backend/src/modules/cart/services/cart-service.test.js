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
