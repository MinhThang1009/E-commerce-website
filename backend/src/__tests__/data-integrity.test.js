/**
 * Tests Phase 2 — Data & Model Integrity
 *
 * Bao gồm:
 * - Product model có field stockQuantity (INTEGER, defaultValue: 0, allowNull: false)
 * - getAllProducts pagination: limit bị cap tại 100
 * - getAllProducts pagination: offset = (page - 1) * limit tính đúng
 * - getAllProducts pagination: default limit = 20 khi không truyền
 * - Response GET /api/products có đủ cấu trúc pagination meta (total, page, limit)
 */

process.env.NODE_ENV = 'test';

// ---------- Mutable mock state ----------

const mockFindAndCountAll = jest.fn();
let mockCapturedProductAttrs = null;

// ---------- Mocks ----------

// Capture product model attrs để kiểm tra field definitions
jest.mock('@config/sequelize', () => ({
  define: (_name, attrs) => {
    mockCapturedProductAttrs = attrs;
    class MockModel {
      toJSON() {
        return { ...this._data };
      }
    }
    return MockModel;
  },
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
}));

// Mock models — kiểm soát Product.findAndCountAll và Category.findOne
jest.mock('@models', () => ({
  Product: {
    findAndCountAll: jest.fn().mockImplementation((...args) => mockFindAndCountAll(...args)),
    findByPk: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
  },
  Category: {
    findOne: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue(null),
  },
  // Phase 42 modules/catalog yêu cầu đầy đủ models — stub cho cái không test
  Brand: { findAll: jest.fn().mockResolvedValue([]), findByPk: jest.fn() },
  ProductAttribute: { findAll: jest.fn().mockResolvedValue([]) },
  ProductSpecification: { findAll: jest.fn().mockResolvedValue([]) },
  RecentlyViewed: {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn(),
  },
  WarrantyPackage: { findAll: jest.fn().mockResolvedValue([]) },
  ProductVariant: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  Review: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  sequelize: {
    transaction: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    where: jest.fn(),
    literal: jest.fn(),
    Sequelize: { Op: {} },
  },
  Op: require('sequelize').Op,
}));

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
    req.user = { id: 1, role: 'admin' };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

// Redis: cache miss mặc định → không bypass product query
jest.mock('@config/redis', () => ({
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
const { errorHandler } = require('@middlewares/error-handler');

// Helper tạo mock product trả về từ findAndCountAll
function makeMockProduct(overrides = {}) {
  return {
    toJSON: () => ({
      id: 1,
      name: 'Test Product',
      basePrice: 100000,
      compareAtPrice: null,
      stockQuantity: 50,
      status: 'active',
      productImages: [],
      reviews: [],
      variants: [],
      categories: [],
      category: null,
      brand: null,
      ...overrides,
    }),
  };
}

// ============================================================
// 1. Product model — field definitions
// ============================================================

describe('Product model — field stockQuantity được định nghĩa đúng', () => {
  test('product.js gọi sequelize.define() với field stockQuantity', () => {
    // require product.js để trigger define() — capture attrs
    jest.isolateModules(() => {
      require('@models/product');
    });
    // mockCapturedProductAttrs được set bởi define() mock
    expect(mockCapturedProductAttrs).not.toBeNull();
    expect(mockCapturedProductAttrs).toHaveProperty('stockQuantity');
  });

  test('stockQuantity có defaultValue = 0', () => {
    jest.isolateModules(() => {
      require('@models/product');
    });
    expect(mockCapturedProductAttrs.stockQuantity.defaultValue).toBe(0);
  });

  test('stockQuantity có allowNull = false', () => {
    jest.isolateModules(() => {
      require('@models/product');
    });
    expect(mockCapturedProductAttrs.stockQuantity.allowNull).toBe(false);
  });
});

// ============================================================
// 2. getAllProducts — pagination logic
// ============================================================

describe('GET /api/products — pagination limit và offset', () => {
  let app;
  const { Product } = require('@models');

  beforeAll(() => {
    // Phase 42 modules/catalog mounts /products router. Build module với DI.
    const buildCatalogModule = require('@modules/catalog/module');
    const {
      Category,
      Brand,
      ProductAttribute,
      ProductSpecification,
      RecentlyViewed,
      WarrantyPackage,
      ProductVariant,
      Review,
      sequelize,
    } = require('@models');
    const eventBus = require('@shared/event-bus');
    const logger = require('@utils/logger');
    const { getRedisClient } = require('@config/redis');

    // Stub các model chưa có trong test mock — module yêu cầu Category/Brand
    const _Brand = Brand || { findAll: jest.fn(), findByPk: jest.fn() };
    const _ProductAttribute = ProductAttribute || { findAll: jest.fn() };
    const _ProductSpecification = ProductSpecification || { findAll: jest.fn() };
    const _RecentlyViewed = RecentlyViewed || { findAll: jest.fn() };
    const _WarrantyPackage = WarrantyPackage || { findAll: jest.fn() };

    const catalogModule = buildCatalogModule({
      Category,
      Brand: _Brand,
      Product,
      ProductAttribute: _ProductAttribute,
      ProductVariant,
      ProductSpecification: _ProductSpecification,
      Review,
      RecentlyViewed: _RecentlyViewed,
      WarrantyPackage: _WarrantyPackage,
      sequelize,
      redisClient: getRedisClient,
      eventBus,
      logger,
    });
    const productMount = catalogModule.mounts.find((m) => m.basePath === '/products');

    app = express();
    app.use(express.json());
    app.use('/api/products', productMount.router);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock trả về 1 sản phẩm
    mockFindAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeMockProduct()],
    });
  });

  test('Không truyền limit → sử dụng default limit = 20', async () => {
    await supertest(app).get('/api/products');

    expect(Product.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  test('?limit=50 → limit = 50 (không bị capped)', async () => {
    await supertest(app).get('/api/products?limit=50');

    expect(Product.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 50 }));
  });

  test('?limit=200 → limit bị cap tại 100', async () => {
    await supertest(app).get('/api/products?limit=200');

    expect(Product.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
  });

  test('?page=1&limit=10 → offset = 0', async () => {
    await supertest(app).get('/api/products?page=1&limit=10');

    expect(Product.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 0 }));
  });

  test('?page=3&limit=10 → offset = 20', async () => {
    await supertest(app).get('/api/products?page=3&limit=10');

    expect(Product.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
  });

  test('?page=2&limit=20 → offset = 20', async () => {
    await supertest(app).get('/api/products?page=2&limit=20');

    expect(Product.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ offset: 20 }));
  });

  // ============================================================
  // 3. Response structure — pagination meta
  // ============================================================

  test('Response trả về status success và có meta pagination (total, page, limit)', async () => {
    mockFindAndCountAll.mockResolvedValue({
      count: 45,
      rows: [makeMockProduct(), makeMockProduct({ id: 2, name: 'Product 2' })],
    });

    const res = await supertest(app).get('/api/products?limit=20&page=1');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Pagination meta nằm trực tiếp trên body (không lồng trong data)
    expect(res.body.total).toBe(45);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(20);
  });

  test('Response data là mảng sản phẩm', async () => {
    mockFindAndCountAll.mockResolvedValue({
      count: 1,
      rows: [makeMockProduct()],
    });

    const res = await supertest(app).get('/api/products');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });
});
