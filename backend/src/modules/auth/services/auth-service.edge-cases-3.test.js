/**
 * Branch coverage tests cho auth-service.js refreshToken.
 *
 * Kiểm tra signRefreshToken được gọi đúng sau khi xóa familyId dead code.
 * signRefreshToken chỉ nhận { id } — không còn familyId.
 */

const AuthService = require('./auth-service');

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
    expect(result.refreshToken).toBe('new-refresh-tok');
  });

  it('signRefreshToken được gọi với { id } khi decoded không có familyId', async () => {
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
