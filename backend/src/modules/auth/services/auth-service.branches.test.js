/**
 * Branch coverage tests cho src/modules/auth/services/authService.js
 * Target: lines 129-130, 179, 304
 *
 * Line 129: firstName || 'Google' — false path (firstName là null/undefined)
 * Line 130: lastName || 'User'    — false path (lastName là null/undefined)
 * Line 179: if (decoded.familyId) — false path (familyId không tồn tại trong refresh token)
 * Line 304: if (jti && this.blacklistStore) — false path (không có jti hoặc không có blacklistStore)
 */

const AuthService = require('./auth-service');

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
        id: 20, role: 'customer', isActive: true,
      });

      await service.googleLogin({ token: 'tok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Google',
          lastName: 'User',
        })
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
        id: 21, role: 'customer', isActive: true,
      });

      await service.googleLogin({ token: 'tok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Nguyen',
          lastName: 'User',
        })
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
        id: 22, role: 'customer', isActive: true,
      });

      await service.googleLogin({ token: 'tok' });

      expect(authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Tran',
          lastName: 'Van B',
        })
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
        '1'
      );
    });

    it('không throw khi verifyRefreshToken throw (expired token)', async () => {
      tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.logout({ accessToken: null, refreshToken: 'expired-refresh' })
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
        'fam-2'
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
