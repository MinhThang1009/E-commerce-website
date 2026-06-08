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

    test('variant đã soft-delete → log warn, bỏ qua restore stock', async () => {
      const order = {
        id: 2,
        status: 'pending',
        userId: 1,
        number: 'ORD-2',
        items: [{ productId: 10, variantId: 5, quantity: 2, ProductVariant: null, Product: null }],
      };
      repo.findOrderForCancel.mockResolvedValue(order);

      await service.cancelOrder({ id: 2, userId: 1 });

      expect(order.status).toBe('cancelled');
      expect(repo.restoreVariantStock).not.toHaveBeenCalled();
      expect(service.logger.warn).toHaveBeenCalledWith(
        'Variant soft-deleted, bỏ qua restore stock',
        expect.objectContaining({ variantId: 5 }),
      );
    });

    test('đơn COD có mã giảm giá → decrement usedCount khi hủy', async () => {
      const discount = { id: 10, code: 'SUMMER2026' };
      const order = {
        id: 3,
        status: 'pending',
        userId: 1,
        number: 'ORD-3',
        paymentMethod: 'cod',
        appliedDiscount: discount,
        items: [{ productId: 10, variantId: null, quantity: 1, Product: { id: 10 } }],
      };
      repo.findOrderForCancel.mockResolvedValue(order);
      repo.decrementDiscountCodeUsage = jest.fn().mockResolvedValue();

      await service.cancelOrder({ id: 3, userId: 1 });

      expect(repo.decrementDiscountCodeUsage).toHaveBeenCalledWith(discount, expect.any(Object));
    });

    test('đơn MoMo có mã giảm giá → KHÔNG decrement usedCount (online chưa increment)', async () => {
      const discount = { id: 10, code: 'SUMMER2026' };
      const order = {
        id: 4,
        status: 'pending',
        userId: 1,
        number: 'ORD-4',
        paymentMethod: 'momo',
        appliedDiscount: discount,
        items: [],
      };
      repo.findOrderForCancel.mockResolvedValue(order);
      repo.decrementDiscountCodeUsage = jest.fn().mockResolvedValue();

      await service.cancelOrder({ id: 4, userId: 1 });

      expect(repo.decrementDiscountCodeUsage).not.toHaveBeenCalled();
    });
  });

  describe('repayOrder', () => {
    test('thiếu originUrl → 400', async () => {
      await expect(service.repayOrder({ id: 1, userId: 1, originUrl: '' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('không tồn tại → 404', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.repayOrder({ id: 99, userId: 1, originUrl: 'http://shop' }),
      ).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('shipped → DomainError', async () => {
      repo.findOrderByIdAndUserId.mockResolvedValue({ status: 'shipped', paymentStatus: 'paid' });
      await expect(
        service.repayOrder({ id: 1, userId: 1, originUrl: 'http://x' }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('pending + online (momo) chưa trả tiền → cho phép repay, trả paymentUrl', async () => {
      // Case repay hợp lệ: đơn online đang chờ thanh toán (payment fail/bỏ dở), kho vẫn đang giữ.
      const order = {
        id: 5,
        number: 'ORD-PAY',
        status: 'pending',
        paymentStatus: 'failed',
        paymentMethod: 'momo',
        total: 1000,
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);

      const result = await service.repayOrder({ id: 5, userId: 1, originUrl: 'http://shop' });

      expect(order.status).toBe('pending'); // repay KHÔNG đổi status
      expect(order.paymentStatus).toBe('pending'); // reset failed → pending để retry
      expect(result.paymentUrl).toBe('http://shop/checkout?repayOrder=5&amount=1000');
    });

    test('cancelled → 422 (đơn đã hủy là terminal, không repay)', async () => {
      const order = {
        id: 7,
        number: 'ORD-X',
        status: 'cancelled',
        paymentStatus: 'pending',
        paymentMethod: 'vnpay',
        total: 500000,
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);
      await expect(
        service.repayOrder({ id: 7, userId: 1, originUrl: 'http://shop' }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    test('COD pending → 422 (COD trả khi nhận, không có cổng thanh toán online)', async () => {
      const order = {
        id: 8,
        number: 'ORD-COD',
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: 'cod',
        total: 200000,
      };
      repo.findOrderByIdAndUserId.mockResolvedValue(order);
      await expect(
        service.repayOrder({ id: 8, userId: 1, originUrl: 'http://shop' }),
      ).rejects.toMatchObject({ statusCode: 422 });
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
      expect(repo.saveOrder).toHaveBeenCalledWith(order, expect.any(Object));
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

    // Line 458 branch[0]: order không có toJSON → dùng spread { ...order }
    test('order không có method toJSON → vẫn trả dữ liệu đúng qua spread', async () => {
      // Plain object (không phải Sequelize instance) → không có toJSON
      const order = { id: 7, userId: 1, items: null };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 7, userId: 1, role: 'customer' });
      expect(result).toMatchObject({ id: 7, userId: 1 });
    });

    // Line 459 branch[0]: o.items là falsy → bỏ qua map items
    test('order có toJSON nhưng items là null → không map items', async () => {
      const order = {
        id: 8,
        userId: 1,
        items: null,
        toJSON: jest.fn().mockReturnValue({ id: 8, userId: 1, items: null }),
      };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 8, userId: 1, role: 'customer' });
      expect(result.items).toBeNull();
    });

    // B62[0] line 459: o.items là truthy → enter if block
    test('order có items với productImages → thumbnail và images được map đúng', async () => {
      const order = {
        id: 9,
        userId: 1,
        items: [
          {
            Product: {
              productImages: [
                { imageUrl: 'http://img/thumb.jpg', isThumbnail: true },
                { imageUrl: 'http://img/extra.jpg', isThumbnail: false },
              ],
            },
          },
        ],
      };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 9, userId: 1, role: 'customer' });
      expect(result.items[0].Product.thumbnail).toBe('http://img/thumb.jpg');
      expect(result.items[0].Product.images).toEqual([
        'http://img/thumb.jpg',
        'http://img/extra.jpg',
      ]);
      expect(result.items[0].Product.productImages).toBeUndefined();
    });

    test('item.Product không có productImages → giữ nguyên, không lỗi', async () => {
      const order = {
        id: 11,
        userId: 1,
        items: [{ Product: { name: 'Test' } }],
      };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 11, userId: 1, role: 'customer' });
      expect(result.items[0].Product.name).toBe('Test');
      expect(result.items[0].Product.thumbnail).toBeUndefined();
    });

    test('item.Product là null → giữ nguyên, không lỗi', async () => {
      const order = {
        id: 12,
        userId: 1,
        items: [{ Product: null }],
      };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 12, userId: 1, role: 'customer' });
      expect(result.items[0].Product).toBeNull();
    });

    test('productImages không có ảnh thumbnail → dùng ảnh đầu tiên làm thumbnail', async () => {
      const order = {
        id: 10,
        userId: 1,
        items: [
          {
            Product: {
              productImages: [
                { imageUrl: 'http://img/first.jpg', isThumbnail: false },
                { imageUrl: 'http://img/second.jpg', isThumbnail: false },
              ],
            },
          },
        ],
      };
      repo.findOrderByPkWithItemsAndUser.mockResolvedValue(order);
      const result = await service.getOrderById({ id: 10, userId: 1, role: 'customer' });
      expect(result.items[0].Product.thumbnail).toBe('http://img/first.jpg');
    });
  });

  describe('getUserOrders', () => {
    // Line 428 branch[1]: parseFloat(item.unitPrice) trả về NaN → fallback về 0
    test('item.unitPrice không parse được thành số → price = 0', async () => {
      const row = {
        toJSON: jest.fn().mockReturnValue({
          items: [
            {
              unitPrice: 'invalid',
              // price chưa có → trigger nhánh unitPrice !== undefined && price === undefined
            },
          ],
        }),
      };
      repo.findUserOrdersWithItems.mockResolvedValue({ count: 1, rows: [row] });
      const result = await service.getUserOrders({ userId: 1 });
      expect(result.data[0].items[0].price).toBe(0);
    });
  });

  describe('createOrder — nhánh giá fallback và product-only', () => {
    const baseBody = {
      shippingFirstName: 'A',
      shippingLastName: 'B',
      shippingAddress1: '123',
      shippingCity: 'HN',
      shippingZip: '100000',
      shippingCountry: 'VN',
      shippingPhone: '0909',
      paymentMethod: 'cod',
      items: [],
    };

    function setupCreateOrderMocks(items) {
      const cart = { id: 1, items, status: 'active' };
      repo.findOrCreateActiveCart.mockResolvedValue([cart]);
      repo.findActiveCartsByUser.mockResolvedValue([]);
      repo.findCartByPkWithItemsDetails.mockResolvedValue(cart);
      repo.cancelPendingOrdersByUser.mockResolvedValue(0);
      const order = {
        id: 100,
        number: 'ORD-TEST',
        userId: 1,
        createdAt: new Date(),
        total: 0,
        shippingFirstName: 'A',
        shippingLastName: 'B',
        shippingAddress1: '123',
        shippingAddress2: '',
        shippingCity: 'HN',
        shippingState: '',
        shippingZip: '100000',
        shippingCountry: 'VN',
      };
      repo.createOrder.mockResolvedValue(order);
      repo.createOrderItem.mockImplementation(async (data) => ({ ...data }));
      repo.findUserById.mockResolvedValue({ id: 1, email: 'u@x.y' });
      return order;
    }

    test('product-only (no variant) → giá từ lockedProduct.basePrice', async () => {
      const product = {
        id: 10,
        name: 'Test',
        status: 'active',
        basePrice: 5000000,
        stockQuantity: 10,
      };
      const items = [
        { productId: 10, variantId: null, quantity: 1, Product: product, ProductVariant: null },
      ];
      setupCreateOrderMocks(items);
      repo.lockProduct.mockResolvedValue({ ...product });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      expect(repo.decrementProductStock).toHaveBeenCalled();
      expect(repo.restoreProductStock).not.toHaveBeenCalled();
    });

    test('variant có _lockedPrice null → fallback variant.price', async () => {
      const product = { id: 10, name: 'Test', status: 'active', basePrice: 5000000 };
      const variant = { id: 5, price: 6000000, stockQuantity: 10, sku: 'SKU1', name: 'V1' };
      const items = [
        { productId: 10, variantId: 5, quantity: 1, Product: product, ProductVariant: variant },
      ];
      setupCreateOrderMocks(items);
      repo.lockVariant.mockResolvedValue({ ...variant });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.unitPrice).toBe(6000000);
    });

    test('lockedVariant.price null → fallback preVariant.price (dòng 238 nhánh 2)', async () => {
      const product = { id: 10, name: 'Test', status: 'active', basePrice: 1000000 };
      const preVariant = { id: 5, price: 7000000, stockQuantity: 10, sku: 'SKU1', name: 'V1' };
      const items = [
        { productId: 10, variantId: 5, quantity: 1, Product: product, ProductVariant: preVariant },
      ];
      setupCreateOrderMocks(items);
      repo.lockVariant.mockResolvedValue({ id: 5, price: null, stockQuantity: 10, sku: 'SKU1' });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.unitPrice).toBe(7000000);
    });

    test('cả lockedVariant.price và preVariant.price null → fallback product.basePrice (dòng 238 nhánh 3)', async () => {
      const product = { id: 10, name: 'Test', status: 'active', basePrice: 3000000 };
      const preVariant = { id: 5, price: null, stockQuantity: 10, sku: 'SKU1', name: 'V1' };
      const items = [
        { productId: 10, variantId: 5, quantity: 1, Product: product, ProductVariant: preVariant },
      ];
      setupCreateOrderMocks(items);
      repo.lockVariant.mockResolvedValue({ id: 5, price: null, stockQuantity: 10, sku: 'SKU1' });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.unitPrice).toBe(3000000);
    });

    test('_lockedPrice null + variant null → dùng product.basePrice (dòng 348)', async () => {
      const product = {
        id: 10,
        name: 'Test',
        status: 'active',
        basePrice: 4000000,
        stockQuantity: 10,
      };
      const items = [
        {
          productId: 10,
          variantId: null,
          quantity: 1,
          Product: product,
          ProductVariant: null,
          _lockedPrice: undefined,
        },
      ];
      setupCreateOrderMocks(items);
      repo.lockProduct.mockResolvedValue({ ...product });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.unitPrice).toBe(4000000);
    });

    test('basePrice null cả locked lẫn pre-tx → _lockedPrice=null → L348 ?? fallback fires (product-only)', async () => {
      const product = {
        id: 10,
        name: 'Test',
        status: 'active',
        basePrice: null,
        stockQuantity: 10,
        productImages: [],
      };
      const items = [
        { productId: 10, variantId: null, quantity: 1, Product: product, ProductVariant: null },
      ];
      setupCreateOrderMocks(items);
      repo.lockProduct.mockResolvedValue({ basePrice: null, stockQuantity: 10, status: 'active' });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.unitPrice).toBeNull();
    });

    test('basePrice null + variant có nhưng price cũng null → L348 ?? fallback variant branch', async () => {
      const product = { id: 10, name: 'Test', status: 'active', basePrice: null };
      const preVariant = { id: 5, price: null, stockQuantity: 10, sku: 'SKU1', name: 'V1' };
      const items = [
        { productId: 10, variantId: 5, quantity: 1, Product: product, ProductVariant: preVariant },
      ];
      setupCreateOrderMocks(items);
      repo.lockVariant.mockResolvedValue({ id: 5, price: null, stockQuantity: 10, sku: 'SKU1' });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.unitPrice).toBeNull();
    });

    test('productImages không có isThumbnail → dùng ảnh đầu tiên (dòng 504 nhánh 2)', async () => {
      const product = {
        id: 10,
        name: 'Test',
        status: 'active',
        basePrice: 5000000,
        stockQuantity: 10,
        productImages: [{ imageUrl: 'http://img/first.jpg', isThumbnail: false }],
      };
      const items = [
        { productId: 10, variantId: null, quantity: 1, Product: product, ProductVariant: null },
      ];
      setupCreateOrderMocks(items);
      repo.lockProduct.mockResolvedValue({ ...product });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.image).toBe('http://img/first.jpg');
    });

    test('productImages rỗng → image = null trong orderItem', async () => {
      const product = {
        id: 10,
        name: 'Test',
        status: 'active',
        basePrice: 5000000,
        stockQuantity: 10,
        productImages: [],
      };
      const items = [
        { productId: 10, variantId: null, quantity: 1, Product: product, ProductVariant: null },
      ];
      setupCreateOrderMocks(items);
      repo.lockProduct.mockResolvedValue({ ...product });

      await service.createOrder({ user: { id: 1 }, body: baseBody });

      const itemArg = repo.createOrderItem.mock.calls[0][0];
      expect(itemArg.image).toBeNull();
    });
  });

  describe('repayOrder — reload null sau transaction', () => {
    test('reload trả null sau transaction → 404', async () => {
      const order = {
        id: 5,
        status: 'pending',
        paymentStatus: 'failed',
        paymentMethod: 'momo',
        total: 1000,
      };
      repo.findOrderByIdAndUserId.mockResolvedValueOnce(order).mockResolvedValueOnce(null);

      await expect(
        service.repayOrder({ id: 5, userId: 1, originUrl: 'http://shop' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getAllOrders', () => {
    // Line 540 branch[1]: limit không parse được thành số → fallback về 20
    test('limit không hợp lệ (NaN) → pageLimit mặc định 20', async () => {
      repo.findAllOrdersWithUser.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllOrders({ page: 1, limit: 'abc' });
      const callArgs = repo.findAllOrdersWithUser.mock.calls[0][0];
      expect(callArgs.limit).toBe(20);
    });
  });

  describe('_buildTrackingSteps — completed state chính xác theo từng trạng thái', () => {
    const buildOrder = (status) => ({
      id: 1,
      userId: 1,
      status,
      orderNumber: 'ORD-1',
      total: 100000,
      createdAt: new Date(),
      updatedAt: new Date(),
      User: { email: 'u@x.y' },
    });

    test('status=pending → chỉ step[0] completed=true, còn lại false', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue(buildOrder('pending'));
      const result = await service.trackOrder({ orderNumber: 'ORD-1', email: 'u@x.y' });
      expect(result.steps[0]).toMatchObject({ key: 'pending', completed: true });
      expect(result.steps[1]).toMatchObject({ key: 'processing', completed: false });
      expect(result.steps[2]).toMatchObject({ key: 'shipped', completed: false });
      expect(result.steps[3]).toMatchObject({ key: 'delivered', completed: false });
    });

    test('status=processing → step[0] và step[1] completed=true', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue(buildOrder('processing'));
      const result = await service.trackOrder({ orderNumber: 'ORD-1', email: 'u@x.y' });
      expect(result.steps[0]).toMatchObject({ key: 'pending', completed: true });
      expect(result.steps[1]).toMatchObject({ key: 'processing', completed: true });
      expect(result.steps[2]).toMatchObject({ key: 'shipped', completed: false });
      expect(result.steps[3]).toMatchObject({ key: 'delivered', completed: false });
    });

    test('status=shipped → step[0..2] completed=true, step[3] false', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue(buildOrder('shipped'));
      const result = await service.trackOrder({ orderNumber: 'ORD-1', email: 'u@x.y' });
      expect(result.steps[0]).toMatchObject({ key: 'pending', completed: true });
      expect(result.steps[1]).toMatchObject({ key: 'processing', completed: true });
      expect(result.steps[2]).toMatchObject({ key: 'shipped', completed: true });
      expect(result.steps[3]).toMatchObject({ key: 'delivered', completed: false });
    });

    test('status=delivered → tất cả 4 steps completed=true', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue(buildOrder('delivered'));
      const result = await service.trackOrder({ orderNumber: 'ORD-1', email: 'u@x.y' });
      result.steps.forEach((step) => expect(step.completed).toBe(true));
    });

    test('status=cancelled → step[0] completed=false (không phải status bình thường)', async () => {
      repo.findOrderByNumberWithUserEmail.mockResolvedValue(buildOrder('cancelled'));
      const result = await service.trackOrder({ orderNumber: 'ORD-1', email: 'u@x.y' });
      expect(result.steps[0]).toMatchObject({ key: 'pending', completed: false });
      expect(result.steps[1]).toMatchObject({ key: 'processing', completed: false });
    });
  });
});
