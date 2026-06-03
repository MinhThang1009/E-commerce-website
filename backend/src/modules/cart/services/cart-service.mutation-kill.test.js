// Cart service — mutation-kill: assert OUTCOME nghiệp vụ (giá/kho/status/quyền)
// + atomicity (transaction-arg truyền đúng vào repo). Giết survivor còn lại sau
// khi coverage 100%: ObjectLiteral {} (criteria/transaction), guard boundary,
// display calc trong _buildCartResponse, error message, ownership 403.
//
// Pattern: new CartService với mock repo + TX sentinel để phân biệt {transaction}
// với {} (mutant atomicity). KHÔNG dùng HTTP — assert trực tiếp args/outcome.

const CartService = require('./cart-service');

// Sentinel nhận diện transaction object do runInTransaction cấp — nếu mutant
// đổi { transaction } → {} thì arg sẽ KHÁC TX → assertion fail → mutant chết.
const TX = { __isTransaction: true };

function makeRepo(overrides = {}) {
  return {
    findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
    findOrCreateActiveCartByUserId: jest.fn().mockResolvedValue({ id: 10 }),
    findOrCreateActiveCartBySessionId: jest.fn().mockResolvedValue({ id: 20 }),
    findActiveCartBySessionId: jest.fn().mockResolvedValue(null),
    findActiveCartByUserId: jest.fn().mockResolvedValue(null),
    findCartItemsByCartId: jest.fn().mockResolvedValue([]),
    findCartItemMatching: jest.fn().mockResolvedValue(null),
    saveCartItem: jest.fn().mockResolvedValue(),
    deleteCartItem: jest.fn().mockResolvedValue(),
    saveCart: jest.fn().mockResolvedValue(),
    sumCartItemQuantity: jest.fn().mockResolvedValue(0),
    findProductById: jest.fn(),
    findVariantByIdAndProductId: jest.fn(),
    createCartItem: jest.fn().mockResolvedValue({ id: 1 }),
    findCartItemByIdWithCartAndStock: jest.fn().mockResolvedValue(null),
    clearCartItems: jest.fn().mockResolvedValue(),
    findCartItemsForValidation: jest.fn().mockResolvedValue([]),
    findCartItemsForMerge: jest.fn().mockResolvedValue([]),
    runInTransaction: jest.fn(async (work) => work(TX)),
    ...overrides,
  };
}

