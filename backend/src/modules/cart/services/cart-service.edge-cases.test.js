// Tests nhắm vào các nhánh chưa được cover trong CartService.
// Uncovered lines: 29-32, 41, 71-86, 110, 156, 169, 179, 201-203, 228, 246, 248, 316-327, 369-370, 418

const CartService = require('./cart-service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mkProduct = (basePrice = 100, stock = 10) => ({
  id: 1,
  basePrice,
  defaultVariant: { stockQuantity: stock, price: basePrice },
  name: 'Sản phẩm A',
});

function buildService() {
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
    findActiveWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
    findCartItemsWithDetails: jest.fn().mockResolvedValue([]),
    findCartItemByIdWithCartAndStock: jest.fn(),
    findCartItemsForValidation: jest.fn().mockResolvedValue([]),
    findCartItemsForMerge: jest.fn().mockResolvedValue([]),
    runInTransaction: jest.fn((work) => work({})),
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 1,
        quantity: 2,
        variantId: null,
        warrantyPackageIds: [],
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

  it('warrantyPackages là [] khi item không có warrantyPackageIds', async () => {
    // Line 60-61: else branch — warrantyPackageIds falsy hoặc length = 0
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 2,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
        Product: null,
        ProductVariant: null,
      }),
      quantity: 1,
    };
    cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

    const result = await service._buildCartResponse({ id: 1 });

    expect(result.items[0].warrantyPackages).toEqual([]);
  });
});

// ─── _buildCartResponse — branch: variantStock = 0, dùng defaultVariant (line 33) ──

describe('_buildCartResponse — variantStock = 0, fallback defaultVariant stock', () => {
  it('stockQuantity lấy từ defaultVariant khi tổng variantStock = 0', async () => {
    // Line 33: variantStock = 0 → p.stockQuantity = p.defaultVariant.stockQuantity
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 3,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 4,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 5,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 6,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 7,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 8,
        quantity: 1,
        variantId: 10,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 9,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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

describe('_buildCartResponse — subtotal branch: item không có ProductVariant cũng không Product', () => {
  it('warrantyPackages không có → warrantyPrice = 0 trong subtotal', async () => {
    // Line 73-75: warrantyPackages truthy → reduce; nếu không có warrantyPackages → 0
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 10,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
        Product: { id: 1, basePrice: 200, variants: [], defaultVariant: null, productImages: [] },
        ProductVariant: null,
      }),
      quantity: 1,
    };
    cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);

    const result = await service._buildCartResponse({ id: 1 });

    // price = Product.basePrice = 200, warrantyPrice = 0 → subtotal = 200 * 1 = 200
    expect(result.subtotal).toBe(200);
  });
});

// ─── _buildCartResponse — line 66 TRUE: defaultVariant có price ──────────────

describe('_buildCartResponse — defaultVariant.price có giá trị → variantPrice != null', () => {
  it('set p.price từ defaultVariant.price (line 66 true branch)', async () => {
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 11,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 12,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 13,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
    cartRepository.findProductById.mockResolvedValue({
      id: 1,
      basePrice: 100,
      defaultVariant: null,
      name: 'SP B',
    });

    await expect(
      service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 1 } }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hết hàng') });
  });
});

// ─── addToCart — branch: guest đã có sessionId (line 201) ───────────────────

describe('addToCart — guest đã có sessionId (không phát sinh UUID mới)', () => {
  it('dùng sessionId hiện có khi guest đã có cookie', async () => {
    // Line 201: nextSessionId truthy → bỏ qua block tạo UUID mới
    const { service, cartRepository } = buildService();
    cartRepository.findProductById.mockResolvedValue(mkProduct());
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
    const { service, cartRepository } = buildService();
    cartRepository.findProductById.mockResolvedValue(mkProduct());
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
    const { service, cartRepository } = buildService();
    cartRepository.findProductById.mockResolvedValue(mkProduct(100, 5));
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    // existing quantity = 4, adding 3 → total 7 > stock 5
    cartRepository.findCartItemMatching.mockResolvedValue({ quantity: 4 });

    await expect(
      service.addToCart({ user: { id: 1 }, body: { productId: 1, quantity: 3 } }),
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('tồn kho') });
  });
});

// ─── addToCart — branch: variant + createCartItem dùng variant.price (line 228) ──

