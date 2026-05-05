const OrdersController = require('./controllers/ordersController');
const OrdersService = require('./services/ordersService');
const SequelizeOrdersRepository = require('./repositories/SequelizeOrdersRepository');
const buildRoutes = require('./routes');

// Orders module — DDD-lite. DI wire repo → service → controller → router.
// emailService inject qua adapter port (dễ test/swap).
module.exports = ({
  Order, OrderItem, Cart, CartItem, Product, ProductVariant, User,
  DiscountCode, LoyaltyHistory, InventoryLog, WarrantyPackage,
  sequelize, eventBus, logger, emailService, constants,
}) => {
  if (!Order) throw new Error('orders module: Order model bắt buộc');
  if (!constants) throw new Error('orders module: constants (POINTS_*, SHIPPING_*) bắt buộc');

  const ordersRepository = new SequelizeOrdersRepository({
    Order, OrderItem, Cart, CartItem, Product, ProductVariant, User,
    DiscountCode, LoyaltyHistory, InventoryLog, WarrantyPackage,
    sequelize,
  });

  // Adapter: nodemailer service → IEmailGateway port
  const emailGateway = {
    sendOrderConfirmationEmail: (...args) => emailService.sendOrderConfirmationEmail(...args),
    sendOrderCancellationEmail: (...args) => emailService.sendOrderCancellationEmail(...args),
    sendOrderStatusUpdateEmail: (...args) => emailService.sendOrderStatusUpdateEmail(...args),
  };

  const ordersService = new OrdersService({
    ordersRepository, emailGateway, eventBus, logger, constants,
  });
  const ordersController = new OrdersController({ ordersService });
  const router = buildRoutes({ ordersController });

  return {
    basePath: '/orders',
    router,
    subscribeEvents() {
      // Orders publish OrderCreated/OrderCancelled/OrderDelivered.
      // Sprint 9 inventory module sẽ subscribe OrderCancelled để restore stock event-driven.
    },
  };
};
