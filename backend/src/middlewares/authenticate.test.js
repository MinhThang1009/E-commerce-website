/**
 * Tests cho authenticate và optionalAuthenticate middleware
 *
 * Paths covered:
 * authenticate:
 *   - Không có Authorization header → 401
 *   - Header không bắt đầu bằng 'Bearer ' → 401
 *   - Token hợp lệ, không có redis → pass
 *   - Token có jti bị blacklist trong redis → 401
 *   - Token bị invalidate bởi pw_changed (iat < pwChanged) → 401
 *   - pw_changed nhưng iat >= pwChanged → pass (token mới hơn)
 *   - User không tồn tại → 401
 *   - User bị khóa (isActive=false) → 401
 *   - Email chưa xác thực → 401
 *   - Token hết hạn / không hợp lệ → 401
 *   - Lỗi không phải JWT → next(error) được gọi
 *
 * optionalAuthenticate:
 *   - Không có header → next() không có lỗi
 *   - Token không hợp lệ → next() không có lỗi (tiếp tục như guest)
 *   - Token bị blacklist → next() không có lỗi
 *   - pw_changed stale token → next() không có lỗi
 *   - User không tồn tại → next() không có lỗi
 *   - User bị khóa → 401
 *   - Email chưa xác thực → 401
 *   - Token hợp lệ, user ok → req.user được gán
 */

'use strict';

process.env.JWT_SECRET = 'test-auth-middleware-secret';
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

// Helpers
const { getRedisClient } = require('@config/redis');
const { User } = require('@models');
const { authenticate, optionalAuthenticate } = require('./authenticate');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload = {}, expiresIn = '1h') {
  return jwt.sign(
    { id: 1, role: 'customer', jti: 'test-jti', iat: Math.floor(Date.now() / 1000), ...payload },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn }
  );
}

function makeUser(overrides = {}) {
  return {
    id: 1,
    role: 'customer',
    email: 'user@test.com',
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

// ─── Shared setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  getRedisClient.mockResolvedValue(null); // mặc định: redis không khả dụng
  mockRedis.get.mockResolvedValue(null);
});

// ─── authenticate ─────────────────────────────────────────────────────────────

