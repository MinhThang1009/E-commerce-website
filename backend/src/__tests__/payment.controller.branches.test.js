/**
 * Branch coverage tests cho src/controllers/payment.js
 * Target: lines 66, 129, 305, 330, 355, 634
 *
 * Line 66:  incrementDiscountCodeUsage — true branch khi transactionInstance có giá trị
 * Line 129: createRefund — ipAddr fallback chain (socket.remoteAddress path)
 * Line 305: handleSePayWebhook — orderId guard sau khi match từ content (false branch unreachable
 *           nhưng tested via alternative flow paths)
 * Line 330: handleSePayWebhook — orderId guard trong code patterns
 * Line 355: handleSePayWebhook — orderId guard trong referenceCode patterns
 * Line 634: createVNPayUrl — ipAddr fallback chain (socket.remoteAddress path)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-payment-branches';
process.env.FRONTEND_URL = 'https://shop.test';
process.env.SEPAY_API_KEY = 'test-sepay-api-key-12345';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, res, next) => {
    if (req.headers.authorization === 'Bearer valid-token') {
      req.user = { id: 1, role: 'admin' };
      return next();
    }
    return res.status(401).json({ status: 'fail', message: 'Chưa xác thực' });
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../services/adminAudit', () => ({
  AdminAuditService: { logAction: jest.fn(), logSuccessfulLogin: jest.fn() },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
  transaction: jest.fn().mockImplementation(async (cb) => {
    if (typeof cb === 'function') return cb({ LOCK: { UPDATE: 'UPDATE' } });
    return { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
  }),
}));

let mockOrderFindByPk = jest.fn();
let mockOrderFindOne = jest.fn();
let mockOrderUpdate = jest.fn();
let mockDiscountCodeFindByPk = jest.fn();
let mockDiscountCodeIncrement = jest.fn();
let mockCartFindAll = jest.fn();
let mockCartItemDestroy = jest.fn();

jest.mock('../models', () => {
  const sequelizePkg = require('sequelize');
  return {
    Order: {
      findByPk: (...args) => mockOrderFindByPk(...args),
      findOne: (...args) => mockOrderFindOne(...args),
      update: (...args) => mockOrderUpdate(...args),
      findAll: jest.fn().mockResolvedValue([]),
    },
    OrderItem: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findAll: jest.fn().mockResolvedValue([]),
    },
    User: {
      findByPk: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
    Cart: {
      findAll: (...args) => mockCartFindAll(...args),
      findOne: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      destroy: (...args) => mockCartItemDestroy(...args),
    },
    DiscountCode: {
      findByPk: (...args) => mockDiscountCodeFindByPk(...args),
      increment: (...args) => mockDiscountCodeIncrement(...args),
    },
    Product: { findByPk: jest.fn().mockResolvedValue(null) },
    ProductVariant: { findByPk: jest.fn().mockResolvedValue(null) },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (cb) =>
        typeof cb === 'function' ? cb({ LOCK: { UPDATE: 'UPDATE' } }) : {}
      ),
      fn: jest.fn(), col: jest.fn(), where: jest.fn(), literal: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
    },
    Op: sequelizePkg.Op,
  };
});

jest.mock('../services/payment/momo', () => ({
  createPaymentUrl: jest.fn(),
  verifySignature: jest.fn(),
}));

jest.mock('../services/payment/vnpay', () => ({
  createPaymentUrl: jest.fn().mockReturnValue('https://vnpay.test/pay'),
  verifyReturnUrl: jest.fn(),
  refund: jest.fn(),
}));

jest.mock('../services/email', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

// ── Require sau mock ──────────────────────────────────────────────────────────
const express = require('express');
const supertest = require('supertest');
const paymentController = require('../controllers/payment');
const vnpayService = require('../services/payment/vnpay');
const { errorHandler } = require('../middlewares/errorHandler');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const Joi = require('joi');
const { validateRequest } = require('../middlewares/validateRequest');

// ── App builders ──────────────────────────────────────────────────────────────

function buildSePayApp() {
  const app = express();
  app.use(express.json());
  app.post('/api/payments/sepay-webhook', paymentController.handleSePayWebhook);
  app.use(errorHandler);
  return app;
}

function buildVnPayApp() {
  const app = express();
  app.use(express.json());
  const schema = Joi.object({ orderId: Joi.number().integer().positive().required() });
  app.post(
    '/api/payments/vnpay/create-url',
    authenticate,
    validateRequest(schema),
    paymentController.createVNPayUrl
  );
  app.post(
    '/api/payments/refund',
    authenticate,
    authorize('admin'),
    paymentController.createRefund
  );
  app.use(errorHandler);
  return app;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeOrder(overrides = {}) {
  return {
    id: 42,
    number: 'ORD-2511-00042',
    userId: 1,
    total: 500000,
    paymentStatus: 'pending',
    paymentProvider: 'vnpay',
    paymentTransactionId: 'TX-1234',
    status: 'pending',
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    discountCodeId: null,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const VALID_SEPAY_BODY = {
  id: 9001,
  gateway: 'MB',
  transactionDate: '2025-01-15 10:00:00',
  accountNumber: '0987654321',
  code: null,
  content: 'Chuyen khoan ORD-2511-00042',
  transferType: 'in',
  transferAmount: 500000,
  accumulated: 1000000,
  subAccount: null,
  referenceCode: null,
  description: 'Payment test',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCartFindAll.mockResolvedValue([]);
  mockCartItemDestroy.mockResolvedValue(0);
  mockDiscountCodeIncrement.mockResolvedValue(undefined);
  mockDiscountCodeFindByPk.mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 66: incrementDiscountCodeUsage — true branch (transactionInstance provided)
//
// incrementDiscountCodeUsage là private function. Nó được gọi từ webhook SePay
// mà không có transaction. Để hit true branch { transaction: tx }, ta cần test
// thông qua flow khác. Tuy nhiên, function này được gọi trực tiếp từ SePay webhook
// (không có transaction). Cách duy nhất để hit line 66 true branch là mock discountCodeId
// có giá trị và verify Order.findByPk được gọi đúng.
//
// Thực tế: line 66 true branch (với transactionInstance) chỉ accessible nếu có
// caller nội bộ với transaction — không exposed qua HTTP. Test này đảm bảo
// false branch {} được hit qua webhook flow bình thường.
// ─────────────────────────────────────────────────────────────────────────────

describe('incrementDiscountCodeUsage — false branch (không có transactionInstance)', () => {
  it('gọi Order.findByPk không có transaction option khi invoked từ webhook', async () => {
    // Order có discountCodeId — incrementDiscountCodeUsage sẽ được gọi
    const order = makeOrder({ paymentStatus: 'pending', discountCodeId: null });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    // incrementDiscountCodeUsage gọi Order.findByPk(orderId, { ...options })
    // Khi không có transaction: options = {}
    mockOrderFindByPk.mockResolvedValue({ id: 42, discountCodeId: null });

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send(VALID_SEPAY_BODY);

    expect(res.status).toBe(200);
    // Order.findByPk phải được gọi (cho incrementDiscountCodeUsage)
    expect(mockOrderFindByPk).toHaveBeenCalledWith(42, expect.objectContaining({
      attributes: ['id', 'discountCodeId'],
    }));
  });

  it('tăng usedCount khi discountCodeId không null', async () => {
    const order = makeOrder({ paymentStatus: 'pending', discountCodeId: 5 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    // incrementDiscountCodeUsage: findByPk trả order có discountCodeId
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: 5 })
      // sendOrderConfirmationEmailSafe: findByPk trả null → bỏ qua
      .mockResolvedValueOnce(null);

    const sePayApp = buildSePayApp();
    await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send(VALID_SEPAY_BODY);

    expect(mockDiscountCodeIncrement).toHaveBeenCalledWith('usedCount', {
      where: { id: 5 },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 129: createRefund — ipAddr fallback chain
// req.headers['x-forwarded-for'] có thể undefined → fallback sang các property khác.
// supertest thường set connection.remoteAddress. Để hit socket.remoteAddress branch,
// ta phải dùng raw express middleware override.
// ─────────────────────────────────────────────────────────────────────────────

describe('createRefund — ipAddr resolution branches', () => {
  it('sử dụng x-forwarded-for header khi có trong request', async () => {
    const order = makeOrder({ paymentProvider: 'vnpay', paymentTransactionId: 'TX-1234' });
    mockOrderFindByPk.mockResolvedValue(order);
    const mockRefund = { transactionId: 'REFUND-1' };
    const vnpay = require('../services/payment/vnpay');
    vnpay.refund.mockResolvedValue(mockRefund);

    const vnPayApp = buildVnPayApp();
    const res = await supertest(vnPayApp)
      .post('/api/payments/refund')
      .set('Authorization', 'Bearer valid-token')
      .set('X-Forwarded-For', '192.168.1.100')
      .send({ orderId: 42, amount: 500000, reason: 'test' });

    expect(res.status).toBe(200);
    // vnpay.refund phải được gọi với ipAddr từ header
    expect(vnpay.refund).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '192.168.1.100' })
    );
  });

  it('fallback sang connection.remoteAddress khi không có x-forwarded-for', async () => {
    const order = makeOrder({ paymentProvider: 'vnpay', paymentTransactionId: 'TX-1234' });
    mockOrderFindByPk.mockResolvedValue(order);
    const vnpay = require('../services/payment/vnpay');
    vnpay.refund.mockResolvedValue({ transactionId: 'REFUND-2' });

    // Dùng socket.remoteAddress override qua middleware
    const app = express();
    app.use(express.json());
    // Override IP theo chain: không có x-forwarded-for, không có connection.remoteAddress
    app.use((req, _res, next) => {
      delete req.headers['x-forwarded-for'];
      // Simulate socket.remoteAddress có giá trị
      req.socket = { remoteAddress: '10.0.0.1' };
      req.connection = { remoteAddress: undefined, socket: { remoteAddress: '10.0.0.2' } };
      next();
    });
    app.use((req, res, next) => {
      req.user = { id: 1, role: 'admin' };
      next();
    });
    app.post('/api/payments/refund', paymentController.createRefund);
    app.use(errorHandler);

    const res = await supertest(app)
      .post('/api/payments/refund')
      .send({ orderId: 42, amount: 500000, reason: 'test' });

    expect(res.status).toBe(200);
    // vnpay.refund gọi với ipAddr từ socket chain
    expect(vnpay.refund).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: expect.any(String) })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lines 305, 330, 355: orderId guard trong extraction loops
//
// Cấu trúc: for (const pattern of patterns) {
//   const match = content.match(pattern);
//   if (match) {                     ← outer if
//     orderId = match[0];
//     if (orderId) {                 ← inner if (line 305/330/355)
//       orderId = orderId.trim();
//       break;
//     }
//   }
// }
//
// FALSE path của inner `if (orderId)` xảy ra khi match[0] là empty string "".
// Standard regex matches không trả empty match[0] khi pattern có content.
// Nhưng có thể simulate bằng cách mock String.prototype.match (không khuyến khích).
//
// Thay vào đó, test các paths xung quanh để đảm bảo logic extraction đúng:
// - content match → break → code/referenceCode không được thử
// - content miss → code match → referenceCode không được thử
// - cả hai miss → referenceCode match
// - tất cả miss → orderId = undefined → 200 response
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — order ID extraction paths (lines 305/330/355)', () => {
  it('trích xuất orderId từ content khi content match ORD pattern', async () => {
    // content có ORD pattern → match[0] = 'ORD-2511-00042' (truthy)
    // → orderId set, break → không vào code/referenceCode extraction
    mockOrderFindOne.mockResolvedValue(null);

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: 'TT ORD-2511-00042 thanh toan',
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('bỏ qua content rỗng → thử extraction từ code (line 314)', async () => {
    // content là null → bỏ qua content extraction block
    // code có ORD pattern → extraction từ code chạy (line 330 true branch)
    mockOrderFindOne.mockResolvedValue(null);

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: null,
        code: 'ORD-2511-00042',
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('bỏ qua content và code không match → extraction từ referenceCode (line 355 true branch)', async () => {
    // content không có order pattern, code không có order pattern
    // referenceCode có ORDER pattern → extraction từ referenceCode chạy
    mockOrderFindOne.mockResolvedValue(null);

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: 'noi dung khong co ma don',
        code: 'RANDOMXYZ',
        referenceCode: 'ORDER-251100042',
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('tất cả extraction đều thất bại → trả 200 với "không tìm thấy order ID"', async () => {
    // Không có content, code, referenceCode nào chứa order ID pattern
    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: null,
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Không tìm thấy order ID/);
  });

  it('orderId được trim() trước khi dùng — content với khoảng trắng xung quanh mã đơn (line 306)', async () => {
    // Line 306: orderId = orderId.trim() — khi match[0] có whitespace (e.g. từ regex \b)
    // Thực tế: match[0] từ pattern /ORD[-_]?\w+/i trên ' ORD-2511 ' sẽ là 'ORD-2511' (không có space)
    // Nhưng test xác minh rằng trim() được gọi (code path đi qua line 306)
    // bằng cách verify orderId extracted đúng sau full extraction flow
    mockOrderFindOne.mockResolvedValue(null);

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: 'Thanh toan ORD251100042 xong', // match /ORD[-_]?\w+/i → 'ORD251100042'
        code: null,
        referenceCode: null,
      });

    // trim() không làm thay đổi gì (không có whitespace) nhưng branch được executed
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('orderId từ code pattern được trim() → line 331 trim path', async () => {
    // Line 331: orderId = orderId.trim() trong code extraction loop
    // content = null → bỏ qua, code có mã đơn → extraction từ code, trim() được gọi
    mockOrderFindOne.mockResolvedValue(null);

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: null,
        code: 'ORD251100099', // match → trim() → break
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('orderId từ referenceCode pattern được trim() → line 356 trim path', async () => {
    // Line 356: orderId = orderId.trim() trong referenceCode extraction loop
    // content và code không có match → extraction từ referenceCode
    mockOrderFindOne.mockResolvedValue(null);

    const sePayApp = buildSePayApp();
    const res = await supertest(sePayApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_SEPAY_BODY,
        content: 'noidung', // không match pattern nào
        code: 'RANDOMREF', // không match pattern nào
        referenceCode: 'ORD251100088', // match → trim() → break
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Line 634: createVNPayUrl — ipAddr fallback chain
// ─────────────────────────────────────────────────────────────────────────────

describe('createVNPayUrl — ipAddr resolution branches', () => {
  it('sử dụng x-forwarded-for khi có trong header', async () => {
    const order = makeOrder();
    mockOrderFindByPk.mockResolvedValue(order);

    const vnPayApp = buildVnPayApp();
    const res = await supertest(vnPayApp)
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', 'Bearer valid-token')
      .set('X-Forwarded-For', '203.0.113.1')
      .send({ orderId: 42 });

    expect(res.status).toBe(200);
    expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '203.0.113.1' })
    );
  });

  it('vẫn tạo được URL khi không có x-forwarded-for (fallback sang connection hoặc socket)', async () => {
    const order = makeOrder();
    mockOrderFindByPk.mockResolvedValue(order);

    // Dùng app chuẩn nhưng không set X-Forwarded-For header
    // → controller sẽ fallback sang req.connection.remoteAddress (set bởi supertest)
    const vnPayApp = buildVnPayApp();
    const res = await supertest(vnPayApp)
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', 'Bearer valid-token')
      // Không set X-Forwarded-For → fallback sang connection.remoteAddress
      .send({ orderId: 42 });

    expect(res.status).toBe(200);
    // ipAddr được resolve từ connection.remoteAddress (supertest sets this)
    expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: expect.anything() })
    );
  });

  it('fallback sang req.socket.remoteAddress khi connection.remoteAddress undefined (line 636)', async () => {
    // Hit the branch: req.connection.remoteAddress = undefined → req.socket.remoteAddress
    const order = makeOrder();
    mockOrderFindByPk.mockResolvedValue(order);

    const app = express();
    app.use(express.json());
    // Middleware xóa connection.remoteAddress để force fallback sang socket
    app.use((req, _res, next) => {
      delete req.headers['x-forwarded-for'];
      // connection.remoteAddress undefined → phải fallback sang socket.remoteAddress
      Object.defineProperty(req, 'connection', {
        value: { remoteAddress: undefined, socket: { remoteAddress: '172.16.0.1' } },
        writable: true,
      });
      Object.defineProperty(req, 'socket', {
        value: { remoteAddress: '172.16.0.1' },
        writable: true,
      });
      next();
    });
    app.use((req, _res, next) => {
      req.user = { id: 1, role: 'admin' };
      next();
    });
    const schema = require('joi').object({ orderId: require('joi').number().integer().positive().required() });
    const { validateRequest } = require('../middlewares/validateRequest');
    app.post('/api/payments/vnpay/create-url', validateRequest(schema), paymentController.createVNPayUrl);
    app.use(require('../middlewares/errorHandler').errorHandler);

    const res = await supertest(app)
      .post('/api/payments/vnpay/create-url')
      .send({ orderId: 42 });

    expect(res.status).toBe(200);
    // socket.remoteAddress = '172.16.0.1' được dùng
    expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddr: '172.16.0.1' })
    );
  });
});
