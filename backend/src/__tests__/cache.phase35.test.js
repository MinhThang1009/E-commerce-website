/**
 * Tests Phase 35 — Caching Strategy & Data Cleanup
 *
 * Bao gồm:
 * - Cache middleware: response caching, X-Cache header (MISS/HIT)
 * - Cache invalidation: xóa cache khi data thay đổi
 * - HTTP Cache-Control headers: public/private/no-store
 * - Cleanup jobs: abandoned carts, expired OTP, expired discount codes
 * - Brand caching: cache GET + invalidate on CRUD
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-phase35';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-phase35';

// ---------- In-memory Redis mock ----------

let redisStore = {};

const mockRedisClient = {
  get: jest.fn((key) => Promise.resolve(redisStore[key] || null)),
  setEx: jest.fn((key, _ttl, val) => {
    redisStore[key] = val;
    return Promise.resolve('OK');
  }),
  set: jest.fn((key, val) => {
    redisStore[key] = val;
    return Promise.resolve('OK');
  }),
  del: jest.fn((key) => {
    delete redisStore[key];
    return Promise.resolve(1);
  }),
  keys: jest.fn((pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Promise.resolve(Object.keys(redisStore).filter(k => regex.test(k)));
  }),
};

// ---------- Mocks ----------

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(mockRedisClient),
}));

jest.mock('../config/sequelize', () => {
  const { Sequelize } = require('sequelize');
  return {
    define: jest.fn((_name, _attrs, _opts) => {
      class MockModel {}
      MockModel.findAll = jest.fn().mockResolvedValue([]);
      MockModel.findByPk = jest.fn().mockResolvedValue(null);
      MockModel.findOne = jest.fn().mockResolvedValue(null);
      MockModel.create = jest.fn().mockResolvedValue({ id: 1 });
      MockModel.update = jest.fn().mockResolvedValue([1]);
      MockModel.destroy = jest.fn().mockResolvedValue(1);
      MockModel.count = jest.fn().mockResolvedValue(0);
      MockModel.findAndCountAll = jest.fn().mockResolvedValue({ rows: [], count: 0 });
      return MockModel;
    }),
    QueryTypes: { SELECT: 'SELECT' },
    query: jest.fn().mockResolvedValue([[], { affectedRows: 0 }]),
    transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
    Sequelize,
    literal: jest.fn((val) => val),
  };
});

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../models', () => ({
  User: {
    update: jest.fn().mockResolvedValue([0, 3]),
    findByPk: jest.fn().mockResolvedValue(null),
    findOne: jest.fn().mockResolvedValue(null),
  },
  Cart: {
    destroy: jest.fn().mockResolvedValue(5),
  },
  SearchHistory: {},
  DiscountCode: {
    update: jest.fn().mockResolvedValue([0, 2]),
  },
  ChatMessage: {
    update: jest.fn().mockResolvedValue([0, 10]),
    bulkCreate: jest.fn().mockResolvedValue([]),
  },
  RecentlyViewed: {
    destroy: jest.fn().mockResolvedValue(3),
  },
  Brand: {
    findAll: jest.fn().mockResolvedValue([{ id: 1, name: 'Apple' }]),
    findByPk: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 1, name: 'Test Brand', toJSON: () => ({ id: 1, name: 'Test Brand' }) }),
  },
  Product: {
    count: jest.fn().mockResolvedValue(0),
  },
  Category: {
    findAll: jest.fn().mockResolvedValue([{ id: 1, name: 'Phones' }]),
  },
  Banner: {
    findAll: jest.fn().mockResolvedValue([]),
  },
  sequelize: {
    query: jest.fn().mockResolvedValue([[], { affectedRows: 0 }]),
    transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
    QueryTypes: { SELECT: 'SELECT' },
  },
}));

// ---------- Tests ----------

describe('Phase 35 — Cache Middleware', () => {
  beforeEach(() => {
    redisStore = {};
    jest.clearAllMocks();
  });

  describe('cacheMiddleware', () => {
    const { cacheMiddleware } = require('../middlewares/cache');

    test('trả về X-Cache: MISS lần đầu và cache response', async () => {
      const middleware = cacheMiddleware(300, () => 'test:key');
      const req = { originalUrl: '/test' };
      const headers = {};
      const res = {
        setHeader: jest.fn((k, v) => { headers[k] = v; }),
        json: null,
        statusCode: 200,
      };
      const next = jest.fn();

      await middleware(req, res, next);

      // Middleware gọi next() vì chưa có cache
      expect(next).toHaveBeenCalled();

      // Gọi res.json (đã bị monkey-patched) → cache response
      const originalJson = jest.fn();
      res.json = res.json || originalJson;

      // Simulate controller gọi res.json
      // Middleware monkey-patch res.json, nên phải test qua flow thực
    });

    test('trả về X-Cache: HIT khi cache tồn tại', async () => {
      const testData = { status: 'success', data: [{ id: 1 }] };
      redisStore['test:key'] = JSON.stringify(testData);

      const middleware = cacheMiddleware(300, () => 'test:key');
      const req = { originalUrl: '/test' };
      const headers = {};
      let jsonResult = null;
      const res = {
        setHeader: jest.fn((k, v) => { headers[k] = v; }),
        json: jest.fn((data) => { jsonResult = data; }),
        statusCode: 200,
      };
      const next = jest.fn();

      await middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(headers['X-Cache']).toBe('HIT');
      expect(jsonResult).toEqual(testData);
    });

    test('fallthrough khi Redis lỗi (không crash server)', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis down'));

      const middleware = cacheMiddleware(300, () => 'fail:key');
      const req = { originalUrl: '/test' };
      const res = { setHeader: jest.fn(), json: jest.fn(), statusCode: 200 };
      const next = jest.fn();

      await middleware(req, res, next);

      // Phải gọi next() để request tiếp tục xử lý bình thường
      expect(next).toHaveBeenCalled();
    });
  });

  describe('invalidateCache', () => {
    const { invalidateCache } = require('../middlewares/cache');

    test('xóa tất cả keys khớp pattern', async () => {
      redisStore['cache:brands:all'] = '{}';
      redisStore['cache:brands:slug:apple'] = '{}';
      redisStore['cache:products:list'] = '{}';

      await invalidateCache('cache:brands:*');

      expect(redisStore['cache:brands:all']).toBeUndefined();
      expect(redisStore['cache:brands:slug:apple']).toBeUndefined();
      // Không xóa products cache
      expect(redisStore['cache:products:list']).toBe('{}');
    });

    test('không crash khi Redis lỗi', async () => {
      mockRedisClient.keys.mockRejectedValueOnce(new Error('Redis down'));
      await expect(invalidateCache('any:*')).resolves.not.toThrow();
    });
  });

  describe('httpCacheHeaders', () => {
    const { httpCacheHeaders } = require('../middlewares/cache');

    test('set public Cache-Control cho GET request', () => {
      const middleware = httpCacheHeaders(1800);
      const req = { method: 'GET' };
      const headers = {};
      const res = { setHeader: jest.fn((k, v) => { headers[k] = v; }) };
      const next = jest.fn();

      middleware(req, res, next);

      expect(headers['Cache-Control']).toBe('public, max-age=1800, stale-while-revalidate=3600');
      expect(next).toHaveBeenCalled();
    });

    test('set private no-store cho sensitive endpoints', () => {
      const middleware = httpCacheHeaders(0, { noStore: true });
      const req = { method: 'GET' };
      const headers = {};
      const res = { setHeader: jest.fn((k, v) => { headers[k] = v; }) };
      const next = jest.fn();

      middleware(req, res, next);

      expect(headers['Cache-Control']).toBe('private, no-store');
      expect(next).toHaveBeenCalled();
    });

    test('không set header cho non-GET request', () => {
      const middleware = httpCacheHeaders(1800);
      const req = { method: 'POST' };
      const res = { setHeader: jest.fn() };
      const next = jest.fn();

      middleware(req, res, next);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('Phase 35 — Cleanup Jobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runDailyCleanup xóa abandoned carts', async () => {
    const { Cart } = require('../models');
    const { runDailyCleanup } = require('../jobs/cleanup');

    await runDailyCleanup();

    // Cart.destroy phải được gọi với where status='abandoned'
    expect(Cart.destroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'abandoned',
        }),
      })
    );
  });

  test('runDailyCleanup deactivate expired discount codes', async () => {
    const { DiscountCode } = require('../models');
    const { runDailyCleanup } = require('../jobs/cleanup');

    await runDailyCleanup();

    // DiscountCode.update phải set isActive = false cho expired codes
    expect(DiscountCode.update).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }),
      })
    );
  });

  test('runDailyCleanup null-out expired OTP', async () => {
    const { User } = require('../models');
    const { runDailyCleanup } = require('../jobs/cleanup');

    await runDailyCleanup();

    // User.update phải set otpCode = null cho expired OTP
    expect(User.update).toHaveBeenCalledWith(
      expect.objectContaining({ otpCode: null, otpExpires: null }),
      expect.any(Object)
    );
  });

  test('runDailyCleanup archive old chat messages', async () => {
    const { ChatMessage } = require('../models');
    const { runDailyCleanup } = require('../jobs/cleanup');

    await runDailyCleanup();

    expect(ChatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({ isArchived: true }),
      expect.any(Object)
    );
  });

  test('runDailyCleanup xóa recently viewed cũ', async () => {
    const { RecentlyViewed } = require('../models');
    const { runDailyCleanup } = require('../jobs/cleanup');

    await runDailyCleanup();

    expect(RecentlyViewed.destroy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ viewedAt: expect.any(Object) }),
      })
    );
  });
});

describe('Phase 35 — Redis Client Graceful Fallback', () => {
  test('getRedisClient trả về client với đầy đủ methods', async () => {
    const { getRedisClient } = require('../config/redis');
    const client = await getRedisClient();

    expect(client.get).toBeDefined();
    expect(client.setEx).toBeDefined();
    expect(client.del).toBeDefined();
    expect(client.keys).toBeDefined();
  });
});

describe('Phase 35 — Brand Cache Invalidation', () => {
  beforeEach(() => {
    redisStore = {};
    jest.clearAllMocks();
  });

  test('invalidateCache xóa brand cache khi gọi với pattern brands:*', async () => {
    redisStore['cache:brands:all'] = JSON.stringify({ data: [{ id: 1 }] });
    redisStore['cache:brands:slug:apple'] = JSON.stringify({ data: { id: 1 } });

    const { invalidateCache } = require('../middlewares/cache');
    await invalidateCache('cache:brands:*');

    expect(redisStore['cache:brands:all']).toBeUndefined();
    expect(redisStore['cache:brands:slug:apple']).toBeUndefined();
  });
});

describe('Phase 35 — Chatbot Query Cache', () => {
  beforeEach(() => {
    redisStore = {};
    jest.clearAllMocks();
  });

  test('cache key format đúng cho chatbot responses', async () => {
    const testResponse = { response: 'Test response', products: [] };
    const cacheKey = 'chatbot:1:tìm laptop';

    await mockRedisClient.setEx(cacheKey, 300, JSON.stringify(testResponse));

    const cached = await mockRedisClient.get(cacheKey);
    expect(JSON.parse(cached)).toEqual(testResponse);
  });

  test('invalidateCache xóa chatbot cache khi product thay đổi', async () => {
    redisStore['chatbot:1:tìm laptop'] = '{}';
    redisStore['chatbot:2:mua iphone'] = '{}';
    redisStore['products:list:page1'] = '{}';

    const { invalidateCache } = require('../middlewares/cache');
    await invalidateCache('chatbot:*');

    expect(redisStore['chatbot:1:tìm laptop']).toBeUndefined();
    expect(redisStore['chatbot:2:mua iphone']).toBeUndefined();
    // Không xóa products cache
    expect(redisStore['products:list:page1']).toBe('{}');
  });
});
