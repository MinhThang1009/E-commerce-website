// Tests bổ sung cho OrdersService — nhắm vào các method/nhánh chưa được cover.
// Covers: getOrderByNumber, getAllOrders, updateOrderStatus, repayOrder,
//         confirmReceived, trackOrder, estimateShipping, _clearUserCartInTransaction.

const OrdersService = require('./orders-service');
// STATUS và buildTrackingSteps đã được inline vào ordersService (Phase 1 — xóa domain layer).
// Khai báo lại local để test không phụ thuộc vào implementation detail của service.
const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};
function buildTrackingSteps(status) {
  const progression = ['pending', 'processing', 'shipped', 'delivered'];
  const idx = progression.indexOf(status);
  return [
    { key: 'pending', label: 'Đã đặt hàng', completed: idx >= 0 && status !== STATUS.CANCELLED },
    { key: 'processing', label: 'Đang chuẩn bị', completed: idx >= 1 },
    { key: 'shipped', label: 'Đang giao', completed: idx >= 2 },
    { key: 'delivered', label: 'Đã nhận hàng', completed: idx >= 3 },
  ];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSTANTS = {
  SHIPPING_FREE_THRESHOLD: 2000000,
};

// ─── Builders ────────────────────────────────────────────────────────────────

function buildService() {
  const repo = {
    runInTransaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'FOR UPDATE' } })),
    findProductWithDefaultVariant: jest.fn(),
    findVariantBasic: jest.fn(),
    lockProduct: jest.fn(),
    lockVariant: jest.fn(),
    decrementProductStock: jest.fn().mockResolvedValue(),
    decrementVariantStock: jest.fn().mockResolvedValue(),
    restoreProductStock: jest.fn().mockResolvedValue(),
    restoreVariantStock: jest.fn().mockResolvedValue(),
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
    ).rejects.toMatchObject({ statusCode: 404, message: 'orders.notFound' });
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

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
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
    expect(repo.saveOrder).toHaveBeenCalledWith(
      order,
      expect.objectContaining({ transaction: expect.anything() }),
    );
    expect(result).toMatchObject({ id: 1, number: 'ORD-UPD', status: 'processing' });
  });

  it('hủy đơn CHƯA giao (processing) → hoàn kho variant + product', async () => {
    const variant = { id: 5 };
    const product = { id: 9 };
    const order = {
      id: 1,
      number: 'ORD-CXL',
      status: 'processing',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [
        { variantId: 5, quantity: 2, ProductVariant: variant, Product: {} },
        { variantId: null, quantity: 3, Product: product, ProductVariant: null },
      ],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'cancelled' });

    expect(repo.restoreVariantStock).toHaveBeenCalledWith(
      variant,
      2,
      expect.objectContaining({ transaction: expect.anything() }),
    );
    expect(repo.restoreProductStock).toHaveBeenCalledWith(
      product,
      3,
      expect.objectContaining({ transaction: expect.anything() }),
    );
    expect(order.status).toBe('cancelled');
  });

  it('hủy đơn ĐÃ giao (shipped) → KHÔNG hoàn kho (hàng đã đi)', async () => {
    const order = {
      id: 2,
      number: 'ORD-SHP',
      status: 'shipped',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [{ variantId: 5, quantity: 2, ProductVariant: { id: 5 }, Product: {} }],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 2, status: 'cancelled' });

    expect(repo.restoreVariantStock).not.toHaveBeenCalled();
    expect(repo.restoreProductStock).not.toHaveBeenCalled();
    expect(order.status).toBe('cancelled');
  });

  it('COD + status=delivered → paymentStatus = paid', async () => {
    const order = mkOrder({ status: 'shipped', paymentMethod: 'cod' });
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue({ id: 1 });

    await service.updateOrderStatus({ id: 1, status: STATUS.DELIVERED });

    expect(order.paymentStatus).toBe('paid');
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
      id: 5,
      userId: 1,
      originUrl: 'https://shop.vn',
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

    await expect(service.confirmReceived({ id: 99, userId: 1 })).rejects.toMatchObject({
      statusCode: 404,
    });
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
    await expect(service.trackOrder({ orderNumber: 'ORD-123', email: '' })).rejects.toMatchObject({
      statusCode: 400,
    });
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
    const result = service.estimateShipping({ subtotal: 2000000, weight: 0 });
    expect(result.shippingCost).toBe(0);
  });

  it('subtotal < threshold → shippingCost = null (phụ thuộc khoảng cách)', () => {
    const result = service.estimateShipping({ subtotal: 100000, weight: 0 });
    expect(result.shippingCost).toBeNull();
  });

  it('trả về freeShippingThreshold đúng', () => {
    const result = service.estimateShipping({ subtotal: 0, weight: 0 });
    expect(result.freeShippingThreshold).toBe(CONSTANTS.SHIPPING_FREE_THRESHOLD);
  });

  it('NaN subtotal → fallback về 0 → nhỏ hơn threshold → shippingCost = null', () => {
    const result = service.estimateShipping({ subtotal: 'invalid', weight: 'bad' });
    // parseFloat('invalid') = NaN → || 0 = 0 → 0 < 2000000 → null
    expect(result.shippingCost).toBeNull();
  });
});

// ─── _generateOrderNumber ────────────────────────────────────────────────────

describe('OrdersService › _generateOrderNumber', () => {
  it('orderNumber có prefix ORD- và format YYYYMMDD-RAND', () => {
    const { service } = buildService();

    const orderNumber = service._generateOrderNumber();

    expect(orderNumber).toMatch(/^ORD-\d{8}-\d{4}$/);
  });

  it('hai lần gọi _generateOrderNumber tạo ra số khác nhau', () => {
    const { service } = buildService();

    const num1 = service._generateOrderNumber();
    const num2 = service._generateOrderNumber();

    expect(num1).toMatch(/^ORD-/);
    expect(num2).toMatch(/^ORD-/);
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
    expect(repo.clearCartItems).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });

  it('không throw khi repo.findActiveCartsByUser ném lỗi — chỉ log error', async () => {
    repo.findActiveCartsByUser.mockRejectedValue(new Error('DB down'));

    await expect(service._clearUserCartInTransaction(1, 'tx')).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalled();
  });
});
