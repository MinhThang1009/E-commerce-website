const { AppError } = require('./errorHandler');

// Middleware phân quyền người dùng dựa theo role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('Bạn không có quyền thực hiện hành động này', 403)
      );
    }

    next();
  };
};

module.exports = {
  authorize,
};
