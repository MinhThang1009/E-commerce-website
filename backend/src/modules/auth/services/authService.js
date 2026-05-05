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
      throw new AppError('Email đã được sử dụng', 400);
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

    return { message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.' };
  }

  // Đăng nhập email + password
  async login({ email, password, ip }) {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    if (!user.isEmailVerified) {
      throw new AppError('Vui lòng xác thực email trước khi đăng nhập', 401);
    }

    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
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
        throw new AppError('Xác thực Google thất bại', 401);
      }
    }

    if (!payload) {
      throw new AppError('Xác thực Google thất bại', 401);
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
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    const accessToken = this.tokenSigner.signAccessToken({ id: user.id, role: user.role });
    const refreshToken = this.tokenSigner.signRefreshToken({ id: user.id });

    return { token: accessToken, refreshToken, user };
  }

  // Đăng xuất — blacklist jti của access token đến khi expire.
  async logout({ accessToken }) {
    if (!accessToken) return;

    let decoded;
    try {
      decoded = this.tokenSigner.verifyAccessToken(accessToken);
    } catch (_) {
      // Token đã expired hoặc invalid — không cần blacklist
      return;
    }

    if (!decoded.jti || !decoded.exp) return;

    const remainingTTL = decoded.exp - Math.floor(Date.now() / 1000);
    if (remainingTTL > 0 && this.blacklistStore) {
      await this.blacklistStore.set(`bl:${decoded.jti}`, remainingTTL, '1');
    }
  }

  // Xác thực email bằng OTP
  async verifyOtp({ email, otp }) {
    if (!email || !otp) {
      throw new AppError('Email và mã OTP là bắt buộc', 400);
    }

    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email đã được xác thực trước đó', 400);
    }

    if (!user.otpCode || user.otpCode !== String(otp)) {
      throw new AppError('Mã OTP không đúng', 400);
    }

    if (!user.otpExpires || new Date() > user.otpExpires) {
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.', 400);
    }

    user.isEmailVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    await this.authRepository.saveUser(user);

    return { message: 'Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.' };
  }

  // Gửi lại OTP — reset OTP mới hết hạn 10 phút.
  async resendVerification({ email }) {
    const user = await this.authRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email đã được xác thực', 400);
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

    return { message: 'Đã gửi lại mã OTP. Vui lòng kiểm tra email của bạn.' };
  }

  // Làm mới access token bằng refresh token
  async refreshToken({ refreshToken }) {
    if (!refreshToken) {
      throw new AppError('Refresh token là bắt buộc', 401);
    }

    let decoded;
    try {
      decoded = this.tokenSigner.verifyRefreshToken(refreshToken);
    } catch (err) {
      if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
        throw new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401);
      }
      throw err;
    }

    const user = await this.authRepository.findById(decoded.id);
    if (!user) {
      throw new AppError('Refresh token không hợp lệ', 401);
    }

    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    const token = this.tokenSigner.signAccessToken({ id: user.id, role: user.role });
    return { token };
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

    return { message: 'Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra email của bạn.' };
  }

  // Đặt lại mật khẩu bằng token
  async resetPassword({ token, password }) {
    const user = await this.authRepository.findByResetToken(token);

    if (!user) {
      throw new AppError('Token không hợp lệ hoặc đã hết hạn', 400);
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await this.authRepository.saveUser(user);

    return { message: 'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ.' };
  }

  // Lấy thông tin user hiện tại (kèm addresses)
  async getCurrentUser({ userId }) {
    const user = await this.authRepository.findByIdWithAddresses(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }
    return { user };
  }
}

module.exports = AuthService;
