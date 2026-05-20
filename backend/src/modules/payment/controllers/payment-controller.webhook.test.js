/**
 * @file paymentController.webhook.test.js
 * @description Tests cho handleSePayWebhook và private helpers.
 */

process.env.NODE_ENV = 'test';
process.env.FRONTEND_URL = 'https://shop.test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('@utils/i18n', () => ({ t: jest.fn((key) => key) }));
jest.mock('@services/email', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@config/sequelize', () => ({}));

const mockOrderFindByPk = jest.fn();
const mockOrderFindOne = jest.fn();
const mockOrderUpdate = jest.fn();
const mockDiscountCodeIncrement = jest.fn();
const mockCartFindAll = jest.fn();
const mockCartItemDestroy = jest.fn();

jest.mock('@models', () => ({
  Order: {
    findByPk: (...a) => mockOrderFindByPk(...a),
    findOne: (...a) => mockOrderFindOne(...a),
    update: (...a) => mockOrderUpdate(...a),
  },
  User: {},
  OrderItem: {},
  Cart: { findAll: (...a) => mockCartFindAll(...a) },
  CartItem: { destroy: (...a) => mockCartItemDestroy(...a) },
  DiscountCode: { increment: (...a) => mockDiscountCodeIncrement(...a) },
}));

const PaymentController = require('./payment-controller');

beforeEach(() => {
  // authReq() gửi 'Apikey any-key' — set key khớp để bypass auth trong hầu hết tests
  process.env.SEPAY_API_KEY = 'any-key';
});

afterEach(() => {
  jest.clearAllMocks();
  delete process.env.SEPAY_API_KEY;
});

function buildController() {
  return {
    controller: new PaymentController({
      paymentService: {},
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    }),
  };
}
function buildReq(overrides = {}) {
  return { body: {}, query: {}, headers: {}, locale: 'vi', ...overrides };
}
function buildRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
}
function baseBody(o = {}) {
  return {
    id: 12345,
    transactionDate: '2024-01-15T10:30:00Z',
    code: 'ORD12345678',
    content: 'Thanh toan ORD12345678',
    transferType: 'in',
    transferAmount: 500000,
    referenceCode: null,
    ...o,
  };
}
function makeOrder(o = {}) {
  return {
    id: 1,
    number: 'ORD12345678',
    total: '500000',
    paymentTransactionId: null,
    paymentStatus: 'pending',
    userId: 42,
    discountCodeId: null,
    ...o,
  };
}
function authReq(b = {}) {
  return buildReq({ headers: { authorization: 'Apikey any-key' }, body: baseBody(b) });
}

describe('handleSePayWebhook — xác thực API key', () => {
  test('401 khi không có Authorization header', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(buildReq({ headers: {} }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
  test('không có SEPAY_API_KEY → từ chối 401', async () => {
    delete process.env.SEPAY_API_KEY;
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });
  test('SEPAY_API_KEY set, key sai → 401', async () => {
    process.env.SEPAY_API_KEY = 'correct-key';
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(
      buildReq({ headers: { authorization: 'Apikey wrong-key' } }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });
  test('SEPAY_API_KEY set, key đúng → cho phép', async () => {
    process.env.SEPAY_API_KEY = 'correct-key';
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValue(null);
    mockCartFindAll.mockResolvedValue([]);
    const res = buildRes();
    await controller.handleSePayWebhook(
      buildReq({ headers: { authorization: 'Apikey correct-key' }, body: baseBody() }),
      res,
      jest.fn(),
    );
    expect(res.status).not.toHaveBeenCalledWith(401);
  });
});

describe('handleSePayWebhook — validation', () => {
  test('400 khi thiếu id', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ id: undefined }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('400 khi thiếu transferType', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferType: undefined }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('400 khi thiếu transferAmount', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferAmount: undefined }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('400 khi id không phải number/string', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ id: [] }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('400 khi transferAmount string', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferAmount: '500000' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('400 khi transferAmount <= 0', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferAmount: 0 }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('400 khi transferType không hợp lệ', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferType: 'transfer' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
  test('200 khi transferType=out (ignore outbound)', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferType: 'out' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
  test('400 khi transactionDate không hợp lệ', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transactionDate: 'not-a-date' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('handleSePayWebhook — order lookup & business logic', () => {
  test('200 khi không có orderId trong content', async () => {
    const { controller } = buildController();
    const res = buildRes();
    await controller.handleSePayWebhook(
      authReq({ content: 'random text', code: null, referenceCode: null }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
  test('200 khi order không tìm thấy', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(null);
    const res = buildRes();
    await controller.handleSePayWebhook(authReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
  test('200 khi số tiền không khớp', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder({ total: '600000' }));
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ transferAmount: 500000 }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('số tiền') }),
    );
  });
  test('200 idempotency — đã xử lý', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder({ paymentTransactionId: '12345' }));
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ id: 12345 }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('đã được xử lý') }),
    );
  });
  test('200 khi đơn đã paid', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder({ paymentStatus: 'paid' }));
    const res = buildRes();
    await controller.handleSePayWebhook(authReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
  test('200 success — cập nhật đơn hàng', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockResolvedValue([]);
    mockOrderFindByPk.mockResolvedValueOnce(null);
    const res = buildRes();
    await controller.handleSePayWebhook(authReq(), res, jest.fn());
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid' }),
      expect.anything(),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ received: true }));
  });
});

describe('handleSePayWebhook — _incrementSePayDiscountUsage', () => {
  test('tăng usedCount khi có discountCodeId', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: 99 }));
    mockDiscountCodeIncrement.mockResolvedValue(undefined);
    mockOrderFindByPk.mockResolvedValueOnce(null);
    mockCartFindAll.mockResolvedValue([]);
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(mockDiscountCodeIncrement).toHaveBeenCalledWith('usedCount', { where: { id: 99 } });
  });
});

