/**
 * Integration tests — Auth extra cases với real DB.
 * Kiểm tra: duplicate email, sai mật khẩu nhiều lần, OTP hết hạn,
 * refresh token hợp lệ, reset password thành công.
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

// Secrets đủ dài để jsonwebtoken không reject (>= 32 chars)
const ACCESS_SECRET = 'test-access-secret-min-32-chars-long-ok';
const REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-ok';

function makeService() {
  const authRepository = new SequelizeAuthRepository({ User });

  const tokenSigner = {
    signAccessToken: ({ id, role }) =>
      jwt.sign({ id, role, jti: crypto.randomUUID() }, ACCESS_SECRET, { expiresIn: '1h' }),
    signRefreshToken: ({ id, familyId }) =>
      jwt.sign(
        { id, jti: crypto.randomUUID(), familyId: familyId || crypto.randomUUID() },
        REFRESH_SECRET,
        { expiresIn: '7d' },
      ),
    verifyAccessToken: (token) => jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] }),
    verifyRefreshToken: (token) => jwt.verify(token, REFRESH_SECRET),
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
    eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  });
}

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await User.destroy({
    where: { email: { [Op.like]: `__int_auth_extra_%${TS}@test.com` } },
    force: true,
  });
});

// ─────────────────────────────────────────────────────────────
describe('Auth extra — đăng ký email đã tồn tại', () => {
  test('Đăng ký → email đã tồn tại → throw lỗi duplicate', async () => {
    const service = makeService();
    const existingEmail = `__int_auth_extra_dup_${TS}@test.com`;

    // Tạo user trước để làm "email đã tồn tại"
    await User.create({
      firstName: '__INT_AuthExtra',
      lastName: 'Dup',
      email: existingEmail,
      password: 'Existing123!',
      role: 'customer',
    });

    // Đăng ký lần 2 với cùng email → service phải throw
    await expect(
      service.register({
        email: existingEmail,
        password: 'Another123!',
        firstName: '__INT_AuthExtra',
        lastName: 'Dup2',
      }),
    ).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────
describe('Auth extra — sai mật khẩu nhiều lần', () => {
  test('Đăng nhập → sai mật khẩu 3 lần → vẫn có thể thử lại (không lock account)', async () => {
    const service = makeService();

    // Tạo user đã xác thực email, đang active
    const user = await User.create({
      firstName: '__INT_AuthExtra',
      lastName: 'WrongPwd',
      email: `__int_auth_extra_wrongpwd_${TS}@test.com`,
      password: 'CorrectPassword123!',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
    });

    const wrongPassword = 'WrongPassword000!';

    // Lần 1 — sai → throw
    await expect(
      service.login({ email: user.email, password: wrongPassword, ip: '127.0.0.1' }),
    ).rejects.toThrow();

    // Lần 2 — sai → throw (account chưa bị lock)
    await expect(
      service.login({ email: user.email, password: wrongPassword, ip: '127.0.0.1' }),
    ).rejects.toThrow();

    // Lần 3 — sai → throw
    await expect(
      service.login({ email: user.email, password: wrongPassword, ip: '127.0.0.1' }),
    ).rejects.toThrow();

    // Kiểm tra account vẫn active (không bị lock sau 3 lần sai)
    await user.reload();
    expect(user.isActive).toBe(true);

    await user.destroy({ force: true });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Auth extra — OTP hết hạn', () => {
  test('OTP expires → verify thất bại', async () => {
    const service = makeService();

    // Tạo user với OTP đã hết hạn (otpExpires trong quá khứ)
    const expiredOtp = '654321';
    const user = await User.create({
      firstName: '__INT_AuthExtra',
      lastName: 'OtpExp',
      email: `__int_auth_extra_otpexp_${TS}@test.com`,
      password: 'OtpExp123!',
      role: 'customer',
      otpCode: expiredOtp,
      // Đặt thời gian hết hạn trong quá khứ — 5 phút trước
      otpExpires: new Date(Date.now() - 5 * 60 * 1000),
      isEmailVerified: false,
    });

    // Verify với OTP đúng nhưng đã hết hạn → phải throw
    await expect(service.verifyOtp({ email: user.email, otp: expiredOtp })).rejects.toThrow();

    // Xác nhận isEmailVerified vẫn false (không được set thành true)
    await user.reload();
    expect(user.isEmailVerified).toBe(false);

    await user.destroy({ force: true });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Auth extra — refresh token hợp lệ', () => {
  test('Refresh token hợp lệ → trả token mới', async () => {
    const service = makeService();

    // Cần user active để refreshToken hoạt động
    const user = await User.create({
      firstName: '__INT_AuthExtra',
      lastName: 'Refresh',
      email: `__int_auth_extra_refresh_${TS}@test.com`,
      password: 'Refresh123!',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
    });

    // Tạo refresh token hợp lệ trực tiếp (không cần login endpoint)
    const familyId = crypto.randomUUID();
    const refreshToken = jwt.sign(
      { id: user.id, jti: crypto.randomUUID(), familyId },
      REFRESH_SECRET,
      { expiresIn: '7d' },
    );

    // Act — refresh token
    const result = await service.refreshToken({ refreshToken });

    // Assert — nhận được access token và refresh token mới
    expect(result.token).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(typeof result.refreshToken).toBe('string');
    // Token mới phải khác token cũ (rotation)
    expect(result.refreshToken).not.toBe(refreshToken);

    await user.destroy({ force: true });
  });
});

// ─────────────────────────────────────────────────────────────
describe('Auth extra — reset password thành công', () => {
  test('Reset password thành công → có thể login với mật khẩu mới', async () => {
    const service = makeService();

    const newPassword = 'NewPassword@2025!';
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Tạo user với reset token còn hạn
    const user = await User.create({
      firstName: '__INT_AuthExtra',
      lastName: 'ResetOk',
      email: `__int_auth_extra_resetok_${TS}@test.com`,
      password: 'OldPassword123!',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
      resetPasswordToken: resetToken,
      // Hết hạn sau 15 phút (còn hạn)
      resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Act — reset password
    const resetResult = await service.resetPassword({ token: resetToken, password: newPassword });
    expect(resetResult.message).toBe('auth.passwordResetSuccess');

    // Xác nhận token đã bị xóa khỏi DB
    await user.reload();
    expect(user.resetPasswordToken).toBeNull();
    expect(user.resetPasswordExpires).toBeNull();

    // Verify mật khẩu mới được lưu đúng (comparePassword)
    const passwordMatches = await user.comparePassword(newPassword);
    expect(passwordMatches).toBe(true);

    // Đăng nhập với mật khẩu mới phải thành công
    const loginResult = await service.login({
      email: user.email,
      password: newPassword,
      ip: '127.0.0.1',
    });
    expect(loginResult.token).toBeDefined();
    expect(loginResult.user.id).toBe(user.id);

    await user.destroy({ force: true });
  });
});
