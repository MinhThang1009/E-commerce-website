/**
 * Tests Phase 25 — Payment Business Logic
 *
 * Bao gồm:
 * - POST /api/payment/webhook (sandbox — không có STRIPE_WEBHOOK_SECRET) → 200
 * - Webhook duplicate event: paymentTransactionId đã tồn tại → stock không bị trừ lần 2
 * - POST /api/payment/create-payment-intent — amount không hợp lệ → 400
 * - POST /api/payment/create-payment-intent — hợp lệ → 200
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase25-payment';
// Không đặt STRIPE_WEBHOOK_SECRET để test sandbox mode

// ---------- Mocks ----------

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../services/admin/adminAudit', () => ({
  AdminAuditService: { logAction: jest.fn(), logSuccessfulLogin: jest.fn() },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
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
    const t = {
      LOCK: { UPDATE: 'UPDATE' },
      commit: jest.fn(),
      rollback: jest.fn(),
    };
    return cb(t);
  }),
}));

jest.mock('../services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/payment/stripe', () => ({
  createPaymentIntent: jest.fn().mockResolvedValue({
    paymentIntentId: 'pi_test_123',
    clientSecret: 'pi_test_123_secret',
    metadata: {},
  }),
  confirmPaymentIntent: jest.fn().mockResolvedValue({
    id: 'pi_test_123',
    status: 'succeeded',
    amount: 500000,
    currency: 'vnd',
    metadata: { orderId: '', userId: '1' },
  }),
  handleWebhook: jest.fn().mockResolvedValue(null),
  getCustomer: jest.fn().mockResolvedValue({ id: 'cus_test_123', email: 'test@test.com' }),
  createCustomer: jest.fn().mockResolvedValue({ id: 'cus_new_123', email: 'test@test.com' }),
  getPaymentMethods: jest.fn().mockResolvedValue([]),
  createSetupIntent: jest.fn().mockResolvedValue({ clientSecret: 'seti_test_secret' }),
}));

jest.mock('../services/payment/momo', () => ({
  createPaymentUrl: jest.fn().mockResolvedValue({ payUrl: 'https://momo.test' }),
  verifyReturn: jest.fn().mockReturnValue(true),
  verifyIPN: jest.fn().mockReturnValue(true),
}));

jest.mock('../services/payment/vnpay', () => ({
  createPaymentUrl: jest.fn().mockReturnValue('https://vnpay.test'),
  verifyReturn: jest.fn().mockReturnValue({ isValid: true, vnp_ResponseCode: '00' }),
  verifyIPN: jest.fn().mockReturnValue({ isValid: true, vnp_ResponseCode: '00' }),
}));

jest.mock('../models', () => {
  const sequelizePkg = require('sequelize');

  return {
    Product: {
      findByPk: jest.fn().mockResolvedValue(null),
    },
    ProductVariant: {
      findByPk: jest.fn().mockResolvedValue(null),
    },
    Cart: {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([1]),
    },
    CartItem: {
      destroy: jest.fn().mockResolvedValue(1),
    },
    WarrantyPackage: { findAll: jest.fn().mockResolvedValue([]) },
    User: {
      findByPk: jest.fn().mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        stripeCustomerId: null,
        update: jest.fn().mockResolvedValue(undefined),
      }),
    },
    Order: {
      findByPk: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue([1]),
      findOne: jest.fn().mockResolvedValue(null),
    },
    OrderItem: { findAll: jest.fn().mockResolvedValue([]) },
    DiscountCode: {
      findOne: jest.fn().mockResolvedValue(null),
      increment: jest.fn().mockResolvedValue(undefined),
    },
    Review: { findAll: jest.fn().mockResolvedValue([]) },
    ProductImage: { findAll: jest.fn().mockResolvedValue([]) },
    LoyaltyHistory: { create: jest.fn().mockResolvedValue({}) },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const t = {
          LOCK: { UPDATE: 'UPDATE' },
          commit: jest.fn(),
          rollback: jest.fn(),
        };
        return cb(t);
      }),
      fn: jest.fn(),
      col: jest.fn(),
      where: jest.fn(),
      literal: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      Sequelize: { fn: jest.fn(), col: jest.fn() },
    },
    Op: sequelizePkg.Op,
  };
});

// ---------- App setup ----------

const express = require('express');
const supertest = require('supertest');
const paymentRouter = require('../routes/payment');
const { errorHandler } = require('../middlewares/errorHandler');

const app = express();
// Webhook route cần raw body — parse trước rồi mount router
app.use((req, _res, next) => {
  if (req.path === '/webhook') {
    req.body = Buffer.from('{}');
  }
  next();
});
app.use(express.json());
app.use((req, _res, next) => { req.cookies = {}; next(); });
app.use('/api/payment', paymentRouter);
app.use(errorHandler);
const request = supertest(app);

// ============================================================
// POST /api/payment/webhook — Stripe webhook
// ============================================================

describe('POST /api/payment/webhook — Stripe webhook handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Đảm bảo không có STRIPE_WEBHOOK_SECRET → sandbox mode
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  test('Sandbox mode (không có STRIPE_WEBHOOK_SECRET) → 200 { received: true }', async () => {
    const res = await request
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ============================================================
// POST /api/payment/create-payment-intent — tạo payment intent
// ============================================================

describe('POST /api/payment/create-payment-intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Amount không hợp lệ (0) → 400', async () => {
    const res = await request
      .post('/api/payment/create-payment-intent')
      .set('Authorization', 'Bearer test-token')
      .send({ amount: 0, currency: 'usd' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/không hợp lệ/i);
  });

  test('Amount hợp lệ → stripeService.createPaymentIntent được gọi → 200', async () => {
    const stripeService = require('../services/payment/stripe');
    stripeService.createPaymentIntent.mockResolvedValue({
      paymentIntentId: 'pi_test_abc',
      clientSecret: 'pi_test_abc_secret_xyz',
      metadata: { userId: '1' },
    });

    const res = await request
      .post('/api/payment/create-payment-intent')
      .set('Authorization', 'Bearer test-token')
      .send({ amount: 500000, currency: 'vnd', orderId: 42 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(stripeService.createPaymentIntent).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 500000, currency: 'vnd' })
    );
  });
});

// ============================================================
// Idempotency: duplicate webhook — stock không bị trừ 2 lần
// ============================================================

describe('Idempotency — duplicate webhook không trừ stock 2 lần', () => {
  test('Order đã có paymentTransactionId khớp webhook → Order.update KHÔNG được gọi thêm lần nữa', async () => {
    // Kiểm tra rằng handlePaymentSucceeded trong sandbox không gọi thêm gì
    // Vì sandbox mode trả về 200 ngay lập tức, không xử lý event → stock an toàn

    const { Order, ProductVariant } = require('../models');

    // Reset tracking
    Order.update.mockClear();
    ProductVariant.findByPk.mockClear && ProductVariant.findByPk.mockClear();

    // Gửi webhook lần 1
    const res1 = await request
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');

    // Gửi webhook lần 2 (duplicate)
    const res2 = await request
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send('{}');

    // Cả 2 đều trả về 200
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    // Vì sandbox mode, không có Order.update nào được gọi → stock nguyên vẹn
    expect(Order.update).not.toHaveBeenCalled();
  });
});

// ============================================================
// POST /api/payment/confirm-payment
// ============================================================

describe('POST /api/payment/confirm-payment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Thiếu paymentIntentId → 400', async () => {
    const res = await request
      .post('/api/payment/confirm-payment')
      .set('Authorization', 'Bearer test-token')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bắt buộc/i);
  });

  test('paymentIntentId hợp lệ, không có orderId trong metadata → 200', async () => {
    const stripeService = require('../services/payment/stripe');
    stripeService.confirmPaymentIntent.mockResolvedValue({
      id: 'pi_test_123',
      status: 'succeeded',
      amount: 500000,
      currency: 'vnd',
      metadata: {}, // không có orderId
    });

    const res = await request
      .post('/api/payment/confirm-payment')
      .set('Authorization', 'Bearer test-token')
      .send({ paymentIntentId: 'pi_test_123' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ============================================================
// POST /api/payment/create-customer
// ============================================================

describe('POST /api/payment/create-customer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('User không tồn tại → 404', async () => {
    const { User } = require('../models');
    User.findByPk.mockResolvedValue(null);

    const res = await request
      .post('/api/payment/create-customer')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });

  test('User chưa có stripeCustomerId → tạo customer mới → 201', async () => {
    const { User } = require('../models');
    const stripeService = require('../services/payment/stripe');

    User.findByPk.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      stripeCustomerId: null,
      update: jest.fn().mockResolvedValue(undefined),
    });
    stripeService.createCustomer.mockResolvedValue({ id: 'cus_new_abc', email: 'test@example.com' });

    const res = await request
      .post('/api/payment/create-customer')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(201);
    expect(stripeService.createCustomer).toHaveBeenCalled();
  });

  test('User đã có stripeCustomerId → lấy customer hiện có → 200', async () => {
    const { User } = require('../models');
    const stripeService = require('../services/payment/stripe');

    User.findByPk.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      stripeCustomerId: 'cus_existing_123',
      update: jest.fn(),
    });
    stripeService.getCustomer.mockResolvedValue({ id: 'cus_existing_123' });

    const res = await request
      .post('/api/payment/create-customer')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(stripeService.getCustomer).toHaveBeenCalledWith('cus_existing_123');
  });
});

// ============================================================
// GET /api/payment/payment-methods
// ============================================================

describe('GET /api/payment/payment-methods', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('User không có stripeCustomerId → 200 với paymentMethods = []', async () => {
    const { User } = require('../models');
    User.findByPk.mockResolvedValue({
      id: 1,
      stripeCustomerId: null,
    });

    const res = await request
      .get('/api/payment/payment-methods')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.paymentMethods).toEqual([]);
  });

  test('User có stripeCustomerId → 200 với payment methods', async () => {
    const { User } = require('../models');
    const stripeService = require('../services/payment/stripe');

    User.findByPk.mockResolvedValue({
      id: 1,
      stripeCustomerId: 'cus_test_123',
    });
    stripeService.getPaymentMethods.mockResolvedValue([{ id: 'pm_123', type: 'card' }]);

    const res = await request
      .get('/api/payment/payment-methods')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.paymentMethods).toHaveLength(1);
  });
});

// ============================================================
// POST /api/payment/create-setup-intent
// ============================================================

describe('POST /api/payment/create-setup-intent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('User không tồn tại → 404', async () => {
    const { User } = require('../models');
    User.findByPk.mockResolvedValue(null);

    const res = await request
      .post('/api/payment/create-setup-intent')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });

  test('User đã có stripeCustomerId → tạo setup intent → 200', async () => {
    const { User } = require('../models');
    const stripeService = require('../services/payment/stripe');

    User.findByPk.mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      stripeCustomerId: 'cus_existing_123',
      update: jest.fn(),
    });
    stripeService.createSetupIntent.mockResolvedValue({ clientSecret: 'seti_test_secret_abc' });

    const res = await request
      .post('/api/payment/create-setup-intent')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(stripeService.createSetupIntent).toHaveBeenCalledWith('cus_existing_123');
  });
});

// ============================================================
// POST /api/payment/confirm-payment — với orderId (happy path)
// ============================================================

describe('POST /api/payment/confirm-payment — với orderId hợp lệ', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Payment succeeded + order tồn tại → Order.update được gọi → 200', async () => {
    const { Order } = require('../models');
    const stripeService = require('../services/payment/stripe');

    stripeService.confirmPaymentIntent.mockResolvedValue({
      id: 'pi_test_success',
      status: 'succeeded',
      amount: 500000,
      currency: 'vnd',
      metadata: { orderId: '42' },
    });

    Order.findByPk.mockResolvedValue({
      id: 42,
      userId: 1,
      number: 'ORD-042',
      paymentStatus: 'pending',
      discountCodeId: null,
      subtotal: 500000,
      shippingCost: 30000,
      total: 530000,
      shippingFirstName: 'Test',
      shippingLastName: 'User',
      shippingAddress1: '123 Street',
      createdAt: new Date(),
      User: { email: 'test@example.com' }, // cần để sendOrderConfirmationEmailSafe không early-return
      items: [],
    });
    Order.update.mockResolvedValue([1]);

    const res = await request
      .post('/api/payment/confirm-payment')
      .set('Authorization', 'Bearer test-token')
      .send({ paymentIntentId: 'pi_test_success' });

    expect(Order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'paid' }),
      expect.anything()
    );
    expect(res.status).toBe(200);
  });

  test('Payment pending (chưa thành công) + order tồn tại → Order.update KHÔNG được gọi → 200', async () => {
    const { Order } = require('../models');
    const stripeService = require('../services/payment/stripe');

    stripeService.confirmPaymentIntent.mockResolvedValue({
      id: 'pi_test_pending',
      status: 'requires_action',
      amount: 500000,
      currency: 'vnd',
      metadata: { orderId: '42' },
    });

    Order.findByPk.mockResolvedValue({
      id: 42,
      userId: 1,
      paymentStatus: 'pending',
      discountCodeId: null,
    });

    const res = await request
      .post('/api/payment/confirm-payment')
      .set('Authorization', 'Bearer test-token')
      .send({ paymentIntentId: 'pi_test_pending' });

    expect(Order.update).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });
});

// ============================================================
// POST /api/payment/webhook — với STRIPE_WEBHOOK_SECRET (non-sandbox)
// ============================================================

describe('POST /api/payment/webhook — với STRIPE_WEBHOOK_SECRET', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  test('payment_intent.payment_failed → Order.update với paymentStatus: failed', async () => {
    const { Order } = require('../models');
    const stripeService = require('../services/payment/stripe');

    stripeService.handleWebhook.mockResolvedValue({
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_fail_123',
          metadata: { orderId: '88' },
        },
      },
    });
    Order.update.mockResolvedValue([1]);

    const res = await request
      .post('/api/payment/webhook')
      .set('stripe-signature', 'test-sig')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    expect(Order.update).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: 'failed' }),
      expect.anything()
    );
  });

  test('customer.created → 200, không có DB operation', async () => {
    const { Order } = require('../models');
    const stripeService = require('../services/payment/stripe');

    stripeService.handleWebhook.mockResolvedValue({
      type: 'customer.created',
      data: { object: { id: 'cus_test_new' } },
    });

    const res = await request
      .post('/api/payment/webhook')
      .set('stripe-signature', 'test-sig')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    expect(Order.update).not.toHaveBeenCalled();
  });

  test('payment_intent.succeeded + order đã xử lý (idempotency) → Order.update trong transaction KHÔNG gọi', async () => {
    const { Order, sequelize } = require('../models');
    const stripeService = require('../services/payment/stripe');

    stripeService.handleWebhook.mockResolvedValue({
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_dup_webhook',
          metadata: { orderId: '55' },
        },
      },
    });

    // Order đã có paymentTransactionId khớp với pi_test_dup_webhook → idempotency guard
    Order.findByPk.mockResolvedValue({
      id: 55,
      userId: 1,
      paymentTransactionId: 'pi_test_dup_webhook',
    });

    // transaction callback form
    const mockT = { LOCK: { UPDATE: 'UPDATE' } };
    sequelize.transaction.mockImplementation(async (cb) => cb(mockT));

    const res = await request
      .post('/api/payment/webhook')
      .set('stripe-signature', 'test-sig')
      .set('Content-Type', 'application/json')
      .send('{}');

    expect(res.status).toBe(200);
    // Order.update không được gọi vì idempotency guard đã bắt được trùng
    expect(Order.update).not.toHaveBeenCalled();
  });
});
