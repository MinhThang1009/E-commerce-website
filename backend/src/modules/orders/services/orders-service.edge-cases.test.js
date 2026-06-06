// Tests nhắm vào các nhánh chưa được cover trong OrdersService.
// Uncovered: 96, 146, 302-309, 477, 510, 578, 584

const OrdersService = require('./orders-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSTANTS = {
  SHIPPING_FREE_THRESHOLD: 500000,
  SHIPPING_BASE_RATE: 30000,
};

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

// ─── Line 96: cart flow — guestCart tồn tại nhưng items rỗng ─────────────────

describe('createOrder — cart flow: guestCart tồn tại với items rỗng', () => {
  it('bỏ qua merge khi guestCart.items = [] (line 96 false branch)', async () => {
    const { service, repo } = buildService();

    const product = mkProduct();
    const cart = {
      id: 5,
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

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    // guestCart tồn tại nhưng items rỗng
    repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, items: [] });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 1,
      number: 'ORD-01',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = {
      id: 1,
      orderId: 1,
      productId: 1,
      variantId: null,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    // Cart flow: không truyền items
    const body = mkOrderBody({ items: undefined });

    const result = await service.createOrder({ user, body, sessionIdCookie: 'sess-guest' });

    // Không gọi saveCart (không merge)
    expect(repo.saveCart).not.toHaveBeenCalled();
    expect(result.id).toBe(1);
  });

  it('bỏ qua merge khi guestCart.items = null (line 96 false branch)', async () => {
    const { service, repo } = buildService();

    const product = mkProduct();
    const cart = {
      id: 5,
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

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    // guestCart tồn tại nhưng items = null
    repo.findActiveCartBySessionId.mockResolvedValue({ id: 99, items: null });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 1,
      number: 'ORD-02',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = {
      id: 1,
      orderId: 1,
      productId: 1,
      variantId: null,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };

    const result = await service.createOrder({
      user,
      body: mkOrderBody({ items: undefined }),
      sessionIdCookie: 'sess-guest',
    });

    expect(repo.saveCart).not.toHaveBeenCalled();
    expect(result.id).toBe(1);
  });
});

// ─── Line 146: lockedVariant = null → throw 400 ──────────────────────────────

describe('createOrder — lockedVariant null → throw 400 (line 146)', () => {
  it('ném 400 khi lockVariant trả null (không tìm thấy variant để lock)', async () => {
    // Line 144: !lockedVariant branch
    const { service, repo } = buildService();

    const product = mkProduct();
    const variant = mkVariant();

    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    // lockVariant trả null
    repo.lockVariant.mockResolvedValue(null);

    const user = { id: 1, email: 'user@test.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 1 }] });

    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      statusCode: 400,
      message: 'orders.stockInsufficient',
    });
  });
});

// ─── Lines 302-309: online payment → không clear cart ────────────────────────

describe('createOrder — online payment → không clear cart ngay (line 317-320)', () => {
  it('không gọi _clearUserCartInTransaction khi paymentMethod = online', async () => {
    const { service, repo } = buildService();

    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 1,
      number: 'ORD-ONLINE',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = {
      id: 1,
      orderId: 1,
      productId: 1,
      variantId: null,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    // paymentMethod KHÔNG phải 'cod'/'bank_transfer'/'installment'
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], paymentMethod: 'vnpay' });

    await service.createOrder({ user, body, sessionIdCookie: null });

    // clearCartItems không được gọi vì online payment đợi webhook
    expect(repo.clearCartItems).not.toHaveBeenCalled();
    expect(repo.findActiveCartsByUser).not.toHaveBeenCalled();
  });
});

// ─── BUG-MEDIUM-1: _clearUserCartInTransaction phải re-throw khi lỗi ────────────

