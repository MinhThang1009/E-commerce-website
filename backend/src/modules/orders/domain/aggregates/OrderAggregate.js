const { DomainError } = require('../../../../shared/errors');
const {
  STATUS, canCancel, canConfirmReceived, canRepay,
} = require('../policies/OrderStatusPolicy');

// OrderAggregate — wrap Order Sequelize instance + enforce domain rules.
// State transitions kiểm tra qua OrderStatusPolicy; method throw DomainError
// (422) nếu vi phạm invariant.
//
// Aggregate KHÔNG persist trực tiếp — service gọi repository.saveOrder() sau
// khi mutate. Đây là design "rich anemic hybrid" — đủ DDD-lite cho thesis,
// không over-engineered.
class OrderAggregate {
  constructor(orderModel) {
    if (!orderModel) throw new Error('OrderAggregate: orderModel bắt buộc');
    this.order = orderModel;
  }

  get state() {
    return this.order.status;
  }

  cancel() {
    if (!canCancel(this.order.status)) {
      throw new DomainError('Không thể hủy đơn hàng này', 'ORDER_CANNOT_CANCEL');
    }
    this.order.status = STATUS.CANCELLED;
    return this.order;
  }

  markAsProcessing() {
    if (this.order.status !== STATUS.PENDING) {
      throw new DomainError('Chỉ có thể chuyển sang processing từ pending', 'ORDER_INVALID_TRANSITION');
    }
    this.order.status = STATUS.PROCESSING;
    return this.order;
  }

  markAsShipped() {
    if (this.order.status !== STATUS.PROCESSING) {
      throw new DomainError('Chỉ có thể chuyển sang shipped từ processing', 'ORDER_INVALID_TRANSITION');
    }
    this.order.status = STATUS.SHIPPED;
    return this.order;
  }

  // markAsDelivered có thể từ shipped HOẶC user confirm received từ
  // shipped/processing — không phải state machine strict.
  markAsDelivered() {
    if (this.order.status === STATUS.DELIVERED) return this.order; // idempotent
    this.order.status = STATUS.DELIVERED;
    if (this.order.paymentMethod === 'cod') {
      this.order.paymentStatus = 'paid';
    }
    return this.order;
  }

  // Repay reset status về pending — dùng khi user thử thanh toán lại.
  prepareRepay() {
    if (!canRepay(this.order.status, this.order.paymentStatus)) {
      throw new DomainError('Đơn hàng này không thể thanh toán lại', 'ORDER_CANNOT_REPAY');
    }
    this.order.status = STATUS.PENDING;
    this.order.paymentStatus = 'pending';
    return this.order;
  }

  // confirmReceived (user xác nhận nhận hàng): cho phép từ shipped/processing/delivered.
  // Idempotent: nếu đã delivered + đã trao điểm, không trao lại.
  confirmReceived() {
    if (this.order.status === STATUS.DELIVERED && this.order.pointsEarned !== 0) {
      return { order: this.order, alreadyProcessed: true };
    }
    if (!canConfirmReceived(this.order.status)) {
      throw new DomainError(
        'Chỉ có thể xác nhận đơn hàng khi đang giao, đang xử lý hoặc đã giao hàng',
        'ORDER_CANNOT_CONFIRM_RECEIVED'
      );
    }
    this.order.status = STATUS.DELIVERED;
    if (this.order.paymentMethod === 'cod') {
      this.order.paymentStatus = 'paid';
    }
    return { order: this.order, alreadyProcessed: false };
  }

  // canEarnPoints: pointsEarned === 0 (chưa xử lý) — service gọi sau confirm.
  canEarnPoints() {
    return (this.order.pointsEarned || 0) === 0;
  }

  setPointsEarned(points) {
    this.order.pointsEarned = points;
  }

  isOwnedBy(userId) {
    return this.order.userId === userId;
  }
}

module.exports = OrderAggregate;
