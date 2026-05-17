/**
 * Unit tests cho AuthController — kiểm tra từng handler riêng lẻ.
 *
 * Strategy: inject mock authService để kiểm tra controller logic thuần túy
 * mà không cần khởi động module hay kết nối DB.
 *
 * Các handler được test:
 *   register, login, googleLogin, logout, verifyOtp, resendVerification,
 *   refreshToken, forgotPassword, resetPassword, getCurrentUser
 *
 * Behaviors được verify:
 *   - Happy path: service resolve → đúng status code + body
 *   - Error path: service reject → next(err) được gọi với error đúng
 *   - Cookie: _setRefreshCookie set httpOnly cookie; _clearRefreshCookie clear cookie
 *   - logout: extract token từ Authorization header và từ cookies
 *   - refreshToken: ưu tiên cookie refreshToken, fallback sang body
 */

process.env.NODE_ENV = 'test';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';

const AuthController = require('../modules/auth/controllers/authController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tạo mock authService với tất cả các method */
function makeMockAuthService(overrides = {}) {
  return {
    register: jest.fn(),
    login: jest.fn(),
    googleLogin: jest.fn(),
    logout: jest.fn(),
    verifyOtp: jest.fn(),
    resendVerification: jest.fn(),
    refreshToken: jest.fn(),
    forgotPassword: jest.fn(),
    resetPassword: jest.fn(),
    getCurrentUser: jest.fn(),
    ...overrides,
  };
}

/** Tạo mock Express req */
function makeReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    ip: '127.0.0.1',
    user: null,
    get: jest.fn((header) => overrides.headers?.[header.toLowerCase()] || null),
    ...overrides,
  };
}

/** Tạo mock Express res với method tracking */
function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _cookies: {},
    _clearedCookies: {},
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  res.status.mockImplementation((code) => { res._status = code; return res; });
  res.json.mockImplementation((body) => { res._body = body; return res; });
  res.cookie.mockImplementation((name, val, opts) => { res._cookies[name] = { val, opts }; return res; });
  res.clearCookie.mockImplementation((name, opts) => { res._clearedCookies[name] = opts; return res; });
  return res;
}

/** Tạo mock next */
function makeNext() {
  return jest.fn();
}

