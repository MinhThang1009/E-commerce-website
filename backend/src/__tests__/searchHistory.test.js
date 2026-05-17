/**
 * Test POST /api/search-histories — saveSearch
 *
 * Rule 30: endpoint mới bắt buộc có test happy path, validation boundary, auth.
 *
 * Tests:
 *  - 422 khi thiếu keyword
 *  - 422 khi keyword rỗng
 *  - 422 khi keyword > 500 ký tự
 *  - 201 happy path — user đã đăng nhập
 *  - 201 happy path — guest không có token (auth tùy chọn)
 */

// ---------- Mocks ----------

jest.mock('../models', () => ({
  SearchHistory: {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    destroy: jest.fn(),
  },
  sequelize: {
    Sequelize: { Op: {} },
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/authenticate', () => ({
  // Match behavior thực tế: gọi next(error) khi không có token, không trả res.status(401) trực tiếp.
  // Route POST / dùng authenticate như optional (callback của authenticate bị gọi dù có lỗi hay không).
  authenticate: (req, _res, next) => {
    if (!req.headers.authorization) {
      // Truyền error để route's callback vẫn chạy được (callback ignore argument)
      return next(new Error('Unauthorized'));
    }
    req.user = { id: 1 };
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization) {
      req.user = { id: 1 };
    }
    next();
  },
}));

jest.mock('../middlewares/rateLimiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const searchHistoryRouter = require('../modules/searchHistory/routes');
const { SearchHistory } = require('../models');

const app = express();
app.use(express.json());
app.use('/api/search-histories', searchHistoryRouter);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ============================================================
// POST /api/search-histories — saveSearch
// ============================================================

describe('POST /api/search-histories — saveSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SearchHistory.create.mockResolvedValue({
      id: 1,
      userId: 1,
      keyword: 'áo thun',
      sessionId: null,
    });
  });

  // --- Validation boundary ---

  test('422 khi thiếu keyword', async () => {
    const res = await request
      .post('/api/search-histories')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(422);
  });

  test('422 khi keyword rỗng', async () => {
    const res = await request
      .post('/api/search-histories')
      .set('Authorization', 'Bearer token')
      .send({ keyword: '' });
    expect(res.status).toBe(422);
  });

  test('422 khi keyword > 500 ký tự', async () => {
    const res = await request
      .post('/api/search-histories')
      .set('Authorization', 'Bearer token')
      .send({ keyword: 'a'.repeat(501) });
    expect(res.status).toBe(422);
  });

  test('201 khi keyword đúng 500 ký tự (boundary hợp lệ)', async () => {
    const res = await request
      .post('/api/search-histories')
      .set('Authorization', 'Bearer token')
      .send({ keyword: 'a'.repeat(500) });
    expect(res.status).toBe(201);
  });

  // --- Happy path ---

  test('201 happy path — user đã đăng nhập', async () => {
    const res = await request
      .post('/api/search-histories')
      .set('Authorization', 'Bearer token')
      .send({ keyword: 'áo thun nam' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    expect(SearchHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'áo thun nam' }),
    );
  });

  test('201 happy path — guest không có token (auth tùy chọn)', async () => {
    const res = await request
      .post('/api/search-histories')
      .send({ keyword: 'giày sneaker', sessionId: 'guest-session-123' });
    expect(res.status).toBe(201);
    expect(SearchHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'giày sneaker' }),
    );
  });
});
