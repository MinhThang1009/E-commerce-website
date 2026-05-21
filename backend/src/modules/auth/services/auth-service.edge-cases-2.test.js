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
// - login: không có auditService → bỏ qua audit

'use strict';

const AuthService = require('./auth-service');

describe('AuthService — bổ sung coverage', () => {
  let authRepository;
  let emailGateway;
  let googleVerifier;
  let tokenSigner;
  let blacklistStore;
  let auditService;
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
    auditService = { logSuccessfulLogin: jest.fn() };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new AuthService({
      authRepository,
      emailGateway,
      googleVerifier,
      tokenSigner,
      blacklistStore,
      auditService,
      eventBus,
      logger,
    });
  });

  // ─── logout ──────────────────────────────────────────────────────────────────

  describe('logout — refresh token handling', () => {
    test('có refreshToken hợp lệ với familyId → revoke family', async () => {
      tokenSigner.verifyAccessToken.mockReturnValue({
        jti: 'jti-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
      });
      tokenSigner.verifyRefreshToken.mockReturnValue({ familyId: 'fam-abc', id: 1 });

      await service.logout({ accessToken: 'at', refreshToken: 'rt' });

      expect(blacklistStore.set).toHaveBeenCalledWith(
        'rt_family_revoked:fam-abc',
        expect.any(Number),
        '1',
      );
    });

    test('refreshToken expired/invalid → bỏ qua không throw', async () => {
      tokenSigner.verifyAccessToken.mockReturnValue({
        jti: 'j',
        exp: Math.floor(Date.now() / 1000) + 1,
      });
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw new Error('expired rt');
      });

      await expect(
        service.logout({ accessToken: 'at', refreshToken: 'bad-rt' }),
      ).resolves.toBeUndefined();
    });

    test('access token không có jti → không set blacklist', async () => {
      tokenSigner.verifyAccessToken.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }); // no jti

      await service.logout({ accessToken: 'at', refreshToken: null });

      // Không set blacklist vì không có jti
      expect(blacklistStore.set).not.toHaveBeenCalledWith(
        expect.stringContaining('bl:'),
        expect.anything(),
        expect.anything(),
      );
    });

    test('access token exp <= now → không set blacklist (TTL <= 0)', async () => {
      tokenSigner.verifyAccessToken.mockReturnValue({
        jti: 'old',
        exp: Math.floor(Date.now() / 1000) - 1,
      });

      await service.logout({ accessToken: 'at', refreshToken: null });

      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('không có blacklistStore → không throw', async () => {
      service = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        blacklistStore: null,
        auditService,
        eventBus,
        logger,
      });
      tokenSigner.verifyRefreshToken.mockReturnValue({ familyId: 'fam-1', id: 1 });

      await expect(
        service.logout({ accessToken: null, refreshToken: 'rt' }),
      ).resolves.toBeUndefined();
    });
  });

  // ─── refreshToken — reuse detection & family revoke ──────────────────────────

  describe('refreshToken — reuse detection', () => {
    test('token đã được dùng (alreadyUsed) → revoke family + 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'used-jti', familyId: 'fam-x' });
      blacklistStore.get.mockImplementation((key) => {
        if (key === 'rt_used:used-jti') return Promise.resolve('fam-x');
        return Promise.resolve(null);
      });

      await expect(service.refreshToken({ refreshToken: 'used-rt' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.refreshTokenUsed',
      });

      expect(blacklistStore.set).toHaveBeenCalledWith(
        'rt_family_revoked:fam-x',
        expect.any(Number),
        '1',
      );
      expect(logger.warn).toHaveBeenCalled();
    });

    test('family đã bị revoke → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({
        id: 1,
        jti: 'jti-fresh',
        familyId: 'fam-revoked',
      });
      blacklistStore.get.mockImplementation((key) => {
        if (key === 'rt_used:jti-fresh') return Promise.resolve(null); // chưa dùng
        if (key === 'rt_family_revoked:fam-revoked') return Promise.resolve('1');
        return Promise.resolve(null);
      });

      await expect(service.refreshToken({ refreshToken: 'rt' })).rejects.toMatchObject({
        statusCode: 401,
        message: 'auth.sessionRevoked',
      });
    });

    test('token hợp lệ → đánh dấu jti cũ và sinh refresh token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-ok', familyId: 'fam-ok' });
      blacklistStore.get.mockResolvedValue(null); // chưa dùng, chưa revoke
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'valid-rt' });

      // jti cũ được đánh dấu đã dùng
      expect(blacklistStore.set).toHaveBeenCalledWith(
        'rt_used:jti-ok',
        expect.any(Number),
        'fam-ok',
      );
      // refresh token mới được tạo với familyId
      expect(tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 1, familyId: 'fam-ok' });
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

  describe('resetPassword — blacklistStore failure', () => {
    test('blacklistStore.set lỗi → logger.warn nhưng vẫn return success', async () => {
      const user = { id: 1, resetPasswordToken: 'tok', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);
      blacklistStore.set.mockRejectedValue(new Error('Redis unavailable'));

      const result = await service.resetPassword({ token: 'tok', password: 'newpass' });

      expect(logger.warn).toHaveBeenCalled();
      expect(result.message).toBe('auth.passwordResetSuccess');
    });

    test('không có blacklistStore → vẫn thành công', async () => {
      service = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        blacklistStore: null,
        auditService,
        eventBus,
        logger,
      });
      const user = { id: 2, resetPasswordToken: 'tok2', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'tok2', password: 'newpass' });

      expect(result.message).toBe('auth.passwordResetSuccess');
    });
  });

  // ─── _refreshTtlSeconds ───────────────────────────────────────────────────────

  describe('_refreshTtlSeconds', () => {
    test('unit s → trả seconds trực tiếp', () => {
      process.env.JWT_REFRESH_EXPIRES_IN = '3600s';
      expect(service._refreshTtlSeconds()).toBe(3600);
    });

    test('unit m → nhân 60', () => {
      process.env.JWT_REFRESH_EXPIRES_IN = '30m';
      expect(service._refreshTtlSeconds()).toBe(30 * 60);
    });

    test('unit h → nhân 3600', () => {
      process.env.JWT_REFRESH_EXPIRES_IN = '2h';
      expect(service._refreshTtlSeconds()).toBe(2 * 3600);
    });

    test('unit d → nhân 86400', () => {
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
      expect(service._refreshTtlSeconds()).toBe(7 * 86400);
    });

    test('không match pattern → trả default 7 ngày', () => {
      process.env.JWT_REFRESH_EXPIRES_IN = 'invalid-format';
      expect(service._refreshTtlSeconds()).toBe(7 * 24 * 3600);
    });

    afterEach(() => {
      process.env.JWT_REFRESH_EXPIRES_IN = '7d';
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

  // ─── login — không có auditService ───────────────────────────────────────────

  describe('login — không có auditService', () => {
    test('login admin khi auditService=null → không throw', async () => {
      service = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        blacklistStore,
        auditService: null,
        eventBus,
        logger,
      });

      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        role: 'admin',
        email: 'a@b.c',
        isEmailVerified: true,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      });

      const result = await service.login({ email: 'a@b.c', password: 'p', ip: '127.0.0.1' });
      expect(result.token).toBe('access-tok');
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