function makeService(repo) {
  return new CartService({
    cartRepository: repo,
    eventBus: { publish: jest.fn() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });
}

// Helper tạo cartItem có toJSON (như Sequelize instance)
function cartItem(raw) {
  return { ...raw, toJSON: () => JSON.parse(JSON.stringify(raw)) };
}

describe('CartService — mutation kill (OUTCOME + atomicity)', () => {
  // ──────────────────────────────────────────────────────────────
  // _buildCartResponse — display calc (stock/inStock/price/subtotal)
  // ──────────────────────────────────────────────────────────────
  describe('getCart → _buildCartResponse: tính toán hiển thị', () => {
    test('stockQuantity = TỔNG stock các variant (L40-43 reduce +)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            variants: [
              { stockQuantity: 3, price: 100 },
              { stockQuantity: 4, price: 120 },
            ],
            defaultVariant: { stockQuantity: 9, price: 100 },
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      // 3 + 4 = 7 (mutant sum- → -1; ArrayDeclaration → ["Stryker.."] sẽ NaN/khác)
      expect(data.items[0].Product.stockQuantity).toBe(7);
      expect(data.items[0].Product.inStock).toBe(true);
    });

    test('variantStock = 0 → fallback defaultVariant.stockQuantity + inStock theo defaultVariant', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            variants: [{ stockQuantity: 0, price: 100 }],
            defaultVariant: { stockQuantity: 5, price: 100 },
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.stockQuantity).toBe(5);
      expect(data.items[0].Product.inStock).toBe(true);
    });

    test('variantStock = 0 và defaultVariant stock = 0 → inStock = false', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            variants: [{ stockQuantity: 0, price: 100 }],
            defaultVariant: { stockQuantity: 0, price: 100 },
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.inStock).toBe(false);
    });

    test('không có productImages → thumbnail = product.thumbnail (else block L64)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            thumbnail: 'existing-thumb.jpg',
            variants: [{ stockQuantity: 3, price: 100 }],
            defaultVariant: { stockQuantity: 3, price: 100 },
            productImages: [],
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.thumbnail).toBe('existing-thumb.jpg');
    });

    test('ưu tiên ảnh isThumbnail=true khi không có variantId match (L57-62)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          variantId: null,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            variants: [{ stockQuantity: 3, price: 100 }],
            defaultVariant: { stockQuantity: 3, price: 100 },
            productImages: [
              { variant_id: null, variantId: null, imageUrl: 'first.jpg', isThumbnail: false },
              { variant_id: null, variantId: null, imageUrl: 'thumb.jpg', isThumbnail: true },
            ],
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      // mutant isThumbnail===true → !==true / false sẽ chọn first.jpg
      expect(data.items[0].Product.thumbnail).toBe('thumb.jpg');
    });

    test('price = MIN giá variant khi không có defaultVariant.price (L71-78)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 999,
            variants: [
              { stockQuantity: 3, price: 150 },
              { stockQuantity: 4, price: 120 },
            ],
            defaultVariant: { stockQuantity: 7 }, // không có price
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      // min(150,120)=120 (mutant map/filter/Math.min sẽ ra 150 hoặc basePrice 999)
      expect(data.items[0].Product.price).toBe(120);
    });

    test('variant giá 0 bị filter(Boolean) loại → price = min variant DƯƠNG (L74 filter)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 999,
            variants: [
              { stockQuantity: 3, price: 0 },
              { stockQuantity: 4, price: 200 },
            ],
            defaultVariant: { stockQuantity: 7 }, // không có price
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      // filter(Boolean) loại price 0 → min(200)=200. Mutant bỏ filter → min(0,200)=0 →
      // 0 falsy → fallback basePrice 999. Assert 200 phân biệt cả 2.
      expect(data.items[0].Product.price).toBe(200);
    });

    test('product.name fallback nameVi → nameEn → name → "" (L39)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: null,
            nameEn: 'English Name',
            basePrice: 100,
            variants: [{ stockQuantity: 3, price: 100 }],
            defaultVariant: { stockQuantity: 3, price: 100 },
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.name).toBe('English Name');
    });

    test('totalItems = Σ quantity, subtotal = Σ(price×qty) dùng ProductVariant.price', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 2,
          productId: 1,
          variantId: 5,
          Product: { id: 1, nameVi: 'A', basePrice: 100, variants: [], defaultVariant: null },
          ProductVariant: { id: 5, price: 50, stockQuantity: 10 },
        }),
        cartItem({
          id: 2,
          quantity: 3,
          productId: 2,
          Product: { id: 2, nameVi: 'B', basePrice: 30, variants: [], defaultVariant: null },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.totalItems).toBe(5); // 2 + 3
      expect(data.subtotal).toBe(50 * 2 + 30 * 3); // 190 (variant.price + Product.basePrice)
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getCart — merge guest cart inline (criteria + status + log)
  // ──────────────────────────────────────────────────────────────
  describe('getCart — auto-merge guest cart', () => {
    test('item guest TRÙNG → cộng quantity, save existing, xóa guest item; tìm bằng đúng criteria', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99 });
      const guestItem = { id: 7, productId: 3, variantId: 5, quantity: 2, cartId: 99 };
      repo.findCartItemsByCartId.mockResolvedValue([guestItem]);
      const existing = { id: 8, quantity: 4 };
      repo.findCartItemMatching.mockResolvedValue(existing);
      const service = makeService(repo);

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'guest-sess' });

      expect(repo.findCartItemMatching).toHaveBeenCalledWith({
        cartId: 10,
        productId: 3,
        variantId: 5,
      });
      expect(existing.quantity).toBe(6); // 4 + 2
      expect(repo.saveCartItem).toHaveBeenCalledWith(existing);
      expect(repo.deleteCartItem).toHaveBeenCalledWith(guestItem);
    });

    test('item guest MỚI → reassign cartId sang user cart + save', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99 });
      const guestItem = { id: 7, productId: 3, variantId: null, quantity: 2, cartId: 99 };
      repo.findCartItemsByCartId.mockResolvedValue([guestItem]);
      repo.findCartItemMatching.mockResolvedValue(null);
      const service = makeService(repo);

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'guest-sess' });

      expect(guestItem.cartId).toBe(10);
      expect(repo.saveCartItem).toHaveBeenCalledWith(guestItem);
    });

    test('sau merge → guest cart status = "merged" và được save', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const guestCart = { id: 99, status: 'active' };
      repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
      repo.findCartItemsByCartId.mockResolvedValue([
        { id: 7, productId: 3, variantId: null, quantity: 2 },
      ]);
      repo.findCartItemMatching.mockResolvedValue(null);
      const service = makeService(repo);

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'guest-sess' });

      expect(guestCart.status).toBe('merged');
      expect(repo.saveCart).toHaveBeenCalledWith(guestCart);
    });

    test('guest cart rỗng (không item) → KHÔNG đổi status, KHÔNG log', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, status: 'active' });
      repo.findCartItemsByCartId.mockResolvedValue([]);
      const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
      const service = new CartService({
        cartRepository: repo,
        eventBus: { publish: jest.fn() },
        logger,
      });

      await service.getCart({ user: { id: 1 }, cookieSessionId: 'guest-sess' });

      expect(repo.saveCart).not.toHaveBeenCalled();
      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // getCartCount — count outcome + !cart guard
  // ──────────────────────────────────────────────────────────────
  describe('getCartCount', () => {
    test('cart tồn tại → trả count THẬT từ sumCartItemQuantity (không phải 0)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.sumCartItemQuantity.mockResolvedValue(7);
      const service = makeService(repo);

      const result = await service.getCartCount({ user: { id: 1 }, cookieSessionId: null });

      expect(result.count).toBe(7);
      expect(repo.sumCartItemQuantity).toHaveBeenCalledWith(10);
    });

    test('không tìm thấy cart → count = 0 (guard L178)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue(null);
      const service = makeService(repo);

      const result = await service.getCartCount({ user: { id: 1 }, cookieSessionId: null });

      expect(result.count).toBe(0);
      expect(repo.sumCartItemQuantity).not.toHaveBeenCalled();
    });

    test('guest không có cookieSessionId → count = 0, không query', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      const result = await service.getCartCount({ user: null, cookieSessionId: null });

      expect(result.count).toBe(0);
      expect(repo.findActiveCartBySessionId).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // addToCart — criteria/data/transaction args + variantId||null
  // ──────────────────────────────────────────────────────────────
  describe('addToCart — atomicity + criteria + data', () => {
    const product = {
      id: 1,
      basePrice: 100,
      defaultVariant: { stockQuantity: 10, price: 100 },
    };

    test('item mới (user) → createCartItem với DATA đúng + trong transaction', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(product);
      repo.findCartItemMatching.mockResolvedValue(null);
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      await service.addToCart({
        user: { id: 1 },
        cookieSessionId: null,
        body: { productId: 1, quantity: 2 },
      });

      // findOrCreate trong transaction (mutant {transaction}→{} chết)
      expect(repo.findOrCreateActiveCartByUserId).toHaveBeenCalledWith(1, { transaction: TX });
      // createCartItem data đúng (mutant data→{} chết) + transaction
      expect(repo.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({
          cartId: 10,
          productId: 1,
          variantId: null,
          quantity: 2,
          unitPrice: 100,
        }),
        { transaction: TX },
      );
    });

    test('item có variant → unitPrice = variant.price, variantId truyền đúng (L232 ||null)', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue({ id: 5, price: 250, stockQuantity: 10 });
      repo.findCartItemMatching.mockResolvedValue(null);
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      await service.addToCart({
        user: { id: 1 },
        cookieSessionId: null,
        body: { productId: 1, variantId: 5, quantity: 1 },
      });

      expect(repo.findCartItemMatching).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 10, productId: 1, variantId: 5 }),
        { transaction: TX },
      );
      expect(repo.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ variantId: 5, unitPrice: 250 }),
        { transaction: TX },
      );
    });

    test('item TRÙNG → cộng dồn quantity vào existing + save trong transaction', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(product);
      const existing = { id: 8, quantity: 3 };
      repo.findCartItemMatching.mockResolvedValue(existing);
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      await service.addToCart({
        user: { id: 1 },
        cookieSessionId: null,
        body: { productId: 1, quantity: 2 },
      });

      expect(existing.quantity).toBe(5); // 3 + 2
      expect(repo.saveCartItem).toHaveBeenCalledWith(existing, { transaction: TX });
      expect(repo.createCartItem).not.toHaveBeenCalled();
    });

    test('sản phẩm không tồn tại → AppError 404 "Sản phẩm không tồn tại"', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(null);
      const service = makeService(repo);

      await expect(
        service.addToCart({ user: { id: 1 }, cookieSessionId: null, body: { productId: 99 } }),
      ).rejects.toThrow('Sản phẩm không tồn tại');
    });

    test('hết hàng (defaultVariant stock 0, không variant) → AppError "Sản phẩm đã hết hàng"', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 0 },
      });
      const service = makeService(repo);

      await expect(
        service.addToCart({ user: { id: 1 }, cookieSessionId: null, body: { productId: 1 } }),
      ).rejects.toThrow('Sản phẩm đã hết hàng');
    });

    test('variantId không tồn tại → AppError "Biến thể sản phẩm không tồn tại" (L205)', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(product);
      repo.findVariantByIdAndProductId.mockResolvedValue(null);
      const service = makeService(repo);

      await expect(
        service.addToCart({
          user: { id: 1 },
          cookieSessionId: null,
          body: { productId: 1, variantId: 5, quantity: 1 },
        }),
      ).rejects.toThrow('Biến thể sản phẩm không tồn tại');
    });

    test('guest không sessionId → tạo sessionId mới qua findOrCreateActiveCartBySessionId trong transaction', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(product);
      repo.findCartItemMatching.mockResolvedValue(null);
      repo.findOrCreateActiveCartBySessionId.mockResolvedValue({ id: 20 });
      const setSessionCookie = jest.fn();
      const service = makeService(repo);

      await service.addToCart({
        user: null,
        cookieSessionId: null,
        body: { productId: 1, quantity: 1 },
        setSessionCookie,
      });

      expect(setSessionCookie).toHaveBeenCalledTimes(1);
      const newSessionId = setSessionCookie.mock.calls[0][0];
      expect(repo.findOrCreateActiveCartBySessionId).toHaveBeenCalledWith(newSessionId, {
        transaction: TX,
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // clearCart — guards (user / guest no-session / cart null)
  // ──────────────────────────────────────────────────────────────
  describe('clearCart', () => {
    test('guest không cookieSessionId → message alreadyEmpty, KHÔNG query', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      const result = await service.clearCart({ user: null, cookieSessionId: null });

      expect(result.message).toBe('cart.alreadyEmpty');
      expect(repo.findActiveCartBySessionId).not.toHaveBeenCalled();
    });

    test('cart không tồn tại → message alreadyEmpty, không clear', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue(null);
      const service = makeService(repo);

      const result = await service.clearCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.message).toBe('cart.alreadyEmpty');
      expect(repo.clearCartItems).not.toHaveBeenCalled();
    });

    test('cart tồn tại → clear items + trả message cleared + data rỗng', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      const result = await service.clearCart({ user: { id: 1 }, cookieSessionId: null });

      expect(repo.clearCartItems).toHaveBeenCalledWith(10);
      expect(result.message).toBe('cart.cleared');
      expect(result.data).toEqual({ id: 10, items: [], totalItems: 0, subtotal: 0 });
    });

    test('guest có cookieSessionId → query theo session', async () => {
      const repo = makeRepo();
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 20 });
      const service = makeService(repo);

      await service.clearCart({ user: null, cookieSessionId: 'sess-1' });

      expect(repo.findActiveCartBySessionId).toHaveBeenCalledWith('sess-1');
      expect(repo.clearCartItems).toHaveBeenCalledWith(20);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // syncCart — auth guard + criteria + cap stock + transaction + skip
  // ──────────────────────────────────────────────────────────────
  describe('syncCart', () => {
    test('không login → AppError 401 "Bạn cần đăng nhập để đồng bộ giỏ hàng" (L321)', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await expect(
        service.syncCart({ user: null, cookieSessionId: null, items: [] }),
      ).rejects.toThrow('Bạn cần đăng nhập để đồng bộ giỏ hàng');
    });

    test('clear cart cũ + createCartItem variant với qty cap theo stock, trong transaction', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 5 },
      });
      repo.findVariantByIdAndProductId.mockResolvedValue({ id: 5, price: 250, stockQuantity: 3 });
      const service = makeService(repo);

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 1, variantId: 5, quantity: 10 }],
      });

      expect(repo.clearCartItems).toHaveBeenCalledWith(10, { transaction: TX });
      // qty cap = min(10, 3) = 3 ; unitPrice = variant.price
      expect(repo.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({
          cartId: 10,
          productId: 1,
          variantId: 5,
          quantity: 3,
          unitPrice: 250,
        }),
        { transaction: TX },
      );
    });

    test('item không variant → createCartItem base với unitPrice = basePrice, qty cap baseStock', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findProductById.mockResolvedValue({
        id: 2,
        basePrice: 80,
        defaultVariant: { stockQuantity: 4 },
      });
      const service = makeService(repo);

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 2, quantity: 10 }],
      });

      expect(repo.createCartItem).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 10, productId: 2, quantity: 4, unitPrice: 80 }),
        { transaction: TX },
      );
    });

    test('variant không tồn tại → bỏ qua item (không create)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findProductById.mockResolvedValue({
        id: 1,
        basePrice: 100,
        defaultVariant: { stockQuantity: 5 },
      });
      repo.findVariantByIdAndProductId.mockResolvedValue(null);
      const service = makeService(repo);

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 1, variantId: 999, quantity: 2 }],
      });

      expect(repo.createCartItem).not.toHaveBeenCalled();
    });

    test('product không tồn tại → bỏ qua item', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findProductById.mockResolvedValue(null);
      const service = makeService(repo);

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 99, quantity: 2 }],
      });

      expect(repo.createCartItem).not.toHaveBeenCalled();
    });

    test('product null + có variantId → continue NGAY, KHÔNG gọi findVariant (guard !product L336)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findProductById.mockResolvedValue(null);
      const service = makeService(repo);

      await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [{ productId: 99, variantId: 5, quantity: 2 }],
      });

      // !product → continue trước khi vào nhánh variantId (mutant ||→&& hoặc if→false sẽ gọi findVariant)
      expect(repo.findVariantByIdAndProductId).not.toHaveBeenCalled();
      expect(repo.createCartItem).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // mergeCart — auth + early returns + price refresh + cap + transaction
  // ──────────────────────────────────────────────────────────────
  describe('mergeCart', () => {
    test('không login → AppError 401 "Bạn cần đăng nhập để thực hiện chức năng này" (L381)', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      await expect(service.mergeCart({ user: null, cookieSessionId: 'x' })).rejects.toThrow(
        'Bạn cần đăng nhập để thực hiện chức năng này',
      );
    });

    test('không cookieSessionId → trả getCart, KHÔNG merge (không tìm session cart)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: null });

      expect(repo.findActiveCartBySessionId).not.toHaveBeenCalled();
      expect(repo.runInTransaction).not.toHaveBeenCalled();
    });

    test('session cart không tồn tại → trả getCart, không merge', async () => {
      const repo = makeRepo();
      repo.findActiveCartBySessionId.mockResolvedValue(null);
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-x' });

      expect(repo.runInTransaction).not.toHaveBeenCalled();
    });

    test('item TRÙNG → cộng quantity cap stock + refresh unitPrice + delete session item, trong transaction', async () => {
      const repo = makeRepo();
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, status: 'active' });
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const sessionItem = {
        id: 7,
        productId: 3,
        variantId: 5,
        quantity: 2,
        ProductVariant: { price: '300', stockQuantity: 5 },
        Product: { basePrice: '100', defaultVariant: { stockQuantity: 5 } },
      };
      repo.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      const existingUserItem = { id: 8, quantity: 4 };
      repo.findCartItemMatching.mockResolvedValue(existingUserItem);
      const service = makeService(repo);

      await service.mergeCart({
        user: { id: 1 },
        cookieSessionId: 'sess-x',
        clearSessionCookie: jest.fn(),
      });

      // newQuantity = 4+2=6, cap maxStock=5 → 5 ; unitPrice refresh = 300 (variant)
      expect(existingUserItem.quantity).toBe(5);
      expect(existingUserItem.unitPrice).toBe(300);
      expect(repo.saveCartItem).toHaveBeenCalledWith(existingUserItem, { transaction: TX });
      expect(repo.deleteCartItem).toHaveBeenCalledWith(sessionItem, { transaction: TX });
    });

    test('item MỚI → reassign cartId + refresh unitPrice basePrice (không variant), trong transaction', async () => {
      const repo = makeRepo();
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, status: 'active' });
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const sessionItem = {
        id: 7,
        productId: 3,
        variantId: null,
        quantity: 2,
        ProductVariant: null,
        Product: { basePrice: '150', defaultVariant: { stockQuantity: 9 } },
      };
      repo.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      repo.findCartItemMatching.mockResolvedValue(null);
      const service = makeService(repo);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-x' });

      expect(sessionItem.cartId).toBe(10);
      expect(sessionItem.unitPrice).toBe(150);
      expect(repo.saveCartItem).toHaveBeenCalledWith(sessionItem, { transaction: TX });
    });

    test('sau merge → session cart status = "merged" + save trong transaction + clearSessionCookie gọi', async () => {
      const repo = makeRepo();
      const sessionCart = { id: 99, status: 'active' };
      repo.findActiveCartBySessionId.mockResolvedValue(sessionCart);
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForMerge.mockResolvedValue([]);
      const clearSessionCookie = jest.fn();
      const service = makeService(repo);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-x', clearSessionCookie });

      expect(sessionCart.status).toBe('merged');
      expect(repo.saveCart).toHaveBeenCalledWith(sessionCart, { transaction: TX });
      expect(clearSessionCookie).toHaveBeenCalledTimes(1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // validateCart — boundary (priceChanged, quantityExceedsStock, some)
  // ──────────────────────────────────────────────────────────────
  describe('validateCart — phát hiện vấn đề', () => {
    test('guest không session → hasIssues false, KHÔNG query (guard L453)', async () => {
      const repo = makeRepo();
      const service = makeService(repo);

      const result = await service.validateCart({ user: null, cookieSessionId: null });

      expect(result).toEqual({ hasIssues: false, items: [] });
      // mutant if→false sẽ bỏ qua return và gọi findActiveCartBySessionId(null) thừa
      expect(repo.findActiveCartBySessionId).not.toHaveBeenCalled();
    });

    test('cart null → hasIssues false (guard L457)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue(null);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result).toEqual({ hasIssues: false, items: [] });
    });

    test('item mất Product → outOfStock=true, hasIssue=true (L463-469)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForValidation.mockResolvedValue([
        { id: 1, productId: 3, variantId: null, quantity: 1, Product: null },
      ]);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].outOfStock).toBe(true);
      expect(result.items[0].hasIssue).toBe(true);
      expect(result.hasIssues).toBe(true);
    });

    test('unitPrice = 0 (data lỗi) → KHÔNG coi priceChanged dù currentPrice khác (boundary L485 >0)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForValidation.mockResolvedValue([
        {
          id: 1,
          productId: 3,
          variantId: null,
          quantity: 1,
          unitPrice: 0,
          Product: { nameVi: 'SP', basePrice: 200, defaultVariant: { stockQuantity: 5 } },
        },
      ]);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].priceChanged).toBe(false);
    });

    test('giá đổi (unitPrice>0 và khác current) → priceChanged=true', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForValidation.mockResolvedValue([
        {
          id: 1,
          productId: 3,
          variantId: null,
          quantity: 1,
          unitPrice: 100,
          Product: { nameVi: 'SP', basePrice: 200, defaultVariant: { stockQuantity: 5 } },
        },
      ]);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].priceChanged).toBe(true);
    });

    test('quantity = stock (boundary) → KHÔNG quá kho (L487 >, không >=)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForValidation.mockResolvedValue([
        {
          id: 1,
          productId: 3,
          variantId: null,
          quantity: 5,
          unitPrice: 100,
          Product: { nameVi: 'SP', basePrice: 100, defaultVariant: { stockQuantity: 5 } },
        },
      ]);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].quantityExceedsStock).toBe(false);
      expect(result.items[0].maxStock).toBe(5);
    });

    test('quantity > stock → quá kho = true', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForValidation.mockResolvedValue([
        {
          id: 1,
          productId: 3,
          variantId: 5,
          quantity: 6,
          unitPrice: 100,
          ProductVariant: { price: 100, stockQuantity: 5 },
          Product: { nameVi: 'SP', basePrice: 100, defaultVariant: null },
        },
      ]);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].quantityExceedsStock).toBe(true);
      expect(result.items[0].maxStock).toBe(5);
    });

    test('chỉ MỘT item có issue → hasIssues = true (some, không phải every) (L505)', async () => {
      const repo = makeRepo();
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForValidation.mockResolvedValue([
        {
          id: 1,
          productId: 3,
          variantId: null,
          quantity: 1,
          unitPrice: 100,
          Product: { nameVi: 'OK', basePrice: 100, defaultVariant: { stockQuantity: 5 } },
        },
        {
          id: 2,
          productId: 4,
          variantId: null,
          quantity: 10,
          unitPrice: 100,
          Product: { nameVi: 'HẾT', basePrice: 100, defaultVariant: { stockQuantity: 0 } },
        },
      ]);
      const service = makeService(repo);

      const result = await service.validateCart({ user: { id: 1 }, cookieSessionId: null });

      expect(result.items[0].hasIssue).toBe(false);
      expect(result.items[1].hasIssue).toBe(true);
      expect(result.hasIssues).toBe(true); // some → true ; every → sẽ false
    });
  });

  // ──────────────────────────────────────────────────────────────
  // _assertOwnership — 403 + message (L513/516/517)
  // ──────────────────────────────────────────────────────────────
  describe('updateCartItem / removeCartItem — ownership 403', () => {
    test('user khác chủ cart → 403 "Bạn không có quyền truy cập giỏ hàng này" (L513)', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue({
        id: 1,
        Cart: { userId: 999 },
        Product: { defaultVariant: { stockQuantity: 5 } },
      });
      const service = makeService(repo);

      await expect(
        service.updateCartItem({ user: { id: 1 }, cookieSessionId: null, itemId: 1, quantity: 1 }),
      ).rejects.toThrow('Bạn không có quyền truy cập giỏ hàng này');
    });

    test('guest sessionId KHỚP → cho phép (L516 logic OR đúng)', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue({
        id: 1,
        Cart: { sessionId: 'sess-1' },
      });
      const service = makeService(repo);

      await expect(
        service.removeCartItem({ user: null, cookieSessionId: 'sess-1', itemId: 1 }),
      ).resolves.toBeDefined();
      expect(repo.deleteCartItem).toHaveBeenCalled();
    });

    test('guest sessionId KHÁC → 403 (L516/517)', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue({
        id: 1,
        Cart: { sessionId: 'sess-OWNER' },
      });
      const service = makeService(repo);

      await expect(
        service.removeCartItem({ user: null, cookieSessionId: 'sess-INTRUDER', itemId: 1 }),
      ).rejects.toThrow('Bạn không có quyền truy cập giỏ hàng này');
    });

    test('guest KHÔNG cookieSessionId → 403 (nhánh !cookieSessionId)', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue({
        id: 1,
        Cart: { sessionId: 'sess-OWNER' },
      });
      const service = makeService(repo);

      await expect(
        service.removeCartItem({ user: null, cookieSessionId: null, itemId: 1 }),
      ).rejects.toThrow('Bạn không có quyền truy cập giỏ hàng này');
    });

    test('item không tồn tại → 404 "Không tìm thấy sản phẩm trong giỏ hàng"', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue(null);
      const service = makeService(repo);

      await expect(
        service.removeCartItem({ user: { id: 1 }, cookieSessionId: null, itemId: 999 }),
      ).rejects.toThrow('Không tìm thấy sản phẩm trong giỏ hàng');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // ROUND 2 — return getCart({user,...}) trả ĐÚNG cart (mutant {} → cart guest
  // rỗng id:null) + transaction-arg merge/sync (atomicity) + inStock/name.
  // ──────────────────────────────────────────────────────────────
  describe('return getCart({...}) → trả đúng cart của user (kill arg → {})', () => {
    const product = { id: 1, basePrice: 100, defaultVariant: { stockQuantity: 10, price: 100 } };

    test('addToCart trả về cart của user (id=10), không phải cart rỗng', async () => {
      const repo = makeRepo();
      repo.findProductById.mockResolvedValue(product);
      repo.findCartItemMatching.mockResolvedValue(null);
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      const { data } = await service.addToCart({
        user: { id: 1 },
        cookieSessionId: null,
        body: { productId: 1, quantity: 1 },
      });

      expect(data.id).toBe(10); // mutant getCart({}) → id:null
    });

    test('updateCartItem trả về cart của user (id=10)', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue({
        id: 1,
        Cart: { userId: 1 },
        ProductVariant: { stockQuantity: 10 },
        Product: { defaultVariant: { stockQuantity: 10 } },
      });
      repo.findActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      const { data } = await service.updateCartItem({
        user: { id: 1 },
        cookieSessionId: null,
        itemId: 1,
        quantity: 2,
      });

      expect(data.id).toBe(10);
    });

    test('removeCartItem trả về cart của user (id=10)', async () => {
      const repo = makeRepo();
      repo.findCartItemByIdWithCartAndStock.mockResolvedValue({ id: 1, Cart: { userId: 1 } });
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      const { data } = await service.removeCartItem({
        user: { id: 1 },
        cookieSessionId: null,
        itemId: 1,
      });

      expect(data.id).toBe(10);
    });

    test('syncCart trả về cart của user (id=10)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      const { data } = await service.syncCart({
        user: { id: 1 },
        cookieSessionId: null,
        items: [],
      });

      expect(data.id).toBe(10);
    });

    test('mergeCart trả về cart của user (id=10) với cookieSessionId=null', async () => {
      const repo = makeRepo();
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, status: 'active' });
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsForMerge.mockResolvedValue([]);
      const service = makeService(repo);

      const { data } = await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-x' });

      expect(data.id).toBe(10);
    });
  });

  describe('transaction-arg atomicity (merge/sync) — kill {transaction} → {}', () => {
    test('syncCart: findOrCreateActiveCartByUserId trong transaction (L325)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const service = makeService(repo);

      await service.syncCart({ user: { id: 1 }, cookieSessionId: null, items: [] });

      expect(repo.findOrCreateActiveCartByUserId).toHaveBeenCalledWith(1, { transaction: TX });
    });

    test('mergeCart: findOrCreate + findCartItemsForMerge + findCartItemMatching đều trong transaction', async () => {
      const repo = makeRepo();
      repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, status: 'active' });
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      const sessionItem = {
        id: 7,
        productId: 3,
        variantId: 5,
        quantity: 1,
        ProductVariant: { price: '100', stockQuantity: 5 },
        Product: { basePrice: '100', defaultVariant: { stockQuantity: 5 } },
      };
      repo.findCartItemsForMerge.mockResolvedValue([sessionItem]);
      repo.findCartItemMatching.mockResolvedValue(null);
      const service = makeService(repo);

      await service.mergeCart({ user: { id: 1 }, cookieSessionId: 'sess-x' });

      expect(repo.findOrCreateActiveCartByUserId).toHaveBeenCalledWith(1, { transaction: TX });
      expect(repo.findCartItemsForMerge).toHaveBeenCalledWith(99, { transaction: TX });
      expect(repo.findCartItemMatching).toHaveBeenCalledWith(
        expect.objectContaining({ cartId: 10, productId: 3, variantId: 5 }),
        { transaction: TX },
      );
    });
  });

  describe('_buildCartResponse — inStock + name fallback cuối', () => {
    test('variantStock > 0 nhưng defaultVariant stock = 0 → inStock = true (L47)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            variants: [{ stockQuantity: 5, price: 100 }],
            defaultVariant: { stockQuantity: 0, price: 100 },
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.inStock).toBe(true);
    });

    test('variantStock = 0 và KHÔNG có defaultVariant → inStock = false (L48 :false)', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: 'SP',
            basePrice: 100,
            variants: [{ stockQuantity: 0, price: 100 }],
            defaultVariant: null,
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.inStock).toBe(false);
    });

    test('tất cả tên null → product.name = "" (L39 || "")', async () => {
      const repo = makeRepo();
      repo.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
      repo.findCartItemsWithDetails.mockResolvedValue([
        cartItem({
          id: 1,
          quantity: 1,
          productId: 1,
          Product: {
            id: 1,
            nameVi: null,
            nameEn: null,
            name: null,
            basePrice: 100,
            variants: [{ stockQuantity: 3, price: 100 }],
            defaultVariant: { stockQuantity: 3, price: 100 },
          },
        }),
      ]);
      const service = makeService(repo);

      const { data } = await service.getCart({ user: { id: 1 }, cookieSessionId: null });

      expect(data.items[0].Product.name).toBe('');
    });
  });
});
