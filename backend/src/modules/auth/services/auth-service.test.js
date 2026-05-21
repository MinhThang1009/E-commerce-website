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
        service.register({ email: 'a@b.c', password: 'pass', firstName: 'A', lastName: 'B' }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'auth.emailInUse' });
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
        expect.objectContaining({ email: 'a@b.c', otpCode: expect.any(String) }),
      );
      expect(emailGateway.sendOtpEmail).toHaveBeenCalledWith('a@b.c', expect.any(String));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'auth.userRegistered' }),
      );
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
      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    test('token expired/invalid → bỏ qua không throw', async () => {
      tokenSigner.verifyAccessToken.mockImplementation(() => {
        throw new Error('expired');
      });
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
    blacklistStore = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(),
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
  // Line 179: logout — if (decoded.familyId) false path
  // Khi refresh token không có familyId → không gọi blacklistStore.set cho family
  // ─────────────────────────────────────────────────────────────────────────

  describe('logout — decoded.familyId false path (line 179)', () => {
    it('không revoke family khi refreshToken không chứa familyId', async () => {
      // verifyRefreshToken trả decoded không có familyId
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1 }); // không có familyId

      await service.logout({ accessToken: null, refreshToken: 'refresh-no-family' });

      // blacklistStore.set KHÔNG được gọi với rt_family_revoked prefix
      const calls = blacklistStore.set.mock.calls;
      const familyRevokeCalls = calls.filter(([key]) => key.startsWith('rt_family_revoked:'));
      expect(familyRevokeCalls).toHaveLength(0);
    });

    it('revoke family khi refreshToken có familyId', async () => {
      // Verify true path còn hoạt động sau khi test false path
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'family-abc' });

      await service.logout({ accessToken: null, refreshToken: 'refresh-with-family' });

      expect(blacklistStore.set).toHaveBeenCalledWith(
        'rt_family_revoked:family-abc',
        expect.any(Number),
        '1',
      );
    });

    it('không throw khi verifyRefreshToken throw (expired token)', async () => {
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.logout({ accessToken: null, refreshToken: 'expired-refresh' }),
      ).resolves.toBeUndefined();

      expect(blacklistStore.set).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Line 304: refreshToken — if (jti && this.blacklistStore) false path
  // Khi decoded không có jti → không gọi blacklistStore.set cho rotation mark
  // ─────────────────────────────────────────────────────────────────────────

  describe('refreshToken — jti mark rotation false path (line 304)', () => {
    it('không đánh dấu token đã dùng khi decoded không có jti', async () => {
      // decoded không có jti → if (jti && this.blacklistStore) = false → skip rotation mark
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-1' }); // không có jti
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'tok-no-jti' });

      // Rotation mark set KHÔNG được gọi với rt_used prefix
      const calls = blacklistStore.set.mock.calls;
      const rotationCalls = calls.filter(([key]) => key.startsWith('rt_used:'));
      expect(rotationCalls).toHaveLength(0);

      // Nhưng token mới vẫn được tạo
      expect(result.token).toBe('access-tok');
    });

    it('đánh dấu token đã dùng khi decoded có jti và blacklistStore tồn tại', async () => {
      // Verify true path vẫn hoạt động — jti có → mark as used
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-123', familyId: 'fam-2' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      await service.refreshToken({ refreshToken: 'tok-with-jti' });

      expect(blacklistStore.set).toHaveBeenCalledWith(
        'rt_used:jti-123',
        expect.any(Number),
        'fam-2',
      );
    });

    it('không đánh dấu token khi không có blacklistStore', async () => {
      // Service không có blacklistStore → if (jti && this.blacklistStore) = false
      const serviceNoBlacklist = new AuthService({
        authRepository,
        emailGateway,
        googleVerifier,
        tokenSigner,
        blacklistStore: null, // không có blacklistStore
        auditService,
        eventBus,
        logger,
      });

      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-456', familyId: 'fam-3' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await serviceNoBlacklist.refreshToken({ refreshToken: 'tok' });

      // Không có blacklistStore → không gọi set
      expect(blacklistStore.set).not.toHaveBeenCalled();
      expect(result.token).toBe('access-tok');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// authService.extra.branches section
// ═══════════════════════════════════════════════════════════════════════════════

function buildService(blacklistStoreOverride = undefined) {
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
  const blacklistStore = blacklistStoreOverride ?? {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(),
  };
  const auditService = { logSuccessfulLogin: jest.fn() };
  const eventBus = { publish: jest.fn().mockResolvedValue() };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

  const service = new AuthService({
    authRepository,
    emailGateway,
    googleVerifier,
    tokenSigner,
    blacklistStore,
    auditService,
    eventBus,
    logger,
  });

  return { service, authRepository, tokenSigner, blacklistStore };
}

// ── Line 304: if (jti && this.blacklistStore) TRUE branch ────────────────────

describe('refreshToken — line 304 TRUE branch: jti + blacklistStore đều truthy', () => {
  it('đánh dấu rt_used khi jti có và blacklistStore tồn tại (line 304)', async () => {
    // TRUE branch: jti = 'jti-abc', blacklistStore truthy → gọi set với rt_used:jti-abc
    const { service, authRepository, tokenSigner, blacklistStore } = buildService();

    tokenSigner.verifyRefreshToken.mockReturnValue({
      id: 1,
      jti: 'jti-abc',
      familyId: 'family-xyz',
    });
    authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

    await service.refreshToken({ refreshToken: 'tok' });

    expect(blacklistStore.set).toHaveBeenCalledWith(
      'rt_used:jti-abc',
      expect.any(Number),
      'family-xyz', // familyId truthy → familyId (không phải '1' fallback)
    );
  });

  it('dùng "1" làm fallback khi familyId undefined (right side của || tại line 304)', async () => {
    // familyId = undefined → `familyId || '1'` = '1'
    const { service, authRepository, tokenSigner, blacklistStore } = buildService();

    tokenSigner.verifyRefreshToken.mockReturnValue({
      id: 1,
      jti: 'jti-no-family',
      // familyId không có → undefined
    });
    authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

    await service.refreshToken({ refreshToken: 'tok-no-family' });

    expect(blacklistStore.set).toHaveBeenCalledWith(
      'rt_used:jti-no-family',
      expect.any(Number),
      '1', // fallback vì familyId = undefined
    );
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
// - login: không có auditService → bỏ qua audit

('use strict');

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
