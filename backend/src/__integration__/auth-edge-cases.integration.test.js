/**
 * Integration tests — Auth edge cases với real DB.
 * Kiểm tra: token reset password hết hạn, OTP sai nhiều lần, đăng nhập account bị deactivate.
 */
require('module-alias/register');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sequelize = require('@config/sequelize');
const { User } = require('@models');
const { Op } = require('sequelize');

const SequelizeAuthRepository = require('@modules/auth/repositories/sequelize-auth-repository');
const AuthService = require('@modules/auth/services/auth-service');

const TS = Date.now();

function makeService() {
  const authRepository = new SequelizeAuthRepository({ User });

  // Adapter tối giản — chỉ cần đủ để service hoạt động, không call thật
  const tokenSigner = {
    signAccessToken: ({ id, role }) =>
      jwt.sign({ id, role, jti: crypto.randomUUID() }, 'test-secret-min-32-chars-long-enough', {
        expiresIn: '1h',
      }),
    signRefreshToken: ({ id, familyId }) =>
      jwt.sign(
        { id, jti: crypto.randomUUID(), familyId: familyId || crypto.randomUUID() },
        'test-refresh-secret-min-32-chars-long',
        { expiresIn: '7d' },
      ),
    verifyAccessToken: (token) =>
      jwt.verify(token, 'test-secret-min-32-chars-long-enough', { algorithms: ['HS256'] }),
    verifyRefreshToken: (token) => jwt.verify(token, 'test-refresh-secret-min-32-chars-long'),
  };

  return new AuthService({
    authRepository,
    emailGateway: {
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(undefined),
    },
    googleVerifier: {
      verifyIdToken: jest.fn().mockRejectedValue(new Error('not used')),
      verifyAccessToken: jest.fn().mockRejectedValue(new Error('not used')),
    },
    tokenSigner,
    blacklistStore: null, // Redis không cần cho các test này
    auditService: null,
    eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  });
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await User.destroy({
    where: { email: { [Op.like]: `__int_auth_edge_%${TS}@test.com` } },
    force: true,
  });
});

describe('Auth edge cases — reset password token hết hạn', () => {
  test('Reset password token hết hạn → throw lỗi', async () => {
    const service = makeService();

    const expiredToken = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      firstName: '__INT_AuthEdge',
      lastName: 'Expired',
      email: `__int_auth_edge_expired_${TS}@test.com`,
      password: 'AuthEdge123!',
      role: 'customer',
      resetPasswordToken: expiredToken,
      // Đặt thời gian hết hạn trong quá khứ
      resetPasswordExpires: new Date(Date.now() - 60 * 1000),
    });

    // Repository lọc resetPasswordExpires > NOW() → trả null → service throw
    await expect(
      service.resetPassword({ token: expiredToken, password: 'NewPassword123!' }),
    ).rejects.toThrow();

    await user.destroy({ force: true });
  });
});

describe('Auth edge cases — OTP sai nhiều lần', () => {
  test('Verify OTP sai token nhiều lần → throw lỗi mỗi lần', async () => {
    const service = makeService();

    const correctOtp = '123456';
    const wrongOtp = '000000';
    const user = await User.create({
      firstName: '__INT_AuthEdge',
      lastName: 'OTP',
      email: `__int_auth_edge_otp_${TS}@test.com`,
      password: 'AuthEdge789!',
      role: 'customer',
      otpCode: correctOtp,
      otpExpires: new Date(Date.now() + 10 * 60 * 1000),
      isEmailVerified: false,
    });

    // Lần 1 — OTP sai → throw
    await expect(service.verifyOtp({ email: user.email, otp: wrongOtp })).rejects.toThrow();

    // Lần 2 — vẫn sai → throw (service không lock account, chỉ báo sai)
    await expect(service.verifyOtp({ email: user.email, otp: wrongOtp })).rejects.toThrow();

    // Lần 3 — vẫn sai → throw
    await expect(service.verifyOtp({ email: user.email, otp: wrongOtp })).rejects.toThrow();

    // OTP đúng vẫn hoạt động sau 3 lần sai — service không block account
    const result = await service.verifyOtp({ email: user.email, otp: correctOtp });
    expect(result.message).toBe('auth.emailVerified');

    await user.destroy({ force: true });
  });
});

describe('Auth edge cases — account bị deactivate', () => {
  test('Đăng nhập account bị deactivate (isActive=false) → throw lỗi', async () => {
    const service = makeService();

    const deactivatedUser = await User.create({
      firstName: '__INT_AuthEdge',
      lastName: 'Inactive',
      email: `__int_auth_edge_inactive_${TS}@test.com`,
      password: 'AuthEdge321!',
      role: 'customer',
      isEmailVerified: true,
      isActive: false, // Account bị vô hiệu hóa
    });

    await expect(
      service.login({ email: deactivatedUser.email, password: 'AuthEdge321!', ip: '127.0.0.1' }),
    ).rejects.toThrow();

    await deactivatedUser.destroy({ force: true });
  });
});
