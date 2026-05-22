/**
 * @file rateLimiter.js
 * @layer Middleware
 * @module global
 * @description Express middleware: rateLimiter
 */
const rateLimit = require('express-rate-limit');
const logger = require('@utils/logger');

// Rate limit store — express-rate-limit gọi store.increment() khi request đến
class ProxyStore {
  constructor() {
    this._hits = new Map();
    this._windowMs = 60000;
  }

  init(options) {
    this._windowMs = options.windowMs || 60000;
  }

  async increment(key) {
    const now = Date.now();
    let rec = this._hits.get(key);
    if (!rec || rec.resetTime.getTime() < now) {
      rec = { totalHits: 0, resetTime: new Date(now + this._windowMs) };
    }
    rec.totalHits++;
    this._hits.set(key, rec);
    return { totalHits: rec.totalHits, resetTime: rec.resetTime };
  }

  async decrement(key) {
    const rec = this._hits.get(key);
    if (rec) rec.totalHits = Math.max(0, rec.totalHits - 1);
  }

  async resetKey(key) {
    this._hits.delete(key);
  }

  async resetAll() {
    this._hits.clear();
  }
}

// Tạo proxy stores cho từng limiter
const PROXY_STORES = {
  api: new ProxyStore(),
  auth: new ProxyStore(),
  otp: new ProxyStore(),
  chatbot: new ProxyStore(),
  chat: new ProxyStore(),
};

// Rate limiter chung cho API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: PROXY_STORES.api,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau.',
  },
});

// Rate limiter cho các endpoint xác thực (nghiêm ngặt hơn)
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 100 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: PROXY_STORES.auth,
  message: {
    status: 'error',
    message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau.',
  },
  // Ghi business event log khi IP bị rate limit để monitoring brute force
  handler: (req, res, _next, options) => {
    logger.warn('[AUTH] Rate limited', { ip: req.ip, email: req.body?.email });
    res.status(options.statusCode).json(options.message);
  },
});

// Rate limiter riêng cho OTP/password-reset (chống brute force)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  store: PROXY_STORES.otp,
  keyGenerator: (req) => req.body.email || req.ip,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau 15 phút.',
  },
});

// Rate limiter riêng cho chatbot (chống spam API key)
const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: PROXY_STORES.chatbot,
  message: {
    status: 'error',
    message: 'Quá nhiều yêu cầu chatbot, vui lòng thử lại sau.',
  },
});

// Rate limiter cho chat history — chống brute-force enumeration sessionId
const chatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: PROXY_STORES.chat,
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
