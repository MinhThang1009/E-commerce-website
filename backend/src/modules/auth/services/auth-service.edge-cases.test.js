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

  describe('logout — client-side invalidation', () => {
    it('logout với refreshToken → không throw, không gọi blacklistStore', async () => {
      await service.logout({ accessToken: null, refreshToken: 'refresh-tok' });

      // logout hiện tại dùng client-side invalidation — không gọi blacklistStore
      expect(blacklistStore.set).not.toHaveBeenCalled();
    });

    it('logout với cả accessToken và refreshToken → không throw', async () => {
      await expect(
        service.logout({ accessToken: 'access-tok', refreshToken: 'refresh-tok' }),
      ).resolves.toBeUndefined();
    });

    it('không throw khi cả hai token đều null', async () => {
      await expect(
        service.logout({ accessToken: null, refreshToken: null }),
      ).resolves.toBeUndefined();

      expect(blacklistStore.set).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Line 304: refreshToken — if (jti && this.blacklistStore) false path
  // Khi decoded không có jti → không gọi blacklistStore.set cho rotation mark
  // ─────────────────────────────────────────────────────────────────────────

  describe('refreshToken — trả token mới', () => {
    it('token hợp lệ → trả access token và refresh token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-1' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'tok' });

      expect(result.token).toBe('access-tok');
      expect(result.refreshToken).toBeDefined();
    });

    it('token hợp lệ có jti → vẫn trả token mới (không dùng blacklist)', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, jti: 'jti-123', familyId: 'fam-2' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'tok-with-jti' });

      // blacklistStore không được gọi
      expect(blacklistStore.set).not.toHaveBeenCalled();
      expect(result.token).toBe('access-tok');
    });

    it('token không có jti → vẫn trả token mới', async () => {
      tokenSigner.verifyRefreshToken.mockReturnValue({ id: 1, familyId: 'fam-2' });
      authRepository.findById.mockResolvedValue({ id: 1, role: 'customer', isActive: true });

      const result = await service.refreshToken({ refreshToken: 'tok-no-jti' });

      expect(result.token).toBe('access-tok');
      expect(blacklistStore.set).not.toHaveBeenCalled();
    });
  });
});
