/**
 * Tests Phase 1 — Security Standards
 *
 * Bao gồm:
 * - authenticate middleware — từ chối token đã bị blacklist (bl:{jti} trong Redis)
 * - authenticate middleware — token hợp lệ không bị chặn
 * - authenticate middleware — thiếu Authorization header → 401
 * - otpLimiter — chặn sau 5 request trong 15 phút (lần thứ 6 → 429)
 * - User.prototype.toJSON — không trả về password, otpCode
 * - deleteFile controller — từ chối filename chứa path traversal (../)
 */

process.env.JWT_SECRET = 'test-jwt-secret-phase1-security';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-phase1';
process.env.NODE_ENV = 'test';

// ---------- Mutable mock state (read ở call time, không phải factory time) ----------

const mockBlacklistedJtis = new Set();
let mockUserForAuth = null;

// ---------- Mocks ----------

// Mock sequelize config để load user.js mà không cần kết nối DB thật
jest.mock('@config/sequelize', () => ({
  define: (_name, _attrs, _opts) => {
    class MockModel {}
    return MockModel;
  },
}));

// Mock models để authenticate middleware không cần DB
jest.mock('@models', () => ({
  User: {
    findByPk: jest.fn().mockImplementation(() => Promise.resolve(mockUserForAuth)),
    findOne: jest.fn().mockResolvedValue(null),
  },
  sequelize: {
    transaction: jest.fn(),
    Sequelize: { Op: {} },
  },
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

// Redis mock với blacklist kiểm soát được
jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockImplementation((key) => {
      const m = key.match(/^bl:(.+)$/);
      return Promise.resolve(m && mockBlacklistedJtis.has(m[1]) ? '1' : null);
    }),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

// otpLimiter mock pass-through cho các test không liên quan đến rate limit
jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
}));

// ---------- Require sau mock ----------

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('@middlewares/error-handler');
const { authenticate } = require('@middlewares/authenticate');

// ============================================================
// 1. authenticate middleware — JWT blacklist
// ============================================================

