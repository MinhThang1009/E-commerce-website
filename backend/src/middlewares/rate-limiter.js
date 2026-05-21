/**
 * @file rateLimiter.js
 * @layer Middleware
 * @module global
 * @description Express middleware: rateLimiter
 */
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('@config/redis');
const logger = require('@utils/logger');

// Store proxy: bắt đầu với in-memory, tự nâng cấp lên Redis khi kết nối thành công
// express-rate-limit gọi store.increment() khi request đến — ProxyStore ủy quyền
// cho RedisStore nếu Redis khả dụng, ngược lại dùng in-memory Map
class ProxyStore {
  constructor() {
    this._hits = new Map();
    this._redisStore = null;
    this._windowMs = 60000;
  }

  init(options) {
    this._windowMs = options.windowMs || 60000;
  }

  useRedis(store) {
    this._redisStore = store;
  }

  async increment(key) {
    if (this._redisStore) {
      try {
        return await this._redisStore.increment(key);
      } catch {
        /* fallback */
      }
    }
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
    if (this._redisStore) {
      try {
        return await this._redisStore.decrement(key);
      } catch {
        /* fallback */
      }
    }
    const rec = this._hits.get(key);
    if (rec) rec.totalHits = Math.max(0, rec.totalHits - 1);
  }

  async resetKey(key) {
    this._hits.delete(key);
    if (this._redisStore) {
      try {
        await this._redisStore.resetKey(key);
      } catch {
        /* bỏ qua */
      }
    }
  }

  async resetAll() {
    this._hits.clear();
    if (this._redisStore) {
      try {
        await this._redisStore.resetAll?.();
      } catch {
        /* bỏ qua */
      }
    }
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

// Nâng cấp tất cả proxy stores lên Redis khi kết nối thành công (async, non-blocking)
getRedisClient()
  .then((client) => {
    if (typeof client.sendCommand === 'function') {
      Object.entries(PROXY_STORES).forEach(([prefix, proxy]) => {
        proxy.useRedis(
          new RedisStore({
            sendCommand: (...args) => client.sendCommand(args),
            prefix: `rl:${prefix}:`,
          }),
        );
      });
      logger.info('[RateLimiter] Đã nâng cấp lên Redis store — counter persist qua restart');
    }
  })
  .catch(() => {
    logger.info('[RateLimiter] Sử dụng memory store (Redis không khả dụng)');
  });

module.exports = {
  apiLimiter,
  authLimiter,
  otpLimiter,
  chatbotLimiter,
  chatLimiter,
};
