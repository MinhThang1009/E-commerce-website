// OrderStatusPolicy — state machine cho order status transitions.
// Pure rules, không side-effect, dùng trong OrderAggregate cho mọi state change.

const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const VALID_STATUSES = Object.values(STATUS);

const STATUS_PROGRESSION = ['pending', 'processing', 'shipped', 'delivered'];

// Có thể hủy đơn ở 2 trạng thái pending hoặc processing.
function canCancel(status) {
  return status === STATUS.PENDING || status === STATUS.PROCESSING;
}

// Có thể repay khi pending, cancelled, hoặc paymentStatus=failed.
function canRepay(status, paymentStatus) {
  return status === STATUS.PENDING
    || status === STATUS.CANCELLED
    || paymentStatus === 'failed';
}

// Có thể confirm received khi shipped/processing/delivered.
function canConfirmReceived(status) {
  return status === STATUS.SHIPPED
    || status === STATUS.PROCESSING
    || status === STATUS.DELIVERED;
}

// Tracking step list cho public track endpoint.
function buildTrackingSteps(status) {
  const currentIndex = STATUS_PROGRESSION.indexOf(status);
  return [
    { key: 'pending', label: 'Đã đặt hàng', completed: currentIndex >= 0 && status !== STATUS.CANCELLED },
    { key: 'processing', label: 'Đang chuẩn bị', completed: currentIndex >= 1 },
    { key: 'shipped', label: 'Đang giao', completed: currentIndex >= 2 },
    { key: 'delivered', label: 'Đã nhận hàng', completed: currentIndex >= 3 },
  ];
}

module.exports = {
  STATUS,
  VALID_STATUSES,
  STATUS_PROGRESSION,
  canCancel,
  canRepay,
  canConfirmReceived,
  buildTrackingSteps,
};
