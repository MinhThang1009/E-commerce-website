/**
 * Mutation-kill tests cho OrdersService
 * Mục tiêu: giết các LIKELY-KILLABLE survivors từ Stryker mutation report.
 * Mỗi test assert OUTCOME thực sự (giá trị trả về, state thay đổi, args được gọi).
 */

const OrdersService = require('./orders-service');

const CONSTANTS = { SHIPPING_FREE_THRESHOLD: 2000000 };

// ─── Builders ─────────────────────────────────────────────────────────────────

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

function mkProduct(overrides = {}) {
  return {
    id: 1,
    name: 'Sản phẩm A',
    basePrice: 100000,
    status: 'active',
    thumbnail: 'img.jpg',
    stockQuantity: 10,
    ...overrides,
  };
}

function mkVariant(overrides = {}) {
  return {
    id: 10,
    name: 'Đỏ / L',
    sku: 'SKU-001',
    price: 120000,
    stockQuantity: 8,
    ...overrides,
  };
}

function mkOrderBody(overrides = {}) {
  return {
    shippingFirstName: 'Anh',
    shippingLastName: 'Nguyen',
    shippingCompany: null,
    shippingAddress1: '123 Lê Lợi',
    shippingAddress2: null,
    shippingCity: 'HCM',
    shippingState: 'HCM',
    shippingZip: '70000',
    shippingCountry: 'VN',
    shippingPhone: '0901234567',
    billingFirstName: 'Anh',
    billingLastName: 'Nguyen',
    billingCompany: null,
    billingAddress1: '123 Lê Lợi',
    billingAddress2: null,
    billingCity: 'HCM',
    billingState: 'HCM',
    billingZip: '70000',
    billingCountry: 'VN',
    billingPhone: '0901234567',
    paymentMethod: 'cod',
    notes: null,
    discountCode: null,
    ...overrides,
  };
}

