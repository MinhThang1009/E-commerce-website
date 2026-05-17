const PaymentController = require('./controllers/paymentController');
const PaymentService = require('./services/paymentService');
const SequelizePaymentRepository = require('./repositories/SequelizePaymentRepository');
const buildRoutes = require('./routes');

// Payment module — Vertical Slice + Layered (Phase 1: đã xóa infrastructure/ layer).
// SePay webhook (controllers/payment.js handleSePayWebhook) giữ legacy đến Phase 2.
module.exports = ({
  Order,
  OrderItem,
  User,
  Cart,
  CartItem,
  DiscountCode,
  sequelize,
  eventBus,
  logger,
  momoService,
  vnpayService,
  emailService,
  frontendUrl,
}) => {
  if (!Order) throw new Error('payment module: Order model bắt buộc');
  if (!momoService) throw new Error('payment module: momoService bắt buộc');
  if (!vnpayService) throw new Error('payment module: vnpayService bắt buộc');

  const paymentRepository = new SequelizePaymentRepository({
    Order,
    OrderItem,
    User,
    Cart,
    CartItem,
    DiscountCode,
    sequelize,
  });

  const emailGateway = {
    sendOrderConfirmationEmail: (...args) => emailService.sendOrderConfirmationEmail(...args),
  };

  // momoGateway/vnpayGateway đã inline — pass service trực tiếp
  const momoGateway = {
    createPaymentUrl: (input) => momoService.createPaymentUrl(input),
    verifySignature: (payload) => momoService.verifySignature(payload),
  };
  const vnpayGateway = {
    createPaymentUrl: (input) => vnpayService.createPaymentUrl(input),
    verifyReturnUrl: (params) => vnpayService.verifyReturnUrl(params),
    refund: (input) => vnpayService.refund(input),
  };

  const paymentService = new PaymentService({
    paymentRepository,
    momoGateway,
    vnpayGateway,
    emailGateway,
    eventBus,
    logger,
    frontendUrl: frontendUrl || process.env.FRONTEND_URL,
  });

  const paymentController = new PaymentController({ paymentService, logger });
  const router = buildRoutes({ paymentController });

  return {
    basePath: '/payments',
    router,
    subscribeEvents() {
      // Module publish PaymentSucceededEvent + PaymentFailedEvent.
    },
  };
};
