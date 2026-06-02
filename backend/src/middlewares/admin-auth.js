/**
 * @file adminAuth.js
 * @layer Middleware
 * @module global
 * @description Express middleware: adminAuth
 */
const logger = require('@utils/logger');
const jwt = require('jsonwebtoken');
const { User } = require('@models');
const { AppError } = require('@middlewares/error-handler');

// Các role được phép truy cập trang quản trị (back-office)
const BACKOFFICE_ROLES = ['admin', 'staff'];

/**
 * Middleware xác thực cho trang quản trị (back-office)
 * Kiểm tra token, user tồn tại và có role back-office (admin hoặc staff).
 * Phân quyền chi tiết theo từng route dùng requireRole().
 */
const adminAuthenticate = async (req, res, next) => {
  try {
    // Lấy token từ header
    const authHeader = req.headers.authorization;
    logger.info(`[AUTH] adminAuthenticate: hasHeader=${!!authHeader}`);
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Cần token xác thực để truy cập admin panel', 401));
    }

    const token = authHeader.split(' ')[1];

    // Xác thực token
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });

    // Tìm người dùng
    const user = await User.findByPk(decoded.id);
    if (!user) {
      return next(new AppError('Người dùng không tồn tại', 401));
    }

    // Cho phép back-office vào panel: admin (quản trị hệ thống) + staff (nhân viên bán hàng)
    if (!BACKOFFICE_ROLES.includes(user.role)) {
      return next(new AppError('Bạn không có quyền truy cập trang quản trị', 403));
    }

    // Kiểm tra email đã được xác thực chưa
    if (!user.isEmailVerified) {
      return next(new AppError('Vui lòng xác thực email trước khi truy cập admin panel', 401));
    }

    // Gán thông tin người dùng vào request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return next(new AppError('Token không hợp lệ hoặc đã hết hạn', 401));
    }
    next(error);
  }
};

/**
 * Factory tạo middleware giới hạn theo role cụ thể (dùng SAU adminAuthenticate).
 * Ví dụ: requireRole('staff') — chỉ nhân viên bán hàng; requireRole('admin','staff') — cả hai.
 * @param {...('admin'|'staff')} roles - các role được phép
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Bạn không có quyền thực hiện hành động này', 403));
    }
    next();
  };
};

// Chỉ admin (quản trị hệ thống) — dùng cho quản lý người dùng, phân quyền
const requireSuperAdmin = requireRole('admin');

module.exports = {
  adminAuthenticate,
  requireRole,
  requireSuperAdmin,
  BACKOFFICE_ROLES,
};
