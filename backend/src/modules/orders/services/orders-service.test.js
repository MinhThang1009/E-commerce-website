// Unit tests toàn diện cho OrdersService — covers createOrder, getUserOrders,
// getOrderById, cancelOrder.
// Không hit DB: mọi data access mock qua ordersRepository.

const OrdersService = require('./orders-service');

// ─── Constants dùng chung ───────────────────────────────────────────────────
const CONSTANTS = {
  SHIPPING_FREE_THRESHOLD: 2000000,
};

// ─── Helper builders ─────────────────────────────────────────────────────────

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
    weight: '0.5',
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
    shippingState: null,
    shippingZip: '70000',
    shippingCountry: 'VN',
    shippingPhone: '0901234567',
    billingFirstName: 'Anh',
    billingLastName: 'Nguyen',
    billingCompany: null,
    billingAddress1: '123 Lê Lợi',
    billingAddress2: null,
    billingCity: 'HCM',
    billingState: null,
    billingZip: '70000',
    billingCountry: 'VN',
    billingPhone: '0901234567',
    paymentMethod: 'cod',
    notes: null,
    discountCode: null,
    ...overrides,
  };
}

function mkUser(overrides = {}) {
  return { id: 1, email: 'user@example.com', ...overrides };
}

// ─── Setup factory ────────────────────────────────────────────────────────────

function buildService() {
  const repo = {
    // transaction wrapper — chạy callback ngay với fake transaction object (kèm LOCK cho SELECT FOR UPDATE)
    runInTransaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'FOR UPDATE' } })),

    // product / variant
    findProductWithDefaultVariant: jest.fn(),
    findVariantBasic: jest.fn(),
    lockProduct: jest.fn(),
    lockVariant: jest.fn(),
    decrementProductStock: jest.fn().mockResolvedValue(),
    decrementVariantStock: jest.fn().mockResolvedValue(),
    restoreProductStock: jest.fn().mockResolvedValue(),
    restoreVariantStock: jest.fn().mockResolvedValue(),

    // cart
    findOrCreateActiveCart: jest.fn(),
    findActiveCartBySessionId: jest.fn().mockResolvedValue(null),
    findCartByPkWithItemsDetails: jest.fn(),
    findCartItemMatching: jest.fn().mockResolvedValue(null),
    saveCartItem: jest.fn().mockResolvedValue(),
    deleteCartItem: jest.fn().mockResolvedValue(),
    saveCart: jest.fn().mockResolvedValue(),
    findActiveCartsByUser: jest.fn().mockResolvedValue([]),
    clearCartItems: jest.fn().mockResolvedValue(),

    // discount
    findActiveDiscountCode: jest.fn().mockResolvedValue(null),
    incrementDiscountCodeUsage: jest.fn().mockResolvedValue(),

    findUserById: jest.fn(),

    // order
    createOrder: jest.fn(),
    createOrderItem: jest.fn(),
    createInventoryLogs: jest.fn().mockResolvedValue(),
    saveOrder: jest.fn(async (o) => o),
    cancelPendingOrdersByUser: jest.fn().mockResolvedValue(),

    // queries
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

// ─── createOrder ─────────────────────────────────────────────────────────────

