/**
 * Tests Phase 25 — Auth Login Business Logic
 *
 * Bao gồm:
 * - POST /api/auth/login — đăng nhập thành công → 200 với token
 * - Sai mật khẩu → 401
 * - Email không tồn tại → 401
 * - Tài khoản chưa xác thực email → 401
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase25-auth';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-phase25';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

// ---------- Mutable mock state ----------

const mockUserFindOneImpl = jest.fn();

// ---------- Mocks ----------

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
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
  optionalAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@middlewares/admin-auth', () => ({
  adminAuthenticate: (_req, _res, next) => next(),
}));

jest.mock('@services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@models', () => {
  const sequelizePkg = require('sequelize');
  return {
    User: {
      findOne: jest.fn().mockImplementation((...args) => mockUserFindOneImpl(...args)),
      findByPk: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 1, email: 'test@test.com' }),
    },
    sequelize: {
      transaction: jest.fn().mockImplementation(async (cb) => {
        const t = { LOCK: { UPDATE: 'UPDATE' } };
        return typeof cb === 'function'
          ? cb(t)
          : { LOCK: { UPDATE: 'UPDATE' }, commit: jest.fn(), rollback: jest.fn() };
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

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      getPayload: () => ({
        email: 'google@test.com',
        given_name: 'Test',
        family_name: 'User',
        sub: 'google-sub-123',
      }),
    }),
  })),
}));

jest.mock('@config/sequelize', () => ({
  define: jest.fn().mockReturnValue(class MockModel {}),
  fn: jest.fn(),
  col: jest.fn(),
  where: jest.fn(),
  literal: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
}));

jest.mock('@utils/product-helpers', () => ({
  calculateTotalStock: jest.fn().mockReturnValue(0),
  updateProductTotalStock: jest.fn().mockResolvedValue(undefined),
  validateVariantAttributes: jest.fn().mockReturnValue([]),
  generateVariantSku: jest.fn().mockReturnValue('SKU-001'),
}));

jest.mock('@services/vector-store/vector-store', () => ({
  upsertProduct: jest.fn(),
  save: jest.fn().mockResolvedValue(undefined),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const buildAuthModule = require('@modules/auth/module');
const { User } = require('@models');
const eventBus = require('@shared/event-bus');
const logger = require('@utils/logger');
const emailService = require('@services/email');
const { errorHandler } = require('@middlewares/error-handler');

const authModule = buildAuthModule({
  User,
  eventBus,
  logger,
  emailService,
});

const app = express();
app.use(express.json());
app.use('/api/auth', authModule.router);
app.use(errorHandler);
const request = supertest(app);

// ---------- Helper tạo mock user ----------

function makeMockUser(overrides = {}) {
  return {
    id: 1,
    email: 'user@example.com',
    firstName: 'Minh',
    lastName: 'Thang',
    role: 'customer',
    isEmailVerified: true,
    isActive: true,
    comparePassword: jest.fn().mockResolvedValue(true),
    toJSON: jest.fn().mockReturnValue({ id: 1, email: 'user@example.com', role: 'customer' }),
    ...overrides,
  };
}

// ============================================================
// POST /api/auth/login
// ============================================================

describe('POST /api/auth/login — đăng nhập', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Đăng nhập thành công với email + password đúng → 200 kèm token', async () => {
    const mockUser = makeMockUser();
    mockUserFindOneImpl.mockResolvedValue(mockUser);

    const res = await request
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'correctPassword123' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body).toHaveProperty('token');
    expect(res.body).not.toHaveProperty('refreshToken');
    // Refresh token gửi qua httpOnly cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const refreshCookie = Array.isArray(cookies)
      ? cookies.find((c) => c.startsWith('refreshToken='))
      : cookies.startsWith('refreshToken=')
        ? cookies
        : null;
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(res.body.user).toHaveProperty('id');
  });

  test('Email không tồn tại → 401', async () => {
    mockUserFindOneImpl.mockResolvedValue(null);

    const res = await request
      .post('/api/auth/login')
      .send({ email: 'notfound@example.com', password: 'anyPassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Email hoặc mật khẩu không đúng/);
  });

  test('Mật khẩu sai → 401', async () => {
    const mockUser = makeMockUser({
      comparePassword: jest.fn().mockResolvedValue(false),
    });
    mockUserFindOneImpl.mockResolvedValue(mockUser);

    const res = await request
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongPassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Email hoặc mật khẩu không đúng/);
  });

  test('Email chưa xác thực → 401', async () => {
    const mockUser = makeMockUser({ isEmailVerified: false });
    mockUserFindOneImpl.mockResolvedValue(mockUser);

    const res = await request
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'correctPassword123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/xác thực email/);
  });

  test('Thiếu email → 400 validation error', async () => {
    const res = await request.post('/api/auth/login').send({ password: 'somePassword' });

    expect(res.status).toBe(400);
  });

  test('Thiếu password → 400 validation error', async () => {
    const res = await request.post('/api/auth/login').send({ email: 'user@example.com' });

    expect(res.status).toBe(400);
  });
});
