/**
 * @file module.js
 * @layer Module
 * @module wishlist
 * @description Entry point wishlist module — khởi tạo dependencies và đăng ký routes
 */
const WishlistController = require('./controllers/wishlistController');
const WishlistService = require('./services/wishlistService');
const SequelizeWishlistRepository = require('./repositories/SequelizeWishlistRepository');
const buildRoutes = require('./routes');

module.exports = ({ Wishlist, Product, eventBus, logger }) => {
  if (!Wishlist) throw new Error('wishlist module: Wishlist model bắt buộc');
  if (!Product) throw new Error('wishlist module: Product model bắt buộc');

  const wishlistRepository = new SequelizeWishlistRepository({ Wishlist, Product });
  const wishlistService = new WishlistService({ wishlistRepository, eventBus, logger });
  const wishlistController = new WishlistController({ wishlistService });
  const router = buildRoutes({ wishlistController });

  return {
    basePath: '/wishlists',
    router,
    subscribeEvents() {},
  };
};
