// Payment Controller — 13 handler. Trả response shape giữ nguyên cũ.
// Note: SePay webhook giữ ở legacy controllers/payment.js đến Phase 5 cleanup
// (logic SePay phức tạp, ít touch, defer scope).
class PaymentController {
  constructor({ paymentService, logger }) {
    this.paymentService = paymentService;
    this.logger = logger;
  }

  createPaymentIntent = async (req, res, next) => {
    try {
      const data = await this.paymentService.createPaymentIntent({
        ...req.body, userId: req.user.id,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  confirmPayment = async (req, res, next) => {
    try {
      const data = await this.paymentService.confirmPayment(req.body);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  createCustomer = async (req, res, next) => {
    try {
      const result = await this.paymentService.createCustomer({ userId: req.user.id });
      const status = result.isNew ? 201 : 200;
      res.status(status).json({ status: 'success', data: { customer: result.customer } });
    } catch (err) { next(err); }
  };

  getPaymentMethods = async (req, res, next) => {
    try {
      const data = await this.paymentService.getPaymentMethods({ userId: req.user.id });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  createSetupIntent = async (req, res, next) => {
    try {
      const data = await this.paymentService.createSetupIntent({ userId: req.user.id });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  handleWebhook = async (req, res, next) => {
    try {
      const result = await this.paymentService.handleStripeWebhook({
        payload: req.body,
        signature: req.headers['stripe-signature'],
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      });
      res.status(200).json(result);
    } catch (err) { next(err); }
  };

  createRefund = async (req, res, next) => {
    try {
      const ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;
      const refund = await this.paymentService.createRefund({ ...req.body, ipAddr });
      res.status(200).json({ status: 'success', data: { refund } });
    } catch (err) { next(err); }
  };

  createMomoUrl = async (req, res, next) => {
    try {
      const data = await this.paymentService.createMomoUrl(req.body);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
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
        return res.status(400).json({ message: 'Chữ ký không hợp lệ' });
      }
      res.status(204).send();
    } catch (err) {
      this.logger.error('Lỗi MoMo IPN:', err);
      res.status(500).json({ message: err.message });
    }
  };

  createVNPayUrl = async (req, res, next) => {
    try {
      const ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress;
      const data = await this.paymentService.createVNPayUrl({ ...req.body, ipAddr });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  vnpayReturn = async (req, res, next) => {
    try {
      const { redirectUrl } = await this.paymentService.handleVnPayReturn({ vnp_Params: req.query });
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
      return res.status(200).json({ RspCode: '99', Message: 'Lỗi không xác định' });
    }
  };
}

module.exports = PaymentController;
