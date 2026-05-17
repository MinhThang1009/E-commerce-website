// Phase 42.2 — Unit tests cho AuthService (modules/auth)
// Mock toàn bộ repo + adapters → test pure business logic không hit DB.

const AuthService = require('./authService');

describe('AuthService', () => {
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
      signRefreshToken: jest.fn(() => 'refresh-tok'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    };
    blacklistStore = { set: jest.fn().mockResolvedValue() };
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

  describe('register', () => {
    test('email đã tồn tại → 400', async () => {
      authRepository.findByEmail.mockResolvedValue({ id: 1 });
      await expect(
        service.register({ email: 'a@b.c', password: 'pass', firstName: 'A', lastName: 'B' })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Email') });
    });

    test('email chưa tồn tại → tạo user + gửi OTP + publish event', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      authRepository.createUser.mockResolvedValue({ id: 5, email: 'a@b.c' });

      const result = await service.register({
        email: 'a@b.c',
        password: 'pass',
        firstName: 'A',
        lastName: 'B',
      });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@b.c', otpCode: expect.any(String) })
      );
      expect(emailGateway.sendOtpEmail).toHaveBeenCalledWith('a@b.c', expect.any(String));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth.userRegistered' })
      );
      expect(result.message).toMatch(/Đăng ký thành công/);
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
      expect(result.message).toMatch(/Đăng ký thành công/);
    });
  });

  describe('login', () => {
    test('email không tồn tại → 401', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'a@b.c', password: 'p' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('mật khẩu sai → 401', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      await expect(
        service.login({ email: 'a@b.c', password: 'wrong' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('email chưa xác thực → 401', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        isEmailVerified: false,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      await expect(
        service.login({ email: 'a@b.c', password: 'p' })
      ).rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('xác thực email') });
    });

    test('tài khoản bị khóa → 401', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        isEmailVerified: true,
        isActive: false,
        comparePassword: jest.fn().mockResolvedValue(true),
      });
      await expect(
        service.login({ email: 'a@b.c', password: 'p' })
      ).rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('bị khóa') });
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
      expect(auditService.logSuccessfulLogin).not.toHaveBeenCalled(); // role !== admin
    });

    test('login admin → audit logSuccessfulLogin được gọi', async () => {
      authRepository.findByEmail.mockResolvedValue({
        id: 1,
        role: 'admin',
        email: 'a@b.c',
        isEmailVerified: true,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
      });

      await service.login({ email: 'a@b.c', password: 'p', ip: '127.0.0.1' });

      expect(auditService.logSuccessfulLogin).toHaveBeenCalled();
    });
  });

  describe('verifyOtp', () => {
    test('thiếu email hoặc otp → 400', async () => {
      await expect(service.verifyOtp({ email: '', otp: '' })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('user không tồn tại → 400 generic (chống enumeration)', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      await expect(
        service.verifyOtp({ email: 'a@b.c', otp: '123456' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('email đã verify → 400 generic (chống enumeration)', async () => {
      authRepository.findByEmail.mockResolvedValue({ isEmailVerified: true });
      await expect(
        service.verifyOtp({ email: 'a@b.c', otp: '123456' })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('OTP sai → 400', async () => {
      authRepository.findByEmail.mockResolvedValue({
        isEmailVerified: false,
        otpCode: '123456',
        otpExpires: new Date(Date.now() + 60000),
      });
      await expect(
        service.verifyOtp({ email: 'a@b.c', otp: '999999' })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('OTP không đúng') });
    });

    test('OTP hết hạn → 400', async () => {
      authRepository.findByEmail.mockResolvedValue({
        isEmailVerified: false,
        otpCode: '123456',
        otpExpires: new Date(Date.now() - 60000),
      });
      await expect(
        service.verifyOtp({ email: 'a@b.c', otp: '123456' })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hết hạn') });
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
      expect(result.message).toMatch(/thành công/);
    });
  });

  describe('forgotPassword (anti-enumeration)', () => {
    test('email không tồn tại → vẫn trả message thành công, KHÔNG gửi email', async () => {
      authRepository.findByEmail.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'unknown@x.y' });
      expect(emailGateway.sendResetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toMatch(/đặt lại mật khẩu/);
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
        service.resetPassword({ token: 'bad', password: 'newpass' })
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Token') });
    });

    test('token hợp lệ → cập nhật mật khẩu + clear token', async () => {
      const user = { resetPasswordToken: 'good', resetPasswordExpires: new Date() };
      authRepository.findByResetToken.mockResolvedValue(user);

      const result = await service.resetPassword({ token: 'good', password: 'newpass' });

      expect(user.password).toBe('newpass');
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpires).toBeNull();
      expect(authRepository.saveUser).toHaveBeenCalled();
      expect(result.message).toMatch(/thành công/);
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
      await expect(
        service.refreshToken({ refreshToken: 'bad' })
      ).rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('không hợp lệ') });
    });

    test('user không tồn tại → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 99 });
      authRepository.findById.mockResolvedValue(null);
      await expect(
        service.refreshToken({ refreshToken: 't' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('user inactive → 401', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 });
      authRepository.findById.mockResolvedValue({ isActive: false });
      await expect(
        service.refreshToken({ refreshToken: 't' })
      ).rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('bị khóa') });
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
      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('token expired/invalid → bỏ qua không throw', async () => {
      tokenSigner.verifyAccessToken.mockImplementation(() => { throw new Error('expired'); });
      await expect(service.logout({ accessToken: 'old' })).resolves.toBeUndefined();
      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('token hợp lệ + còn TTL → blacklist với jti', async () => {
      const future = Math.floor(Date.now() / 1000) + 3600;
      tokenSigner.verifyAccessToken.mockReturnValue({ jti: 'abc-123', exp: future });
      await service.logout({ accessToken: 't' });
      expect(blacklistStore.set).toHaveBeenCalledWith('bl:abc-123', expect.any(Number), '1');
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
        id: 10, role: 'customer', isActive: true,
      });

      const result = await service.googleLogin({ token: 'idtok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'g-1', email: 'g@x.y', isEmailVerified: true })
      );
      expect(result.token).toBe('access-tok');
    });

    test('id-token fail → fallback access-token verify', async () => {
      googleVerifier.verifyIdToken.mockRejectedValue(new Error('bad id'));
      googleVerifier.verifyAccessToken.mockResolvedValue({
        sub: 'g-2', email: 'g2@x.y', given_name: 'G2', family_name: 'U',
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
      await expect(
        service.googleLogin({ token: 'bad' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('user đã tồn tại không có googleId → liên kết googleId + save', async () => {
      googleVerifier.verifyIdToken.mockResolvedValue({
        sub: 'g-3', email: 'old@x.y', picture: 'newpic',
      });
      const existingUser = { id: 5, isActive: true, role: 'customer' };
      authRepository.findByGoogleIdOrEmail.mockResolvedValue(existingUser);

      await service.googleLogin({ token: 'idtok' });

      expect(existingUser.googleId).toBe('g-3');
      expect(existingUser.avatar).toBe('newpic');
      expect(existingUser.isEmailVerified).toBe(true);
      expect(authRepository.saveUser).toHaveBeenCalledWith(existingUser);
    });
  });

  describe('getCurrentUser', () => {
    test('user không tồn tại → 404', async () => {
      authRepository.findByIdWithAddresses.mockResolvedValue(null);
      await expect(
        service.getCurrentUser({ userId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('user tồn tại → trả user', async () => {
      const user = { id: 1, addresses: [] };
      authRepository.findByIdWithAddresses.mockResolvedValue(user);
      const result = await service.getCurrentUser({ userId: 1 });
      expect(result.user).toBe(user);
    });
  });
});
