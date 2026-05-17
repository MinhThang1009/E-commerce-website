/**
 * Integration tests cho flat payment controller (src/controllers/payment.js)
 * Sử dụng supertest để kiểm tra toàn bộ request/response pipeline.
 *
 * Bao gồm:
 * - POST /api/payments/momo/create-url
 * - POST /api/payments/vnpay/create-url
 * - GET  /api/payments/momo/return
 * - POST /api/payments/momo/ipn
 * - GET  /api/payments/vnpay/return
 * - GET  /api/payments/vnpay/ipn
 * - POST /api/payments/refund
 * - POST /api/payments/sepay-webhook
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-payment-controller-flat';
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

// authenticate: inject user vào req khi header Authorization = 'Bearer valid-token'
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

// authorize: chỉ cho admin (role=admin). Trong test user.role='customer' → 403 nếu cần admin.
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
    if (typeof cb === 'function') {
      return cb({ LOCK: { UPDATE: 'UPDATE' } });
    }
    return { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
  }),
}));

// Mockable fns per-test — definita qui come jest.fn() per poter cambiare implementazione
let mockOrderFindByPk = jest.fn();
let mockOrderFindOne = jest.fn();
let mockOrderUpdate = jest.fn();

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
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    },
    CartItem: {
      destroy: jest.fn().mockResolvedValue(0),
    },
    DiscountCode: {
      findByPk: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockResolvedValue(undefined),
    },
    Product: { findByPk: jest.fn().mockResolvedValue(null) },
    ProductVariant: { findByPk: jest.fn().mockResolvedValue(null) },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (cb) => {
        return typeof cb === 'function' ? cb({ LOCK: { UPDATE: 'UPDATE' } }) : {};
      }),
      fn: jest.fn(),
      col: jest.fn(),
      where: jest.fn(),
      literal: jest.fn(),
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
const { errorHandler } = require('../middlewares/errorHandler');
const { authenticate } = require('../middlewares/authenticate');
const { authorize } = require('../middlewares/authorize');
const { validateRequest } = require('../middlewares/validateRequest');
const Joi = require('joi');

// ── Build minimal test app ────────────────────────────────────────────────────

const createUrlSchema = Joi.object({ orderId: Joi.number().integer().positive().required() });
const refundSchema = Joi.object({
  orderId: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().optional(),
  reason: Joi.string().max(500).optional(),
});

function buildApp() {
  const app = express();
  app.use(express.json());

  // Authenticated payment routes
  app.post('/api/payments/momo/create-url', authenticate, validateRequest(createUrlSchema), paymentController.createMomoUrl);
  app.post('/api/payments/vnpay/create-url', authenticate, validateRequest(createUrlSchema), paymentController.createVNPayUrl);

  // Webhook / return routes (public)
  app.get('/api/payments/momo/return', paymentController.momoReturn);
  app.post('/api/payments/momo/ipn', paymentController.momoIPN);
  app.get('/api/payments/vnpay/return', paymentController.vnpayReturn);
  app.get('/api/payments/vnpay/ipn', paymentController.vnpayIPN);

  // Admin refund (requires admin role)
  app.post('/api/payments/refund', authenticate, authorize('admin'), validateRequest(refundSchema), paymentController.createRefund);

  // SePay webhook (public, verified by API key)
  app.post('/api/payments/sepay-webhook', paymentController.handleSePayWebhook);

  app.use(errorHandler);
  return app;
}

const app = buildApp();
const request = supertest(app);

// ── Helper order builders ─────────────────────────────────────────────────────

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

// ── POST /api/payments/momo/create-url ───────────────────────────────────────

describe('POST /api/payments/momo/create-url', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trả về 401 khi không có Authorization header', async () => {
    const res = await request
      .post('/api/payments/momo/create-url')
      .send({ orderId: 42 });

    expect(res.status).toBe(401);
  });

  it('trả về 400 khi thiếu orderId', async () => {
    const res = await request
      .post('/api/payments/momo/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('trả về 400 khi orderId không phải số nguyên dương', async () => {
    const res = await request
      .post('/api/payments/momo/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({ orderId: -1 });

    expect(res.status).toBe(400);
  });

  it('trả về 404 khi order không tồn tại', async () => {
    mockOrderFindByPk.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/momo/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({ orderId: 99 });

    expect(res.status).toBe(404);
  });

  it('trả về 200 với payUrl khi order tồn tại', async () => {
    const order = makePendingOrder();
    mockOrderFindByPk.mockResolvedValue(order);
    momoService.createPaymentUrl.mockResolvedValue({ payUrl: 'https://momo.test/pay123' });

    const res = await request
      .post('/api/payments/momo/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({ orderId: 42 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.payUrl).toBe('https://momo.test/pay123');
  });
});

// ── POST /api/payments/vnpay/create-url ──────────────────────────────────────

describe('POST /api/payments/vnpay/create-url', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trả về 401 khi không có token', async () => {
    const res = await request
      .post('/api/payments/vnpay/create-url')
      .send({ orderId: 42 });

    expect(res.status).toBe(401);
  });

  it('trả về 400 khi orderId bị thiếu', async () => {
    const res = await request
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({});

    expect(res.status).toBe(400);
  });

  it('trả về 404 khi order không tồn tại', async () => {
    mockOrderFindByPk.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({ orderId: 99 });

    expect(res.status).toBe(404);
  });

  it('trả về 200 với payment URL khi hợp lệ', async () => {
    const order = makePendingOrder();
    mockOrderFindByPk.mockResolvedValue(order);
    vnpayService.createPaymentUrl.mockReturnValue('https://vnpay.test/pay?token=xyz');

    const res = await request
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', 'Bearer valid-token')
      .send({ orderId: 42 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toContain('vnpay.test');
  });
});

// ── GET /api/payments/momo/return ─────────────────────────────────────────────

describe('GET /api/payments/momo/return', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirect về success khi resultCode = 0 và order không tồn tại', async () => {
    mockOrderFindByPk.mockResolvedValue(null);

    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '0',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=success');
  });

  it('redirect về failed khi resultCode != 0', async () => {
    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '9',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=failed');
  });

  it('cập nhật order khi resultCode = 0 và order tồn tại với paymentStatus != paid', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending' });
    mockOrderFindByPk.mockResolvedValue(order);
    // incrementDiscountCodeUsage cần Order.findByPk lần 2 cho discount check
    mockOrderFindByPk
      .mockResolvedValueOnce(order)     // lần 1: tìm order theo orderId trong extraData
      .mockResolvedValue({ id: 42, discountCodeId: null }); // lần 2: findByPk trong incrementDiscountCodeUsage

    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '0',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid', paymentProvider: 'momo' })
    );
  });

  it('không cập nhật order đã paid (idempotency)', async () => {
    const order = makePendingOrder({ paymentStatus: 'paid' });
    mockOrderFindByPk.mockResolvedValue(order);

    const res = await request.get('/api/payments/momo/return').query({
      resultCode: '0',
      extraData: 'orderId=42',
    });

    expect(res.status).toBe(302);
    expect(order.update).not.toHaveBeenCalled();
  });
});

// ── POST /api/payments/momo/ipn ───────────────────────────────────────────────

describe('POST /api/payments/momo/ipn', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trả về 400 khi signature không hợp lệ', async () => {
    momoService.verifySignature.mockReturnValue(false);

    const res = await request
      .post('/api/payments/momo/ipn')
      .send({
        resultCode: 0,
        orderId: 'ORD-1',
        transId: 'TX-1',
        extraData: 'orderId=42',
        signature: 'invalid-sig',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/chữ ký/i);
  });

  it('trả về 204 khi IPN hợp lệ nhưng resultCode != 0 (thanh toán thất bại)', async () => {
    momoService.verifySignature.mockReturnValue(true);

    const res = await request
      .post('/api/payments/momo/ipn')
      .send({
        resultCode: 99,
        orderId: 'ORD-1',
        transId: 'TX-FAIL',
        extraData: 'orderId=42',
      });

    expect(res.status).toBe(204);
  });

  it('trả về 204 và cập nhật order khi IPN hợp lệ + resultCode = 0', async () => {
    momoService.verifySignature.mockReturnValue(true);
    const order = makePendingOrder({ paymentStatus: 'pending' });
    mockOrderFindByPk
      .mockResolvedValueOnce(order)
      .mockResolvedValue({ id: 42, discountCodeId: null });

    const res = await request
      .post('/api/payments/momo/ipn')
      .send({
        resultCode: 0,
        orderId: 'ORD-2511-00042',
        transId: 'TX-MOMO-200',
        extraData: 'orderId=42',
        amount: 500000,
      });

    expect(res.status).toBe(204);
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid', paymentProvider: 'momo' })
    );
  });

  it('trả về 204 và không double-process order đã paid', async () => {
    momoService.verifySignature.mockReturnValue(true);
    const order = makePendingOrder({ paymentStatus: 'paid' });
    mockOrderFindByPk.mockResolvedValue(order);

    const res = await request
      .post('/api/payments/momo/ipn')
      .send({
        resultCode: 0,
        orderId: 'ORD-2511-00042',
        transId: 'TX-DUP',
        extraData: 'orderId=42',
        amount: 500000,
      });

    expect(res.status).toBe(204);
    expect(order.update).not.toHaveBeenCalled();
  });
});

// ── GET /api/payments/vnpay/return ───────────────────────────────────────────

describe('GET /api/payments/vnpay/return', () => {
  beforeEach(() => jest.clearAllMocks());

  it('redirect về checksum-failed khi chữ ký sai', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(false);

    const res = await request.get('/api/payments/vnpay/return').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('checksum-failed');
  });

  it('redirect về payment=success và cập nhật order khi responseCode = 00', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ paymentStatus: 'pending' });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderFindByPk.mockResolvedValue({ id: 42, discountCodeId: null });

    const res = await request.get('/api/payments/vnpay/return').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: 'VNP-TX-200',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=success');
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid', paymentProvider: 'vnpay' })
    );
  });

  it('redirect về payment=failed khi responseCode != 00', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);

    const res = await request.get('/api/payments/vnpay/return').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '24',
      vnp_TransactionNo: '',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('payment=failed');
  });

  it('không cập nhật order đã paid (idempotency)', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ paymentStatus: 'paid' });
    mockOrderFindOne.mockResolvedValue(order);

    await request.get('/api/payments/vnpay/return').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
      vnp_TransactionNo: 'VNP-TX-DUP',
    });

    expect(order.update).not.toHaveBeenCalled();
  });
});

// ── GET /api/payments/vnpay/ipn ───────────────────────────────────────────────

describe('GET /api/payments/vnpay/ipn', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trả về 200 RspCode 97 khi checksum sai', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(false);

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'ORD-X',
      vnp_ResponseCode: '00',
      vnp_Amount: '50000000',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('97');
  });

  it('trả về 200 RspCode 01 khi order không tồn tại', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    mockOrderFindOne.mockResolvedValue(null);

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'NONEXISTENT',
      vnp_ResponseCode: '00',
      vnp_Amount: '50000000',
      vnp_TransactionNo: 'TX-X',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('01');
  });

  it('trả về 200 RspCode 04 khi số tiền không khớp', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
      vnp_Amount: '100000000', // 1,000,000 VND ≠ 500,000 VND
      vnp_TransactionNo: 'TX-MISMATCH',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('04');
  });

  it('trả về 200 RspCode 02 khi order đã paid', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ total: 500000, paymentStatus: 'paid' });
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
      vnp_Amount: '50000000',
      vnp_TransactionNo: 'TX-DUP',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('02');
  });

  it('trả về 200 RspCode 00 và cập nhật paid khi responseCode = 00', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ total: 500000, paymentStatus: 'pending' });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderFindByPk.mockResolvedValue({ id: 42, discountCodeId: null });

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '00',
      vnp_Amount: '50000000',
      vnp_TransactionNo: 'VNP-OK',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('00');
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid', paymentProvider: 'vnpay' })
    );
  });

  it('trả về 200 RspCode 00 và cập nhật failed khi responseCode != 00', async () => {
    vnpayService.verifyReturnUrl.mockReturnValue(true);
    const order = makePendingOrder({ total: 500000, paymentStatus: 'pending' });
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request.get('/api/payments/vnpay/ipn').query({
      vnp_TxnRef: 'ORD-2511-00042',
      vnp_ResponseCode: '24',
      vnp_Amount: '50000000',
      vnp_TransactionNo: 'VNP-FAIL',
    });

    expect(res.status).toBe(200);
    expect(res.body.RspCode).toBe('00');
    expect(order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'failed' })
    );
  });
});

// ── POST /api/payments/refund ─────────────────────────────────────────────────

describe('POST /api/payments/refund', () => {
  beforeEach(() => jest.clearAllMocks());

  it('trả về 401 khi không có Authorization header', async () => {
    const res = await request
      .post('/api/payments/refund')
      .send({ orderId: 42 });

    expect(res.status).toBe(401);
  });

  it('trả về 403 khi user không phải admin', async () => {
    // authenticate inject user.role='customer', authorize('admin') → 403
    const res = await request
      .post('/api/payments/refund')
      .set('Authorization', 'Bearer valid-token')
      .send({ orderId: 42 });

    expect(res.status).toBe(403);
  });

  // Để test các case sau, thêm admin route riêng
  it('trả về 400 khi orderId bị thiếu (admin route)', async () => {
    // Build app với admin bypass
    const adminApp = express();
    adminApp.use(express.json());
    adminApp.post('/api/payments/refund',
      (_req, _res, next) => { _req.user = { id: 1, role: 'admin' }; next(); },
      validateRequest(refundSchema),
      paymentController.createRefund
    );
    adminApp.use(errorHandler);
    const adminRequest = supertest(adminApp);

    const res = await adminRequest.post('/api/payments/refund').send({});
    expect(res.status).toBe(400);
  });

  it('trả về 404 khi order không tồn tại (admin route)', async () => {
    mockOrderFindByPk.mockResolvedValue(null);

    const adminApp = express();
    adminApp.use(express.json());
    adminApp.post('/api/payments/refund',
      (_req, _res, next) => { _req.user = { id: 1, role: 'admin' }; next(); },
      validateRequest(refundSchema),
      paymentController.createRefund
    );
    adminApp.use(errorHandler);

    const res = await supertest(adminApp)
      .post('/api/payments/refund')
      .send({ orderId: 99 });

    expect(res.status).toBe(404);
  });

  it('trả về 400 khi order không có paymentTransactionId', async () => {
    const order = makePendingOrder({ paymentTransactionId: null });
    mockOrderFindByPk.mockResolvedValue(order);

    const adminApp = express();
    adminApp.use(express.json());
    adminApp.post('/api/payments/refund',
      (_req, _res, next) => { _req.user = { id: 1, role: 'admin' }; next(); },
      validateRequest(refundSchema),
      paymentController.createRefund
    );
    adminApp.use(errorHandler);

    const res = await supertest(adminApp)
      .post('/api/payments/refund')
      .send({ orderId: 42 });

    expect(res.status).toBe(400);
  });

  it('trả về 400 khi provider không phải vnpay', async () => {
    const order = makePendingOrder({
      paymentProvider: 'momo',
      paymentTransactionId: 'TX-MOMO',
    });
    mockOrderFindByPk.mockResolvedValue(order);

    const adminApp = express();
    adminApp.use(express.json());
    adminApp.post('/api/payments/refund',
      (_req, _res, next) => { _req.user = { id: 1, role: 'admin' }; next(); },
      validateRequest(refundSchema),
      paymentController.createRefund
    );
    adminApp.use(errorHandler);

    const res = await supertest(adminApp)
      .post('/api/payments/refund')
      .send({ orderId: 42 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/momo/i);
  });

  it('trả về 200 khi hoàn tiền VNPay thành công', async () => {
    const order = makePendingOrder({
      paymentProvider: 'vnpay',
      paymentTransactionId: 'VNP-TX-OK',
    });
    order.update = jest.fn().mockResolvedValue(undefined);
    mockOrderFindByPk.mockResolvedValue(order);
    vnpayService.refund.mockResolvedValue({ success: true, message: 'Refund OK' });

    const adminApp = express();
    adminApp.use(express.json());
    adminApp.post('/api/payments/refund',
      (_req, _res, next) => { _req.user = { id: 1, role: 'admin' }; next(); },
      validateRequest(refundSchema),
      paymentController.createRefund
    );
    adminApp.use(errorHandler);

    const res = await supertest(adminApp)
      .post('/api/payments/refund')
      .send({ orderId: 42, amount: 200000, reason: 'Hoàn hàng' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(order.update).toHaveBeenCalledWith({ paymentStatus: 'refunded' });
  });
});

// ── POST /api/payments/sepay-webhook ─────────────────────────────────────────

describe('POST /api/payments/sepay-webhook', () => {
  beforeEach(() => jest.clearAllMocks());

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
    referenceCode: 'REF-001',
    description: 'Payment test',
  };

  it('trả về 401 khi không có Authorization header', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .send(VALID_WEBHOOK_BODY);

    expect(res.status).toBe(401);
  });

  it('trả về 401 khi API key sai', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey wrong-key')
      .send(VALID_WEBHOOK_BODY);

    expect(res.status).toBe(401);
  });

  it('trả về 400 khi thiếu trường bắt buộc id', async () => {
    const { id: _id, ...bodyWithoutId } = VALID_WEBHOOK_BODY;

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send(bodyWithoutId);

    expect(res.status).toBe(400);
  });

  it('trả về 400 khi transferAmount <= 0', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferAmount: 0 });

    expect(res.status).toBe(400);
  });

  it('trả về 400 khi transferType không hợp lệ', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferType: 'unknown' });

    expect(res.status).toBe(400);
  });

  it('trả về 200 với message bỏ qua khi transferType = out', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transferType: 'out' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(res.body.message).toMatch(/tiền ra/);
  });

  it('trả về 400 khi transactionDate không hợp lệ', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, transactionDate: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ngày/i);
  });

  it('trả về 200 khi không tìm thấy order ID trong content', async () => {
    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({
        ...VALID_WEBHOOK_BODY,
        content: 'Chuyen tien khong co ma don',
        code: null,
        referenceCode: null,
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('trả về 200 khi tìm thấy order ID nhưng order không tồn tại trong DB', async () => {
    mockOrderFindOne.mockResolvedValue(null);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, content: 'Thanh toan ORD-2511-00042' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('trả về 200 khi số tiền không khớp với order', async () => {
    const order = makePendingOrder({ total: 999999 }); // khác 500000
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, content: 'Thanh toan ORD-2511-00042' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/không khớp/);
  });

  it('trả về 200 khi transaction ID đã xử lý (idempotency)', async () => {
    const order = makePendingOrder({ paymentTransactionId: '9001', total: 500000 });
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, id: 9001, content: 'Thanh toan ORD-2511-00042' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/đã được xử lý/);
  });

  it('trả về 200 khi order đã xử lý trước đó (status != pending/unpaid)', async () => {
    const order = makePendingOrder({ paymentStatus: 'paid', total: 500000, paymentTransactionId: null });
    mockOrderFindOne.mockResolvedValue(order);

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, content: 'Thanh toan ORD-2511-00042' });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/đã được xử lý/);
  });

  it('trả về 200 và cập nhật order khi thanh toán thành công', async () => {
    const order = makePendingOrder({ paymentStatus: 'pending', total: 500000, paymentTransactionId: null });
    mockOrderFindOne.mockResolvedValue(order);
    mockOrderUpdate.mockResolvedValue([1]);
    mockOrderFindByPk.mockResolvedValue({ id: 42, discountCodeId: null });

    const res = await request
      .post('/api/payments/sepay-webhook')
      .set('Authorization', 'Apikey test-sepay-api-key-12345')
      .send({ ...VALID_WEBHOOK_BODY, content: 'Thanh toan ORD-2511-00042' });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockOrderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid', paymentProvider: 'sepay' }),
      expect.objectContaining({ where: { id: order.id } })
    );
  });
});