describe('OrdersService › createOrder', () => {
  let service, repo, emailGateway, eventBus;

  // Thiết lập happy-path defaults: 1 item buy-now, no variant, no discount
  function setupHappyPath() {
    const product = mkProduct();
    const createdOrder = {
      id: 100,
      number: 'ORD-2601-1234567-AABB1122',
      status: 'pending',
      total: 130000,
      userId: 1,
      shippingFirstName: 'Anh',
      shippingLastName: 'Nguyen',
      shippingAddress1: '123 Lê Lợi',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: null,
      shippingZip: '70000',
      shippingCountry: 'VN',
      createdAt: new Date(),
    };
    const createdItem = {
      id: 1,
      orderId: 100,
      productId: 1,
      variantId: null,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    };

    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    return { product, createdOrder, createdItem };
  }

  beforeEach(() => {
    ({ service, repo, emailGateway, eventBus } = buildService());
  });

  // ── Happy path — buy-now flow ──────────────────────────────────────────────

  test('happy path buy-now (product only, COD) → trả id/number/status/total', async () => {
    const { createdOrder } = setupHappyPath();
    const user = mkUser();
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });

    const result = await service.createOrder({ user, body, sessionIdCookie: null });

    expect(result).toMatchObject({
      id: createdOrder.id,
      number: createdOrder.number,
      status: createdOrder.status,
      total: createdOrder.total,
    });
  });

  test('happy path → tạo order qua repo.createOrder với subtotal/shippingCost đúng', async () => {
    setupHappyPath();
    const user = mkUser();
    // shippingCost do FE tính và truyền vào body
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], shippingCost: 30000 });

    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 100000,
        shippingCost: 30000,
        discount: 0,
        total: 130000,
        userId: 1,
        paymentMethod: 'cod',
      }),
      expect.any(Object),
    );
  });

  test('happy path → publish OrderCreatedEvent', async () => {
    setupHappyPath();
    const user = mkUser();
    await service.createOrder({
      user,
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
    });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.created' }),
    );
  });

  test('happy path COD → fire email xác nhận', async () => {
    setupHappyPath();
    const user = mkUser();
    await service.createOrder({
      user,
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
    });

    expect(emailGateway.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      user.email,
      expect.objectContaining({ orderNumber: expect.any(String) }),
    );
  });

  test('happy path COD → decrementProductStock được gọi', async () => {
    setupHappyPath();
    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 2 }] }),
    });

    expect(repo.decrementProductStock).toHaveBeenCalledWith(
      expect.any(Object),
      2,
      expect.any(Object),
    );
  });

  test('happy path COD → xóa giỏ hàng sau khi đặt', async () => {
    setupHappyPath();
    const activeCarts = [{ id: 5, status: 'active' }];
    repo.findActiveCartsByUser.mockResolvedValue(activeCarts);

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
    });

    expect(activeCarts[0].status).toBe('converted');
    expect(repo.clearCartItems).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });

  // ── Happy path — variant flow ──────────────────────────────────────────────

  test('buy-now với variantId hợp lệ → dùng giá variant + lock variant', async () => {
    const product = mkProduct();
    const variant = mkVariant();
    const createdOrder = {
      id: 101,
      number: 'ORD-X',
      status: 'pending',
      total: 150000,
      userId: 1,
      shippingFirstName: 'A',
      shippingLastName: 'N',
      shippingAddress1: 'x',
      shippingAddress2: null,
      shippingCity: 'x',
      shippingState: null,
      shippingZip: '1',
      shippingCountry: 'VN',
      createdAt: new Date(),
    };
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 8 });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({ id: 2, orderId: 101, productId: 1, variantId: 10 });

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 1 }] }),
    });

    expect(repo.lockVariant).toHaveBeenCalledWith(10, expect.any(Object));
    expect(repo.decrementVariantStock).toHaveBeenCalledWith(
      expect.any(Object),
      1,
      expect.any(Object),
    );
    // giá phải lấy từ variant.price = 120000
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ subtotal: 120000 }),
      expect.any(Object),
    );
  });

  // ── Product không tìm thấy ─────────────────────────────────────────────────

  test('product không tồn tại → AppError 404', async () => {
    repo.findProductWithDefaultVariant.mockResolvedValue(null);

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 999, quantity: 1 }] }),
      }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'orders.productNotFound' });
  });

  test('variant không tồn tại → AppError 404', async () => {
    repo.findProductWithDefaultVariant.mockResolvedValue(mkProduct());
    repo.findVariantBasic.mockResolvedValue(null);

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, variantId: 999, quantity: 1 }] }),
      }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'orders.variantNotFound' });
  });

  // ── Sản phẩm không active ──────────────────────────────────────────────────

  test('product status !== active → AppError 400', async () => {
    repo.findProductWithDefaultVariant.mockResolvedValue(mkProduct({ status: 'inactive' }));
    repo.lockProduct.mockResolvedValue({ stockQuantity: 5 });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.productInactive' });
  });

  // ── Out of stock ───────────────────────────────────────────────────────────

  test('product stock không đủ (lockedProduct.stock < quantity) → AppError 400', async () => {
    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 1 });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 5 }] }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.stockInsufficient' });
  });

  test('product lock trả null (đang bị lock bởi tx khác) → AppError 400', async () => {
    repo.findProductWithDefaultVariant.mockResolvedValue(mkProduct());
    repo.lockProduct.mockResolvedValue(null);

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('variant stock không đủ → AppError 400', async () => {
    const product = mkProduct();
    const variant = mkVariant({ stockQuantity: 2 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 2 });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 5 }] }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.stockInsufficient' });
  });

  // ── Discount code ──────────────────────────────────────────────────────────

  test('discount code không tồn tại / hết hạn → AppError 400', async () => {
    setupHappyPath();
    repo.findActiveDiscountCode.mockResolvedValue(null);

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({
          items: [{ productId: 1, quantity: 1 }],
          discountCode: 'INVALID',
        }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.couponInvalid' });
  });

  test('discount code chưa đến ngày startDate → AppError 400', async () => {
    setupHappyPath();
    const futureDate = new Date(Date.now() + 86400000).toISOString(); // ngày mai
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'fixed',
      value: '50000',
      startDate: futureDate,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'EARLY' }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.couponNotStarted' });
  });

  test('discount code quá ngày endDate → AppError 400', async () => {
    setupHappyPath();
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // hôm qua
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'fixed',
      value: '50000',
      startDate: null,
      endDate: pastDate,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'EXPIRED' }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.couponExpired' });
  });

  test('discount code đã đạt usage limit → AppError 400', async () => {
    setupHappyPath();
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'fixed',
      value: '50000',
      startDate: null,
      endDate: null,
      usageLimit: 10,
      usedCount: 10,
      minOrderAmount: '0',
    });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'MAX' }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.couponLimitReached' });
  });

  test('subtotal < minOrderAmount → AppError 400', async () => {
    setupHappyPath(); // subtotal = 100000
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'fixed',
      value: '50000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '200000', // yêu cầu tối thiểu 200k
    });

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'MIN200' }),
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.couponMinOrderNotMet' });
  });

  test('discount code type=fixed → trừ đúng số tiền cố định', async () => {
    setupHappyPath(); // subtotal = 100000
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'fixed',
      value: '20000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    });

    await service.createOrder({
      user: mkUser(),
      // shippingCost: 30000 do FE tính và truyền vào
      body: mkOrderBody({
        items: [{ productId: 1, quantity: 1 }],
        discountCode: 'FIXED20K',
        shippingCost: 30000,
      }),
    });

    // subtotal=100000, shipping=30000, discount=20000 → total=110000
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 20000, total: 110000 }),
      expect.any(Object),
    );
  });

  test('discount code type=percent → tính % đúng', async () => {
    setupHappyPath(); // subtotal = 100000
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'percent',
      value: '10', // 10%
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: null,
    });

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'PCT10' }),
    });

    // discount = 100000 * 10 / 100 = 10000
    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 10000 }),
      expect.any(Object),
    );
  });

  test('discount percent vượt maxDiscountAmount → cap về maxDiscountAmount', async () => {
    setupHappyPath(); // subtotal = 100000
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'percent',
      value: '50', // 50% = 50000
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
      maxDiscountAmount: '30000', // cap ở 30000
    });

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'PCT50CAP' }),
    });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 30000 }),
      expect.any(Object),
    );
  });

  test('discount > subtotal → cap discount = subtotal', async () => {
    setupHappyPath(); // subtotal = 100000
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 5,
      type: 'fixed',
      value: '999999', // lớn hơn subtotal
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    });

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], discountCode: 'BIG' }),
    });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discount: 100000 }), // capped tại subtotal
      expect.any(Object),
    );
  });

  test('discount code COD → incrementDiscountCodeUsage được gọi ngay', async () => {
    setupHappyPath();
    const codeData = {
      id: 5,
      type: 'fixed',
      value: '10000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    };
    repo.findActiveDiscountCode.mockResolvedValue(codeData);

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({
        items: [{ productId: 1, quantity: 1 }],
        discountCode: 'SAVE10K',
        paymentMethod: 'cod',
      }),
    });

    expect(repo.incrementDiscountCodeUsage).toHaveBeenCalledWith(codeData, expect.any(Object));
  });

  test('discount code bank_transfer → incrementDiscountCodeUsage cũng được gọi ngay', async () => {
    setupHappyPath();
    const codeData = {
      id: 5,
      type: 'fixed',
      value: '10000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    };
    repo.findActiveDiscountCode.mockResolvedValue(codeData);

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({
        items: [{ productId: 1, quantity: 1 }],
        discountCode: 'SAVE10K',
        paymentMethod: 'bank_transfer',
      }),
    });

    expect(repo.incrementDiscountCodeUsage).toHaveBeenCalledWith(codeData, expect.any(Object));
  });

  test('discount code + online payment (vnpay) → KHÔNG tăng usedCount', async () => {
    setupHappyPath();
    const codeData = {
      id: 5,
      type: 'fixed',
      value: '10000',
      startDate: null,
      endDate: null,
      usageLimit: null,
      usedCount: 0,
      minOrderAmount: '0',
    };
    repo.findActiveDiscountCode.mockResolvedValue(codeData);

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({
        items: [{ productId: 1, quantity: 1 }],
        discountCode: 'SAVE10K',
        paymentMethod: 'vnpay',
      }),
    });

    expect(repo.incrementDiscountCodeUsage).not.toHaveBeenCalled();
  });

  // ── Payment type behavior ──────────────────────────────────────────────────

  test('paymentMethod=cod → xóa cart (clearCartItems) trong transaction', async () => {
    setupHappyPath();
    const cart = { id: 7, status: 'active' };
    repo.findActiveCartsByUser.mockResolvedValue([cart]);

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], paymentMethod: 'cod' }),
    });

    expect(cart.status).toBe('converted');
    expect(repo.clearCartItems).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });

  test('paymentMethod=installment → xóa cart (cũng là manual method)', async () => {
    setupHappyPath();
    const cart = { id: 8, status: 'active' };
    repo.findActiveCartsByUser.mockResolvedValue([cart]);

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], paymentMethod: 'installment' }),
    });

    expect(repo.clearCartItems).toHaveBeenCalled();
  });

  test('paymentMethod=vnpay (online) → KHÔNG xóa cart', async () => {
    setupHappyPath();

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }], paymentMethod: 'vnpay' }),
    });

    // findActiveCartsByUser không được gọi khi là online payment
    expect(repo.clearCartItems).not.toHaveBeenCalled();
  });

  // ── Cart flow ──────────────────────────────────────────────────────────────

  test('cart flow (không có items) — giỏ trống → AppError 400', async () => {
    const cart = { id: 1, items: [] };
    repo.findOrCreateActiveCart.mockResolvedValue({ id: 1 });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [] }), // empty → cart flow
        sessionIdCookie: null,
      }),
    ).rejects.toMatchObject({ statusCode: 400, message: 'orders.cartEmpty' });
  });

  test('cart flow (không có items) — cart không tìm thấy sau reload → AppError 400', async () => {
    repo.findOrCreateActiveCart.mockResolvedValue({ id: 1 });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(null);

    await expect(
      service.createOrder({
        user: mkUser(),
        body: mkOrderBody({ items: [] }),
        sessionIdCookie: null,
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test('cart flow với guest cart → merge guest cart vào user cart', async () => {
    const userCart = { id: 10 };
    const guestCart = {
      id: 20,
      status: 'active',
      items: [{ productId: 1, variantId: null, quantity: 1 }],
    };
    const product = mkProduct();

    repo.findOrCreateActiveCart.mockResolvedValue(userCart);
    repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    repo.findCartItemMatching.mockResolvedValue(null); // không trùng
    repo.findCartByPkWithItemsDetails.mockResolvedValue({
      id: 10,
      items: [
        {
          productId: 1,
          variantId: null,
          quantity: 1,
          Product: product,
          ProductVariant: null,
        },
      ],
    });
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue({
      id: 200,
      number: 'ORD-X',
      status: 'pending',
      total: 130000,
      userId: 1,
      shippingFirstName: 'A',
      shippingLastName: 'N',
      shippingAddress1: 'x',
      shippingAddress2: null,
      shippingCity: 'x',
      shippingState: null,
      shippingZip: '1',
      shippingCountry: 'VN',
      createdAt: new Date(),
    });
    repo.createOrderItem.mockResolvedValue({ id: 99, orderId: 200 });

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [] }), // cart flow
      sessionIdCookie: 'guest-session-id',
    });

    // guest cart phải được merge (saveCartItem gọi khi move item, saveCart gọi để mark merged)
    expect(guestCart.status).toBe('merged');
    expect(repo.saveCart).toHaveBeenCalledWith(guestCart, expect.any(Object));
  });

  // ── Inventory logs ─────────────────────────────────────────────────────────

  test('tạo đơn thành công → createInventoryLogs được gọi với orderId', async () => {
    const { createdOrder } = setupHappyPath();

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 3 }] }),
    });

    expect(repo.createInventoryLogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: createdOrder.id,
          changeType: 'sale',
          changeAmount: -3,
        }),
      ]),
      expect.any(Object),
    );
  });

  // ── cancelPendingOrdersByUser ──────────────────────────────────────────────

  test('tạo đơn → hủy pending orders cũ trước', async () => {
    setupHappyPath();

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
    });

    expect(repo.cancelPendingOrdersByUser).toHaveBeenCalledWith(1, expect.any(Object));
  });
});