function mkCreatedOrder(overrides = {}) {
  return {
    id: 1,
    number: 'ORD-20240101-1234',
    status: 'pending',
    userId: 1,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    subtotal: 100000,
    total: 100000,
    shippingCost: 0,
    discount: 0,
    shippingFirstName: 'Anh',
    shippingLastName: 'Nguyen',
    shippingAddress1: '123 Lê Lợi',
    shippingAddress2: null,
    shippingCity: 'HCM',
    shippingState: 'HCM',
    shippingZip: '70000',
    shippingCountry: 'VN',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── L27: _canCancel — chỉ PENDING và PROCESSING được hủy ────────────────────

describe('OrdersService › cancelOrder — _canCancel bảo vệ trạng thái', () => {
  it('shipped → throw 422 (không thể hủy)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-1',
      status: 'shipped',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('delivered → throw 422 (không thể hủy)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-1',
      status: 'delivered',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('cancelled → throw 422 (không thể hủy lại)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-1',
      status: 'cancelled',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('pending → hủy thành công, status = cancelled', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 1,
      number: 'ORD-PEND',
      status: 'pending',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    const result = await service.cancelOrder({ id: 1, userId: 1 });
    expect(result.status).toBe('cancelled');
    expect(order.status).toBe('cancelled');
  });

  it('processing → hủy thành công, status = cancelled', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-PROC',
      status: 'processing',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    const result = await service.cancelOrder({ id: 1, userId: 1 });
    expect(result.status).toBe('cancelled');
  });
});

// ─── L37-L41: _buildTrackingSteps — labels và completed flags ────────────────

describe('OrdersService › trackOrder — _buildTrackingSteps labels và completed', () => {
  function buildTrackingSteps(status) {
    // Replica logic từ service để assert outcome
    const progression = ['pending', 'processing', 'shipped', 'delivered'];
    const idx = progression.indexOf(status);
    return [
      { key: 'pending', label: 'Đã đặt hàng', completed: idx >= 0 && status !== 'cancelled' },
      { key: 'processing', label: 'Đang chuẩn bị', completed: idx >= 1 },
      { key: 'shipped', label: 'Đang giao', completed: idx >= 2 },
      { key: 'delivered', label: 'Đã nhận hàng', completed: idx >= 3 },
    ];
  }

  it('status=pending → step pending completed=true, các step sau false', async () => {
    const { service, repo } = buildService();
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-T',
      status: 'pending',
      User: { email: 'a@b.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.trackOrder({ orderNumber: 'ORD-T', email: 'a@b.com' });
    expect(result.steps[0]).toMatchObject({
      key: 'pending',
      label: 'Đã đặt hàng',
      completed: true,
    });
    expect(result.steps[1]).toMatchObject({
      key: 'processing',
      label: 'Đang chuẩn bị',
      completed: false,
    });
    expect(result.steps[2]).toMatchObject({ key: 'shipped', label: 'Đang giao', completed: false });
    expect(result.steps[3]).toMatchObject({
      key: 'delivered',
      label: 'Đã nhận hàng',
      completed: false,
    });
  });

  it('status=processing → bước pending+processing completed, shipped+delivered false', async () => {
    const { service, repo } = buildService();
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-T',
      status: 'processing',
      User: { email: 'a@b.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.trackOrder({ orderNumber: 'ORD-T', email: 'a@b.com' });
    expect(result.steps[0].completed).toBe(true);
    expect(result.steps[1].completed).toBe(true);
    expect(result.steps[2].completed).toBe(false);
    expect(result.steps[3].completed).toBe(false);
  });

  it('status=shipped → bước pending+processing+shipped completed, delivered false', async () => {
    const { service, repo } = buildService();
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-T',
      status: 'shipped',
      User: { email: 'a@b.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.trackOrder({ orderNumber: 'ORD-T', email: 'a@b.com' });
    expect(result.steps[0].completed).toBe(true);
    expect(result.steps[1].completed).toBe(true);
    expect(result.steps[2].completed).toBe(true);
    expect(result.steps[3].completed).toBe(false);
  });

  it('status=delivered → tất cả bước completed=true', async () => {
    const { service, repo } = buildService();
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-T',
      status: 'delivered',
      User: { email: 'a@b.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.trackOrder({ orderNumber: 'ORD-T', email: 'a@b.com' });
    expect(result.steps[0].completed).toBe(true);
    expect(result.steps[1].completed).toBe(true);
    expect(result.steps[2].completed).toBe(true);
    expect(result.steps[3].completed).toBe(true);
  });

  it('status=cancelled → bước pending completed=false (nhánh && status !== cancelled)', async () => {
    const { service, repo } = buildService();
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-T',
      status: 'cancelled',
      User: { email: 'a@b.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const result = await service.trackOrder({ orderNumber: 'ORD-T', email: 'a@b.com' });
    // cancelled: idx = -1 → completed = (-1 >= 0) && ... = false
    expect(result.steps[0].completed).toBe(false);
    expect(result.steps[1].completed).toBe(false);
    expect(result.isCancelled).toBe(true);
  });

  it('trackOrder trả về đủ keys: orderNumber, currentStatus, steps, isCancelled, createdAt, updatedAt', async () => {
    const { service, repo } = buildService();
    const createdAt = new Date('2024-01-01');
    const updatedAt = new Date('2024-01-02');
    repo.findOrderByNumberWithUserEmail.mockResolvedValue({
      number: 'ORD-FULL',
      status: 'shipped',
      User: { email: 'x@y.com' },
      createdAt,
      updatedAt,
    });
    const result = await service.trackOrder({ orderNumber: 'ORD-FULL', email: 'x@y.com' });
    expect(result.orderNumber).toBe('ORD-FULL');
    expect(result.currentStatus).toBe('shipped');
    expect(result.steps).toHaveLength(4);
    expect(result.isCancelled).toBe(false);
    expect(result.createdAt).toBe(createdAt);
    expect(result.updatedAt).toBe(updatedAt);
  });
});

// ─── createOrder: subtotal và inventory logs ──────────────────────────────────

describe('OrdersService › createOrder — subtotal + inventoryLog chính xác (buy-now flow)', () => {
  function setupBuyNow({ service, repo }, { product, variant = null, quantity = 2, body = {} }) {
    const items = [{ productId: product.id, variantId: variant?.id ?? null, quantity }];
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    if (variant) repo.findVariantBasic.mockResolvedValue(variant);

    const lockedVariant = variant ? { ...variant, stockQuantity: variant.stockQuantity } : null;
    const lockedProduct = !variant ? { ...product, stockQuantity: product.stockQuantity } : null;
    if (lockedVariant) repo.lockVariant.mockResolvedValue(lockedVariant);
    if (lockedProduct) repo.lockProduct.mockResolvedValue(lockedProduct);

    const createdOrder = mkCreatedOrder({
      subtotal: (variant ? variant.price : product.basePrice) * quantity,
    });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({ id: 1, productId: product.id, quantity });

    return { items, createdOrder };
  }

  it('subtotal = price × quantity cho product (không variant)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 300000, stockQuantity: 5 });
    setupBuyNow({ service, repo }, { product, quantity: 3 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 3 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    // createOrder được gọi với subtotal = 300000 × 3 = 900000
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 900000 }),
      expect.anything(),
    );
  });

  it('subtotal = variant.price × quantity (có variant)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const variant = mkVariant({ price: 250000, stockQuantity: 5 });
    setupBuyNow({ service, repo }, { product, variant, quantity: 2 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 2 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 500000 }),
      expect.anything(),
    );
  });

  it('inventoryLog có changeAmount = -quantity (trừ kho khi bán)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 200000, stockQuantity: 10 });
    const variant = mkVariant({ price: 200000, stockQuantity: 10 });
    setupBuyNow({ service, repo }, { product, variant, quantity: 3 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 3 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    const logCalls = repo.createInventoryLogs.mock.calls[0][0];
    expect(logCalls[0]).toMatchObject({
      changeType: 'sale',
      changeAmount: -3,
    });
  });

  it('inventoryLog.previousStock và newStock đúng khi dùng variant', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 200000, stockQuantity: 10 });
    const variant = mkVariant({ price: 200000, stockQuantity: 7 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 7 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 4 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    const logs = repo.createInventoryLogs.mock.calls[0][0];
    expect(logs[0]).toMatchObject({
      previousStock: 7,
      newStock: 3, // 7 - 4
      changeAmount: -4,
    });
  });

  it('inventoryLog.newStock = previousStock - quantity cho product (không variant)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 200000, stockQuantity: 8 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 8 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 5 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    const logs = repo.createInventoryLogs.mock.calls[0][0];
    expect(logs[0]).toMatchObject({
      previousStock: 8,
      newStock: 3, // 8 - 5
      changeAmount: -5,
    });
  });
});

// ─── createOrder: total = subtotal + tax + shippingCost - discount ─────────────

describe('OrdersService › createOrder — total tính đúng công thức', () => {
  it('total = subtotal + shippingCost khi không có discount', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 2 }],
      shippingCost: 30000,
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    // subtotal = 500000*2 = 1000000, shipping = 30000, total = 1030000
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ total: 1030000, subtotal: 1000000, shippingCost: 30000 }),
      expect.anything(),
    );
  });

  it('shippingCost = 0 khi subtotal >= SHIPPING_FREE_THRESHOLD (2000000)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 1000000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 2 }], // subtotal = 2000000 = THRESHOLD
      shippingCost: 50000, // FE gửi lên nhưng phải bị override về 0
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCost: 0 }),
      expect.anything(),
    );
  });

  it('shippingCost < 0 từ FE → clamp về 0', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      shippingCost: -999,
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCost: 0 }),
      expect.anything(),
    );
  });

  it('shippingCost không phải number → fallback về 0', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      shippingCost: 'abc', // không phải number
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCost: 0 }),
      expect.anything(),
    );
  });
});

