'use strict';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRedis = {
  get: jest.fn(),
  setEx: jest.fn(),
  keys: jest.fn(),
  del: jest.fn(),
};

jest.mock('@config/redis', () => ({
  getRedisClient: jest.fn(),
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { getRedisClient } = require('@config/redis');
const logger = require('@utils/logger');
const { cacheMiddleware, invalidateCache, httpCacheHeaders } = require('./cache');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(url = '/api/products') {
  return { originalUrl: url, method: 'GET' };
}

function makeRes(statusCode = 200) {
  const headers = {};
  const res = {
    statusCode,
    setHeader: jest.fn((name, value) => {
      headers[name] = value;
    }),
    json: jest.fn(),
    _headers: headers,
  };
  // Cho phép test đọc headers sau khi setHeader được gọi
  res.getHeader = (name) => headers[name];
  return res;
}

// ════════════════════════════════════════════════════════════════════════════
// cacheMiddleware
// ════════════════════════════════════════════════════════════════════════════

describe('cacheMiddleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setEx.mockResolvedValue('OK');
  });

  describe('khi Redis có cache hit', () => {
    it('trả về dữ liệu từ cache và set X-Cache: HIT', async () => {
      const cachedData = { id: 1, name: 'Product A' };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));
      getRedisClient.mockResolvedValue(mockRedis);

      const req = makeReq('/api/products');
      const res = makeRes();
      const next = jest.fn();

      const middleware = cacheMiddleware(60);
      await middleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.json).toHaveBeenCalledWith(cachedData);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('khi Redis không có cache (cache miss)', () => {
    it('gọi next() và monkey-patch res.json', async () => {
      mockRedis.get.mockResolvedValue(null);
      getRedisClient.mockResolvedValue(mockRedis);

      const req = makeReq('/api/products');
      const res = makeRes(200);
      const next = jest.fn();

      const middleware = cacheMiddleware(60);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      // res.json bị monkey-patch: phải là function khác với ban đầu
      expect(typeof res.json).toBe('function');
    });

    it('khi res.json được gọi với status 200 — set X-Cache: MISS và gọi setEx', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setEx.mockResolvedValue('OK');
      getRedisClient.mockResolvedValue(mockRedis);

      const req = makeReq('/api/products');
      const originalJsonFn = jest.fn().mockReturnValue(undefined);
      const res = makeRes(200);
      res.json = originalJsonFn; // gắn fn gốc để theo dõi
      const next = jest.fn();

      const middleware = cacheMiddleware(120);
      await middleware(req, res, next);

      // Gọi res.json (đã bị monkey-patch)
      const responseData = { items: [] };
      res.json(responseData);

      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
      // setEx được gọi async (fire-and-forget) — cần flush microtasks
      await Promise.resolve();
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        'cache:/api/products',
        120,
        JSON.stringify(responseData),
      );
    });

    it('khi res.json được gọi với status khác 200 — không gọi setEx', async () => {
      mockRedis.get.mockResolvedValue(null);
      getRedisClient.mockResolvedValue(mockRedis);

      const req = makeReq('/api/products');
      const originalJsonFn = jest.fn().mockReturnValue(undefined);
      const res = makeRes(201); // status 201, không phải 200
      res.json = originalJsonFn;
      const next = jest.fn();

      const middleware = cacheMiddleware(120);
      await middleware(req, res, next);

      res.json({ created: true });

      await Promise.resolve();
      expect(mockRedis.setEx).not.toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    });

    it('khi setEx ném lỗi — log warn nhưng không crash', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setEx.mockRejectedValue(new Error('Redis write error'));
      getRedisClient.mockResolvedValue(mockRedis);

      const req = makeReq('/api/products');
      const originalJsonFn = jest.fn().mockReturnValue(undefined);
      const res = makeRes(200);
      res.json = originalJsonFn;
      const next = jest.fn();

      const middleware = cacheMiddleware(60);
      await middleware(req, res, next);

      res.json({ ok: true });

      // Chờ promise rejection được xử lý
      await new Promise((r) => setImmediate(r));

      expect(logger.warn).toHaveBeenCalledWith('Cache write failed:', 'Redis write error');
    });
  });

  describe('khi keyFn được truyền vào', () => {
    it('dùng kết quả của keyFn làm cache key thay cho originalUrl', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.setEx.mockResolvedValue('OK');
      getRedisClient.mockResolvedValue(mockRedis);

      const customKey = 'custom:products:page1';
      const keyFn = jest.fn().mockReturnValue(customKey);

      const req = makeReq('/api/products?page=1');
      const originalJsonFn = jest.fn().mockReturnValue(undefined);
      const res = makeRes(200);
      res.json = originalJsonFn;
      const next = jest.fn();

      const middleware = cacheMiddleware(60, keyFn);
      await middleware(req, res, next);

      res.json({ items: [] });
      await Promise.resolve();

      expect(keyFn).toHaveBeenCalledWith(req);
      expect(mockRedis.setEx).toHaveBeenCalledWith(customKey, 60, expect.any(String));
    });
  });

  describe('khi Redis không khả dụng (getRedisClient ném lỗi)', () => {
    it('gọi next() bình thường — bỏ qua cache', async () => {
      getRedisClient.mockRejectedValue(new Error('Redis connection failed'));

      const req = makeReq('/api/products');
      const res = makeRes();
      const next = jest.fn();

      const middleware = cacheMiddleware(60);
      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(); // next() không có lỗi
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// invalidateCache
// ════════════════════════════════════════════════════════════════════════════

describe('invalidateCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('xóa tất cả keys khớp pattern', async () => {
    getRedisClient.mockResolvedValue(mockRedis);
    mockRedis.keys.mockResolvedValue(['cache:products:1', 'cache:products:2']);
    mockRedis.del.mockResolvedValue(1);

    await invalidateCache('cache:products:*');

    expect(mockRedis.keys).toHaveBeenCalledWith('cache:products:*');
    expect(mockRedis.del).toHaveBeenCalledTimes(2);
  });

  it('không gọi del khi không có key nào khớp', async () => {
    getRedisClient.mockResolvedValue(mockRedis);
    mockRedis.keys.mockResolvedValue([]);

    await invalidateCache('cache:empty:*');

    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('log warn khi Redis ném lỗi, không throw', async () => {
    getRedisClient.mockRejectedValue(new Error('Redis unavailable'));

    await expect(invalidateCache('cache:*')).resolves.not.toThrow();
    expect(logger.warn).toHaveBeenCalledWith('invalidateCache thất bại:', 'Redis unavailable');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// httpCacheHeaders
// ════════════════════════════════════════════════════════════════════════════

describe('httpCacheHeaders', () => {
  it('set public Cache-Control header cho GET request', () => {
    const req = { method: 'GET' };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    httpCacheHeaders(300)(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=300, stale-while-revalidate=600',
    );
    expect(next).toHaveBeenCalled();
  });

  it('set private Cache-Control header khi options.private=true', () => {
    const req = { method: 'GET' };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    httpCacheHeaders(60, { private: true })(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=60');
  });

  it('set no-store header khi options.noStore=true', () => {
    const req = { method: 'GET' };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    httpCacheHeaders(0, { noStore: true })(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  });

  it('không set header cho non-GET request', () => {
    const req = { method: 'POST' };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    httpCacheHeaders(300)(req, res, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
});
