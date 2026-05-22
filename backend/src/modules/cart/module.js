/**
 * @file module.js
 * @layer Module
 * @module cart
 * @description Entry point cart module — khởi tạo dependencies và đăng ký routes
 */
const CartController = require('@modules/cart/controllers/cart-controller');
const CartService = require('@modules/cart/services/cart-service');
const SequelizeCartRepository = require('@modules/cart/repositories/sequelize-cart-repository');
const buildRoutes = require('@modules/cart/routes');

module.exports = ({ Cart, CartItem, Product, ProductVariant, sequelize, eventBus, logger }) => {
  if (!Cart) throw new Error('cart module: Cart model bắt buộc');
  if (!CartItem) throw new Error('cart module: CartItem model bắt buộc');
  if (!Product) throw new Error('cart module: Product model bắt buộc');
  if (!ProductVariant) throw new Error('cart module: ProductVariant model bắt buộc');
  if (!sequelize) throw new Error('cart module: sequelize bắt buộc');
  if (!eventBus) throw new Error('cart module: eventBus bắt buộc');
  if (!logger) throw new Error('cart module: logger bắt buộc');

  const cartRepository = new SequelizeCartRepository({
    Cart,
    CartItem,
    Product,
    ProductVariant,
    sequelize,
  });
  const cartService = new CartService({ cartRepository, eventBus, logger });
  const cartController = new CartController({ cartService });
  const router = buildRoutes({ cartController });

  return {
    basePath: '/cart',
    router,
    subscribeEvents() {
      // Cart module hiện không subscribe event nào.
    },
  };
};