// ─── createOrder: discount code — các nhánh logic ────────────────────────────

describe('OrdersService › createOrder — discount code logic', () => {
  function setupDiscountOrder({ service, repo }, codeData, body = {}) {
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue(codeData);
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });
    return {
      product,
      user: { id: 1, email: 'u@a.com' },
      body: mkOrderBody({ items: [{ productId: 1, quantity: 2 }], ...body }),
    };
  }

  it('couponNotStarted khi startDate trong tương lai', async () => {
    const { service, repo } = buildService();
    const future = new Date(Date.now() + 86400000).toISOString();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'CODE10',
        type: 'percent',
        value: '10',
        startDate: future,
        endDate: null,
        usageLimit: null,
        usedCount: 0,
        minOrderAmount: '0',
        maxDiscountAmount: null,
      },
      { discountCode: 'CODE10' },
    );
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponNotStarted',
    });
  });

  it('couponExpired khi endDate trong quá khứ', async () => {
    const { service, repo } = buildService();
    const past = new Date(Date.now() - 86400000).toISOString();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'CODE10',
        type: 'percent',
        value: '10',
        startDate: null,
        endDate: past,
        usageLimit: null,
        usedCount: 0,
        minOrderAmount: '0',
        maxDiscountAmount: null,
      },
      { discountCode: 'CODE10' },
    );
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponExpired',
    });
  });

  it('couponLimitReached khi usedCount >= usageLimit', async () => {
    const { service, repo } = buildService();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'CODE10',
        type: 'percent',
        value: '10',
        startDate: null,
        endDate: null,
        usageLimit: 5,
        usedCount: 5,
        minOrderAmount: '0',
        maxDiscountAmount: null,
      },
      { discountCode: 'CODE10' },
    );
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponLimitReached',
    });
  });

  it('usedCount < usageLimit → KHÔNG throw (L247: < chứ không >=)', async () => {
    const { service, repo } = buildService();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'CODE10',
        type: 'percent',
        value: '10',
        startDate: null,
        endDate: null,
        usageLimit: 10,
        usedCount: 4,
        minOrderAmount: '0',
        maxDiscountAmount: null,
      },
      { discountCode: 'CODE10', paymentMethod: 'cod' },
    );
    // Không throw, order được tạo với discount
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });

  it('couponMinOrderNotMet khi subtotal < minOrderAmount', async () => {
    const { service, repo } = buildService();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'CODE10',
        type: 'percent',
        value: '10',
        startDate: null,
        endDate: null,
        usageLimit: null,
        usedCount: 0,
        minOrderAmount: '2000000',
        maxDiscountAmount: null,
      },
      { discountCode: 'CODE10' },
    );
    // subtotal = 500000 * 2 = 1000000 < 2000000
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponMinOrderNotMet',
    });
  });

  it('discount percent không vượt maxDiscountAmount → capped', async () => {
    const { service, repo } = buildService();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'CODE50',
        type: 'percent',
        value: '50',
        startDate: null,
        endDate: null,
        usageLimit: null,
        usedCount: 0,
        minOrderAmount: '0',
        maxDiscountAmount: '200000', // cap ở 200000
      },
      { discountCode: 'CODE50', paymentMethod: 'cod' },
    );
    // subtotal = 1000000, 50% = 500000 > 200000 → discount = 200000
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 200000 }),
      expect.anything(),
    );
  });

  it('discount không vượt subtotal (discount > subtotal → clamp về subtotal)', async () => {
    const { service, repo } = buildService();
    const { user, body } = setupDiscountOrder(
      { service, repo },
      {
        id: 5,
        code: 'BIGCODE',
        type: 'fixed',
        value: '5000000',
        startDate: null,
        endDate: null,
        usageLimit: null,
        usedCount: 0,
        minOrderAmount: '0',
        maxDiscountAmount: null,
      },
      { discountCode: 'BIGCODE', paymentMethod: 'cod' },
    );
    // subtotal = 1000000, fixed discount = 5000000 > subtotal → clamp = 1000000
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 1000000, total: 0 }),
      expect.anything(),
    );
  });

  it('COD payment → incrementDiscountCodeUsage được gọi trong transaction', async () => {
    const { service, repo } = buildService();
    const codeData = {
      id: 7,
      code: 'COD10',
      type: 'percent',
      value: '10',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    };
    const { user, body } = setupDiscountOrder({ service, repo }, codeData, {
      discountCode: 'COD10',
      paymentMethod: 'cod',
    });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.incrementDiscountCodeUsage).toHaveBeenCalledWith(codeData, expect.anything());
  });

  it('momo (online) payment → KHÔNG gọi incrementDiscountCodeUsage ngay', async () => {
    const { service, repo } = buildService();
    const codeData = {
      id: 8,
      code: 'MOMO10',
      type: 'percent',
      value: '10',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    };
    const { user, body } = setupDiscountOrder({ service, repo }, codeData, {
      discountCode: 'MOMO10',
      paymentMethod: 'momo',
    });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.incrementDiscountCodeUsage).not.toHaveBeenCalled();
  });

  it('bank_transfer → incrementDiscountCodeUsage được gọi (manual method)', async () => {
    const { service, repo } = buildService();
    const codeData = {
      id: 9,
      code: 'BANK10',
      type: 'fixed',
      value: '50000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    };
    const { user, body } = setupDiscountOrder({ service, repo }, codeData, {
      discountCode: 'BANK10',
      paymentMethod: 'bank_transfer',
    });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.incrementDiscountCodeUsage).toHaveBeenCalled();
  });

  it('installment → incrementDiscountCodeUsage được gọi (manual method)', async () => {
    const { service, repo } = buildService();
    const codeData = {
      id: 10,
      code: 'INST10',
      type: 'fixed',
      value: '30000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    };
    const { user, body } = setupDiscountOrder({ service, repo }, codeData, {
      discountCode: 'INST10',
      paymentMethod: 'installment',
    });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.incrementDiscountCodeUsage).toHaveBeenCalled();
  });
});

