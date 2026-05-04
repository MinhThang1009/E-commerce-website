/**
 * Tests Phase 3 — Payment & Order Flow
 *
 * Bao gồm:
 * - Webhook idempotency: gọi webhook 2 lần cùng paymentTransactionId → xử lý 1 lần
 * - Revenue filter: getDashboardStats dùng paymentStatus NOT IN ['refunded','failed']
 * - Loyalty points: tính từ subtotal (không phải total gồm cả shipping)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase3';
process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret-phase3';

// ---------- Mutable mock state (prefixed mock* cho jest.mock hoist) ----------

let mockOrderFindByPkImpl = jest.fn();
let mockUserFindByPkImpl = jest.fn();
let mockTransactionCb = jest.fn();

// ---------- Mocks ----------

jest.mock('../services/payment/stripe', () => ({
  handleWebhook: jest.fn(),
  createPaymentIntent: jest.fn(),
  createCustomer: jest.fn(),
}));

jest.mock('../services/payment/momo', () => ({
  createPayment: jest.fn(),
  verifySignature: jest.fn().mockReturnValue(true),
}));

jest.mock('../services/payment/vnpay', () => ({
  createPaymentUrl: jest.fn(),
  verifyReturnUrl: jest.fn().mockReturnValue(true),
}));

jest.mock('../services/email', () => ({
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(undefined),
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../services/adminAudit', () => ({
  AdminAuditService: {
    logSuccessfulLogin: jest.fn(),
    logAction: jest.fn(),
  },
  // auditMiddleware được dùng trong routes/admin.js
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/adminAuth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../utils/productHelpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-001'),
}));

jest.mock('../services/ai/vectorStore', () => ({
  addProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

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
    req.user = req.headers['x-test-admin'] === 'true'
      ? { id: 1, role: 'admin' }
      : { id: 2, role: 'customer' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

// Mock config/sequelize cho payment.js (dùng trực tiếp, không qua models)
jest.mock('../config/sequelize', () => ({
  define: jest.fn().mockImplementation(() => {
    class MockModel {}
    return MockModel;
  }),
  transaction: jest.fn().mockImplementation(async (cb) => {
    const mockT = { LOCK: { UPDATE: 'UPDATE' } };
    return mockTransactionCb(cb, mockT);
  }),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
}));

// Models mock
jest.mock('../models', () => {
  const sequelizePkg = require('sequelize');
  return {
    Order: {
      findByPk: jest.fn().mockImplementation((...args) => mockOrderFindByPkImpl(...args)),
      update: jest.fn().mockResolvedValue([1]),
      findAll: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      sum: jest.fn().mockResolvedValue(0),
    },
    User: {
      findByPk: jest.fn().mockImplementation((...args) => mockUserFindByPkImpl(...args)),
      count: jest.fn().mockResolvedValue(0),
      findAll: jest.fn().mockResolvedValue([]),
    },
    OrderItem: {
      create: jest.fn().mockResolvedValue({}),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Product: {
      findByPk: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ProductVariant: {
      findByPk: jest.fn().mockResolvedValue(null),
      decrement: jest.fn().mockResolvedValue(undefined),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Cart: {
      findOne: jest.fn().mockResolvedValue(null),
      destroy: jest.fn().mockResolvedValue(1),
    },
    CartItem: {
      findAll: jest.fn().mockResolvedValue([]),
      destroy: jest.fn().mockResolvedValue(1),
    },
    DiscountCode: {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue([1]),
    },
    LoyaltyHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    InventoryLog: {
      create: jest.fn().mockResolvedValue({}),
      bulkCreate: jest.fn().mockResolvedValue([]),
    },
    Review: { count: jest.fn().mockResolvedValue(0), findAll: jest.fn().mockResolvedValue([]) },
    Category: { count: jest.fn().mockResolvedValue(0), findAll: jest.fn().mockResolvedValue([]) },
    ProductAttribute: { findAll: jest.fn().mockResolvedValue([]) },
    ProductSpecification: { findAll: jest.fn().mockResolvedValue([]) },
    ProductImage: { findAll: jest.fn().mockResolvedValue([]) },
    ProductWarranty: { findAll: jest.fn().mockResolvedValue([]) },
    ProductCategory: { findAll: jest.fn().mockResolvedValue([]) },
    WarrantyPackage: { findAll: jest.fn().mockResolvedValue([]) },
    Wishlist: { count: jest.fn().mockResolvedValue(0) },
    Address: { findAll: jest.fn().mockResolvedValue([]) },
    SearchHistory: { findAll: jest.fn().mockResolvedValue([]) },
    RecentlyViewed: { findAll: jest.fn().mockResolvedValue([]) },
    ChatMessage: { create: jest.fn().mockResolvedValue({}) },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const mockT = { LOCK: { UPDATE: 'UPDATE' } };
        return mockTransactionCb(cb, mockT);
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

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');

// ============================================================
// 1. Webhook idempotency — stripe payment_intent.succeeded
// ============================================================

describe('handlePaymentSucceeded — idempotency guard (paymentTransactionId)', () => {
  let app;

  beforeAll(() => {
    const paymentRouter = require('../routes/payment');
    app = express();
    app.use('/api/payment', express.raw({ type: '*/*' }), paymentRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Khôi phục default: transaction thực thi callback
    mockTransactionCb.mockImplementation(async (cb, t) => cb(t));
  });

  test('Webhook với paymentTransactionId trùng khớp → không gọi sequelize.transaction', async () => {
    const PI_ID = 'pi_already_processed_123';
    const stripeService = require('../services/payment/stripe');
    const { sequelize } = require('../models');

    mockOrderFindByPkImpl.mockResolvedValue({
      id: 1,
      userId: 2,
      paymentTransactionId: PI_ID, // khớp → idempotency guard return sớm
      update: jest.fn().mockResolvedValue(undefined),
    });

    stripeService.handleWebhook.mockResolvedValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: PI_ID, metadata: { orderId: '1' } } },
    });

    const res = await supertest(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'test-sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

    expect(res.status).toBe(200);
    // Idempotency guard → return ngay, không vào transaction
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  test('Webhook với paymentTransactionId mới → gọi sequelize.transaction (fallback path)', async () => {
    const PI_ID = 'pi_new_456';
    const stripeService = require('../services/payment/stripe');
    const sequelizeConfig = require('../config/sequelize');

    const mockOrder = {
      id: 1,
      userId: 2,
      paymentTransactionId: null, // chưa xử lý → sẽ vào transaction
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockOrderFindByPkImpl
      .mockResolvedValueOnce(mockOrder)  // outer findByPk
      .mockResolvedValueOnce(mockOrder); // inner findByPk (trong transaction với lock)

    stripeService.handleWebhook.mockResolvedValue({
      type: 'payment_intent.succeeded',
      data: { object: { id: PI_ID, metadata: { orderId: '1' } } },
    });

    const res = await supertest(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'test-sig')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'payment_intent.succeeded' }));

    expect(res.status).toBe(200);
    // paymentTransactionId mới → vào transaction fallback
    expect(sequelizeConfig.transaction).toHaveBeenCalled();
  });
});