describe('handleSePayWebhook — _clearSePayUserCart', () => {
  test('xóa giỏ hàng active', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    const cartMock = { id: 10, update: jest.fn().mockResolvedValue(undefined) };
    mockCartFindAll.mockResolvedValue([cartMock]);
    mockCartItemDestroy.mockResolvedValue(1);
    mockOrderFindByPk.mockResolvedValueOnce(null);
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(cartMock.update).toHaveBeenCalledWith({ status: 'converted' });
    expect(mockCartItemDestroy).toHaveBeenCalledWith({ where: { cartId: 10 } });
  });
  test('bỏ qua khi không có userId', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder({ userId: null }));
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockOrderFindByPk.mockResolvedValueOnce(null);
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(mockCartFindAll).not.toHaveBeenCalled();
  });
  test('lỗi giỏ hàng → log error, không throw', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockRejectedValue(new Error('Cart error'));
    mockOrderFindByPk.mockResolvedValueOnce(null);
    const logger = require('@utils/logger');
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa giỏ hàng'),
      expect.any(String),
    );
  });
});

describe('handleSePayWebhook — _sendSePayEmailSafe', () => {
  const emailService = require('@services/email');
  function happyOrder() {
    return makeOrder({ paymentStatus: 'pending' });
  }
  test('gửi email khi có User', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(happyOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockResolvedValue([]);
    mockOrderFindByPk.mockResolvedValueOnce({
      id: 1,
      number: 'ORD-001',
      createdAt: new Date(),
      subtotal: 450000,
      shippingCost: 50000,
      total: 500000,
      shippingFirstName: 'A',
      shippingLastName: 'B',
      shippingAddress1: '123',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: 'HCM',
      shippingZip: '700000',
      shippingCountry: 'VN',
      estimatedDelivery: null,
      items: [],
      User: { email: 'test@test.com' },
    });
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalled();
  });
  test('bỏ qua khi không có User', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(happyOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockResolvedValue([]);
    mockOrderFindByPk.mockResolvedValueOnce({ id: 1, items: [], User: null });
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
  test('email lỗi → không crash webhook', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(happyOrder());
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockResolvedValue([]);
    mockOrderFindByPk.mockResolvedValueOnce({
      id: 1,
      number: 'ORD-001',
      createdAt: new Date(),
      subtotal: 450000,
      shippingCost: 50000,
      total: 500000,
      shippingFirstName: 'A',
      shippingLastName: 'B',
      shippingAddress1: '123',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: 'HCM',
      shippingZip: '700000',
      shippingCountry: 'VN',
      estimatedDelivery: null,
      items: [],
      User: { email: 'x@x.com' },
    });
    emailService.sendOrderConfirmationEmail.mockRejectedValueOnce(new Error('SMTP'));
    const res = buildRes();
    await controller.handleSePayWebhook(authReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe('handleSePayWebhook — DB error và outer catch', () => {
  test('500 khi DB lỗi khi tìm order', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockRejectedValue(new Error('DB error'));
    const res = buildRes();
    await controller.handleSePayWebhook(authReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
  });
  test('gọi next(error) khi Order.update throw', async () => {
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder());
    mockOrderUpdate.mockRejectedValue(new Error('Update error'));
    const next = jest.fn();
    await controller.handleSePayWebhook(authReq(), buildRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('handleSePayWebhook — Order lookup variants', () => {
  test('thử formatted khi exact match thất bại', async () => {
    const { controller } = buildController();
    const order = makeOrder({ number: 'ORD-1234-5678' });
    mockOrderFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValue(null);
    mockCartFindAll.mockResolvedValue([]);
    const res = buildRes();
    await controller.handleSePayWebhook(authReq({ content: 'ORD12345678' }), res, jest.fn());
    expect(mockOrderFindOne).toHaveBeenCalledTimes(2);
  });
});

// ─── _verifySePayApiKey — keys có độ dài khác nhau (charCodeAt NaN → || 0) ─────

describe('handleSePayWebhook — _verifySePayApiKey độ dài key khác nhau', () => {
  test('key đúng nhưng ngắn hơn expected → 401 (i vượt providedKey.length → charCodeAt NaN → || 0)', async () => {
    process.env.SEPAY_API_KEY = 'correct-key-long';
    const { controller } = buildController();
    const res = buildRes();
    // Provided key ngắn hơn expected → khi i >= provided.length, charCodeAt(i) = NaN → || 0
    await controller.handleSePayWebhook(
      buildReq({ headers: { authorization: 'Apikey short' }, body: baseBody() }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('key đúng nhưng dài hơn expected → 401 (i vượt expectedKey.length → charCodeAt NaN → || 0)', async () => {
    process.env.SEPAY_API_KEY = 'short';
    const { controller } = buildController();
    const res = buildRes();
    // Provided key dài hơn expected → khi i >= expected.length, charCodeAt(i) = NaN → || 0
    await controller.handleSePayWebhook(
      buildReq({ headers: { authorization: 'Apikey correct-key-long' }, body: baseBody() }),
      res,
      jest.fn(),
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ─── _sendSePayEmailSafe — items=undefined (line 29 || [] fallback) ──────────

describe('handleSePayWebhook — _sendSePayEmailSafe khi order.items là undefined', () => {
  test('gửi email với items=[] khi order không có property items', async () => {
    const emailService = require('@services/email');
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder({ paymentStatus: 'pending' }));
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockResolvedValue([]);
    // order không có property items → order.items = undefined → || [] fallback
    const orderWithoutItems = {
      id: 1,
      number: 'ORD-001',
      createdAt: new Date(),
      subtotal: 450000,
      shippingCost: 50000,
      total: 500000,
      shippingFirstName: 'A',
      shippingLastName: 'B',
      shippingAddress1: '123',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: 'HCM',
      shippingZip: '700000',
      shippingCountry: 'VN',
      estimatedDelivery: null,
      User: { email: 'customer@test.com' },
      // items không có ở đây → undefined
    };
    mockOrderFindByPk.mockResolvedValueOnce(orderWithoutItems);
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'customer@test.com',
      expect.objectContaining({ items: [] }),
    );
  });
});

// ─── _sendSePayEmailSafe — items array non-empty (line 29 arrow fn) ───────────

describe('handleSePayWebhook — _sendSePayEmailSafe với items', () => {
  test('gửi email khi order có items (covers map arrow function)', async () => {
    const emailService = require('@services/email');
    const { controller } = buildController();
    mockOrderFindOne.mockResolvedValue(makeOrder({ paymentStatus: 'pending' }));
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValueOnce(makeOrder({ discountCodeId: null }));
    mockCartFindAll.mockResolvedValue([]);
    mockOrderFindByPk.mockResolvedValueOnce({
      id: 1,
      number: 'ORD-001',
      createdAt: new Date(),
      subtotal: 450000,
      shippingCost: 50000,
      total: 500000,
      shippingFirstName: 'A',
      shippingLastName: 'B',
      shippingAddress1: '123',
      shippingAddress2: null,
      shippingCity: 'HCM',
      shippingState: 'HCM',
      shippingZip: '700000',
      shippingCountry: 'VN',
      estimatedDelivery: null,
      items: [{ name: 'iPhone 15', quantity: 1, unitPrice: 450000, subtotal: 450000 }],
      User: { email: 'customer@test.com' },
    });
    await controller.handleSePayWebhook(authReq(), buildRes(), jest.fn());
    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalled();
  });
});
