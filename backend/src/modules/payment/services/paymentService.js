const moment = require('moment');
const { AppError } = require('../../../shared/errors');
const PaymentPolicy = require('../domain/policies/PaymentPolicy');
const PaymentSucceededEvent = require('../domain/events/PaymentSucceededEvent');
const PaymentFailedEvent = require('../domain/events/PaymentFailedEvent');

// Payment Service — orchestrate Stripe/MoMo/VNPay gateway + Order updates.
// Mọi gateway access qua interface (IPaymentGateway), repository wrap Order/User/Cart.
//
// Idempotency: PaymentPolicy.canProcessPayment check transactionId + paymentStatus
// để webhook duplicate không double-process.
class PaymentService {
  constructor({
    paymentRepository, stripeGateway, momoGateway, vnpayGateway,
    emailGateway, eventBus, logger, frontendUrl,
  }) {
    this.repo = paymentRepository;
    this.stripeGateway = stripeGateway;
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
        name: item.name, quantity: item.quantity,
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
          address1: order.shippingAddress1, address2: order.shippingAddress2,
          city: order.shippingCity, state: order.shippingState,
          zip: order.shippingZip, country: order.shippingCountry,
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

  // ---------- Stripe use cases ----------

  async createPaymentIntent({ amount, currency = 'usd', orderId, userId }) {
    if (!amount || amount <= 0) throw new AppError('Số tiền không hợp lệ', 400);

    this.logger.info('Đang tạo payment intent kèm metadata:', { userId, orderId: orderId || '' });
    const paymentIntent = await this.stripeGateway.createPaymentIntent({
      amount, currency,
      metadata: { userId, orderId: orderId || '' },
    });
    this.logger.info('Đã tạo payment intent:', { id: paymentIntent.paymentIntentId, metadata: paymentIntent.metadata });
    return paymentIntent;
  }

  async confirmPayment({ paymentIntentId }) {
    if (!paymentIntentId) throw new AppError('Payment intent ID là bắt buộc', 400);

    const paymentIntent = await this.stripeGateway.confirmPaymentIntent(paymentIntentId);
    this.logger.info('Đã lấy payment intent:', {
      id: paymentIntent.id, status: paymentIntent.status, metadata: paymentIntent.metadata,
    });

    const orderId = paymentIntent.metadata.orderId;
    if (orderId) {
      const order = await this.repo.findOrderByPk(orderId);
      if (order && paymentIntent.status === 'succeeded'
        && PaymentPolicy.canProcessPayment(order, paymentIntent.id)) {
        await this.repo.updateOrderPayment(orderId, {
          status: 'processing',
          paymentStatus: 'paid',
          paymentTransactionId: paymentIntent.id,
          paymentProvider: 'stripe',
          updatedAt: new Date(),
        });
        await this._incrementDiscountCodeUsage(orderId);
        this.logger.info(`Đã cập nhật trạng thái đơn hàng ${order.id} sang paid`);
        await this._clearUserCart(order.userId);
        await this._sendOrderConfirmationEmailSafe(order.id);

        await this.eventBus.publish(PaymentSucceededEvent({
          orderId: order.id, orderNumber: order.number,
          transactionId: paymentIntent.id, provider: 'stripe',
          amount: paymentIntent.amount,
        }));
      }
    }

    return {
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.currency === 'vnd' ? paymentIntent.amount : paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      },
    };
  }

