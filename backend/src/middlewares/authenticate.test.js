/**
 * Tests cho authenticate và optionalAuthenticate middleware
 *
 * Paths covered:
 * authenticate:
 *   - Không có Authorization header → 401
 *   - Header không bắt đầu bằng 'Bearer ' → 401
 *   - Token không hợp lệ (JsonWebTokenError) → 401
 *   - Token hết hạn (TokenExpiredError) → 401
 *   - User không tồn tại → 401
 *   - User bị khóa (isActive=false) → 401
 *   - Email chưa xác thực → 401
 *   - Lỗi không phải JWT → next(error) được gọi
 *   - Token hợp lệ và user ok → gán req.user + next()
 *
 * optionalAuthenticate:
 *   - Không có header → next() không có lỗi
 *   - Token không hợp lệ → next() không có lỗi (tiếp tục như guest)
 *   - User không tồn tại → next() không có lỗi
 *   - User bị khóa → 401
 *   - Email chưa xác thực → 401
 *   - Token hợp lệ, user ok → req.user được gán
 *   - Lỗi không phải JWT → propagate lỗi
 */

'use strict';

process.env.JWT_SECRET = 'test-auth-middleware-secret';
process.env.NODE_ENV = 'test';

const jwt = require('jsonwebtoken');

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@models', () => ({
  User: {
    findByPk: jest.fn(),
  },
}));

// Helpers
const { User } = require('@models');
const { authenticate, optionalAuthenticate } = require('./authenticate');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(payload = {}, expiresIn = '1h') {
  return jwt.sign(
    { id: 1, role: 'customer', jti: 'test-jti', iat: Math.floor(Date.now() / 1000), ...payload },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn },
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

  describe('khi token có jti không hợp lệ', () => {
    it('gọi next() không có lỗi — blacklist không còn được kiểm tra trong middleware', async () => {
      User.findByPk.mockResolvedValue(makeUser());
      const token = makeToken({ jti: 'test-jti' });
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      // Token hợp lệ → pass (authenticate không check blacklist nữa)
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi token cấp trước khi user đổi mật khẩu', () => {
    it('gọi next() không có lỗi — pw_changed không còn được kiểm tra trong middleware', async () => {
      // pw_changed check đã bị bỏ khỏi authenticate.js.
      User.findByPk.mockResolvedValue(makeUser());
      const oldIat = Math.floor(Date.now() / 1000) - 3600;
      const token = jwt.sign(
        { id: 1, role: 'customer', jti: 'tok-1', iat: oldIat, exp: oldIat + 7200 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' },
      );
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(); // pass vì không có pw_changed check
    });
  });

  describe('khi user không tồn tại trong DB', () => {
    it('gọi next với AppError 401', async () => {
      User.findByPk.mockResolvedValue(null);
      const token = makeToken();
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi tài khoản bị khóa (isActive=false)', () => {
    it('gọi next với AppError 401', async () => {
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

      const token = makeToken();
      const next = jest.fn();

      await authenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('khi token không có jti — bỏ qua blacklist check (branch if(decoded.jti) false, line 23)', () => {
    it('tiếp tục xác thực bình thường khi jti không tồn tại trong token', async () => {
      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      // Ký token không có jti
      const tokenWithoutJti = jwt.sign({ id: 1, role: 'customer' }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      const req = makeReq(tokenWithoutJti);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

      // Vẫn pass → next() không có lỗi
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi pw_changed = null — bỏ qua stale-token check (line 31 false)', () => {
    it('tiếp tục bình thường với token hợp lệ', async () => {
      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      const token = makeToken({ jti: 'valid-jti' });
      const req = makeReq(token);
      const next = jest.fn();

      await authenticate(req, makeRes(), next);

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
    it('gọi next() với user gán bình thường — blacklist không còn được kiểm tra', async () => {
      // authenticate.js không còn check blacklist
      User.findByPk.mockResolvedValue(makeUser());
      const token = makeToken({ jti: 'test-jti' });
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi token là stale (cấp trước khi đổi mật khẩu)', () => {
    it('gọi next() không có lỗi — pw_changed không còn được kiểm tra', async () => {
      // authenticate.js không còn check pw_changed
      User.findByPk.mockResolvedValue(makeUser());
      const oldIat = Math.floor(Date.now() / 1000) - 3600;

      const token = makeToken({ iat: oldIat });
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi user không tồn tại', () => {
    it('gọi next() không có lỗi (tiếp tục như guest)', async () => {
      User.findByPk.mockResolvedValue(null);
      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi tài khoản bị khóa', () => {
    it('gọi next với AppError 401 (không silently tiếp tục)', async () => {
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
      User.findByPk.mockResolvedValue(makeUser({ isEmailVerified: false }));
      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('khi token hợp lệ và user ok', () => {
    it('gán req.user và gọi next() không có lỗi', async () => {
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
    it('trả về next() không lỗi — pw_changed không còn được kiểm tra — covers line 96-98', async () => {
      // authenticate.js không còn kiểm tra pw_changed
      User.findByPk.mockResolvedValue(makeUser());

      const oldIat = Math.floor(Date.now() / 1000) - 3600;
      const staleToken = jwt.sign(
        { id: 1, role: 'customer', jti: 'stale-jti', iat: oldIat, exp: oldIat + 7200 },
        process.env.JWT_SECRET,
        { algorithm: 'HS256' },
      );

      const next = jest.fn();
      await optionalAuthenticate(makeReq(staleToken), makeRes(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('khi có lỗi không phải JWT', () => {
    it('gọi next(error) để propagate lỗi', async () => {
      const dbError = new Error('unexpected db fail');
      User.findByPk.mockRejectedValue(dbError);

      const token = makeToken();
      const next = jest.fn();

      await optionalAuthenticate(makeReq(token), makeRes(), next);

      expect(next).toHaveBeenCalledWith(dbError);
    });
  });

  describe('khi token không có jti — bỏ qua blacklist check (branch if(decoded.jti) false, line 92)', () => {
    it('tiếp tục như user đã đăng nhập khi token hợp lệ nhưng không có jti', async () => {
      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      const tokenWithoutJti = jwt.sign({ id: 1, role: 'customer' }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '1h',
      });
      const req = makeReq(tokenWithoutJti);
      const next = jest.fn();

      await optionalAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });

  describe('khi pw_changed = null — bỏ qua stale check (branch line 97 false)', () => {
    it('gán req.user và gọi next() bình thường', async () => {
      const user = makeUser();
      User.findByPk.mockResolvedValue(user);

      const token = makeToken({ jti: 'opt-jti' });
      const req = makeReq(token);
      const next = jest.fn();

      await optionalAuthenticate(req, makeRes(), next);

      expect(next).toHaveBeenCalledWith();
      expect(req.user).toBe(user);
    });
  });
});
