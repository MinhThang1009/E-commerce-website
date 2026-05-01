const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email/emailService');
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { Op } = require('sequelize');
const crypto = require('crypto');
const axios = require('axios');

// Register a new user
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('Email đã được sử dụng', 400);
    }

    // Generate 6-digit OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      otpCode,
      otpExpires,
    });

    // Send OTP email
    await emailService.sendOtpEmail(user.email, otpCode);

    res.status(201).json({
      status: 'success',
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để lấy mã OTP xác thực.',
    });
  } catch (error) {
    next(error);
  }
};

// Login user
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Check password first
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không đúng', 401);
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new AppError('Vui lòng xác thực email trước khi đăng nhập', 401);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Generate refresh token
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

// Google Login
const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;

    // Verify Google Token
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

    // Find or Create user
    let user = await User.findOne({
      where: {
        [Op.or]: [{ googleId }, { email }]
      }
    });

    if (!user) {
      // Create new user if not exists
      user = await User.create({
        googleId,
        email,
        firstName: firstName || 'Google',
        lastName: lastName || 'User',
        avatar,
        isEmailVerified: true,
      });
    } else {
      // If user exists but googleId is not linked, link it
      const updates = {};
      if (!user.googleId) updates.googleId = googleId;
      if (!user.avatar) updates.avatar = avatar;
      if (!user.isEmailVerified) updates.isEmailVerified = true;

      if (Object.keys(updates).length > 0) {
        await user.update(updates);
      }
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    // Generate JWT token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // Generate refresh token
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

// Logout user
const logout = async (req, res, next) => {
  try {
    // In a real implementation, you might want to invalidate the token
    // by adding it to a blacklist or using Redis to store invalidated tokens

    // For now, we'll just return a 204 No Content response
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Verify email with OTP
const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      throw new AppError('Email và mã OTP là bắt buộc', 400);
    }

    // Find user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    if (user.isEmailVerified) {
      throw new AppError('Email đã được xác thực trước đó', 400);
    }

    // Check OTP
    if (!user.otpCode || user.otpCode !== String(otp)) {
      throw new AppError('Mã OTP không đúng', 400);
    }

    // Check expiry
    if (!user.otpExpires || new Date() > user.otpExpires) {
      throw new AppError('Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.', 400);
    }

    // Verify user
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

// Resend OTP verification email
const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      throw new AppError('Email đã được xác thực', 400);
    }

    // Generate new OTP
    const otpCode = String(Math.floor(100000 + Math.random() * 900000));
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Update user
    user.otpCode = otpCode;
    user.otpExpires = otpExpires;
    await user.save();

    // Send OTP email
    await emailService.sendOtpEmail(user.email, otpCode);

    res.status(200).json({
      status: 'success',
      message: 'Đã gửi lại mã OTP. Vui lòng kiểm tra email của bạn.',
    });
  } catch (error) {
    next(error);
  }
};

// Refresh token
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token là bắt buộc', 401);
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Find user
    const user = await User.findByPk(decoded.id);
    if (!user) {
      throw new AppError('Refresh token không hợp lệ', 401);
    }

    // Check if account is active
    if (!user.isActive) {
      throw new AppError(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
        401
      );
    }

    // Generate new access token
    const token = jwt.sign(
      { id: user.id, role: user.role },
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

// Forgot password
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new AppError('Không tìm thấy tài khoản với email này', 404);
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = Date.now() + 3600000; // 1 hour

    // Update user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(resetTokenExpires);
    await user.save();

    // Send reset password email
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


// Reset password
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    console.log(password);

    // Find user with token
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      // Add debugging logs to help identify the issue
      console.log('Token:', token);
      const debugUser = await User.findOne({
        where: { resetPasswordToken: token }
      });
      if (debugUser) {
        console.log('Found user with token but expired:', {
          resetPasswordExpires: debugUser.resetPasswordExpires,
          currentDate: new Date(),
          isExpired: debugUser.resetPasswordExpires < new Date()
        });
      } else {
        console.log('No user found with the provided token');
      }

      throw new AppError('Token không hợp lệ hoặc đã hết hạn', 400);
    }

    // Update user
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

// Get current user
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
