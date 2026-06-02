/**
 * Tests cho adminAuthenticate và requireSuperAdmin middleware
 *
 * Paths covered:
 * adminAuthenticate:
 *   - Không có Authorization header → 401
 *   - Header không bắt đầu bằng 'Bearer ' → 401
 *   - Token không hợp lệ (malformed) → 401
 *   - Token hết hạn → 401
 *   - User không tồn tại → 401
 *   - User có role 'customer' → 403
 *   - User có role 'admin' → pass
 *   - Email chưa xác thực → 401
 *   - Lỗi không phải JWT → next(error)
 *
 * requireSuperAdmin:
 *   - req.user không được gán → 401
 *   - req.user.role là 'customer' → 403
 *   - req.user.role là 'admin' → next()
 */

'use strict';

process.env.JWT_SECRET = 'test-admin-auth-middleware-secret';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@models', () => ({
  User: {
    findByPk: jest.fn(),
  },
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { User } = require('@models');
const { adminAuthenticate, requireRole, requireSuperAdmin } = require('./admin-auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload = {}, expiresIn = '1h') {
  return jwt.sign(
    { id: 1, role: 'admin', jti: 'admin-jti', iat: Math.floor(Date.now() / 1000), ...payload },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn },
  );
}

function makeUser(overrides = {}) {
  return {
    id: 1,
    role: 'admin',
    email: 'admin@test.com',
    isActive: true,
    isEmailVerified: true,
    ...overrides,
  };
}

function makeReq(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

function makeRes() {
  return {};
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── adminAuthenticate ────────────────────────────────────────────────────────

describe('adminAuthenticate', () => {
  describe('khi không có Authorization header', () => {
    it('gọi next với AppError 401', async () => {
      const next = jest.fn();
      await adminAuthenticate(makeReq(null), makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi header không bắt đầu bằng Bearer', () => {
    it('gọi next với AppError 401', async () => {
      const next = jest.fn();
      const req = { headers: { authorization: 'Token abc' } };
      await adminAuthenticate(req, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi token không hợp lệ (malformed)', () => {
    it('gọi next với AppError 401', async () => {
      const next = jest.fn();
      await adminAuthenticate(makeReq('not.valid.jwt'), makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
    });
  });

  describe('khi token đã hết hạn', () => {
    it('gọi next với AppError 401', async () => {
      const expiredToken = makeToken({}, '-1s');
      const next = jest.fn();
      await adminAuthenticate(makeReq(expiredToken), makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi user không tồn tại trong DB', () => {
    it('gọi next với AppError 401', async () => {
      User.findByPk.mockResolvedValue(null);
      const token = makeToken();
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi user có role customer', () => {
    it('gọi next với AppError 403', async () => {
      User.findByPk.mockResolvedValue(makeUser({ role: 'customer' }));
      const token = makeToken({ role: 'customer' });
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('khi user có role admin', () => {
    it('gán req.user và gọi next() không có lỗi', async () => {
      const user = makeUser({ role: 'admin' });
      User.findByPk.mockResolvedValue(user);
      const token = makeToken({ role: 'admin' });
      const req = makeReq(token);
      const next = jest.fn();

      await adminAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi user có role staff', () => {
    it('cho staff vào back-office: gán req.user và gọi next() không có lỗi', async () => {
      const user = makeUser({ role: 'staff', email: 'staff@test.com' });
      User.findByPk.mockResolvedValue(user);
      const token = makeToken({ role: 'staff' });
      const req = makeReq(token);
      const next = jest.fn();

      await adminAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi email admin chưa xác thực', () => {
    it('gọi next với AppError 401', async () => {
      User.findByPk.mockResolvedValue(makeUser({ role: 'admin', isEmailVerified: false }));
      const token = makeToken();
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('xác thực email');
    });
  });

  describe('khi có lỗi không phải JWT (lỗi DB)', () => {
    it('gọi next(error) để propagate lỗi', async () => {
      const dbError = new Error('DB unavailable');
      User.findByPk.mockRejectedValue(dbError);

      const token = makeToken();
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });
});

// ─── requireSuperAdmin ────────────────────────────────────────────────────────

describe('requireSuperAdmin', () => {
  describe('khi req.user không được gán', () => {
    it('gọi next với AppError 401', () => {
      const next = jest.fn();
      requireSuperAdmin(
        {
          /* không có user */
        },
        makeRes(),
        next,
      );
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi user có role customer', () => {
    it('gọi next với AppError 403', () => {
      const next = jest.fn();
      requireSuperAdmin({ user: { role: 'customer' } }, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('khi user có role admin', () => {
    it('gọi next() không có lỗi', () => {
      const next = jest.fn();
      requireSuperAdmin({ user: { role: 'admin' } }, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi user có role staff', () => {
    it('gọi next với AppError 403 — staff không có quyền quản trị hệ thống', () => {
      const next = jest.fn();
      requireSuperAdmin({ user: { role: 'staff' } }, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});

// ─── requireRole ────────────────────────────────────────────────────────────────

describe('requireRole', () => {
  describe('khi req.user không được gán', () => {
    it('gọi next với AppError 401', () => {
      const next = jest.fn();
      requireRole('staff')({}, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('requireRole(staff)', () => {
    it('cho staff qua: gọi next() không có lỗi', () => {
      const next = jest.fn();
      requireRole('staff')({ user: { role: 'staff' } }, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('chặn admin: gọi next với AppError 403 — endpoint nghiệp vụ chỉ staff', () => {
      const next = jest.fn();
      requireRole('staff')({ user: { role: 'admin' } }, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('requireRole(admin, staff) — back-office xem chung', () => {
    it('cho admin qua', () => {
      const next = jest.fn();
      requireRole('admin', 'staff')({ user: { role: 'admin' } }, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('cho staff qua', () => {
      const next = jest.fn();
      requireRole('admin', 'staff')({ user: { role: 'staff' } }, makeRes(), next);
      expect(next).toHaveBeenCalledWith();
    });

    it('chặn customer: gọi next với AppError 403', () => {
      const next = jest.fn();
      requireRole('admin', 'staff')({ user: { role: 'customer' } }, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