describe('authenticate', () => {
  describe('khi không có Authorization header', () => {
    it('gọi next với AppError 401', async () => {
      const next = jest.fn();
      await authenticate(makeReq(null), makeRes(), next);
      expect(next).toHaveBeenCalledTimes(1);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
    });
  });

  describe('khi header không bắt đầu bằng Bearer', () => {
    it('gọi next với AppError 401', async () => {
      const next = jest.fn();
      const req = { headers: { authorization: 'Basic abc123' } };
      await authenticate(req, makeRes(), next);
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi token không hợp lệ (JsonWebTokenError)', () => {
    it('gọi next với AppError 401 thay vì ném exception', async () => {
      const next = jest.fn();
      await authenticate(makeReq('this.is.not.a.jwt'), makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
    });
  });

  describe('khi token đã hết hạn (TokenExpiredError)', () => {
    it('gọi next với AppError 401', async () => {
      const expiredToken = makeToken({}, '-1s');
      const next = jest.fn();
      await authenticate(makeReq(expiredToken), makeRes(), next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(401);
    });
  });

  describe('khi redis không khả dụng', () => {
    it('bỏ qua kiểm tra blacklist, tiếp tục tìm user', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(makeUser());
      const token = makeToken();
      const req = makeReq(token);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith(); // không có lỗi
      expect(req.user).toBeDefined();
    });
  });

  describe('khi token có jti bị blacklist trong redis', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockImplementation((key) => {
        if (key === 'bl:test-jti') return Promise.resolve('1');
        return Promise.resolve(null);
      });

      const token = makeToken({ jti: 'test-jti' });
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('invalid');
    });
  });

  describe('khi token cấp trước khi user đổi mật khẩu', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      // Tạo token với iat cũ thật sự: ký không dùng expiresIn để kiểm soát iat
      const oldIat = Math.floor(Date.now() / 1000) - 3600; // 1h trước
      const pwChangedAt = Math.floor(Date.now() / 1000) - 1800; // 30 phút trước
      const token = jwt.sign(
        { id: 1, role: 'customer', jti: 'tok-1', iat: oldIat, exp: oldIat + 7200 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' }
      );

      mockRedis.get.mockImplementation((key) => {
        if (key === 'pw_changed:1') return Promise.resolve(String(pwChangedAt));
        return Promise.resolve(null);
      });

      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('Mật khẩu');
    });
  });

  describe('khi token cấp sau khi user đổi mật khẩu', () => {
    it('tiếp tục bình thường (iat > pwChanged)', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      const pwChangedAt = Math.floor(Date.now() / 1000) - 3600; // đổi 1h trước
      // Token mới: iat = pwChangedAt + 600 (10 phút sau khi đổi mật khẩu)
      const newIat = pwChangedAt + 600;

      mockRedis.get.mockImplementation((key) => {
        if (key === 'pw_changed:1') return Promise.resolve(String(pwChangedAt));
        return Promise.resolve(null);
      });

      User.findByPk.mockResolvedValue(makeUser());
      const token = jwt.sign(
        { id: 1, role: 'customer', jti: 'new-tok', iat: newIat, exp: newIat + 3600 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' }
      );
      const req = makeReq(token);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith(); // pass
    });
  });

  describe('khi user không tồn tại trong DB', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(null);
      const token = makeToken();
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi tài khoản bị khóa (isActive=false)', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(makeUser({ isActive: false }));
      const token = makeToken();
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('khóa');
    });
  });

  describe('khi email chưa được xác thực', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(makeUser({ isEmailVerified: false }));
      const token = makeToken();
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('xác thực email');
    });
  });

  describe('khi token hợp lệ và user ok', () => {
    it('gán req.user và gọi next() không có lỗi', async () => {
      getRedisClient.mockResolvedValue(null);
      const user = makeUser({ id: 42 });
      User.findByPk.mockResolvedValue(user);
      const token = makeToken({ id: 42 });
      const req = makeReq(token);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi có lỗi không phải JWT', () => {
    it('gọi next(error) để propagate lỗi', async () => {
      const dbError = new Error('DB connection failed');
      User.findByPk.mockRejectedValue(dbError);
      getRedisClient.mockResolvedValue(null);

      const token = makeToken();
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('khi token không có jti — bỏ qua blacklist check (branch if(decoded.jti) false, line 23)', () => {
    it('tiếp tục xác thực bình thường khi jti không tồn tại trong token', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockResolvedValue(null); // pw_changed cũng null

      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      // Ký token không có jti → decoded.jti = undefined → if(decoded.jti) false
      const tokenWithoutJti = jwt.sign(
        { id: 1, role: 'customer' }, // không có jti
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      const req = makeReq(tokenWithoutJti);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

      // Không gọi redis.get với prefix bl: (blacklist không được check)
      const blCalls = mockRedis.get.mock.calls.filter((c) => c[0].startsWith('bl:'));
      expect(blCalls).toHaveLength(0);
      // Vẫn pass → next() không có lỗi
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi pw_changed = null trong redis — bỏ qua stale-token check (line 31 false)', () => {
    it('tiếp tục bình thường khi pw_changed key không tồn tại', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockResolvedValue(null); // cả bl: và pw_changed: đều null

      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      const token = makeToken({ jti: 'valid-jti' });
      const req = makeReq(token);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

      // pwChanged = null → if(pwChanged && ...) false → không reject
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });
});

// ─── optionalAuthenticate ─────────────────────────────────────────────────────

describe('optionalAuthenticate', () => {
  describe('khi không có Authorization header', () => {
    it('gọi next() mà không có lỗi (tiếp tục như guest)', async () => {
      const next = jest.fn();
      const req = makeReq(null);

      await optionalAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });
  });

  describe('khi header không bắt đầu bằng Bearer', () => {
    it('gọi next() không có lỗi', async () => {
      const next = jest.fn();
      const req = { headers: { authorization: 'Basic xyz' } };

      await optionalAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBeUndefined();
    });
  });

  describe('khi token không hợp lệ (JsonWebTokenError)', () => {
    it('gọi next() không có lỗi (tiếp tục như guest)', async () => {
      const next = jest.fn();

      await optionalAuthenticate(makeReq('bad.token.here'), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi token đã hết hạn', () => {
    it('gọi next() không có lỗi (tiếp tục như guest)', async () => {
      const expiredToken = makeToken({}, '-1s');
      const next = jest.fn();

      await optionalAuthenticate(makeReq(expiredToken), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi token có jti bị blacklist', () => {
    it('gọi next() không có lỗi (bỏ qua token)', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockImplementation((key) =>
        key === 'bl:test-jti' ? Promise.resolve('1') : Promise.resolve(null)
      );

      const token = makeToken({ jti: 'test-jti' });
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi token là stale (cấp trước khi đổi mật khẩu)', () => {
    it('gọi next() không có lỗi', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      const oldIat = Math.floor(Date.now() / 1000) - 3600;
      const pwChangedAt = oldIat + 1800;

      mockRedis.get.mockImplementation((key) =>
        key === 'pw_changed:1' ? Promise.resolve(String(pwChangedAt)) : Promise.resolve(null)
      );

      const token = makeToken({ iat: oldIat });
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi user không tồn tại', () => {
    it('gọi next() không có lỗi (tiếp tục như guest)', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(null);
      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi tài khoản bị khóa', () => {
    it('gọi next với AppError 401 (không silently tiếp tục)', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(makeUser({ isActive: false }));
      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].message).toContain('khóa');
    });
  });

  describe('khi email chưa xác thực', () => {
    it('gọi next với AppError 401', async () => {
      getRedisClient.mockResolvedValue(null);
      User.findByPk.mockResolvedValue(makeUser({ isEmailVerified: false }));
      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi token hợp lệ và user ok', () => {
    it('gán req.user và gọi next() không có lỗi', async () => {
      getRedisClient.mockResolvedValue(null);
      const user = makeUser({ id: 7 });
      User.findByPk.mockResolvedValue(user);
      const token = makeToken({ id: 7 });
      const req = makeReq(token);
      const next = jest.fn();

      await optionalAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi token stale (pw_changed) — với iat cũ được sign trực tiếp', () => {
    it('trả về next() không lỗi (tiếp tục như guest) — covers line 96-98', async () => {
      getRedisClient.mockResolvedValue(mockRedis);

      // Tạo token với iat thực sự cũ bằng cách sign trực tiếp (không dùng expiresIn)
      const oldIat = Math.floor(Date.now() / 1000) - 3600; // 1 giờ trước
      const pwChangedAt = Math.floor(Date.now() / 1000) - 1800; // 30 phút trước (sau iat)

      // Sign với iat cũ + exp trong tương lai để token vẫn valid
      const staleToken = jwt.sign(
        { id: 1, role: 'customer', jti: 'stale-jti', iat: oldIat, exp: oldIat + 7200 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' }
      );

      mockRedis.get.mockImplementation((key) => {
        if (key === 'pw_changed:1') return Promise.resolve(String(pwChangedAt));
        return Promise.resolve(null);
      });

      const next = jest.fn();
      await optionalAuthenticate(makeReq(staleToken), makeRes(), next);

      // optionalAuthenticate trả về next() không có lỗi khi pw_changed
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi có lỗi không phải JWT', () => {
    it('gọi next(error) để propagate lỗi', async () => {
      const dbError = new Error('unexpected db fail');
      User.findByPk.mockRejectedValue(dbError);
      getRedisClient.mockResolvedValue(null);

      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('khi token không có jti — bỏ qua blacklist check (branch if(decoded.jti) false, line 92)', () => {
    it('tiếp tục như user đã đăng nhập khi token hợp lệ nhưng không có jti', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      mockRedis.get.mockResolvedValue(null);

      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      // Token không có jti → decoded.jti = undefined → if(decoded.jti) false → bỏ qua blacklist
      const tokenWithoutJti = jwt.sign(
        { id: 1, role: 'customer' },
        process.env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' }
      );
      const req = makeReq(tokenWithoutJti);
      const next = jest.fn();

      await optionalAuthenticate(req, makeRes(), next);

      // Không gọi redis.get cho blacklist
      const blCalls = mockRedis.get.mock.calls.filter((c) => c[0].startsWith('bl:'));
      expect(blCalls).toHaveLength(0);
      // User được gán → authenticated
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi pw_changed = null trong redis — bỏ qua stale check (branch line 97 false)', () => {
    it('gán req.user và gọi next() bình thường khi pw_changed key không tồn tại', async () => {
      getRedisClient.mockResolvedValue(mockRedis);
      // Cả bl: và pw_changed: đều null → pw_changed falsy → if(pwChanged && ...) false
      mockRedis.get.mockResolvedValue(null);

      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      const token = makeToken({ jti: 'opt-jti' });
      const req = makeReq(token);
      const next = jest.fn();

      await optionalAuthenticate(req, makeRes(), next);

      // pwChanged = null → không reject → user được gán
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });
});
