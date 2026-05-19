// Tests nhắm vào các nhánh chưa được cover trong OrdersService.
// Uncovered: 96, 146, 302-309, 477, 510, 578, 584

const OrdersService = require('./orders-service');

// ─── Constants ────────────────────────────────────────────────────────────────

const CONSTANTS = {
  POINTS_EARN_RATE: 1000,
  POINTS_VALUE: 100,
  SHIPPING_FREE_THRESHOLD: 500000,
  SHIPPING_BASE_RATE: 30000,
  SHIPPING_WEIGHT_RATE: 5000,
};

// ─── Builders ─────────────────────────────────────────────────────────────────

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
    pointsToUse: 0,
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
          warrantyPackageIds: [],
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
          warrantyPackageIds: [],
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

// ─── Line 302: createOrder — warrantyPackageIds truthy → truyền vào orderItem ──

describe('createOrder — warrantyPackageIds truthy trong createOrderItem (line 302 TRUE branch)', () => {
  it('truyền warrantyPackageIds vào createOrderItem khi item có gói bảo hành', async () => {
    // Line 302: item.warrantyPackageIds || null → TRUE branch khi warrantyPackageIds truthy
    const { service, repo } = buildService();

    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.findActiveWarrantyPackagesByIds.mockResolvedValue([
      { id: 1, name: 'BH 12 tháng', price: '50000' },
    ]);

    const createdOrder = {
      id: 1,
      number: 'ORD-WARRANTY',
      status: 'pending',
      total: 200000,
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
    // Item có warrantyPackageIds truthy
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1, warrantyPackageIds: [1] }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    // createOrderItem phải được gọi với warrantyPackageIds (truthy)
    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ warrantyPackageIds: [1] }),
      expect.any(Object),
    );
  });

  it('truyền [] khi warrantyPackageIds undefined trong body (line 87 normalizes to [], line 302 [] || null = [])', async () => {
    // Line 87: item.warrantyPackageIds || [] → undefined → []
    // Line 302: item.warrantyPackageIds = [] → [] || null = [] (truthy, không fallback null)
    // Nhánh FALSE của `|| null` tại line 302 xảy ra khi warrantyPackageIds = undefined/null trực tiếp
    // nhưng buy-now flow normalize thành [] tại line 87 nên [] được truyền, không phải null
    const { service, repo } = buildService();

    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 2,
      number: 'ORD-NO-WARRANTY',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = {
      id: 2,
      orderId: 2,
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
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] }); // no warrantyPackageIds

    await service.createOrder({ user, body, sessionIdCookie: null });

    // Line 87: warrantyPackageIds = undefined → || [] = []
    // Line 302: [] || null = [] (truthy [] stays as [])
    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ warrantyPackageIds: [] }),
      expect.any(Object),
    );
  });
});

// ─── Line 302: warrantyPackageIds = null → null (cart flow, không normalize) ──

describe('createOrder — cart flow: warrantyPackageIds null → createOrderItem với null (line 302 FALSE)', () => {
  it('warrantyPackageIds = null trong cart item → createOrderItem với warrantyPackageIds: null', async () => {
    // Line 302: item.warrantyPackageIds || null
    // Cart flow: item đến từ cart.items → warrantyPackageIds có thể là null từ DB
    // null || null = null (FALSE branch)
    const { service, repo } = buildService();

    const product = mkProduct();
    // Cart item với warrantyPackageIds = null (không được normalize như buy-now)
    const cartItem = {
      productId: 1,
      variantId: null,
      quantity: 1,
      Product: product,
      ProductVariant: null,
      warrantyPackageIds: null, // null → line 302: null || null = null
    };
    const cart = { id: 5, items: [cartItem] };

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 1,
      number: 'ORD-NULL-WP',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = { id: 1, orderId: 1 };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    // Cart flow: không truyền items
    await service.createOrder({
      user,
      body: mkOrderBody({ items: undefined }),
      sessionIdCookie: null,
    });

    // createOrderItem được gọi với warrantyPackageIds: null (null || null = null)
    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ warrantyPackageIds: null }),
      expect.any(Object),
    );
  });
});

