/**
 * Extra branch coverage cho authService.js line 304.
 *
 * Line 303-305:
 *   if (jti && this.blacklistStore) {
 *     await this.blacklistStore.set(`rt_used:${jti}`, ttl, familyId || '1');
 *   }
 *
 * Nhánh TRUE của điều kiện (jti && blacklistStore) đã được cover trong
 * authService.branches.test.js. File này bổ sung test cho:
 *   - familyId truthy → truyền familyId vào set (không dùng '1' fallback)
 *   - familyId falsy → truyền '1' fallback vào set (right side của `||`)
 */

const AuthService = require('./authService');

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