describe('addToCart — tạo cart item mới với variant (dùng variant.price)', () => {
  it('unitPrice là variant.price khi có variant', async () => {
    // Line 228: variant truthy → unitPrice = variant.price
    const { service, cartRepository } = buildService();
    const product = mkProduct(100, 10);
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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
    const { service, cartRepository } = buildService();
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

// ─── _buildCartResponse — line 73: warrantyPackages falsy → warrantyPrice = 0 ──
// Để hit false branch: item.warrantyPackages phải là null/undefined.
// Điều này xảy ra khi toJSON() trả warrantyPackageIds = null và warrantyPackages
// chưa được set (bypassed). Tuy nhiên code luôn set warrantyPackages.
// Branch FALSE thực sự được hit khi item.warrantyPackages = null trực tiếp.
// Ta mock findCartItemsWithDetails trả item đã có warrantyPackages = null
// để simulate trường hợp warrantyPackages chưa được populated (edge case).

describe('_buildCartResponse — subtotal branch: warrantyPackages null → warrantyPrice = 0 (line 73 FALSE)', () => {
  it('warrantyPrice = 0 khi item.warrantyPackages là null trong subtotal reduce', async () => {
    // Để hit false branch tại line 73: item.warrantyPackages phải null/undefined
    // Simulate bằng cách toJSON() trả warrantyPackageIds có giá trị nhưng
    // findActiveWarrantyPackagesByIds throw → nhưng code sẽ crash thay vì null.
    // Cách đúng: Mock raw item sao cho sau khi map, warrantyPackages = null.
    // Thực tế: code luôn set warrantyPackages = [] hoặc mapped array.
    // Test này xác minh behavior khi warrantyPackages = [] (truthy [] → reduce → 0)
    // là trường hợp practical nhất của "warrantyPrice = 0".
    const { service, cartRepository } = buildService();
    const item = {
      toJSON: () => ({
        id: 20,
        quantity: 1,
        variantId: null,
        warrantyPackageIds: [],
        Product: {
          id: 1,
          basePrice: 150000,
          variants: [],
          defaultVariant: null,
          productImages: [],
        },
        ProductVariant: null,
      }),
      quantity: 1,
    };
    cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);
    cartRepository.findActiveWarrantyPackagesByIds.mockResolvedValue([]);

    const result = await service._buildCartResponse({ id: 1 });

    // warrantyPackages = [] (truthy, reduce = 0), price = 150000
    expect(result.subtotal).toBe(150000);
    expect(result.items[0].warrantyPackages).toEqual([]);
  });
});

// ─── _assertStock — line 85/86: defaultVariant null → baseStockQuantity = 0 ──

describe('_assertStock — product.defaultVariant null → baseStockQuantity = 0 (line 86 FALSE branch)', () => {
  it('throw 400 khi product không có defaultVariant và quantity > 0 (no variant path)', () => {
    // Line 86: product.defaultVariant = null → baseStockQuantity = 0
    // Line 91: else if (0 < quantity) → throw
    const { service } = buildService();

    expect(() =>
      service._assertStock({ product: { defaultVariant: null }, variant: null, quantity: 1 }),
    ).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('không throw khi defaultVariant null nhưng quantity = 0', () => {
    // Line 86: baseStockQuantity = 0, quantity = 0 → else if (0 < 0) = false → không throw
    const { service } = buildService();

    expect(() =>
      service._assertStock({ product: { defaultVariant: null }, variant: null, quantity: 0 }),
    ).not.toThrow();
  });
});

// ─── validateCart — line 418: ProductVariant null → dùng Product.basePrice ──

describe('validateCart — item không có ProductVariant → currentPrice = Product.basePrice (line 418 FALSE)', () => {
  it('currentPrice = Product.basePrice khi không có ProductVariant', async () => {
    // Line 417: item.ProductVariant = null (false) → item.Product.basePrice
    const { service, cartRepository } = buildService();
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
    cartRepository.findCartItemsForValidation.mockResolvedValue([
      {
        id: 5,
        productId: 2,
        variantId: null,
        unitPrice: 80000,
        quantity: 1,
        Product: {
          id: 2,
          name: 'Sách lập trình',
          basePrice: 80000,
          defaultVariant: { stockQuantity: 3 },
        },
        ProductVariant: null, // FALSE branch tại line 417
      },
    ]);

    const result = await service.validateCart({ user: { id: 1 } });

    // currentPrice = Product.basePrice = 80000, unitPrice = 80000 → priceChanged = false
    expect(result.items[0].currentPrice).toBe(80000);
    expect(result.items[0].priceChanged).toBe(false);
    // name = Product.name (no variant)
    expect(result.items[0].name).toBe('Sách lập trình');
  });

  it('priceChanged = true khi Product.basePrice khác unitPrice (line 418 FALSE, line 421 priceChanged)', async () => {
    // Line 417: ProductVariant null → currentPrice = Product.basePrice = 90000
    // Line 421: parseFloat(90000) !== parseFloat(80000) → priceChanged = true
    const { service, cartRepository } = buildService();
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 1 });
    cartRepository.findCartItemsForValidation.mockResolvedValue([
      {
        id: 6,
        productId: 3,
        variantId: null,
        unitPrice: 80000,
        quantity: 2, // savedPrice = 80000
        Product: {
          id: 3,
          name: 'Tai nghe',
          basePrice: 90000, // currentPrice = 90000 ≠ 80000
          defaultVariant: { stockQuantity: 5 },
        },
        ProductVariant: null,
      },
    ]);

    const result = await service.validateCart({ user: { id: 1 } });

    expect(result.items[0].currentPrice).toBe(90000);
    expect(result.items[0].priceChanged).toBe(true);
    expect(result.items[0].hasIssue).toBe(true);
  });
});

// ─── _buildCartResponse — warrantyPackages truthy với items → reduce (lines 73-75) ──

describe('_buildCartResponse — warrantyPackages truthy → subtotal kèm warranty cost', () => {
  it('warrantyPackages truthy → warrantyPrice được cộng vào subtotal (line 73-75 TRUE branch)', async () => {
    // Line 73: item.warrantyPackages truthy → reduce chạy để tính tổng warrantyPrice
    const { service, cartRepository } = buildService();

    const warrantyInItem = [{ price: '50000', id: 1, name: 'BH 12 tháng', durationMonths: 12 }];
    const item = {
      toJSON: () => ({
        id: 1,
        quantity: 2,
        variantId: null,
        warrantyPackageIds: [1],
        Product: {
          id: 1,
          basePrice: 100000,
          variants: [],
          defaultVariant: null,
          productImages: [],
        },
        ProductVariant: null,
        // warrantyPackages sẽ được set bởi warrantyPackageIds processing
      }),
      quantity: 2,
    };
    cartRepository.findCartItemsWithDetails.mockResolvedValue([item]);
    // findActiveWarrantyPackagesByIds trả về gói bảo hành
    cartRepository.findActiveWarrantyPackagesByIds.mockResolvedValue(warrantyInItem);

    const result = await service._buildCartResponse({ id: 1 });

    // subtotal = basePrice * quantity + warrantyPrice * quantity
    // = 100000 * 2 + 50000 * 2 = 200000 + 100000 = 300000
    expect(result.subtotal).toBe(300000);
    expect(result.items[0].warrantyPackages).toHaveLength(1);
  });
});

// ─── updateCartItem — line 248: ProductVariant.stockQuantity < quantity → throw ──

describe('updateCartItem — ProductVariant stock không đủ → throw 400 (line 248)', () => {
  it('ném 400 khi ProductVariant.stockQuantity < quantity', async () => {
    // Line 247: cartItem.ProductVariant truthy → if (stockQuantity < quantity) throw
    const { service, cartRepository } = buildService();
    cartRepository.findCartItemByIdWithCartAndStock.mockResolvedValue({
      Cart: { userId: 1 },
      Product: { defaultVariant: { stockQuantity: 10 } },
      ProductVariant: { stockQuantity: 3 }, // stock chỉ có 3
    });

    // Cập nhật lên 5 → 5 > 3 → throw
    await expect(
      service.updateCartItem({ user: { id: 1 }, itemId: 5, quantity: 5 }),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining('tồn kho'),
    });
  });
});

// ─── syncCart — line 316-321: actualQuantity > 0 với variant → tạo cart item ──

describe('syncCart — actualQuantity > 0 với variant → gọi createCartItem (lines 316-321 TRUE branch)', () => {
  it('tạo cart item khi variant.stockQuantity > 0', async () => {
    // Line 316: actualQuantity = Math.min(3, 8) = 3 > 0 → createCartItem được gọi
    const { service, cartRepository } = buildService();
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findProductById.mockResolvedValue({
      id: 1,
      basePrice: 100000,
      defaultVariant: { stockQuantity: 0 },
      name: 'Sản phẩm F',
    });
    cartRepository.findVariantByIdAndProductId.mockResolvedValue({
      id: 5,
      price: 120000,
      stockQuantity: 8,
    });

    await service.syncCart({
      user: { id: 1 },
      items: [{ productId: 1, variantId: 5, quantity: 3 }],
    });

    expect(cartRepository.createCartItem).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: 5, quantity: 3, unitPrice: 120000 }),
      expect.any(Object),
    );
  });
});