// ─── Lines 298-300: warrantyPackages truthy → map (TRUE branch trong createOrderItem) ──

describe('createOrder — item.warrantyPackages truthy → map packages vào attributes (line 298-299 TRUE)', () => {
  it('attributes.warrantyPackages được build từ item.warrantyPackages khi truthy', async () => {
    // Line 181: warrantyPackageIds có giá trị → findActiveWarrantyPackagesByIds → item.warrantyPackages set
    // Line 298: item.warrantyPackages truthy → item.warrantyPackages.map(...)
    const { service, repo } = buildService();

    const product = mkProduct();
    const warrantyPkg = { id: 1, name: 'BH 12 tháng', price: '50000' };
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.findActiveWarrantyPackagesByIds.mockResolvedValue([warrantyPkg]);

    const createdOrder = {
      id: 2,
      number: 'ORD-WP-MAP',
      status: 'pending',
      total: 200000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = { id: 2, orderId: 2 };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    // Buy-now flow với warrantyPackageIds truthy
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1, warrantyPackageIds: [1] }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    // attributes.warrantyPackages phải là array được map từ packages
    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({
          warrantyPackages: [{ id: 1, name: 'BH 12 tháng', price: '50000' }],
        }),
      }),
      expect.any(Object),
    );
  });
});

// ─── Lines 309-313: pendingInventoryLogs.length > 0 → gọi createInventoryLogs (TRUE branch) ──

describe('createOrder — pendingInventoryLogs có log → createInventoryLogs được gọi (line 309 TRUE)', () => {
  it('createInventoryLogs được gọi với orderId đúng sau khi order được tạo', async () => {
    // Line 309: pendingInventoryLogs.length > 0 (TRUE) → createInventoryLogs({ ...log, orderId: order.id })
    const { service, repo } = buildService();

    const product = mkProduct();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 99,
      number: 'ORD-INV-LOG',
      status: 'pending',
      total: 130000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = { id: 99, orderId: 99 };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 2 }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    // Mỗi item không có variantId → lockProduct → pendingInventoryLogs có 1 entry
    // createInventoryLogs được gọi với orderId = 99 bổ sung vào log
    expect(repo.createInventoryLogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: 99,
          productId: 1,
          changeType: 'sale',
          changeAmount: -2,
        }),
      ]),
      expect.any(Object),
    );
  });

  it('pendingInventoryLogs có log với variantId khi item có variant', async () => {
    // Variant path cũng tạo pendingInventoryLog với variantId
    const { service, repo } = buildService();

    const product = mkProduct();
    const variant = mkVariant();
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 8 });

    const createdOrder = {
      id: 100,
      number: 'ORD-VAR-LOG',
      status: 'pending',
      total: 150000,
      userId: 1,
      createdAt: new Date(),
    };
    const createdItem = { id: 100, orderId: 100 };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 1 }] });

    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createInventoryLogs).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          orderId: 100,
          productId: 1,
          variantId: 10,
          changeType: 'sale',
        }),
      ]),
      expect.any(Object),
    );
  });
});

// ─── Line 477: getAllOrders — parseInt(limit) falsy → fallback 20 ─────────────

describe('getAllOrders — limit NaN fallback về 20 (line 477)', () => {
  it('dùng limit = 20 khi truyền limit = "abc" (không phải số)', async () => {
    // Line 477: parseInt('abc', 10) = NaN → falsy → || 20
    const { service, repo } = buildService();
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    const result = await service.getAllOrders({ page: 1, limit: 'abc' });

    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
    expect(result.limit).toBe(20);
  });

  it('cap limit về 100 khi truyền limit = 200', async () => {
    // Line 477: Math.min(200, 100) = 100
    const { service, repo } = buildService();
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });

    const result = await service.getAllOrders({ page: 1, limit: 200 });

    expect(result.limit).toBe(100);
  });
});

