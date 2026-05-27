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
      const product = item.Product.toJSON();
      const variantStock = (product.variants || []).reduce(
        (sum, variant) => sum + (variant.stockQuantity || 0),
        0,
      );
      product.stockQuantity =
        variantStock || (product.defaultVariant ? product.defaultVariant.stockQuantity : 0);
      product.inStock =
        variantStock > 0 ||
        (product.defaultVariant ? product.defaultVariant.stockQuantity > 0 : false);

      if (product.productImages && product.productImages.length > 0) {
        product.images = product.productImages.map((img) => ({
          id: img.id,
          url: img.imageUrl,
          alt: img.altText,
          isPrimary: img.isPrimary,
        }));
        const primary =
          product.productImages.find((img) => img.isPrimary) || product.productImages[0];
        product.thumbnail = primary.imageUrl;
      } else {
        product.images = [];
        product.thumbnail = null;
      }
      delete product.productImages;
      delete product.defaultVariant;
      delete product.variants;
      return product;
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