// ─── getUserOrders ────────────────────────────────────────────────────────────

describe('OrdersService › getUserOrders', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('trả đúng data/total/page/limit', async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 2, rows });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });

    expect(result).toEqual({ data: rows, total: 2, page: 1, limit: 20 });
  });

  test('page 2 → offset đúng = (page-1) × limit', async () => {
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 50, rows: [] });

    await service.getUserOrders({ userId: 1, page: 2, limit: 10 });

    expect(repo.findUserOrdersWithItems).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10, offset: 10 }),
    );
  });

  test('limit > 100 → cap về 100', async () => {
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 0, rows: [] });

    await service.getUserOrders({ userId: 1, page: 1, limit: 999 });

    expect(repo.findUserOrdersWithItems).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 100 }),
    );
  });

  test('page/limit là string → parse đúng', async () => {
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 5, rows: [] });

    const result = await service.getUserOrders({ userId: 1, page: '3', limit: '5' });

    expect(result.page).toBe(3);
    expect(result.limit).toBe(5);
    expect(repo.findUserOrdersWithItems).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 5, offset: 10 }),
    );
  });

  test('limit không hợp lệ (NaN) → fallback về 20', async () => {
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 0, rows: [] });

    await service.getUserOrders({ userId: 1, page: 1, limit: 'abc' });

    expect(repo.findUserOrdersWithItems).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 20 }),
    );
  });

  test('kết quả rỗng → data=[], total=0', async () => {
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 0, rows: [] });

    const result = await service.getUserOrders({ userId: 99, page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('item có unitPrice nhưng không có price → map unitPrice → price', async () => {
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: 500000, Product: null }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });

    expect(result.data[0].items[0].price).toBe(500000);
  });

  test('item đã có price → không ghi đè từ unitPrice', async () => {
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: 500000, price: 300000, Product: null }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });

    expect(result.data[0].items[0].price).toBe(300000);
  });

  test('item.Product có productImages → transform thumbnail + images + xóa productImages', async () => {
    const row = {
      toJSON: () => ({
        id: 1,
        items: [
          {
            unitPrice: 100000,
            Product: {
              productImages: [
                { imageUrl: 'https://cdn/a.jpg', isThumbnail: false },
                { imageUrl: 'https://cdn/b.jpg', isThumbnail: true },
              ],
            },
          },
        ],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });
    const product = result.data[0].items[0].Product;

    expect(product.thumbnail).toBe('https://cdn/b.jpg');
    expect(product.images).toEqual(['https://cdn/a.jpg', 'https://cdn/b.jpg']);
    expect(product.productImages).toBeUndefined();
  });

  test('productImages không có isThumbnail → fallback về ảnh đầu tiên', async () => {
    const row = {
      toJSON: () => ({
        id: 1,
        items: [
          {
            unitPrice: 100000,
            Product: {
              productImages: [{ imageUrl: 'https://cdn/first.jpg', isThumbnail: false }],
            },
          },
        ],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });

    expect(result.data[0].items[0].Product.thumbnail).toBe('https://cdn/first.jpg');
  });

  test('productImages rỗng → thumbnail = null', async () => {
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: 100000, Product: { productImages: [] } }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });

    expect(result.data[0].items[0].Product.thumbnail).toBeNull();
  });

  test('row không có toJSON → dùng spread {...row}', async () => {
    const row = { id: 5, items: [] };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.getUserOrders({ userId: 1, page: 1, limit: 20 });

    expect(result.data[0].id).toBe(5);
  });
});

