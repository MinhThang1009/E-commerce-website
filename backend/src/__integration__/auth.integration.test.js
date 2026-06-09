require('module-alias/register');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const sequelize = require('@config/sequelize');
const { User } = require('@models');
const { Op } = require('sequelize');

const SequelizeAuthRepository = require('@modules/auth/repositories/sequelize-auth-repository');
const AuthService = require('@modules/auth/services/auth-service');

const TS = Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await User.destroy({ where: { email: { [Op.like]: `__int_auth_${TS}%` } }, force: true });
});

describe('Auth Integration — User', () => {
  let user;

  test('Tạo user — password hash tự động qua hook', async () => {
    user = await User.create({
      firstName: '__INT_Auth',
      lastName: 'Test',
      email: `__int_auth_${TS}@test.com`,
      password: 'PlainPassword123!',
      role: 'customer',
    });

    expect(user.id).toBeDefined();
    // Hook beforeCreate hash password — không lưu plain text
    expect(user.password).not.toBe('PlainPassword123!');
    expect(user.password.length).toBeGreaterThan(20);
  });

  test('Tìm user theo email', async () => {
    const found = await User.findOne({ where: { email: `__int_auth_${TS}@test.com` } });
    expect(found).not.toBeNull();
    expect(found.id).toBe(user.id);
    expect(found.firstName).toBe('__INT_Auth');
  });

  test('Update firstName', async () => {
    await user.update({ firstName: '__INT_Auth_Updated' });
    await user.reload();
    expect(user.firstName).toBe('__INT_Auth_Updated');
  });

  test('Email unique — tạo duplicate bị reject', async () => {
    await expect(
      User.create({
        firstName: 'Dup',
        lastName: 'User',
        email: `__int_auth_${TS}@test.com`,
        password: 'Another123!',
        role: 'customer',
      }),
    ).rejects.toThrow();
  });

  test('isEmailVerified default false', async () => {
    expect(user.isEmailVerified).toBe(false);
    await user.update({ isEmailVerified: true });
    await user.reload();
    expect(user.isEmailVerified).toBe(true);
  });

  test('Soft delete user — tìm bình thường không thấy, paranoid:false thấy', async () => {
    const tempUser = await User.create({
      firstName: '__INT_Del',
      lastName: 'User',
      email: `__int_auth_del_${TS}@test.com`,
      password: 'Delete123!',
      role: 'customer',
    });
    await tempUser.destroy();
    const notFound = await User.findByPk(tempUser.id);
    expect(notFound).toBeNull();
    const found = await User.findByPk(tempUser.id, { paranoid: false });
    expect(found).not.toBeNull();
    expect(found.deletedAt).not.toBeNull();
    await found.destroy({ force: true });
  });
});

describe('Auth extra — đăng ký email đã tồn tại', () => {
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

describe('Auth extra — sai mật khẩu nhiều lần', () => {
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

describe('Auth extra — OTP hết hạn', () => {
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

describe('Auth extra — refresh token hợp lệ', () => {
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

describe('Auth extra — reset password thành công', () => {
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

describe('Auth edge cases — reset password token hết hạn', () => {
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
      eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
  }

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
      eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
  }

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