  async createCustomer({ userId }) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);

    if (user.stripeCustomerId) {
      const customer = await this.stripeGateway.getCustomer(user.stripeCustomerId);
      return { customer, isNew: false };
    }

    const customer = await this.stripeGateway.createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: { userId: user.id },
    });
    user.stripeCustomerId = customer.id;
    await this.repo.saveUser(user);
    return { customer, isNew: true };
  }

  async getPaymentMethods({ userId }) {
    const user = await this.repo.findUserById(userId);
    if (!user || !user.stripeCustomerId) return { paymentMethods: [] };
    const paymentMethods = await this.stripeGateway.getPaymentMethods(user.stripeCustomerId);
    return { paymentMethods };
  }

  async createSetupIntent({ userId }) {
    const user = await this.repo.findUserById(userId);
    if (!user) throw new AppError('Không tìm thấy người dùng', 404);

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripeGateway.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      user.stripeCustomerId = customerId;
      await this.repo.saveUser(user);
    }

    return this.stripeGateway.createSetupIntent(customerId);
  }

  async handleStripeWebhook({ payload, signature, hasSecret }) {
    if (!hasSecret) {
      this.logger.info('Webhook nhận trong chế độ sandbox (không có STRIPE_WEBHOOK_SECRET)');
      return { received: true };
    }

    const event = await this.stripeGateway.handleWebhook(payload, signature);
    this.logger.info('[PAYMENT] Webhook received', {
      event: event.type,
      orderId: event.data?.object?.metadata?.orderId,
    });

    if (event.type === 'payment_intent.succeeded') {
      await this._handleStripePaymentSucceeded(event.data.object);
    } else if (event.type === 'payment_intent.payment_failed') {
      await this._handleStripePaymentFailed(event.data.object);
    } else if (event.type === 'customer.created') {
      this.logger.info('Đã tạo customer:', event.data.object.id);
    } else {
      this.logger.info(`Loại sự kiện chưa được xử lý: ${event.type}`);
    }
    return { received: true };
  }

  async _handleStripePaymentSucceeded(paymentIntent) {
    try {
      const orderId = paymentIntent.metadata?.orderId;
      if (!orderId) return;

      const order = await this.repo.findOrderByPk(orderId);
      if (!order) return;

      // Idempotency guard — confirmPayment có thể đã xử lý
      if (order.paymentTransactionId === paymentIntent.id) {
        this.logger.info(`Webhook payment.succeeded: order ${orderId} đã xử lý — bỏ qua`);
        return;
      }

      await this.repo.runInTransaction(async (t) => {
        const lockedOrder = await this.repo.lockOrder(orderId, t);
        if (!lockedOrder || lockedOrder.paymentTransactionId === paymentIntent.id) return;

        await this.repo.updateOrderPayment(orderId, {
          status: 'processing',
          paymentStatus: 'paid',
          paymentTransactionId: paymentIntent.id,
          paymentProvider: 'stripe',
        }, { transaction: t });

        await this._incrementDiscountCodeUsage(orderId, { transaction: t });
      });

      await this._clearUserCart(order.userId);
      await this._sendOrderConfirmationEmailSafe(orderId);
      this.logger.info(`Webhook: cập nhật thành công order ${orderId}`);

      await this.eventBus.publish(PaymentSucceededEvent({
        orderId: order.id, orderNumber: order.number,
        transactionId: paymentIntent.id, provider: 'stripe',
        amount: paymentIntent.amount,
      }));
    } catch (err) {
      this.logger.error('Lỗi xử lý thanh toán thành công:', err);
    }
  }

  async _handleStripePaymentFailed(paymentIntent) {
    try {
      const orderId = paymentIntent.metadata?.orderId;
      if (!orderId) return;

      await this.repo.updateOrderPayment(orderId, {
        paymentStatus: 'failed',
        paymentTransactionId: paymentIntent.id,
        paymentProvider: 'stripe',
      });
      this.logger.info(`Thanh toán thất bại cho đơn hàng: ${orderId}`);

      const order = await this.repo.findOrderByPk(orderId);
      if (order) {
        await this.eventBus.publish(PaymentFailedEvent({
          orderId: order.id, orderNumber: order.number,
          transactionId: paymentIntent.id, provider: 'stripe',
          reason: paymentIntent.last_payment_error?.message,
        }));
      }
    } catch (err) {
      this.logger.error('Lỗi xử lý thanh toán thất bại:', err);
    }
  }

  // ---------- MoMo ----------

  async createMomoUrl({ orderId }) {
    const order = await this.repo.findOrderByPk(orderId);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

    return this.momoGateway.createPaymentUrl({
      orderId: order.number,
      amount: order.total,
      orderInfo: `Thanh toán đơn hàng ${order.number}`,
      extraData: `orderId=${order.id}`,
    });
  }

  async handleMomoReturn({ resultCode, extraData }) {
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    let redirectStatus = 'failed';
    if (resultCode == 0) {
      redirectStatus = 'success';
      if (orderId) {
        const order = await this.repo.findOrderByPk(orderId);
        if (order && PaymentPolicy.canProcessPayment(order, null)) {
          order.status = 'processing';
          order.paymentStatus = 'paid';
          order.paymentProvider = 'momo';
          order.updatedAt = new Date();
          await this.repo.saveOrder(order);
          await this._incrementDiscountCodeUsage(order.id);
          await this._clearUserCart(order.userId);
          await this._sendOrderConfirmationEmailSafe(order.id);
        }
      }
    }
    return `${this.frontendUrl}/orders?payment=${redirectStatus}`;
  }

  async handleMomoIPN({ body }) {
    this.logger.info('Đã nhận MoMo IPN:', { resultCode: body.resultCode, orderId: body.orderId, transId: body.transId });

    const isValid = this.momoGateway.verifySignature(body);
    if (!isValid) return { valid: false };

    const { resultCode, extraData, transId } = body;
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (resultCode == 0 && orderId) {
      const order = await this.repo.findOrderByPk(orderId);
      if (order && PaymentPolicy.canProcessPayment(order, transId)) {
        order.status = 'processing';
        order.paymentStatus = 'paid';
        order.paymentTransactionId = transId;
        order.paymentProvider = 'momo';
        order.updatedAt = new Date();
        await this.repo.saveOrder(order);
        await this._clearUserCart(order.userId);
        await this._sendOrderConfirmationEmailSafe(order.id);

        await this.eventBus.publish(PaymentSucceededEvent({
          orderId: order.id, orderNumber: order.number,
          transactionId: transId, provider: 'momo',
          amount: order.total,
        }));
      }
    }
    return { valid: true };
  }

  // ---------- VNPay ----------

  async createVNPayUrl({ orderId, ipAddr }) {
    const order = await this.repo.findOrderByPk(orderId);
    if (!order) throw new AppError('Không tìm thấy đơn hàng', 404);

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
      const order = await this.repo.findOrderByNumber(orderNumber);
      if (order && PaymentPolicy.canProcessPayment(order, vnp_Params['vnp_TransactionNo'])) {
        order.status = 'processing';
        order.paymentStatus = 'paid';
        order.paymentProvider = 'vnpay';
        order.paymentTransactionId = vnp_Params['vnp_TransactionNo'];
        order.updatedAt = new Date();
        await this.repo.saveOrder(order);
        await this._incrementDiscountCodeUsage(order.id);
        await this._clearUserCart(order.userId);
        await this._sendOrderConfirmationEmailSafe(order.id);
      }
      return { redirectUrl: `${this.frontendUrl}/orders?payment=success&order=${orderNumber}` };
    }
    return { redirectUrl: `${this.frontendUrl}/orders?payment=failed&code=${responseCode}` };
  }

  async handleVnPayIPN({ vnp_Params }) {
    const isValid = this.vnpayGateway.verifyReturnUrl(vnp_Params);
    if (!isValid) return { RspCode: '97', Message: 'Checksum failed' };

    const orderNumber = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;

    const order = await this.repo.findOrderByNumber(orderNumber);
    if (!order) return { RspCode: '01', Message: 'Order not found' };

    if (Math.abs(order.total - amount) > 0.01) {
      return { RspCode: '04', Message: 'Invalid amount' };
    }
    if (order.paymentStatus === 'paid') {
      return { RspCode: '02', Message: 'Order already confirmed' };
    }

    if (responseCode === '00') {
      order.status = 'processing';
      order.paymentStatus = 'paid';
      order.paymentProvider = 'vnpay';
      order.paymentTransactionId = vnp_Params['vnp_TransactionNo'];
      order.updatedAt = new Date();
      await this.repo.saveOrder(order);
      await this._incrementDiscountCodeUsage(order.id);
      await this._clearUserCart(order.userId);
      await this._sendOrderConfirmationEmailSafe(order.id);
    } else {
      order.paymentStatus = 'failed';
      order.updatedAt = new Date();
      await this.repo.saveOrder(order);
    }
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  // ---------- Refund ----------

  async createRefund({ orderId, amount, reason, ipAddr }) {
    if (!orderId) throw new AppError('Order ID là bắt buộc', 400);

    const order = await this.repo.findOrderByPk(orderId);
    const policyResult = PaymentPolicy.canRefund(order);
    if (!policyResult.allowed) {
      throw new AppError(policyResult.reason, order ? 400 : 404);
    }

    let refund;
    if (order.paymentProvider === 'stripe') {
      refund = await this.stripeGateway.createRefund({
        paymentIntentId: order.paymentTransactionId, amount, reason,
      });
    } else if (order.paymentProvider === 'vnpay') {
      refund = await this.vnpayGateway.refund({
        orderId: order.number,
        amount: amount || order.total,
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