describe('createOrder — clearCart error phải rollback transaction (MEDIUM-1)', () => {
  it('BUG-MEDIUM-1: clearCartItems throw → createOrder fail (không swallow)', async () => {
    const { service, repo } = buildService();

    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue({
      id: 1,
      number: 'ORD-TEST',
      status: 'pending',
      total: 100000,
      userId: 1,
      createdAt: new Date(),
    });
    repo.createOrderItem.mockResolvedValue({
      id: 1,
      orderId: 1,
      productId: 1,
      variantId: null,
      name: 'SP',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    });
    repo.findActiveCartsByUser.mockResolvedValue([{ id: 10, status: 'active', save: jest.fn() }]);
    repo.saveCart.mockResolvedValue();
    // clearCartItems throw → phải propagate ra ngoài (không swallow)
    repo.clearCartItems.mockRejectedValue(new Error('DB_ERROR'));

    const user = { id: 1, email: 'u@test.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], paymentMethod: 'cod' });

    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toThrow(
      'DB_ERROR',
    );
  });
});

// ─── F3: server enforce shippingCost (ngưỡng free + clamp âm) ─────────────────

describe('createOrder — shippingCost enforce (F3)', () => {
  it('subtotal >= ngưỡng free → shippingCost = 0 dù FE gửi phí > 0', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 600000 }); // subtotal 600000 >= 500000
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue({
      id: 1,
      number: 'ORD-FREE',
      status: 'pending',
      total: 600000,
      userId: 1,
      createdAt: new Date(),
    });
    repo.createOrderItem.mockResolvedValue({
      id: 1,
      productId: 1,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 600000,
      subtotal: 600000,
    });

    const user = { id: 1, email: 'u@t.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'cod',
      shippingCost: 50000,
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCost: 0, subtotal: 600000 }),
      expect.anything(),
    );
  });

  it('shippingCost FE âm → clamp về 0 (khi chưa đủ ngưỡng free)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000 }); // subtotal 100000 < 500000
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue({
      id: 2,
      number: 'ORD-NEG',
      status: 'pending',
      total: 100000,
      userId: 1,
      createdAt: new Date(),
    });
    repo.createOrderItem.mockResolvedValue({
      id: 2,
      productId: 1,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    });

    const user = { id: 1, email: 'u@t.com' };
    const body = mkOrderBody({
      items: [{ productId: 1, quantity: 1 }],
      paymentMethod: 'cod',
      shippingCost: -100,
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ shippingCost: 0 }),
      expect.anything(),
    );
  });
});

// ─── Lines 302-309: no inventory logs khi không có items (edge case) ──────────

describe('createOrder — không tạo inventory logs khi items = 0 (line 309 false branch)', () => {
  // Đây là nhánh: pendingInventoryLogs.length = 0 → không gọi createInventoryLogs
  // Tuy nhiên đây là đường đi không thực tế vì items required.
  // Test hành vi: với 1 item buy-now không variantId → lockProduct → tạo log (length > 0 → true branch)
  it('gọi createInventoryLogs khi có items (line 309 true branch)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 1,
      number: 'ORD-LOG',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = {
      id: 1,
      orderId: 1,
      productId: 1,
      variantId: null,
      name: 'Sản phẩm A',
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createInventoryLogs).toHaveBeenCalled();
  });
});

// ─── L259: cap mã giảm giá theo maxDiscountAmount (money-logic mutation kill) ──────
describe('createOrder — cap discount theo maxDiscountAmount (L259)', () => {
  // Setup buy-now: subtotal = basePrice*qty = 100000; percent 10% → discount thô = 10000.
  function setupDiscount(maxDiscountAmount) {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 10 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 7,
      code: 'P10',
      type: 'percent',
      value: 10,
      minOrderAmount: 0,
      maxDiscountAmount,
      usageLimit: null,
      usedCount: 0,
      startDate: null,
      endDate: null,
    });
    let captured;
    repo.createOrder.mockImplementation(async (data) => {
      captured = data;
      return { id: 1, number: 'ORD-DISC', userId: 1, createdAt: new Date(), ...data };
    });
    repo.createOrderItem.mockResolvedValue({
      id: 1,
      productId: 1,
      quantity: 1,
      unitPrice: 100000,
      subtotal: 100000,
    });
    const run = () =>
      service.createOrder({
        user: { id: 1, email: 'u@t.com' },
        body: mkOrderBody({
          items: [{ productId: 1, quantity: 1 }],
          discountCode: 'P10',
          paymentMethod: 'cod',
        }),
        sessionIdCookie: null,
      });
    return { run, getCaptured: () => captured };
  }

  it('maxDiscountAmount=0 (falsy) → KHÔNG cap, discount=10000 (kill LogicalOperator &&→||)', async () => {
    // && short-circuit: maxDiscountAmount=0 falsy → bỏ cap → discount = 10% × 100000 = 10000.
    // Nếu &&→||: `0 || (10000 > parseFloat(0)=0)` = true → cap về parseFloat(0)=0 → discount=0 (SAI).
    const { run, getCaptured } = setupDiscount(0);
    await run();
    expect(getCaptured().discount).toBe(10000);
  });

  it('discount < maxDiscountAmount → KHÔNG cap, discount=10000 (kill ConditionalExpression→true)', async () => {
    // maxDiscountAmount=50000 > discount thô 10000 → điều kiện cap = false → discount giữ 10000.
    // Nếu Conditional→true: luôn cap về 50000 → discount=50000 (SAI).
    const { run, getCaptured } = setupDiscount(50000);
    await run();
    expect(getCaptured().discount).toBe(10000);
  });

  it('discount > maxDiscountAmount → CAP về maxDiscountAmount (5000)', async () => {
    const { run, getCaptured } = setupDiscount(5000);
    await run();
    expect(getCaptured().discount).toBe(5000);
  });
});