// ============================================================
// 2. getDashboardStats — revenue filter loại trừ refunded/failed
// ============================================================

describe('getDashboardStats — Order.sum loại trừ paymentStatus refunded/failed', () => {
  let app;

  beforeAll(() => {
    const adminRouter = require('../routes/admin');
    app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use(errorHandler);
  });

  test('Order.sum được gọi với paymentStatus: { [Op.notIn]: ["refunded", "failed"] }', async () => {
    const { Order } = require('../models');
    // Đặt mock trả về 0 cho tất cả (để không crash)
    Order.sum.mockResolvedValue(0);
    Order.count.mockResolvedValue(0);
    Order.findAll.mockResolvedValue([]);

    const res = await supertest(app)
      .get('/api/admin/dashboard')
      .set('x-test-admin', 'true');

    expect(res.status).toBe(200);

    // Verify ít nhất 1 lần Order.sum có paymentStatus filter đúng
    const sumCalls = Order.sum.mock.calls;
    const hasPaymentFilter = sumCalls.some(([field, opts]) => {
      const where = opts?.where || {};
      return (
        field === 'total' &&
        where.paymentStatus &&
        where.paymentStatus[Op.notIn] &&
        where.paymentStatus[Op.notIn].includes('refunded') &&
        where.paymentStatus[Op.notIn].includes('failed')
      );
    });

    expect(hasPaymentFilter).toBe(true);
  });
});

// ============================================================
// 3. Loyalty points — tính từ subtotal, không phải total
// ============================================================

describe('updateOrderStatus → loyalty points = floor(subtotal / 100000)', () => {
  let app;
  const POINTS_EARN_RATE = 100000;

  beforeAll(() => {
    const orderRouter = require('../routes/order');
    app = express();
    app.use(express.json());
    app.use('/api/orders', orderRouter);
    app.use(errorHandler);
  });

  test('Chuyển sang "delivered" → pointsEarned = floor(subtotal / rate), không dùng total', async () => {
    const SUBTOTAL = 500000; // 5 points khi tính đúng
    const TOTAL = 600000;    // 6 points nếu tính sai bằng total (shipping 100k)
    const INITIAL_POINTS = 100;
    const EXPECTED_POINTS = INITIAL_POINTS + Math.floor(SUBTOTAL / POINTS_EARN_RATE); // 105

    const { Order, User, LoyaltyHistory } = require('../models');

    const mockUserInstance = {
      id: 2,
      loyaltyPoints: INITIAL_POINTS,
      update: jest.fn().mockResolvedValue(undefined),
    };

    const mockOrderInstance = {
      id: 1,
      userId: 2,
      number: 'ORD-TEST-001',
      subtotal: SUBTOTAL,
      total: TOTAL,
      status: 'processing',
      paymentMethod: 'stripe',
      user: { id: 2, email: 'user@test.com', firstName: 'Test', lastName: 'User' },
      createdAt: new Date(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    // Override mock implementations trực tiếp trên mock objects
    Order.findByPk.mockResolvedValue(mockOrderInstance);
    User.findByPk.mockResolvedValue(mockUserInstance);
    LoyaltyHistory.create.mockResolvedValue({});

    await supertest(app)
      .patch('/api/orders/admin/1/status')
      .set('x-test-admin', 'true')
      .send({ status: 'delivered' });

    // Verify user.update được gọi với loyaltyPoints đúng
    expect(mockUserInstance.update).toHaveBeenCalledWith(
      expect.objectContaining({ loyaltyPoints: EXPECTED_POINTS }) // 105
    );

    // Đảm bảo KHÔNG tính sai bằng total (106 điểm)
    const wrongPoints = INITIAL_POINTS + Math.floor(TOTAL / POINTS_EARN_RATE);
    expect(EXPECTED_POINTS).not.toBe(wrongPoints); // 105 ≠ 106
  });
});
