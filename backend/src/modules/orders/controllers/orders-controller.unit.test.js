/**
 * Unit tests cho OrdersController — kiểm tra từng handler riêng lẻ.
 *
 * Strategy: inject mock ordersService để kiểm tra controller logic thuần túy
 * — extract params, call service, format response.
 *
 * Handlers được test:
 *   createOrder, getUserOrders, getOrderById, getOrderByNumber, cancelOrder,
 *   getAllOrders, updateOrderStatus, repayOrder, confirmReceived,
 *   trackOrder (với các error branches đặc biệt), estimateShipping
 *
 * Behaviors đặc biệt:
 *   - trackOrder: 400/404 trả về plain shape thay vì dùng next()
 *   - repayOrder: lấy origin từ req.get('origin') hoặc FRONTEND_URL
 *   - confirmReceived: spread result.message, result.pointsEarned, result.data
 *   - estimateShipping: synchronous — không async
 */

process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'https://frontend.example.com';

const OrdersController = require('./orders-controller');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockOrdersService(overrides = {}) {
  return {
    createOrder: jest.fn(),
    getUserOrders: jest.fn(),
    getOrderById: jest.fn(),
    getOrderByNumber: jest.fn(),
    cancelOrder: jest.fn(),
    getAllOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
    repayOrder: jest.fn(),
    confirmReceived: jest.fn(),
    trackOrder: jest.fn(),
    estimateShipping: jest.fn(),
    ...overrides,
  };
}

function makeReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: { id: 10, email: 'user@test.com', role: 'customer' },
    get: jest.fn((header) => {
      if (overrides.originHeader && header === 'origin') return overrides.originHeader;
      return null;
    }),
    ...overrides,
  };
}

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  return res;
}

function makeNext() {
  return jest.fn();
}

