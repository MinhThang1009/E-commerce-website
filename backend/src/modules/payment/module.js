const PaymentController = require('./controllers/paymentController');
const PaymentService = require('./services/paymentService');
const SequelizePaymentRepository = require('./repositories/SequelizePaymentRepository');
const MomoGateway = require('./infrastructure/MomoGateway');
const VnPayGateway = require('./infrastructure/VnPayGateway');
const buildRoutes = require('./routes');

// Payment module — DDD-lite. 2 gateway adapter (MoMo/VNPay) wrap
// services/payment/*; service phụ thuộc IPaymentGateway interface.
//
// SePay webhook (controllers/payment.js handleSePayWebhook) giữ legacy đến
// Phase 5 cleanup — logic phức tạp, ít touch.
module.exports = ({
  Order, OrderItem, User, Cart, CartItem, DiscountCode,
  sequelize, eventBus, logger,
  momoService, vnpayService, emailService,
  frontendUrl,
}) => {
  if (!Order) throw new Error('payment module: Order model bắt buộc');
  if (!momoService) throw new Error('payment module: momoService bắt buộc');
  if (!vnpayService) throw new Error('payment module: vnpayService bắt buộc');

  const paymentRepository = new SequelizePaymentRepository({
    Order, OrderItem, User, Cart, CartItem, DiscountCode, sequelize,
  });

  const momoGateway = new MomoGateway({ momoService });
  const vnpayGateway = new VnPayGateway({ vnpayService });

  const emailGateway = {
    sendOrderConfirmationEmail: (...args) => emailService.sendOrderConfirmationEmail(...args),
  };

  const paymentService = new PaymentService({
    paymentRepository,
    momoGateway, vnpayGateway,
    emailGateway, eventBus, logger,
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
