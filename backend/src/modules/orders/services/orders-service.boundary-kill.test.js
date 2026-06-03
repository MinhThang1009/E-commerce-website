/**
 * Boundary-kill tests cho OrdersService
 * Nhắm vào các EQUIVALENT-SUSPECT thực ra là KILLABLE:
 * - L205: product stockQuantity < item.quantity (boundary: stock=qty)
 * - L241: startDate boundary (now === startDate)
 * - L244: endDate boundary (now === endDate)
 * - L250: minOrderAmount boundary (subtotal === minOrderAmount)
 */

const OrdersService = require('./orders-service');

const CONSTANTS = { SHIPPING_FREE_THRESHOLD: 2000000 };

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

// ─── L205: lockedProduct.stockQuantity < item.quantity boundary ───────────────

describe('OrdersService › createOrder — L205: product stock boundary (stock === quantity)', () => {
  it('product stock = quantity (exact) → đủ hàng, KHÔNG throw (operator < not <=)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 3 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    // lockProduct returns exactly quantity=3
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 3 });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 3 }] }); // qty = stock
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
    expect(repo.decrementProductStock).toHaveBeenCalled();
  });

  it('product stock = quantity - 1 (thiếu 1) → throw stockInsufficient', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 2 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 2 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 3 }] }); // qty > stock
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.stockInsufficient',
    });
  });
});

// ─── L241: couponNotStarted boundary (now === startDate) ─────────────────────

describe('OrdersService › createOrder — L241: startDate boundary (now === startDate exact ms)', () => {
  afterEach(() => jest.useRealTimers());

  it('now === startDate exact → KHÔNG throw couponNotStarted (operator < not <=)', async () => {
    // Control "now" bằng fake timer
    const exactTime = new Date('2024-06-15T10:00:00.000Z');
    jest.useFakeTimers({ now: exactTime.getTime() });

    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 1,
      code: 'CODE',
      type: 'percent',
      value: '10',
      startDate: exactTime.toISOString(), // startDate = now
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      discountCode: 'CODE',
      paymentMethod: 'cod',
    });
    // now = startDate → `now < startDate` = false → không throw (coupon đã bắt đầu)
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });

  it('now 1ms sau startDate → KHÔNG throw couponNotStarted', async () => {
    const startTime = new Date('2024-06-15T10:00:00.000Z');
    const nowTime = new Date(startTime.getTime() + 1);
    jest.useFakeTimers({ now: nowTime.getTime() });

    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 1,
      code: 'CODE',
      type: 'percent',
      value: '10',
      startDate: startTime.toISOString(),
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      discountCode: 'CODE',
      paymentMethod: 'cod',
    });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });

  it('now 1ms trước startDate → throw couponNotStarted', async () => {
    const startTime = new Date('2024-06-15T10:00:00.000Z');
    const nowTime = new Date(startTime.getTime() - 1);
    jest.useFakeTimers({ now: nowTime.getTime() });

    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 1,
      code: 'CODE',
      type: 'percent',
      value: '10',
      startDate: startTime.toISOString(),
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'CODE' });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponNotStarted',
    });
  });
});

// ─── L244: couponExpired boundary (now === endDate) ──────────────────────────

describe('OrdersService › createOrder — L244: endDate boundary (now === endDate exact ms)', () => {
  afterEach(() => jest.useRealTimers());

  it('now === endDate exact → KHÔNG throw couponExpired (operator > not >=)', async () => {
    const exactTime = new Date('2024-12-31T23:59:59.999Z');
    jest.useFakeTimers({ now: exactTime.getTime() });

    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 2,
      code: 'ENDCODE',
      type: 'percent',
      value: '10',
      startDate: null,
      endDate: exactTime.toISOString(), // endDate = now
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      discountCode: 'ENDCODE',
      paymentMethod: 'cod',
    });
    // now = endDate → `now > endDate` = false → coupon chưa hết hạn
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });

  it('now 1ms sau endDate → throw couponExpired', async () => {
    const endTime = new Date('2024-12-31T23:59:59.999Z');
    const nowTime = new Date(endTime.getTime() + 1);
    jest.useFakeTimers({ now: nowTime.getTime() });

    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 2,
      code: 'ENDCODE',
      type: 'percent',
      value: '10',
      startDate: null,
      endDate: endTime.toISOString(),
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'ENDCODE' });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponExpired',
    });
  });
});

// ─── L250: minOrderAmount boundary (subtotal === minOrderAmount) ──────────────

describe('OrdersService › createOrder — L250: minOrderAmount boundary (subtotal === minOrderAmount)', () => {
  it('subtotal === minOrderAmount (exact) → KHÔNG throw couponMinOrderNotMet (< not <=)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 3,
      code: 'MIN500',
      type: 'percent',
      value: '5',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '500000', // exactly 500000
      maxDiscountAmount: null,
    });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    // subtotal = 500000 * 1 = 500000 = minOrderAmount
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      discountCode: 'MIN500',
      paymentMethod: 'cod',
    });
    // `subtotal < minOrderAmount` → `500000 < 500000` = false → không throw
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });

  it('subtotal = minOrderAmount - 1 → throw couponMinOrderNotMet', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 499999, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 3,
      code: 'MIN500',
      type: 'percent',
      value: '5',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '500000',
      maxDiscountAmount: null,
    });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'MIN500' });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.couponMinOrderNotMet',
    });
  });

  it('subtotal = minOrderAmount + 1 → KHÔNG throw (vượt ngưỡng)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500001, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 3,
      code: 'MIN500',
      type: 'percent',
      value: '5',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '500000',
      maxDiscountAmount: null,
    });
    repo.createOrder.mockImplementation(async (data) => ({
      ...data,
      id: 1,
      createdAt: new Date(),
    }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      discountCode: 'MIN500',
      paymentMethod: 'cod',
    });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).resolves.toBeDefined();
  });
});
