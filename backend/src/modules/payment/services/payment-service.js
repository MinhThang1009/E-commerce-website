/**
 * @file paymentService.js
 * @layer Service
 * @module payment
 * @description Business logic layer cho payment
 */
const moment = require('moment');
const { AppError } = require('@shared/errors');

// Quy tắc kiểm tra điều kiện xử lý thanh toán và hoàn tiền
const _SUPPORTED_REFUND_PROVIDERS = ['vnpay'];
function _canProcessPayment(order, transactionId) {
  if (!order) return false;
  if (transactionId && order.paymentTransactionId === transactionId) return false;
  return order.paymentStatus !== 'paid';
}
function _canRefund(order) {
  if (!order) return { allowed: false, reason: 'Không tìm thấy đơn hàng' };
  if (order.paymentStatus === 'refunded')
    return { allowed: false, reason: 'Đơn hàng đã được hoàn tiền' };
  if (order.paymentStatus !== 'paid')
    return { allowed: false, reason: 'Chỉ có thể hoàn tiền đơn hàng đã thanh toán' };
  if (!order.paymentTransactionId)
    return { allowed: false, reason: 'Không tìm thấy giao dịch thanh toán cho đơn hàng này' };
  if (!_SUPPORTED_REFUND_PROVIDERS.includes(order.paymentProvider)) {
    return { allowed: false, reason: `Hoàn tiền chưa được hỗ trợ cho ${order.paymentProvider}` };
  }
  return { allowed: true };
}

// Payment Service — orchestrate MoMo/VNPay gateway + Order updates.
// Idempotency: _canProcessPayment check transactionId + paymentStatus
// để webhook duplicate không double-process.
class PaymentService {
  constructor({
    paymentRepository,
    momoGateway,
    vnpayGateway,
    emailGateway,
    eventBus,
    logger,
    frontendUrl,
  }) {
    this.repo = paymentRepository;
    this.momoGateway = momoGateway;
    this.vnpayGateway = vnpayGateway;
    this.emailGateway = emailGateway;
    this.eventBus = eventBus;
    this.logger = logger;
    this.frontendUrl = frontendUrl;
  }

  // ---------- Helpers ----------

