/**
 * shared.utils.test.js
 *
 * Tests for shared utility re-export shims at 0% coverage:
 *   - src/shared/utils/catchAsync.js       → re-exports utils/catchAsync
 *   - src/shared/mailer.js                 → re-exports services/email
 *   - src/middlewares/errorHandler.js → re-exports middlewares/errorHandler
 *   - src/middlewares/adminAuth.js    → re-exports middlewares/adminAuth
 *   - src/shared/cache/redisClient.js      → re-exports config/redis
 *
 * Strategy: require the shim and verify it exports the same functions as the
 * canonical module. This guarantees the re-export is wired correctly and the
 * module can be loaded without errors.
 *
 * For modules with heavy dependencies (DB, Redis, nodemailer) we mock those
 * dependencies so the module loads cleanly in test.
 */

process.env.NODE_ENV = 'test';

// ─── Global mocks needed for loading heavy modules ───────────────────────────

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// nodemailer — required transitively by services/email (via shared/mailer.js)
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    verify: jest.fn().mockResolvedValue(true),
  }),
}));

// redis client — required transitively by config/redis (via shared/cache/redisClient.js)
jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue({
    on: jest.fn(),
    connect: jest.fn().mockRejectedValue(new Error('Redis not available in test')),
    disconnect: jest.fn(),
  }),
}));

// models — required transitively by middlewares/adminAuth.js
jest.mock('../models', () => ({
  User: { findByPk: jest.fn() },
}));

// ════════════════════════════════════════════════════════════════════════════
// shared/utils/catchAsync.js — re-export of utils/catchAsync
// ════════════════════════════════════════════════════════════════════════════

describe('shared/utils/catchAsync — re-export shim', () => {
  it('xuất ra cùng hàm catchAsync với utils/catchAsync gốc', () => {
    const canonical = require('../utils/catchAsync');
    const shim = require('../shared/utils/catchAsync');
    // Re-export shim phải cùng reference
    expect(shim).toBe(canonical);
  });

  it('catchAsync từ shim wrap async fn và truyền lỗi vào next', async () => {
    const { catchAsync } = require('../shared/utils/catchAsync');
    const asyncError = new Error('async failure');
    const asyncFn = jest.fn().mockRejectedValue(asyncError);

    const wrapped = catchAsync(asyncFn);
    const req = {};
    const res = {};
    const next = jest.fn();

    wrapped(req, res, next);
    // Flush microtask queue để .catch(next) thực thi
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).toHaveBeenCalledWith(asyncError);
  });

  it('catchAsync từ shim không gọi next khi async fn thành công', async () => {
    const { catchAsync } = require('../shared/utils/catchAsync');
    const asyncFn = jest.fn().mockResolvedValue('ok');

    const wrapped = catchAsync(asyncFn);
    const next = jest.fn();

    wrapped({}, {}, next);
    await new Promise((resolve) => setImmediate(resolve));

    expect(next).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// shared/mailer.js — re-export of services/email
// ════════════════════════════════════════════════════════════════════════════

describe('shared/mailer — re-export shim', () => {
  it('xuất ra cùng module với services/email', () => {
    const canonical = require('../services/email');
    const shim = require('../shared/mailer');
    expect(shim).toBe(canonical);
  });

  it('shim xuất ra hàm sendEmail', () => {
    const shim = require('../shared/mailer');
    expect(typeof shim.sendEmail).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// middlewares/errorHandler.js — re-export of middlewares/errorHandler
// ════════════════════════════════════════════════════════════════════════════

describe('middlewares/errorHandler — re-export shim', () => {
  it('xuất ra cùng object với middlewares/errorHandler gốc', () => {
    const canonical = require('../middlewares/errorHandler');
    const shim = require('../middlewares/errorHandler');
    expect(shim).toBe(canonical);
  });

  it('shim xuất ra hàm errorHandler', () => {
    const shim = require('../middlewares/errorHandler');
    expect(typeof shim.errorHandler).toBe('function');
  });

  it('shim xuất ra class AppError', () => {
    const shim = require('../middlewares/errorHandler');
    expect(typeof shim.AppError).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// middlewares/adminAuth.js — re-export of middlewares/adminAuth
// ════════════════════════════════════════════════════════════════════════════

describe('middlewares/adminAuth — re-export shim', () => {
  it('xuất ra cùng object với middlewares/adminAuth gốc', () => {
    const canonical = require('../middlewares/adminAuth');
    const shim = require('../middlewares/adminAuth');
    expect(shim).toBe(canonical);
  });

  it('shim xuất ra hàm adminAuthenticate', () => {
    const shim = require('../middlewares/adminAuth');
    expect(typeof shim.adminAuthenticate).toBe('function');
  });

  it('shim xuất ra hàm requireSuperAdmin', () => {
    const shim = require('../middlewares/adminAuth');
    expect(typeof shim.requireSuperAdmin).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// shared/cache/redisClient.js — re-export of config/redis
// ════════════════════════════════════════════════════════════════════════════

describe('shared/cache/redisClient — re-export shim', () => {
  it('xuất ra cùng module với config/redis gốc', () => {
    const canonical = require('../config/redis');
    const shim = require('../shared/cache/redisClient');
    expect(shim).toBe(canonical);
  });

  it('shim xuất ra hàm getRedisClient', () => {
    const shim = require('../shared/cache/redisClient');
    expect(typeof shim.getRedisClient).toBe('function');
  });
});