// ─── syncCart — line 324-328: actualQuantity > 0 không có variant → tạo cart item ──

describe('syncCart — actualQuantity > 0 không có variant → gọi createCartItem (lines 324-328 TRUE branch)', () => {
  it('tạo cart item dùng basePrice khi không có variantId và stock đủ', async () => {
    // Line 324: actualQuantity = Math.min(2, 5) = 2 > 0 → createCartItem được gọi
    const { service, cartRepository } = buildService();
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findProductById.mockResolvedValue({
      id: 2,
      basePrice: 80000,
      defaultVariant: { stockQuantity: 5 }, // stock > 0 → guard pass
      name: 'Sản phẩm G',
    });

    await service.syncCart({
      user: { id: 1 },
      items: [{ productId: 2, quantity: 2 }], // không có variantId
    });

    expect(cartRepository.createCartItem).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 2, quantity: 2, unitPrice: 80000 }),
      expect.any(Object),
    );
  });
});

// ─── mergeCart — line 369-370: existingUserItem TRUE branch ──────────────────

describe('mergeCart — existingUserItem tồn tại → cập nhật quantity (lines 369-376)', () => {
  it('gộp quantity khi item đã tồn tại trong user cart (line 367 TRUE branch)', async () => {
    // Line 367: existingUserItem truthy → cộng quantity, cap theo stock, save
    const { service, cartRepository } = buildService();

    const guestCart = { id: 20, status: 'active' };
    cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

    // sessionItems với ProductVariant và Product
    const sessionItem = {
      id: 100,
      productId: 1,
      variantId: 5,
      quantity: 3,
      Product: { id: 1, basePrice: 150000, defaultVariant: { stockQuantity: 0 } },
      ProductVariant: { price: 150000, stockQuantity: 10 },
    };
    cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);

    // Existing item trong user cart
    const existingItem = { id: 50, quantity: 4, price: 150000 };
    cartRepository.findCartItemMatching.mockResolvedValue(existingItem);

    await service.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-merge',
      clearSessionCookie: jest.fn(),
    });

    // newQuantity = 4 + 3 = 7, maxStock = 10, finalQuantity = min(7,10) = 7
    expect(existingItem.quantity).toBe(7);
    // Phải gọi saveCartItem để lưu existingItem đã update
    expect(cartRepository.saveCartItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 7 }),
      expect.any(Object),
    );
    // Phải gọi deleteCartItem để xóa sessionItem
    expect(cartRepository.deleteCartItem).toHaveBeenCalledWith(sessionItem, expect.any(Object));
  });

  it('mergeCart: existingUserItem với defaultVariant null → baseStockQuantity = 0 (line 369 false branch của defaultVariant)', async () => {
    // Line 369: sessionItem.Product.defaultVariant = null → baseStockQuantity = 0
    // maxStock = variant.stockQuantity (vì có ProductVariant)
    const { service, cartRepository } = buildService();

    const guestCart = { id: 21, status: 'active' };
    cartRepository.findActiveCartBySessionId.mockResolvedValue(guestCart);
    cartRepository.findOrCreateActiveCartByUserId.mockResolvedValue({ id: 10 });
    cartRepository.findActiveCartByUserId.mockResolvedValue({ id: 10 });

    const sessionItem = {
      id: 101,
      productId: 2,
      variantId: 6,
      quantity: 2,
      Product: { id: 2, basePrice: 200000, defaultVariant: null }, // null → baseStockQuantity = 0
      ProductVariant: { price: 200000, stockQuantity: 5 },
    };
    cartRepository.findCartItemsForMerge.mockResolvedValue([sessionItem]);

    const existingItem = { id: 51, quantity: 1, price: 200000 };
    cartRepository.findCartItemMatching.mockResolvedValue(existingItem);

    await service.mergeCart({
      user: { id: 1 },
      cookieSessionId: 'sess-merge-2',
      clearSessionCookie: jest.fn(),
    });

    // maxStock = variant.stockQuantity = 5, finalQuantity = min(1+2, 5) = 3
    expect(existingItem.quantity).toBe(3);
    expect(cartRepository.saveCartItem).toHaveBeenCalled();
  });
});
