const Stripe = require('stripe');
const { AppError } = require('../../middlewares/errorHandler');

// Khởi tạo Stripe với secret key
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  /**
   * Tạo payment intent cho thanh toán
   * @param {Object} params - Tham số thanh toán
   * @param {number} params.amount - Số tiền (đơn vị: cent)
   * @param {string} params.currency - Mã tiền tệ (mặc định: 'usd')
   * @param {Object} params.metadata - Metadata bổ sung
   * @returns {Object} Đối tượng payment intent
   */
  async createPaymentIntent({ amount, currency = 'usd', metadata = {} }) {
    try {
      const stripeAmount =
        currency === 'vnd' ? Math.round(amount) : Math.round(amount * 100);

      console.log('Đang tạo Stripe payment intent với tham số:', {
        amount: stripeAmount,
        currency,
        metadata,
        originalAmount: amount,
      });

      const paymentIntent = await stripe.paymentIntents.create({
        amount: stripeAmount, // VND không dùng số thập phân
        currency,
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      console.error('Lỗi Stripe createPaymentIntent:', error);
      console.error('Chi tiết lỗi:', {
        message: error.message,
        type: error.type,
        code: error.code,
        param: error.param,
        statusCode: error.statusCode,
      });
      throw new AppError(
        `Failed to create payment intent: ${error.message}`,
        500
      );
    }
  }

  /**
   * Xác nhận payment intent
   * @param {string} paymentIntentId - ID của payment intent
   * @returns {Object} Đối tượng payment intent
   */
  async confirmPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent =
        await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('Lỗi Stripe confirmPaymentIntent:', error);
      throw new AppError('Failed to confirm payment intent', 500);
    }
  }

  /**
   * Tạo khách hàng trên Stripe
   * @param {Object} params - Tham số khách hàng
   * @param {string} params.email - Email khách hàng
   * @param {string} params.name - Tên khách hàng
   * @param {Object} params.metadata - Metadata bổ sung
   * @returns {Object} Đối tượng customer
   */
  async createCustomer({ email, name, metadata = {} }) {
    try {
      const customer = await stripe.customers.create({
        email,
        name,
        metadata,
      });

      return customer;
    } catch (error) {
      console.error('Lỗi Stripe createCustomer:', error);
      throw new AppError('Failed to create customer', 500);
    }
  }

  /**
   * Lấy thông tin khách hàng từ Stripe
   * @param {string} customerId - ID khách hàng
   * @returns {Object} Đối tượng customer
   */
  async getCustomer(customerId) {
    try {
      const customer = await stripe.customers.retrieve(customerId);
      return customer;
    } catch (error) {
      console.error('Lỗi Stripe getCustomer:', error);
      throw new AppError('Failed to retrieve customer', 500);
    }
  }

  /**
   * Tạo yêu cầu hoàn tiền
   * @param {Object} params - Tham số hoàn tiền
   * @param {string} params.paymentIntentId - ID của payment intent
   * @param {number} params.amount - Số tiền hoàn (đơn vị: cent, tuỳ chọn — bỏ trống để hoàn toàn bộ)
   * @param {string} params.reason - Lý do hoàn tiền
   * @returns {Object} Đối tượng refund
   */
  async createRefund({
    paymentIntentId,
    amount,
    reason = 'requested_by_customer',
  }) {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason,
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Chuyển sang đơn vị cent
      }

      const refund = await stripe.refunds.create(refundData);
      return refund;
    } catch (error) {
      console.error('Lỗi Stripe createRefund:', error);
      throw new AppError('Failed to create refund', 500);
    }
  }

  /**
   * Xử lý sự kiện webhook từ Stripe
   * @param {string} payload - Body request thô
   * @param {string} signature - Header chữ ký Stripe
   * @returns {Object} Đối tượng event
   */
  async handleWebhook(payload, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      return event;
    } catch (error) {
      console.error('Lỗi Stripe webhook:', error);
      throw new AppError('Invalid webhook signature', 400);
    }
  }

  /**
   * Lấy danh sách phương thức thanh toán của khách hàng
   * @param {string} customerId - ID khách hàng
   * @returns {Array} Mảng phương thức thanh toán
   */
  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      console.error('Lỗi Stripe getPaymentMethods:', error);
      throw new AppError('Failed to retrieve payment methods', 500);
    }
  }

  /**
   * Tạo setup intent để lưu phương thức thanh toán
   * @param {string} customerId - ID khách hàng
   * @returns {Object} Đối tượng setup intent
   */
  async createSetupIntent(customerId) {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });

      return {
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
      };
    } catch (error) {
      console.error('Lỗi Stripe createSetupIntent:', error);
      throw new AppError('Failed to create setup intent', 500);
    }
  }
}

module.exports = new StripeService();
