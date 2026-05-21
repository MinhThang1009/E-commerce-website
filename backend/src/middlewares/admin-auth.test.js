/**
 * Tests cho adminAuthenticate và requireSuperAdmin middleware
 *
 * Paths covered:
 * adminAuthenticate:
 *   - Không có Authorization header → 401
 *   - Header không bắt đầu bằng 'Bearer ' → 401
 *   - Token không hợp lệ (malformed) → 401
 *   - Token hết hạn → 401
 *   - Token có jti bị blacklist → 401
 *   - pw_changed stale token → 401
 *   - User không tồn tại → 401
 *   - User có role 'customer' → 403
 *   - User có role 'manager' → pass
 *   - User có role 'admin' → pass
 *   - Email chưa xác thực → 401
 *   - Lỗi không phải JWT → next(error)
 *
 * requireSuperAdmin:
 *   - req.user không được gán → 401
 *   - req.user.role là 'manager' → 403
 *   - req.user.role là 'admin' → next()
 */

'use strict';

process.env.JWT_SECRET = 'test-admin-auth-middleware-secret';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
};

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn(),
}));

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

const { getRedisClient } = require('@config/redis');
const { User } = require('@models');
const { adminAuthenticate, requireSuperAdmin } = require('./admin-auth');

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
  getRedisClient.mockResolvedValue(null);
  mockRedis.get.mockResolvedValue(null);
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

  describe('khi token có jti bị blacklist trong redis', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockImplementation((key) =>
        key === 'bl:admin-jti' ? Promise.resolve('1') : Promise.resolve(null),
      );

      const token = makeToken({ jti: 'admin-jti' });
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi token cấp trước khi user đổi mật khẩu', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      const oldIat = Math.floor(Date.now() / 1000) - 7200;
      const pwChangedAt = oldIat + 3600;

      mockRedis.get.mockImplementation((key) =>
        key === 'pw_changed:1' ? Promise.resolve(String(pwChangedAt)) : Promise.resolve(null),
      );

      // Ký thủ công với iat cũ để tránh JWT override
      const token = jwt.sign(
        { id: 1, role: 'admin', jti: 'old-admin-jti', iat: oldIat, exp: oldIat + 3600 * 24 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' },
      );
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('Mật khẩu');
    });
  });

  describe('khi user không tồn tại trong DB', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(null);
      const token = makeToken();
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi user có role customer', () => {
    it('gọi next với AppError 403', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(makeUser({ role: 'customer' }));
      const token = makeToken({ role: 'customer' });
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('khi user có role manager', () => {
    it('gán req.user và gọi next() không có lỗi', async () => {
      getRedisClient.mockResolvedValue(null);
      const user = makeUser({ role: 'manager' });
      User.findByPk.mockResolvedValue(user);
      const token = makeToken({ role: 'manager' });
      const req = makeReq(token);
      const next = jest.fn();

      await adminAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi user có role admin', () => {
    it('gán req.user và gọi next() không có lỗi', async () => {
      getRedisClient.mockResolvedValue(null);
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

  describe('khi email admin chưa xác thực', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(null);
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
      getRedisClient.mockResolvedValue(null);

      const token = makeToken();
      const next = jest.fn();

      await adminAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('khi token không có jti — bỏ qua blacklist check (branch if(decoded.jti) false, line 30)', () => {
    it('tiếp tục xác thực bình thường dù redis khả dụng', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockResolvedValue(null);

      const user = makeUser({ role: 'admin' });
      User.findByPk.mockResolvedValue(user);

      // Token không có trường jti → decoded.jti là undefined → if(decoded.jti) = false
      const tokenWithoutJti = jwt.sign(
        { id: 1, role: 'admin' }, // không có jti
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' },
      );
      const req = makeReq(tokenWithoutJti);
      const next = jest.fn();

      await adminAuthenticate(req, makeRes(), next);

      // Không check blacklist, tiếp tục → next() không lỗi
      expect(next).toHaveBeenCalledWith();
      // redis.get không được gọi với bl: prefix
      const blCalls = mockRedis.get.mock.calls.filter((c) => c[0].startsWith('bl:'));
      expect(blCalls).toHaveLength(0);
    });
  });

  describe('khi pw_changed không được set trong redis — bỏ qua stale-token check (branch line 35 false)', () => {
    it('tiếp tục xác thực bình thường khi pw_changed = null', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      // redis trả null cho cả blacklist và pw_changed
      mockRedis.get.mockResolvedValue(null);

      const user = makeUser({ role: 'admin' });
      User.findByPk.mockResolvedValue(user);

      const token = makeToken({ jti: 'fresh-jti' });
      const req = makeReq(token);
      const next = jest.fn();

      await adminAuthenticate(req, makeRes(), next);

      // pwChanged = null → `if (pwChanged && ...)` false → không reject → next() không lỗi
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
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

  describe('khi user có role manager', () => {
    it('gọi next với AppError 403', () => {
      const next = jest.fn();
      requireSuperAdmin({ user: { role: 'manager' } }, makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain('Super Admin');
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
});