// ─── getOrderById ─────────────────────────────────────────────────────────────

describe('OrdersService › getOrderById', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('order không tồn tại → AppError 404', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);

    await expect(
      service.getOrderById({ id: 999, userId: 1, role: 'customer' }),
    ).rejects.toMatchObject({ statusCode: 404, message: 'orders.notFound' });
  });

  test('order thuộc user khác + không phải admin → AppError 403', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue({ id: 1, userId: 99 });

    await expect(
      service.getOrderById({ id: 1, userId: 1, role: 'customer' }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test('owner có thể xem order của mình', async () => {
    const order = { id: 1, userId: 1 };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    const result = await service.getOrderById({ id: 1, userId: 1, role: 'customer' });

    expect(result).toMatchObject({ id: 1, userId: 1 });
  });

  test('admin có thể xem order của bất kỳ user', async () => {
    const order = { id: 1, userId: 99 };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    const result = await service.getOrderById({ id: 1, userId: 1, role: 'admin' });

    expect(result).toMatchObject({ id: 1, userId: 99 });
  });

  test('gọi findOrderByPkWithItemsAndUser với đúng id', async () => {
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue({ id: 42, userId: 5 });

    await service.getOrderById({ id: 42, userId: 5, role: 'customer' });

    expect(repo.findOrderByPkWithItemsAndUser).toHaveBeenCalledWith(42);
  });
});

// ─── cancelOrder ──────────────────────────────────────────────────────────────

describe('OrdersService › cancelOrder', () => {
  let service, repo, emailGateway, eventBus;

  beforeEach(() => {
    ({ service, repo, emailGateway, eventBus } = buildService());
  });

  function mkOrder(overrides = {}) {
    return {
      id: 1,
      number: 'ORD-TEST-001',
      status: 'pending',
      userId: 1,
      createdAt: new Date(),
      items: [],
      ...overrides,
    };
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  test('order không tồn tại → AppError 404', async () => {
    repo.findOrderForCancel.mockResolvedValue(null);

    await expect(service.cancelOrder({ id: 99, userId: 1 })).rejects.toMatchObject({
      statusCode: 404,
      message: 'orders.notFound',
    });
  });

  // ── Domain errors từ OrderAggregate ───────────────────────────────────────

  test('order status=shipped → AppError 422', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'shipped' }));

    await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('order status=delivered → DomainError 422', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'delivered' }));

    await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  test('order status=cancelled → DomainError 422 (không hủy lại)', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'cancelled' }));

    await expect(service.cancelOrder({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  // ── Happy path — pending ───────────────────────────────────────────────────

  test('pending order → status chuyển thành cancelled', async () => {
    const order = mkOrder({ status: 'pending', items: [] });
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 1, userId: 1 });

    expect(order.status).toBe('cancelled');
    expect(repo.saveOrder).toHaveBeenCalledWith(order, expect.any(Object));
  });

  test('pending order → publish OrderCancelledEvent', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'pending' }));

    await service.cancelOrder({ id: 1, userId: 1 });

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.cancelled' }),
    );
  });

  test('trả về { id, number, status: cancelled }', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'pending' }));

    const result = await service.cancelOrder({ id: 1, userId: 1 });

    expect(result).toMatchObject({ id: 1, number: 'ORD-TEST-001', status: 'cancelled' });
  });

  // ── Happy path — processing ────────────────────────────────────────────────

  test('processing order → cũng có thể hủy được', async () => {
    const order = mkOrder({ status: 'processing', items: [] });
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 1, userId: 1 });

    expect(order.status).toBe('cancelled');
  });

  // ── Restore stock ──────────────────────────────────────────────────────────

  test('item có variantId → restoreVariantStock được gọi', async () => {
    const variant = mkVariant();
    const order = mkOrder({
      status: 'pending',
      items: [{ productId: 1, variantId: 10, quantity: 3, ProductVariant: variant, Product: null }],
    });
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 1, userId: 1 });

    expect(repo.restoreVariantStock).toHaveBeenCalledWith(variant, 3, expect.any(Object));
    expect(repo.restoreProductStock).not.toHaveBeenCalled();
  });

  test('item không có variantId → restoreProductStock được gọi', async () => {
    const product = mkProduct();
    const order = mkOrder({
      status: 'pending',
      items: [
        { productId: 1, variantId: null, quantity: 2, Product: product, ProductVariant: null },
      ],
    });
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 1, userId: 1 });

    expect(repo.restoreProductStock).toHaveBeenCalledWith(product, 2, expect.any(Object));
    expect(repo.restoreVariantStock).not.toHaveBeenCalled();
  });

  test('nhiều items → restore stock cho tất cả items', async () => {
    const product = mkProduct();
    const variant = mkVariant();
    const order = mkOrder({
      status: 'pending',
      items: [
        { productId: 1, variantId: null, quantity: 2, Product: product, ProductVariant: null },
        { productId: 1, variantId: 10, quantity: 1, Product: product, ProductVariant: variant },
      ],
    });
    repo.findOrderForCancel.mockResolvedValue(order);

    await service.cancelOrder({ id: 1, userId: 1 });

    expect(repo.restoreProductStock).toHaveBeenCalledTimes(1);
    expect(repo.restoreVariantStock).toHaveBeenCalledTimes(1);
  });

  // ── Email ─────────────────────────────────────────────────────────────────

  test('có userEmail → gửi email hủy đơn', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'pending' }));

    await service.cancelOrder({ id: 1, userId: 1, userEmail: 'user@example.com' });

    expect(emailGateway.sendOrderCancellationEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ orderNumber: 'ORD-TEST-001' }),
    );
  });

  test('không có userEmail → không gửi email (không crash)', async () => {
    repo.findOrderForCancel.mockResolvedValue(mkOrder({ status: 'pending' }));

    await expect(service.cancelOrder({ id: 1, userId: 1, userEmail: null })).resolves.toMatchObject(
      { status: 'cancelled' },
    );

    expect(emailGateway.sendOrderCancellationEmail).not.toHaveBeenCalled();
  });
});

