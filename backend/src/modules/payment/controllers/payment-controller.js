/**
 * @file paymentController.js
 * @layer Controller
 * @module payment
 * @description Xử lý HTTP request/response cho payment
 */
const { t } = require('@utils/i18n');
const logger = require('@utils/logger');
const emailService = require('@services/email');
const { Order, User, OrderItem, Cart, CartItem, DiscountCode } = require('@models');
const sequelize = require('@config/sequelize');

// --- Helpers cho SePay webhook ---

// Gửi email xác nhận đơn hàng — không block webhook response nếu email thất bại
const _sendSePayEmailSafe = async (orderId) => {
  try {
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          attributes: ['name', 'quantity', 'unitPrice', 'subtotal'],
        },
        { model: User, attributes: ['email'] },
      ],
    });
    if (!order || !order.User) return;
    const items = (order.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.unitPrice),
      subtotal: parseFloat(item.subtotal),
    }));
    await emailService.sendOrderConfirmationEmail(order.User.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      items,
      shippingAddress: {
        name: `${order.shippingFirstName} ${order.shippingLastName}`,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        zip: order.shippingZip,
        country: order.shippingCountry,
      },
      estimatedDelivery: order.estimatedDelivery,
    });
  } catch (err) {
    logger.error(`[SePay] Gửi email xác nhận đơn hàng ${orderId} thất bại: ${err.message}`);
  }
};

// Tăng usedCount của discount code sau khi SePay xác nhận thanh toán
async function _incrementSePayDiscountUsage(orderId) {
  const order = await Order.findByPk(orderId, { attributes: ['id', 'discountCodeId'] });
  if (!order || !order.discountCodeId) return;
  await DiscountCode.increment('usedCount', { where: { id: order.discountCodeId } });
}

// Xóa giỏ hàng của user sau khi thanh toán SePay thành công
const _clearSePayUserCart = async (userId) => {
  if (!userId) return;
  try {
    const carts = await Cart.findAll({ where: { userId, status: 'active' } });
    for (const cart of carts) {
      await cart.update({ status: 'converted' });
      await CartItem.destroy({ where: { cartId: cart.id } });
    }
  } catch (error) {
    logger.error(`[SePay] Lỗi xóa giỏ hàng user ${userId}:`, error.message);
  }
};

// Xác thực SePay webhook bằng API key trong Authorization header
// Dùng constant-time comparison để chống timing attack
const _verifySePayApiKey = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Apikey ')) {
    logger.error('SePay: Authorization header không hợp lệ');
    return false;
  }
  const providedApiKey = authHeader.substring(7).trim();
  const expectedApiKey = process.env.SEPAY_API_KEY;
  if (!expectedApiKey) {
    logger.error('SePay: SEPAY_API_KEY chưa được cấu hình — từ chối tất cả webhook');
    return false;
  }
  let mismatch = expectedApiKey.length !== providedApiKey.length;
  for (let i = 0; i < Math.max(expectedApiKey.length, providedApiKey.length); i++) {
    mismatch |= (expectedApiKey.charCodeAt(i) || 0) ^ (providedApiKey.charCodeAt(i) || 0);
  }
  return mismatch === 0;
};

// Payment Controller — handler cho MoMo/VNPay/SePay webhook/Refund.
class PaymentController {
  constructor({ paymentService, logger: injectedLogger }) {
    this.paymentService = paymentService;
    this.logger = injectedLogger;
  }

  createRefund = async (req, res, next) => {
    try {
      const ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;
      const refund = await this.paymentService.createRefund({ ...req.body, ipAddr });
      res.status(200).json({ status: 'success', data: { refund } });
    } catch (err) {
      next(err);
    }
  };

