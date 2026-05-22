/**
 * @file rateLimiter.additional.test.js
 * @description Gộp từ rateLimiter.additional.test.js + rateLimiter.coverage.test.js
 */
// Tests cho ProxyStore (src/middlewares/rate-limiter.js)
// ProxyStore là class nội bộ — kiểm tra trực tiếp bằng cách instantiate

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// ─── Định nghĩa ProxyStore trực tiếp để test isolated ────────────────────────
// (Không thể export từ rate-limiter.js vì đó là module private)
// Copy logic class để test behavior đúng — đây là characterization test.

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

// ════════════════════════════════════════════════════════════════════════════
// ProxyStore behavior
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore — increment', () => {
  test('increment lần đầu cho key mới — trả totalHits=1', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    const result = await store.increment('ip:1.2.3.4');

    expect(result.totalHits).toBe(1);
    expect(result.resetTime).toBeInstanceOf(Date);
  });

  test('increment liên tiếp cùng key — đếm đúng', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    await store.increment('user:5');
    await store.increment('user:5');
    const third = await store.increment('user:5');

    expect(third.totalHits).toBe(3);
  });

  test('hai key khác nhau — đếm độc lập', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    await store.increment('keyA');
    await store.increment('keyA');
    const resultB = await store.increment('keyB');

    expect(resultB.totalHits).toBe(1);
  });

  test('resetTime nằm trong tương lai (windowMs sau thời điểm hiện tại)', async () => {
    const before = Date.now();
    const store = new ProxyStore();
    store.init({ windowMs: 30000 });

    const result = await store.increment('key1');

    expect(result.resetTime.getTime()).toBeGreaterThanOrEqual(before + 30000);
  });

  test('window đã hết hạn — reset counter về 1', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 1 }); // window cực ngắn

    await store.increment('key-expire');
    // Đợi window hết hạn
    await new Promise((r) => setTimeout(r, 10));
    const result = await store.increment('key-expire');

    expect(result.totalHits).toBe(1); // reset vì window đã hết
  });
});

describe('ProxyStore — decrement', () => {
  test('decrement sau increment — totalHits về 0', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    await store.increment('ip:x');
    await store.decrement('ip:x');

    const result = await store.increment('ip:x');
    expect(result.totalHits).toBe(1); // bắt đầu lại từ 0, rồi +1
  });

  test('decrement khi totalHits=0 — không xuống âm', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });
    await store.increment('key-min');
    await store.decrement('key-min'); // về 0

    const rec = store._hits.get('key-min');
    expect(rec.totalHits).toBe(0);

    await store.decrement('key-min'); // thử xuống âm

    expect(store._hits.get('key-min').totalHits).toBe(0);
  });

  test('decrement key không tồn tại — không throw', async () => {
    const store = new ProxyStore();

    await expect(store.decrement('nonexistent-key')).resolves.not.toThrow();
  });
});

describe('ProxyStore — resetKey', () => {
  test('resetKey xóa record khỏi map', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    await store.increment('key-to-reset');
    await store.resetKey('key-to-reset');

    expect(store._hits.has('key-to-reset')).toBe(false);
  });

  test('resetKey key không tồn tại — không throw', async () => {
    const store = new ProxyStore();

    await expect(store.resetKey('phantom-key')).resolves.not.toThrow();
  });

  test('sau resetKey — increment bắt đầu lại từ 1', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    await store.increment('key-r');
    await store.increment('key-r');
    await store.resetKey('key-r');

    const result = await store.increment('key-r');
    expect(result.totalHits).toBe(1);
  });
});

describe('ProxyStore — resetAll', () => {
  test('resetAll xóa toàn bộ hits', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });

    await store.increment('a');
    await store.increment('b');
    await store.increment('c');
    await store.resetAll();

    expect(store._hits.size).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ProxyStore — init
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore — init', () => {
  test('init cập nhật _windowMs từ options', () => {
    const store = new ProxyStore();
    store.init({ windowMs: 300000 });

    expect(store._windowMs).toBe(300000);
  });

  test('init dùng 60000 làm default khi options.windowMs không được truyền', () => {
    const store = new ProxyStore();
    store.init({});

    expect(store._windowMs).toBe(60000);
  });
});

