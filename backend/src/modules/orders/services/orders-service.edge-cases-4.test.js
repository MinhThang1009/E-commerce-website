/**
 * Tests Phase 25b — Order Additional Coverage
 *
 * Bao gồm:
 * - GET  /api/orders              — getUserOrders: trả về danh sách phân trang
 * - GET  /api/orders/:id          — getOrderById: tìm thấy, không tìm thấy, sai user
 * - GET  /api/orders/shipping-estimate — estimateShipping
 * - GET  /api/orders/number/:num  — getOrderByNumber
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase25b-order';

// ---------- Mocks ----------

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    req.user = { id: 1, role: 'customer' };
    next();
  },
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/admin-auth', () => ({
  requireSuperAdmin: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock('@services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderCancellationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(10),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-TEST'),
}));

jest.mock('@models', () => {
  const sequelizePkg = require('sequelize');

  const mockTx = {
    LOCK: { UPDATE: 'UPDATE' },
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
  };

  return {
    Product: {
      findByPk: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    },
    ProductVariant: {
      findByPk: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
    },
    Cart: {
      findOrCreate: jest.fn().mockResolvedValue([{ id: 10 }, false]),
      findOne: jest.fn().mockResolvedValue(null),
      findByPk: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue([1]),
    },
    CartItem: {
      findOne: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 1 }),
      destroy: jest.fn().mockResolvedValue(1),
    },
    User: {
      findByPk: jest.fn().mockResolvedValue({ id: 1, update: jest.fn() }),
    },
    Order: {
      findByPk: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      findAndCountAll: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
      create: jest.fn().mockResolvedValue({ id: 100 }),
      update: jest.fn().mockResolvedValue([1]),
    },
    OrderItem: {
      findAll: jest.fn().mockResolvedValue([]),
      bulkCreate: jest.fn().mockResolvedValue([]),
    },
    Review: { findAll: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    ProductAttribute: { findAll: jest.fn().mockResolvedValue([]) },
    ProductSpecification: { findAll: jest.fn().mockResolvedValue([]) },
    ProductImage: { findAll: jest.fn().mockResolvedValue([]) },
    InventoryLog: { create: jest.fn().mockResolvedValue({}) },
    SearchHistory: { findAll: jest.fn().mockResolvedValue([]) },
    Category: { findAll: jest.fn().mockResolvedValue([]) },
    DiscountCode: {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue([1]),
    },
    sequelize: {
      transaction: jest.fn().mockResolvedValue(mockTx),
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
const buildOrdersModule = require('@modules/orders/module');
const {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  InventoryLog,
  sequelize,
} = require('@models');
const eventBus = require('@shared/event-bus');
const logger = require('@utils/logger');
const emailService = require('@services/email');
const constants = require('../../../constants');
const { errorHandler } = require('@middlewares/error-handler');

const ordersModule = buildOrdersModule({
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  DiscountCode,
  InventoryLog,
  sequelize,
  eventBus,
  logger,
  emailService,
  constants,
});

const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.cookies = {};
  next();
});
app.use('/api/orders', ordersModule.router);
app.use(errorHandler);
const request = supertest(app);

// ============================================================
// GET /api/orders — getUserOrders
// ============================================================

describe('GET /api/orders — lấy danh sách đơn hàng của user', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Không có đơn hàng → 200 với data = []', async () => {
    Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const res = await request.get('/api/orders').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  test('Có 2 đơn hàng → 200 với data đúng, phân trang', async () => {
    const mockOrders = [
      { id: 1, userId: 1, orderNumber: 'ORD-001', status: 'pending', totalAmount: 500000 },
      { id: 2, userId: 1, orderNumber: 'ORD-002', status: 'delivered', totalAmount: 1000000 },
    ];
    Order.findAndCountAll.mockResolvedValue({ count: 2, rows: mockOrders });

    const res = await request
      .get('/api/orders?page=1&limit=10')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.total).toBe(2);
    expect(res.body.page).toBe(1);
  });
});

// ============================================================
// GET /api/orders/:id — getOrderById
// ============================================================

describe('GET /api/orders/:id — lấy chi tiết đơn hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Đơn hàng tồn tại, thuộc về user → 200', async () => {
    Order.findByPk.mockResolvedValue({
      id: 1,
      userId: 1, // khớp req.user.id = 1
      orderNumber: 'ORD-001',
      status: 'pending',
    });

    const res = await request.get('/api/orders/1').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.id).toBe(1);
  });

  test('Đơn hàng không tồn tại → 404', async () => {
    Order.findByPk.mockResolvedValue(null);

    const res = await request.get('/api/orders/9999').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/không tìm thấy/i);
  });

  test('Đơn hàng thuộc user khác (non-admin) → 403', async () => {
    Order.findByPk.mockResolvedValue({
      id: 1,
      userId: 99, // khác req.user.id = 1
      orderNumber: 'ORD-001',
      status: 'pending',
    });

    const res = await request.get('/api/orders/1').set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/không có quyền/i);
  });
});

// ============================================================
// GET /api/orders/shipping-estimate — estimateShipping
// ============================================================

describe('GET /api/orders/shipping-estimate — tính phí vận chuyển', () => {
  test('Subtotal 500000 → dưới ngưỡng miễn phí → shippingCost = null (tính theo km trên FE)', async () => {
    const res = await request
      .get('/api/orders/shipping-estimate?subtotal=500000')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.shippingCost).toBeNull();
  });

  test('Subtotal 5000000 (ngưỡng miễn phí) → phí ship = 0', async () => {
    const res = await request
      .get('/api/orders/shipping-estimate?subtotal=5000000')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.shippingCost).toBe(0);
    expect(res.body.data.freeShippingThreshold).toBe(5000000);
  });

  test('Không truyền params → 200 với default values', async () => {
    const res = await request
      .get('/api/orders/shipping-estimate')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    // subtotal default = 0 < 5000000 → shippingCost = null; freeShippingThreshold luôn có mặt
    expect(res.body.data).toHaveProperty('freeShippingThreshold');
  });
});

// ============================================================
// GET /api/orders/number/:number — getOrderByNumber
// ============================================================

describe('GET /api/orders/number/:number — lấy đơn hàng theo mã', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Mã đơn hàng tồn tại, thuộc user → 200', async () => {
    Order.findOne = jest.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      orderNumber: 'ORD-001',
      status: 'pending',
    });

    const res = await request
      .get('/api/orders/number/ORD-001')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data.orderNumber).toBe('ORD-001');
  });

  test('Mã đơn hàng không tồn tại → 404', async () => {
    Order.findOne = jest.fn().mockResolvedValue(null);

    const res = await request
      .get('/api/orders/number/ORD-NOTFOUND')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
  });
});

// ============================================================
// POST /api/orders/:id/cancel — cancelOrder
// ============================================================

describe('POST /api/orders/:id/cancel — hủy đơn hàng', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Phase 42 modules/orders dùng callback form sequelize.transaction(async (tx) => {...})
    sequelize.transaction.mockImplementation(async (cb) => {
      const tx = {
        LOCK: { UPDATE: 'UPDATE' },
        commit: jest.fn().mockResolvedValue(undefined),
        rollback: jest.fn().mockResolvedValue(undefined),
      };
      return typeof cb === 'function' ? cb(tx) : tx;
    });
  });

  test('Đơn hàng không tồn tại hoặc không thuộc user → 404', async () => {
    Order.findOne = jest.fn().mockResolvedValue(null);

    const res = await request
      .post('/api/orders/999/cancel')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/không tìm thấy/i);
  });

  test('Đơn hàng status = delivered → không thể hủy → 422 (DomainError)', async () => {
    // Phase 42 modules/orders dùng OrderAggregate.cancel() throw DomainError → 422
    // (semantic violation, request well-formed nhưng vi phạm invariant)
    Order.findOne = jest.fn().mockResolvedValue({
      id: 1,
      userId: 1,
      number: 'ORD-001',
      status: 'delivered', // không thể hủy
      items: [],
    });

    const res = await request
      .post('/api/orders/1/cancel')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(422);
    expect(res.body.message).toMatch(/không thể hủy/i);
  });
});

// ============================================================
// GET /api/orders/admin/all — getAllOrders (admin)
// ============================================================

describe('GET /api/orders/admin/all — lấy tất cả đơn hàng (admin)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Không có filter → 200 với tất cả đơn hàng phân trang', async () => {
    Order.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: 1, userId: 1, status: 'pending', totalAmount: 300000 }],
    });

    const res = await request
      .get('/api/orders/admin/all')
      .set('Authorization', 'Bearer test-token');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.total).toBe(1);
  });
});
