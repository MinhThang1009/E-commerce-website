const rateLimit = require('express-rate-limit');

// Rate limiter chung cho API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // giới hạn mỗi IP tối đa 100 request trong khoảng thời gian windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.',
  },
});

// Rate limiter cho các endpoint xác thực (nghiêm ngặt hơn)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 giờ
  max: 10, // giới hạn mỗi IP tối đa 10 request trong khoảng thời gian windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
};
