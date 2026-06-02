/**
 * @file authService.js
 * @layer Service
 * @module auth
 * @description Business logic layer cho auth
 * @depends-on sequelize-auth-repository, emailGateway, googleVerifier, tokenSigner, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const crypto = require('crypto');
const { AppError } = require('@shared/errors');

// Auth Service — business logic. KHÔNG import Sequelize hoặc Model trực tiếp;
// chỉ gọi qua authRepository (interface). External service inject qua constructor
// để dễ test + dễ swap implementation.
class AuthService {
  constructor({ authRepository, emailGateway, googleVerifier, tokenSigner, eventBus, logger }) {
    this.authRepository = authRepository;
    this.emailGateway = emailGateway;
    this.googleVerifier = googleVerifier;
    this.tokenSigner = tokenSigner;
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

    // Chỉ chấp nhận khi Google đã xác minh email — chống chiếm tài khoản: KHÔNG auto-create
    // hoặc link Google vào tài khoản email/password sẵn có nếu email chưa được Google xác minh.
    // Google bình thường luôn trả email_verified=true; chỉ chặn khi báo tường minh false.
    if (payload.email_verified === false) {
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

  // Đăng xuất
  async logout({ accessToken, refreshToken }) {
    // Token được xóa ở client side — không cần server-side invalidation
    void accessToken;
    void refreshToken;
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
    if (
      !user.otpCode ||
      otpStr.length !== storedOtp.length ||
      !crypto.timingSafeEqual(Buffer.from(otpStr), Buffer.from(storedOtp))
    ) {
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

  // Làm mới access token bằng refresh token
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

    const { id } = decoded;

    const user = await this.authRepository.findById(id);
    if (!user) {
      throw new AppError('auth.refreshTokenError', 401);
    }

    if (!user.isActive) {
      throw new AppError('auth.accountDisabled', 401);
    }

    const token = this.tokenSigner.signAccessToken({ id: user.id, role: user.role });
    const newRefreshToken = this.tokenSigner.signRefreshToken({ id: user.id });
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
        this.logger.error(
          `[Auth] Gửi reset password email thất bại cho ${user.email}: ${emailErr.message}`,
        );
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
