// IPaymentGateway — abstract port cho payment gateway. Mỗi adapter
// (StripeGateway/MomoGateway/VnPayGateway) implement subset method tương ứng
// với khả năng của gateway.
//
// Service không phụ thuộc adapter cụ thể — chỉ phụ thuộc interface này, dễ
// swap/test mock + mở rộng gateway mới (PayPal/ZaloPay/...).

class IPaymentGateway {
  // Stripe-style: create + confirm payment intent
  async createPaymentIntent(_input) { throw new Error('not implemented by this gateway'); }
  async confirmPaymentIntent(_id) { throw new Error('not implemented by this gateway'); }
  async createCustomer(_input) { throw new Error('not implemented by this gateway'); }
  async getCustomer(_id) { throw new Error('not implemented by this gateway'); }
  async getPaymentMethods(_customerId) { throw new Error('not implemented by this gateway'); }
  async createSetupIntent(_customerId) { throw new Error('not implemented by this gateway'); }
  async handleWebhook(_payload, _signature) { throw new Error('not implemented by this gateway'); }
  async createRefund(_input) { throw new Error('not implemented by this gateway'); }

  // MoMo/VNPay-style: redirect-based payment URL
  async createPaymentUrl(_input) { throw new Error('not implemented by this gateway'); }
  verifySignature(_payload) { throw new Error('not implemented by this gateway'); }
  verifyReturnUrl(_params) { throw new Error('not implemented by this gateway'); }

  // VNPay-only: server-to-server refund
  async refund(_input) { throw new Error('not implemented by this gateway'); }
}

module.exports = IPaymentGateway;