// ─── createOrder: cart clear chỉ cho manual payment ──────────────────────────

describe('OrdersService › createOrder — cart clear chỉ cho manual payment', () => {
  function setupCartOrder({ service, repo }) {
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const cart = {
      id: 3,
      items: [
        {
          productId: 1,
          variantId: null,
          quantity: 1,
          Product: product,
          ProductVariant: null,
        },
      ],
    };
    repo.findOrCreateActiveCart.mockResolvedValue({ id: 3 });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });
    repo.findActiveCartsByUser.mockResolvedValue([{ id: 3, status: 'active' }]);
    return { product, cart };
  }

  it('COD → _clearUserCartInTransaction được gọi (clearCartItems)', async () => {
    const { service, repo } = buildService();
    setupCartOrder({ service, repo });
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ paymentMethod: 'cod' });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.clearCartItems).toHaveBeenCalled();
  });

  it('momo → _clearUserCartInTransaction KHÔNG được gọi (online đợi IPN)', async () => {
    const { service, repo } = buildService();
    setupCartOrder({ service, repo });
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ paymentMethod: 'momo' });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.clearCartItems).not.toHaveBeenCalled();
  });

  it('vnpay → _clearUserCartInTransaction KHÔNG được gọi (online đợi IPN)', async () => {
    const { service, repo } = buildService();
    setupCartOrder({ service, repo });
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ paymentMethod: 'vnpay' });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.clearCartItems).not.toHaveBeenCalled();
  });
});

