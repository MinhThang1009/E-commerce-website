/**
 * @file wishlistService.test.js
 * @description Gộp từ wishlistService.test.js + wishlistService.branches.test.js
 */
const WishlistService = require('./wishlist-service');

describe('WishlistService', () => {
  let wishlistRepository;
  let service;

  beforeEach(() => {
    wishlistRepository = {
      findByUserIdWithProducts: jest.fn(),
      findProductById: jest.fn(),
      findItem: jest.fn(),
      createItem: jest.fn().mockResolvedValue(),
      deleteItem: jest.fn().mockResolvedValue(),
      clearByUserId: jest.fn().mockResolvedValue(),
    };

    service = new WishlistService({
      wishlistRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });
  });

  // -------- getWishlist --------

  describe('getWishlist', () => {
    test('danh sách rỗng → trả về products=[]', async () => {
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products).toEqual([]);
    });

    test('item có product=null (đã bị soft-delete) → bỏ qua, không crash (REGRESSION: null.toJSON() → 500)', async () => {
      // Trước fix: item.Product = null → null.toJSON() → TypeError 500.
      // Sau fix: filter(item.Product !== null) → bỏ qua orphaned items.
      const validProduct = {
        id: 2,
        variants: [],
        defaultVariant: null,
        productImages: [],
        toJSON: () => ({ id: 2, variants: [], defaultVariant: null, productImages: [] }),
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: null }, // orphaned (soft-deleted product)
        { Product: validProduct }, // valid item
      ]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].id).toBe(2);
    });

    test('tính stockQuantity từ tổng variants.stockQuantity', async () => {
      const productJson = {
        id: 1,
        variants: [{ stockQuantity: 3 }, { stockQuantity: 7 }],
        defaultVariant: { stockQuantity: 5 },
        productImages: [],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products[0].stockQuantity).toBe(10);
      expect(result.products[0].inStock).toBe(true);
    });

    test('không có variants → fallback về defaultVariant.stockQuantity', async () => {
      const productJson = {
        id: 2,
        variants: [],
        defaultVariant: { stockQuantity: 5 },
        productImages: [],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });

      // variantStock = 0 (falsy) → fallback về defaultVariant.stockQuantity = 5
      expect(result.products[0].stockQuantity).toBe(5);
      expect(result.products[0].inStock).toBe(true);
    });

    test('variants và defaultVariant đều rỗng → inStock=false', async () => {
      const productJson = {
        id: 3,
        variants: [],
        defaultVariant: null,
        productImages: [],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products[0].inStock).toBe(false);
    });

    test('productImages có ảnh → tạo mảng images và thumbnail', async () => {
      const productJson = {
        id: 4,
        variants: [],
        defaultVariant: null,
        productImages: [
          { id: 10, imageUrl: 'thumb.jpg', altText: 'Ảnh chính', isPrimary: true },
          { id: 11, imageUrl: 'second.jpg', altText: 'Ảnh phụ', isPrimary: false },
        ],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });
      const product = result.products[0];

      expect(product.images).toHaveLength(2);
      expect(product.images[0]).toEqual({
        id: 10,
        url: 'thumb.jpg',
        alt: 'Ảnh chính',
        isPrimary: true,
      });
      expect(product.thumbnail).toBe('thumb.jpg');
    });

    test('ảnh đầu tiên làm thumbnail khi không có isPrimary', async () => {
      const productJson = {
        id: 5,
        variants: [],
        defaultVariant: null,
        productImages: [
          { id: 20, imageUrl: 'first.jpg', altText: 'A', isPrimary: false },
          { id: 21, imageUrl: 'second.jpg', altText: 'B', isPrimary: false },
        ],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products[0].thumbnail).toBe('first.jpg');
    });

    test('không có productImages → images=[], thumbnail=null', async () => {
      const productJson = {
        id: 6,
        variants: [],
        defaultVariant: null,
        productImages: [],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products[0].images).toEqual([]);
      expect(result.products[0].thumbnail).toBeNull();
    });

    test('xóa productImages, defaultVariant, variants khỏi product trả về', async () => {
      const productJson = {
        id: 7,
        variants: [{ stockQuantity: 1 }],
        defaultVariant: { stockQuantity: 1 },
        productImages: [{ id: 1, imageUrl: 'a.jpg', altText: '', isPrimary: true }],
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
        { Product: { toJSON: () => ({ ...productJson }) } },
      ]);

      const result = await service.getWishlist({ userId: 1 });
      const product = result.products[0];

      expect(product.productImages).toBeUndefined();
      expect(product.defaultVariant).toBeUndefined();
      expect(product.variants).toBeUndefined();
    });
  });

  // -------- addToWishlist --------

  describe('addToWishlist', () => {
    test('sản phẩm không tồn tại → 404', async () => {
      wishlistRepository.findProductById.mockResolvedValue(null);

      await expect(service.addToWishlist({ userId: 1, productId: 99 })).rejects.toMatchObject({
        statusCode: 404,
        message: 'wishlist.productNotFound',
      });
    });

    test('sản phẩm đã trong wishlist → trả về alreadyExists=true, không tạo mới', async () => {
      wishlistRepository.findProductById.mockResolvedValue({ id: 1 });
      wishlistRepository.findItem.mockResolvedValue({ userId: 1, productId: 1 });

      const result = await service.addToWishlist({ userId: 1, productId: 1 });

      expect(result.alreadyExists).toBe(true);
      expect(wishlistRepository.createItem).not.toHaveBeenCalled();
    });

    test('sản phẩm chưa trong wishlist → tạo item và trả về alreadyExists=false', async () => {
      wishlistRepository.findProductById.mockResolvedValue({ id: 1 });
      wishlistRepository.findItem.mockResolvedValue(null);

      const result = await service.addToWishlist({ userId: 1, productId: 1 });

      expect(wishlistRepository.createItem).toHaveBeenCalledWith({ userId: 1, productId: 1 });
      expect(result.alreadyExists).toBe(false);
      expect(result.message).toBe('wishlist.added');
    });
  });

  // -------- removeFromWishlist --------

  describe('removeFromWishlist', () => {
    test('sản phẩm không có trong wishlist → 404', async () => {
      wishlistRepository.findItem.mockResolvedValue(null);

      await expect(service.removeFromWishlist({ userId: 1, productId: 99 })).rejects.toMatchObject({
        statusCode: 404,
        message: 'wishlist.notInWishlist',
      });
    });

    test('xóa thành công → trả về message', async () => {
      const item = { userId: 1, productId: 1 };
      wishlistRepository.findItem.mockResolvedValue(item);

      const result = await service.removeFromWishlist({ userId: 1, productId: 1 });

      expect(wishlistRepository.deleteItem).toHaveBeenCalledWith(item);
      expect(result.message).toBe('wishlist.removed');
    });
  });

  // -------- checkWishlist --------

  describe('checkWishlist', () => {
    test('sản phẩm trong wishlist → inWishlist=true', async () => {
      wishlistRepository.findItem.mockResolvedValue({ userId: 1, productId: 5 });

      const result = await service.checkWishlist({ userId: 1, productId: 5 });

      expect(result.inWishlist).toBe(true);
    });

    test('sản phẩm không trong wishlist → inWishlist=false', async () => {
      wishlistRepository.findItem.mockResolvedValue(null);

      const result = await service.checkWishlist({ userId: 1, productId: 5 });

      expect(result.inWishlist).toBe(false);
    });
  });

  // -------- clearWishlist --------

  describe('clearWishlist', () => {
    test('gọi clearByUserId với đúng userId', async () => {
      const result = await service.clearWishlist({ userId: 42 });

      expect(wishlistRepository.clearByUserId).toHaveBeenCalledWith(42);
      expect(result.message).toBe('wishlist.clearedAll');
    });
  });
});