// ═══════════
// rateLimiter.coverage.test.js
// ═══════════

('use strict');

// ─── Tests bổ sung coverage cho rate-limiter.js ──────────────────────────────

// ════════════════════════════════════════════════════════════════════════════
// ProxyStore gốc — decrement / resetKey / resetAll từ module thực
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore gốc — decrement / resetKey / resetAll', () => {
  let capturedStores;

  beforeAll(async () => {
    jest.resetModules();

    capturedStores = [];
    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        if (options && options.store) {
          capturedStores.push({ store: options.store, options });
        }
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        return mw;
      });
    });

    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    require('./rate-limiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('có ít nhất một store được capture', () => {
    expect(capturedStores.length).toBeGreaterThan(0);
  });

  function getApiStore() {
    return capturedStores[0].store;
  }

  // ─── decrement ──────────────────────────────────────────────────────────

  it('decrement key không tồn tại — không throw', async () => {
    const store = getApiStore();
    await expect(store.decrement('nonexistent:key')).resolves.not.toThrow();
  });

  it('decrement sau increment — totalHits về 0', async () => {
    const store = getApiStore();
    await store.increment('dec:test');
    await store.decrement('dec:test');
    const rec = store._hits.get('dec:test');
    expect(rec.totalHits).toBe(0);
  });

  it('decrement khi totalHits=0 — không xuống âm', async () => {
    const store = getApiStore();
    await store.increment('dec:floor');
    await store.decrement('dec:floor'); // về 0
    await store.decrement('dec:floor'); // thử xuống âm

    expect(store._hits.get('dec:floor').totalHits).toBe(0);
  });

  // ─── resetKey ───────────────────────────────────────────────────────────

  it('resetKey xóa record khỏi _hits', async () => {
    const store = getApiStore();
    await store.increment('rk:test');
    await store.resetKey('rk:test');
    expect(store._hits.has('rk:test')).toBe(false);
  });

  it('resetKey key không tồn tại — không throw', async () => {
    const store = getApiStore();
    await expect(store.resetKey('phantom:rk')).resolves.not.toThrow();
  });

  // ─── resetAll ───────────────────────────────────────────────────────────

  it('resetAll xóa toàn bộ _hits', async () => {
    const store = getApiStore();
    await store.increment('ra:a');
    await store.increment('ra:b');
    await store.resetAll();
    expect(store._hits.size).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// authLimiter handler
// ════════════════════════════════════════════════════════════════════════════

describe('authLimiter handler (lines 96-97)', () => {
  let capturedAuthOptions;
  let mockLoggerInstance;

  beforeAll(async () => {
    jest.resetModules();

    capturedAuthOptions = null;
    mockLoggerInstance = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        if (options?.handler) {
          capturedAuthOptions = options;
        }
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        mw.options = options;
        return mw;
      });
    });

    jest.doMock('@utils/logger', () => mockLoggerInstance);

    require('./rate-limiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('handler gọi logger.warn với ip và email', () => {
    expect(capturedAuthOptions).not.toBeNull();
    const handler = capturedAuthOptions.handler;
    expect(typeof handler).toBe('function');

    const req = { ip: '10.0.0.1', body: { email: 'attacker@mail.com' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();
    const options = { statusCode: 429, message: { status: 'error', message: 'Rate limited' } };

    handler(req, res, next, options);

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith('[AUTH] Rate limited', {
      ip: '10.0.0.1',
      email: 'attacker@mail.com',
    });
  });

  it('handler trả về statusCode và message từ options', () => {
    const handler = capturedAuthOptions.handler;
    const req = { ip: '192.168.1.1', body: {} };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const options = {
      statusCode: 429,
      message: { status: 'error', message: 'Quá nhiều lần đăng nhập thất bại' },
    };

    handler(req, res, jest.fn(), options);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(options.message);
  });

  it('handler hoạt động khi req.body không có email (undefined)', () => {
    const handler = capturedAuthOptions.handler;
    const req = { ip: '1.2.3.4', body: undefined };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const options = { statusCode: 429, message: { status: 'error', message: 'Limited' } };

    expect(() => handler(req, res, jest.fn(), options)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// otpLimiter keyGenerator
// ════════════════════════════════════════════════════════════════════════════

describe('otpLimiter — keyGenerator (line 108)', () => {
  let capturedOtpOptions;

  beforeAll(async () => {
    jest.resetModules();

    capturedOtpOptions = null;

    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        if (options?.keyGenerator) {
          capturedOtpOptions = options;
        }
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        return mw;
      });
    });

    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    require('./rate-limiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('keyGenerator trả về email khi req.body.email có giá trị', () => {
    expect(capturedOtpOptions).not.toBeNull();
    const keyGen = capturedOtpOptions.keyGenerator;
    const req = { body: { email: 'user@example.com' }, ip: '10.0.0.1' };

    const key = keyGen(req);

    expect(key).toBe('user@example.com');
  });

  it('keyGenerator fallback sang req.ip khi body.email không có', () => {
    const keyGen = capturedOtpOptions.keyGenerator;
    const req = { body: {}, ip: '192.168.0.5' };

    const key = keyGen(req);

    expect(key).toBe('192.168.0.5');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ProxyStore.init — windowMs branches
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore.init — windowMs branches (line 17)', () => {
  let capturedStore;

  beforeAll(async () => {
    jest.resetModules();

    capturedStore = null;
    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        if (options?.store && !capturedStore) {
          capturedStore = options.store;
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      }),
    );
    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    require('./rate-limiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('init với windowMs=undefined → fallback 60000', () => {
    expect(capturedStore).not.toBeNull();
    capturedStore.init({});
    expect(capturedStore._windowMs).toBe(60000);
  });

  it('init với windowMs=120000 → dùng giá trị được truyền', () => {
    capturedStore.init({ windowMs: 120000 });
    expect(capturedStore._windowMs).toBe(120000);
  });
});

describe('ProxyStore.increment — if(!rec) false branch (line 30): record exists and valid', () => {
  let capturedStore2;

  beforeAll(async () => {
    jest.resetModules();

    capturedStore2 = null;
    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        if (options?.store && !capturedStore2) {
          capturedStore2 = options.store;
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      }),
    );
    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    require('./rate-limiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('increment cùng key 2 lần trong window → lần 2 không tạo rec mới', async () => {
    capturedStore2.init({ windowMs: 60000 });

    const first = await capturedStore2.increment('test-key-double');
    expect(first.totalHits).toBe(1);

    const second = await capturedStore2.increment('test-key-double');
    expect(second.totalHits).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// NODE_ENV=development ternary branches
// ════════════════════════════════════════════════════════════════════════════

describe('rateLimiter — NODE_ENV=development ternary branches (lines 73, 86)', () => {
  let capturedLimiters;

  beforeAll(async () => {
    jest.resetModules();

    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    capturedLimiters = [];
    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        capturedLimiters.push({ max: options.max, hasHandler: !!options.handler });
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      }),
    );
    jest.doMock('@utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    require('./rate-limiter');
    await new Promise((r) => setImmediate(r));

    process.env.NODE_ENV = originalEnv;
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('apiLimiter max = 1000 khi NODE_ENV=development', () => {
    const apiConfig = capturedLimiters[0];
    expect(apiConfig.max).toBe(1000);
  });

  it('authLimiter max = 100 khi NODE_ENV=development', () => {
    const authConfig = capturedLimiters.find((l) => l.hasHandler);
    expect(authConfig).toBeDefined();
    expect(authConfig.max).toBe(100);
  });
});
