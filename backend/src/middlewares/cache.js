const { getRedisClient } = require('../config/redis');
const logger = require('../utils/logger');

// Cache middleware dạng cache-aside — dùng cho GET endpoints công khai
// Monkey-patch res.json để tự động cache response khi status = 200
const cacheMiddleware = (ttlSeconds, keyFn) => async (req, res, next) => {
  try {
    const redis = await getRedisClient();
    const key = keyFn ? keyFn(req) : `cache:${req.originalUrl}`;

    const cached = await redis.get(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cached));
    }

    // Lưu lại res.json gốc, monkey-patch để cache response trước khi trả về
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        // fire-and-forget: res.json phải return đồng bộ, cache write chạy nền
        redis.setEx(key, ttlSeconds, JSON.stringify(data)).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    next();
  } catch {
    // Redis lỗi → bỏ qua cache, xử lý request bình thường
    next();
  }
};

// Xóa tất cả cache keys khớp pattern (dùng glob wildcard *)
const invalidateCache = async (pattern) => {
  try {
    const redis = await getRedisClient();
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await Promise.all(keys.map(k => redis.del(k)));
  } catch (err) {
    logger.warn('invalidateCache thất bại:', err.message);
  }
};

// Middleware thêm HTTP Cache-Control headers cho GET requests
const httpCacheHeaders = (maxAgeSeconds, options = {}) => (req, res, next) => {
  if (req.method === 'GET') {
    if (options.noStore) {
      res.setHeader('Cache-Control', 'private, no-store');
    } else if (options.private) {
      res.setHeader('Cache-Control', `private, max-age=${maxAgeSeconds}`);
    } else {
      res.setHeader(
        'Cache-Control',
        `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`
      );
    }
  }
  next();
};

module.exports = { cacheMiddleware, invalidateCache, httpCacheHeaders };
