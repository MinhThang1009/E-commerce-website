/**
 * Unit tests cho admin-service.js — User Management section (lines 1-200+)
 * Test qua HTTP route (supertest) vì các hàm dùng catchAsync(req, res) pattern.
 * Bổ sung các edge case chưa có trong admin-controller.test.js.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-admin-service-unit';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-UNIT'),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
  loadPromise: Promise.resolve(),
  items: [],
  enrichProductData: jest.fn((x) => x),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    req.user = req._mockUser || { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
  adminAuthenticate: (req, _res, next) => {
    req.user = req._mockUser || { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    req.user = req._mockUser || { id: 1, role: 'admin', email: 'admin@test.com' };
    next();
  },
  requireSuperAdmin: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
  validate: (rules) => [...(Array.isArray(rules) ? rules : []), (_req, _res, next) => next()],
  validateExpressValidator: (_req, _res, next) => next(),
}));

jest.mock('@shared/admin-audit', () => ({
  AdminAuditService: class {
    static logUserAction() {}
    static logProductAction() {}
    static logOrderAction() {}
    log() {}
  },
  auditMiddleware: (_req, _res, next) => next(),
}));

jest.mock('@modules/admin/controllers/admin-import-controller', () => ({
  getImportTemplate: (_req, _res, next) => next(),
  uploadImportFile: (_req, _res, next) => next(),
  importProducts: (_req, _res, next) => next(),
  getImportHistory: (_req, _res, next) => next(),
  exportProducts: (_req, _res, next) => next(),
}));

jest.mock('@modules/discount-code/controllers/discount-code-controller', () => ({
  getAllDiscountCodes: (_req, _res, next) => next(),
  getDiscountCodeById: (_req, _res, next) => next(),
  createDiscountCode: (_req, _res, next) => next(),
  updateDiscountCode: (_req, _res, next) => next(),
  deleteDiscountCode: (_req, _res, next) => next(),
}));

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
}));

jest.mock('@models', () => {
  const mockTransaction = {
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    LOCK: { UPDATE: 'UPDATE' },
  };

  return {
    User: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      sum: jest.fn(),
    },
    Order: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      sum: jest.fn(),
      update: jest.fn(),
    },
    OrderItem: { findAll: jest.fn(), create: jest.fn() },
    Product: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      findByPk: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    ProductVariant: {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
      sum: jest.fn(),
      bulkCreate: jest.fn(),
    },
    ProductImage: { bulkCreate: jest.fn(), destroy: jest.fn() },
    ProductAttribute: {
      findAll: jest.fn(),
      create: jest.fn(),
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    },
    ProductSpecification: {
      findAll: jest.fn(),
      create: jest.fn(),
      bulkCreate: jest.fn(),
      destroy: jest.fn(),
    },
    ProductWarranty: { create: jest.fn(), destroy: jest.fn(), bulkCreate: jest.fn() },
    ProductCategory: { destroy: jest.fn(), bulkCreate: jest.fn() },
    Review: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      findByPk: jest.fn(),
      count: jest.fn(),
    },
    Category: { findAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
    CartItem: { destroy: jest.fn() },
    Wishlist: { destroy: jest.fn() },
    Address: {},
    LoyaltyHistory: { create: jest.fn() },
    SearchHistory: {},
    RecentlyViewed: {},
    InventoryLog: { create: jest.fn(), findAndCountAll: jest.fn() },
    AuditLog: {
      findAll: jest.fn(),
      findAndCountAll: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
    },
    ChatMessage: { count: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
    WarrantyPackage: { findAll: jest.fn(), findByPk: jest.fn() },
    Brand: {},
    sequelize: {
      query: jest.fn().mockResolvedValue([[], {}]),
      transaction: jest.fn().mockImplementation(async (cb) => {
        if (typeof cb === 'function') return cb(mockTransaction);
        return mockTransaction;
      }),
      QueryTypes: { UPDATE: 'UPDATE' },
    },
    Op: require('sequelize').Op,
    Sequelize: require('sequelize').Sequelize,
  };
});

// ─── App setup ────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const adminRouter = require('@modules/admin/routes');
const { User } = require('@models');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use(errorHandler);

const request = supertest(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeUser(overrides = {}) {
  const data = {
    id: 99,
    firstName: 'Test',
    lastName: 'User',
    email: 'user@test.com',
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
    ...overrides,
  };
  return {
    ...data,
    toJSON: () => ({ ...data }),
    update: jest.fn().mockResolvedValue({ ...data, ...overrides }),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── getAllUsers ───────────────────────────────────────────────────────────────

describe('getAllUsers — phân trang và filter', () => {
  test('trả về 200 với danh sách users và thông tin phân trang', async () => {
    const rows = [makeUser({ id: 10 }), makeUser({ id: 11 })];
    User.findAndCountAll.mockResolvedValueOnce({ count: 2, rows });

    const res = await request.get('/api/admin/users');
    expect(res.status).toBe(200);
    expect(res.body.data.users).toHaveLength(2);
    expect(res.body.data.pagination).toMatchObject({
      totalItems: 2,
      currentPage: 1,
    });
  });

  test('filter theo role → truyền role vào where clause', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 1, rows: [makeUser({ role: 'admin' })] });

    const res = await request.get('/api/admin/users?role=admin');
    expect(res.status).toBe(200);

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.where).toMatchObject({ role: 'admin' });
  });

  test('filter theo search → truyền Op.or với firstName, lastName, email, phone', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users?search=john');

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    // where phải chứa Op.or array
    const { Op } = require('sequelize');
    expect(callArgs.where[Op.or]).toBeDefined();
    expect(callArgs.where[Op.or]).toHaveLength(4);
  });

  test('limit tối đa 100 dù client gửi limit=500', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users?limit=500');

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.limit).toBeLessThanOrEqual(100);
  });

  test('phân trang page=3, limit=10 → offset=20', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 50, rows: [] });

    const res = await request.get('/api/admin/users?page=3&limit=10');
    expect(res.status).toBe(200);

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    expect(callArgs.offset).toBe(20);
  });

  test('không filter khi search và role đều rỗng', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 0, rows: [] });

    await request.get('/api/admin/users');

    const callArgs = User.findAndCountAll.mock.calls[0][0];
    const { Op } = require('sequelize');
    expect(callArgs.where[Op.or]).toBeUndefined();
    expect(callArgs.where.role).toBeUndefined();
  });
});

// ─── getUserById ──────────────────────────────────────────────────────────────

describe('getUserById — trả về user với associations', () => {
  test('trả về 200 với user khi tìm thấy', async () => {
    const fakeUser = makeUser({ id: 5 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.get('/api/admin/users/5');
    expect(res.status).toBe(200);
    expect(res.body.data.user.id).toBe(5);
  });

  test('trả về 404 (AppError) khi user không tồn tại', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.get('/api/admin/users/9999');
    expect(res.status).toBe(404);
  });

  test('gọi findByPk với include associations (addresses, orders, loyaltyHistories...)', async () => {
    const fakeUser = makeUser({ id: 7 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    await request.get('/api/admin/users/7');

    const callArgs = User.findByPk.mock.calls[0];
    expect(callArgs[0]).toBe('7');
    // Phải có options với include
    expect(callArgs[1]).toHaveProperty('include');
    expect(callArgs[1].include).toBeInstanceOf(Array);
    expect(callArgs[1].include.length).toBeGreaterThan(0);
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser — cập nhật fields hợp lệ', () => {
  test('update thành công → trả về 200 với user mới', async () => {
    const fakeUser = makeUser({ id: 50, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request
      .put('/api/admin/users/50')
      .send({ firstName: 'NewName', role: 'customer' });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('user');
    expect(fakeUser.update).toHaveBeenCalled();
  });

  test('user không tồn tại → 404', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.put('/api/admin/users/999').send({ firstName: 'Ghost' });
    expect(res.status).toBe(404);
  });

  test('self-update role → 403 (không cho tự đổi role)', async () => {
    // req.user.id = 1 (mock), user.id = 1
    const selfUser = makeUser({ id: 1, role: 'admin' });
    User.findByPk.mockResolvedValueOnce(selfUser);

    const res = await request.put('/api/admin/users/1').send({ role: 'customer' });
    expect(res.status).toBe(403);
  });

  test('self-deactivate → 403 (không cho tự vô hiệu hóa)', async () => {
    const selfUser = makeUser({ id: 1, role: 'admin', isActive: true });
    User.findByPk.mockResolvedValueOnce(selfUser);

    const res = await request.put('/api/admin/users/1').send({ isActive: false });
    expect(res.status).toBe(403);
  });

  test('update phone=null (hasOwnProperty gửi null) → phone được set null', async () => {
    const fakeUser = makeUser({ id: 55, phone: '0901234567' });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    await request.put('/api/admin/users/55').send({ phone: null });

    expect(fakeUser.update).toHaveBeenCalledWith(expect.objectContaining({ phone: null }));
  });
});

// ─── deleteUser ───────────────────────────────────────────────────────────────

describe('deleteUser — xóa user', () => {
  test('xóa thành công → 200', async () => {
    const fakeUser = makeUser({ id: 77 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.delete('/api/admin/users/77');
    expect(res.status).toBe(200);
    expect(fakeUser.destroy).toHaveBeenCalled();
  });

  test('user không tồn tại → 404', async () => {
    User.findByPk.mockResolvedValueOnce(null);

    const res = await request.delete('/api/admin/users/9999');
    expect(res.status).toBe(404);
  });

  test('self-delete protection → 403 khi xóa chính mình (id=1)', async () => {
    // req.user.id = 1 (mock), id param = 1
    // Kiểm tra: deleteUser check String(req.user.id) === String(id) TRƯỚC khi findByPk
    const res = await request.delete('/api/admin/users/1');
    expect(res.status).toBe(403);
    // findByPk không được gọi vì self-delete check xảy ra trước
    expect(User.findByPk).not.toHaveBeenCalled();
  });

  test('xóa user khác (không phải chính mình) → gọi destroy', async () => {
    const fakeUser = makeUser({ id: 88 });
    User.findByPk.mockResolvedValueOnce(fakeUser);

    const res = await request.delete('/api/admin/users/88');
    expect(res.status).toBe(200);
    expect(fakeUser.destroy).toHaveBeenCalledTimes(1);
  });
});
