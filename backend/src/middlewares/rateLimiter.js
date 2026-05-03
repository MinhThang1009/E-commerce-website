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

// Rate limiter riêng cho OTP/password-reset (chống brute force)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body.email || req.ip,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.',
  },
});

// Rate limiter riêng cho chatbot (chống spam API key)
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu chatbot, vui lòng thử lại sau.',
  },
});

// Rate limiter cho chat history — chống brute-force enumeration sessionId
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 phút
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.',
  },
});

module.exports = {
  apiLimiter,
  authLimiter,
  otpLimiter,
  chatbotLimiter,
  chatLimiter,
};