describe('authenticate — JWT blacklist (bl:{jti} trong Redis)', () => {
  let app;

  const validUser = {
    id: 1,
    role: 'customer',
    isActive: true,
    isEmailVerified: true,
  };

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.get('/protected', authenticate, (req, res) => {
      res.status(200).json({ status: 'success', userId: req.user.id });
    });
    app.use(errorHandler);
  });

  beforeEach(() => {
    mockBlacklistedJtis.clear();
    mockUserForAuth = validUser;
  });

  test('Token hợp lệ, jti không bị blacklist → 200', async () => {
    const jti = crypto.randomUUID();
    const token = jwt.sign({ id: 1, role: 'customer', jti }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const res = await supertest(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Token bị blacklist (bl:{jti} = "1" trong Redis) → 401 "Token is invalid"', async () => {
    const jti = 'blacklisted-jti-' + crypto.randomUUID();
    mockBlacklistedJtis.add(jti);

    const token = jwt.sign({ id: 1, role: 'customer', jti }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    const res = await supertest(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Token is invalid/i);
  });

  test('Không có Authorization header → 401', async () => {
    const res = await supertest(app).get('/protected');
    expect(res.status).toBe(401);
  });

  test('Token sai secret → 401', async () => {
    const token = jwt.sign({ id: 1, role: 'customer', jti: 'fake-jti' }, 'wrong-secret', {
      expiresIn: '1h',
    });

    const res = await supertest(app).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
  });
});

// ============================================================
// 2. otpLimiter — rate limiting theo email (max 5 / 15 phút)
// ============================================================

describe('otpLimiter — chặn brute-force OTP sau 5 lần / 15 phút', () => {
  let app;

  beforeAll(() => {
    // Dùng otpLimiter thực (jest.requireActual) thay vì pass-through mock
    const { otpLimiter } = jest.requireActual('@middlewares/rate-limiter');

    app = express();
    app.use(express.json());
    // Stub handler — luôn trả 200 nếu limiter cho qua
    app.post('/test-otp', otpLimiter, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.use(errorHandler);
  });

  test('5 request với cùng email → không bị chặn', async () => {
    const email = `otp-limit-5@example-${Date.now()}.com`;

    for (let i = 0; i < 5; i++) {
      const res = await supertest(app).post('/test-otp').send({ email });
      expect(res.status).not.toBe(429);
    }
  });

  test('Request thứ 6 với cùng email → 429 Too Many Requests', async () => {
    const email = `otp-limit-6@example-${Date.now()}.com`;

    // Tiêu thụ hết 5 slot
    for (let i = 0; i < 5; i++) {
      await supertest(app).post('/test-otp').send({ email });
    }

    // Lần thứ 6 phải bị chặn
    const res = await supertest(app).post('/test-otp').send({ email });
    expect(res.status).toBe(429);
  });
});

// ============================================================
// 3. User.prototype.toJSON — loại bỏ field nhạy cảm
// ============================================================

describe('User.prototype.toJSON — không trả về các field nhạy cảm', () => {
  // Require trực tiếp user.js (khác với mock '@models' = index.js)
  // ../config/sequelize đã được mock nên không cần kết nối DB thật
  const User = require('@models/user');

  const sensitiveData = {
    id: 1,
    email: 'user@test.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'customer',
    password: 'hashed_super_secret_password',
    otpCode: '654321',
    otpExpires: new Date(),
    resetPasswordToken: 'reset-token-abc123',
    resetPasswordExpires: new Date(),
    loyaltyPoints: 100,
  };

  test('password bị xóa khỏi kết quả toJSON()', () => {
    const result = User.prototype.toJSON.call({ get: () => ({ ...sensitiveData }) });
    expect(result.password).toBeUndefined();
  });

  test('otpCode bị xóa khỏi kết quả toJSON()', () => {
    const result = User.prototype.toJSON.call({ get: () => ({ ...sensitiveData }) });
    expect(result.otpCode).toBeUndefined();
  });

  test('resetPasswordToken bị xóa khỏi kết quả toJSON()', () => {
    const result = User.prototype.toJSON.call({ get: () => ({ ...sensitiveData }) });
    expect(result.resetPasswordToken).toBeUndefined();
  });

  test('Các field không nhạy cảm vẫn được giữ lại (id, email, role)', () => {
    const result = User.prototype.toJSON.call({ get: () => ({ ...sensitiveData }) });
    expect(result.id).toBe(1);
    expect(result.email).toBe('user@test.com');
    expect(result.role).toBe('customer');
    expect(result.loyaltyPoints).toBe(100);
  });
});

// ============================================================
// 4. deleteFile controller — ngăn chặn path traversal
// ============================================================

describe('deleteFile controller — ngăn chặn path traversal trong filename', () => {
  // Phase 42 modules/upload expose deleteFile handler qua module instance
  const buildUploadModule = require('@modules/upload/module');
  const eventBus = require('@shared/event-bus');
  const logger = require('@utils/logger');
  const { deleteFile } = buildUploadModule({ eventBus, logger });

  function mockReqRes(type, filename, role = 'admin') {
    const req = {
      params: { type, filename },
      user: { id: 1, role },
    };
    const res = {};
    return { req, res };
  }

  test('filename "../../../etc/passwd" → next(AppError 400)', async () => {
    const { req, res } = mockReqRes('products', '../../../etc/passwd');
    let capturedErr;
    await deleteFile(req, res, (err) => {
      capturedErr = err;
    });

    expect(capturedErr).toBeDefined();
    expect(capturedErr.statusCode).toBe(400);
  });

  test('filename "../test.jpg" → next(AppError 400)', async () => {
    const { req, res } = mockReqRes('products', '../test.jpg');
    let capturedErr;
    await deleteFile(req, res, (err) => {
      capturedErr = err;
    });

    expect(capturedErr).toBeDefined();
    expect(capturedErr.statusCode).toBe(400);
  });

  test('type không hợp lệ "invalidtype" → next(AppError 400)', async () => {
    const { req, res } = mockReqRes('invalidtype', 'test.jpg');
    let capturedErr;
    await deleteFile(req, res, (err) => {
      capturedErr = err;
    });

    expect(capturedErr).toBeDefined();
    expect(capturedErr.statusCode).toBe(400);
  });

  test('user không phải admin → next(AppError 403)', async () => {
    const { req, res } = mockReqRes('products', 'test.jpg', 'customer');
    let capturedErr;
    await deleteFile(req, res, (err) => {
      capturedErr = err;
    });

    expect(capturedErr).toBeDefined();
    expect(capturedErr.statusCode).toBe(403);
  });
});
