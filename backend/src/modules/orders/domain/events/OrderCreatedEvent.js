// OrderCreatedEvent — publish khi createOrder thành công.
// Sprint 9 inventory module có thể subscribe để verify stock đã trừ đúng.
module.exports = function OrderCreatedEvent({ orderId, orderNumber, userId, total, items }) {
  return {
    type: 'order.created',
    payload: { orderId, orderNumber, userId, total, items },
    occurredAt: new Date().toISOString(),
  };
};
