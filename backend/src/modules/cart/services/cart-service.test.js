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
      findActiveWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
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
      cartRepository.findCartItemMatching.mockResolvedValue(null);  // không có existing

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
        service.addToCart({ user: { id: 1 }, body: { productId: 99 } })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('product hết hàng + không có variant → 400', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 0));
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 1 } })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hết hàng') });
    });

    test('quantity vượt stock → 400', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 5));
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 10 } })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('tồn kho') });
    });

    test('variant không tồn tại → 404', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(null);
      await expect(
        service.addToCart({ user: { id: 1 }, body: { productId: 1, variantId: 5, quantity: 1 } })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('warranty package không hợp lệ → 400', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findActiveWarrantyPackagesByIds.mockResolvedValue([{ id: 1 }]);
      await expect(
        service.addToCart({
          user: { id: 1 },
          body: { productId: 1, quantity: 1, warrantyPackageIds: [1, 2] },
        })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('bảo hành') });
    });

    test('warranty packages hợp lệ → validWarrantyPackageIds được populate (line 191)', async () => {
      // Trường hợp này: warranties.length === warrantyPackageIds.length
      // → KHÔNG throw → đi vào line 191: validWarrantyPackageIds = warranties.map(w => w.id)
      // → item được tạo với warrantyPackageIds đúng
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findActiveWarrantyPackagesByIds.mockResolvedValue([
        { id: 10 },
        { id: 20 },
      ]);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 5 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 5 });

      await service.addToCart({
        user: { id: 1 },
        body: { productId: 1, quantity: 1, warrantyPackageIds: [10, 20] },
      });

      // Xác nhận item được tạo với warrantyPackageIds đã được map từ warranties
      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ warrantyPackageIds: [10, 20] }),
        expect.any(Object)
      );
    });

    test('user thêm item mới → tạo cart + tạo cart item', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.addToCart({
        user: { id: 1 },
        body: { productId: 1, quantity: 2 },
      });

      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 10, productId: 1, quantity: 2, unitPrice: 100 }),
        expect.any(Object)
      );
    });

    test('user thêm item đã có → cộng dồn quantity (không tạo mới)', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const existing = { quantity: 1 };
      cartRepository.findCartItemMatching.mockResolvedValue(existing);
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 2 } });

      expect(existing.quantity).toBe(3);
      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });

    test('guest chưa có sessionId → cấp uuid mới qua setSessionCookie', async () => {
      cartRepository.findProductById.mockResolvedValue(mkProduct());
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 30 });
      cartRepository.findCartItemMatching.mockResolvedValue(null);
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 30 });
      const setCookie = jest.fn();

      await service.addToCart({
        user: null, cookieSessionId: null,
        body: { productId: 1, quantity: 1 },
        setSessionCookie: setCookie,
      });

      expect(setCookie).toHaveBeenCalledWith(expect.any(String));
      const sessId = setCookie.mock.calls[0][0];
      expect(sessId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('updateCartItem', () => {
    test('không tìm thấy item → 404', async () => {
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(null);
      await expect(
        service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 2 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user khác chủ cart → 403', async () => {
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue({
        Cart: { userId: 99 },
        Product: { defaultVariant: { stockQuantity: 5 } },
      });
      await expect(
        service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 2 })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('quantity vượt stock variant → 400', async () => {
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue({
        Cart: { userId: 1 },
        Product: { defaultVariant: { stockQuantity: 100 } },
        ProductVariant: { stockQuantity: 3 },
      });
      await expect(
        service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 10 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('hợp lệ → cập nhật quantity + save', async () => {
      const item = {
        Cart: { userId: 1 },
        Product: { defaultVariant: { stockQuantity: 100 } },
        ProductVariant: null,
        quantity: 1,
      };
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(item);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 5 });

      expect(item.quantity).toBe(5);
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(item);
    });

    test('guest → check ownership qua sessionId', async () => {
      const item = {
        Cart: { userId: null, sessionId: 'sess' },
        Product: { defaultVariant: { stockQuantity: 100 } },
        ProductVariant: null,
        quantity: 1,
      };
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(item);
      cartRepository.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 10 });

      await service.updateCartItem({ user: null, cookieSessionId: 'sess', itemId: 5, quantity: 3 });
      expect(item.quantity).toBe(3);
    });

    test('guest khác sessionId → 403', async () => {
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue({
        Cart: { userId: null, sessionId: 'other' },
        Product: { defaultVariant: { stockQuantity: 100 } },
      });
      await expect(
        service.updateCartItem({ user: null, cookieSessionId: 'mine', itemId: 5, quantity: 1 })
      ).rejects.toMatchObject({ statusCode: 403 });
    });
  });

  describe('removeCartItem', () => {
    test('không tìm thấy → 404', async () => {
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(null);
      await expect(
        service.removeCartItem({ user: { id: 1 }, itemId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('hợp lệ → xóa item', async () => {
      const item = { Cart: { userId: 1 }, Product: { defaultVariant: { stockQuantity: 5 } } };
      cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue(item);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.removeCartItem({ user: { id: 1 }, itemId: 5 });

      expect(cartRepository.deleteCartItem).toHaveBeenCalledWith(item);
    });
  });

  describe('clearCart', () => {
    test('user không có cart → message empty', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue(null);
      const result = await service.clearCart({ user: { id: 1 } });
      expect(result.message).toBe('cart.alreadyEmpty');
    });

    test('user có cart → clear items + return cart structure', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      const result = await service.clearCart({ user: { id: 1 } });
      expect(cartRepository.clearCartItems).toHaveBeenCalledWith(10);
      expect(result.data).toEqual({ id: 10, items: [], totalItems: 0, subtotal: 0 });
    });

    test('guest không có sessionId → message empty', async () => {
      const result = await service.clearCart({ user: null, cookieSessionId: null });
      expect(result.message).toBe('cart.alreadyEmpty');
    });
  });

  describe('syncCart', () => {
    test('không có user → 401', async () => {
      await expect(
        service.syncCart({ user: null, items: [] })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('user có item hợp lệ → clear cũ + tạo lại', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue(mkProduct(50, 5));
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, quantity: 3 }],
      });

      expect(cartRepository.clearCartItems).toHaveBeenCalled();
      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 1, quantity: 3, unitPrice: 50 }),
        expect.any(Object)
      );
    });

    test('quantity vượt stock → cap về stock thực', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue(mkProduct(100, 2));
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, quantity: 99 }],
      });

      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 2 }),  // capped
        expect.any(Object)
      );
    });

    test('product không tồn tại → skip silent', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue(null);
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 99, quantity: 1 }],
      });

      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });
  });

  describe('mergeCart', () => {
    test('chưa login → 401', async () => {
      await expect(
        service.mergeCart({ user: null })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('không có sessionId → trả user cart hiện tại', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: null });

      expect(cartRepository.findActiveCartBySessionId).not.toHaveBeenCalled();
    });

    test('có sessionId nhưng không có guest cart → trả user cart', async () => {
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      expect(cartRepository.findCartItemsForMerge).not.toHaveBeenCalled();
    });

    test('merge thành công → clearSessionCookie callback được gọi', async () => {
      const guestCart = { id: 20, status: 'active' };
      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

      const clearCookie = jest.fn();
      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess', clearSessionCookie: clearCookie });

      expect(guestCart.status).toBe('merged');
      expect(clearCookie).toHaveBeenCalled();
    });
  });

  describe('validateCart', () => {
    test('không có cart → hasIssues=false', async () => {
      const result = await service.validateCart({ user: null, cookieSessionId: null });
      expect(result).toEqual({ hasIssues: false, items: [] });
    });

    test('item bị xóa product → hasIssue=true outOfStock=true', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([{
        id: 1, productId: 99, variantId: null, Product: null,
      }]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.hasIssues).toBe(true);
      expect(result.items[0].outOfStock).toBe(true);
    });

    test('giá thay đổi → priceChanged=true', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([{
        id: 1, productId: 1, variantId: null,
        unitPrice: 50, quantity: 1,
        Product: { id: 1, name: 'P', basePrice: 75, defaultVariant: { stockQuantity: 10 } },
        ProductVariant: null,
      }]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.items[0].priceChanged).toBe(true);
      expect(result.items[0].savedPrice).toBe(50);
      expect(result.items[0].currentPrice).toBe(75);
    });

    test('quantity > stock → quantityExceedsStock=true', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([{
        id: 1, productId: 1, variantId: null,
        unitPrice: 100, quantity: 10,
        Product: { id: 1, name: 'P', basePrice: 100, defaultVariant: { stockQuantity: 3 } },
        ProductVariant: null,
      }]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.items[0].quantityExceedsStock).toBe(true);
      expect(result.items[0].maxStock).toBe(3);
    });

    test('item hợp lệ → hasIssue=false', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([{
        id: 1, productId: 1, variantId: null,
        unitPrice: 100, quantity: 2,
        Product: { id: 1, name: 'P', basePrice: 100, defaultVariant: { stockQuantity: 10 } },
        ProductVariant: null,
      }]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.hasIssues).toBe(false);
      expect(result.items[0].hasIssue).toBe(false);
    });

    test('guest có sessionId → dùng findActiveCartBySessionId', async () => {
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 5 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([]);

      const result = await service.validateCart({ user: null, cookieSessionId: 'sess' });

      expect(cartRepository.findActiveCartBySessionId).toHaveBeenCalledWith('sess');
      expect(result.hasIssues).toBe(false);
    });

    test('guest cart không tồn tại → hasIssues=false', async () => {
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null);

      const result = await service.validateCart({ user: null, cookieSessionId: 'sess' });

      expect(result).toEqual({ hasIssues: false, items: [] });
    });

    test('item dùng ProductVariant → lấy giá và stock từ variant', async () => {
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
      cartRepository.findCartItemsForValidation.mockResolvedValue([{
        id: 2, productId: 1, variantId: 10,
        unitPrice: 200, quantity: 1,
        Product: { id: 1, name: 'P', basePrice: 150, defaultVariant: { stockQuantity: 5 } },
        ProductVariant: { name: 'Black 128GB', price: 200, stockQuantity: 3 },
      }]);

      const result = await service.validateCart({ user: { id: 1 } });

      expect(result.items[0].currentPrice).toBe(200);
      expect(result.items[0].maxStock).toBe(3);
      expect(result.items[0].priceChanged).toBe(false);
    });
  });

  describe('_buildCartResponse', () => {
    test('tính subtotal đúng khi có warrantyPackages', async () => {
      const item = {
        toJSON: () => ({
          id: 1, quantity: 2, variantId: null, warrantyPackageIds: [10],
          Product: {
            id: 1, name: 'P', basePrice: 100, variants: [], defaultVariant: null,
            productImages: [],
          },
          ProductVariant: null,
        }),
        quantity: 2,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);
      cartRepository.findActiveWarrantyPackagesByIds.mockResolvedValue([
        { id: 10, name: 'Bảo hành 1 năm', price: 50, durationMonths: 12 },
      ]);

      const result = await service._buildCartResponse({ id: 1 });

      // subtotal = (basePrice * qty) + (warrantyPrice * qty) = (100 * 2) + (50 * 2) = 300
      expect(result.subtotal).toBe(300);
      expect(result.items[0].warrantyPackages).toHaveLength(1);
    });

    test('tính subtotal dùng ProductVariant.price khi có variant', async () => {
      const item = {
        toJSON: () => ({
          id: 2, quantity: 3, variantId: 5, warrantyPackageIds: [],
          Product: { id: 1, basePrice: 100, variants: [], defaultVariant: null, productImages: [] },
          ProductVariant: { price: 200 },
        }),
        quantity: 3,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      // subtotal = 200 * 3 = 600
      expect(result.subtotal).toBe(600);
    });

    test('thumbnail từ ảnh variantId trùng khớp', async () => {
      const item = {
        toJSON: () => ({
          id: 3, quantity: 1, variantId: 7, warrantyPackageIds: [],
          Product: {
            id: 1, basePrice: 100, variants: [], defaultVariant: null,
            productImages: [
              { imageUrl: 'variant.jpg', variantId: 7, isThumbnail: false },
              { imageUrl: 'main.jpg', variantId: null, isThumbnail: true },
            ],
          },
          ProductVariant: { price: 100 },
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.thumbnail).toBe('variant.jpg');
    });

    test('thumbnail fallback về isThumbnail khi không có variantId match', async () => {
      const item = {
        toJSON: () => ({
          id: 4, quantity: 1, variantId: null, warrantyPackageIds: [],
          Product: {
            id: 1, basePrice: 100, variants: [], defaultVariant: null,
            productImages: [
              { imageUrl: 'first.jpg', variantId: null, isThumbnail: false },
              { imageUrl: 'thumb.jpg', variantId: null, isThumbnail: true },
            ],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      expect(result.items[0].Product.thumbnail).toBe('thumb.jpg');
    });

    test('tính variantStock từ tổng variants.stockQuantity', async () => {
      const item = {
        toJSON: () => ({
          id: 5, quantity: 1, variantId: null, warrantyPackageIds: [],
          Product: {
            id: 1, basePrice: 100, defaultVariant: null,
            variants: [{ stockQuantity: 3 }, { stockQuantity: 7 }],
            productImages: [],
          },
          ProductVariant: null,
        }),
        quantity: 1,
      };
      cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

      const result = await service._buildCartResponse({ id: 1 });

      // variantStock = 3 + 7 = 10
      expect(result.items[0].Product.stockQuantity).toBe(10);
      expect(result.items[0].Product.inStock).toBe(true);
    });
  });

  describe('_assertStock', () => {
    test('variant stock đủ → không throw', () => {
      expect(() => service._assertStock({
        product: mkProduct(100, 5),
        variant: { stockQuantity: 10 },
        quantity: 5,
      })).not.toThrow();
    });

    test('variant stock thiếu → throw 400', () => {
      expect(() => service._assertStock({
        product: mkProduct(100, 100),
        variant: { stockQuantity: 2 },
        quantity: 5,
      })).toThrow(expect.objectContaining({ statusCode: 400 }));
    });

    test('không có variant + base stock đủ → không throw', () => {
      expect(() => service._assertStock({
        product: mkProduct(100, 10),
        variant: null,
        quantity: 5,
      })).not.toThrow();
    });

    test('không có variant + base stock thiếu → throw 400', () => {
      expect(() => service._assertStock({
        product: mkProduct(100, 2),
        variant: null,
        quantity: 5,
      })).toThrow(expect.objectContaining({ statusCode: 400 }));
    });
  });

  describe('clearCart — additional paths', () => {
    test('guest có sessionId nhưng không có cart → message empty', async () => {
      cartRepository.findActiveCartBySessionId.mockResolvedValue(null);
      const result = await service.clearCart({ user: null, cookieSessionId: 'sess' });
      expect(result.message).toBe('cart.alreadyEmpty');
    });

    test('guest có cart → clear items và trả data', async () => {
      cartRepository.findActiveCartBySessionId.mockResolvedValue({ id: 30 });
      const result = await service.clearCart({ user: null, cookieSessionId: 'sess' });
      expect(cartRepository.clearCartItems).toHaveBeenCalledWith(30);
      expect(result.data.id).toBe(30);
    });
  });

  describe('syncCart — additional paths', () => {
    test('item có variantId → tạo với variant price, capped theo stock', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue(mkProduct(50, 0));
      const variant = { stockQuantity: 3, price: 150 };
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(variant);

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, variantId: 5, quantity: 99 }],
      });

      expect(cartRepository.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ quantity: 3, unitPrice: 150, variantId: 5 }),
        expect.any(Object)
      );
    });

    test('variantId → variant không tồn tại → skip item', async () => {
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findProductById.mockResolvedValue(mkProduct(50, 0));
      cartRepository.findVariantByIdAndProductId.mockResolvedValue(null);

      await service.syncCart({
        user: { id: 1 },
        items: [{ productId: 1, variantId: 99, quantity: 2 }],
      });

      expect(cartRepository.createCartItem).not.toHaveBeenCalled();
    });
  });

  describe('mergeCart — additional paths', () => {
    test('merge guest item trùng → cộng dồn quantity nhưng cap theo stock', async () => {
      const guestCart = { id: 20, status: 'active' };
      const product = mkProduct(100, 5);
      const sessionItem = {
        productId: 1, variantId: null, quantity: 4,
        Product: product,
        ProductVariant: null,
        cartId: 20,
        price: 100,
      };

      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);

      const existingUserItem = { quantity: 3, price: 100 };
      cartRepository.findCartItemMatching.mockResolvedValue(existingUserItem);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      // newQuantity = 3 + 4 = 7, maxStock từ defaultVariant = 5 → cap to 5
      expect(existingUserItem.quantity).toBe(5);
    });

    test('merge guest item không trùng → chuyển sessionItem sang user cart', async () => {
      const guestCart = { id: 20, status: 'active' };
      const product = mkProduct(100, 10);
      const sessionItem = {
        productId: 1, variantId: null, quantity: 2,
        Product: product,
        ProductVariant: null,
        cartId: 20,
        price: 100,
      };

      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(null);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      expect(sessionItem.cartId).toBe(10);
      expect(cartRepository.saveCartItem).toHaveBeenCalledWith(sessionItem, expect.any(Object));
    });

    test('merge với variant → lấy price từ ProductVariant', async () => {
      const guestCart = { id: 20, status: 'active' };
      const product = mkProduct(100, 10);
      const sessionItem = {
        productId: 1, variantId: 5, quantity: 1,
        Product: product,
        ProductVariant: { price: '250', stockQuantity: 5 },
        cartId: 20,
        price: 0,
      };

      cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
      cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      cartRepository.findCartItemMatching.mockResolvedValue(null);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess' });

      // price phải được refresh từ ProductVariant.price
      expect(sessionItem.price).toBe(250);
    });
  });
});