// ─── createOrder — cart merge với existing item ──────────────────────────────
// Covers line 106-108: khi guest cart có item trùng với user cart → update qty + delete

describe('OrdersService › createOrder — cart merge (item trùng)', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('guest cart item trùng với user cart item → cộng dồn quantity + xóa guest item', async () => {
    const userCart = { id: 10 };
    const existingCartItem = { cartId: 10, productId: 1, variantId: null, quantity: 2 };
    const guestItem = { productId: 1, variantId: null, quantity: 3, cartId: 20 };
    const guestCart = { id: 20, status: 'active', items: [guestItem] };
    const product = mkProduct();

    repo.findOrCreateActiveCart.mockResolvedValue(userCart);
    repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    // Item trùng → trả về existing item
    repo.findCartItemMatching.mockResolvedValue(existingCartItem);
    repo.findCartByPkWithItemsDetails.mockResolvedValue({
      id: 10,
      items: [
        {
          productId: 1,
          variantId: null,
          quantity: 5,
          Product: product,
          ProductVariant: null,
        },
      ],
    });
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue({
      id: 200,
      number: 'ORD-MERGE',
      status: 'pending',
      total: 130000,
      userId: 1,
      shippingFirstName: 'A',
      shippingLastName: 'N',
      shippingAddress1: 'x',
      shippingAddress2: null,
      shippingCity: 'x',
      shippingState: null,
      shippingZip: '1',
      shippingCountry: 'VN',
      createdAt: new Date(),
    });
    repo.createOrderItem.mockResolvedValue({ id: 99, orderId: 200 });

    await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [] }),
      sessionIdCookie: 'guest-session',
    });

    // saveCartItem gọi để update quantity của existing item
    expect(repo.saveCartItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 5 }), // 2 + 3
      expect.any(Object),
    );
    // deleteCartItem gọi để xóa guest item
    expect(repo.deleteCartItem).toHaveBeenCalledWith(guestItem, expect.any(Object));
  });
});

