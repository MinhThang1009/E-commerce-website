const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { User } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { Op } = require('sequelize');
const crypto = require('crypto');
const axios = require('axios');
const { getRedisClient } = require('../config/redis');

// Đăng ký người dùng mới
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Kiểm tra email đã tồn tại chưa
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('Email đã được sử dụng', 400);
    }

    // Tạo mã OTP 6 chữ số, hết hạn sau 10 phút
    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Tạo người dùng mới
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      otpCode,
      otpExpires,
    });

    // Gửi email chứa mã OTP
    await emailService.sendOtpEmail(user.email, otpCode);

    res.status(201).json({
      status: 'success',
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.',
    });
  } catch (error) {
    next(error);
  }
};

// Đăng nhập
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Tìm user theo email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Kiểm tra mật khẩu trước
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Kiểm tra email đã xác thực chưa
    if (!user.isEmailVerified) {
      throw new AppError('Vui lòng xác thực email trước khi đăng nhập', 401);
    }

    // Kiểm tra tài khoản có đang hoạt động không
    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    // Tạo JWT access token
    const token = jwt.sign(
      { id: user.id, role: user.role, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Tạo refresh token
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );

    res.status(200).json({
      status: 'success',
      token,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// Đăng nhập bằng Google
const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;

    // Xác thực Google token
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (e) {
      try {
        const userInfoResponse = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
        payload = userInfoResponse.data;
      } catch (err) {
        throw new AppError('Xác thực Google thất bại', 401);
      }
    }

    if (!payload) {
      throw new AppError('Xác thực Google thất bại', 401);
    }

    const { sub: googleId, email, given_name: firstName, family_name: lastName, picture: avatar } = payload;

    // Tìm hoặc tạo người dùng
    let user = await User.findOne({
      where: {
        [Op.or]: [{ googleId }, { email }]
      }
    });

    if (!user) {
      // Tạo người dùng mới nếu chưa tồn tại
      user = await User.create({
        googleId,
        email,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        avatar,
        isEmailVerified: true,
      });
    } else {
      // Nếu user tồn tại nhưng chưa liên kết googleId, liên kết ngay
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar) updates.avatar = avatar;
      if (!user.isEmailVerified) updates.isEmailVerified = true;

      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    }

    // Kiểm tra tài khoản có đang hoạt động không
    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    // Tạo JWT access token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Tạo refresh token
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN }
    );

    res.status(200).json({
      status: 'success',
      token: accessToken,
      refreshToken,
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// Đăng xuất
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded.jti && decoded.exp) {
          const remainingTTL = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingTTL > 0) {
            const redis = await getRedisClient();
            if (redis) {
              await redis.setEx(`bl:${decoded.jti}`, remainingTTL, '1');
            }
          }
        }
      } catch (_) {
        // token already expired or invalid — no need to blacklist
      }
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Xác thực email bằng OTP
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new AppError('Email và mã OTP là bắt buộc', 400);
    }

    // Tìm user theo email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email đã được xác thực trước đó', 400);
    }

    // Kiểm tra mã OTP
    if (!user.otpCode || user.otpCode !== String(otp)) {
      throw new AppError('Mã OTP không đúng', 400);
    }

    // Kiểm tra hạn OTP
    if (!user.otpExpires || new Date() > user.otpExpires) {
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.', 400);
    }

    // Xác thực thành công — cập nhật trạng thái
    user.isEmailVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.',
    });
  } catch (error) {
    next(error);
  }
};

// Gửi lại email xác thực OTP
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Tìm user theo email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email đã được xác thực', 400);
    }

    // Tạo mã OTP mới, hết hạn sau 10 phút
    const otpCode = String(crypto.randomInt(100000, 1000000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    // Cập nhật user
    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // Gửi email chứa mã OTP
    await emailService.sendOtpEmail(user.email, otpCode);

    res.status(200).json({
      status: 'success',
      message: 'Đã gửi lại mã OTP. Vui lòng kiểm tra email của bạn.',
    });
  } catch (error) {
    next(error);
  }
};

// Làm mới access token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token là bắt buộc', 401);
    }

    // Xác thực refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Tìm user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      throw new AppError('Refresh token không hợp lệ', 401);
    }

    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    // Tạo access token mới
    const token = jwt.sign(
      { id: user.id, role: user.role, jti: crypto.randomUUID() },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({
      status: 'success',
      token,
    });
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return next(
        new AppError('Refresh token không hợp lệ hoặc đã hết hạn', 401)
      );
    }
    next(error);
  }
};

// Quên mật khẩu
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Tìm user theo email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    // Tạo token đặt lại mật khẩu, hết hạn sau 1 giờ
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = Date.now() + 3600000;

    // Lưu token vào database
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(resetTokenExpires);
    await user.save();

    // Gửi email đặt lại mật khẩu
    await emailService.sendResetPasswordEmail(user.email, resetToken);

    res.status(200).json({
      status: 'success',
      message:
        'Đã gửi email đặt lại mật khẩu. Vui lòng kiểm tra email của bạn.',
    });
  } catch (error) {
    next(error);
  }
};


// Đặt lại mật khẩu
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Tìm user theo token đặt lại mật khẩu
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      // Debug: kiểm tra lý do token không hợp lệ
      logger.info('Token:', token);
      const debugUser = await User.findOne({
        where: { resetPasswordToken: token }
      });
      if (debugUser) {
        logger.info('Tìm thấy user nhưng token đã hết hạn:', {
          resetPasswordExpires: debugUser.resetPasswordExpires,
          currentDate: new Date(),
          isExpired: debugUser.resetPasswordExpires < new Date()
        });
      } else {
        logger.info('Không tìm thấy user với token này');
      }

      throw new AppError('Token không hợp lệ hoặc đã hết hạn', 400);
    }

    // Cập nhật mật khẩu mới
    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({
      status: 'success',
      message:
        'Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay bây giờ.',
    });
  } catch (error) {
    next(error);
  }
};

// Lấy thông tin user hiện tại
const getCurrentUser = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          association: 'addresses',
          attributes: { exclude: ['userId'] },
        },
      ],
    });

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    res.status(200).json({
      status: 'success',
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  verifyOtp,
  resendVerification,
  refreshToken,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  googleLogin,
};
