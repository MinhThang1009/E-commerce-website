const WishlistService = require('./wishlist-service');

describe('WishlistService', () => {
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