// ─────────────────────────────────────────────────────────────────────────────
// createOrder
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.createOrder', () => {
  it('trả về 201 với data đơn hàng khi tạo thành công', async () => {
    const fakeOrder = { id: 1, number: 'ORD-001', total: 500000 };
    const ordersService = makeMockOrdersService({
      createOrder: jest.fn().mockResolvedValue(fakeOrder),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      user: { id: 5 },
      body: { items: [{ productId: 1, quantity: 2 }] },
      cookies: { sessionId: 'sess-abc' },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.createOrder(req, res, next);

    expect(ordersService.createOrder).toHaveBeenCalledWith({
      user: req.user,
      body: req.body,
      sessionIdCookie: 'sess-abc',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: { order: fakeOrder } });
    expect(next).not.toHaveBeenCalled();
  });

  it('sessionIdCookie là null khi cookies là null', async () => {
    const ordersService = makeMockOrdersService({
      createOrder: jest.fn().mockResolvedValue({}),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ cookies: null });
    const res = makeRes();

    await controller.createOrder(req, res, makeNext());

    // req.cookies && req.cookies.sessionId → null && ... → null
    expect(ordersService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ sessionIdCookie: null }),
    );
  });

  it('gọi next(err) khi createOrder thất bại', async () => {
    const serviceError = new Error('Sản phẩm hết hàng');
    serviceError.statusCode = 400;
    const ordersService = makeMockOrdersService({
      createOrder: jest.fn().mockRejectedValue(serviceError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await controller.createOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getUserOrders
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.getUserOrders', () => {
  it('trả về 200 với danh sách đơn hàng', async () => {
    const serviceResult = { orders: [{ id: 1 }], total: 1, page: 1 };
    const ordersService = makeMockOrdersService({
      getUserOrders: jest.fn().mockResolvedValue(serviceResult),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      user: { id: 7 },
      query: { page: '1', limit: '10' },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.getUserOrders(req, res, next);

    expect(ordersService.getUserOrders).toHaveBeenCalledWith({
      userId: 7,
      page: '1',
      limit: '10',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', ...serviceResult });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi getUserOrders thất bại', async () => {
    const err = new Error('DB error');
    const ordersService = makeMockOrdersService({
      getUserOrders: jest.fn().mockRejectedValue(err),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await controller.getUserOrders(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrderById
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.getOrderById', () => {
  it('trả về 200 với data đơn hàng theo id', async () => {
    const fakeOrderData = { order: { id: 3, status: 'pending' } };
    const ordersService = makeMockOrdersService({
      getOrderById: jest.fn().mockResolvedValue(fakeOrderData),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      params: { id: '3' },
      user: { id: 10, role: 'customer' },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.getOrderById(req, res, next);

    expect(ordersService.getOrderById).toHaveBeenCalledWith({
      id: '3',
      userId: 10,
      role: 'customer',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: fakeOrderData });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi đơn hàng không tìm thấy', async () => {
    const notFoundError = new Error('Không tìm thấy đơn hàng');
    notFoundError.statusCode = 404;
    const ordersService = makeMockOrdersService({
      getOrderById: jest.fn().mockRejectedValue(notFoundError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { id: '999' } });
    const res = makeRes();
    const next = makeNext();

    await controller.getOrderById(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrderByNumber
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.getOrderByNumber', () => {
  it('trả về 200 với data đơn hàng theo order number', async () => {
    const fakeOrderData = { order: { id: 5, number: 'ORD-2025-001' } };
    const ordersService = makeMockOrdersService({
      getOrderByNumber: jest.fn().mockResolvedValue(fakeOrderData),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      params: { number: 'ORD-2025-001' },
      user: { id: 10 },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.getOrderByNumber(req, res, next);

    expect(ordersService.getOrderByNumber).toHaveBeenCalledWith({
      number: 'ORD-2025-001',
      userId: 10,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: fakeOrderData });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi không tìm thấy theo order number', async () => {
    const err = new Error('Order not found');
    err.statusCode = 404;
    const ordersService = makeMockOrdersService({
      getOrderByNumber: jest.fn().mockRejectedValue(err),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { number: 'ORD-NOTEXIST' } });
    const res = makeRes();
    const next = makeNext();

    await controller.getOrderByNumber(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// cancelOrder
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.cancelOrder', () => {
  it('trả về 200 với message và data khi hủy thành công', async () => {
    const fakeCancelledOrder = { id: 2, status: 'cancelled' };
    const ordersService = makeMockOrdersService({
      cancelOrder: jest.fn().mockResolvedValue(fakeCancelledOrder),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      params: { id: '2' },
      user: { id: 10, email: 'user@test.com' },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.cancelOrder(req, res, next);

    expect(ordersService.cancelOrder).toHaveBeenCalledWith({
      id: '2',
      userId: 10,
      userEmail: 'user@test.com',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Đơn hàng đã được hủy',
      data: fakeCancelledOrder,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi hủy đơn hàng thất bại', async () => {
    const cancelError = new Error('Không thể hủy đơn hàng đã giao');
    cancelError.statusCode = 400;
    const ordersService = makeMockOrdersService({
      cancelOrder: jest.fn().mockRejectedValue(cancelError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { id: '5' } });
    const res = makeRes();
    const next = makeNext();

    await controller.cancelOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(cancelError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getAllOrders
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.getAllOrders', () => {
  it('trả về 200 với kết quả từ service', async () => {
    const serviceResult = { orders: [], total: 0, page: 1, totalPages: 0 };
    const ordersService = makeMockOrdersService({
      getAllOrders: jest.fn().mockResolvedValue(serviceResult),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: { page: '1', status: 'pending' } });
    const res = makeRes();
    const next = makeNext();

    await controller.getAllOrders(req, res, next);

    expect(ordersService.getAllOrders).toHaveBeenCalledWith({ page: '1', status: 'pending' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', ...serviceResult });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi getAllOrders thất bại', async () => {
    const err = new Error('DB timeout');
    const ordersService = makeMockOrdersService({
      getAllOrders: jest.fn().mockRejectedValue(err),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq();
    const res = makeRes();
    const next = makeNext();

    await controller.getAllOrders(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateOrderStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.updateOrderStatus', () => {
  it('trả về 200 với message và data khi update thành công', async () => {
    const fakeUpdatedOrder = { id: 3, status: 'delivered' };
    const ordersService = makeMockOrdersService({
      updateOrderStatus: jest.fn().mockResolvedValue(fakeUpdatedOrder),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      params: { id: '3' },
      body: { status: 'delivered' },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.updateOrderStatus(req, res, next);

    expect(ordersService.updateOrderStatus).toHaveBeenCalledWith({
      id: '3',
      status: 'delivered',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Cập nhật trạng thái đơn hàng thành công',
      data: fakeUpdatedOrder,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi updateOrderStatus thất bại', async () => {
    const err = new Error('Không tìm thấy đơn hàng');
    err.statusCode = 404;
    const ordersService = makeMockOrdersService({
      updateOrderStatus: jest.fn().mockRejectedValue(err),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { id: '999' }, body: { status: 'delivered' } });
    const res = makeRes();
    const next = makeNext();

    await controller.updateOrderStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// repayOrder
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.repayOrder', () => {
  it('truyền origin từ req.get("origin") vào service', async () => {
    const fakeRepayData = { paymentUrl: 'https://vnpay.vn/pay?...' };
    const ordersService = makeMockOrdersService({
      repayOrder: jest.fn().mockResolvedValue(fakeRepayData),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      params: { id: '4' },
      user: { id: 10 },
      originHeader: 'https://myshop.vn',
    });
    const res = makeRes();
    const next = makeNext();

    await controller.repayOrder(req, res, next);

    expect(ordersService.repayOrder).toHaveBeenCalledWith({
      id: '4',
      userId: 10,
      originUrl: 'https://myshop.vn',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Đơn hàng đã được cập nhật để thanh toán lại',
      data: fakeRepayData,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('fallback về FRONTEND_URL khi không có Origin header', async () => {
    const ordersService = makeMockOrdersService({
      repayOrder: jest.fn().mockResolvedValue({}),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { id: '5' }, user: { id: 10 } });
    // get('origin') trả null (không có originHeader override)
    const res = makeRes();

    await controller.repayOrder(req, res, makeNext());

    expect(ordersService.repayOrder).toHaveBeenCalledWith(
      expect.objectContaining({ originUrl: 'https://frontend.example.com' }),
    );
  });

  it('gọi next(err) khi repayOrder thất bại', async () => {
    const err = new Error('Đơn hàng không hợp lệ để thanh toán lại');
    err.statusCode = 400;
    const ordersService = makeMockOrdersService({
      repayOrder: jest.fn().mockRejectedValue(err),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { id: '6' } });
    const res = makeRes();
    const next = makeNext();

    await controller.repayOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmReceived
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.confirmReceived', () => {
  it('trả về 200 với message, pointsEarned, và data từ service', async () => {
    const serviceResult = {
      message: 'Xác nhận nhận hàng thành công',
      pointsEarned: 150,
      data: { id: 7, status: 'delivered' },
    };
    const ordersService = makeMockOrdersService({
      confirmReceived: jest.fn().mockResolvedValue(serviceResult),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({
      params: { id: '7' },
      user: { id: 10 },
    });
    const res = makeRes();
    const next = makeNext();

    await controller.confirmReceived(req, res, next);

    expect(ordersService.confirmReceived).toHaveBeenCalledWith({ id: '7', userId: 10 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      message: 'Xác nhận nhận hàng thành công',
      pointsEarned: 150,
      data: { id: 7, status: 'delivered' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi confirmReceived thất bại', async () => {
    const err = new Error('Đơn hàng không ở trạng thái shipped');
    err.statusCode = 400;
    const ordersService = makeMockOrdersService({
      confirmReceived: jest.fn().mockRejectedValue(err),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ params: { id: '8' } });
    const res = makeRes();
    const next = makeNext();

    await controller.confirmReceived(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// trackOrder — logic error handling đặc biệt
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.trackOrder', () => {
  it('trả về 200 với data khi track thành công', async () => {
    const fakeTrackData = { orderNumber: 'ORD-001', status: 'shipped', timeline: [] };
    const ordersService = makeMockOrdersService({
      trackOrder: jest.fn().mockResolvedValue(fakeTrackData),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: { orderNumber: 'ORD-001', phone: '0901234567' } });
    const res = makeRes();
    const next = makeNext();

    await controller.trackOrder(req, res, next);

    expect(ordersService.trackOrder).toHaveBeenCalledWith({
      orderNumber: 'ORD-001',
      phone: '0901234567',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', data: fakeTrackData });
    expect(next).not.toHaveBeenCalled();
  });

  it('trả về 400 plain shape (không dùng next) khi service throw 400 error', async () => {
    const badRequestError = new Error('Vui lòng cung cấp số điện thoại');
    badRequestError.statusCode = 400;
    const ordersService = makeMockOrdersService({
      trackOrder: jest.fn().mockRejectedValue(badRequestError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: {} });
    const res = makeRes();
    const next = makeNext();

    await controller.trackOrder(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Vui lòng cung cấp số điện thoại',
    });
    // next KHÔNG được gọi cho 400 error
    expect(next).not.toHaveBeenCalled();
  });

  it('trả về 404 plain shape (không dùng next) khi service throw 404 error', async () => {
    const notFoundError = new Error('Không tìm thấy đơn hàng');
    notFoundError.statusCode = 404;
    const ordersService = makeMockOrdersService({
      trackOrder: jest.fn().mockRejectedValue(notFoundError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: { orderNumber: 'ORD-NOTEXIST' } });
    const res = makeRes();
    const next = makeNext();

    await controller.trackOrder(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Không tìm thấy đơn hàng',
    });
    // next KHÔNG được gọi cho 404 error
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi service throw lỗi không phải 400/404', async () => {
    const serverError = new Error('Internal server error');
    serverError.statusCode = 500;
    const ordersService = makeMockOrdersService({
      trackOrder: jest.fn().mockRejectedValue(serverError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: {} });
    const res = makeRes();
    const next = makeNext();

    await controller.trackOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(serverError);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi lỗi không có statusCode', async () => {
    const genericError = new Error('Unexpected error');
    // Không set statusCode
    const ordersService = makeMockOrdersService({
      trackOrder: jest.fn().mockRejectedValue(genericError),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: {} });
    const res = makeRes();
    const next = makeNext();

    await controller.trackOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(genericError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// estimateShipping — synchronous handler
// ─────────────────────────────────────────────────────────────────────────────

describe('OrdersController.estimateShipping', () => {
  it('trả về 200 với data từ service (synchronous)', () => {
    const shippingEstimate = { fee: 30000, estimatedDays: 3, method: 'standard' };
    const ordersService = makeMockOrdersService({
      estimateShipping: jest.fn().mockReturnValue(shippingEstimate),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: { province: 'HN', weight: '1.5' } });
    const res = makeRes();
    const next = makeNext();

    // estimateShipping là synchronous — không phải async
    controller.estimateShipping(req, res, next);

    expect(ordersService.estimateShipping).toHaveBeenCalledWith({ province: 'HN', weight: '1.5' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ data: shippingEstimate });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi estimateShipping throw', () => {
    const calcError = new Error('Invalid province code');
    calcError.statusCode = 400;
    const ordersService = makeMockOrdersService({
      estimateShipping: jest.fn().mockImplementation(() => {
        throw calcError;
      }),
    });
    const controller = new OrdersController({ ordersService });
    const req = makeReq({ query: { province: 'INVALID' } });
    const res = makeRes();
    const next = makeNext();

    controller.estimateShipping(req, res, next);

    expect(next).toHaveBeenCalledWith(calcError);
  });
});