// ═══════════
// wishlistService.branches.test.js
// ═══════════

// ═══════════
// wishlist-service.unit.test.js
// ═══════════

describe('WishlistService — unit (smoke tests)', () => {
  let wishlistRepository;
  let service;

  beforeEach(() => {
    wishlistRepository = {
      findByUserIdWithProducts: jest.fn(),
      findItem: jest.fn(),
      createItem: jest.fn(),
      deleteItem: jest.fn().mockResolvedValue(),
      clearByUserId: jest.fn().mockResolvedValue(),
      findProductById: jest.fn(),
    };
    service = new WishlistService({
      wishlistRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('addToWishlist', () => {
    test('product không tồn tại → 404', async () => {
      wishlistRepository.findProductById.mockResolvedValue(null);
      await expect(service.addToWishlist({ userId: 1, productId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('product đã có → trả message + alreadyExists=true', async () => {
      wishlistRepository.findProductById.mockResolvedValue({ id: 1 });
      wishlistRepository.findItem.mockResolvedValue({ id: 5 });
      const result = await service.addToWishlist({ userId: 1, productId: 1 });
      expect(result.alreadyExists).toBe(true);
      expect(wishlistRepository.createItem).not.toHaveBeenCalled();
    });

    test('product chưa có → tạo + alreadyExists=false', async () => {
      wishlistRepository.findProductById.mockResolvedValue({ id: 1 });
      wishlistRepository.findItem.mockResolvedValue(null);
      const result = await service.addToWishlist({ userId: 1, productId: 1 });
      expect(result.alreadyExists).toBe(false);
      expect(wishlistRepository.createItem).toHaveBeenCalledWith({ userId: 1, productId: 1 });
    });
  });

  describe('removeFromWishlist', () => {
    test('không tìm thấy → 404', async () => {
      wishlistRepository.findItem.mockResolvedValue(null);
      await expect(service.removeFromWishlist({ userId: 1, productId: 1 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('hợp lệ → xóa item', async () => {
      const item = { id: 5 };
      wishlistRepository.findItem.mockResolvedValue(item);
      await service.removeFromWishlist({ userId: 1, productId: 1 });
      expect(wishlistRepository.deleteItem).toHaveBeenCalledWith(item);
    });
  });

  describe('checkWishlist', () => {
    test('có trong wishlist → true', async () => {
      wishlistRepository.findItem.mockResolvedValue({ id: 5 });
      const result = await service.checkWishlist({ userId: 1, productId: 1 });
      expect(result.inWishlist).toBe(true);
    });

    test('không có → false', async () => {
      wishlistRepository.findItem.mockResolvedValue(null);
      const result = await service.checkWishlist({ userId: 1, productId: 1 });
      expect(result.inWishlist).toBe(false);
    });
  });

  describe('clearWishlist', () => {
    test('clear all + return message', async () => {
      const result = await service.clearWishlist({ userId: 1 });
      expect(wishlistRepository.clearByUserId).toHaveBeenCalledWith(1);
      expect(result.message).toBe('wishlist.clearedAll');
    });
  });

  describe('getWishlist', () => {
    test('map product fields đúng + xử lý images', async () => {
      const item = {
        Product: {
          toJSON: () => ({
            id: 1,
            name: 'P',
            defaultVariant: { stockQuantity: 5 },
            productImages: [
              { id: 1, imageUrl: 'a.jpg', altText: 'a', isPrimary: false },
              { id: 2, imageUrl: 'b.jpg', altText: 'b', isPrimary: true },
            ],
          }),
        },
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([item]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products[0].stockQuantity).toBe(5);
      expect(result.products[0].inStock).toBe(true);
      expect(result.products[0].thumbnail).toBe('b.jpg');
      expect(result.products[0].images).toHaveLength(2);
      expect(result.products[0].productImages).toBeUndefined();
    });

    test('product không có image → thumbnail null + images empty', async () => {
      const item = {
        Product: {
          toJSON: () => ({ id: 1, defaultVariant: null, productImages: [] }),
        },
      };
      wishlistRepository.findByUserIdWithProducts.mockResolvedValue([item]);

      const result = await service.getWishlist({ userId: 1 });

      expect(result.products[0].stockQuantity).toBe(0);
      expect(result.products[0].inStock).toBe(false);
      expect(result.products[0].thumbnail).toBeNull();
      expect(result.products[0].images).toEqual([]);
    });
  });
});

function buildService() {
  const wishlistRepository = {
    findByUserIdWithProducts: jest.fn(),
    findProductById: jest.fn(),
    findItem: jest.fn(),
    createItem: jest.fn().mockResolvedValue(),
    deleteItem: jest.fn().mockResolvedValue(),
    clearByUserId: jest.fn().mockResolvedValue(),
  };
  const service = new WishlistService({
    wishlistRepository,
    eventBus: { publish: jest.fn().mockResolvedValue() },
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  });
  return { service, wishlistRepository };
}

// ── Line 18: variantStock = 0, p.defaultVariant = null → ternary FALSE branch ──

describe('getWishlist — line 18: variantStock = 0 và defaultVariant = null → stockQuantity = 0', () => {
  it('stockQuantity = 0 khi variantStock = 0 và defaultVariant null (ternary FALSE branch)', async () => {
    // Line 18: variantStock = 0 (falsy) → (p.defaultVariant ? ... : 0)
    //          p.defaultVariant = null → ternary FALSE → returns 0
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 1,
      name: 'Sản phẩm hết hàng',
      variants: [], // variantStock = reduce([]) = 0
      defaultVariant: null, // null → ternary FALSE → 0
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    // stockQuantity phải là 0 (từ ternary FALSE branch)
    expect(result.products[0].stockQuantity).toBe(0);
    // inStock cũng phải false (variantStock = 0, defaultVariant = null → 0 > 0 = false)
    expect(result.products[0].inStock).toBe(false);
  });

  it('stockQuantity = 0 khi variants array null/undefined → variantStock = 0 và defaultVariant = null', async () => {
    // Line 17: (p.variants || []) — nếu variants null → dùng []
    // Line 18: variantStock = 0, defaultVariant = null → 0
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 2,
      name: 'SP không có variant',
      variants: null, // null → p.variants || [] = []
      defaultVariant: null,
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    expect(result.products[0].stockQuantity).toBe(0);
    expect(result.products[0].inStock).toBe(false);
  });

  it('stockQuantity lấy từ defaultVariant khi variantStock = 0 (ternary TRUE branch — để verify rõ)', async () => {
    // Đây là TRUE branch để đối chiếu: defaultVariant tồn tại → stockQuantity từ defaultVariant
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 3,
      name: 'SP có defaultVariant',
      variants: [], // variantStock = 0
      defaultVariant: { stockQuantity: 5 }, // truthy → ternary TRUE → 5
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    // ternary TRUE: defaultVariant.stockQuantity = 5
    expect(result.products[0].stockQuantity).toBe(5);
    expect(result.products[0].inStock).toBe(true);
  });

  it('inStock FALSE branch: variantStock = 0 và defaultVariant.stockQuantity = 0', async () => {
    // Line 19: inStock = variantStock > 0 || (defaultVariant ? defaultVariant.stock > 0 : false)
    // Khi variantStock = 0, defaultVariant.stockQuantity = 0 → inStock = false
    const { service, wishlistRepository } = buildService();

    const productJson = {
      id: 4,
      name: 'SP stock = 0',
      variants: [{ stockQuantity: 0 }], // variantStock = 0
      defaultVariant: { stockQuantity: 0 }, // truthy nhưng stock = 0
      productImages: [],
    };
    wishlistRepository.findByUserIdWithProducts.mockResolvedValue([
      { Product: { toJSON: () => ({ ...productJson }) } },
    ]);

    const result = await service.getWishlist({ userId: 1 });

    expect(result.products[0].inStock).toBe(false);
    // stockQuantity = variantStock (0) || defaultVariant.stockQuantity (0) = 0
    expect(result.products[0].stockQuantity).toBe(0);
  });
});
