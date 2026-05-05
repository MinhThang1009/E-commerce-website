// OrderDeliveredEvent — publish khi đơn chuyển sang delivered.
// Trigger trao loyalty points + send delivery email.
module.exports = function OrderDeliveredEvent({ orderId, orderNumber, userId, total, subtotal }) {
  return {
    type: 'order.delivered',
    payload: { orderId, orderNumber, userId, total, subtotal },
    occurredAt: new Date().toISOString(),
  };
};
