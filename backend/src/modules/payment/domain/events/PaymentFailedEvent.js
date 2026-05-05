// PaymentFailedEvent — publish khi payment thất bại.
// Service có thể subscribe để retry/notify user.
module.exports = function PaymentFailedEvent({ orderId, orderNumber, transactionId, provider, reason }) {
  return {
    type: 'payment.failed',
    payload: { orderId, orderNumber, transactionId, provider, reason },
    occurredAt: new Date().toISOString(),
  };
};
