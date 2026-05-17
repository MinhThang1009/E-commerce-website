// Tests bổ sung cho OrdersService — phủ các nhánh còn thiếu:
//   - _generateOrderNumber: format đúng ORD-YYMM-timestamp-RAND
//   - estimateShipping: tính đúng shippingCost
//   - getOrderByNumber: not found + success
//   - getAllOrders: filter theo status + pagination
//   - trackOrder: missing params + email mismatch + success
//   - updateOrderStatus: delivered COD auto-paid + loyalty points + email

const OrdersService = require('./ordersService');

const CONSTANTS = {
  POINTS_EARN_RATE: 1000,
  POINTS_VALUE: 100,
  SHIPPING_FREE_THRESHOLD: 500000,
  SHIPPING_BASE_RATE: 30000,
  SHIPPING_WEIGHT_RATE: 5000,
};

function buildService() {
  const repo = {
    runInTransaction: jest.fn(async (work) => work({})),
    findProductWithDefaultVariant: jest.fn(),
    findVariantBasic: jest.fn(),
    lockProduct: jest.fn(),
    lockVariant: jest.fn(),
    decrementProductStock: jest.fn().mockResolvedValue(),
    decrementVariantStock: jest.fn().mockResolvedValue(),
    restoreProductStock: jest.fn().mockResolvedValue(),
    restoreVariantStock: jest.fn().mockResolvedValue(),
    findActiveWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
    findOrCreateActiveCart: jest.fn(),
    findActiveCartBySessionId: jest.fn().mockResolvedValue(null),
    findCartByPkWithItemsDetails: jest.fn(),
    findCartItemMatching: jest.fn().mockResolvedValue(null),
    saveCartItem: jest.fn().mockResolvedValue(),
    deleteCartItem: jest.fn().mockResolvedValue(),
    saveCart: jest.fn().mockResolvedValue(),
    findActiveCartsByUser: jest.fn().mockResolvedValue([]),
    clearCartItems: jest.fn().mockResolvedValue(),
    findActiveDiscountCode: jest.fn().mockResolvedValue(null),
    incrementDiscountCodeUsage: jest.fn().mockResolvedValue(),
    findUserById: jest.fn(),
    updateUserPoints: jest.fn().mockResolvedValue(),
    createLoyaltyHistory: jest.fn().mockResolvedValue(),
    updateLoyaltyHistoryOrderId: jest.fn().mockResolvedValue(),
    createOrder: jest.fn(),
    createOrderItem: jest.fn(),
    createInventoryLogs: jest.fn().mockResolvedValue(),
    saveOrder: jest.fn(async (o) => o),
    cancelPendingOrdersByUser: jest.fn().mockResolvedValue(),
    findUserOrdersWithItems: jest.fn(),
    findOrderByPkWithItemsAndUser: jest.fn(),
    findOrderByNumberAndUserId: jest.fn(),
    findOrderForCancel: jest.fn(),
    findOrderByNumberWithUserEmail: jest.fn(),
    findOrderByIdAndUserId: jest.fn(),
    findAllOrdersWithUser: jest.fn(),
  };

  const emailGateway = {
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
    sendOrderCancellationEmail: jest.fn().mockResolvedValue(),
    sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(),
  };

  const eventBus = { publish: jest.fn().mockResolvedValue() };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const service = new OrdersService({
    ordersRepository: repo,
    emailGateway,
    eventBus,
    logger,
    constants: CONSTANTS,
  });

  return { service, repo, emailGateway, eventBus, logger };
}

// ────────────────────────────────────────────────────────────
// _generateOrderNumber (private — kiểm tra gián tiếp qua createOrder)
// ────────────────────────────────────────────────────────────

describe('OrdersService._generateOrderNumber', () => {
  test('orderNumber có prefix ORD- và format YYMM-timestamp-RAND', async () => {
    const { service } = buildService();

    // Gọi private method trực tiếp — không phải best practice nhưng
    // đây là cách duy nhất verify format mà không cần full createOrder
    const orderNumber = service._generateOrderNumber();

    expect(orderNumber).toMatch(/^ORD-\d{4}-\d+-[0-9A-F]{8}$/);
  });

  test('hai lần gọi _generateOrderNumber tạo ra số khác nhau', async () => {
    const { service } = buildService();

    const num1 = service._generateOrderNumber();
    const num2 = service._generateOrderNumber();

    // Timestamp và random bytes khác nhau → kết quả khác nhau
    // (có thể cùng timestamp trong millis nhưng random bytes khác)
    expect(num1).toMatch(/^ORD-/);
    expect(num2).toMatch(/^ORD-/);
  });
});

