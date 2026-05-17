const WishlistService = require('./wishlistService');

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
      expect(product.images[0]).toEqual({ id: 10, url: 'thumb.jpg', alt: 'Ảnh chính', isPrimary: true });
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

      await expect(
        service.addToWishlist({ userId: 1, productId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
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

      await expect(
        service.removeFromWishlist({ userId: 1, productId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
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
