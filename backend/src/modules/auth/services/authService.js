/**
 * @file authService.js
 * @layer Service
 * @module auth
 * @description Business logic layer cho auth
 */
const crypto = require('crypto');
const { AppError } = require('../../../shared/errors');

// Auth Service — business logic. KHÔNG import Sequelize hoặc Model trực tiếp;
// chỉ gọi qua authRepository (interface). External service (email/google/redis/audit)
// đều inject qua constructor để dễ test + dễ swap implementation.
class AuthService {
  constructor({
    authRepository,
    emailGateway,
    googleVerifier,
    tokenSigner,
    blacklistStore,
    auditService,
    eventBus,
    logger,
  }) {
    this.authRepository = authRepository;
    this.emailGateway = emailGateway;
    this.googleVerifier = googleVerifier;
    this.tokenSigner = tokenSigner;
    this.blacklistStore = blacklistStore;
    this.auditService = auditService;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // Đăng ký user mới — tạo OTP 6 chữ số hết hạn 10 phút, gửi email không chặn flow nếu fail.
  async register({ email, password, firstName, lastName, phone }) {
    const existing = await this.authRepository.findByEmail(email);
    if (existing) {
      throw new AppError('auth.emailInUse', 400);
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    const user = await this.authRepository.createUser({
      email,
      password,
      firstName,
      lastName,
      phone,
      otpCode,
      otpExpires,
    });

    try {
      await this.emailGateway.sendOtpEmail(user.email, otpCode);
    } catch (emailErr) {
      this.logger.error(`[Auth] Gửi OTP email thất bại cho ${user.email}: ${emailErr.message}`);
    }

    await this.eventBus.publish({
      type: 'auth.userRegistered',
      payload: { userId: user.id, email: user.email },
      occurredAt: new Date().toISOString(),
    });

    return { message: 'auth.registerSuccess' };
  }

  // Đăng nhập email + password
  async login({ email, password, ip }) {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('auth.invalidCredentials', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('auth.invalidCredentials', 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError('auth.emailNotVerified', 401);
    }

    if (!user.isActive) {
      throw new AppError('auth.accountDisabled', 401);
    }

    const token = this.tokenSigner.signAccessToken({ id: user.id, role: user.role });
    const refreshToken = this.tokenSigner.signRefreshToken({ id: user.id });

    this.logger.info('[AUTH] Login success', { userId: user.id, email: user.email });

    if (user.role === 'admin' && this.auditService) {
      this.auditService.logSuccessfulLogin(user, ip);
    }

    return { token, refreshToken, user };
  }

  // Đăng nhập Google — verify token (id-token hoặc access-token), tạo user nếu chưa tồn tại.
  async googleLogin({ token }) {
    let payload;
    try {
      payload = await this.googleVerifier.verifyIdToken(token);
    } catch (e) {
      try {
        payload = await this.googleVerifier.verifyAccessToken(token);
      } catch (_err) {
        throw new AppError('auth.googleAuthFailed', 401);
      }
    }

    if (!payload) {
      throw new AppError('auth.googleAuthFailed', 401);
    }

    const {
      sub: googleId,
      email,
      given_name: firstName,
      family_name: lastName,
      picture: avatar,
    } = payload;

    let user = await this.authRepository.findByGoogleIdOrEmail(googleId, email);

    if (!user) {
      user = await this.authRepository.createUser({
        googleId,
        email,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        avatar,
        isEmailVerified: true,
      });
    } else {
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar) updates.avatar = avatar;
      if (!user.isEmailVerified) updates.isEmailVerified = true;
      if (Object.keys(updates).length > 0) {
        Object.assign(user, updates);
        await this.authRepository.saveUser(user);
      }
    }

    if (!user.isActive) {
      throw new AppError('auth.accountDisabled', 401);
    }

    const accessToken = this.tokenSigner.signAccessToken({ id: user.id, role: user.role });
    const refreshToken = this.tokenSigner.signRefreshToken({ id: user.id });

    return { token: accessToken, refreshToken, user };
  }

  // Đăng xuất — blacklist access token jti + revoke refresh token family.
  async logout({ accessToken, refreshToken }) {
    // Blacklist access token
    if (accessToken) {
      try {
        const decoded = this.tokenSigner.verifyAccessToken(accessToken);
        if (decoded.jti && decoded.exp) {
          const remainingTTL = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingTTL > 0 && this.blacklistStore) {
            await this.blacklistStore.set(`bl:${decoded.jti}`, remainingTTL, '1');
          }
        }
      } catch (_) {
        // Token đã expired hoặc invalid — bỏ qua
      }
    }

    // Revoke refresh token family
    if (refreshToken && this.blacklistStore) {
      try {
        const decoded = this.tokenSigner.verifyRefreshToken(refreshToken);
        if (decoded.familyId) {
          const ttl = this._refreshTtlSeconds();
          await this.blacklistStore.set(`rt_family_revoked:${decoded.familyId}`, ttl, '1');
        }
      } catch (_) {
        // Refresh token expired/invalid — bỏ qua
      }
    }
  }

  // Xác thực email bằng OTP
  async verifyOtp({ email, otp }) {
    if (!email || !otp) {
      throw new AppError('auth.emailAndOtpRequired', 400);
    }

    const user = await this.authRepository.findByEmail(email);
    // Generic message cho cả user không tồn tại, đã xác thực, OTP sai — chống enumeration
    const genericError = 'auth.otpInvalidOrExpired';

    if (!user || user.isEmailVerified) {
      throw new AppError(genericError, 400);
    }

    const otpStr = String(otp).padStart(6, '0');
    const storedOtp = String(user.otpCode || '').padStart(6, '0');
    if (!user.otpCode || otpStr.length !== storedOtp.length ||
        !crypto.timingSafeEqual(Buffer.from(otpStr), Buffer.from(storedOtp))) {
      throw new AppError(genericError, 400);
    }

    if (!user.otpExpires || new Date() > user.otpExpires) {
      throw new AppError('auth.otpExpired', 400);
    }

    user.isEmailVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    await this.authRepository.saveUser(user);

    return { message: 'auth.emailVerified' };
  }

  // Gửi lại OTP — reset OTP mới hết hạn 10 phút.
  async resendVerification({ email }) {
    const genericMessage = 'auth.resendGeneric';
    const user = await this.authRepository.findByEmail(email);
    if (!user || user.isEmailVerified) {
      return { message: genericMessage };
    }

    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await this.authRepository.saveUser(user);

    try {
      await this.emailGateway.sendOtpEmail(user.email, otpCode);
    } catch (emailErr) {
      this.logger.error(`[Auth] Gửi lại OTP email thất bại cho ${user.email}: ${emailErr.message}`);
    }

    return { message: 'auth.otpResent' };
  }

  _refreshTtlSeconds() {
    const raw = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    const match = raw.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 3600;
    const n = parseInt(match[1], 10);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
    return n * unit;
  }

  // Làm mới access token bằng refresh token — rotation + reuse detection
  async refreshToken({ refreshToken }) {
    if (!refreshToken) {
      throw new AppError('auth.refreshTokenRequired', 401);
    }

    let decoded;
    try {
      decoded = this.tokenSigner.verifyRefreshToken(refreshToken);
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        throw new AppError('auth.refreshTokenInvalid', 401);
      }
      throw err;
    }

    const { id, jti, familyId } = decoded;
    const ttl = this._refreshTtlSeconds();

    // Reuse detection: token đã bị rotate trước đó → có thể bị đánh cắp
    if (jti && familyId && this.blacklistStore) {
      const alreadyUsed = await this.blacklistStore.get(`rt_used:${jti}`);
      if (alreadyUsed) {
        // Revoke toàn bộ family — tất cả devices/tabs sẽ bị logout
        await this.blacklistStore.set(`rt_family_revoked:${familyId}`, ttl, '1');
        this.logger.warn(`[Auth] Refresh token reuse detected — family ${familyId} revoked`);
        throw new AppError('auth.refreshTokenUsed', 401);
      }

      const familyRevoked = await this.blacklistStore.get(`rt_family_revoked:${familyId}`);
      if (familyRevoked) {
        throw new AppError('auth.sessionRevoked', 401);
      }
    }

    const user = await this.authRepository.findById(id);
    if (!user) {
      throw new AppError('auth.refreshTokenError', 401);
    }

    if (!user.isActive) {
      throw new AppError('auth.accountDisabled', 401);
    }

    // Đánh dấu token cũ đã dùng (rotation)
    if (jti && this.blacklistStore) {
      await this.blacklistStore.set(`rt_used:${jti}`, ttl, familyId || '1');
    }

    const token = this.tokenSigner.signAccessToken({ id: user.id, role: user.role });
    const newRefreshToken = this.tokenSigner.signRefreshToken({ id: user.id, familyId });
    return { token, refreshToken: newRefreshToken };
  }

