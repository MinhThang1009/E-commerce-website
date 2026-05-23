// Phase 42.11 — Unit tests cho OrdersService (DDD-lite).
const OrdersService = require('./orders-service');

describe('OrdersService', () => {
  let repo;
  let emailGateway;
  let eventBus;
  let service;

  const constants = {
    SHIPPING_FREE_THRESHOLD: 2000000,
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
      findActiveDiscountCode: jest.fn(),
      incrementDiscountCodeUsage: jest.fn().mockResolvedValue(),
      findUserById: jest.fn(),
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
      emailGateway,
      eventBus,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      constants,
    });
  });

  describe('Helpers', () => {
    test('_generateOrderNumber format ORD-YYYYMMDD-RAND', () => {
      const num = service._generateOrderNumber();
      expect(num).toMatch(/^ORD-\d{8}-\d{4}$/);
    });

    test('estimateShipping public method — subtotal >= threshold → shippingCost = 0', () => {
      const result = service.estimateShipping({ subtotal: '2000000', weight: '1' });
      expect(result.shippingCost).toBe(0);
      expect(result.freeShippingThreshold).toBe(2000000);
    });

    test('estimateShipping public method — subtotal < threshold → shippingCost = null', () => {
      const result = service.estimateShipping({ subtotal: '600000', weight: '1' });
      expect(result.shippingCost).toBeNull();
      expect(result.freeShippingThreshold).toBe(2000000);
    });
  });

  describe('cancelOrder', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderForCancel.mockResolvedValue(null);
      await expect(service.cancelOrder({ id: 99, userId: 1 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('order shipped → DomainError 422 (qua aggregate)', async () => {
      repo.findOrderForCancel.mockResolvedValue({
        id: 1,
        status: 'shipped',
        items: [],
        userId: 1,
        number: 'X',
      });
      await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
        statusCode: 422,
      });
    });

    test('hợp lệ pending → status=cancelled + restore stock + publish event', async () => {
      const variant = { id: 5, stockQuantity: 10 };
      const order = {
        id: 1,
        status: 'pending',
        userId: 1,
        number: 'ORD-1',
        items: [
          { productId: 10, variantId: 5, quantity: 2, ProductVariant: variant, Product: null },
        ],
      };
      repo.findOrderForCancel.mockResolvedValue(order);

      await service.cancelOrder({ id: 1, userId: 1 });

      expect(order.status).toBe('cancelled');
      expect(repo.restoreVariantStock).toHaveBeenCalledWith(variant, 2, expect.any(Object));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order.cancelled' }),
      );
    });
  });

  describe('repayOrder', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue(null);
      await expect(service.repayOrder({ id: 99, userId: 1, originUrl: '' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('shipped → DomainError', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue({ status: 'shipped', paymentStatus: 'paid' });
      await expect(
        service.repayOrder({ id: 1, userId: 1, originUrl: 'http://x' }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('cancelled → reset pending + paymentUrl', async () => {
      const order = {
        id: 5,
        number: 'ORD-X',
        status: 'cancelled',
        paymentStatus: 'pending',
        total: 1000,
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);

      const result = await service.repayOrder({ id: 5, userId: 1, originUrl: 'http://shop' });

      expect(order.status).toBe('pending');
      expect(result.paymentUrl).toBe('http://shop/checkout?repayOrder=5&amount=1000');
    });
  });

  describe('confirmReceived', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue(null);
      await expect(service.confirmReceived({ id: 99, userId: 1 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('đơn hàng ở trạng thái shipped → cập nhật thành delivered và trả về kết quả', async () => {
      const order = {
        id: 5,
        number: 'ORD-20240101-0001',
        status: 'shipped',
        paymentMethod: 'banking',
        paymentStatus: 'pending',
        reload: jest.fn().mockResolvedValue(undefined),
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);
      repo.saveOrder.mockResolvedValue(order);

      const result = await service.confirmReceived({ id: 5, userId: 1 });

      expect(order.status).toBe('delivered');
      expect(order.paymentStatus).toBe('pending'); // không phải cod → không đổi
      expect(repo.saveOrder).toHaveBeenCalledWith(order);
      expect(result.data.status).toBe('delivered');
      expect(result.data.id).toBe(5);
    });

    test('đơn hàng COD → cập nhật paymentStatus thành paid khi xác nhận nhận hàng', async () => {
      const order = {
        id: 6,
        number: 'ORD-20240101-0002',
        status: 'processing',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        reload: jest.fn().mockResolvedValue(undefined),
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);
      repo.saveOrder.mockResolvedValue(order);

      await service.confirmReceived({ id: 6, userId: 1 });

      expect(order.paymentStatus).toBe('paid');
    });
  });

  describe('updateOrderStatus', () => {
    test('không tồn tại → 404', async () => {
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);
      await expect(service.updateOrderStatus({ id: 99, status: 'shipped' })).rejects.toMatchObject({
        statusCode: 404,
      });
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
        service.trackOrder({ orderNumber: 'X', email: 'fake@x.y' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('match → trả tracking steps', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue({
        number: 'ORD-1',
        status: 'shipped',
        createdAt: new Date(),
        updatedAt: new Date(),
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
        service.getOrderById({ id: 99, userId: 1, role: 'customer' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user khác chủ + không phải admin → 403', async () => {
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue({ userId: 5 });
      await expect(
        service.getOrderById({ id: 1, userId: 1, role: 'customer' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    test('admin có thể xem mọi đơn', async () => {
      const order = { userId: 5 };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 1, userId: 1, role: 'admin' });
      expect(result).toMatchObject({ userId: 5 });
    });
  });
});