// ─── Line 510: updateOrderStatus — user null khi trao điểm ───────────────────

describe('updateOrderStatus — user không tồn tại khi trao loyalty points (line 510)', () => {
  it('không gọi updateUserPoints khi findUserById trả null', async () => {
    // Line 510: if (user) → false → bỏ qua update points
    const { service, repo, eventBus } = buildService();

    const order = {
      id: 1,
      number: 'ORD-999',
      status: 'shipped',
      paymentMethod: 'bank_transfer',
      subtotal: 2000000, // > POINTS_EARN_RATE → pointsEarned > 0
      userId: 42,
      total: 2000000,
      user: null,
      pointsEarned: 0,
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue(null); // user không tồn tại

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(repo.updateUserPoints).not.toHaveBeenCalled();
    expect(repo.createLoyaltyHistory).not.toHaveBeenCalled();
    // eventBus.publish vẫn phải được gọi sau block if(user) — nằm ngoài block đó
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.delivered' }),
    );
  });
});

// ─── Line 510: updateOrderStatus — pointsEarned = 0 (không trao điểm) ────────

describe('updateOrderStatus — pointsEarned = 0 → không trao điểm', () => {
  it('không gọi findUserById khi subtotal thấp (pointsEarned = 0)', async () => {
    // Line 508: pointsEarned = Math.floor(100 / 1000) = 0 → if(0) false
    const { service, repo } = buildService();

    const order = {
      id: 1,
      number: 'ORD-LOW',
      status: 'shipped',
      paymentMethod: 'cod',
      subtotal: 100, // 100 / 1000 = 0.1 → Math.floor = 0
      userId: 1,
      total: 130,
      user: null,
      pointsEarned: 0,
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);

    await service.updateOrderStatus({ id: 1, status: 'delivered' });

    expect(repo.findUserById).not.toHaveBeenCalled();
    expect(repo.updateUserPoints).not.toHaveBeenCalled();
  });
});

// ─── Line 578: confirmReceived — canEarnPoints() = false ─────────────────────

describe('confirmReceived — canEarnPoints() = false (line 578 false branch)', () => {
  it('không trao điểm khi pointsEarned đã được set → canEarnPoints() false', async () => {
    // Scenario: order status='shipped' (alreadyProcessed=false), nhưng pointsEarned=50
    // Flow: alreadyProcessed=false → update status→delivered → reload
    //       → canEarnPoints() check: (50 || 0) === 0 → FALSE → không trao thêm điểm
    // Khác với alreadyProcessed=true (đã delivered, đã trao điểm → return sớm)
    const { service, repo, eventBus } = buildService();

    const order = {
      id: 1,
      number: 'ORD-ALREADY',
      status: 'shipped',
      paymentMethod: 'bank_transfer',
      subtotal: 5000000,
      userId: 1,
      total: 5000000,
      pointsEarned: 50, // canEarnPoints() = (50 || 0) === 0 → false → không trao thêm
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);

    const result = await service.confirmReceived({ id: 1, userId: 1 });

    // alreadyProcessed=false → saveOrder được gọi để update status→delivered
    expect(repo.saveOrder).toHaveBeenCalled();
    // canEarnPoints()=false → không query user hay update điểm
    expect(repo.findUserById).not.toHaveBeenCalled();
    expect(repo.updateUserPoints).not.toHaveBeenCalled();
    // eventBus.publish vẫn được gọi (nằm ngoài canEarnPoints block)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'order.delivered' }),
    );
    expect(result.pointsEarned).toBe(0);
  });
});

// ─── Line 584: confirmReceived — findUserById trả null ──────────────────────

