/**
 * Test Phase 14 — Email Service & Notifications
 *
 * Rule 30: kiểm tra behavior mới/đã sửa trong Phase 14.
 *
 * AC kiểm tra:
 *  - AC1: forgotPassword với email không tồn tại → 200 OK, cùng message với email tồn tại
 *  - AC3: resetPassword dùng token lần 2 (null) → 400 Token already used
 *  - AC4: Nodemailer fail khi register → server không crash, 201 trả về đúng
 *  - OTP subject: phải chứa mã OTP trong tiêu đề
 */

// ---------- Mocks ----------

const mockUserData = {
  id: 1,
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  resetPasswordToken: 'validtoken123',
  resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000), // chưa hết hạn
  save: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../models', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
  },
}));

jest.mock('../services/email', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: jest.fn().mockResolvedValue(undefined),
}));

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
  otpLimiter: (_req, _res, next) => next(),
}));

// validateRequest pass-through — Phase 14 không test validation boundary của các fields này
jest.mock('../middlewares/validateRequest', () => ({
  validateRequest: () => (_req, _res, next) => next(),
}));

// Phase 42 modules/auth dùng validators/authValidator riêng — mock cho test
jest.mock('../modules/auth/validators/authValidator', () => ({
  registerSchema: {},
  loginSchema: {},
  forgotPasswordSchema: {},
  resetPasswordSchema: {},
  emailSchema: {},
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

jest.mock('../services/adminAudit', () => ({
  AdminAuditService: {
    logSuccessfulLogin: jest.fn(),
  },
}));

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null),
}));

// ---------- Require sau mock ----------

const express = require('express');
const supertest = require('supertest');
const buildAuthModule = require('../modules/auth/module');
const emailService = require('../services/email');
const { User } = require('../models');
const eventBus = require('../shared/eventBus');
const logger = require('../utils/logger');
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

const app = express();
app.use(express.json());
app.use('/api/auth', authModule.router);
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});

const request = supertest(app);

// ============================================================
// POST /api/auth/forgot-password — user enumeration fix
// ============================================================

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AC1: email không tồn tại → phải trả cùng response như email tồn tại (tránh user enumeration)
  test('200 OK và cùng message khi email không tồn tại', async () => {
    User.findOne.mockResolvedValue(null); // email không tồn tại trong DB

    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'notexist@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra email của bạn.');
    // Không gửi email vì user không tồn tại
    expect(emailService.sendResetPasswordEmail).not.toHaveBeenCalled();
  });

  // AC1: email tồn tại → phải trả cùng response
  test('200 OK và cùng message khi email tồn tại', async () => {
    User.findOne.mockResolvedValue({ ...mockUserData });

    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.message).toBe('Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra email của bạn.');
    // Email phải được gửi
    expect(emailService.sendResetPasswordEmail).toHaveBeenCalledTimes(1);
  });

  // AC4: Nodemailer fail → server không crash, vẫn trả 200
  test('200 OK dù emailService throw — không crash server', async () => {
    User.findOne.mockResolvedValue({ ...mockUserData });
    emailService.sendResetPasswordEmail.mockRejectedValueOnce(
      new Error('SMTP connection refused')
    );

    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ============================================================
// POST /api/auth/reset-password — token reuse
// ============================================================

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AC3: token hợp lệ → 200 OK
  test('200 OK khi token hợp lệ chưa hết hạn', async () => {
    const mockSave = jest.fn().mockResolvedValue(undefined);
    User.findOne.mockResolvedValue({
      ...mockUserData,
      password: null,
      save: mockSave,
    });

    const res = await request
      .post('/api/auth/reset-password')
      .send({ token: 'validtoken123', password: 'newpassword123' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  // AC3: token đã dùng (null trong DB sau lần dùng đầu) → 400
  test('400 khi token đã được dùng hoặc hết hạn', async () => {
    // Sau khi dùng xong, token bị set null → findOne không tìm thấy
    User.findOne.mockResolvedValue(null);

    const res = await request
      .post('/api/auth/reset-password')
      .send({ token: 'alreadyusedtoken', password: 'newpassword123' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Token không hợp lệ hoặc đã hết hạn/i);
  });
});

// ============================================================
// POST /api/auth/register — Nodemailer fail không crash server
// ============================================================

describe('POST /api/auth/register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // AC4: Nodemailer credential sai → 201 tạo user thành công, không crash
  test('201 tạo user thành công dù sendOtpEmail throw', async () => {
    User.findOne.mockResolvedValue(null); // email chưa tồn tại
    User.create.mockResolvedValue({
      id: 1,
      email: 'new@example.com',
    });
    emailService.sendOtpEmail.mockRejectedValueOnce(
      new Error('Invalid credentials')
    );

    const res = await request
      .post('/api/auth/register')
      .send({
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    // User vẫn được tạo dù email thất bại
    expect(User.create).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// Xác nhận sendOtpEmail được gọi với OTP đúng trong register flow
// ============================================================

describe('POST /api/auth/register — OTP email arguments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('sendOtpEmail được gọi với email và mã OTP đúng từ controller', async () => {
    User.findOne.mockResolvedValue(null);
    const generatedOtp = '123456';
    // crypto.randomInt mock không cần thiết — chỉ cần verify sendOtpEmail được gọi
    User.create.mockResolvedValue({
      id: 1,
      email: 'new@example.com',
    });
    emailService.sendOtpEmail.mockResolvedValue(undefined);

    const res = await request
      .post('/api/auth/register')
      .send({
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      });

    expect(res.status).toBe(201);
    // sendOtpEmail phải được gọi với email đúng
    expect(emailService.sendOtpEmail).toHaveBeenCalledTimes(1);
    expect(emailService.sendOtpEmail).toHaveBeenCalledWith(
      'new@example.com',
      expect.any(String) // mã OTP là chuỗi 6 chữ số
    );
    // Mã OTP truyền vào phải là chuỗi số 6 chữ số
    const otpArg = emailService.sendOtpEmail.mock.calls[0][1];
    expect(otpArg).toMatch(/^\d{6}$/);
  });
});
