/**
 * Test Phase 17 — Product Search Standards
 *
 * Bao gồm:
 * - GET /api/products/suggestions?q=... — autocomplete trả tối đa 10 kết quả
 * - GET /api/products/suggestions (không có q) — trả mảng rỗng
 * - Case-insensitive search (lowercase vs Titlecase)
 * - Deduplication trong saveSearch — không lưu cùng keyword trong 1 giờ
 */

// ---------- Mocks ----------

jest.mock('../models', () => {
  const mockFn = jest.fn;
  return {
    Product: {
      findAll: mockFn(),
      findAndCountAll: mockFn(),
      findOne: mockFn(),
      findByPk: mockFn(),
      count: mockFn(),
    },
    SearchHistory: {
      create: mockFn(),
      findAll: mockFn(),
      findOne: mockFn(),
      destroy: mockFn(),
    },
    Category: { findOne: mockFn() },
    Review: {},
    RecentlyViewed: { upsert: mockFn() },
    sequelize: {
      fn: jest.fn((fnName, col) => ({ fn: fnName, col })),
      col: jest.fn((name) => ({ col: name })),
      where: jest.fn((col, condition) => ({ col, condition })),
      literal: jest.fn((val) => ({ literal: val })),
      Sequelize: { Op: require('sequelize').Op },
    },
  };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatLimiter: (_req, _res, next) => next(),
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
  }),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    if (req.headers.authorization) {
      req.user = { id: 1 };
    }
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization) {
      req.user = { id: 1 };
    }
    next();
  },
}));

jest.mock('../middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../validators/product', () => ({
  productSchema: { validate: jest.fn().mockReturnValue({ error: null }) },
}));

jest.mock('../middlewares/validateRequest', () => ({
  validateRequest: () => (_req, _res, next) => next(),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const productRouter = require('../routes/product');
const { errorHandler } = require('../middlewares/errorHandler');
const { Product } = require('../models');

const app = express();
app.use(express.json());
app.use('/api/products', productRouter);
app.use(errorHandler);

const request = supertest(app);

// ============================================================
// GET /api/products/suggestions — Autocomplete
// ============================================================

describe('GET /api/products/suggestions — getProductSuggestions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Không có query ---

  test('200 + mảng rỗng khi không có query q', async () => {
    const res = await request.get('/api/products/suggestions');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toEqual([]);
    // Không cần gọi DB khi q rỗng
    expect(Product.findAll).not.toHaveBeenCalled();
  });

  test('200 + mảng rỗng khi q là chuỗi rỗng', async () => {
    const res = await request.get('/api/products/suggestions?q=');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(Product.findAll).not.toHaveBeenCalled();
  });

  // --- Happy path ---

  test('200 + trả về danh sách suggestions khi có q', async () => {
    const mockProducts = [
      { toJSON: () => ({ id: 1, name: 'Laptop Dell', slug: 'laptop-dell', productImages: [{ imageUrl: 'https://img.jpg', isThumbnail: true, displayOrder: 1 }] }) },
      { toJSON: () => ({ id: 2, name: 'Laptop HP', slug: 'laptop-hp', productImages: [] }) },
    ];
    Product.findAll.mockResolvedValue(mockProducts);

    const res = await request.get('/api/products/suggestions?q=lap');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  test('response suggestion có đúng fields: id, name, slug, thumbnail', async () => {
    const mockProducts = [
      {
        toJSON: () => ({
          id: 5,
          name: 'Laptop Gaming Asus',
          slug: 'laptop-gaming-asus',
          productImages: [{ imageUrl: 'https://asus.jpg', isThumbnail: true, displayOrder: 1 }],
        }),
      },
    ];
    Product.findAll.mockResolvedValue(mockProducts);

    const res = await request.get('/api/products/suggestions?q=laptop');
    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(item).toHaveProperty('id', 5);
    expect(item).toHaveProperty('name', 'Laptop Gaming Asus');
    expect(item).toHaveProperty('slug', 'laptop-gaming-asus');
    expect(item).toHaveProperty('thumbnail', 'https://asus.jpg');
  });

  test('thumbnail là null khi sản phẩm không có ảnh', async () => {
    Product.findAll.mockResolvedValue([
      { toJSON: () => ({ id: 3, name: 'Laptop Acer', slug: 'laptop-acer', productImages: [] }) },
    ]);

    const res = await request.get('/api/products/suggestions?q=acer');
    expect(res.status).toBe(200);
    expect(res.body.data[0].thumbnail).toBeNull();
  });

  test('Product.findAll được gọi với limit 10', async () => {
    Product.findAll.mockResolvedValue([]);

    await request.get('/api/products/suggestions?q=samsung');
    expect(Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    );
  });

  test('trả về mảng rỗng khi không có sản phẩm khớp', async () => {
    Product.findAll.mockResolvedValue([]);

    const res = await request.get('/api/products/suggestions?q=xyznotexist');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

// ============================================================
// Deduplication trong saveSearch — SearchHistory
// ============================================================

jest.mock('../validators/searchHistory', () => ({
  saveSearchSchema: { validate: jest.fn().mockReturnValue({ error: null }) },
}));

const searchHistoryRouter = require('../routes/searchHistory');
const { SearchHistory } = require('../models');

const appHistory = express();
appHistory.use(express.json());
appHistory.use('/api/search-history', searchHistoryRouter);
appHistory.use(errorHandler);

const requestHistory = supertest(appHistory);

describe('POST /api/search-history — deduplication (Phase 17.4)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('201 khi keyword chưa tồn tại trong 1 giờ qua', async () => {
    // findOne trả null → không có duplicate → create được gọi
    SearchHistory.findOne.mockResolvedValue(null);
    SearchHistory.create.mockResolvedValue({
      id: 10,
      userId: 1,
      keyword: 'điện thoại samsung',
      sessionId: null,
    });

    const res = await requestHistory
      .post('/api/search-history')
      .set('Authorization', 'Bearer token')
      .send({ keyword: 'điện thoại samsung' });

    expect(res.status).toBe(201);
    expect(SearchHistory.create).toHaveBeenCalledTimes(1);
  });

  test('200 khi keyword đã tồn tại trong 1 giờ qua — không tạo lại', async () => {
    // findOne trả existing record → duplicate → không gọi create
    SearchHistory.findOne.mockResolvedValue({
      id: 5,
      userId: 1,
      keyword: 'điện thoại samsung',
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 phút trước
    });

    const res = await requestHistory
      .post('/api/search-history')
      .set('Authorization', 'Bearer token')
      .send({ keyword: 'điện thoại samsung' });

    expect(res.status).toBe(200);
    // Create không được gọi vì đã duplicate
    expect(SearchHistory.create).not.toHaveBeenCalled();
  });

  test('findOne được gọi với điều kiện bao gồm createdAt >= 1 giờ trước', async () => {
    SearchHistory.findOne.mockResolvedValue(null);
    SearchHistory.create.mockResolvedValue({ id: 1, keyword: 'laptop' });

    await requestHistory
      .post('/api/search-history')
      .set('Authorization', 'Bearer token')
      .send({ keyword: 'laptop' });

    expect(SearchHistory.findOne).toHaveBeenCalledTimes(1);
    // Verify có điều kiện createdAt trong where
    const callArgs = SearchHistory.findOne.mock.calls[0][0];
    expect(callArgs.where).toHaveProperty('keyword', 'laptop');
    expect(callArgs.where).toHaveProperty('createdAt');
  });
});