// ─── createOrder: eventBus publish sau transaction ───────────────────────────

describe('OrdersService › createOrder — eventBus publish order.created', () => {
  it('publish order.created sau khi tạo đơn thành công', async () => {
    const { service, repo, eventBus } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    const createdOrder = mkCreatedOrder({ id: 42, number: 'ORD-PUB', total: 100000, userId: 1 });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({ id: 1, productId: 1, quantity: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.created',
        payload: expect.objectContaining({
          orderId: 42,
          orderNumber: 'ORD-PUB',
          userId: 1,
          total: 100000,
        }),
      }),
    );
  });

  it('payload.items là array với productId và quantity', async () => {
    const { service, repo, eventBus } = buildService();
    const product = mkProduct({ basePrice: 150000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    const createdOrder = mkCreatedOrder({ id: 10, number: 'ORD-ITEMS', userId: 1 });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({ id: 1, productId: 1, quantity: 2 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 2 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    const publishCall = eventBus.publish.mock.calls[0][0];
    expect(publishCall.payload.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ productId: 1, quantity: 2 })]),
    );
  });
});

// ─── createOrder: email confirmation ─────────────────────────────────────────

describe('OrdersService › createOrder — email xác nhận đơn hàng', () => {
  it('gửi email xác nhận tới user.email sau khi tạo đơn', async () => {
    const { service, repo, emailGateway } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    const createdOrder = mkCreatedOrder({
      id: 1,
      number: 'ORD-EMAIL',
      total: 100000,
      userId: 1,
      shippingFirstName: 'Anh',
      shippingLastName: 'Nguyen',
      shippingAddress1: '123 Lê Lợi',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: 'HCM',
      shippingZip: '70000',
      shippingCountry: 'VN',
    });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({
      id: 1,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    });

    const user = { id: 1, email: 'customer@shop.vn' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    // Fire-and-forget, nhưng được gọi (không await)
    // Đợi promise chain settle
    await Promise.resolve();
    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'customer@shop.vn',
      expect.objectContaining({
        orderNumber: 'ORD-EMAIL',
        total: 100000,
      }),
    );
  });
});

// ─── createOrder: createOrderItem được gọi với đúng args ─────────────────────

describe('OrdersService › createOrder — createOrderItem args', () => {
  it('createOrderItem nhận đúng unitPrice, quantity, subtotal', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 200000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder({ id: 99 }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 3 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 99,
        productId: 1,
        unitPrice: 200000,
        quantity: 3,
        subtotal: 600000,
        name: 'Sản phẩm A',
      }),
      expect.anything(),
    );
  });

  it('createOrderItem dùng variant.price khi có variant', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const variant = mkVariant({ price: 350000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder({ id: 88 }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 2 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        unitPrice: 350000,
        quantity: 2,
        subtotal: 700000,
        variantId: 10,
        sku: 'SKU-001',
      }),
      expect.anything(),
    );
  });
});

// ─── createOrder: shippingState/billingState fallback ────────────────────────

describe('OrdersService › createOrder — shippingState/billingState fallback empty string', () => {
  it('shippingState = null → createOrder nhận "" (fallback)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], shippingState: null });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingState: '' }),
      expect.anything(),
    );
  });

  it('shippingState có giá trị → giữ nguyên, KHÔNG override', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], shippingState: 'HCM' });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingState: 'HCM' }),
      expect.anything(),
    );
  });

  it('billingState = null → createOrder nhận "" (fallback)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], billingState: null });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ billingState: '' }),
      expect.anything(),
    );
  });

  it('billingState có giá trị → giữ nguyên, KHÔNG override', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], billingState: 'HN' });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ billingState: 'HN' }),
      expect.anything(),
    );
  });
});

// ─── createOrder: createOrder nhận paymentStatus='pending' ───────────────────

describe('OrdersService › createOrder — createOrder luôn set paymentStatus=pending', () => {
  it('paymentStatus trong DB luôn là "pending" khi tạo đơn', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'pending' }),
      expect.anything(),
    );
  });
});

// ─── createOrder: product inactive → throw ────────────────────────────────────

describe('OrdersService › createOrder — product inactive', () => {
  it('sản phẩm inactive → throw AppError orders.productInactive', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ status: 'inactive' });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.productInactive',
    });
  });
});

// ─── createOrder: stockInsufficient variant ───────────────────────────────────