// ─── createOrder — email catch (line 359) ────────────────────────────────────
// Covers line 359: .catch trên sendOrderConfirmationEmail

describe('OrdersService › createOrder — email send failure', () => {
  let service, repo, emailGateway, logger;

  function setupHappyPath() {
    const product = mkProduct();
    const createdOrder = {
      id: 400,
      number: 'ORD-EMAIL',
      status: 'pending',
      total: 130000,
      userId: 1,
      shippingFirstName: 'Anh',
      shippingLastName: 'Nguyen',
      shippingAddress1: '123 Lê Lợi',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: null,
      shippingZip: '70000',
      shippingCountry: 'VN',
      createdAt: new Date(),
    };
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({ id: 1, orderId: 400 });
    return { product, createdOrder };
  }

  beforeEach(() => {
    ({ service, repo, emailGateway, logger } = buildService());
  });

  test('email send thất bại → không throw, chỉ log error', async () => {
    setupHappyPath();
    emailGateway.sendOrderConfirmationEmail.mockRejectedValue(new Error('SMTP timeout'));

    // Không nên throw dù email fail
    const result = await service.createOrder({
      user: mkUser(),
      body: mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }),
    });

    expect(result).toMatchObject({ id: 400 });
    // Logger error được gọi (fire-and-forget catch)
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('email'), expect.any(Error));
  });
});

