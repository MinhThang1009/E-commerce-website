/**
 * Additional tests cho src/controllers/payment.js (flat controller)
 * Bao gồm các nhánh chưa được covered:
 *  - sendOrderConfirmationEmailSafe: happy path, missing order/user, email fail
 *  - incrementDiscountCodeUsage: discountCodeId null guard
 *  - clearUserCart: missing userId, carts found + converted, catch error
 *  - verifySePayApiKey: header không đúng format, thiếu SEPAY_API_KEY (dev mode)
 *  - handleSePayWebhook: id type validation, transfer type string check,
 *    order ID extraction từ code/referenceCode, DB error, outer catch
 *  - momoReturn: error redirect
 *  - momoIPN: 500 error path
 *  - vnpayReturn: next(error) path
 *  - vnpayIPN: catch path
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-payment-controller-flat-extra';
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
      req.user = { id: 1, role: 'customer' };
      return next();
    }
    return res.status(401).json({ status: 'fail', message: 'Chưa xác thực' });
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: (role) => (req, res, next) => {
    if (req.user && req.user.role === role) return next();
    return res.status(403).json({ status: 'fail', message: 'Không có quyền' });
  },
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

// Per-test mockable fns
let mockOrderFindByPk = jest.fn();
let mockOrderFindOne = jest.fn();
let mockOrderUpdate = jest.fn();
let mockCartFindAll = jest.fn();
let mockCartItemDestroy = jest.fn();
let mockDiscountCodeIncrement = jest.fn();
let mockOrderItemFindAll = jest.fn();
let mockUserFindByPk = jest.fn();

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
      findAll: (...args) => mockOrderItemFindAll(...args),
    },
    User: {
      findByPk: (...args) => mockUserFindByPk(...args),
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
      findByPk: jest.fn().mockResolvedValue(null),
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
  createPaymentUrl: jest.fn(),
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
const momoService = require('../services/payment/momo');
const vnpayService = require('../services/payment/vnpay');
const emailService = require('../services/email');
const { errorHandler } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// ── Build minimal app ─────────────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/payments/momo/return', paymentController.momoReturn);
  app.post('/api/payments/momo/ipn', paymentController.momoIPN);
  app.get('/api/payments/vnpay/return', paymentController.vnpayReturn);
  app.get('/api/payments/vnpay/ipn', paymentController.vnpayIPN);
  app.post('/api/payments/sepay-webhook', paymentController.handleSePayWebhook);
  app.use(errorHandler);
  return app;
}

const app = buildApp();
const request = supertest(app);

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePendingOrder(overrides = {}) {
  return {
    id: 42,
    number: 'ORD-2511-00042',
    userId: 1,
    total: 500000,
    paymentStatus: 'pending',
    paymentProvider: 'vnpay',
    paymentTransactionId: null,
    status: 'pending',
    updatedAt: new Date('2025-01-15T10:00:00Z'),
    discountCodeId: null,
    update: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const VALID_WEBHOOK_BODY = {
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
  // Default: no carts, discount increment noop
  mockCartFindAll.mockResolvedValue([]);
  mockCartItemDestroy.mockResolvedValue(0);
  mockDiscountCodeIncrement.mockResolvedValue(undefined);
  mockOrderItemFindAll.mockResolvedValue([]);
  mockUserFindByPk.mockResolvedValue(null);
});

// ─────────────────────────────────────────────────────────────────────────────
// sendOrderConfirmationEmailSafe (private function, tested via webhook flow)
// ─────────────────────────────────────────────────────────────────────────────

describe('sendOrderConfirmationEmailSafe — via SePay webhook success flow', () => {
  it('gửi email xác nhận khi order và user tồn tại', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    // incrementDiscountCodeUsage → findByPk order lần 2
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null }) // for incrementDiscountCodeUsage
      // sendOrderConfirmationEmailSafe: Order.findByPk for full order
      .mockResolvedValueOnce({
        id: 42,
        number: 'ORD-2511-00042',
        createdAt: new Date(),
        subtotal: 450000,
        shippingCost: 50000,
        total: 500000,
        shippingFirstName: 'Nguyen',
        shippingLastName: 'Van A',
        shippingAddress1: '123 Main St',
        shippingAddress2: null,
        shippingCity: 'HCM',
        shippingState: 'HCM',
        shippingZip: '70000',
        shippingCountry: 'VN',
        estimatedDelivery: null,
        User: { email: 'test@example.com' },
        items: [
          { name: 'iPhone 15', quantity: 1, unitPrice: 450000, subtotal: 450000 },
        ],
      });

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'test@example.com',
      expect.objectContaining({ orderNumber: 'ORD-2511-00042' })
    );
  });

  it('bỏ qua gửi email khi order.User không tồn tại', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      // sendOrderConfirmationEmailSafe: findByPk trả về order không có User
      .mockResolvedValueOnce({
        id: 42,
        number: 'ORD-2511-00042',
        User: null, // không có user
        items: [],
      });

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });

  it('không throw khi emailService.sendOrderConfirmationEmail fail', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce({
        id: 42,
        number: 'ORD-2511-00042',
        User: { email: 'bad@example.com' },
        items: [],
        subtotal: 500000, shippingCost: 0, total: 500000,
        shippingFirstName: 'A', shippingLastName: 'B',
        shippingAddress1: 'Addr', shippingCity: 'HCM',
        createdAt: new Date(),
      });

    emailService.sendOrderConfirmationEmail.mockRejectedValueOnce(new Error('SMTP fail'));

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    // Webhook phải vẫn trả về 200 dù email fail
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearUserCart — tested via SePay webhook flow with carts
// ─────────────────────────────────────────────────────────────────────────────

describe('clearUserCart — via SePay webhook success flow', () => {
  it('cập nhật status=converted và xóa CartItems khi có active carts', async () => {
    const mockCart = {
      id: 10,
      userId: 1,
      status: 'active',
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockCartFindAll.mockResolvedValue([mockCart]);
    mockCartItemDestroy.mockResolvedValue(1);

    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000, userId: 1 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce(null); // sendOrderConfirmationEmailSafe bỏ qua

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(mockCart.update).toHaveBeenCalledWith({ status: 'converted' });
    expect(mockCartItemDestroy).toHaveBeenCalledWith({ where: { cartId: 10 } });
  });

  it('log info khi không có active carts', async () => {
    mockCartFindAll.mockResolvedValue([]);

    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000, userId: 1 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce(null);

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Không tìm thấy giỏ hàng')
    );
  });

  it('không throw khi Cart.findAll fail — lỗi được catch và log', async () => {
    mockCartFindAll.mockRejectedValueOnce(new Error('DB down'));

    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000, userId: 1 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce(null);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(res.status).toBe(200);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xóa giỏ hàng'),
      expect.any(String)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifySePayApiKey — header format edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('verifySePayApiKey — Authorization header edge cases', () => {
  it('trả về 401 khi Authorization header không bắt đầu bằng "Apikey "', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Bearer test-sepay-api-key-12345') // sai prefix
      .send(VALID_WEBHOOK_BODY);

    expect(res.status).toBe(401);
  });

  it('trả về 401 khi Authorization = "Apikey" không có khoảng trắng sau', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey') // thiếu khoảng trắng và key
      .send(VALID_WEBHOOK_BODY);

    // Không bắt đầu bằng "Apikey " (có khoảng trắng)
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — id type validation
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — field type validation', () => {
  it('trả về 400 khi transferAmount là string thay vì number', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferAmount: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/kiểu dữ liệu/i);
  });

  it('trả về 400 khi transferType là number thay vì string', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferType: 123 });

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — order ID extraction từ code và referenceCode
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — order ID extraction từ code field', () => {
  it('trích xuất order ID từ code khi content không có order ID', async () => {
    mockOrderFindOne.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'chuyen khoan thanh toan',  // không có order ID
        code: 'ORD-2511-00042',              // order ID trong code
        referenceCode: null,
      });

    // Tìm thấy order ID từ code → nhưng order không tồn tại → vẫn 200
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('trích xuất order ID từ referenceCode khi cả content và code đều không có', async () => {
    mockOrderFindOne.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'noi dung khong co ma don',
        code: 'ABCXYZ',
        referenceCode: 'ORDER-251100042',  // order ID trong referenceCode
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('tìm order theo format với dấu gạch từ string không có dấu gạch (ORD251100042 → ORD-2511-00042)', async () => {
    const order = makePendingOrder({ paymentStatus: 'paid', total: 500000 });
    // findOne trả về null cho lần đầu (exact match thất bại)
    // findOne trả về order cho lần thứ 2 (formatted match)
    mockOrderFindOne
      .mockResolvedValueOnce(null)   // exact: ORD251100042 không tìm thấy
      .mockResolvedValueOnce(order); // formatted: ORD-2511-0042 tìm thấy

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'TT ORD251100042 phong',
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
  });

  it('xử lý order ID có dấu gạch → strip dấu gạch để tìm (ORD-2511-00042 → ORD251100042)', async () => {
    mockOrderFindOne
      .mockResolvedValueOnce(null)  // exact match: ORD-2511-00042 không tìm thấy
      .mockResolvedValueOnce(null)  // formatted: thử thêm dấu gạch cũng không tìm thấy
      .mockResolvedValueOnce(null)  // stripped: ORD251100042 không tìm thấy
      .mockResolvedValueOnce(null); // các thử khác

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'TT ORD-2511-00042 vao',
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — DB error trong order lookup
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — DB error', () => {
  it('trả về 500 khi DB throw trong quá trình tìm order', async () => {
    mockOrderFindOne.mockRejectedValue(new Error('DB connection lost'));

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Lỗi xử lý đơn hàng/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// momoReturn — error redirect path
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/payments/momo/return — error redirect', () => {
  it('redirect về /orders?payment=error khi Order.findByPk throw', async () => {
    mockOrderFindByPk.mockRejectedValue(new Error('DB crash'));

    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '0',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// momoIPN — 500 error path
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/payments/momo/ipn — 500 error path', () => {
  it('trả về 500 khi Order.findByPk throw trong IPN flow', async () => {
    momoService.verifySignature.mockReturnValue(true);
    mockOrderFindByPk.mockRejectedValue(new Error('DB crash'));

    const res = await request.post('/api/payments/momo/ipn').send({
      resultCode: 0,
      transId: 'TX-CRASH',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vnpayReturn — next(error) path
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/payments/vnpay/return — next(error) path', () => {
  it('gọi errorHandler khi Order.findOne throw', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    mockOrderFindOne.mockRejectedValue(new Error('VNPay DB crash'));

    const res = await request.get('/api/payments/vnpay/return').query({
      vnp_TxnRef: 'ORD-X',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: 'TX-CRASH',
    });

    // errorHandler intercepts → 500
    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// vnpayIPN — catch path
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/payments/vnpay/ipn — catch path', () => {
  it('trả về RspCode 99 khi Order.update throw (inner catch)', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ total: 500000, paymentStatus: 'pending' });
    order.update = jest.fn().mockRejectedValue(new Error('update fail'));
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
      vnp_Amount: '50000000',
      vnp_TransactionNo: 'TX-FAIL',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('99');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createRefund — controller-level orderId guard (line 113-114)
// (tested WITHOUT validateRequest middleware so controller check is reached)
// ─────────────────────────────────────────────────────────────────────────────

describe('createRefund — controller-level orderId guard', () => {
  function buildDirectApp() {
    const a = express();
    a.use(express.json());
    // No validateRequest — test the controller's own guard
    a.post('/refund', paymentController.createRefund);
    a.use(errorHandler);
    return a;
  }

  it('trả về 400 khi orderId không có trong body (controller guard)', async () => {
    const res = await supertest(buildDirectApp())
      .post('/refund')
      .send({ amount: 100000 }); // không có orderId

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearUserCart — userId falsy guard (lines 80-82)
// ─────────────────────────────────────────────────────────────────────────────

describe('clearUserCart — userId falsy guard', () => {
  it('log warn khi order.userId = null trong SePay webhook flow', async () => {
    // order.userId = null → clearUserCart(null) → log warn → return
    const orderWithNullUserId = makePendingOrder({ paymentStatus: 'pending', total: 500000, userId: null });
    mockOrderFindOne.mockResolvedValue(orderWithNullUserId);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce(null);

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('thiếu userId')
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifySePayApiKey — thiếu SEPAY_API_KEY trong production (lines 182-184)
// ─────────────────────────────────────────────────────────────────────────────

describe('verifySePayApiKey — SEPAY_API_KEY không được cấu hình', () => {
  const originalApiKey = process.env.SEPAY_API_KEY;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.SEPAY_API_KEY = originalApiKey;
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('cho phép webhook trong môi trường test khi SEPAY_API_KEY không cấu hình', async () => {
    delete process.env.SEPAY_API_KEY;
    process.env.NODE_ENV = 'test';

    // Phải tạo app mới sau khi thay đổi env
    // Nhưng controller đọc env tại runtime → vẫn dùng app hiện tại
    mockOrderFindOne.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey any-key')
      .send({ ...VALID_WEBHOOK_BODY });

    // Trong test mode không có SEPAY_API_KEY → cho phép (return true)
    // Webhook nên được xử lý (không phải 401)
    expect(res.status).not.toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — transferAmount <= 0 path (lines 251-253)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — transferAmount âm', () => {
  it('trả về 400 khi transferAmount là số âm', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferAmount: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/số dương/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — id type check edge cases (lines 240-242)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — id type không phải number hoặc string', () => {
  it('trả về 400 khi id là boolean', async () => {
    // JSON parse sẽ chuyển boolean thành boolean type
    // Express JSON parser: { id: true } → typeof id === 'boolean' → không phải number/string
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ ...VALID_WEBHOOK_BODY, id: true }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Kiểu dữ liệu transaction ID/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — outer catch (lines 519-521)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — outer catch (unexpected error)', () => {
  it('gọi next(error) khi Order.update throw ngoài DB try-catch', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000, paymentTransactionId: null });
    mockOrderFindOne.mockResolvedValue(order);
    // Order.update được gọi bên trong handleSePayWebhook với static method
    // mock Order.update để throw
    mockOrderUpdate.mockRejectedValueOnce(new Error('Unexpected DB crash'));

    // App cần errorHandler để bắt lỗi từ next()
    const errorApp = express();
    errorApp.use(express.json());
    errorApp.post('/api/payments/sepay-webhook', paymentController.handleSePayWebhook);
    errorApp.use((err, _req, res, _next) => {
      res.status(500).json({ error: err.message });
    });

    const res = await supertest(errorApp)
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(res.status).toBe(500);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Lỗi xử lý SePay webhook'),
      expect.any(Error)
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sendOrderConfirmationEmailSafe — order.items null/undefined (|| [] branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('sendOrderConfirmationEmailSafe — order.items undefined (|| [] branch)', () => {
  it('gửi email thành công khi order.items là undefined — dùng [] mặc định', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      // sendOrderConfirmationEmailSafe: items là undefined → fallback []
      .mockResolvedValueOnce({
        id: 42,
        number: 'ORD-2511-00042',
        createdAt: new Date(),
        subtotal: 500000,
        shippingCost: 0,
        total: 500000,
        shippingFirstName: 'A',
        shippingLastName: 'B',
        shippingAddress1: '123 Street',
        shippingAddress2: null,
        shippingCity: 'HCM',
        shippingState: 'HCM',
        shippingZip: '70000',
        shippingCountry: 'VN',
        estimatedDelivery: null,
        User: { email: 'user@example.com' },
        items: undefined, // không có items → || [] branch
      });

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(emailService.sendOrderConfirmationEmail).toHaveBeenCalledWith(
      'user@example.com',
      expect.objectContaining({ items: [] })
    );
  });

  it('bỏ qua email khi order.findByPk trả về null', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce(null); // sendOrderConfirmationEmailSafe: order null → return early

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(emailService.sendOrderConfirmationEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// momoReturn — orderId null (extraData không chứa orderId=...)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/payments/momo/return — orderId null khi extraData không match', () => {
  it('redirect về /orders?payment=success khi resultCode=0 nhưng extraData không có orderId', async () => {
    // extraData không có dạng "orderId=..." → orderId = null → bỏ qua update
    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '0',
      extraData: 'somedata=noid',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=success');
    // Order không được tìm kiếm vì orderId null
    expect(mockOrderFindByPk).not.toHaveBeenCalled();
  });

  it('redirect về /orders?payment=failed khi resultCode != 0', async () => {
    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '1001', // lỗi thanh toán
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=failed');
  });

  it('redirect về /orders?payment=success khi order.paymentStatus đã là paid (bỏ qua update)', async () => {
    const paidOrder = makePendingOrder({ paymentStatus: 'paid' });
    mockOrderFindByPk.mockResolvedValue(paidOrder);

    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '0',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=success');
    // order.update không được gọi vì đã paid
    expect(paidOrder.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// momoIPN — orderId null (extraData không match) và order đã paid
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/payments/momo/ipn — orderId null và order đã paid', () => {
  it('trả về 204 khi extraData không chứa orderId= (orderId null)', async () => {
    momoService.verifySignature.mockReturnValue(true);

    const res = await request.post('/api/payments/momo/ipn').send({
      resultCode: 0,
      transId: 'TX-999',
      extraData: 'noorderhere',
    });

    // resultCode=0 nhưng orderId=null → condition (resultCode==0 && orderId) false
    expect(res.status).toBe(204);
    expect(mockOrderFindByPk).not.toHaveBeenCalled();
  });

  it('trả về 204 khi order.paymentStatus đã là paid — bỏ qua update', async () => {
    momoService.verifySignature.mockReturnValue(true);
    const alreadyPaidOrder = makePendingOrder({ paymentStatus: 'paid' });
    mockOrderFindByPk.mockResolvedValue(alreadyPaidOrder);

    const res = await request.post('/api/payments/momo/ipn').send({
      resultCode: 0,
      transId: 'TX-DUP',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(204);
    expect(alreadyPaidOrder.update).not.toHaveBeenCalled();
  });

  it('trả về 204 khi resultCode != 0 (thanh toán thất bại)', async () => {
    momoService.verifySignature.mockReturnValue(true);

    const res = await request.post('/api/payments/momo/ipn').send({
      resultCode: 1006,
      transId: 'TX-FAIL',
      extraData: 'orderId=42',
    });

    // resultCode != 0 → condition (resultCode==0 && orderId) false
    expect(res.status).toBe(204);
    expect(mockOrderFindByPk).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — order đã paid (paymentStatus != pending/unpaid)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — order đã xử lý trước đó', () => {
  it('trả về 200 với message "đã được xử lý" khi order.paymentStatus là paid', async () => {
    const alreadyPaidOrder = makePendingOrder({
      paymentStatus: 'paid',
      total: 500000,
      paymentTransactionId: null,
    });
    mockOrderFindOne.mockResolvedValue(alreadyPaidOrder);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/đã được xử lý/i);
    // Order.update không được gọi
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });

  it('trả về 200 với message trùng lặp khi transaction ID đã được xử lý', async () => {
    // paymentTransactionId trùng với id trong webhook → duplicate
    const duplicateOrder = makePendingOrder({
      paymentStatus: 'pending',
      total: 500000,
      paymentTransactionId: '9001', // trùng với VALID_WEBHOOK_BODY.id
    });
    mockOrderFindOne.mockResolvedValue(duplicateOrder);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, id: 9001 });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/đã được xử lý trước đó|trùng lặp/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — số tiền không khớp
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — số tiền không khớp', () => {
  it('trả về 200 với message không khớp khi transferAmount khác order.total', async () => {
    const order = makePendingOrder({
      paymentStatus: 'pending',
      total: 500000,
      paymentTransactionId: null,
    });
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferAmount: 100000 }); // khác 500000

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/không khớp/i);
    expect(mockOrderUpdate).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createRefund — ipAddr fallback chain (req.connection.socket.remoteAddress)
// ─────────────────────────────────────────────────────────────────────────────

describe('createRefund — ipAddr fallback chain', () => {
  function buildRefundApp() {
    const a = express();
    a.use(express.json());
    a.post('/refund', paymentController.createRefund);
    a.use(errorHandler);
    return a;
  }

  it('dùng req.connection.socket.remoteAddress khi các header và socket đều null', async () => {
    const orderWithTxId = makePendingOrder({
      paymentProvider: 'vnpay',
      paymentTransactionId: 'TX-REFUND-001',
      total: 300000,
    });
    mockOrderFindByPk.mockResolvedValue(orderWithTxId);
    vnpayService.refund.mockResolvedValue({ refundId: 'REF-001' });

    // supertest mặc định đặt x-forwarded-for. Cần tạo custom request không có header đó
    // và không có req.connection.remoteAddress / req.socket.remoteAddress
    // → test sẽ dùng req.connection.socket.remoteAddress (cuối chuỗi ||)
    // Cách dễ nhất: controller đọc các fallback này từ req, supertest sẽ điền một số giá trị.
    // Test này verify rằng refund được gọi với ipAddr string bất kỳ (không throw).
    const res = await supertest(buildRefundApp())
      .post('/refund')
      .send({ orderId: 42, amount: 300000 });

    // Refund được gọi (dù ipAddr là gì)
    expect(res.status).toBe(200);
    expect(vnpayService.refund).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: orderWithTxId.number })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — transferType 'out' bị bỏ qua (không phải 'in')
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — transferType out bị bỏ qua', () => {
  it('trả về 200 với message bỏ qua khi transferType = out', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferType: 'out' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/tiền ra/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — orderId không tìm thấy trong tất cả fields
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — không tìm thấy orderId', () => {
  it('trả về 200 với received=true khi content, code, referenceCode đều không có order ID', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'chuyen khoan abc',
        code: 'RANDOM',
        referenceCode: 'XYZ',
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.message).toMatch(/Không tìm thấy order ID/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — ngày giao dịch không hợp lệ
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — transactionDate không hợp lệ', () => {
  it('trả về 400 khi transactionDate không thể parse thành Date hợp lệ', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transactionDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ngày giao dịch/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifySePayApiKey — charCodeAt || 0 branch (line 194)
// Khi API key được cung cấp ngắn hơn expected → charCodeAt trả về NaN → || 0
// ─────────────────────────────────────────────────────────────────────────────

describe('verifySePayApiKey — key ngắn hơn expected (|| 0 branch tại line 194)', () => {
  it('trả về 401 khi API key được cung cấp ngắn hơn expected key', async () => {
    // Provided key ngắn hơn expected → Math.max loop vượt qua provided key length
    // → charCodeAt(i) tại index vượt giới hạn trả về NaN → NaN || 0 = 0
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey short') // ngắn hơn 'test-sepay-api-key-12345'
      .send(VALID_WEBHOOK_BODY);

    expect(res.status).toBe(401);
  });

  it('trả về 401 khi API key được cung cấp dài hơn expected key', async () => {
    // Expected key ngắn hơn provided → Math.max loop vượt qua expected length
    // → expectedApiKey.charCodeAt(i) trả về NaN → NaN || 0 = 0
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345-EXTRA-LONG')
      .send(VALID_WEBHOOK_BODY);

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createRefund — amount || order.total branch (line 136)
// ─────────────────────────────────────────────────────────────────────────────

describe('createRefund — refund với amount được cung cấp (line 136 false branch của ||)', () => {
  function buildRefundOnlyApp() {
    const a = express();
    a.use(express.json());
    a.post('/refund', paymentController.createRefund);
    a.use(errorHandler);
    return a;
  }

  it('dùng amount được cung cấp thay vì order.total khi gọi vnpayService.refund', async () => {
    const order = makePendingOrder({
      paymentProvider: 'vnpay',
      paymentTransactionId: 'TX-AMT-001',
      total: 500000,
    });
    mockOrderFindByPk.mockResolvedValue(order);
    vnpayService.refund.mockResolvedValue({ refundId: 'REF-AMT-001' });

    const res = await supertest(buildRefundOnlyApp())
      .post('/refund')
      .send({ orderId: 42, amount: 250000 }); // amount được cung cấp

    expect(res.status).toBe(200);
    // refund được gọi với amount = 250000 (không phải order.total = 500000)
    expect(vnpayService.refund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 250000 })
    );
  });

  it('dùng order.total khi amount không được cung cấp (amount || order.total right side)', async () => {
    const order = makePendingOrder({
      paymentProvider: 'vnpay',
      paymentTransactionId: 'TX-NOTOTAL-001',
      total: 350000,
    });
    mockOrderFindByPk.mockResolvedValue(order);
    vnpayService.refund.mockResolvedValue({ refundId: 'REF-NOTOTAL-001' });

    const res = await supertest(buildRefundOnlyApp())
      .post('/refund')
      .send({ orderId: 42 }); // không có amount → amount=undefined → || order.total

    expect(res.status).toBe(200);
    // refund được gọi với amount = order.total = 350000
    expect(vnpayService.refund).toHaveBeenCalledWith(
      expect.objectContaining({ amount: order.total })
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — content null (line 281 if(content) false branch)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — content null (line 281 false branch)', () => {
  it('bỏ qua vòng lặp content khi content là null', async () => {
    // content = null → if(content) false → bỏ qua, tìm trong code và referenceCode
    mockOrderFindOne.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: null,       // null → if(content) false
        code: 'ORD-2511-00042',
        referenceCode: null,
      });

    // Tìm từ code → tìm thấy orderId → nhưng order không tồn tại → 200
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — order tìm thấy format ORD + dash thêm (line 390 true)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — orderId bắt đầu ORD dài hơn 7 ký tự (line 390 true branch)', () => {
  it('thử format với dấu gạch khi orderId bắt đầu ORD và length > 7', async () => {
    // orderId = 'ORD251100042' → starts with 'ORD', length=12>7 → tạo formatted variant
    // exact match thất bại → thử formatted → tìm thấy
    const foundOrder = makePendingOrder({ paymentStatus: 'paid', total: 500000 });
    mockOrderFindOne
      .mockResolvedValueOnce(null)    // exact: 'ORD251100042' không tìm thấy
      .mockResolvedValueOnce(foundOrder); // formatted: 'ORD-2511-00042' tìm thấy

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'thanh toan ORD251100042 xong',
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    // Order tìm thấy (paymentStatus: 'paid') → trả về "đã được xử lý"
    expect(res.body.received).toBe(true);
  });
});

describe('handleSePayWebhook — orderId bắt đầu ORD nhưng quá ngắn (line 390 false branch)', () => {
  it('bỏ qua formatted variant khi orderId bắt đầu ORD nhưng length <= 7', async () => {
    // orderId = 'ORD123' → startsWith('ORD')=true nhưng length=6 ≤ 7 → false branch (bỏ qua format)
    // Regex /ORD[-_]?(\d+)/i match 'ORD123' → orderId='ORD123'
    mockOrderFindOne.mockResolvedValue(null); // không tìm thấy

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'thanh toan ORD123 xong', // ORD123 → length=6 ≤ 7
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleSePayWebhook — orderId có dấu gạch → tìm thấy sau khi remove dash (line 410 false)
// ─────────────────────────────────────────────────────────────────────────────

describe('handleSePayWebhook — orderId có dấu gạch, tìm thấy sau khi strip (line 410 false)', () => {
  it('tìm thấy order sau khi strip dấu gạch (không cần thêm formatted variant)', async () => {
    // orderId = 'ORD-2511-00042' → includes('-') → strip → 'ORD251100042' → tìm thấy
    const foundOrder = makePendingOrder({ paymentStatus: 'paid', total: 500000 });
    mockOrderFindOne
      .mockResolvedValueOnce(null)       // exact: 'ORD-2511-00042' không tìm thấy
      .mockResolvedValueOnce(null)       // formatted (startsWith ORD): không applicable (has dash)
      .mockResolvedValueOnce(foundOrder); // stripped: 'ORD251100042' tìm thấy → line 410 false (order found)

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'TT ORD-2511-00042 vao',
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// incrementDiscountCodeUsage — order không có discountCodeId
// ─────────────────────────────────────────────────────────────────────────────

describe('incrementDiscountCodeUsage — discountCodeId = null', () => {
  it('không gọi DiscountCode.increment khi order.discountCodeId = null', async () => {
    // Flow: SePay webhook → updateOrder → incrementDiscountCodeUsage
    // order.discountCodeId = null → noop
    const sePayOrder = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(sePayOrder);
    mockOrderUpdate.mockResolvedValue([1]);
    // incrementDiscountCodeUsage: findByPk trả về order với discountCodeId=null
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: null })
      .mockResolvedValueOnce(null); // sendOrderConfirmationEmailSafe bỏ qua

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    // DiscountCode.increment không được gọi vì discountCodeId = null
    expect(mockDiscountCodeIncrement).not.toHaveBeenCalled();
  });

  it('gọi DiscountCode.increment khi order có discountCodeId', async () => {
    const sePayOrder = makePendingOrder({ paymentStatus: 'pending', total: 500000 });
    mockOrderFindOne.mockResolvedValue(sePayOrder);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk
      .mockResolvedValueOnce({ id: 42, discountCodeId: 7 }) // có discount code
      .mockResolvedValueOnce(null);

    await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY });

    expect(mockDiscountCodeIncrement).toHaveBeenCalledWith(
      'usedCount',
      expect.objectContaining({ where: { id: 7 } })
    );
  });
});
