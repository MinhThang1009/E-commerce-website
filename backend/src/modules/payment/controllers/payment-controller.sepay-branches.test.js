/**
 * SePay webhook — branch tests cho các nhánh chưa được cover:
 *   - line 214: id không phải number/string
 *   - lines 273-277: order lookup với formatted/unformatted orderId
 */
process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@utils/i18n', () => ({ t: (key) => key }));
jest.mock('@services/email', () => ({}));
jest.mock('@config/sequelize', () => ({ transaction: jest.fn() }));
jest.mock('@models', () => ({
  Order: { findOne: jest.fn(), findByPk: jest.fn() },
  User: {},
  OrderItem: {},
  Cart: {},
  CartItem: {},
  DiscountCode: {},
}));

const { Order } = require('@models');
const PaymentController = require('./payment-controller');

function buildController() {
  const paymentService = {
    createRefund: jest.fn(),
    createMomoUrl: jest.fn(),
    handleMomoReturn: jest.fn(),
    handleMomoIPN: jest.fn(),
    createVNPayUrl: jest.fn(),
    handleVnPayReturn: jest.fn(),
    handleVnPayIPN: jest.fn(),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return { controller: new PaymentController({ paymentService, logger }), logger };
}

// Header hợp lệ để pass _verifySePayApiKey (NODE_ENV=test + no SEPAY_API_KEY)
const VALID_HEADERS = { authorization: 'Apikey test-key' };

// Body hợp lệ để pass các guard trước line 214
const BASE_BODY = {
  transactionDate: new Date().toISOString(),
  transferType: 'in',
  transferAmount: 100000,
};

function buildReq(body = {}, headers = VALID_HEADERS) {
  return {
    body: { ...BASE_BODY, ...body },
    headers,
    locale: 'vi',
  };
}

function buildRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

beforeEach(() => jest.clearAllMocks());

// ─── Line 214: id không phải number hoặc string ───────────────────────────────

describe('handleSePayWebhook — invalidTransactionIdType (line 214)', () => {
  it('trả về 400 khi id là object', async () => {
    const { controller } = buildController();
    const req = buildReq({ id: { value: 123 } });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('invalidTransactionIdType') }),
    );
  });

  it('trả về 400 khi id là mảng', async () => {
    const { controller } = buildController();
    const req = buildReq({ id: [1, 2] });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── Lines 273-277: order lookup format branches ──────────────────────────────

describe('handleSePayWebhook — order lookup format variations (lines 273-277)', () => {
  const GOOD_BODY = {
    id: 1,
    transactionDate: new Date().toISOString(),
    transferType: 'in',
    transferAmount: 100000,
    content: 'Thanh toan ORD12345678',
  };

  it('thử formatted lookup khi orderId bắt đầu bằng ORD và không tìm thấy exact', async () => {
    const { controller } = buildController();
    // Lần 1 (exact) không tìm thấy, lần 2 (formatted) tìm thấy
    const mockOrder = {
      number: 'ORD-1234-5678',
      total: '100000',
      status: 'pending',
      update: jest.fn().mockResolvedValue(),
    };
    Order.findOne
      .mockResolvedValueOnce(null) // exact match → null
      .mockResolvedValueOnce(mockOrder); // formatted match → found
    Order.findByPk.mockResolvedValue(null);
    const req = buildReq(GOOD_BODY);
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(Order.findOne).toHaveBeenCalledTimes(2);
  });

  it('thử unformatted lookup khi orderId có dấu gạch và không tìm thấy exact', async () => {
    const { controller } = buildController();
    const mockOrder = {
      number: 'ORD12345678',
      total: '100000',
      status: 'pending',
      update: jest.fn().mockResolvedValue(),
    };
    // orderId sẽ có dấu gạch vì pattern match 'ORD-12345678'
    Order.findOne
      .mockResolvedValueOnce(null) // exact match → null
      .mockResolvedValueOnce(null) // formatted match → null
      .mockResolvedValueOnce(mockOrder); // unformatted match → found
    Order.findByPk.mockResolvedValue(null);
    const req = buildReq({
      ...GOOD_BODY,
      content: 'Thanh toan ORD-1234-5678',
    });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(Order.findOne).toHaveBeenCalledTimes(3);
  });

  it('thử reformatted lookup khi unformatted cũng không tìm thấy', async () => {
    const { controller } = buildController();
    const mockOrder = {
      number: 'ORD-1234-5678',
      total: '100000',
      status: 'pending',
      update: jest.fn().mockResolvedValue(),
    };
    Order.findOne
      .mockResolvedValueOnce(null) // exact
      .mockResolvedValueOnce(null) // formatted (từ nhánh startsWith ORD)
      .mockResolvedValueOnce(null) // unformatted
      .mockResolvedValueOnce(mockOrder); // reformatted → found
    Order.findByPk.mockResolvedValue(null);
    const req = buildReq({
      ...GOOD_BODY,
      content: 'Thanh toan ORD-1234-5678',
    });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(Order.findOne).toHaveBeenCalledTimes(4);
  });
});

// ─── Line 214: invalidDataType when transferAmount is string ──────────────────

describe('handleSePayWebhook — invalidDataType (line 214)', () => {
  it('trả về 400 khi transferAmount là string', async () => {
    const { controller } = buildController();
    const req = buildReq({ id: 123, transferAmount: '500000', transferType: 'in' });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('invalidDataType') }),
    );
  });

  it('trả về 400 khi transferType là number', async () => {
    const { controller } = buildController();
    const req = buildReq({ id: 123, transferAmount: 100000, transferType: 123 });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── Line 214: amountMustBePositive when transferAmount < 0 ─────────────────

describe('handleSePayWebhook — amountMustBePositive (line 214)', () => {
  it('trả về 400 khi transferAmount âm', async () => {
    const { controller } = buildController();
    // transferAmount âm: !(-100) = false (passes missing check) but -100 <= 0 → 400
    const req = buildReq({ id: 123, transferAmount: -100, transferType: 'in' });
    const res = buildRes();
    await controller.handleSePayWebhook(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('amountMustBePositive') }),
    );
  });
});
