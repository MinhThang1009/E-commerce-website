/**
 * @file wishlistService.js
 * @layer Service
 * @module wishlist
 * @description Business logic layer cho wishlist
 */
const { AppError } = require('@shared/errors');

// Wishlist Service — danh sách yêu thích của user. KHÔNG truy cập Sequelize
// hoặc Model trực tiếp.
class WishlistService {
  constructor({ wishlistRepository, eventBus, logger }) {
    this.wishlistRepository = wishlistRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async getWishlist({ userId }) {
    const items = await this.wishlistRepository.findByUserIdWithProducts(userId);
    const products = items.map((item) => {
      const p = item.Product.toJSON();
      // Stock thực nằm ở variant level — tính tổng stock từ tất cả variants
      const variantStock = (p.variants || []).reduce((s, v) => s + (v.stockQuantity || 0), 0);
      p.stockQuantity = variantStock || (p.defaultVariant ? p.defaultVariant.stockQuantity : 0);
      p.inStock =
        variantStock > 0 || (p.defaultVariant ? p.defaultVariant.stockQuantity > 0 : false);

      if (p.productImages && p.productImages.length > 0) {
        p.images = p.productImages.map((img) => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isPrimary: img.isPrimary,
        }));
        const primary = p.productImages.find((img) => img.isPrimary) || p.productImages[0];
        p.thumbnail = primary.imageUrl;
      } else {
        p.images = [];
        p.thumbnail = null;
      }
      delete p.productImages;
      delete p.defaultVariant;
      delete p.variants;
      return p;
    });
    return { products };
  }

  async addToWishlist({ userId, productId }) {
    const product = await this.wishlistRepository.findProductById(productId);
    if (!product) {
      throw new AppError('Sản phẩm không tồn tại', 404);
    }

    const existing = await this.wishlistRepository.findItem(userId, productId);
    if (existing) {
      return { message: 'wishlist.alreadyExists', alreadyExists: true };
    }

    await this.wishlistRepository.createItem({ userId, productId });
    return { message: 'wishlist.added', alreadyExists: false };
  }

  async removeFromWishlist({ userId, productId }) {
    const item = await this.wishlistRepository.findItem(userId, productId);
    if (!item) {
      throw new AppError('Sản phẩm không có trong danh sách yêu thích', 404);
    }

    await this.wishlistRepository.deleteItem(item);
    return { message: 'wishlist.removed' };
  }

  async checkWishlist({ userId, productId }) {
    const item = await this.wishlistRepository.findItem(userId, productId);
    return { inWishlist: !!item };
  }

  async clearWishlist({ userId }) {
    await this.wishlistRepository.clearByUserId(userId);
    return { message: 'wishlist.clearedAll' };
  }
}

module.exports = WishlistService;
