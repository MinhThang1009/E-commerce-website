// Tests bổ sung cho OrdersService — nhắm vào các method/nhánh chưa được cover.
// Covers: getOrderByNumber, getAllOrders, updateOrderStatus, repayOrder,
//         confirmReceived, trackOrder, estimateShipping, _clearUserCartInTransaction.

const OrdersService = require('./ordersService');
const { buildTrackingSteps, STATUS } = require('../domain/policies/OrderStatusPolicy');

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSTANTS = {
  POINTS_EARN_RATE: 1000,
  POINTS_VALUE: 100,
  SHIPPING_FREE_THRESHOLD: 500000,
  SHIPPING_BASE_RATE: 30000,
  SHIPPING_WEIGHT_RATE: 5000,
};

// ─── Builders ────────────────────────────────────────────────────────────────

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
    reload: jest.fn().mockResolvedValue(),
  };

  const emailGateway = {
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(),
    sendOrderCancellationEmail: jest.fn().mockResolvedValue(),
    sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(),
  };

  const eventBus = { publish: jest.fn().mockResolvedValue() };

  const logger = {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  const service = new OrdersService({
    ordersRepository: repo,
    emailGateway,
    eventBus,
    logger,
    constants: CONSTANTS,
  });

  return { service, repo, emailGateway, eventBus, logger };
}

function mkOrder(overrides = {}) {
  return {
    id: 1,
    number: 'ORD-TEST-001',
    status: 'pending',
    userId: 1,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    subtotal: 200000,
    total: 230000,
    pointsUsed: 0,
    pointsEarned: 0,
    createdAt: new Date(),
    items: [],
    reload: jest.fn().mockResolvedValue(),
    user: null,
    ...overrides,
  };
}

// ─── getOrderByNumber ────────────────────────────────────────────────────────

describe('OrdersService › getOrderByNumber', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  it('trả về order khi tìm thấy', async () => {
    const order = mkOrder({ number: 'ORD-ABC', userId: 5 });
    repo.findOrderByNumberAndUserId.mockResolvedValue(order);

    const result = await service.getOrderByNumber({ number: 'ORD-ABC', userId: 5 });

    expect(repo.findOrderByNumberAndUserId).toHaveBeenCalledWith('ORD-ABC', 5);
    expect(result).toBe(order);
  });

  it('AppError 404 khi không tìm thấy', async () => {
    repo.findOrderByNumberAndUserId.mockResolvedValue(null);

    await expect(
      service.getOrderByNumber({ number: 'ORD-MISSING', userId: 1 }),
    ).rejects.toMatchObject({ statusCode: 404, message: expect.stringContaining('Không tìm thấy') });
  });
});

// ─── getAllOrders ─────────────────────────────────────────────────────────────

describe('OrdersService › getAllOrders', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  it('trả về { data, total, page, limit }', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 2, rows });

    const result = await service.getAllOrders({ page: 1, limit: 20 });

    expect(result).toEqual({ data: rows, total: 2, page: 1, limit: 20 });
  });

  it('truyền where status khi có filter status', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllOrders({ page: 1, limit: 10, status: 'pending' });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' } }),
    );
  });

  it('where rỗng khi không có status', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllOrders({ page: 1, limit: 10 });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it('limit > 100 → cap về 100', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllOrders({ page: 1, limit: 500 });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
    );
  });

  it('page 2 → offset đúng', async () => {
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 30, rows: [] });

    await service.getAllOrders({ page: 2, limit: 10 });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 10 }),
    );
  });
});

// ─── updateOrderStatus ───────────────────────────────────────────────────────

