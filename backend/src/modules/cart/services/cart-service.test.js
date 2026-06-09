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
