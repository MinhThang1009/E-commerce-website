const IPaymentGateway = require('../domain/ports/IPaymentGateway');

// Stripe adapter — wrap services/payment/stripe.js để service phụ thuộc
// IPaymentGateway thay vì stripe SDK trực tiếp.
class StripeGateway extends IPaymentGateway {
  constructor({ stripeService }) {
    super();
    this.stripeService = stripeService;
  }

  createPaymentIntent(input) { return this.stripeService.createPaymentIntent(input); }
  confirmPaymentIntent(id) { return this.stripeService.confirmPaymentIntent(id); }
  createCustomer(input) { return this.stripeService.createCustomer(input); }
  getCustomer(id) { return this.stripeService.getCustomer(id); }
  getPaymentMethods(customerId) { return this.stripeService.getPaymentMethods(customerId); }
  createSetupIntent(customerId) { return this.stripeService.createSetupIntent(customerId); }
  handleWebhook(payload, signature) { return this.stripeService.handleWebhook(payload, signature); }
  createRefund(input) { return this.stripeService.createRefund(input); }
}

module.exports = StripeGateway;