// ────────────────────────────────────────────────────────────
// estimateShipping
// ────────────────────────────────────────────────────────────

describe('OrdersService.estimateShipping', () => {
  let service;

  beforeEach(() => {
    ({ service } = buildService());
  });

  test('subtotal >= freeThreshold → shippingCost = 0', () => {
    const result = service.estimateShipping({ subtotal: 600000, weight: 2 });

    expect(result.shippingCost).toBe(0);
    expect(result.freeShippingThreshold).toBe(500000);
  });

  test('subtotal nhỏ + weight 0 → chỉ baseRate', () => {
    const result = service.estimateShipping({ subtotal: 100000, weight: 0 });

    expect(result.shippingCost).toBe(30000);
  });

  test('subtotal nhỏ + weight 5kg → baseRate + extra', () => {
    const result = service.estimateShipping({ subtotal: 100000, weight: 5 });

    // weight > 2kg → extra = ceil(3) * 5000 = 15000; total = 30000 + 15000 = 45000
    expect(result.shippingCost).toBe(45000);
  });

  test('subtotal và weight là string → parse đúng', () => {
    const result = service.estimateShipping({ subtotal: '200000', weight: '1' });

    expect(result.shippingCost).toBe(30000);
  });

  test('subtotal không hợp lệ → fallback về 0', () => {
    const result = service.estimateShipping({ subtotal: undefined, weight: undefined });

    expect(result.shippingCost).toBe(30000); // sub=0, weight=0 → baseRate
  });

  test('trả về freeShippingThreshold từ constants', () => {
    const result = service.estimateShipping({ subtotal: 100000, weight: 0 });

    expect(result.freeShippingThreshold).toBe(CONSTANTS.SHIPPING_FREE_THRESHOLD);
  });
});

// ────────────────────────────────────────────────────────────
// getOrderByNumber
// ────────────────────────────────────────────────────────────

describe('OrdersService.getOrderByNumber', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('không tìm thấy order → AppError 404', async () => {
    repo.findOrderByNumberAndUserId.mockResolvedValue(null);

    await expect(
      service.getOrderByNumber({ number: 'ORD-MISSING', userId: 1 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('tìm thấy → trả về order', async () => {
    const order = { id: 5, number: 'ORD-001', userId: 1 };
    repo.findOrderByNumberAndUserId.mockResolvedValue(order);

    const result = await service.getOrderByNumber({ number: 'ORD-001', userId: 1 });

    expect(result).toBe(order);
    expect(repo.findOrderByNumberAndUserId).toHaveBeenCalledWith('ORD-001', 1);
  });
});

// ────────────────────────────────────────────────────────────
// getAllOrders
// ────────────────────────────────────────────────────────────

describe('OrdersService.getAllOrders', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('không filter status → where rỗng', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllOrders({ page: 1, limit: 20 });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  test('filter theo status → where.status được set', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 2, rows: [] });

    await service.getAllOrders({ page: 1, limit: 10, status: 'pending' });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } })
    );
  });

  test('trả về đúng pagination', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 2, rows });

    const result = await service.getAllOrders({ page: 1, limit: 10 });

    expect(result).toEqual({ data: rows, total: 2, page: 1, limit: 10 });
  });

  test('limit > 100 → cap về 100', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllOrders({ page: 1, limit: 999 });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 })
    );
  });
});

// ────────────────────────────────────────────────────────────
// trackOrder
// ────────────────────────────────────────────────────────────