// ─── cancelOrder — email catch (line 466) ────────────────────────────────────
// Covers line 466: .catch trên sendOrderCancellationEmail

describe('OrdersService › cancelOrder — email send failure', () => {
  let service, repo, emailGateway, logger;

  beforeEach(() => {
    ({ service, repo, emailGateway, logger } = buildService());
  });

  test('email hủy đơn thất bại → không throw, chỉ log error', async () => {
    const order = {
      id: 1,
      number: 'ORD-CANCEL',
      status: 'pending',
      userId: 1,
      createdAt: new Date(),
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    emailGateway.sendOrderCancellationEmail.mockRejectedValue(new Error('Mail server down'));

    const result = await service.cancelOrder({ id: 1, userId: 1, userEmail: 'user@example.com' });

    expect(result).toMatchObject({ status: 'cancelled' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('email hủy'),
      expect.any(Error),
    );
  });
});

// ─── updateOrderStatus — email catch (line 532) ──────────────────────────────
// Covers line 532: .catch trên sendOrderStatusUpdateEmail

describe('OrdersService › updateOrderStatus', () => {
  let service, repo, emailGateway, logger;

  beforeEach(() => {
    ({ service, repo, emailGateway, logger } = buildService());
  });

  test('updateOrderStatus → gửi email cập nhật trạng thái khi user có email', async () => {
    const order = {
      id: 1,
      number: 'ORD-UPD',
      status: 'processing',
      paymentMethod: 'cod',
      userId: 1,
      subtotal: '50000',
      total: '80000',
      user: { email: 'user@example.com' },
      createdAt: new Date(),
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'shipped' });

    expect(emailGateway.sendOrderStatusUpdateEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ orderNumber: 'ORD-UPD', status: 'shipped' }),
    );
  });

  test('updateOrderStatus email fail → không throw, chỉ log error', async () => {
    const order = {
      id: 1,
      number: 'ORD-UPD2',
      status: 'processing',
      paymentMethod: 'vnpay',
      userId: 1,
      subtotal: '50000',
      total: '80000',
      user: { email: 'user@example.com' },
      createdAt: new Date(),
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    emailGateway.sendOrderStatusUpdateEmail.mockRejectedValue(new Error('SMTP fail'));

    const result = await service.updateOrderStatus({ id: 1, status: 'shipped' });

    expect(result).toMatchObject({ id: 1, status: 'shipped' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('email cập nhật'),
      expect.any(Error),
    );
  });
});

// ─── confirmReceived — invalid status (line 743) ────────────────────────────

describe('OrdersService › confirmReceived — invalid status', () => {
  let service, repo;

  beforeEach(() => {
    ({ service, repo } = buildService());
  });

  test('status pending → throw 422', async () => {
    const order = {
      id: 1,
      status: 'pending',
      userId: 1,
      number: 'X',
      paymentMethod: 'cod',
      reload: jest.fn(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);

    await expect(service.confirmReceived({ id: 1, userId: 1 })).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});
