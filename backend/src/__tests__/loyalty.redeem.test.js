/**
 * Test POST /api/loyalty/redeem — redeemPoints
 *
 * Rule 30: endpoint mới bắt buộc có test happy path, validation boundary, auth.
 *
 * Tests:
 *  - 401 khi không có token
 *  - 422 khi points âm
 *  - 422 khi points = 0
 *  - 422 khi points không phải số nguyên (float)
 *  - 422 khi thiếu points
 *  - 400 khi số điểm vượt balance của user
 *  - 200 happy path — đổi điểm thành công
 */

// ---------- Mocks ----------

// Giá trị mock loyaltyPoints ban đầu
let mockLoyaltyPoints = 500;

jest.mock('../models', () => {
  const mockUser = {
    id: 1,
    loyaltyPoints: 500, // giá trị ban đầu, sẽ bị override trong từng test
    decrement: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockImplementation(function () {
      // Sau reload, trả về points đã trừ
      this.loyaltyPoints = mockLoyaltyPoints;
      return Promise.resolve(this);
    }),
  };

  return {
    User: {
      findByPk: jest.fn().mockResolvedValue(mockUser),
    },
    LoyaltyHistory: {
      create: jest.fn().mockResolvedValue({}),
    },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (cb) => {
        // Stub transaction — truyền mock transaction object
        const mockT = { LOCK: { UPDATE: 'UPDATE' } };
        return cb(mockT);
      }),
      Sequelize: { Op: {} },
    },
  };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('../middlewares/authenticate', () => ({
  authenticate: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }
    req.user = { id: 1 };
    next();
  },
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('../middlewares/rateLimiter', () => ({
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const buildLoyaltyModule = require('../modules/loyalty/module');
const { User, LoyaltyHistory, sequelize } = require('../models');
const eventBus = require('../shared/eventBus');
const logger = require('../utils/logger');

const loyaltyModule = buildLoyaltyModule({
  User, LoyaltyHistory, sequelize, eventBus, logger,
});

const app = express();
app.use(express.json());
app.use('/api/loyalty', loyaltyModule.router);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ============================================================
// POST /api/loyalty/redeem
// ============================================================

describe('POST /api/loyalty/redeem — redeemPoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock user về 500 điểm ban đầu
    mockLoyaltyPoints = 500;
    User.findByPk.mockResolvedValue({
      id: 1,
      loyaltyPoints: 500,
      decrement: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockImplementation(function () {
        this.loyaltyPoints = mockLoyaltyPoints - 100; // giả lập trừ điểm
        return Promise.resolve(this);
      }),
    });
  });

  // --- Auth ---

  test('401 khi không có Authorization header', async () => {
    const res = await request
      .post('/api/loyalty/redeem')
      .send({ points: 100 });
    expect(res.status).toBe(401);
  });

  // --- Validation boundary: points phải là số nguyên dương ---

  test('422 khi points âm (-1)', async () => {
    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({ points: -1 });
    expect(res.status).toBe(422);
  });

  test('422 khi points = 0', async () => {
    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({ points: 0 });
    expect(res.status).toBe(422);
  });

  test('422 khi points là số thập phân (1.5)', async () => {
    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({ points: 1.5 });
    expect(res.status).toBe(422);
  });

  test('422 khi thiếu trường points', async () => {
    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({});
    expect(res.status).toBe(422);
  });

  test('422 khi points là chuỗi không phải số', async () => {
    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({ points: 'abc' });
    expect(res.status).toBe(422);
  });

  // --- Business logic: không đủ điểm ---

  test('400 khi points (600) vượt balance (500)', async () => {
    // Mock user chỉ có 500 điểm nhưng request đổi 600
    const mockUserLowBalance = {
      id: 1,
      loyaltyPoints: 500,
      decrement: jest.fn(),
      reload: jest.fn(),
    };
    User.findByPk.mockResolvedValue(mockUserLowBalance);

    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({ points: 600 });
    expect(res.status).toBe(400);
    expect(mockUserLowBalance.decrement).not.toHaveBeenCalled();
  });

  // --- Happy path ---

  test('200 happy path — đổi 100 điểm thành công', async () => {
    const mockUser = {
      id: 1,
      loyaltyPoints: 500,
      decrement: jest.fn().mockResolvedValue(undefined),
      reload: jest.fn().mockImplementation(function () {
        this.loyaltyPoints = 400; // 500 - 100
        return Promise.resolve(this);
      }),
    };
    User.findByPk.mockResolvedValue(mockUser);

    const res = await request
      .post('/api/loyalty/redeem')
      .set('Authorization', 'Bearer token')
      .send({ points: 100 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data.pointsRedeemed).toBe(100);
    // Xác nhận decrement được gọi với đúng số điểm
    expect(mockUser.decrement).toHaveBeenCalledWith(
      'loyaltyPoints',
      expect.objectContaining({ by: 100 })
    );
    // Xác nhận lịch sử giao dịch được tạo
    expect(LoyaltyHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'spend', points: -100 }),
      expect.anything()
    );
  });
});