  createMomoUrl = async (req, res, next) => {
    try {
      const data = await this.paymentService.createMomoUrl({ ...req.body, userId: req.user.id });
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  momoReturn = async (req, res) => {
    try {
      const redirectUrl = await this.paymentService.handleMomoReturn(req.query);
      return res.redirect(redirectUrl);
    } catch (err) {
      this.logger.error('Lỗi MoMo return:', err);
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=error`);
    }
  };

  momoIPN = async (req, res) => {
    try {
      const result = await this.paymentService.handleMomoIPN({ body: req.body });
      if (!result.valid) {
        return res.status(400).json({ message: t('payment.invalidSignature', req.locale) });
      }
      res.status(204).send();
    } catch (err) {
      this.logger.error('Lỗi MoMo IPN:', err);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  createVNPayUrl = async (req, res, next) => {
    try {
      const ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;
      const data = await this.paymentService.createVNPayUrl({
        ...req.body,
        ipAddr,
        userId: req.user.id,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };

  vnpayReturn = async (req, res, next) => {
    try {
      const { redirectUrl } = await this.paymentService.handleVnPayReturn({
        vnp_Params: req.query,
      });
      return res.redirect(redirectUrl);
    } catch (err) {
      this.logger.error('Lỗi VNPay return:', err);
      next(err);
    }
  };

  vnpayIPN = async (req, res) => {
    try {
      const result = await this.paymentService.handleVnPayIPN({ vnp_Params: req.query });
      return res.status(200).json(result);
    } catch (err) {
      this.logger.error('Lỗi VNPay IPN:', err);
      return res
        .status(200)
        .json({ RspCode: '99', Message: t('payment.unknownError', req.locale) });
    }
  };

  handleSePayWebhook = async (req, res, next) => {
    try {
      if (!_verifySePayApiKey(req)) {
        logger.error('API key SePay không hợp lệ');
        return res.status(401).json({ error: t('payment.webhookUnauthorized', req.locale) });
      }

      const { id, transactionDate, code, content, transferType, transferAmount, referenceCode } =
        req.body;
      logger.info('Đã nhận SePay webhook:', { id, transferAmount, content, transferType });

      if (!id || !transferType || !transferAmount || !transactionDate) {
        return res.status(400).json({ error: t('payment.missingRequiredFields', req.locale) });
      }
      if (typeof id !== 'number' && typeof id !== 'string') {
        return res.status(400).json({ error: t('payment.invalidTransactionIdType', req.locale) });
      }
      if (typeof transferAmount !== 'number' || typeof transferType !== 'string') {
        return res.status(400).json({ error: t('payment.invalidDataType', req.locale) });
      }
      if (transferAmount <= 0) {
        return res.status(400).json({ error: t('payment.amountMustBePositive', req.locale) });
      }
      if (!['in', 'out'].includes(transferType)) {
        return res.status(400).json({ error: t('payment.invalidTransactionType', req.locale) });
      }
      if (transferType !== 'in') {
        return res
          .status(200)
          .json({ received: true, message: t('payment.ignoringOutbound', req.locale) });
      }

      const parsedTransactionDate = new Date(transactionDate);
      if (isNaN(parsedTransactionDate.getTime())) {
        return res.status(400).json({ error: t('payment.invalidTransactionDate', req.locale) });
      }

      // Tìm order ID trong content, code, referenceCode theo thứ tự ưu tiên
      // Pattern match nhiều định dạng mã đơn: ORD-xxx, ORD_xxx, ORDxxx, SEPAY-xxx
      const ORDER_ID_PATTERNS = [
        /ORD[-_]?(\d+)/i,
        /ORDER[-_]?(\d+)/i,
        /ORD[-_]?\w+/i,
        /ORDER[-_]?\w+/i,
        /order[-_\s]?(\d+)/i,
        /SEPAY(\d+)/i,
        /SEPAY[-_\s]?(\d+)/i,
        /\b(\d{6,})\b/,
      ];
      let orderId = null;
      for (const source of [content, code, referenceCode]) {
        if (!source) continue;
        for (const pattern of ORDER_ID_PATTERNS) {
          const match = source.match(pattern);
          if (match && match[0]) {
            orderId = match[0].trim();
            break;
          }
        }
        if (orderId) break;
      }

      if (!orderId) {
        return res.status(200).json({
          received: true,
          message: 'Không tìm thấy order ID trong giao dịch, đã xử lý thành công',
        });
      }

      // Tìm order — thử exact match trước, sau đó thử các biến thể format có/không dấu gạch
      let order = null;
      try {
        order = await Order.findOne({ where: { number: orderId } });
        if (!order && orderId.startsWith('ORD') && orderId.length > 7) {
          const formatted = `${orderId.substring(0, 3)}-${orderId.substring(3, 7)}-${orderId.substring(7)}`;
          order = await Order.findOne({ where: { number: formatted } });
        }
        if (!order && orderId.includes('-')) {
          const unformatted = orderId.replace(/-/g, '');
          order = await Order.findOne({ where: { number: unformatted } });
          if (!order) {
            const reformatted = `${unformatted.substring(0, 3)}-${unformatted.substring(3, 7)}-${unformatted.substring(7)}`;
            order = await Order.findOne({ where: { number: reformatted } });
          }
        }
      } catch (error) {
        logger.error('Lỗi database khi tìm đơn hàng SePay:', error);
        return res.status(500).json({ error: t('payment.processingError', req.locale) });
      }

      if (!order) {
        return res.status(200).json({
          received: true,
          message: `Không tìm thấy đơn hàng với ID ${orderId}, đã xử lý thành công`,
        });
      }

      // Kiểm tra số tiền — cho phép sai số 0.01 do làm tròn
      if (Math.abs(parseFloat(order.total) - transferAmount) > 0.01) {
        logger.info(`SePay: Số tiền không khớp — đơn ${order.total} vs chuyển ${transferAmount}`);
        return res
          .status(200)
          .json({ received: true, message: 'Phát hiện số tiền không khớp, đã xử lý thành công' });
      }

      // Idempotency: bỏ qua nếu transaction này đã được xử lý
      if (order.paymentTransactionId && order.paymentTransactionId === id.toString()) {
        return res.status(200).json({ received: true, message: 'Webhook đã được xử lý trước đó' });
      }

      if (order.paymentStatus === 'pending' || order.paymentStatus === 'unpaid') {
        // Atomic check+update để tránh race condition khi nhiều webhook đến đồng thời
        const [affectedRows] = await Order.update(
          {
            status: 'processing',
            paymentStatus: 'paid',
            paymentTransactionId: id.toString(),
            paymentProvider: 'sepay',
            updatedAt: new Date(),
          },
          { where: { id: order.id, paymentStatus: ['pending', 'unpaid'] } },
        );
        if (affectedRows === 0) {
          return res
            .status(200)
            .json({ received: true, message: 'Webhook đã được xử lý trước đó' });
        }
        await _incrementSePayDiscountUsage(order.id);
        await _clearSePayUserCart(order.userId);
        await _sendSePayEmailSafe(order.id);
      } else {
        return res
          .status(200)
          .json({ received: true, message: 'Đơn hàng đã được xử lý, webhook đã ghi nhận' });
      }

      res.status(200).json({
        received: true,
        message: 'SePay webhook đã được xử lý thành công',
        orderId: order.id,
        orderNumber: order.number,
        transactionId: id,
      });
    } catch (error) {
      logger.error('Lỗi xử lý SePay webhook:', error);
      next(error);
    }
  };
}

module.exports = PaymentController;
