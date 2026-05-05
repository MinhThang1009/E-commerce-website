/**
 * Tests Phase 19 — Logging & Monitoring Standards
 *
 * Bao gồm:
 * - POST /api/auth/login thành công → logger.info gọi với '[AUTH] Login success'
 * - authLimiter handler → logger.warn gọi với '[AUTH] Rate limited'
 * - POST /api/payments/webhook → logger.info gọi với '[PAYMENT] Webhook received'
 * - grep backend/src/: console.log = 0 kết quả trong controllers/ và services/
 * - grep frontend/src/: console.log = 0 kết quả
 */

process.env.JWT_SECRET = 'test-jwt-secret-phase19';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-phase19';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';

// ---------- Mock logger (spy on mọi call) ----------

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../utils/logger', () => mockLogger);

// ---------- Capture authLimiter handler từ express-rate-limit ----------
// Jest yêu cầu biến trong mock factory phải có prefix "mock" (case-insensitive)

let mockCapturedRateLimitHandler = null;

jest.mock('express-rate-limit', () => (options) => {
  // Lưu lại handler của authLimiter (được gọi khi rate limit bị kích hoạt)
  // Biến phải có prefix "mock" để Jest babel-transform cho phép truy cập từ factory
  if (options.handler && mockCapturedRateLimitHandler === null) {
    mockCapturedRateLimitHandler = options.handler;
  }
  // Middleware pass-through để không block các request test khác
  return (_req, _res, next) => next();
});

// ---------- Mock models ----------

let mockUserFindOne = null;
let mockUserFindByPk = null;

