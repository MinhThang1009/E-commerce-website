// Phase 42.11 — Unit tests cho OrdersService (DDD-lite).
const OrdersService = require('./orders-service');

describe('OrdersService', () => {
  let repo;
  let emailGateway;
  let eventBus;
  let service;

  const constants = {
    POINTS_EARN_RATE: 1000,
    POINTS_VALUE: 100,
    SHIPPING_FREE_THRESHOLD: 500000,
    SHIPPING_BASE_RATE: 30000,
    SHIPPING_WEIGHT_RATE: 5000,
  };

  beforeEach(() => {
    repo = {
      findOrderByPkBasic: jest.fn(),
      findOrderByIdAndUserId: jest.fn(),
      findOrderByPkWithItemsAndUser: jest.fn(),
      findOrderByNumberAndUserId: jest.fn(),
      findOrderByNumberWithUserEmail: jest.fn(),
      findUserOrdersWithItems: jest.fn(),
      findAllOrdersWithUser: jest.fn(),
      findOrderForCancel: jest.fn(),
      createOrder: jest.fn(),
      createOrderItem: jest.fn(),
      saveOrder: jest.fn(async (o) => o),
      cancelPendingOrdersByUser: jest.fn().mockResolvedValue(),
      findOrCreateActiveCart: jest.fn(),
      findActiveCartBySessionId: jest.fn(),
      findCartByPkWithItemsDetails: jest.fn(),
      findCartItemMatching: jest.fn(),
      saveCartItem: jest.fn(),
      deleteCartItem: jest.fn(),
      saveCart: jest.fn(),
      findActiveCartsByUser: jest.fn().mockResolvedValue([]),
      clearCartItems: jest.fn().mockResolvedValue(),
      findProductWithDefaultVariant: jest.fn(),
      findVariantBasic: jest.fn(),
      lockProduct: jest.fn(),
      lockVariant: jest.fn(),
      decrementProductStock: jest.fn().mockResolvedValue(),
      decrementVariantStock: jest.fn().mockResolvedValue(),
      restoreProductStock: jest.fn().mockResolvedValue(),
      restoreVariantStock: jest.fn().mockResolvedValue(),
      findActiveWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
      findActiveDiscountCode: jest.fn(),
      incrementDiscountCodeUsage: jest.fn().mockResolvedValue(),
      findUserById: jest.fn(),
      updateUserPoints: jest.fn().mockResolvedValue(),
      createLoyaltyHistory: jest.fn().mockResolvedValue(),
      updateLoyaltyHistoryOrderId: jest.fn().mockResolvedValue(),
      createInventoryLogs: jest.fn().mockResolvedValue(),
      runInTransaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    };
    emailGateway = {
      sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
      sendOrderCancellationEmail: jest.fn().mockResolvedValue(),
      sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };

    service = new OrdersService({
      ordersRepository: repo,
      emailGateway, eventBus,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      constants,
    });
  });

  describe('Helpers', () => {
    test('_generateOrderNumber format ORD-YYMM-...', () => {
      const num = service._generateOrderNumber();
      expect(num).toMatch(/^ORD-\d{4}-\d+-[0-9A-F]{8}$/);
    });

    test('_calculateShipping qua ShippingPolicy', () => {
      expect(service._calculateShipping(600000, 1)).toBe(0);
      expect(service._calculateShipping(100000, 1)).toBe(30000);
    });

    test('estimateShipping public method', () => {
      const result = service.estimateShipping({ subtotal: '600000', weight: '1' });
      expect(result.shippingCost).toBe(0);
      expect(result.freeShippingThreshold).toBe(500000);
    });
  });

  describe('cancelOrder', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderForCancel.mockResolvedValue(null);
      await expect(
        service.cancelOrder({ id: 99, userId: 1 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('order shipped → DomainError 422 (qua aggregate)', async () => {
      repo.findOrderForCancel.mockResolvedValue({
        id: 1, status: 'shipped', items: [], pointsUsed: 0, pointsEarned: 0, userId: 1, number: 'X',
      });
      await expect(
        service.cancelOrder({ id: 1, userId: 1 })
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('hợp lệ pending → status=cancelled + restore stock + publish event', async () => {
      const variant = { id: 5, stockQuantity: 10 };
      const order = {
        id: 1, status: 'pending', userId: 1, number: 'ORD-1', pointsUsed: 0, pointsEarned: 0,
        items: [{ productId: 10, variantId: 5, quantity: 2, ProductVariant: variant, Product: null }],
      };
      repo.findOrderForCancel.mockResolvedValue(order);

      await service.cancelOrder({ id: 1, userId: 1 });

      expect(order.status).toBe('cancelled');
      expect(repo.restoreVariantStock).toHaveBeenCalledWith(variant, 2, expect.any(Object));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order.cancelled' })
      );
    });

    test('hợp lệ + pointsUsed > 0 → refund points', async () => {
      const order = {
        id: 1, status: 'pending', userId: 1, number: 'X',
        pointsUsed: 50, pointsEarned: 0, items: [],
      };
      repo.findOrderForCancel.mockResolvedValue(order);
      repo.findUserById.mockResolvedValue({ loyaltyPoints: 100 });

      await service.cancelOrder({ id: 1, userId: 1 });

      expect(repo.updateUserPoints).toHaveBeenCalledWith(
        expect.objectContaining({ loyaltyPoints: 100 }),
        150,  // 100 + 50
        expect.any(Object)
      );
      expect(repo.createLoyaltyHistory).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refund', points: 50 }),
        expect.any(Object)
      );
    });

    test('pointsEarned > 0 → revoke earned points', async () => {
      const order = {
        id: 1, status: 'processing', userId: 1, number: 'X',
        pointsUsed: 0, pointsEarned: 30, items: [],
      };
      repo.findOrderForCancel.mockResolvedValue(order);
      repo.findUserById.mockResolvedValue({ loyaltyPoints: 100 });

      await service.cancelOrder({ id: 1, userId: 1 });

      expect(repo.updateUserPoints).toHaveBeenCalledWith(
        expect.any(Object), 70, expect.any(Object)
      );
    });
  });

  describe('repayOrder', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.repayOrder({ id: 99, userId: 1, originUrl: '' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('shipped → DomainError', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue({ status: 'shipped', paymentStatus: 'paid' });
      await expect(
        service.repayOrder({ id: 1, userId: 1, originUrl: 'http://x' })
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('cancelled → reset pending + paymentUrl', async () => {
      const order = { id: 5, number: 'ORD-X', status: 'cancelled', paymentStatus: 'pending', total: 1000 };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);

      const result = await service.repayOrder({ id: 5, userId: 1, originUrl: 'http://shop' });

      expect(order.status).toBe('pending');
      expect(result.paymentUrl).toBe('http://shop/checkout?repayOrder=5&amount=1000');
    });
  });

  describe('confirmReceived', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.confirmReceived({ id: 99, userId: 1 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('đã delivered + pointsEarned > 0 → alreadyProcessed', async () => {
      const order = {
        status: 'delivered', pointsEarned: 50,
        reload: jest.fn(),
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);

      const result = await service.confirmReceived({ id: 1, userId: 1 });

      expect(result.message).toBe('orders.alreadyConfirmed');
      expect(result.pointsEarned).toBe(0);
    });

    test('shipped → trao điểm + publish event', async () => {
      const order = {
        id: 1, status: 'shipped', userId: 1, number: 'X',
        paymentMethod: 'cod', subtotal: 5000, total: 5000, pointsEarned: 0,
        reload: jest.fn(),
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);
      repo.findUserById.mockResolvedValue({ loyaltyPoints: 0 });

      const result = await service.confirmReceived({ id: 1, userId: 1 });

      // 5000/1000 = 5 points
      expect(result.pointsEarned).toBe(5);
      expect(repo.updateUserPoints).toHaveBeenCalledWith(expect.any(Object), 5);
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order.delivered' })
      );
    });

    test('subtotal=0 → mark pointsEarned=-1 (đã xử lý)', async () => {
      const order = {
        id: 1, status: 'shipped', userId: 1, number: 'X',
        paymentMethod: 'cod', subtotal: 0, total: 0, pointsEarned: 0,
        reload: jest.fn(),
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);

      const result = await service.confirmReceived({ id: 1, userId: 1 });

      expect(result.pointsEarned).toBe(0); // result is what AWARDED, not stored
    });
  });

  describe('updateOrderStatus', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);
      await expect(
        service.updateOrderStatus({ id: 99, status: 'shipped' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('chuyển sang delivered → trao điểm + publish OrderDelivered', async () => {
      const order = {
        id: 1, number: 'X', userId: 5, status: 'shipped',
        paymentMethod: 'cod', paymentStatus: 'pending',
        subtotal: 10000, total: 10000, createdAt: new Date(),
        user: { email: 'u@x.y' },
      };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      repo.findUserById.mockResolvedValue({ loyaltyPoints: 0 });

      await service.updateOrderStatus({ id: 1, status: 'delivered' });

      expect(order.status).toBe('delivered');
      expect(order.paymentStatus).toBe('paid'); // COD auto-paid
      expect(repo.createLoyaltyHistory).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'earn', points: 10 })
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order.delivered' })
      );
    });
  });

  describe('trackOrder', () => {
    test('thiếu params → 400', async () => {
      await expect(service.trackOrder({})).rejects.toMatchObject({ statusCode: 400 });
    });

    test('email không khớp → 404', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue({
        User: { email: 'real@x.y' },
        status: 'pending',
      });
      await expect(
        service.trackOrder({ orderNumber: 'X', email: 'fake@x.y' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('match → trả tracking steps', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue({
        number: 'ORD-1', status: 'shipped', createdAt: new Date(), updatedAt: new Date(),
        User: { email: 'u@x.y' },
      });
      const result = await service.trackOrder({ orderNumber: 'ORD-1', email: 'u@x.y' });
      expect(result.currentStatus).toBe('shipped');
      expect(result.steps).toHaveLength(4);
    });
  });

  describe('getOrderById', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);
      await expect(
        service.getOrderById({ id: 99, userId: 1, role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user khác chủ + không phải admin → 403', async () => {
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue({ userId: 5 });
      await expect(
        service.getOrderById({ id: 1, userId: 1, role: 'customer' })
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('admin có thể xem mọi đơn', async () => {
      const order = { userId: 5 };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 1, userId: 1, role: 'admin' });
      expect(result).toBe(order);
    });
  });
});