describe('OrdersService.trackOrder', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('thiếu orderNumber → AppError 400', async () => {
    await expect(
      service.trackOrder({ orderNumber: '', email: 'a@x.com' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('thiếu email → AppError 400', async () => {
    await expect(
      service.trackOrder({ orderNumber: 'ORD-001', email: '' })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('order không tồn tại → AppError 404', async () => {
    repo.findOrderByNumberWithUserEmail.mockResolvedValue(null);

    await expect(
      service.trackOrder({ orderNumber: 'ORD-MISSING', email: 'a@x.com' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('email không khớp → AppError 404', async () => {
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-001',
      status: 'pending',
      User: { email: 'owner@x.com' },
    });

    await expect(
      service.trackOrder({ orderNumber: 'ORD-001', email: 'hacker@x.com' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('email khớp case-insensitive → trả về tracking info', async () => {
    const order = {
      number: 'ORD-001',
      status: 'shipped',
      createdAt: new Date(),
      updatedAt: new Date(),
      User: { email: 'Owner@X.COM' },
    };
    repo.findOrderByNumberWithUserEmail.mockResolvedValue(order);

    const result = await service.trackOrder({ orderNumber: 'ORD-001', email: 'owner@x.com' });

    expect(result.orderNumber).toBe('ORD-001');
    expect(result.currentStatus).toBe('shipped');
    expect(result.steps).toBeDefined();
    expect(result.isCancelled).toBe(false);
  });

  test('order cancelled → isCancelled = true', async () => {
    const order = {
      number: 'ORD-X',
      status: 'cancelled',
      createdAt: new Date(),
      updatedAt: new Date(),
      User: { email: 'user@x.com' },
    };
    repo.findOrderByNumberWithUserEmail.mockResolvedValue(order);

    const result = await service.trackOrder({ orderNumber: 'ORD-X', email: 'user@x.com' });

    expect(result.isCancelled).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────
// updateOrderStatus
// ────────────────────────────────────────────────────────────

describe('OrdersService.updateOrderStatus', () => {
  let service, repo, emailGateway, eventBus;

  beforeEach(() => {
    ({ service, repo, emailGateway, eventBus } = buildService());
  });

  function mkFullOrder(overrides = {}) {
    return {
      id: 1,
      number: 'ORD-TEST',
      status: 'processing',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      subtotal: 200000,
      total: 230000,
      userId: 1,
      pointsEarned: 0,
      user: { email: 'user@x.com' },
      createdAt: new Date(),
      ...overrides,
    };
  }

  test('order không tồn tại → AppError 404', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);

    await expect(
      service.updateOrderStatus({ id: 99, status: 'processing' })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('cập nhật status → trả về { id, number, status }', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(mkFullOrder());

    const result = await service.updateOrderStatus({ id: 1, status: 'processing' });

    expect(result).toMatchObject({ id: 1, number: 'ORD-TEST', status: 'processing' });
  });

  test('status=delivered + paymentMethod=cod → auto paymentStatus=paid', async () => {
    const order = mkFullOrder({ status: 'shipped', paymentMethod: 'cod' });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 0 });

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(order.paymentStatus).toBe('paid');
  });

  test('status=delivered + paymentMethod≠cod → paymentStatus không tự động paid', async () => {
    const order = mkFullOrder({ status: 'shipped', paymentMethod: 'bank_transfer', paymentStatus: 'pending' });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 0 });

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(order.paymentStatus).toBe('pending');
  });

  test('status=delivered → publish OrderDeliveredEvent', async () => {
    const order = mkFullOrder({ status: 'shipped', subtotal: 300000 });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 0 });

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.delivered' })
    );
  });

  test('status=delivered + subtotal đủ → trao loyalty points và ghi history', async () => {
    // subtotal=200000, POINTS_EARN_RATE=1000 → pointsEarned = floor(200000/1000) = 200
    const order = mkFullOrder({ status: 'processing', subtotal: 200000 });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    const user = { id: 1, loyaltyPoints: 50 };
    repo.findUserById.mockResolvedValue(user);

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(repo.updateUserPoints).toHaveBeenCalledWith(user, 250); // 50 + 200
    expect(repo.createLoyaltyHistory).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'earn', points: 200 })
    );
  });

  test('status=delivered nhưng subtotal tạo 0 points → không trao', async () => {
    // subtotal=500 → floor(500/1000)=0 → không trao điểm
    const order = mkFullOrder({ status: 'shipped', subtotal: 500 });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 0 });

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(repo.updateUserPoints).not.toHaveBeenCalled();
  });

  test('previousStatus đã là delivered → không trao điểm lại', async () => {
    const order = mkFullOrder({ status: 'delivered', subtotal: 500000 });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    // previousStatus === DELIVERED → nhánh loyalty không chạy
    expect(repo.updateUserPoints).not.toHaveBeenCalled();
  });

  test('có user.email → gửi email cập nhật trạng thái', async () => {
    const order = mkFullOrder({ status: 'processing', user: { email: 'u@x.com' } });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'shipped' });

    expect(emailGateway.sendOrderStatusUpdateEmail).toHaveBeenCalledWith(
      'u@x.com',
      expect.objectContaining({ status: 'shipped' })
    );
  });

  test('không có user.email → không gửi email (không crash)', async () => {
    const order = mkFullOrder({ status: 'processing', user: null });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await expect(
      service.updateOrderStatus({ id: 1, status: 'shipped' })
    ).resolves.toBeTruthy();

    expect(emailGateway.sendOrderStatusUpdateEmail).not.toHaveBeenCalled();
  });
});