describe('OrdersService › createOrder — stockInsufficient', () => {
  it('variant stock < quantity → throw orders.stockInsufficient', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ stockQuantity: 5 });
    const variant = mkVariant({ stockQuantity: 1 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 3 }] });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.stockInsufficient',
    });
  });

  it('variant stock === quantity → đủ hàng (< not <=)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ stockQuantity: 5 });
    const variant = mkVariant({ price: 100000, stockQuantity: 3 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 3 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 3 }] });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });

  it('product stock < quantity → throw orders.stockInsufficient (no variant)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ stockQuantity: 2 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 2 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 5 }] });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.stockInsufficient',
    });
  });
});

// ─── cancelOrder: eventBus publish và email ───────────────────────────────────

describe('OrdersService › cancelOrder — eventBus + email', () => {
  it('publish order.cancelled với items đúng sau hủy đơn', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 5,
      number: 'ORD-CXL',
      status: 'pending',
      userId: 3,
      items: [
        { productId: 1, variantId: null, quantity: 2, Product: mkProduct(), ProductVariant: null },
      ],
    };
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 5, userId: 3, userEmail: 'u@a.com' });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'order.cancelled',
        payload: expect.objectContaining({
          orderId: 5,
          orderNumber: 'ORD-CXL',
          userId: 3,
          items: [{ productId: 1, variantId: null, quantity: 2 }],
        }),
      }),
    );
  });

  it('cancelOrder có userEmail → gửi email hủy đơn', async () => {
    const { service, repo, emailGateway } = buildService();
    const order = {
      id: 1,
      number: 'ORD-CXL-MAIL',
      status: 'pending',
      userId: 1,
      items: [],
      createdAt: new Date(),
    };
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 1, userId: 1, userEmail: 'abc@x.com' });

    await Promise.resolve();
    expect(emailGateway.sendOrderCancellationEmail).toHaveBeenCalledWith(
      'abc@x.com',
      expect.objectContaining({ orderNumber: 'ORD-CXL-MAIL' }),
    );
  });

  it('cancelOrder không có userEmail → KHÔNG gửi email', async () => {
    const { service, repo, emailGateway } = buildService();
    const order = {
      id: 1,
      number: 'ORD-NO-MAIL',
      status: 'pending',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await service.cancelOrder({ id: 1, userId: 1 });
    await Promise.resolve();
    expect(emailGateway.sendOrderCancellationEmail).not.toHaveBeenCalled();
  });

  it('cancelOrder trả về { id, number, status: "cancelled" }', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 7,
      number: 'ORD-RESULT',
      status: 'pending',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    const result = await service.cancelOrder({ id: 7, userId: 1 });
    expect(result).toEqual({ id: 7, number: 'ORD-RESULT', status: 'cancelled' });
  });
});

// ─── cancelOrder: restoreVariantStock + restoreProductStock ─────────────────

describe('OrdersService › cancelOrder — hoàn kho khi hủy', () => {
  it('hủy đơn pending có variant item → restoreVariantStock được gọi', async () => {
    const { service, repo } = buildService();
    const variant = { id: 5 };
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      userId: 1,
      items: [{ productId: 1, variantId: 5, quantity: 3, ProductVariant: variant, Product: {} }],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await service.cancelOrder({ id: 1, userId: 1 });

    expect(repo.restoreVariantStock).toHaveBeenCalledWith(
      variant,
      3,
      expect.objectContaining({ transaction: expect.anything() }),
    );
    expect(repo.restoreProductStock).not.toHaveBeenCalled();
  });

  it('hủy đơn pending có product item (no variant) → restoreProductStock được gọi', async () => {
    const { service, repo } = buildService();
    const product = mkProduct();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      userId: 1,
      items: [
        { productId: 1, variantId: null, quantity: 2, Product: product, ProductVariant: null },
      ],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await service.cancelOrder({ id: 1, userId: 1 });

    expect(repo.restoreProductStock).toHaveBeenCalledWith(
      product,
      2,
      expect.objectContaining({ transaction: expect.anything() }),
    );
    expect(repo.restoreVariantStock).not.toHaveBeenCalled();
  });
});

// ─── updateOrderStatus: publishCancelled logic ────────────────────────────────

