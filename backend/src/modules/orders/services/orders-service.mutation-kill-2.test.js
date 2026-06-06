/**
 * Mutation-kill tests bổ sung cho OrdersService — Round 2
 * Nhắm vào survivors còn lại sau round 1:
 * - Error message strings (productNotFound, variantNotFound, cartNotFound, cartEmpty, cannotCancelDelivered...)
 * - Cart flow (guestCart merge, cartId assignment, saveCart, deleteCartItem)
 * - updateOrderStatus complex branches
 * - cancelOrder event.payload và email args
 * - getUserOrders advanced branch (isThumbnail arrow function, optionalChaining)
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
    shippingAddress1: '123',
    shippingAddress2: null,
    shippingCity: 'HCM',
    shippingState: '',
    shippingZip: '70000',
    shippingCountry: 'VN',
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── createOrder: buy-now flow error messages exact ──────────────────────────

describe('OrdersService › createOrder buy-now — exact error message strings', () => {
  it('product không tìm thấy → AppError message = "orders.productNotFound" + status 404', async () => {
    const { service, repo } = buildService();
    repo.findProductWithDefaultVariant.mockResolvedValue(null);
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 999, quantity: 1 }] });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.productNotFound',
      statusCode: 404,
    });
  });

  it('variant không tìm thấy → AppError message = "orders.variantNotFound" + status 404', async () => {
    const { service, repo } = buildService();
    repo.findProductWithDefaultVariant.mockResolvedValue(mkProduct());
    repo.findVariantBasic.mockResolvedValue(null);
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 999, quantity: 1 }] });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.variantNotFound',
      statusCode: 404,
    });
  });
});

// ─── createOrder: cart flow error messages ────────────────────────────────────

describe('OrdersService › createOrder cart flow — exact error messages', () => {
  it('cart không tìm thấy sau findCartByPkWithItemsDetails null → orders.cartNotFound 400', async () => {
    const { service, repo } = buildService();
    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findCartByPkWithItemsDetails.mockResolvedValue(null);
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null }); // cart flow (không có providedItems)
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.cartNotFound',
      statusCode: 400,
    });
  });

  it('cart rỗng → AppError message = "orders.cartEmpty" + status 400', async () => {
    const { service, repo } = buildService();
    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findCartByPkWithItemsDetails.mockResolvedValue({ id: 5, items: [] });
    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await expect(service.createOrder({ user, body, sessionIdCookie: null })).rejects.toMatchObject({
      message: 'orders.cartEmpty',
      statusCode: 400,
    });
  });

  it('cart flow: cancelPendingOrdersByUser được gọi trước decrement stock', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
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
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.cancelPendingOrdersByUser).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });
});

// ─── createOrder: cart flow guestCart merge ───────────────────────────────────

describe('OrdersService › createOrder — guestCart merge logic', () => {
  it('guestCart có items → logger.info được gọi với cartId thông tin', async () => {
    const { service, repo, logger } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const guestItem = { id: 20, productId: 1, variantId: null, quantity: 2, cartId: 99 };
    const guestCart = { id: 99, items: [guestItem], status: 'active' };
    const userCart = { id: 5, items: [] };

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    repo.findCartItemMatching.mockResolvedValue(null); // không có matching item
    const mergedCart = {
      id: 5,
      items: [
        {
          productId: 1,
          variantId: null,
          quantity: 2,
          Product: product,
          ProductVariant: null,
        },
      ],
    };
    repo.findCartByPkWithItemsDetails.mockResolvedValue(mergedCart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await service.createOrder({ user, body, sessionIdCookie: 'session-abc' });

    // logger.info được gọi với thông tin merge
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Gộp'));
    // guestCart.status = 'merged'
    expect(guestCart.status).toBe('merged');
    expect(repo.saveCart).toHaveBeenCalledWith(guestCart, expect.anything());
  });

  it('guestCart có items matching → merge quantity và deleteCartItem guestItem', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 10 });
    const guestItem = { id: 20, productId: 1, variantId: null, quantity: 3, cartId: 99 };
    const existingItem = { id: 5, productId: 1, variantId: null, quantity: 2, cartId: 5 };
    const guestCart = { id: 99, items: [guestItem], status: 'active' };

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    repo.findCartItemMatching.mockResolvedValue(existingItem); // matching item exists
    const mergedCart = {
      id: 5,
      items: [
        {
          productId: 1,
          variantId: null,
          quantity: 5,
          Product: product,
          ProductVariant: null,
        },
      ],
    };
    repo.findCartByPkWithItemsDetails.mockResolvedValue(mergedCart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 10 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await service.createOrder({ user, body, sessionIdCookie: 'session-xyz' });

    // existing.quantity = 2 + 3 = 5
    expect(existingItem.quantity).toBe(5);
    expect(repo.saveCartItem).toHaveBeenCalledWith(existingItem, expect.anything());
    expect(repo.deleteCartItem).toHaveBeenCalledWith(guestItem, expect.anything());
  });

  it('guestCart không có matching item → guestItem.cartId set về cart.id và saveCartItem', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const guestItem = { id: 20, productId: 1, variantId: null, quantity: 1, cartId: 99 };
    const guestCart = { id: 99, items: [guestItem], status: 'active' };

    repo.findOrCreateActiveCart.mockResolvedValue({ id: 5 });
    repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    repo.findCartItemMatching.mockResolvedValue(null);
    const mergedCart = {
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
    repo.findCartByPkWithItemsDetails.mockResolvedValue(mergedCart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await service.createOrder({ user, body, sessionIdCookie: 'session-xyz' });

    // guestItem.cartId được set về 5 (cart của user)
    expect(guestItem.cartId).toBe(5);
    expect(repo.saveCartItem).toHaveBeenCalledWith(guestItem, expect.anything());
  });

  it('sessionIdCookie null → không gọi findActiveCartBySessionId', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
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
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await service.createOrder({ user, body, sessionIdCookie: null });
    expect(repo.findActiveCartBySessionId).not.toHaveBeenCalled();
  });

  it('guestCart tồn tại nhưng items = [] → bỏ qua merge', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const guestCart = { id: 99, items: [], status: 'active' };
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
    repo.findActiveCartBySessionId.mockResolvedValue(guestCart);
    repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: null });
    await service.createOrder({ user, body, sessionIdCookie: 'sess' });
    // guestCart không có items → saveCart không được gọi cho guestCart
    expect(guestCart.status).toBe('active'); // không thay đổi
  });
});

// ─── createOrder: createInventoryLogs nhận orderId ───────────────────────────

describe('OrdersService › createOrder — createInventoryLogs.orderId', () => {
  it('inventoryLogs nhận orderId từ createdOrder.id', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    const createdOrder = mkCreatedOrder({ id: 77 });
    repo.createOrder.mockResolvedValue(createdOrder);
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 2 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    const logs = repo.createInventoryLogs.mock.calls[0][0];
    expect(logs[0]).toMatchObject({ orderId: 77 });
  });
});

// ─── createOrder: createOrder nhận notes, paymentMethod, discountCodeId ──────

describe('OrdersService › createOrder — createOrder nhận đúng tất cả fields', () => {
  it('createOrder nhận notes từ body', async () => {
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
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }], notes: 'Giao buổi sáng' });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Giao buổi sáng' }),
      expect.anything(),
    );
  });

  it('createOrder nhận paymentMethod từ body', async () => {
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
      paymentMethod: 'bank_transfer',
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentMethod: 'bank_transfer' }),
      expect.anything(),
    );
  });

  it('createOrder nhận discountCodeId khi có discount code', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 500000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.findActiveDiscountCode.mockResolvedValue({
      id: 33,
      code: 'OFF10',
      type: 'percent',
      value: '10',
      startDate: null,
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
      discountCode: 'OFF10',
      paymentMethod: 'cod',
    });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ discountCodeId: 33 }),
      expect.anything(),
    );
  });

  it('createOrder: discountCodeId = null khi không có discount code', async () => {
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
      expect.objectContaining({ discountCodeId: null }),
      expect.anything(),
    );
  });
});

// ─── createOrder: createOrderItem has attributes field ───────────────────────

describe('OrdersService › createOrder — createOrderItem attributes', () => {
  it('không có variant → attributes = {} (empty)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder({ id: 1 }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: {} }),
      expect.anything(),
    );
  });

  it('có variant → attributes = { variant: variant.name }', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    const variant = mkVariant({ name: 'Đỏ / L', price: 120000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.findVariantBasic.mockResolvedValue(variant);
    repo.lockVariant.mockResolvedValue({ ...variant, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder({ id: 1 }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, variantId: 10, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: { variant: 'Đỏ / L' } }),
      expect.anything(),
    );
  });

  it('createOrderItem nhận image từ productImages (isThumbnail hoặc first)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({
      basePrice: 100000,
      stockQuantity: 5,
      productImages: [{ imageUrl: 'thumb.png', isThumbnail: true }],
    });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder({ id: 1 }));
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 1, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.createOrderItem).toHaveBeenCalledWith(
      expect.objectContaining({ image: 'thumb.png' }),
      expect.anything(),
    );
  });
});

// ─── createOrder: cancelPendingOrdersByUser args ──────────────────────────────

describe('OrdersService › createOrder — cancelPendingOrdersByUser được gọi với userId', () => {
  it('cancelPendingOrdersByUser nhận userId đúng', async () => {
    const { service, repo } = buildService();
    const product = mkProduct({ basePrice: 100000, stockQuantity: 5 });
    repo.findProductWithDefaultVariant.mockResolvedValue(product);
    repo.lockProduct.mockResolvedValue({ ...product, stockQuantity: 5 });
    repo.createOrder.mockResolvedValue(mkCreatedOrder());
    repo.createOrderItem.mockResolvedValue({ id: 1 });

    const user = { id: 42, email: 'u@a.com' };
    const body = mkOrderBody({ items: [{ productId: 1, quantity: 1 }] });
    await service.createOrder({ user, body, sessionIdCookie: null });

    expect(repo.cancelPendingOrdersByUser).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });
});

// ─── updateOrderStatus: exact error messages ─────────────────────────────────

describe('OrdersService › updateOrderStatus — exact error messages', () => {
  it('orders.notFound khi không tìm thấy đơn hàng', async () => {
    const { service, repo } = buildService();
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(null);
    await expect(service.updateOrderStatus({ id: 999 })).rejects.toMatchObject({
      message: 'orders.notFound',
      statusCode: 404,
    });
  });

  it('orders.cannotCancelDelivered khi hủy đơn delivered', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      status: 'delivered',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await expect(service.updateOrderStatus({ id: 1, status: 'cancelled' })).rejects.toMatchObject({
      message: 'orders.cannotCancelDelivered',
      statusCode: 400,
    });
  });

  it('orders.cannotChangeCancelled khi đổi status từ cancelled', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      status: 'cancelled',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await expect(service.updateOrderStatus({ id: 1, status: 'processing' })).rejects.toMatchObject({
      message: 'orders.cannotChangeCancelled',
      statusCode: 422,
    });
  });
});

// ─── updateOrderStatus: các điều kiện phức tạp (L590-L616) ──────────────────

describe('OrdersService › updateOrderStatus — điều kiện chuyển trạng thái', () => {
  it('cancelled + status=cancelled (re-cancel) → KHÔNG throw (previousStatus===cancelled → cannotChange raise vì status!==cancelled? No)', async () => {
    // status=cancelled và previousStatus=cancelled:
    // L590: status===cancelled && prev===delivered → false (prev=cancelled, không phải delivered)
    // L595: status!==cancelled (false) && prev===cancelled → false (status===cancelled nên !==cancelled = false)
    // → không throw, nhưng publishCancelled = (cancelled && prev!==cancelled) = false
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'cancelled',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    // Update status=cancelled trên đơn đã cancelled → không throw (không raise cannotChangeCancelled)
    await service.updateOrderStatus({ id: 1, status: 'cancelled' });
    // publishCancelled = false (prev===cancelled) → không publish
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('L601: status=undefined → order.status không thay đổi', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1 }); // status=undefined
    expect(order.status).toBe('pending'); // không thay đổi
  });

  it('L602: paymentStatus=undefined → order.paymentStatus không thay đổi', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'processing' }); // paymentStatus không truyền
    expect(order.paymentStatus).toBe('pending');
  });

  it('L602: paymentStatus=null (undefined khác null) → order.paymentStatus = null', async () => {
    // paymentStatus !== undefined (null !== undefined = true) → set paymentStatus = null
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'processing', paymentStatus: null });
    expect(order.paymentStatus).toBeNull();
  });

  it('hủy đơn pending → hoàn kho product (no variant)', async () => {
    const { service, repo } = buildService();
    const product = mkProduct();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [
        { productId: 1, variantId: null, quantity: 2, Product: product, ProductVariant: null },
      ],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'cancelled' });
    expect(repo.restoreProductStock).toHaveBeenCalledWith(
      product,
      2,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });

  it('hủy đơn processing → hoàn kho variant', async () => {
    const { service, repo } = buildService();
    const variant = { id: 5 };
    const order = {
      id: 1,
      number: 'ORD',
      status: 'processing',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [{ productId: 1, variantId: 5, quantity: 3, Product: {}, ProductVariant: variant }],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'cancelled' });
    expect(repo.restoreVariantStock).toHaveBeenCalledWith(
      variant,
      3,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });

  it('updateOrderStatus trả về { id, number, status }', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 5,
      number: 'ORD-RET',
      status: 'pending',
      paymentMethod: 'cod',
      createdAt: new Date(),
      user: null,
      items: [],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    const result = await service.updateOrderStatus({ id: 5, status: 'processing' });
    expect(result).toMatchObject({ id: 5, number: 'ORD-RET', status: 'processing' });
  });
});

// ─── cancelOrder: saveOrder trong transaction ─────────────────────────────────

describe('OrdersService › cancelOrder — saveOrder được gọi trong transaction', () => {
  it('saveOrder nhận order và transaction object', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD-SV',
      status: 'pending',
      userId: 1,
      items: [],
    };
    repo.findOrderForCancel.mockResolvedValue(order);
    await service.cancelOrder({ id: 1, userId: 1 });
    expect(repo.saveOrder).toHaveBeenCalledWith(
      order,
      expect.objectContaining({ transaction: expect.anything() }),
    );
  });
});

// ─── repayOrder: đơn hàng đủ điều kiện repay ─────────────────────────────────

describe('OrdersService › repayOrder — _canRepay logic', () => {
  it('vnpay pending → cho phép repay', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
      status: 'pending',
      paymentStatus: 'failed',
      paymentMethod: 'vnpay',
      total: 100000,
    };
    repo.findOrderByIdAndUserId.mockResolvedValue(order);
    const result = await service.repayOrder({ id: 1, userId: 1, originUrl: 'https://x.vn' });
    expect(result.paymentStatus).toBe('pending');
    expect(result.paymentUrl).toContain('repayOrder=1');
  });

  it('cod (manual, nhận khi giao) → throw 422 (không repay được cod)', async () => {
    const { service, repo } = buildService();
    const order = {
      id: 1,
      number: 'ORD',
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
});

// ─── getUserOrders: productImages[0] optional chaining ───────────────────────

describe('OrdersService › getUserOrders — productImages optional chaining', () => {
  it('productImages = [] → thumbnail = null (không có ảnh)', async () => {
    const { service, repo } = buildService();
    const row = {
      toJSON: () => ({
        id: 1,
        items: [
          {
            unitPrice: '100000',
            Product: { id: 1, productImages: [] },
          },
        ],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    // productImages rỗng → find không tìm được isThumbnail → [0] = undefined → null
    expect(result.data[0].items[0].Product.thumbnail).toBeNull();
  });

  it('productImages có ảnh isThumbnail=true → thumbnail đúng', async () => {
    const { service, repo } = buildService();
    const row = {
      toJSON: () => ({
        id: 1,
        items: [
          {
            unitPrice: '150000',
            Product: {
              id: 1,
              productImages: [
                { imageUrl: 'a.jpg', isThumbnail: false },
                { imageUrl: 'b.jpg', isThumbnail: true },
              ],
            },
          },
        ],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    expect(result.data[0].items[0].Product.thumbnail).toBe('b.jpg');
  });

  it('images array được tạo đúng từ productImages', async () => {
    const { service, repo } = buildService();
    const productImages = [
      { imageUrl: 'x.jpg', isThumbnail: false },
      { imageUrl: 'y.jpg', isThumbnail: true },
      { imageUrl: 'z.jpg', isThumbnail: false },
    ];
    const row = {
      toJSON: () => ({
        id: 1,
        items: [{ unitPrice: '100000', Product: { id: 1, productImages } }],
      }),
    };
    repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
    const result = await service.getUserOrders({ userId: 1 });
    expect(result.data[0].items[0].Product.images).toEqual(['x.jpg', 'y.jpg', 'z.jpg']);
  });
});

// ─── estimateShipping: subtotal = THRESHOLD (exact) ─────────────────────────

describe('OrdersService › estimateShipping — boundary cases', () => {
  it('subtotal = THRESHOLD (exactly 2000000) → shippingCost = 0', () => {
    const { service } = buildService();
    expect(service.estimateShipping({ subtotal: 2000000 }).shippingCost).toBe(0);
  });

  it('subtotal > THRESHOLD → shippingCost = 0', () => {
    const { service } = buildService();
    expect(service.estimateShipping({ subtotal: 3000000 }).shippingCost).toBe(0);
  });

  it('subtotal = THRESHOLD - 1 → shippingCost = null', () => {
    const { service } = buildService();
    expect(service.estimateShipping({ subtotal: 1999999 }).shippingCost).toBeNull();
  });
});

// ─── getAllOrders: page và offset tính đúng ───────────────────────────────────

describe('OrdersService › getAllOrders — pagination chính xác', () => {
  it('page=1, limit=10 → offset=0', async () => {
    const { service, repo } = buildService();
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });
    await service.getAllOrders({ page: 1, limit: 10 });
    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 10 }),
    );
  });

  it('page=3, limit=15 → offset=30', async () => {
    const { service, repo } = buildService();
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });
    await service.getAllOrders({ page: 3, limit: 15 });
    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 30, limit: 15 }),
    );
  });

  it('limit invalid string → fallback 20', async () => {
    const { service, repo } = buildService();
    repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });
    await service.getAllOrders({ page: 1, limit: 'abc' });
    expect(repo.findAllOrdersWithUser).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });
});

// ─── updateOrderStatus: publishCancelled payload items ───────────────────────

describe('OrdersService › updateOrderStatus — event payload items', () => {
  it('cancelOrder event có đúng items với productId, variantId, quantity', async () => {
    const { service, repo, eventBus } = buildService();
    const order = {
      id: 1,
      number: 'ORD-EV',
      status: 'pending',
      paymentMethod: 'cod',
      userId: 5,
      createdAt: new Date(),
      user: null,
      items: [
        { productId: 10, variantId: 3, quantity: 2, ProductVariant: { id: 3 }, Product: {} },
        {
          productId: 11,
          variantId: null,
          quantity: 1,
          Product: mkProduct({ id: 11 }),
          ProductVariant: null,
        },
      ],
    };
    repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
    await service.updateOrderStatus({ id: 1, status: 'cancelled' });

    const call = eventBus.publish.mock.calls[0][0];
    expect(call.type).toBe('order.cancelled');
    expect(call.payload.items).toEqual([
      { productId: 10, variantId: 3, quantity: 2 },
      { productId: 11, variantId: null, quantity: 1 },
    ]);
  });
});
