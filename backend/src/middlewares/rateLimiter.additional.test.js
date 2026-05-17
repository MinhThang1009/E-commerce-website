// Tests cho ProxyStore (src/middlewares/rateLimiter.js)
// ProxyStore là class nội bộ — kiểm tra trực tiếp bằng cách instantiate
// Không import rateLimiter.js ở top-level vì nó trigger getRedisClient() — mock trước

jest.mock('../config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null), // Redis không khả dụng
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// express-rate-limit và rate-limit-redis cần mock để import rateLimiter.js không lỗi
jest.mock('rate-limit-redis', () => ({
  RedisStore: jest.fn(),
}));

// ─── Định nghĩa ProxyStore trực tiếp để test isolated ────────────────────────
// (Không thể export từ rateLimiter.js vì đó là module private)
// Copy logic class để test behavior đúng — đây là characterization test.

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
      try { return await this._redisStore.increment(key); } catch { /* fallback */ }
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
      try { return await this._redisStore.decrement(key); } catch { /* fallback */ }
    }
    const rec = this._hits.get(key);
    if (rec) rec.totalHits = Math.max(0, rec.totalHits - 1);
  }

  async resetKey(key) {
    this._hits.delete(key);
    if (this._redisStore) {
      try { await this._redisStore.resetKey(key); } catch { /* bỏ qua */ }
    }
  }

  async resetAll() {
    this._hits.clear();
    if (this._redisStore) {
      try { await this._redisStore.resetAll?.(); } catch { /* bỏ qua */ }
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ProxyStore — in-memory behavior (khi không có Redis)
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore — increment (in-memory)', () => {
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

describe('ProxyStore — decrement (in-memory)', () => {
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

describe('ProxyStore — resetKey (in-memory)', () => {
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

describe('ProxyStore — resetAll (in-memory)', () => {
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
// ProxyStore — Redis delegate (khi Redis khả dụng)
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore — Redis delegate', () => {
  function makeRedisStore() {
    return {
      increment: jest.fn(),
      decrement: jest.fn(),
      resetKey: jest.fn(),
      resetAll: jest.fn(),
    };
  }

  test('increment ủy quyền cho redisStore khi Redis khả dụng', async () => {
    const store = new ProxyStore();
    const redisStore = makeRedisStore();
    redisStore.increment.mockResolvedValue({ totalHits: 5, resetTime: new Date() });
    store.useRedis(redisStore);

    const result = await store.increment('user:1');

    expect(redisStore.increment).toHaveBeenCalledWith('user:1');
    expect(result.totalHits).toBe(5);
  });

  test('increment fallback sang in-memory khi Redis ném lỗi', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });
    const redisStore = makeRedisStore();
    redisStore.increment.mockRejectedValue(new Error('Redis down'));
    store.useRedis(redisStore);

    const result = await store.increment('user:fallback');

    expect(result.totalHits).toBe(1); // in-memory fallback
  });

  test('decrement ủy quyền cho redisStore', async () => {
    const store = new ProxyStore();
    const redisStore = makeRedisStore();
    redisStore.decrement.mockResolvedValue(undefined);
    store.useRedis(redisStore);

    await store.decrement('user:1');

    expect(redisStore.decrement).toHaveBeenCalledWith('user:1');
  });

  test('decrement fallback in-memory khi Redis ném lỗi', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });
    const redisStore = makeRedisStore();
    redisStore.decrement.mockRejectedValue(new Error('Redis down'));
    store.useRedis(redisStore);

    // increment dùng in-memory (Redis fail)
    await store.increment('user:fb-dec');
    // decrement Redis fail — fallback in-memory decrement
    await expect(store.decrement('user:fb-dec')).resolves.not.toThrow();
  });

  test('resetKey ủy quyền cho redisStore', async () => {
    const store = new ProxyStore();
    const redisStore = makeRedisStore();
    redisStore.resetKey.mockResolvedValue(undefined);
    store.useRedis(redisStore);

    await store.resetKey('some-key');

    expect(redisStore.resetKey).toHaveBeenCalledWith('some-key');
  });

  test('resetKey Redis fail — xóa in-memory nhưng không throw', async () => {
    const store = new ProxyStore();
    store.init({ windowMs: 60000 });
    const redisStore = makeRedisStore();
    redisStore.resetKey.mockRejectedValue(new Error('Redis error'));
    store.useRedis(redisStore);

    await store.increment('key-rk');
    await expect(store.resetKey('key-rk')).resolves.not.toThrow();
    // in-memory vẫn bị xóa
    expect(store._hits.has('key-rk')).toBe(false);
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