describe('OrdersService › updateOrderStatus — publishCancelled chính xác', () => {
  it('chuyển sang cancelled từ pending → publish order.cancelled', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 1,
      number: 'ORD-P',
      status: 'pending',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'cancelled' });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.cancelled' }),
    );
  });

  it('chuyển sang cancelled từ processing → publish order.cancelled', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 2,
      number: 'ORD-PR',
      status: 'processing',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 2, status: 'cancelled' });
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.cancelled' }),
    );
  });

  it('đã cancelled → update lại (không phải từ pending/processing) không publish thêm', async () => {
    // previousStatus=cancelled → publishCancelled = (status==='cancelled' && prev!=='cancelled') = false
    // Nhưng test này không thể reach do cannotChangeCancelled guard ở L595
    // → test guard: cancelled + status != cancelled = 422
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 3,
      number: 'ORD-CXL',
      status: 'cancelled',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    // Status !== cancelled và previousStatus === cancelled → throw
    await expect(service.updateOrderStatus({ id: 3, status: 'processing' })).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('chuyển pending→processing (không hủy) → KHÔNG publish order.cancelled', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 4,
      number: 'ORD-PR2',
      status: 'pending',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 4, status: 'processing' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});

// ─── updateOrderStatus: COD delivered → paid ──────────────────────────────────

describe('OrdersService › updateOrderStatus — COD auto-paid khi delivered', () => {
  it('COD + status=delivered → paymentStatus="paid" (ưu tiên hơn truyền vào)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-COD',
      status: 'shipped',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'delivered', paymentStatus: 'pending' });
    expect(order.paymentStatus).toBe('paid');
  });

  it('momo + status=delivered → paymentStatus KHÔNG auto-paid', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-MOMO',
      status: 'shipped',
      paymentMethod: 'momo',
      paymentStatus: 'pending',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'delivered' });
    expect(order.paymentStatus).toBe('pending'); // không auto-paid
  });
});

// ─── repayOrder: URL format và paymentStatus reset ────────────────────────────