  // Quên mật khẩu — luôn trả cùng response để chống user enumeration.
  async forgotPassword({ email }) {
    const user = await this.authRepository.findByEmail(email);
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpires = resetTokenExpires;
      await this.authRepository.saveUser(user);

      try {
        await this.emailGateway.sendResetPasswordEmail(user.email, resetToken);
      } catch (emailErr) {
        this.logger.error(`[Auth] Gửi reset password email thất bại cho ${user.email}: ${emailErr.message}`);
      }
    }

    return { message: 'auth.passwordResetSent' };
  }

  // Đặt lại mật khẩu bằng token
  async resetPassword({ token, password }) {
    const user = await this.authRepository.findByResetToken(token);

    if (!user) {
      throw new AppError('auth.tokenInvalidOrExpired', 400);
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.authRepository.saveUser(user);

    // Invalidate mọi token cũ — dùng blacklistStore adapter (wrap Redis)
    try {
      if (this.blacklistStore) {
        const nowSec = Math.floor(Date.now() / 1000);
        await this.blacklistStore.set(`pw_changed:${user.id}`, 30 * 24 * 3600, String(nowSec));
      }
    } catch (err) {
      this.logger.warn('Không thể set pw_changed key trong Redis:', err.message);
    }

    return { message: 'auth.passwordResetSuccess' };
  }

  // Lấy thông tin user hiện tại (kèm addresses)
  async getCurrentUser({ userId }) {
    const user = await this.authRepository.findByIdWithAddresses(userId);
    if (!user) {
      throw new AppError('auth.userNotFound', 404);
    }
    return { user };
  }
}

module.exports = AuthService;