describe('confirmReceived — user null khi trao điểm (line 584 false branch)', () => {
  it('không gọi updateUserPoints khi findUserById trả null', async () => {
    // Line 584: if (user) → false → bỏ qua block trao điểm
    const { service, repo } = buildService();

    const order = {
      id: 1,
      number: 'ORD-NULL-USER',
      status: 'shipped',
      paymentMethod: 'bank_transfer',
      subtotal: 5000000,
      userId: 99,
      total: 5000000,
      pointsEarned: 0, // canEarnPoints() = true
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    repo.findUserById.mockResolvedValue(null); // user không tồn tại

    const result = await service.confirmReceived({ id: 1, userId: 99 });

    // Points không được cộng vào user (user null)
    expect(repo.updateUserPoints).not.toHaveBeenCalled();
    expect(repo.createLoyaltyHistory).not.toHaveBeenCalled();
    // newPointsAwarded vẫn được tính nhưng không lưu → pointsEarned trả về số đã tính
    // (service trả newPointsAwarded > 0 ? newPointsAwarded : 0 dù user null)
    expect(result.pointsEarned).toBe(5000); // Math.floor(5000000 / 1000) = 5000
  });
});

// ─── confirmReceived — orderTotal > 0 nhưng newPointsAwarded = 0 (line 594) ──

describe('confirmReceived — newPointsAwarded = 0 nhưng orderTotal > 0 (line 594)', () => {
  it('set pointsEarned = -1 khi không đủ điểm nhưng đơn hàng có giá trị', async () => {
    // Line 594: else if (orderTotal > 0) → pointsEarned = -1
    // orderTotal = 500 → Math.floor(500/1000) = 0 → newPointsAwarded = 0
    // orderTotal > 0 → earnedPointsTotal = -1
    const { service, repo } = buildService();

    const order = {
      id: 1,
      number: 'ORD-SMALL',
      status: 'shipped',
      paymentMethod: 'bank_transfer',
      subtotal: 500, // 500 / 1000 = 0 points, nhưng > 0
      userId: 1,
      total: 530,
      pointsEarned: 0, // canEarnPoints() = true
      reload: jest.fn().mockResolvedValue(),
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    // findUserById không được gọi vì newPointsAwarded = 0

    const result = await service.confirmReceived({ id: 1, userId: 1 });

    // earnedPointsTotal = -1 → setPointsEarned(-1) → saveOrder gọi
    expect(repo.saveOrder).toHaveBeenCalled();
    expect(result.data.pointsEarned).toBe(-1);
    expect(result.pointsEarned).toBe(0); // newPointsAwarded = 0
  });
});

// ─── createOrder — cart flow: guestItem đã có trong userCart (merge) ──────────

describe('createOrder — cart flow: guestItem trùng existing → cộng dồn quantity (line 105)', () => {
  it('cộng dồn quantity của existing item khi guestItem trùng', async () => {
    const { service, repo } = buildService();

    const product = mkProduct();
    const guestItem = { productId: 1, variantId: null, quantity: 2 };
    const existing = { quantity: 3 };

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findActiveCartBySessionId.mockResolvedValue({
      id: 99,
      items: [guestItem],
      status: 'active',
    });
    repo.findCartItemMatching.mockResolvedValue(existing);

    const detailedCart = {
      id: 5,
      items: [
        {
          productId: 1,
          variantId: null,
          quantity: 5,
          Product: product,
          ProductVariant: null,
          warrantyPackageIds: [],
        },
      ],
    };
    repo.findCartByPkWithItemsDetails.mockResolvedValue(detailedCart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });

    const createdOrder = {
      id: 1,
      number: 'ORD-MERGE',
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
      quantity: 5,
      unitPrice: 100000,
      subtotal: 500000,
    };
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue(createdItem);

    const user = { id: 1, email: 'user@test.com' };
    const body = mkOrderBody({ items: undefined });

    await service.createOrder({ user, body, sessionIdCookie: 'sess-guest' });

    // existing.quantity cộng guestItem.quantity
    expect(existing.quantity).toBe(5);
    expect(repo.saveCartItem).toHaveBeenCalledWith(existing, expect.any(Object));
    expect(repo.deleteCartItem).toHaveBeenCalledWith(guestItem, expect.any(Object));
  });
});
