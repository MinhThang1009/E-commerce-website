/**
 * @file module.js
 * @layer Module
 * @module payment
 * @description Entry point payment module — khởi tạo dependencies và đăng ký routes
 */
const PaymentController = require('@modules/payment/controllers/payment-controller');
const PaymentService = require('@modules/payment/services/payment-service');
const SequelizePaymentRepository = require('@modules/payment/repositories/sequelize-payment-repository');
const buildRoutes = require('@modules/payment/routes');

// Payment module — Vertical Slice + Layered.
// SePay webhook (controllers/payment.js handleSePayWebhook) chưa migrate vào module này.
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
