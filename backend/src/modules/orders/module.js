const OrdersController = require('@modules/orders/controllers/orders-controller');
const OrdersService = require('@modules/orders/services/orders-service');
const SequelizeOrdersRepository = require('@modules/orders/repositories/sequelize-orders-repository');
const buildRoutes = require('@modules/orders/routes');

module.exports = ({
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  InventoryLog,
  sequelize,
  eventBus,
  logger,
  emailService,
  constants,
}) => {
  if (!Order) throw new Error('orders module: Order model bắt buộc');
  if (!constants) throw new Error('orders module: constants (SHIPPING_*) bắt buộc');

  const ordersRepository = new SequelizeOrdersRepository({
    Order,
    OrderItem,
    Cart,
    CartItem,
    Product,
    ProductVariant,
    User,
    DiscountCode,
    InventoryLog,
    sequelize,
  });

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
    subscribeEvents() {},
    // Expose để app.js inject vào admin module (admin delegate hủy/đổi-trạng-thái — 1 path chung).
    ordersService,
  };
};
