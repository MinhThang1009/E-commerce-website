const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { AppError } = require('./errorHandler');
const { getRedisClient } = require('../config/redis');

// Middleware xác thực người dùng
const authenticate = async (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
    }

    const token = authHeader.split(' ')[1];

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kiểm tra token có trong blacklist không
    if (decoded.jti) {
      const redis = await getRedisClient();
      if (redis) {
        const isBlacklisted = await redis.get(`bl:${decoded.jti}`);
        if (isBlacklisted) {
          return next(new AppError('Token is invalid', 401));
        }
      }
    }

    // Tìm người dùng
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return next(new AppError('Người dùng không tồn tại', 401));
    }

    // Kiểm tra tài khoản có đang hoạt động không
    if (!user.isActive) {
      return next(
        new AppError(
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
          401
        )
      );
    }

    // Kiểm tra email đã được xác thực chưa
    if (!user.isEmailVerified) {
      return next(
        new AppError('Vui lòng xác thực email trước khi tiếp tục', 401)
      );
    }

    // Gán thông tin người dùng vào request
    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      return next(
        new AppError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại', 401)
      );
    }
    next(error);
  }
};

// Middleware xác thực tùy chọn (dùng cho chức năng giỏ hàng)
const optionalAuthenticate = async (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Tiếp tục mà không cần xác thực
    }

    const token = authHeader.split(' ')[1];

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm người dùng
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return next(); // Không tìm thấy user, tiếp tục với tư cách khách
    }

    // Kiểm tra tài khoản có hoạt động không — nếu không, trả về lỗi thay vì tiếp tục với tư cách khách
    if (!user.isActive) {
      return next(
        new AppError(
          'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên',
          401
        )
      );
    }

    // Kiểm tra email đã được xác thực chưa
    if (!user.isEmailVerified) {
      return next(
        new AppError('Vui lòng xác thực email trước khi tiếp tục', 401)
      );
    }

    // Gán thông tin người dùng vào request
    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === 'JsonWebTokenError' ||
      error.name === 'TokenExpiredError'
    ) {
      // Token không hợp lệ hoặc đã hết hạn, tiếp tục với tư cách khách
      return next();
    }
    next(error);
  }
};

module.exports = {
  authenticate,
  optionalAuthenticate,
};