  // Email confirmation — fire-and-forget, không block flow nếu fail
  async _sendOrderConfirmationEmailSafe(orderId) {
    try {
      const order = await this.repo.findOrderByPkWithItemsAndUser(orderId);
      if (!order || !order.User) return;

      const items = (order.items || []).map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: parseFloat(item.unitPrice),
        subtotal: parseFloat(item.subtotal),
      }));

      await this.emailGateway.sendOrderConfirmationEmail(order.User.email, {
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
      });
    } catch (err) {
      this.logger.error(`Lỗi gửi email xác nhận đơn hàng ${orderId}:`, err.message);
    }
  }

  // Clear cart — fire-and-forget after successful payment
  async _clearUserCart(userId) {
    if (!userId) return;
    try {
      const carts = await this.repo.findActiveCartsByUser(userId);
      for (const cart of carts) {
        cart.status = 'converted';
        await this.repo.saveCart(cart);
        await this.repo.clearCartItems(cart.id);
        this.logger.info(`[SUCCESS] Đã xóa giỏ hàng ${cart.id} của user ${userId}`);
      }
    } catch (err) {
      this.logger.error(`Lỗi xóa giỏ hàng cho user ${userId}:`, err.message);
    }
  }

  // Increment discount code used count after payment confirmed
  async _incrementDiscountCodeUsage(orderId, options = {}) {
    try {
      const code = await this.repo.findOrderDiscountCode(orderId, options);
      if (code) await this.repo.incrementDiscountCodeUsedCount(code.id, options);
    } catch (err) {
      this.logger.error(`Lỗi tăng usedCount discount code cho order ${orderId}:`, err.message);
    }
  }

  // ---------- MoMo ----------

  async createMomoUrl({ orderId, userId }) {
    const order = await this.repo.findOrderByPk(orderId);
    if (!order) throw new AppError('payment.orderNotFound', 404);
    if (order.userId !== userId) throw new AppError('payment.accessDenied', 403);

    return this.momoGateway.createPaymentUrl({
      orderId: order.number,
      amount: order.total,
      orderInfo: `Thanh toán đơn hàng ${order.number}`,
      extraData: `orderId=${order.id}`,
    });
  }

  // Return URL chỉ redirect — KHÔNG mutate state.
  // Mọi state change (order status, discount, cart) xảy ra ở IPN handler (có signature verification).
  async handleMomoReturn({ resultCode, extraData }) {
    const redirectStatus = resultCode == 0 ? 'success' : 'failed';
    const orderIdMatch = extraData?.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : '';
    return `${this.frontendUrl}/orders?payment=${redirectStatus}&orderId=${orderId}`;
  }

  async handleMomoIPN({ body }) {
    this.logger.info('Đã nhận MoMo IPN:', {
      resultCode: body.resultCode,
      orderId: body.orderId,
      transId: body.transId,
    });

    const isValid = this.momoGateway.verifySignature(body);
    if (!isValid) return { valid: false };

    const { resultCode, extraData, transId } = body;
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (resultCode == 0 && orderId) {
      const processed = await this.repo.runInTransaction(async (tx) => {
        const order = await this.repo.lockOrder(orderId, tx);
        if (!order) return false;

        if (body.amount && Math.abs(order.total - body.amount) > 0.01) {
          this.logger.warn('MoMo IPN amount mismatch', {
            expected: order.total,
            received: body.amount,
            orderId,
          });
          return false;
        }

        if (!_canProcessPayment(order, transId)) return false;

        order.status = 'processing';
        order.paymentStatus = 'paid';
        order.paymentTransactionId = transId;
        order.paymentProvider = 'momo';
        order.updatedAt = new Date();
        await this.repo.saveOrder(order, { transaction: tx });
        return order;
      });

      if (processed) {
        await this._clearUserCart(processed.userId);
        await this._sendOrderConfirmationEmailSafe(processed.id);
        await this.eventBus.publish({
          type: 'payment.succeeded',
          payload: {
            orderId: processed.id,
            orderNumber: processed.number,
            transactionId: transId,
            provider: 'momo',
            amount: processed.total,
          },
          occurredAt: new Date().toISOString(),
        });
      }
    }
    return { valid: true };
  }

  // ---------- VNPay ----------

  async createVNPayUrl({ orderId, ipAddr, userId }) {
    const order = await this.repo.findOrderByPk(orderId);
    if (!order) throw new AppError('payment.orderNotFound', 404);
    if (order.userId !== userId) throw new AppError('payment.accessDenied', 403);

    return this.vnpayGateway.createPaymentUrl({
      orderId: order.number,
      amount: order.total,
      ipAddr,
      orderInfo: `Thanh toan don hang ${order.number}`,
    });
  }

  async handleVnPayReturn({ vnp_Params }) {
    const isValid = this.vnpayGateway.verifyReturnUrl(vnp_Params);
    if (!isValid) {
      return { redirectUrl: `${this.frontendUrl}/orders?payment=checksum-failed` };
    }

    const orderNumber = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];

    if (responseCode === '00') {
      const transNo = vnp_Params['vnp_TransactionNo'];
      const processed = await this.repo.runInTransaction(async (tx) => {
        const order = await this.repo.findOrderByNumber(orderNumber);
        if (!order || !_canProcessPayment(order, transNo)) return null;

        order.status = 'processing';
        order.paymentStatus = 'paid';
        order.paymentProvider = 'vnpay';
        order.paymentTransactionId = transNo;
        order.updatedAt = new Date();
        await this.repo.saveOrder(order, { transaction: tx });
        return order;
      });

      if (processed) {
        await this._incrementDiscountCodeUsage(processed.id);
        await this._clearUserCart(processed.userId);
        await this._sendOrderConfirmationEmailSafe(processed.id);
      }
      return { redirectUrl: `${this.frontendUrl}/orders?payment=success&order=${orderNumber}` };
    }
    const safeCode = /^\d{2}$/.test(responseCode) ? responseCode : 'unknown';
    return { redirectUrl: `${this.frontendUrl}/orders?payment=failed&code=${safeCode}` };
  }

  async handleVnPayIPN({ vnp_Params }) {
    const isValid = this.vnpayGateway.verifyReturnUrl(vnp_Params);
    if (!isValid) return { RspCode: '97', Message: 'Checksum failed' };

    const orderNumber = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;

    const transNo = vnp_Params['vnp_TransactionNo'];

    const result = await this.repo.runInTransaction(async (tx) => {
      const found = await this.repo.findOrderByNumber(orderNumber);
      if (!found) return { RspCode: '01', Message: 'Order not found' };

      const locked = await this.repo.lockOrder(found.id, tx);
      if (!locked) return { RspCode: '01', Message: 'Order not found' };

      if (Math.abs(locked.total - amount) > 0.01) {
        return { RspCode: '04', Message: 'Invalid amount' };
      }
      if (locked.paymentStatus === 'paid') {
        return { RspCode: '02', Message: 'Order already confirmed' };
      }

      if (responseCode === '00') {
        locked.status = 'processing';
        locked.paymentStatus = 'paid';
        locked.paymentProvider = 'vnpay';
        locked.paymentTransactionId = transNo;
        locked.updatedAt = new Date();
        await this.repo.saveOrder(locked, { transaction: tx });
        return { RspCode: '00', Message: 'Confirm Success', order: locked };
      } else {
        locked.paymentStatus = 'failed';
        locked.updatedAt = new Date();
        await this.repo.saveOrder(locked, { transaction: tx });
        return { RspCode: '00', Message: 'Confirm Success' };
      }
    });

    if (result.order) {
      await this._incrementDiscountCodeUsage(result.order.id);
      await this._clearUserCart(result.order.userId);
      await this._sendOrderConfirmationEmailSafe(result.order.id);
    }

    return { RspCode: result.RspCode, Message: result.Message };
  }

  // ---------- Refund ----------

  async createRefund({ orderId, amount, reason, ipAddr }) {
    if (!orderId) throw new AppError('payment.orderIdRequired', 400);

    const order = await this.repo.findOrderByPk(orderId);
    const policyResult = _canRefund(order);
    if (!policyResult.allowed) {
      throw new AppError(policyResult.reason, order ? 400 : 404);
    }

    const refundAmount = amount || order.total;
    if (refundAmount <= 0 || refundAmount > parseFloat(order.total)) {
      throw new AppError('payment.invalidRefundAmount', 400);
    }

    let refund;
    if (order.paymentProvider === 'vnpay') {
      refund = await this.vnpayGateway.refund({
        orderId: order.number,
        amount: refundAmount,
        transDate: moment(order.updatedAt).format('YYYYMMDDHHmmss'),
        ipAddr,
      });
    }

    order.paymentStatus = 'refunded';
    await this.repo.saveOrder(order);
    return refund;
  }
}

module.exports = PaymentService;