/** Tạo fake user object */
function makeFakeUser(overrides = {}) {
  return {
    id: 1,
    email: 'user@test.com',
    firstName: 'Test',
    lastName: 'User',
    role: 'customer',
    toJSON: jest.fn().mockReturnValue({ id: 1, email: 'user@test.com', role: 'customer', ...overrides }),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// register
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.register', () => {
  it('trả về 201 với message khi register thành công', async () => {
    const authService = makeMockAuthService({
      register: jest.fn().mockResolvedValue({ message: 'Đăng ký thành công' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'new@test.com', password: 'Abc123!', firstName: 'Test', lastName: 'User', phone: '0901234567' } });
    const res = makeRes();
    const next = makeNext();

    await controller.register(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Đăng ký thành công' });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi authService.register throw error', async () => {
    const registrationError = new Error('Email already exists');
    const authService = makeMockAuthService({
      register: jest.fn().mockRejectedValue(registrationError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'existing@test.com', password: 'Abc123!' } });
    const res = makeRes();
    const next = makeNext();

    await controller.register(req, res, next);

    expect(next).toHaveBeenCalledWith(registrationError);
    expect(res.json).not.toHaveBeenCalled();
  });

  it('truyền đúng các fields từ body sang authService.register', async () => {
    const authService = makeMockAuthService({
      register: jest.fn().mockResolvedValue({ message: 'OK' }),
    });
    const controller = new AuthController({ authService });
    const reqBody = { email: 'a@b.com', password: 'pass', firstName: 'A', lastName: 'B', phone: '090' };
    const req = makeReq({ body: reqBody });
    const res = makeRes();

    await controller.register(req, res, makeNext());

    expect(authService.register).toHaveBeenCalledWith(reqBody);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// login
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.login', () => {
  it('trả về 200, set refreshToken cookie, và trả về token + user', async () => {
    const fakeUser = makeFakeUser();
    const authService = makeMockAuthService({
      login: jest.fn().mockResolvedValue({
        token: 'access-token-abc',
        refreshToken: 'refresh-token-xyz',
        user: fakeUser,
      }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'user@test.com', password: 'correct' }, ip: '10.0.0.1' });
    const res = makeRes();
    const next = makeNext();

    await controller.login(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', token: 'access-token-abc' })
    );
    // Refresh token nên được set vào cookie
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh-token-xyz', expect.objectContaining({ httpOnly: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it('truyền email, password, ip từ req sang authService.login', async () => {
    const authService = makeMockAuthService({
      login: jest.fn().mockResolvedValue({
        token: 'token',
        refreshToken: 'rtoken',
        user: makeFakeUser(),
      }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'a@b.com', password: 'pw' }, ip: '192.168.1.1' });
    const res = makeRes();

    await controller.login(req, res, makeNext());

    expect(authService.login).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      ip: '192.168.1.1',
    });
  });

  it('gọi next(err) khi login thất bại', async () => {
    const loginError = new Error('Invalid credentials');
    loginError.statusCode = 401;
    const authService = makeMockAuthService({
      login: jest.fn().mockRejectedValue(loginError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'user@test.com', password: 'wrong' } });
    const res = makeRes();
    const next = makeNext();

    await controller.login(req, res, next);

    expect(next).toHaveBeenCalledWith(loginError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// googleLogin
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.googleLogin', () => {
  it('trả về 200, set cookie, token, và user khi googleLogin thành công', async () => {
    const fakeUser = makeFakeUser();
    const authService = makeMockAuthService({
      googleLogin: jest.fn().mockResolvedValue({
        token: 'google-access-token',
        refreshToken: 'google-refresh-token',
        user: fakeUser,
      }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { token: 'google-id-token-from-client' } });
    const res = makeRes();
    const next = makeNext();

    await controller.googleLogin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', token: 'google-access-token' })
    );
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'google-refresh-token', expect.anything());
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi googleLogin thất bại', async () => {
    const googleError = new Error('Invalid Google token');
    const authService = makeMockAuthService({
      googleLogin: jest.fn().mockRejectedValue(googleError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { token: 'bad-token' } });
    const res = makeRes();
    const next = makeNext();

    await controller.googleLogin(req, res, next);

    expect(next).toHaveBeenCalledWith(googleError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// logout
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.logout', () => {
  it('trả về 204, clear cookie, khi logout thành công', async () => {
    const authService = makeMockAuthService({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({
      headers: { authorization: 'Bearer my-access-token' },
      cookies: { refreshToken: 'my-refresh-token' },
    });
    // Inject authorization header vào req.headers
    req.headers.authorization = 'Bearer my-access-token';
    const res = makeRes();
    const next = makeNext();

    await controller.logout(req, res, next);

    expect(authService.logout).toHaveBeenCalledWith({
      accessToken: 'my-access-token',
      refreshToken: 'my-refresh-token',
    });
    expect(res.clearCookie).toHaveBeenCalledWith('refreshToken', expect.anything());
    expect(res.status).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });

  it('accessToken là null khi không có Authorization header', async () => {
    const authService = makeMockAuthService({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ headers: {}, cookies: { refreshToken: 'rtoken' } });
    req.headers.authorization = undefined;
    const res = makeRes();

    await controller.logout(req, res, makeNext());

    expect(authService.logout).toHaveBeenCalledWith({
      accessToken: null,
      refreshToken: 'rtoken',
    });
  });

  it('accessToken là null khi header không bắt đầu bằng "Bearer "', async () => {
    const authService = makeMockAuthService({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ headers: {}, cookies: {} });
    req.headers.authorization = 'Basic some-basic-token';
    const res = makeRes();

    await controller.logout(req, res, makeNext());

    expect(authService.logout).toHaveBeenCalledWith({
      accessToken: null,
      refreshToken: null,
    });
  });

  it('refreshToken là null khi không có cookie', async () => {
    const authService = makeMockAuthService({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ headers: {}, cookies: {} });
    req.headers.authorization = 'Bearer token-abc';
    const res = makeRes();

    await controller.logout(req, res, makeNext());

    expect(authService.logout).toHaveBeenCalledWith({
      accessToken: 'token-abc',
      refreshToken: null,
    });
  });

  it('gọi next(err) khi logout throw error', async () => {
    const logoutError = new Error('Token blacklist error');
    const authService = makeMockAuthService({
      logout: jest.fn().mockRejectedValue(logoutError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ headers: {}, cookies: {} });
    const res = makeRes();
    const next = makeNext();

    await controller.logout(req, res, next);

    expect(next).toHaveBeenCalledWith(logoutError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyOtp
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.verifyOtp', () => {
  it('trả về 200 với message khi OTP hợp lệ', async () => {
    const authService = makeMockAuthService({
      verifyOtp: jest.fn().mockResolvedValue({ message: 'Xác thực email thành công' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'user@test.com', otp: '123456' } });
    const res = makeRes();
    const next = makeNext();

    await controller.verifyOtp(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Xác thực email thành công' });
    expect(next).not.toHaveBeenCalled();
  });

  it('truyền toàn bộ req.body sang authService.verifyOtp', async () => {
    const authService = makeMockAuthService({
      verifyOtp: jest.fn().mockResolvedValue({ message: 'OK' }),
    });
    const controller = new AuthController({ authService });
    const reqBody = { email: 'x@y.com', otp: '999888' };
    const req = makeReq({ body: reqBody });
    const res = makeRes();

    await controller.verifyOtp(req, res, makeNext());

    expect(authService.verifyOtp).toHaveBeenCalledWith(reqBody);
  });

  it('gọi next(err) khi OTP không hợp lệ', async () => {
    const otpError = new Error('OTP sai hoặc hết hạn');
    otpError.statusCode = 400;
    const authService = makeMockAuthService({
      verifyOtp: jest.fn().mockRejectedValue(otpError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'user@test.com', otp: '000000' } });
    const res = makeRes();
    const next = makeNext();

    await controller.verifyOtp(req, res, next);

    expect(next).toHaveBeenCalledWith(otpError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resendVerification
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.resendVerification', () => {
  it('trả về 200 với message khi gửi lại OTP thành công', async () => {
    const authService = makeMockAuthService({
      resendVerification: jest.fn().mockResolvedValue({ message: 'OTP đã được gửi lại' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'user@test.com' } });
    const res = makeRes();
    const next = makeNext();

    await controller.resendVerification(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'OTP đã được gửi lại' });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi resendVerification thất bại', async () => {
    const resendError = new Error('User not found');
    resendError.statusCode = 404;
    const authService = makeMockAuthService({
      resendVerification: jest.fn().mockRejectedValue(resendError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'notexist@test.com' } });
    const res = makeRes();
    const next = makeNext();

    await controller.resendVerification(req, res, next);

    expect(next).toHaveBeenCalledWith(resendError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refreshToken
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.refreshToken', () => {
  it('trả về 200 với token mới và set lại refreshToken cookie', async () => {
    const authService = makeMockAuthService({
      refreshToken: jest.fn().mockResolvedValue({
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ cookies: { refreshToken: 'old-refresh-from-cookie' } });
    const res = makeRes();
    const next = makeNext();

    await controller.refreshToken(req, res, next);

    expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: 'old-refresh-from-cookie' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', token: 'new-access-token' });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'new-refresh-token', expect.anything());
    expect(next).not.toHaveBeenCalled();
  });

  it('ưu tiên cookie refreshToken hơn body khi cả hai đều có', async () => {
    const authService = makeMockAuthService({
      refreshToken: jest.fn().mockResolvedValue({ token: 't', refreshToken: 'rt' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({
      cookies: { refreshToken: 'from-cookie' },
      body: { refreshToken: 'from-body' },
    });
    const res = makeRes();

    await controller.refreshToken(req, res, makeNext());

    // Cookie ưu tiên hơn body
    expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: 'from-cookie' });
  });

  it('fallback sang body khi không có cookie', async () => {
    const authService = makeMockAuthService({
      refreshToken: jest.fn().mockResolvedValue({ token: 't', refreshToken: 'rt' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({
      cookies: {},
      body: { refreshToken: 'from-body-only' },
    });
    const res = makeRes();

    await controller.refreshToken(req, res, makeNext());

    expect(authService.refreshToken).toHaveBeenCalledWith({ refreshToken: 'from-body-only' });
  });

  it('gọi next(err) khi refreshToken không hợp lệ', async () => {
    const tokenError = new Error('Token không hợp lệ hoặc đã hết hạn');
    tokenError.statusCode = 401;
    const authService = makeMockAuthService({
      refreshToken: jest.fn().mockRejectedValue(tokenError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ cookies: {}, body: {} });
    const res = makeRes();
    const next = makeNext();

    await controller.refreshToken(req, res, next);

    expect(next).toHaveBeenCalledWith(tokenError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// forgotPassword
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.forgotPassword', () => {
  it('trả về 200 với message khi gửi email reset password thành công', async () => {
    const authService = makeMockAuthService({
      forgotPassword: jest.fn().mockResolvedValue({ message: 'Email đặt lại mật khẩu đã được gửi' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'user@test.com' } });
    const res = makeRes();
    const next = makeNext();

    await controller.forgotPassword(req, res, next);

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'user@test.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Email đặt lại mật khẩu đã được gửi' });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi forgotPassword thất bại', async () => {
    const forgotError = new Error('Không tìm thấy email');
    forgotError.statusCode = 404;
    const authService = makeMockAuthService({
      forgotPassword: jest.fn().mockRejectedValue(forgotError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'notexist@test.com' } });
    const res = makeRes();
    const next = makeNext();

    await controller.forgotPassword(req, res, next);

    expect(next).toHaveBeenCalledWith(forgotError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// resetPassword
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.resetPassword', () => {
  it('trả về 200 với message khi đặt lại mật khẩu thành công', async () => {
    const authService = makeMockAuthService({
      resetPassword: jest.fn().mockResolvedValue({ message: 'Đặt lại mật khẩu thành công' }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { token: 'reset-token-abc', password: 'NewSecure123!' } });
    const res = makeRes();
    const next = makeNext();

    await controller.resetPassword(req, res, next);

    expect(authService.resetPassword).toHaveBeenCalledWith({ token: 'reset-token-abc', password: 'NewSecure123!' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Đặt lại mật khẩu thành công' });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi token reset không hợp lệ', async () => {
    const resetError = new Error('Token không hợp lệ hoặc đã hết hạn');
    resetError.statusCode = 400;
    const authService = makeMockAuthService({
      resetPassword: jest.fn().mockRejectedValue(resetError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { token: 'expired-token', password: 'NewPass123!' } });
    const res = makeRes();
    const next = makeNext();

    await controller.resetPassword(req, res, next);

    expect(next).toHaveBeenCalledWith(resetError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getCurrentUser
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController.getCurrentUser', () => {
  it('trả về 200 với thông tin user hiện tại', async () => {
    const fakeUser = makeFakeUser({ id: 42, email: 'me@test.com', role: 'admin' });
    const authService = makeMockAuthService({
      getCurrentUser: jest.fn().mockResolvedValue({ user: fakeUser }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ user: { id: 42 } });
    const res = makeRes();
    const next = makeNext();

    await controller.getCurrentUser(req, res, next);

    expect(authService.getCurrentUser).toHaveBeenCalledWith({ userId: 42 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 'success',
      data: expect.objectContaining({ id: 42 }),
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('gọi next(err) khi user không tồn tại', async () => {
    const userError = new Error('Không tìm thấy người dùng');
    userError.statusCode = 404;
    const authService = makeMockAuthService({
      getCurrentUser: jest.fn().mockRejectedValue(userError),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ user: { id: 999 } });
    const res = makeRes();
    const next = makeNext();

    await controller.getCurrentUser(req, res, next);

    expect(next).toHaveBeenCalledWith(userError);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _setRefreshCookie — cookie attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController._setRefreshCookie', () => {
  it('set cookie với httpOnly=true và sameSite=strict', async () => {
    const authService = makeMockAuthService({
      login: jest.fn().mockResolvedValue({
        token: 'at',
        refreshToken: 'rt-value',
        user: makeFakeUser(),
      }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'a@b.com', password: 'p' } });
    const res = makeRes();

    await controller.login(req, res, makeNext());

    const cookieCall = res.cookie.mock.calls[0];
    const cookieName = cookieCall[0];
    const cookieValue = cookieCall[1];
    const cookieOpts = cookieCall[2];

    expect(cookieName).toBe('refreshToken');
    expect(cookieValue).toBe('rt-value');
    expect(cookieOpts.httpOnly).toBe(true);
    expect(cookieOpts.sameSite).toBe('strict');
    expect(cookieOpts.path).toBe('/api/auth');
    expect(cookieOpts.maxAge).toBeGreaterThan(0);
  });

  it('cookie secure=false trong môi trường test (NODE_ENV=test)', async () => {
    const authService = makeMockAuthService({
      login: jest.fn().mockResolvedValue({
        token: 'at',
        refreshToken: 'rt-value',
        user: makeFakeUser(),
      }),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ body: { email: 'a@b.com', password: 'p' } });
    const res = makeRes();

    await controller.login(req, res, makeNext());

    const cookieOpts = res.cookie.mock.calls[0][2];
    // NODE_ENV = 'test' → secure = false
    expect(cookieOpts.secure).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// _clearRefreshCookie — xóa cookie khi logout
// ─────────────────────────────────────────────────────────────────────────────

describe('AuthController._clearRefreshCookie', () => {
  it('gọi clearCookie với options đúng khi logout', async () => {
    const authService = makeMockAuthService({
      logout: jest.fn().mockResolvedValue(undefined),
    });
    const controller = new AuthController({ authService });
    const req = makeReq({ headers: {}, cookies: {} });
    req.headers.authorization = undefined;
    const res = makeRes();

    await controller.logout(req, res, makeNext());

    expect(res.clearCookie).toHaveBeenCalledWith(
      'refreshToken',
      expect.objectContaining({ httpOnly: true, path: '/api/auth' })
    );
  });
});