describe('OrdersService › updateOrderStatus', () => {
  let service, repo, emailGateway, eventBus;

  beforeEach(() => {
    ({ service, repo, emailGateway, eventBus } = buildService());
  });

  it('AppError 404 khi order không tồn tại', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);

    await expect(
      service.updateOrderStatus({ id: 999, status: 'processing' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('cập nhật status và trả về { id, number, status }', async () => {
    const order = mkOrder({ status: 'pending', number: 'ORD-UPD' });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    const result = await service.updateOrderStatus({ id: 1, status: 'processing' });

    expect(order.status).toBe('processing');
    expect(repo.saveOrder).toHaveBeenCalledWith(order);
    expect(result).toMatchObject({ id: 1, number: 'ORD-UPD', status: 'processing' });
  });

  it('COD + status=delivered → paymentStatus = paid', async () => {
    const order = mkOrder({ status: 'shipped', paymentMethod: 'cod' });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 0 });

    await service.updateOrderStatus({ id: 1, status: STATUS.DELIVERED });

    expect(order.paymentStatus).toBe('paid');
  });

  it('delivered + previousStatus !== delivered → trao điểm tích lũy khi đủ', async () => {
    const order = mkOrder({
      status: 'shipped',
      subtotal: 2000000, // 2000000 / 1000 = 2000 điểm
      userId: 1,
      number: 'ORD-EARN',
    });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 100 });

    await service.updateOrderStatus({ id: 1, status: STATUS.DELIVERED });

    expect(repo.updateUserPoints).toHaveBeenCalledWith(
      expect.objectContaining({ loyaltyPoints: 100 }),
      2100, // 100 + 2000
    );
    expect(repo.createLoyaltyHistory).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'earn', points: 2000 }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.delivered' }),
    );
  });

  it('delivered nhưng subtotal quá nhỏ để kiếm điểm → không gọi updateUserPoints', async () => {
    const order = mkOrder({ status: 'shipped', subtotal: 500, userId: 1 }); // 500/1000 = 0 điểm
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 50 });

    await service.updateOrderStatus({ id: 1, status: STATUS.DELIVERED });

    expect(repo.updateUserPoints).not.toHaveBeenCalled();
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.delivered' }),
    );
  });

  it('previousStatus đã là delivered → KHÔNG trao điểm lại', async () => {
    const order = mkOrder({ status: 'delivered', subtotal: 2000000, userId: 1 });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(repo.updateUserPoints).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('có order.user.email → gửi email cập nhật trạng thái', async () => {
    const order = mkOrder({ status: 'pending', user: { email: 'customer@example.com' } });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'processing' });

    expect(emailGateway.sendOrderStatusUpdateEmail).toHaveBeenCalledWith(
      'customer@example.com',
      expect.objectContaining({ status: 'processing' }),
    );
  });

  it('không có order.user.email → không gửi email', async () => {
    const order = mkOrder({ status: 'pending', user: null });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'processing' });

    expect(emailGateway.sendOrderStatusUpdateEmail).not.toHaveBeenCalled();
  });
});

// ─── repayOrder ───────────────────────────────────────────────────────────────

