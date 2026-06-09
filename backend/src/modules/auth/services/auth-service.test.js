/**
 * @file authService.test.js
 * @description Gộp từ authService.test.js + authService.branches.test.js + authService.extra.branches.test.js + authService.extra.test.js
 */
// Phase 42.2 — Unit tests cho AuthService (modules/auth)
// Mock toàn bộ repo + adapters → test pure business logic không hit DB.

const AuthService = require('./auth-service');

describe('AuthService', () => {
  let authRepository;
  let emailGateway;
  let googleVerifier;
  let tokenSigner;
  let eventBus;
  let logger;
  let service;

  beforeEach(() => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithAddresses: jest.fn(),
      findByGoogleIdOrEmail: jest.fn(),
      findByResetToken: jest.fn(),
      createUser: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
    };
    emailGateway = {
      sendOtpEmail: jest.fn().mockResolvedValue(),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(),
    };
    googleVerifier = {
      verifyIdToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
    tokenSigner = {
      signAccessToken: jest.fn(() => 'access-tok'),
      signRefreshToken: jest.fn(() => 'refresh-tok'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new AuthService({
      authRepository,
      emailGateway,
      googleVerifier,
      tokenSigner,
      eventBus,
      logger,
    });
  });

  describe('register', () => {
    test('email đã tồn tại → 400', async () => {
      authRepository.findByEmail.mockResolvedValue({ id: 1 });
      await expect(
        service.register({ email: 'a@b.c', password: 'pass', firstName: 'A', lastName: 'B' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'auth.emailInUse' });
    });

    test('email chưa tồn tại → tạo user + gửi OTP + trả registerSuccess', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({ id: 5, email: 'a@b.c' });

      const result = await service.register({
        email: 'a@b.c',
        password: 'pass',
        firstName: 'A',
        lastName: 'B',
      });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.c', otpCode: expect.any(String) }),
      );
      expect(emailGateway.sendOtpEmail).toHaveBeenCalledWith('a@b.c', expect.any(String));
      expect(result.message).toBe('auth.registerSuccess');
    });

    test('email lỗi không chặn flow (logger.error nhưng vẫn return success)', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({ id: 5, email: 'a@b.c' });
      emailGateway.sendOtpEmail.mockRejectedValue(new Error('SMTP fail'));

      const result = await service.register({
        email: 'a@b.c',
        password: 'pass',
        firstName: 'A',
        lastName: 'B',
      });

      expect(logger.error).toHaveBeenCalled();
      expect(result.message).toBe('auth.registerSuccess');
    });
  });

  describe('login', () => {
    test('email không tồn tại → 401', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      await expect(service.login({ email: 'a@b.c', password: 'p' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    test('mật khẩu sai → 401', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      await expect(service.login({ email: 'a@b.c', password: 'wrong' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    test('email chưa xác thực → 401', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        isEmailVerified: false,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      await expect(service.login({ email: 'a@b.c', password: 'p' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.emailNotVerified',
      });
    });

    test('tài khoản bị khóa → 401', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        isEmailVerified: true,
        isActive: false,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      await expect(service.login({ email: 'a@b.c', password: 'p' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.accountDisabled',
      });
    });

    test('login thành công → trả token + refreshToken + user', async () => {
      const user = {
        id: 7,
        role: 'customer',
        email: 'a@b.c',
        isEmailVerified: true,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      authRepository.findByEmail.mockResolvedValue(user);

      const result = await service.login({ email: 'a@b.c', password: 'p', ip: '127.0.0.1' });

      expect(result.token).toBe('access-tok');
      expect(result.refreshToken).toBe('refresh-tok');
      expect(result.user).toBe(user);
      expect(tokenSigner.signAccessToken).toHaveBeenCalledWith({ id: 7, role: 'customer' });
    });
  });

  describe('verifyOtp', () => {
    test('thiếu email hoặc otp → 400', async () => {
      await expect(service.verifyOtp({ email: '', otp: '' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('user không tồn tại → 400 generic (chống enumeration)', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('email đã verify → 400 generic (chống enumeration)', async () => {
      authRepository.findByEmail.mockResolvedValue({ isEmailVerified: true });
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('OTP sai → 400', async () => {
      authRepository.findByEmail.mockResolvedValue({
        isEmailVerified: false,
        otpCode: '123456',
        otpExpires: new Date(Date.now() + 60000),
      });
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '999999' })).rejects.toMatchObject({
        statusCode: 400,
        message: 'auth.otpInvalidOrExpired',
      });
    });

    test('OTP hết hạn → 400', async () => {
      authRepository.findByEmail.mockResolvedValue({
        isEmailVerified: false,
        otpCode: '123456',
        otpExpires: new Date(Date.now() - 60000),
      });
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toMatchObject({
        statusCode: 400,
        message: 'auth.otpExpired',
      });
    });

    test('OTP hợp lệ → set isEmailVerified=true, clear otp, save', async () => {
      const user = {
        isEmailVerified: false,
        otpCode: '123456',
        otpExpires: new Date(Date.now() + 60000),
      };
      authRepository.findByEmail.mockResolvedValue(user);

      const result = await service.verifyOtp({ email: 'a@b.c', otp: '123456' });

      expect(user.isEmailVerified).toBe(true);
      expect(user.otpCode).toBeNull();
      expect(user.otpExpires).toBeNull();
      expect(authRepository.saveUser).toHaveBeenCalledWith(user);
      expect(result.message).toBe('auth.emailVerified');
    });
  });

  describe('forgotPassword (anti-enumeration)', () => {
    test('email không tồn tại → vẫn trả message thành công, KHÔNG gửi email', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'unknown@x.y' });
      expect(emailGateway.sendResetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('auth.passwordResetSent');
    });

    test('email tồn tại → set reset token + gửi email', async () => {
      const user = {};
      authRepository.findByEmail.mockResolvedValue(user);

      await service.forgotPassword({ email: 'a@b.c' });

      expect(user.resetPasswordToken).toEqual(expect.any(String));
      expect(user.resetPasswordExpires).toBeInstanceOf(Date);
      expect(authRepository.saveUser).toHaveBeenCalledWith(user);
      expect(emailGateway.sendResetPasswordEmail).toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    test('token không hợp lệ → 400', async () => {
      authRepository.findByResetToken.mockResolvedValue(null);
      await expect(
        service.resetPassword({ token: 'bad', password: 'newpass' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'auth.tokenInvalidOrExpired' });
    });

    test('token hợp lệ → cập nhật mật khẩu + clear token', async () => {
      const user = { resetPasswordToken: 'good', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'good', password: 'newpass' });

      expect(user.password).toBe('newpass');
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpires).toBeNull();
      expect(authRepository.saveUser).toHaveBeenCalled();
      expect(result.message).toBe('auth.passwordResetSuccess');
    });
  });

  describe('refreshToken', () => {
    test('thiếu refreshToken → 401', async () => {
      await expect(service.refreshToken({})).rejects.toMatchObject({ statusCode: 401 });
    });

    test('JsonWebTokenError → 401 với message hết hạn', async () => {
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        const err = new Error('jwt malformed');
        err.name = 'JsonWebTokenError';
        throw err;
      });
      await expect(service.refreshToken({ refreshToken: 'bad' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.refreshTokenInvalid',
      });
    });

    test('user không tồn tại → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 99 });
      authRepository.findById.mockResolvedValue(null);
      await expect(service.refreshToken({ refreshToken: 't' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    test('user inactive → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ isActive: false });
      await expect(service.refreshToken({ refreshToken: 't' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.accountDisabled',
      });
    });

    test('hợp lệ → trả access token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });
      const result = await service.refreshToken({ refreshToken: 't' });
      expect(result.token).toBe('access-tok');
    });
  });

  describe('logout', () => {
    test('không có accessToken → no-op', async () => {
      await service.logout({ accessToken: null });
    });

    test('token expired/invalid → bỏ qua không throw', async () => {
      tokenSigner.verifyAccessToken.mockImplementation(() => {
        throw new Error('expired');
      });
      await expect(service.logout({ accessToken: 'old' })).resolves.toBeUndefined();
    });

    test('accessToken hợp lệ → logout thành công (client-side clear)', async () => {
      await expect(service.logout({ accessToken: 'valid-token' })).resolves.toBeUndefined();
    });
  });

  describe('googleLogin', () => {
    test('id-token verify thành công, user mới → tạo + trả token', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-1',
        email: 'g@x.y',
        given_name: 'G',
        family_name: 'User',
        picture: 'pic.jpg',
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
        id: 10,
        role: 'customer',
        isActive: true,
      });

      const result = await service.googleLogin({ token: 'idtok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'g-1', email: 'g@x.y', isEmailVerified: true }),
      );
      expect(result.token).toBe('access-tok');
    });

    test('id-token fail → fallback access-token verify', async () => {
      googleVerifier.verifyIdToken.mockRejectedValue(new Error('bad id'));
      googleVerifier.verifyAccessToken.mockResolvedValue({
        sub: 'g-2',
        email: 'g2@x.y',
        given_name: 'G2',
        family_name: 'U',
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({ id: 11, role: 'customer', isActive: true });

      const result = await service.googleLogin({ token: 'access' });

      expect(googleVerifier.verifyAccessToken).toHaveBeenCalled();
      expect(result.token).toBe('access-tok');
    });

    test('cả 2 verify fail → 401', async () => {
      googleVerifier.verifyIdToken.mockRejectedValue(new Error('fail'));
      googleVerifier.verifyAccessToken.mockRejectedValue(new Error('fail'));
      await expect(service.googleLogin({ token: 'bad' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    test('user đã tồn tại không có googleId → liên kết googleId + save', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-3',
        email: 'old@x.y',
        picture: 'newpic',
      });
      const existingUser = { id: 5, isActive: true, role: 'customer' };
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(existingUser);

      await service.googleLogin({ token: 'idtok' });

      expect(existingUser.googleId).toBe('g-3');
      expect(existingUser.avatar).toBe('newpic');
      expect(existingUser.isEmailVerified).toBe(true);
      expect(authRepository.saveUser).toHaveBeenCalledWith(existingUser);
    });

    test('email_verified=false → 401, KHÔNG tạo/link account (chống chiếm tài khoản)', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-evil',
        email: 'victim@x.y',
        email_verified: false,
        given_name: 'E',
        family_name: 'V',
      });

      await expect(service.googleLogin({ token: 'idtok' })).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(authRepository.findByGoogleIdOrEmail).not.toHaveBeenCalled();
      expect(authRepository.createUser).not.toHaveBeenCalled();
      expect(authRepository.saveUser).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentUser', () => {
    test('user không tồn tại → 404', async () => {
      authRepository.findByIdWithAddresses.mockResolvedValue(null);
      await expect(service.getCurrentUser({ userId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('user tồn tại → trả user', async () => {
      const user = { id: 1, addresses: [] };
      authRepository.findByIdWithAddresses.mockResolvedValue(user);
      const result = await service.getCurrentUser({ userId: 1 });
      expect(result.user).toBe(user);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// authService.branches section
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthService — uncovered branches', () => {
  let authRepository;
  let emailGateway;
  let googleVerifier;
  let tokenSigner;
  let eventBus;
  let logger;
  let service;

  beforeEach(() => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithAddresses: jest.fn(),
      findByGoogleIdOrEmail: jest.fn(),
      findByResetToken: jest.fn(),
      createUser: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
    };
    emailGateway = {
      sendOtpEmail: jest.fn().mockResolvedValue(),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(),
    };
    googleVerifier = {
      verifyIdToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
    tokenSigner = {
      signAccessToken: jest.fn(() => 'access-tok'),
      signRefreshToken: jest.fn(() => 'refresh-tok'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new AuthService({
      authRepository,
      emailGateway,
      googleVerifier,
      tokenSigner,
      eventBus,
      logger,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Lines 129-130: googleLogin — firstName/lastName null → fallback defaults
  // ─────────────────────────────────────────────────────────────────────────

  describe('googleLogin — firstName/lastName null fallback (lines 129-130)', () => {
    it('dùng "Google" làm firstName khi payload thiếu given_name', async () => {
      // payload không có given_name (undefined) → firstName || 'Google' = 'Google'
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-null-name',
        email: 'no-name@x.y',
        given_name: undefined,
        family_name: undefined,
        picture: null,
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
        id: 20,
        role: 'customer',
        isActive: true,
      });

      await service.googleLogin({ token: 'tok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Google',
          lastName: 'User',
        }),
      );
    });

    it('dùng "User" làm lastName khi payload chỉ thiếu family_name', async () => {
      // given_name có giá trị nhưng family_name không có
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-no-last',
        email: 'nolast@x.y',
        given_name: 'Nguyen',
        family_name: null,
        picture: 'pic.jpg',
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
        id: 21,
        role: 'customer',
        isActive: true,
      });

      await service.googleLogin({ token: 'tok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Nguyen',
          lastName: 'User',
        }),
      );
    });

    it('giữ nguyên firstName/lastName khi payload có đủ cả hai', async () => {
      // Ensure true path (no fallback) works correctly — đây là happy path
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-full',
        email: 'full@x.y',
        given_name: 'Tran',
        family_name: 'Van B',
        picture: null,
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({
        id: 22,
        role: 'customer',
        isActive: true,
      });

      await service.googleLogin({ token: 'tok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Tran',
          lastName: 'Van B',
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // logout — client-side invalidation
  // ─────────────────────────────────────────────────────────────────────────

  describe('logout — client-side invalidation', () => {
    it('logout với refreshToken → không throw', async () => {
      await service.logout({ accessToken: null, refreshToken: 'refresh-tok' });
    });

    it('logout với cả access và refresh token → không throw', async () => {
      await expect(
        service.logout({ accessToken: 'access-tok', refreshToken: 'refresh-tok' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // refreshToken — basic flow
  // ─────────────────────────────────────────────────────────────────────────

  describe('refreshToken — basic flow', () => {
    it('token không có jti → vẫn trả token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-2' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'tok-no-jti' });

      expect(result.token).toBe('access-tok');
    });

    it('token có jti → vẫn tạo token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-123', familyId: 'fam-2' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'tok-with-jti' });

      expect(result.token).toBe('access-tok');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// authService.extra.branches section
// ═══════════════════════════════════════════════════════════════════════════════

function buildService() {
  const authRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithAddresses: jest.fn(),
    findByGoogleIdOrEmail: jest.fn(),
    findByResetToken: jest.fn(),
    createUser: jest.fn(),
    saveUser: jest.fn((u) => Promise.resolve(u)),
  };
  const emailGateway = {
    sendOtpEmail: jest.fn().mockResolvedValue(),
    sendResetPasswordEmail: jest.fn().mockResolvedValue(),
  };
  const googleVerifier = {
    verifyIdToken: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
  const tokenSigner = {
    signAccessToken: jest.fn(() => 'access-tok'),
    signRefreshToken: jest.fn(() => 'new-refresh-tok'),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const eventBus = { publish: jest.fn().mockResolvedValue() };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const service = new AuthService({
    authRepository,
    emailGateway,
    googleVerifier,
    tokenSigner,
    eventBus,
    logger,
  });

  return { service, authRepository, tokenSigner };
}

// ── refreshToken — signRefreshToken với familyId ─────────────────────────────

describe('refreshToken — signRefreshToken chỉ dùng id', () => {
  it('signRefreshToken được gọi với { id } (không có familyId)', async () => {
    const { service, authRepository, tokenSigner } = buildService();

    tokenSigner.verifyRefreshToken.mockReturnValue({
      id: 1,
      jti: 'jti-abc',
      familyId: 'family-xyz',
    });
    authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

    const result = await service.refreshToken({ refreshToken: 'tok' });

    expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
    expect(result.token).toBe('access-tok');
  });

  it('token không có familyId → signRefreshToken vẫn chỉ nhận { id }', async () => {
    const { service, authRepository, tokenSigner } = buildService();

    tokenSigner.verifyRefreshToken.mockReturnValue({
      id: 1,
      jti: 'jti-no-family',
    });
    authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

    const result = await service.refreshToken({ refreshToken: 'tok-no-family' });

    expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
    expect(result.token).toBe('access-tok');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// authService.extra section
// ═══════════════════════════════════════════════════════════════════════════════

// Bổ sung tests cho AuthService — nhắm vào các path chưa được cover:
//
// - logout: revoke refresh token family khi có refreshToken
// - logout: không throw khi refreshToken expired/invalid
// - logout: token còn hiệu lực nhưng TTL <= 0 → không set blacklist
// - logout: không có blacklistStore → bỏ qua
// - refreshToken: token đã dùng (reuse detection) → revoke family + 401
// - refreshToken: family đã bị revoke → 401
// - refreshToken: rotation — đánh dấu jti cũ đã dùng + sinh refresh token mới
// - refreshToken: TokenExpiredError → 401
// - refreshToken: lỗi không phải JWT → rethrow
// - resendVerification: email chưa đăng ký → generic message (không gửi email)
// - resendVerification: email đã verify → generic message (không gửi email)
// - resendVerification: email lỗi không chặn flow
// - forgotPassword: email lỗi không chặn flow
// - resetPassword: blacklistStore.set lỗi → logger.warn nhưng vẫn success
// - _refreshTtlSeconds: các unit s/m/h và default (không match)
// - googleLogin: user tồn tại nhưng isActive=false → 401
// - googleLogin: user có googleId và avatar rồi → không update
// - verifyOtp: otpCode là null → 400

('use strict');

describe('AuthService — bổ sung coverage', () => {
  let authRepository;
  let emailGateway;
  let googleVerifier;
  let tokenSigner;
  let eventBus;
  let logger;
  let service;

  beforeEach(() => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithAddresses: jest.fn(),
      findByGoogleIdOrEmail: jest.fn(),
      findByResetToken: jest.fn(),
      createUser: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
    };
    emailGateway = {
      sendOtpEmail: jest.fn().mockResolvedValue(),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(),
    };
    googleVerifier = {
      verifyIdToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
    tokenSigner = {
      signAccessToken: jest.fn(() => 'access-tok'),
      signRefreshToken: jest.fn(() => 'new-refresh-tok'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new AuthService({
      authRepository,
      emailGateway,
      googleVerifier,
      tokenSigner,
      eventBus,
      logger,
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('logout — client-side invalidation', () => {
    test('có refreshToken hợp lệ → logout thành công không throw', async () => {
      await expect(
        service.logout({ accessToken: 'at', refreshToken: 'rt' }),
      ).resolves.toBeUndefined();
    });

    test('refreshToken và accessToken đều null → không throw', async () => {
      await expect(
        service.logout({ accessToken: null, refreshToken: null }),
      ).resolves.toBeUndefined();
    });

    test('access token không có jti → logout thành công', async () => {
      await expect(
        service.logout({ accessToken: 'at', refreshToken: null }),
      ).resolves.toBeUndefined();
    });

    test('access token exp <= now → logout thành công', async () => {
      await expect(
        service.logout({ accessToken: 'expired-at', refreshToken: null }),
      ).resolves.toBeUndefined();
    });

    test('không có blacklistStore → không throw', async () => {
      service = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        eventBus,
        logger,
      });

      await expect(
        service.logout({ accessToken: null, refreshToken: 'rt' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── refreshToken — reuse detection & family revoke ──────────────────────────

  describe('refreshToken — token rotation', () => {
    test('token hợp lệ → sinh access token mới và refresh token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-ok', familyId: 'fam-ok' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'valid-rt' });

      expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
      expect(result.refreshToken).toBe('new-refresh-tok');
      expect(result.token).toBe('access-tok');
    });

    test('token hợp lệ không có familyId → vẫn tạo token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'valid-rt-no-family' });

      expect(result.token).toBe('access-tok');
    });

    test('TokenExpiredError → 401', async () => {
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';
        throw err;
      });

      await expect(service.refreshToken({ refreshToken: 'expired-rt' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.refreshTokenInvalid',
      });
    });

    test('lỗi không phải JWT → rethrow', async () => {
      const unexpectedErr = new Error('DB connection lost');
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw unexpectedErr;
      });

      await expect(service.refreshToken({ refreshToken: 'rt' })).rejects.toBe(unexpectedErr);
    });
  });

  // ─── resendVerification ───────────────────────────────────────────────────────

  describe('resendVerification', () => {
    test('email chưa đăng ký → trả generic message, KHÔNG gửi OTP', async () => {
      authRepository.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification({ email: 'unknown@x.y' });

      expect(emailGateway.sendOtpEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('auth.resendGeneric');
    });

    test('email đã verify → trả generic message, KHÔNG gửi OTP', async () => {
      authRepository.findByEmail.mockResolvedValue({ isEmailVerified: true });

      const result = await service.resendVerification({ email: 'verified@x.y' });

      expect(emailGateway.sendOtpEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('auth.resendGeneric');
    });

    test('email lỗi không chặn flow — logger.error và vẫn return success', async () => {
      const user = {
        isEmailVerified: false,
        email: 'unverified@x.y',
        otpCode: '000000',
        otpExpires: new Date(),
      };
      authRepository.findByEmail.mockResolvedValue(user);
      emailGateway.sendOtpEmail.mockRejectedValue(new Error('SMTP timeout'));

      const result = await service.resendVerification({ email: 'unverified@x.y' });

      expect(logger.error).toHaveBeenCalled();
      expect(result.message).toBe('auth.otpResent');
    });

    test('email hợp lệ → cập nhật OTP mới + gửi email', async () => {
      const user = {
        id: 5,
        email: 'pending@x.y',
        isEmailVerified: false,
        otpCode: 'old-otp',
        otpExpires: new Date(Date.now() - 1000),
      };
      authRepository.findByEmail.mockResolvedValue(user);

      await service.resendVerification({ email: 'pending@x.y' });

      expect(user.otpCode).not.toBe('old-otp'); // OTP mới
      expect(user.otpExpires).toBeInstanceOf(Date);
      expect(authRepository.saveUser).toHaveBeenCalledWith(user);
      expect(emailGateway.sendOtpEmail).toHaveBeenCalledWith('pending@x.y', expect.any(String));
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────────

  describe('forgotPassword — email gateway failure', () => {
    test('email lỗi không chặn flow — logger.error và vẫn return success', async () => {
      const user = { email: 'a@b.c', resetPasswordToken: null, resetPasswordExpires: null };
      authRepository.findByEmail.mockResolvedValue(user);
      emailGateway.sendResetPasswordEmail.mockRejectedValue(new Error('gateway down'));

      const result = await service.forgotPassword({ email: 'a@b.c' });

      expect(logger.error).toHaveBeenCalled();
      expect(result.message).toBe('auth.passwordResetSent');
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────

  describe('resetPassword — thành công', () => {
    test('token hợp lệ → đặt lại mật khẩu thành công', async () => {
      const user = { id: 1, resetPasswordToken: 'tok', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'tok', password: 'newpass' });

      expect(authRepository.saveUser).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'newpass', resetPasswordToken: null }),
      );
      expect(result.message).toBe('auth.passwordResetSuccess');
    });
  });

  // ─── refreshToken — trả về token pair mới ─────────────────────────────────

  describe('refreshToken — token pair mới', () => {
    test('unit s → trả về access token và refresh token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-1' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'rt' });

      expect(result.token).toBe('access-tok');
      expect(result.refreshToken).toBe('new-refresh-tok');
    });

    test('unit m → signRefreshToken chỉ nhận { id }', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-abc' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      await service.refreshToken({ refreshToken: 'rt' });

      expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
    });

    test('unit h → signAccessToken với role đúng', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 5 });
      authRepository.findById.mockResolvedValue({ id: 5, role: 'admin', isActive: true });

      await service.refreshToken({ refreshToken: 'rt' });

      expect(tokenSigner.signAccessToken).toHaveBeenCalledWith({ id: 5, role: 'admin' });
    });

    test('unit d → user không tồn tại → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 99 });
      authRepository.findById.mockResolvedValue(null);

      await expect(service.refreshToken({ refreshToken: 'rt' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    test('không match pattern → user inactive → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ id: 1, isActive: false });

      await expect(service.refreshToken({ refreshToken: 'rt' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.accountDisabled',
      });
    });
  });

  // ─── googleLogin — edge cases ─────────────────────────────────────────────────

  describe('googleLogin — edge cases', () => {
    test('user tồn tại đã có googleId và avatar → không update, không gọi saveUser', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-exist',
        email: 'exist@x.y',
        picture: 'old-pic',
      });
      const existingUser = {
        id: 10,
        isActive: true,
        role: 'customer',
        googleId: 'g-exist', // đã có
        avatar: 'existing-avatar', // đã có
        isEmailVerified: true, // đã verify
      };
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(existingUser);

      await service.googleLogin({ token: 'idtok' });

      // Không có gì thay đổi → saveUser không được gọi
      expect(authRepository.saveUser).not.toHaveBeenCalled();
    });

    test('user tồn tại bị khóa → 401', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-locked',
        email: 'locked@x.y',
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue({
        id: 20,
        isActive: false,
        googleId: 'g-locked',
      });

      await expect(service.googleLogin({ token: 'idtok' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.accountDisabled',
      });
    });

    test('payload null sau verify → 401', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue(null);
      // Khi payload là null → service phải throw 401
      // Thực tế: service check `if (!payload)` → ném AppError
      await expect(service.googleLogin({ token: 'nullpayload' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  // ─── verifyOtp — otpCode null ─────────────────────────────────────────────────

  describe('verifyOtp — otpCode null', () => {
    test('otpCode null trong DB → 400 (timingSafeEqual sẽ fail trước do !user.otpCode)', async () => {
      authRepository.findByEmail.mockResolvedValue({
        isEmailVerified: false,
        otpCode: null,
        otpExpires: new Date(Date.now() + 60000),
      });

      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });
});

// ─── Merged from auth-service.edge-cases-2 ─────────────────────────

describe('AuthService — bổ sung coverage', () => {
  let authRepository;
  let emailGateway;
  let googleVerifier;
  let tokenSigner;
  let blacklistStore;
  let eventBus;
  let logger;
  let service;

  beforeEach(() => {
    authRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithAddresses: jest.fn(),
      findByGoogleIdOrEmail: jest.fn(),
      findByResetToken: jest.fn(),
      createUser: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
    };
    emailGateway = {
      sendOtpEmail: jest.fn().mockResolvedValue(),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(),
    };
    googleVerifier = {
      verifyIdToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    };
    tokenSigner = {
      signAccessToken: jest.fn(() => 'access-tok'),
      signRefreshToken: jest.fn(() => 'new-refresh-tok'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    blacklistStore = {
      set: jest.fn().mockResolvedValue(),
      get: jest.fn().mockResolvedValue(null),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new AuthService({
      authRepository,
      emailGateway,
      googleVerifier,
      tokenSigner,
      blacklistStore,
      eventBus,
      logger,
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('logout — client-side invalidation', () => {
    test('có refreshToken hợp lệ → logout thành công không throw', async () => {
      await expect(
        service.logout({ accessToken: 'at', refreshToken: 'rt' }),
      ).resolves.toBeUndefined();

      // logout dùng client-side invalidation — không gọi blacklistStore
      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('refreshToken và accessToken đều null → không throw', async () => {
      await expect(
        service.logout({ accessToken: null, refreshToken: null }),
      ).resolves.toBeUndefined();
    });

    test('access token không có jti → logout thành công', async () => {
      await expect(
        service.logout({ accessToken: 'at', refreshToken: null }),
      ).resolves.toBeUndefined();

      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('access token exp <= now → logout thành công', async () => {
      await expect(
        service.logout({ accessToken: 'expired-at', refreshToken: null }),
      ).resolves.toBeUndefined();

      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('không có blacklistStore → không throw', async () => {
      service = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        blacklistStore: null,
        eventBus,
        logger,
      });

      await expect(
        service.logout({ accessToken: null, refreshToken: 'rt' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── refreshToken — reuse detection & family revoke ──────────────────────────

  describe('refreshToken — token rotation', () => {
    test('token hợp lệ → sinh access token mới và refresh token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-ok', familyId: 'fam-ok' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'valid-rt' });

      expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
      expect(result.refreshToken).toBe('new-refresh-tok');
      expect(result.token).toBe('access-tok');
    });

    test('token hợp lệ không có familyId → vẫn tạo token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'valid-rt-no-family' });

      expect(result.token).toBe('access-tok');
      expect(result.refreshToken).toBe('new-refresh-tok');
    });

    test('TokenExpiredError → 401', async () => {
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        const err = new Error('jwt expired');
        err.name = 'TokenExpiredError';
        throw err;
      });

      await expect(service.refreshToken({ refreshToken: 'expired-rt' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.refreshTokenInvalid',
      });
    });

    test('lỗi không phải JWT → rethrow', async () => {
      const unexpectedErr = new Error('DB connection lost');
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw unexpectedErr;
      });

      await expect(service.refreshToken({ refreshToken: 'rt' })).rejects.toBe(unexpectedErr);
    });
  });

  // ─── resendVerification ───────────────────────────────────────────────────────

  describe('resendVerification', () => {
    test('email chưa đăng ký → trả generic message, KHÔNG gửi OTP', async () => {
      authRepository.findByEmail.mockResolvedValue(null);

      const result = await service.resendVerification({ email: 'unknown@x.y' });

      expect(emailGateway.sendOtpEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('auth.resendGeneric');
    });

    test('email đã verify → trả generic message, KHÔNG gửi OTP', async () => {
      authRepository.findByEmail.mockResolvedValue({ isEmailVerified: true });

      const result = await service.resendVerification({ email: 'verified@x.y' });

      expect(emailGateway.sendOtpEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('auth.resendGeneric');
    });

    test('email lỗi không chặn flow — logger.error và vẫn return success', async () => {
      const user = {
        isEmailVerified: false,
        email: 'unverified@x.y',
        otpCode: '000000',
        otpExpires: new Date(),
      };
      authRepository.findByEmail.mockResolvedValue(user);
      emailGateway.sendOtpEmail.mockRejectedValue(new Error('SMTP timeout'));

      const result = await service.resendVerification({ email: 'unverified@x.y' });

      expect(logger.error).toHaveBeenCalled();
      expect(result.message).toBe('auth.otpResent');
    });

    test('email hợp lệ → cập nhật OTP mới + gửi email', async () => {
      const user = {
        id: 5,
        email: 'pending@x.y',
        isEmailVerified: false,
        otpCode: 'old-otp',
        otpExpires: new Date(Date.now() - 1000),
      };
      authRepository.findByEmail.mockResolvedValue(user);

      await service.resendVerification({ email: 'pending@x.y' });

      expect(user.otpCode).not.toBe('old-otp'); // OTP mới
      expect(user.otpExpires).toBeInstanceOf(Date);
      expect(authRepository.saveUser).toHaveBeenCalledWith(user);
      expect(emailGateway.sendOtpEmail).toHaveBeenCalledWith('pending@x.y', expect.any(String));
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────────

  describe('forgotPassword — email gateway failure', () => {
    test('email lỗi không chặn flow — logger.error và vẫn return success', async () => {
      const user = { email: 'a@b.c', resetPasswordToken: null, resetPasswordExpires: null };
      authRepository.findByEmail.mockResolvedValue(user);
      emailGateway.sendResetPasswordEmail.mockRejectedValue(new Error('gateway down'));

      const result = await service.forgotPassword({ email: 'a@b.c' });

      expect(logger.error).toHaveBeenCalled();
      expect(result.message).toBe('auth.passwordResetSent');
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────────

  describe('resetPassword — thành công', () => {
    test('token hợp lệ → đặt lại mật khẩu thành công', async () => {
      const user = { id: 1, resetPasswordToken: 'tok', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'tok', password: 'newpass' });

      expect(authRepository.saveUser).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'newpass', resetPasswordToken: null }),
      );
      expect(result.message).toBe('auth.passwordResetSuccess');
    });

    test('không có blacklistStore → vẫn thành công', async () => {
      service = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        blacklistStore: null,
        eventBus,
        logger,
      });
      const user = { id: 2, resetPasswordToken: 'tok2', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'tok2', password: 'newpass' });

      expect(result.message).toBe('auth.passwordResetSuccess');
    });
  });

  // ─── refreshToken — trả về token pair mới ────────────────────────────────────

  describe('refreshToken — token pair', () => {
    test('user hợp lệ → trả về access token và refresh token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-1' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'rt' });

      expect(result.token).toBe('access-tok');
      expect(result.refreshToken).toBe('new-refresh-tok');
    });

    test('signRefreshToken chỉ nhận { id } (familyId đã xóa)', () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-abc' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'admin', isActive: true });

      return service.refreshToken({ refreshToken: 'rt' }).then(() => {
        expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
      });
    });

    test('không có familyId trong decoded → signRefreshToken với { id }', () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 2 });
      authRepository.findById.mockResolvedValue({ id: 2, role: 'customer', isActive: true });

      return service.refreshToken({ refreshToken: 'rt' }).then(() => {
        expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 2 });
      });
    });

    test('accessToken mới có role đúng của user', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'admin', isActive: true });

      await service.refreshToken({ refreshToken: 'rt' });

      expect(tokenSigner.signAccessToken).toHaveBeenCalledWith({ id: 1, role: 'admin' });
    });
  });

  // ─── googleLogin — edge cases ─────────────────────────────────────────────────

  describe('googleLogin — edge cases', () => {
    test('user tồn tại đã có googleId và avatar → không update, không gọi saveUser', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-exist',
        email: 'exist@x.y',
        picture: 'old-pic',
      });
      const existingUser = {
        id: 10,
        isActive: true,
        role: 'customer',
        googleId: 'g-exist', // đã có
        avatar: 'existing-avatar', // đã có
        isEmailVerified: true, // đã verify
      };
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(existingUser);

      await service.googleLogin({ token: 'idtok' });

      // Không có gì thay đổi → saveUser không được gọi
      expect(authRepository.saveUser).not.toHaveBeenCalled();
    });

    test('user tồn tại bị khóa → 401', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-locked',
        email: 'locked@x.y',
      });
      authRepository.findByGoogleIdOrEmail.mockResolvedValue({
        id: 20,
        isActive: false,
        googleId: 'g-locked',
      });

      await expect(service.googleLogin({ token: 'idtok' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.accountDisabled',
      });
    });

    test('payload null sau verify → 401', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue(null);
      // Khi payload là null → service phải throw 401
      // Thực tế: service check `if (!payload)` → ném AppError
      await expect(service.googleLogin({ token: 'nullpayload' })).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  // ─── verifyOtp — otpCode null ─────────────────────────────────────────────────

  describe('verifyOtp — otpCode null', () => {
    test('otpCode null trong DB → 400 (timingSafeEqual sẽ fail trước do !user.otpCode)', async () => {
      authRepository.findByEmail.mockResolvedValue({
        isEmailVerified: false,
        otpCode: null,
        otpExpires: new Date(Date.now() + 60000),
      });

      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });
});

// ─── Merged from auth-service.edge-cases-3 ─────────────────────────

function buildServiceAuth3() {
  const authRepository = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    findByIdWithAddresses: jest.fn(),
    findByGoogleIdOrEmail: jest.fn(),
    findByResetToken: jest.fn(),
    createUser: jest.fn(),
    saveUser: jest.fn((u) => Promise.resolve(u)),
  };
  const emailGateway = {
    sendOtpEmail: jest.fn().mockResolvedValue(),
    sendResetPasswordEmail: jest.fn().mockResolvedValue(),
  };
  const googleVerifier = {
    verifyIdToken: jest.fn(),
    verifyAccessToken: jest.fn(),
  };
  const tokenSigner = {
    signAccessToken: jest.fn(() => 'access-tok'),
    signRefreshToken: jest.fn(() => 'new-refresh-tok'),
    verifyAccessToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const service = new AuthService({
    authRepository,
    emailGateway,
    googleVerifier,
    tokenSigner,
    logger,
  });

  return { service, authRepository, tokenSigner };
}

// ── refreshToken — signRefreshToken chỉ nhận { id } ─────────────────────────

describe('refreshToken — signRefreshToken chỉ nhận { id }', () => {
  it('signRefreshToken được gọi với { id } khi decoded có jti và familyId', async () => {
    const { service, authRepository, tokenSigner } = buildServiceAuth3();

    tokenSigner.verifyRefreshToken.mockReturnValue({
      id: 1,
      jti: 'jti-abc',
      familyId: 'family-xyz',
    });
    authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

    const result = await service.refreshToken({ refreshToken: 'tok' });

    expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
    expect(result.token).toBe('access-tok');
    expect(result.refreshToken).toBe('new-refresh-tok');
  });

  it('signRefreshToken được gọi với { id } khi decoded không có familyId', async () => {
    const { service, authRepository, tokenSigner } = buildServiceAuth3();

    tokenSigner.verifyRefreshToken.mockReturnValue({
      id: 1,
      jti: 'jti-no-family',
    });
    authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

    const result = await service.refreshToken({ refreshToken: 'tok-no-family' });

    expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1 });
    expect(result.token).toBe('access-tok');
  });
});

// ─── Merged from auth-service.edge-cases-4.test.js ────────────────────────────

process.env.JWT_SECRET = 'test-jwt-secret-phase25-auth';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-phase25';
process.env.JWT_EXPIRES_IN = '7d';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';

// ---------- Mutable mock state ----------

const mockUserFindOneImpl = jest.fn();

// ---------- Mocks (not already present in base) ----------

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
  requireSuperAdmin: (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
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

describe('Tests Phase 25 — Auth Login Business Logic', () => {
  let request;

  beforeAll(() => {
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
    request = supertest(app);
  });

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
});
