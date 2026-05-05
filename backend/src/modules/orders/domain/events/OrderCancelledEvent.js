// OrderCancelledEvent — publish khi cancelOrder thành công.
// Sprint 9 inventory subscribe để restore stock; payment subscribe để refund nếu cần.
module.exports = function OrderCancelledEvent({ orderId, orderNumber, userId, items }) {
  return {
    type: 'order.cancelled',
    payload: { orderId, orderNumber, userId, items },
    occurredAt: new Date().toISOString(),
  };
};
