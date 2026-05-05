const IPaymentGateway = require('../domain/ports/IPaymentGateway');

// VNPay adapter — wrap services/payment/vnpay.js
class VnPayGateway extends IPaymentGateway {
  constructor({ vnpayService }) {
    super();
    this.vnpayService = vnpayService;
  }

  createPaymentUrl(input) { return this.vnpayService.createPaymentUrl(input); }
  verifyReturnUrl(params) { return this.vnpayService.verifyReturnUrl(params); }
  refund(input) { return this.vnpayService.refund(input); }
}

module.exports = VnPayGateway;
