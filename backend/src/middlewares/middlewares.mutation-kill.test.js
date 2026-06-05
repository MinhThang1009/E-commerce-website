/**
 * middlewares.mutation-kill.test.js
 *
 * Kill mutant: authorize (role), authenticate + admin-auth (JWT + checks), validate-request (zod),
 * detect-locale (query/header), error-handler (normalizeError handlers + sendErrorDev/Prod).
 */

jest.mock('jsonwebtoken');
const mockFindByPk = jest.fn();
jest.mock('@models', () => ({ User: { findByPk: (...a) => mockFindByPk(...a) } }));
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { authorize } = require('@middlewares/authorize');
const { authenticate } = require('@middlewares/authenticate');
const {
  adminAuthenticate,
  requireRole,
  requireSuperAdmin,
  BACKOFFICE_ROLES,
} = require('@middlewares/admin-auth');
const { validateRequest } = require('@middlewares/validate-request');
const detectLocale = require('@middlewares/detect-locale');
const { errorHandler } = require('@middlewares/error-handler');

const mkNext = () => jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = 'secret';
});

// ══════════════════════════════════════════════════════════════════════════════
// authorize
// ══════════════════════════════════════════════════════════════════════════════

describe('authorize', () => {
  it('không user → 401', () => {
    const next = mkNext();
    authorize('admin')({}, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
  it('role không nằm trong allowed → 403', () => {
    const next = mkNext();
    authorize('admin')({ user: { role: 'customer' } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });
  it('role hợp lệ → next() không lỗi', () => {
    const next = mkNext();
    authorize('admin', 'staff')({ user: { role: 'staff' } }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// authenticate
// ══════════════════════════════════════════════════════════════════════════════

describe('authenticate', () => {
  const validUser = { id: 1, isActive: true, isEmailVerified: true };

  it('không có Bearer header → 401', async () => {
    const next = mkNext();
    await authenticate({ headers: {} }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('token hợp lệ + user active+verified → set req.user + next()', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    mockFindByPk.mockResolvedValue(validUser);
    const req = { headers: { authorization: 'Bearer tok' } };
    const next = mkNext();
    await authenticate(req, {}, next);
    expect(jwt.verify).toHaveBeenCalledWith('tok', 'secret', { algorithms: ['HS256'] });
    expect(req.user).toBe(validUser);
    expect(next).toHaveBeenCalledWith();
  });

  it('user không tồn tại → 401', async () => {
    jwt.verify.mockReturnValue({ id: 9 });
    mockFindByPk.mockResolvedValue(null);
    const next = mkNext();
    await authenticate({ headers: { authorization: 'Bearer t' } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('user bị khóa (isActive false) → 401 (message chứa "khóa")', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: false, isEmailVerified: true });
    const next = mkNext();
    await authenticate({ headers: { authorization: 'Bearer t' } }, {}, next);
    expect(next.mock.calls[0][0].message).toContain('khóa');
  });

  it('email chưa verify → 401', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, isActive: true, isEmailVerified: false });
    const next = mkNext();
    await authenticate({ headers: { authorization: 'Bearer t' } }, {}, next);
    expect(next.mock.calls[0][0].message).toContain('xác thực email');
  });

  it('JWT lỗi → 401 (phiên hết hạn)', async () => {
    const err = new Error('jwt');
    err.name = 'TokenExpiredError';
    jwt.verify.mockImplementation(() => {
      throw err;
    });
    const next = mkNext();
    await authenticate({ headers: { authorization: 'Bearer t' } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// admin-auth
// ══════════════════════════════════════════════════════════════════════════════

describe('admin-auth', () => {
  it('BACKOFFICE_ROLES = [admin, staff]', () => {
    expect(BACKOFFICE_ROLES).toEqual(['admin', 'staff']);
  });

  it('adminAuthenticate: role customer → 403', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, role: 'customer', isEmailVerified: true });
    const next = mkNext();
    await adminAuthenticate({ headers: { authorization: 'Bearer t' } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(403);
  });

  it('adminAuthenticate: staff hợp lệ → set req.user + next()', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    const user = { id: 1, role: 'staff', isEmailVerified: true };
    mockFindByPk.mockResolvedValue(user);
    const req = { headers: { authorization: 'Bearer t' } };
    const next = mkNext();
    await adminAuthenticate(req, {}, next);
    expect(req.user).toBe(user);
    expect(next).toHaveBeenCalledWith();
  });

  it('adminAuthenticate: admin chưa verify email → 401', async () => {
    jwt.verify.mockReturnValue({ id: 1 });
    mockFindByPk.mockResolvedValue({ id: 1, role: 'admin', isEmailVerified: false });
    const next = mkNext();
    await adminAuthenticate({ headers: { authorization: 'Bearer t' } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  it('requireRole: role không khớp → 403; khớp → next()', () => {
    const n1 = mkNext();
    requireRole('staff')({ user: { role: 'admin' } }, {}, n1);
    expect(n1.mock.calls[0][0].statusCode).toBe(403);
    const n2 = mkNext();
    requireRole('admin', 'staff')({ user: { role: 'admin' } }, {}, n2);
    expect(n2).toHaveBeenCalledWith();
  });

  it('requireSuperAdmin: chỉ admin', () => {
    const n1 = mkNext();
    requireSuperAdmin({ user: { role: 'staff' } }, {}, n1);
    expect(n1.mock.calls[0][0].statusCode).toBe(403);
    const n2 = mkNext();
    requireSuperAdmin({ user: { role: 'admin' } }, {}, n2);
    expect(n2).toHaveBeenCalledWith();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// validate-request
// ══════════════════════════════════════════════════════════════════════════════

describe('validateRequest', () => {
  const schema = z.object({ name: z.string() });

  it('hợp lệ → req.body = parsed (strip unknown) + next()', () => {
    const req = { body: { name: 'A', extra: 'strip' } };
    const next = mkNext();
    validateRequest(schema)(req, {}, next);
    expect(req.body).toEqual({ name: 'A' }); // extra bị strip
    expect(next).toHaveBeenCalledWith();
  });

  it('không hợp lệ → next(AppError) với message ghép', () => {
    const next = mkNext();
    validateRequest(schema, 422)({ body: { name: 123 } }, {}, next);
    expect(next.mock.calls[0][0].statusCode).toBe(422);
  });

  it('source = query', () => {
    const req = { query: { name: 'Q' } };
    const next = mkNext();
    validateRequest(schema, 400, 'query')(req, {}, next);
    expect(req.query).toEqual({ name: 'Q' });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// detect-locale
// ══════════════════════════════════════════════════════════════════════════════

describe('detectLocale', () => {
  it('query ?lang=en → req.locale en', () => {
    const req = { query: { lang: 'en' }, headers: {} };
    const next = mkNext();
    detectLocale(req, {}, next);
    expect(req.locale).toBe('en');
    expect(next).toHaveBeenCalled();
  });

  it('query lang không hỗ trợ → bỏ qua, dùng header', () => {
    const req = { query: { lang: 'fr' }, headers: { 'accept-language': 'en-US,en;q=0.9' } };
    detectLocale(req, {}, mkNext());
    expect(req.locale).toBe('en');
  });

  it('không query → parse Accept-Language', () => {
    const req = { query: {}, headers: { 'accept-language': 'vi-VN,vi;q=0.9' } };
    detectLocale(req, {}, mkNext());
    expect(req.locale).toBe('vi');
  });

  it('không có gì → default vi', () => {
    const req = { query: {}, headers: {} };
    detectLocale(req, {}, mkNext());
    expect(req.locale).toBe('vi');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// error-handler
// ══════════════════════════════════════════════════════════════════════════════

describe('errorHandler', () => {
  const mkRes = () => {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
  };

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('production + operational AppError → status + message (không stack)', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('msg'), {
      statusCode: 404,
      status: 'fail',
      isOperational: true,
    });
    const res = mkRes();
    errorHandler(err, { locale: 'vi' }, res, mkNext());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'msg' });
  });

  it('production + non-operational → 500 generic', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('bug');
    const res = mkRes();
    errorHandler(err, { locale: 'vi' }, res, mkNext());
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('development → kèm stack + error', () => {
    process.env.NODE_ENV = 'development';
    const err = Object.assign(new Error('dev'), { statusCode: 400, status: 'fail' });
    const res = mkRes();
    errorHandler(err, { locale: 'vi' }, res, mkNext());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0]).toHaveProperty('stack');
  });

  it('JWT error → 401', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('jwt');
    err.name = 'JsonWebTokenError';
    const res = mkRes();
    errorHandler(err, {}, res, mkNext());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('SequelizeUniqueConstraintError → 409', () => {
    process.env.NODE_ENV = 'production';
    const err = new Error('dup');
    err.name = 'SequelizeUniqueConstraintError';
    err.errors = [{ path: 'email', value: 'x@y.com' }];
    const res = mkRes();
    errorHandler(err, {}, res, mkNext());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('statusCode mặc định 500 khi thiếu', () => {
    process.env.NODE_ENV = 'production';
    const err = Object.assign(new Error('x'), { isOperational: true, status: 'error' });
    const res = mkRes();
    errorHandler(err, {}, res, mkNext());
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
