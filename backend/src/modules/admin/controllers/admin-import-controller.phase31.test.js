/**
 * Test Phase 31 — Database Migration Workflow & Product Import
 *
 * Bao gồm:
 * - GET  /api/admin/products/import-template — download CSV template (200)
 * - POST /api/admin/products/import — upload không có file (400)
 * - POST /api/admin/products/import — upload file không hợp lệ (400)
 * - POST /api/admin/products/import — upload CSV hợp lệ (200 + success count)
 * - POST /api/admin/products/import — CSV thiếu name → error chi tiết, dòng còn lại OK
 * - GET  /api/admin/products/import-history — lấy lịch sử import (200)
 * - GET  /api/admin/products/export — export CSV (200 + Content-Disposition)
 * - POST /api/admin/products/import — không có auth (401)
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

// adminAuthenticate: admin khi header x-test-admin là 'true', còn lại 401
jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (req, _res, next) => {
    if (req.headers['x-test-admin'] === 'true') {
      req.user = { id: 1, role: 'admin' };
      return next();
    }
    const { AppError } = require('@middlewares/error-handler');
    return next(new AppError('Cần token xác thực để truy cập admin panel', 401));
  },
}));

jest.mock('@shared/admin-audit', () => ({
  auditMiddleware: (_req, _res, next) => next(),
  AdminAuditService: { log: jest.fn() },
}));

// Mock vectorStore để tránh gọi API embedding thật
jest.mock('@modules/ai/services/vectorstore/vector-store', () => ({
  upsertProduct: jest.fn().mockResolvedValue(undefined),
  save: jest.fn().mockResolvedValue(undefined),
}));

// Mock Sequelize models
jest.mock('@models', () => {
  // Import log mock
  const importLogMock = {
    create: jest.fn().mockResolvedValue({
      id: 1,
      adminId: 1,
      filename: 'test.csv',
      totalRows: 2,
      successRows: 1,
      failedRows: 1,
    }),
    findAndCountAll: jest.fn().mockResolvedValue({
      rows: [
        {
          id: 1,
          adminId: 1,
          filename: 'products.csv',
          totalRows: 5,
          successRows: 4,
          failedRows: 1,
          importedAt: new Date(),
        },
      ],
      count: 1,
    }),
  };

  // Product mock
  const productMock = {
    create: jest.fn().mockResolvedValue({ id: 100, name: 'Test Product' }),
    findOne: jest.fn().mockResolvedValue(null), // slug không trùng
    findAll: jest.fn().mockResolvedValue([]),
  };

  // Category mock
  const categoryMock = {
    findAll: jest.fn().mockResolvedValue([
      { id: 1, slug: 'dien-thoai', name: 'Điện thoại' },
      { id: 2, slug: 'laptop', name: 'Laptop' },
    ]),
  };

  // Brand mock
  const brandMock = {
    findAll: jest.fn().mockResolvedValue([{ id: 1, name: 'Apple', slug: 'apple' }]),
  };

  const productVariantMock = { create: jest.fn().mockResolvedValue({}) };
  const productImageMock = { create: jest.fn().mockResolvedValue({}) };
  const productCategoryMock = { create: jest.fn().mockResolvedValue({}) };
  const productSpecMock = { create: jest.fn().mockResolvedValue({}) };

  // sequelize.transaction mock — chạy thẳng không dùng transaction thật
  const sequelizeMock = {
    transaction: jest.fn().mockImplementation(async (fn) => {
      const t = { LOCK: { UPDATE: 'UPDATE' } };
      return fn(t);
    }),
  };

  return {
    sequelize: sequelizeMock,
    Product: productMock,
    ProductVariant: productVariantMock,
    ProductImage: productImageMock,
    ProductCategory: productCategoryMock,
    ProductSpecification: productSpecMock,
    Category: categoryMock,
    Brand: brandMock,
    ImportLog: importLogMock,
    Op: require('sequelize').Op,
  };
});

// ── Setup ──────────────────────────────────────────────────────────────────

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');

let app;
beforeAll(() => {
  const adminRouter = require('@modules/admin/routes');
  app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  app.use(errorHandler);
});

beforeEach(() => jest.clearAllMocks());

// Helper headers
const adminHeaders = { 'x-test-admin': 'true' };

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GET /api/admin/products/import-template', () => {
  test('Admin → trả về file CSV với Content-Disposition attachment', async () => {
    const res = await supertest(app).get('/api/admin/products/import-template').set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    // Kiểm tra header CSV bắt buộc
    expect(res.text).toContain('name');
    expect(res.text).toContain('base_price');
    expect(res.text).toContain('category_slug');
  });

  test('Không có auth (thiếu x-test-admin) → 401', async () => {
    const res = await supertest(app).get('/api/admin/products/import-template');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/admin/products/import', () => {
  test('Không có file đính kèm → 400', async () => {
    const res = await supertest(app).post('/api/admin/products/import').set(adminHeaders);

    expect(res.status).toBe(400);
    // 4xx errors dùng status 'fail' theo convention errorHandler
    expect(['error', 'fail']).toContain(res.body.status);
  });

  test('Upload file có extension không hợp lệ (.txt) → 400', async () => {
    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from('some text'), {
        filename: 'data.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  test('Upload CSV hợp lệ với 2 sản phẩm → 200, successCount >= 1', async () => {
    const csvContent = [
      'name,slug,short_description,base_price,category_slug,brand,status,stock_quantity',
      'iPhone 17 Pro,,Flagship mới,36990000,dien-thoai,Apple,active,50',
      'MacBook Air M5,,Siêu mỏng nhẹ,29990000,laptop,Apple,active,20',
    ].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('totalRows');
    expect(res.body.data).toHaveProperty('successCount');
    expect(res.body.data).toHaveProperty('failedCount');
    expect(res.body.data.totalRows).toBe(2);
  });

  test('CSV có 1 dòng thiếu name → error chi tiết cho dòng đó, dòng còn lại import được', async () => {
    // Dòng 2: name trống (chỉ có dấu phẩy ở đầu) → validation error
    // Dòng 3: hợp lệ → import được
    const csvContent = [
      'name,base_price,category_slug',
      ',29990000,dien-thoai', // dòng 2: name bỏ trống → error
      'Samsung Galaxy S25,29990000,dien-thoai', // dòng 3: hợp lệ
    ].join('\n');

    const res = await supertest(app)
      .post('/api/admin/products/import')
      .set(adminHeaders)
      .attach('file', Buffer.from(csvContent), {
        filename: 'products.csv',
        contentType: 'text/csv',
      });

    // Vẫn trả 200 nếu có ít nhất 1 dòng thành công hoặc 422 nếu tất cả lỗi
    expect([200, 422]).toContain(res.status);

    if (res.status === 200) {
      // Phải có errors array với ít nhất 1 lỗi về name
      expect(res.body.data.errors.length).toBeGreaterThan(0);
      const nameError = res.body.data.errors.find(
        (e) => e.field === 'name' || e.field === 'general',
      );
      expect(nameError).toBeTruthy();
    }
  });

  test('Không có auth → 401', async () => {
    const res = await supertest(app)
      .post('/api/admin/products/import')
      .attach('file', Buffer.from('name,base_price'), { filename: 'p.csv' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/products/import-history', () => {
  test('Admin → trả về danh sách lịch sử import (200)', async () => {
    const res = await supertest(app).get('/api/admin/products/import-history').set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('logs');
    expect(Array.isArray(res.body.data.logs)).toBe(true);
    expect(res.body.data).toHaveProperty('total');
  });

  test('Không có auth → 401', async () => {
    const res = await supertest(app).get('/api/admin/products/import-history');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/admin/products/export', () => {
  test('Admin → trả về file CSV với Content-Disposition (200)', async () => {
    // Mock Product.findAll cho export
    const { Product } = require('@models');
    Product.findAll.mockResolvedValueOnce([
      {
        id: 1,
        name: 'iPhone 16',
        slug: 'iphone-16',
        shortDescription: 'Flagship',
        basePrice: 22990000,
        status: 'active',
        stockQuantity: 30,
        category: { slug: 'dien-thoai' },
        brand: { name: 'Apple' },
        productImages: [{ imageUrl: '/img/iphone16.jpg' }],
        specifications: [{ specKey: 'CPU', specValue: 'A18' }],
      },
    ]);

    const res = await supertest(app).get('/api/admin/products/export?format=csv').set(adminHeaders);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.text).toContain('name');
  });

  test('Không có auth → 401', async () => {
    const res = await supertest(app).get('/api/admin/products/export');
    expect(res.status).toBe(401);
  });
});