describe('OrdersService › repayOrder — URL format và paymentStatus', () => {
  it('paymentUrl = originUrl + /checkout?repayOrder=id&amount=total', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 99,
      number: 'ORD-REPAY',
      status: 'pending',
      paymentStatus: 'failed',
      paymentMethod: 'momo',
      total: 750000,
      reload: jest.fn(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);

    const result = await service.repayOrder({ id: 99, userId: 1, originUrl: 'https://shop.vn' });

    expect(result.paymentUrl).toBe('https://shop.vn/checkout?repayOrder=99&amount=750000');
    expect(result.paymentStatus).toBe('pending');
    expect(repo.saveOrder).toHaveBeenCalledWith(order);
  });

  it('repayOrder: COD → throw 422 (không repay được)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-COD',
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'cod',
      total: 100000,
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    await expect(
      service.repayOrder({ id: 1, userId: 1, originUrl: 'https://x.vn' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('repayOrder: đơn đã paid → throw 422', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-PAID',
      status: 'pending',
      paymentStatus: 'paid',
      paymentMethod: 'momo',
      total: 100000,
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    await expect(
      service.repayOrder({ id: 1, userId: 1, originUrl: 'https://x.vn' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('repayOrder: đơn cancelled → throw 422', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-CXLD',
      status: 'cancelled',
      paymentStatus: 'pending',
      paymentMethod: 'momo',
      total: 100000,
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    await expect(
      service.repayOrder({ id: 1, userId: 1, originUrl: 'https://x.vn' }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

// ─── confirmReceived: status=delivered + COD → paid ──────────────────────────

describe('OrdersService › confirmReceived — trạng thái sau xác nhận', () => {
  it('shipped → delivered + COD → paymentStatus=paid', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-SHIP',
      status: 'shipped',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    const result = await service.confirmReceived({ id: 1, userId: 1 });
    expect(order.status).toBe('delivered');
    expect(order.paymentStatus).toBe('paid');
    expect(result.data.status).toBe('delivered');
  });

  it('processing → delivered (có thể xác nhận)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 2,
      number: 'ORD-PROC',
      status: 'processing',
      paymentMethod: 'vnpay',
      paymentStatus: 'paid',
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    const result = await service.confirmReceived({ id: 2, userId: 1 });
    expect(order.status).toBe('delivered');
    expect(result.data.id).toBe(2);
  });

  it('delivered → throw 422 (không confirm lại)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 3,
      number: 'ORD-DLV',
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      reload: jest.fn(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    await expect(service.confirmReceived({ id: 3, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('cancelled → throw 422 (không confirm)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 4,
      number: 'ORD-CXL',
      status: 'cancelled',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      reload: jest.fn(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    await expect(service.confirmReceived({ id: 4, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('momo + delivered → paymentStatus KHÔNG auto-paid', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 5,
      number: 'ORD-MOMO',
      status: 'shipped',
      paymentMethod: 'momo',
      paymentStatus: 'paid',
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    await service.confirmReceived({ id: 5, userId: 1 });
    // momo đã paid trước, sau confirmReceived vẫn = 'paid' (không đổi)
    expect(order.paymentStatus).toBe('paid');
  });

  it('confirmReceived trả về message và data.number', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 6,
      number: 'ORD-CONF',
      status: 'shipped',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    const result = await service.confirmReceived({ id: 6, userId: 1 });
    expect(result.message).toBe('orders.deliveryConfirmed');
    expect(result.data.number).toBe('ORD-CONF');
  });
});

// ─── getUserOrders: transform productImages ──────────────────────────────────

describe('OrdersService › getUserOrders — transform productImages → thumbnail + images', () => {
  it('item có productImages → thumbnail là ảnh isThumbnail=true', async () => {
    const { service, repo } = buildService();
    const productImages = [
      { imageUrl: 'img1.jpg', isThumbnail: false },
      { imageUrl: 'img2.jpg', isThumbnail: true },
    ];
    const row = {
      toJSON: () => ({
        id: 1,
        items: [
          {
            unitPrice: '200000',
            Product: { id: 1, productImages },
          },
        ],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 10 });

    const item = result.data[0].items[0];
    expect(item.Product.thumbnail).toBe('img2.jpg');
    expect(item.Product.images).toEqual(['img1.jpg', 'img2.jpg']);
    expect(item.Product.productImages).toBeUndefined();
  });

  it('item không có isThumbnail → thumbnail là [0]', async () => {
    const { service, repo } = buildService();
    const productImages = [
      { imageUrl: 'first.jpg', isThumbnail: false },
      { imageUrl: 'second.jpg', isThumbnail: false },
    ];
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: '100000', Product: { id: 1, productImages } }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    const item = result.data[0].items[0];
    expect(item.Product.thumbnail).toBe('first.jpg');
  });

  it('item không có Product.productImages → item không thay đổi', async () => {
    const { service, repo } = buildService();
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: '100000', price: 100000, Product: { id: 1 } }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    const item = result.data[0].items[0];
    expect(item.Product.thumbnail).toBeUndefined();
  });

  it('item.unitPrice set → item.price = parseFloat(unitPrice)', async () => {
    const { service, repo } = buildService();
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: '350000.50', Product: { id: 1 } }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    expect(result.data[0].items[0].price).toBeCloseTo(350000.5);
  });

  it('item.price đã tồn tại → KHÔNG override', async () => {
    const { service, repo } = buildService();
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: '100000', price: 999999, Product: { id: 1 } }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    expect(result.data[0].items[0].price).toBe(999999);
  });

  it('rows không có toJSON (plain object) → vẫn hoạt động', async () => {
    const { service, repo } = buildService();
    const row = {
      id: 1,
      items: [{ unitPrice: '100000', Product: { id: 1 } }],
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    expect(result.data[0].id).toBe(1);
    expect(result.data[0].items[0].price).toBe(100000);
  });

  it('getUserOrders trả về page và limit đúng', async () => {
    const { service, repo } = buildService();
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 50, rows: [] });
    const result = await service.getUserOrders({ userId: 1, page: 3, limit: 5 });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(5);
    expect(result.total).toBe(50);
    expect(repo.findUserOrdersWithItems).toHaveBeenCalledWith(1, { limit: 5, offset: 10 });
  });
});

// ─── getOrderById: access control ─────────────────────────────────────────────

describe('OrdersService › getOrderById — access control', () => {
  it('userId khớp → trả về order', async () => {
    const { service, repo } = buildService();
    const order = { id: 1, userId: 5, toJSON: () => ({ id: 1, userId: 5 }) };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    const result = await service.getOrderById({ id: 1, userId: 5, role: 'customer' });
    expect(result.id).toBe(1);
  });

  it('userId không khớp + role không phải admin → throw 403', async () => {
    const { service, repo } = buildService();
    const order = { id: 1, userId: 5, toJSON: () => ({ id: 1, userId: 5 }) };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await expect(
      service.getOrderById({ id: 1, userId: 999, role: 'customer' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('userId không khớp + role=admin → trả về order (admin có quyền xem tất cả)', async () => {
    const { service, repo } = buildService();
    const order = { id: 1, userId: 5, toJSON: () => ({ id: 1, userId: 5 }) };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    const result = await service.getOrderById({ id: 1, userId: 999, role: 'admin' });
    expect(result.id).toBe(1);
  });

  it('order không tồn tại → throw 404', async () => {
    const { service, repo } = buildService();
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);
    await expect(
      service.getOrderById({ id: 99, userId: 1, role: 'customer' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ─── updateOrderStatus: INV-ORD-8 publishCancelled = false khi đã cancelled ──

describe('OrdersService › updateOrderStatus — publishCancelled = false cho previously cancelled', () => {
  it('status=cancelled + previousStatus=shipped → publish order.cancelled (shipped không hoàn kho)', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 1,
      number: 'ORD-SHP2',
      status: 'shipped',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'cancelled' });
    // publishCancelled = (cancelled && prev !== cancelled) = true
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.cancelled' }),
    );
    expect(order.status).toBe('cancelled');
  });
});

// ─── updateOrderStatus: saveOrder được gọi sau mọi update ────────────────────

describe('OrdersService › updateOrderStatus — saveOrder luôn được gọi', () => {
  it('status+paymentStatus+note update → saveOrder với transaction', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({
      id: 1,
      status: 'processing',
      paymentStatus: 'paid',
      note: 'OK',
    });
    expect(repo.saveOrder).toHaveBeenCalledWith(
      order,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });
});
