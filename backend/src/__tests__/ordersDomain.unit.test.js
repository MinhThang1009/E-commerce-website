// Phase 42.11 — Unit tests cho Orders DDD-lite domain layer
// (OrderAggregate + OrderStatusPolicy + ShippingPolicy).

const OrderAggregate = require('../modules/orders/domain/aggregates/OrderAggregate');
const OrderStatusPolicy = require('../modules/orders/domain/policies/OrderStatusPolicy');
const { calculateShippingCost } = require('../modules/orders/domain/policies/ShippingPolicy');

describe('Orders Domain', () => {
  describe('OrderStatusPolicy', () => {
    test('canCancel: pending/processing → true; shipped/delivered/cancelled → false', () => {
      expect(OrderStatusPolicy.canCancel('pending')).toBe(true);
      expect(OrderStatusPolicy.canCancel('processing')).toBe(true);
      expect(OrderStatusPolicy.canCancel('shipped')).toBe(false);
      expect(OrderStatusPolicy.canCancel('delivered')).toBe(false);
      expect(OrderStatusPolicy.canCancel('cancelled')).toBe(false);
    });

    test('canRepay: pending/cancelled OR paymentStatus=failed', () => {
      expect(OrderStatusPolicy.canRepay('pending', 'pending')).toBe(true);
      expect(OrderStatusPolicy.canRepay('cancelled', 'pending')).toBe(true);
      expect(OrderStatusPolicy.canRepay('processing', 'failed')).toBe(true);
      expect(OrderStatusPolicy.canRepay('processing', 'paid')).toBe(false);
    });

    test('canConfirmReceived: shipped/processing/delivered', () => {
      expect(OrderStatusPolicy.canConfirmReceived('shipped')).toBe(true);
      expect(OrderStatusPolicy.canConfirmReceived('processing')).toBe(true);
      expect(OrderStatusPolicy.canConfirmReceived('delivered')).toBe(true);
      expect(OrderStatusPolicy.canConfirmReceived('pending')).toBe(false);
      expect(OrderStatusPolicy.canConfirmReceived('cancelled')).toBe(false);
    });

    test('buildTrackingSteps: chỉ mark completed cho status đã đi qua', () => {
      const steps = OrderStatusPolicy.buildTrackingSteps('shipped');
      expect(steps[0].completed).toBe(true);   // pending
      expect(steps[1].completed).toBe(true);   // processing
      expect(steps[2].completed).toBe(true);   // shipped
      expect(steps[3].completed).toBe(false);  // delivered
    });

    test('buildTrackingSteps cancelled → tất cả không completed', () => {
      const steps = OrderStatusPolicy.buildTrackingSteps('cancelled');
      expect(steps[0].completed).toBe(false);
    });
  });

  describe('ShippingPolicy', () => {
    const constants = {
      freeThreshold: 500000,
      baseRate: 30000,
      weightRate: 5000,
    };

    test('subtotal ≥ free threshold → 0', () => {
      expect(calculateShippingCost({ subtotal: 600000, totalWeightKg: 5, ...constants })).toBe(0);
    });

    test('weight dưới 2kg → chỉ baseRate', () => {
      expect(calculateShippingCost({ subtotal: 100000, totalWeightKg: 1.5, ...constants })).toBe(30000);
    });

    test('weight 5kg → base + ceil(3) × 5000 = 30000 + 15000 = 45000', () => {
      expect(calculateShippingCost({ subtotal: 100000, totalWeightKg: 5, ...constants })).toBe(45000);
    });

    test('weight 2.1kg → ceil(0.1)=1 × 5000 = 35000', () => {
      expect(calculateShippingCost({ subtotal: 100000, totalWeightKg: 2.1, ...constants })).toBe(35000);
    });
  });

  describe('OrderAggregate', () => {
    test('throw nếu thiếu orderModel', () => {
      expect(() => new OrderAggregate(null)).toThrow();
    });

    test('cancel pending → status=cancelled', () => {
      const order = { status: 'pending' };
      const agg = new OrderAggregate(order);
      agg.cancel();
      expect(order.status).toBe('cancelled');
    });

    test('cancel shipped → DomainError', () => {
      const order = { status: 'shipped' };
      const agg = new OrderAggregate(order);
      expect(() => agg.cancel()).toThrow();
      expect(() => agg.cancel()).toThrow(/Không thể hủy/);
    });

    test('markAsProcessing chỉ từ pending', () => {
      const order = { status: 'pending' };
      const agg = new OrderAggregate(order);
      agg.markAsProcessing();
      expect(order.status).toBe('processing');

      const order2 = { status: 'shipped' };
      expect(() => new OrderAggregate(order2).markAsProcessing()).toThrow();
    });

    test('markAsShipped chỉ từ processing', () => {
      const order = { status: 'processing' };
      new OrderAggregate(order).markAsShipped();
      expect(order.status).toBe('shipped');

      const bad = { status: 'pending' };
      expect(() => new OrderAggregate(bad).markAsShipped()).toThrow();
    });

    test('markAsDelivered idempotent + auto-paid cho COD', () => {
      const order = { status: 'shipped', paymentMethod: 'cod', paymentStatus: 'pending' };
      new OrderAggregate(order).markAsDelivered();
      expect(order.status).toBe('delivered');
      expect(order.paymentStatus).toBe('paid');

      // Idempotent: gọi lại không throw
      new OrderAggregate(order).markAsDelivered();
      expect(order.status).toBe('delivered');
    });

    test('prepareRepay reset status về pending', () => {
      const order = { status: 'cancelled', paymentStatus: 'failed' };
      new OrderAggregate(order).prepareRepay();
      expect(order.status).toBe('pending');
      expect(order.paymentStatus).toBe('pending');
    });

    test('prepareRepay throw nếu shipped/delivered', () => {
      const order = { status: 'shipped', paymentStatus: 'paid' };
      expect(() => new OrderAggregate(order).prepareRepay()).toThrow();
    });

    test('confirmReceived: alreadyProcessed nếu delivered + đã trao điểm', () => {
      const order = { status: 'delivered', pointsEarned: 100 };
      const result = new OrderAggregate(order).confirmReceived();
      expect(result.alreadyProcessed).toBe(true);
    });

    test('confirmReceived: shipped → delivered + paid (COD)', () => {
      const order = { status: 'shipped', paymentMethod: 'cod', pointsEarned: 0 };
      const result = new OrderAggregate(order).confirmReceived();
      expect(result.alreadyProcessed).toBe(false);
      expect(order.status).toBe('delivered');
      expect(order.paymentStatus).toBe('paid');
    });

    test('confirmReceived pending → DomainError', () => {
      const order = { status: 'pending', pointsEarned: 0 };
      expect(() => new OrderAggregate(order).confirmReceived()).toThrow();
    });

    test('canEarnPoints: pointsEarned=0 → true; -1/N → false', () => {
      expect(new OrderAggregate({ pointsEarned: 0 }).canEarnPoints()).toBe(true);
      expect(new OrderAggregate({ pointsEarned: -1 }).canEarnPoints()).toBe(false);
      expect(new OrderAggregate({ pointsEarned: 100 }).canEarnPoints()).toBe(false);
    });

    test('isOwnedBy: match userId', () => {
      const order = { userId: 5 };
      expect(new OrderAggregate(order).isOwnedBy(5)).toBe(true);
      expect(new OrderAggregate(order).isOwnedBy(99)).toBe(false);
    });
  });
});