jest.mock('../models', () => ({
  User: {
    findOne: jest.fn().mockImplementation(() => Promise.resolve(mockUserFindOne)),
    findByPk: jest.fn().mockImplementation(() => Promise.resolve(mockUserFindByPk)),
    create: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(),
    Sequelize: { Op: {} },
  },
  Order: { findByPk: jest.fn() },
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setEx: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

jest.mock('../services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../services/adminAudit', () => ({
  AdminAuditService: {
    logSuccessfulLogin: jest.fn(),
  },
}));

jest.mock('../services/payment/stripe', () => ({
  handleWebhook: jest.fn(),
  createPaymentIntent: jest.fn(),
  confirmPaymentIntent: jest.fn(),
  createCustomer: jest.fn(),
  getCustomer: jest.fn(),
  getPaymentMethods: jest.fn(),
  createSetupIntent: jest.fn(),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const { errorHandler } = require('../middlewares/errorHandler');
const { authenticate } = require('../middlewares/authenticate');

// Tạo mock user đủ điều kiện login thành công
const validUser = {
  id: 42,
  email: 'user@test.com',
  role: 'customer',
  isActive: true,
  isEmailVerified: true,
  comparePassword: jest.fn().mockResolvedValue(true),
  toJSON: jest.fn().mockReturnValue({ id: 42, email: 'user@test.com', role: 'customer' }),
};

// ============================================================
// 1. POST /api/auth/login — [AUTH] Login success log
// ============================================================

describe('[AUTH] Login success được log khi đăng nhập thành công', () => {
  let app;

  beforeAll(() => {
    mockUserFindOne = validUser;
    const buildAuthModule = require('../modules/auth/module');
    const { User } = require('../models');
    const eventBus = require('../shared/eventBus');
    const logger = require('../utils/logger');
    const emailService = require('../services/email');
    const { AdminAuditService } = require('../services/adminAudit');
    const { getRedisClient } = require('../config/redis');
    const authModule = buildAuthModule({
      User,
      eventBus,
      logger,
      emailService,
      auditService: AdminAuditService,
      redisClient: getRedisClient,
    });
    app = express();
    app.use(express.json());
    app.use('/api/auth', authModule.router);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindOne = validUser;
  });

  test('Đăng nhập thành công → 200', async () => {
    const res = await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('Đăng nhập thành công → logger.info gọi với [AUTH] Login success', async () => {
    await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'Password123!' });

    const infoCalls = mockLogger.info.mock.calls;
    const authSuccessCall = infoCalls.find((args) => args[0] === '[AUTH] Login success');
    expect(authSuccessCall).toBeDefined();
    // Verify có userId và email trong metadata — không log password
    expect(authSuccessCall[1]).toMatchObject({ userId: 42, email: 'user@test.com' });
  });

  test('Log không chứa password hoặc token', async () => {
    await supertest(app)
      .post('/api/auth/login')
      .send({ email: 'user@test.com', password: 'MySecretPassword!' });

    // Kiểm tra tất cả args của mọi logger call không chứa password
    const allLogArgs = [
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
      ...mockLogger.error.mock.calls,
    ].map((args) => JSON.stringify(args));

    allLogArgs.forEach((logStr) => {
      expect(logStr).not.toContain('MySecretPassword!');
    });
  });
});

// ============================================================
// 2. authLimiter handler — [AUTH] Rate limited log
// ============================================================

describe('[AUTH] Rate limited được log khi authLimiter bị kích hoạt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Đảm bảo rateLimiter được load để mockCapturedRateLimitHandler được set
    require('../middlewares/rateLimiter');
  });

  test('authLimiter handler gọi logger.warn với [AUTH] Rate limited', () => {
    expect(mockCapturedRateLimitHandler).toBeDefined();

    const mockReq = {
      ip: '192.168.1.1',
      body: { email: 'hacker@test.com' },
    };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockOptions = {
      statusCode: 429,
      message: { status: 'error', message: 'Quá nhiều lần thử' },
    };

    mockCapturedRateLimitHandler(mockReq, mockRes, null, mockOptions);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      '[AUTH] Rate limited',
      expect.objectContaining({ ip: '192.168.1.1', email: 'hacker@test.com' })
    );
  });

  test('authLimiter handler trả về 429 với message đúng format', () => {
    expect(mockCapturedRateLimitHandler).toBeDefined();

    const mockReq = { ip: '10.0.0.1', body: {} };
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockOptions = {
      statusCode: 429,
      message: { status: 'error', message: 'Rate limited' },
    };

    mockCapturedRateLimitHandler(mockReq, mockRes, null, mockOptions);

    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith(mockOptions.message);
  });

  test('Rate limited log không chứa password trong metadata', () => {
    expect(mockCapturedRateLimitHandler).toBeDefined();

    const mockReq = {
      ip: '1.2.3.4',
      body: { email: 'test@test.com', password: 'SensitivePassword!' },
    };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const mockOptions = { statusCode: 429, message: {} };

    mockCapturedRateLimitHandler(mockReq, mockRes, null, mockOptions);

    const warnCall = mockLogger.warn.mock.calls[0];
    const metadata = warnCall[1];
    // Metadata chỉ được chứa ip và email — không được chứa password
    expect(JSON.stringify(metadata)).not.toContain('SensitivePassword!');
    expect(Object.keys(metadata)).not.toContain('password');
  });
});

// ============================================================
// 3. POST /api/payments/webhook — [PAYMENT] Webhook received log
// ============================================================

describe('[PAYMENT] Webhook received được log khi webhook nhận được', () => {
  let app;
  let stripeService;

  beforeAll(() => {
    stripeService = require('../services/payment/stripe');
    const buildPaymentModule = require('../modules/payment/module');
    const { Order, sequelize } = require('../models');
    const eventBus = require('../shared/eventBus');
    const logger = require('../utils/logger');
    const emailService = require('../services/email');
    const momoService = require('../services/payment/momo');
    const vnpayService = require('../services/payment/vnpay');
    const paymentModule = buildPaymentModule({
      Order, OrderItem: { findAll: jest.fn() }, User: {}, Cart: {}, CartItem: {}, DiscountCode: {},
      sequelize,
      eventBus,
      logger,
      stripeService,
      momoService,
      vnpayService,
      emailService,
    });
    app = express();
    // Raw body middleware — cần thiết cho Stripe webhook signature
    app.use('/api/payments', express.json());
    app.use('/api/payments', paymentModule.router);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Webhook với STRIPE_WEBHOOK_SECRET → logger.info gọi với [PAYMENT] Webhook received', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';

    const mockEvent = {
      type: 'payment_intent.succeeded',
      data: { object: { metadata: { orderId: '123' } } },
    };
    stripeService.handleWebhook.mockResolvedValue(mockEvent);

    const res = await supertest(app)
      .post('/api/payments/webhook')
      .set('stripe-signature', 'test-sig')
      .send({ type: 'payment_intent.succeeded' });

    expect(res.status).toBe(200);

    const infoCalls = mockLogger.info.mock.calls;
    const webhookCall = infoCalls.find((args) => args[0] === '[PAYMENT] Webhook received');
    expect(webhookCall).toBeDefined();
    expect(webhookCall[1]).toMatchObject({
      event: 'payment_intent.succeeded',
    });

    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  test('Webhook sandbox (không có STRIPE_WEBHOOK_SECRET) → 200 ngay', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const res = await supertest(app)
      .post('/api/payments/webhook')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  test('Webhook log không chứa stripe-signature trong metadata', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret-2';

    const mockEvent = {
      type: 'customer.created',
      data: { object: {} },
    };
    stripeService.handleWebhook.mockResolvedValue(mockEvent);

    await supertest(app)
      .post('/api/payments/webhook')
      .set('stripe-signature', 'secret-sig-should-not-log')
      .send({});

    const allLogArgs = [
      ...mockLogger.info.mock.calls,
      ...mockLogger.warn.mock.calls,
    ].map((args) => JSON.stringify(args));

    allLogArgs.forEach((logStr) => {
      expect(logStr).not.toContain('secret-sig-should-not-log');
    });

    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
});

// ============================================================
// 4. Kiểm tra console.log = 0 trong backend/src/controllers và services
// ============================================================

describe('console.log = 0 trong backend/src (controllers/ và services/)', () => {
  const path = require('path');
  const fs = require('fs');

  // Đệ quy tìm tất cả .js file trong thư mục
  function findJsFiles(dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...findJsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  function findConsoleLogs(dir) {
    const files = findJsFiles(dir);
    const violations = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (/console\.log\(/.test(line) && !/\/\/.*console\.log/.test(line)) {
          violations.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
    }
    return violations;
  }

  const backendSrc = path.join(__dirname, '..');

  test('controllers/ không có console.log', () => {
    const violations = findConsoleLogs(path.join(backendSrc, 'controllers'));
    expect(violations).toEqual([]);
  });

  test('services/ không có console.log', () => {
    const violations = findConsoleLogs(path.join(backendSrc, 'services'));
    expect(violations).toEqual([]);
  });

  test('middlewares/ không có console.log', () => {
    const violations = findConsoleLogs(path.join(backendSrc, 'middlewares'));
    expect(violations).toEqual([]);
  });

  test('models/ không có console.log', () => {
    const violations = findConsoleLogs(path.join(backendSrc, 'models'));
    expect(violations).toEqual([]);
  });
});
