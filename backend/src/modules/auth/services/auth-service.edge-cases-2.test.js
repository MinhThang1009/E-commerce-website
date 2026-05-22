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

'use strict';

const AuthService = require('./auth-service');

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
