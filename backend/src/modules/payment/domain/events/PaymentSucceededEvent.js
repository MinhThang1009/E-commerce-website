// PaymentSucceededEvent — publish khi payment đã xác nhận thành công cho order.
// Sprint 7 orders subscribe để xác nhận order processing.
module.exports = function PaymentSucceededEvent({ orderId, orderNumber, transactionId, provider, amount }) {
  return {
    type: 'payment.succeeded',
    payload: { orderId, orderNumber, transactionId, provider, amount },
    occurredAt: new Date().toISOString(),
  };
};
