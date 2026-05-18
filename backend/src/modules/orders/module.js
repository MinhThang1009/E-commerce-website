/**
 * @file module.js
 * @layer Module
 * @module orders
 * @description Entry point orders module — khởi tạo dependencies và đăng ký routes
 */
const OrdersController = require('@modules/orders/controllers/orders-controller');
const OrdersService = require('@modules/orders/services/orders-service');
const SequelizeOrdersRepository = require('@modules/orders/repositories/sequelize-orders-repository');
const buildRoutes = require('@modules/orders/routes');

// Orders module — DDD-lite. DI wire repo → service → controller → router.
// emailService inject qua adapter port (dễ test/swap).
module.exports = ({
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  LoyaltyHistory,
  InventoryLog,
  WarrantyPackage,
  sequelize,
  eventBus,
  logger,
  emailService,
  constants,
}) => {
  if (!Order) throw new Error('orders module: Order model bắt buộc');
  if (!constants) throw new Error('orders module: constants (POINTS_*, SHIPPING_*) bắt buộc');

  const ordersRepository = new SequelizeOrdersRepository({
    Order,
    OrderItem,
    Cart,
    CartItem,
    Product,
    ProductVariant,
    User,
    DiscountCode,
    LoyaltyHistory,
    InventoryLog,
    WarrantyPackage,
    sequelize,
  });

  // Adapter: nodemailer service → IEmailGateway port
  const emailGateway = {
    sendOrderConfirmationEmail: (...args) => emailService.sendOrderConfirmationEmail(...args),
    sendOrderCancellationEmail: (...args) => emailService.sendOrderCancellationEmail(...args),
    sendOrderStatusUpdateEmail: (...args) => emailService.sendOrderStatusUpdateEmail(...args),
  };

  const ordersService = new OrdersService({
    ordersRepository,
    emailGateway,
    eventBus,
    logger,
    constants,
  });
  const ordersController = new OrdersController({ ordersService });
  const router = buildRoutes({ ordersController });

  return {
    basePath: '/orders',
    router,
    subscribeEvents() {
      // Orders publish OrderCreated/OrderCancelled/OrderDelivered.
      // inventory module subscribe để tạo audit log khi đơn bị hủy
    },
  };
};
