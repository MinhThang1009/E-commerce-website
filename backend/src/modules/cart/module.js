/**
 * @file module.js
 * @layer Module
 * @module cart
 * @description Entry point cart module — khởi tạo dependencies và đăng ký routes
 */
const CartController = require('./controllers/cartController');
const CartService = require('./services/cartService');
const SequelizeCartRepository = require('./repositories/SequelizeCartRepository');
const buildRoutes = require('./routes');

// Cart module — DI wire repo → service → controller → router.
// Cart không có model riêng, dùng Cart/CartItem/Product/Variant/WarrantyPackage
// từ legacy models/. Sprint 4 catalog refactor sẽ tách Product/Variant ra module
// catalog và cart sẽ chuyển sang gọi catalog service thay vì truy cập Product
// model trực tiếp.
module.exports = ({
  Cart, CartItem, Product, ProductVariant, WarrantyPackage,
  sequelize, eventBus, logger,
}) => {
  if (!Cart) throw new Error('cart module: Cart model bắt buộc');
  if (!CartItem) throw new Error('cart module: CartItem model bắt buộc');
  if (!Product) throw new Error('cart module: Product model bắt buộc');
  if (!ProductVariant) throw new Error('cart module: ProductVariant model bắt buộc');
  if (!WarrantyPackage) throw new Error('cart module: WarrantyPackage model bắt buộc');
  if (!sequelize) throw new Error('cart module: sequelize bắt buộc');
  if (!eventBus) throw new Error('cart module: eventBus bắt buộc');
  if (!logger) throw new Error('cart module: logger bắt buộc');

  const cartRepository = new SequelizeCartRepository({
    Cart, CartItem, Product, ProductVariant, WarrantyPackage, sequelize,
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