describe('OrdersService › repayOrder', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  it('AppError 404 khi không tìm thấy order', async () => {
    repo.findOrderByIdAndUserId.mockResolvedValue(null);

    await expect(
      service.repayOrder({ id: 99, userId: 1, originUrl: 'https://shop.vn' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('order đang pending payment → trả về paymentUrl', async () => {
    const order = mkOrder({
      id: 5,
      number: 'ORD-PAY',
      status: 'pending',
      paymentStatus: 'pending',
      total: 500000,
    });
    repo.findOrderByIdAndUserId.mockResolvedValue(order);

    const result = await service.repayOrder({
      id: 5, userId: 1, originUrl: 'https://shop.vn',
    });

    expect(result).toMatchObject({
      id: 5,
      number: 'ORD-PAY',
      total: 500000,
      paymentUrl: expect.stringContaining('repayOrder=5'),
    });
    expect(repo.saveOrder).toHaveBeenCalled();
  });
});

// ─── confirmReceived ─────────────────────────────────────────────────────────

describe('OrdersService › confirmReceived', () => {
  let service, repo, eventBus;

  beforeEach(() => {
    ({ service, repo, eventBus } = buildService());
  });

  it('AppError 404 khi không tìm thấy order', async () => {
    repo.findOrderByIdAndUserId.mockResolvedValue(null);

    await expect(
      service.confirmReceived({ id: 99, userId: 1 }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('alreadyProcessed → trả về message "đã xác nhận" và pointsEarned=0', async () => {
    // status=delivered là trạng thái "alreadyProcessed" trong OrderAggregate
    const order = mkOrder({
      status: 'delivered',
      pointsEarned: 100,
      reload: jest.fn().mockResolvedValue(),
    });
    repo.findOrderByIdAndUserId.mockResolvedValue(order);

    const result = await service.confirmReceived({ id: 1, userId: 1 });

    expect(result.pointsEarned).toBe(0);
    expect(result.message).toMatch(/đã được xác nhận/);
    // khi alreadyProcessed, publish vẫn được gọi (theo code)
  });

  it('đơn đã shipped → tích điểm mới và publish OrderDeliveredEvent', async () => {
    const order = mkOrder({
      id: 1,
      number: 'ORD-RECV',
      status: 'shipped',
      subtotal: 3000000, // 3000000/1000 = 3000 điểm
      userId: 1,
      pointsEarned: 0,
      reload: jest.fn().mockResolvedValue(),
    });
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1, loyaltyPoints: 200 });

    const result = await service.confirmReceived({ id: 1, userId: 1 });

    expect(repo.updateUserPoints).toHaveBeenCalledWith(
      expect.objectContaining({ loyaltyPoints: 200 }),
      3200, // 200 + 3000
    );
    expect(result.pointsEarned).toBe(3000);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.delivered' }),
    );
  });
});

// ─── trackOrder ──────────────────────────────────────────────────────────────

describe('OrdersService › trackOrder', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  it('AppError 400 khi thiếu orderNumber', async () => {
    await expect(
      service.trackOrder({ orderNumber: '', email: 'user@example.com' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('AppError 400 khi thiếu email', async () => {
    await expect(
      service.trackOrder({ orderNumber: 'ORD-123', email: '' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('AppError 404 khi order không tìm thấy', async () => {
    repo.findOrderByNumberWithUserEmail.mockResolvedValue(null);

    await expect(
      service.trackOrder({ orderNumber: 'ORD-X', email: 'user@example.com' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('AppError 404 khi email không khớp', async () => {
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-X',
      status: 'pending',
      User: { email: 'other@example.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.trackOrder({ orderNumber: 'ORD-X', email: 'user@example.com' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('trả về tracking info với steps khi email khớp (case-insensitive)', async () => {
    const createdAt = new Date();
    const updatedAt = new Date();
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-TRACK',
      status: 'processing',
      User: { email: 'USER@EXAMPLE.COM' },
      createdAt,
      updatedAt,
    });

    const result = await service.trackOrder({
      orderNumber: 'ORD-TRACK',
      email: 'user@example.com',
    });

    expect(result.orderNumber).toBe('ORD-TRACK');
    expect(result.currentStatus).toBe('processing');
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.isCancelled).toBe(false);
  });

  it('isCancelled=true khi order status = cancelled', async () => {
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-CANCEL',
      status: STATUS.CANCELLED,
      User: { email: 'user@example.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.trackOrder({
      orderNumber: 'ORD-CANCEL',
      email: 'user@example.com',
    });

    expect(result.isCancelled).toBe(true);
  });
});

// ─── estimateShipping ────────────────────────────────────────────────────────

describe('OrdersService › estimateShipping', () => {
  let service;

  beforeEach(() => {
    ({ service } = buildService());
  });

  it('subtotal >= SHIPPING_FREE_THRESHOLD → shippingCost = 0', () => {
    const result = service.estimateShipping({ subtotal: 500000, weight: 0 });
    expect(result.shippingCost).toBe(0);
  });

  it('subtotal < threshold → shippingCost = baseRate', () => {
    const result = service.estimateShipping({ subtotal: 100000, weight: 0 });
    expect(result.shippingCost).toBe(CONSTANTS.SHIPPING_BASE_RATE);
  });

  it('trả về freeShippingThreshold đúng', () => {
    const result = service.estimateShipping({ subtotal: 0, weight: 0 });
    expect(result.freeShippingThreshold).toBe(CONSTANTS.SHIPPING_FREE_THRESHOLD);
  });

  it('NaN subtotal/weight → fallback về 0', () => {
    const result = service.estimateShipping({ subtotal: 'invalid', weight: 'bad' });
    // 0 < threshold → có phí ship
    expect(result.shippingCost).toBe(CONSTANTS.SHIPPING_BASE_RATE);
  });
});

// ─── _clearUserCartInTransaction — error handling ────────────────────────────

describe('OrdersService › _clearUserCartInTransaction', () => {
  let service, repo, logger;

  beforeEach(() => {
    ({ service, repo, logger } = buildService());
  });

  it('không làm gì khi userId là falsy', async () => {
    await service._clearUserCartInTransaction(null, {});
    expect(repo.findActiveCartsByUser).not.toHaveBeenCalled();
  });

  it('convert cart status và clear items cho mỗi cart active', async () => {
    const cart = { id: 5, status: 'active' };
    repo.findActiveCartsByUser.mockResolvedValue([cart]);

    await service._clearUserCartInTransaction(1, 'tx');

    expect(cart.status).toBe('converted');
    expect(repo.saveCart).toHaveBeenCalledWith(cart, { transaction: 'tx' });
    expect(repo.clearCartItems).toHaveBeenCalledWith(5);
  });

  it('không throw khi repo.findActiveCartsByUser ném lỗi — chỉ log error', async () => {
    repo.findActiveCartsByUser.mockRejectedValue(new Error('DB down'));

    await expect(
      service._clearUserCartInTransaction(1, 'tx'),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});
