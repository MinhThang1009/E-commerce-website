const IPaymentGateway = require('../domain/ports/IPaymentGateway');

// MoMo adapter — wrap services/payment/momo.js
class MomoGateway extends IPaymentGateway {
  constructor({ momoService }) {
    super();
    this.momoService = momoService;
  }

  createPaymentUrl(input) { return this.momoService.createPaymentUrl(input); }
  verifySignature(payload) { return this.momoService.verifySignature(payload); }
}

module.exports = MomoGateway;
