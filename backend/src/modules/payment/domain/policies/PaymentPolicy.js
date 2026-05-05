// PaymentPolicy — pure business rules cho payment processing.
//
// Quy tắc:
//   - canProcessPayment: idempotency check (order chưa paid + transactionId mới)
//   - canRefund: order đã paid + có transactionId + provider hỗ trợ refund

const SUPPORTED_REFUND_PROVIDERS = ['stripe', 'vnpay'];

function canProcessPayment(order, transactionId) {
  if (!order) return false;
  if (transactionId && order.paymentTransactionId === transactionId) return false;
  return order.paymentStatus !== 'paid';
}

function canRefund(order) {
  if (!order) return { allowed: false, reason: 'Không tìm thấy đơn hàng' };
  if (!order.paymentTransactionId) {
    return { allowed: false, reason: 'Không tìm thấy giao dịch thanh toán cho đơn hàng này' };
  }
  if (!SUPPORTED_REFUND_PROVIDERS.includes(order.paymentProvider)) {
    return { allowed: false, reason: `Hoàn tiền chưa được hỗ trợ cho ${order.paymentProvider}` };
  }
  return { allowed: true };
}

module.exports = {
  canProcessPayment,
  canRefund,
  SUPPORTED_REFUND_PROVIDERS,
};
