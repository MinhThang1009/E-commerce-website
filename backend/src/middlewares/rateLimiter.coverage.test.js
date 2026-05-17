'use strict';

// ─── Tests bổ sung coverage cho rateLimiter.js ───────────────────────────────
//
// Mục tiêu:
//   • Lines 38-44: ProxyStore.decrement trong module gốc
//   • Lines 46-51: ProxyStore.resetKey trong module gốc
//   • Lines 53-58: ProxyStore.resetAll trong module gốc
//   • Lines 96-97: handler callback của authLimiter
//   • Line 153: catch branch khi getRedisClient reject
//
// Chiến lược: mock express-rate-limit để capture store instance được truyền vào,
// sau đó gọi methods trực tiếp trên instance đó.

// ════════════════════════════════════════════════════════════════════════════
// Lines 38-58: decrement / resetKey / resetAll trong ProxyStore gốc
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore gốc — decrement / resetKey / resetAll', () => {
  let capturedStores; // sẽ chứa các store instances từ module gốc

  beforeAll(async () => {
    jest.resetModules();

    // Capture store references khi rateLimit() được gọi
    capturedStores = [];
    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        if (options && options.store) {
          capturedStores.push({ store: options.store, options });
        }
        // init được gọi bởi express-rate-limit — gọi thủ công ở đây
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        // Trả về middleware giả có resetKey để không crash
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        return mw;
      });
    });

    jest.doMock('rate-limit-redis', () => ({
      RedisStore: jest.fn().mockImplementation(() => ({
        increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
        decrement: jest.fn().mockResolvedValue(undefined),
        resetKey: jest.fn().mockResolvedValue(undefined),
        resetAll: jest.fn().mockResolvedValue(undefined),
      })),
    }));

    jest.doMock('../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(null),
    }));

    require('./rateLimiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => {
    jest.resetModules();
  });

  it('có ít nhất một store được capture', () => {
    expect(capturedStores.length).toBeGreaterThan(0);
  });

  // Lấy store đầu tiên (api store) cho các test
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

  // ─── decrement với redisStore delegate ──────────────────────────────────

  it('decrement ủy quyền cho redisStore khi Redis khả dụng', async () => {
    const store = getApiStore();
    const mockRedisStore = {
      increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
      decrement: jest.fn().mockResolvedValue(undefined),
      resetKey: jest.fn().mockResolvedValue(undefined),
      resetAll: jest.fn().mockResolvedValue(undefined),
    };
    store.useRedis(mockRedisStore);

    await store.decrement('redis:dec');
    expect(mockRedisStore.decrement).toHaveBeenCalledWith('redis:dec');

    store._redisStore = null;
  });

  it('decrement fallback in-memory khi redisStore.decrement ném lỗi', async () => {
    const store = getApiStore();
    store._hits.clear();
    const mockRedisStore = {
      increment: jest.fn().mockRejectedValue(new Error('Redis down')),
      decrement: jest.fn().mockRejectedValue(new Error('Redis down')),
      resetKey: jest.fn(),
      resetAll: jest.fn(),
    };
    store.useRedis(mockRedisStore);

    // increment fallback — in-memory
    await store.increment('fb:dec');
    // decrement fallback — in-memory decrement
    await expect(store.decrement('fb:dec')).resolves.not.toThrow();

    store._redisStore = null;
    store._hits.clear();
  });

  // ─── resetKey với redisStore delegate ───────────────────────────────────

  it('resetKey ủy quyền cho redisStore', async () => {
    const store = getApiStore();
    const mockRedisStore = {
      resetKey: jest.fn().mockResolvedValue(undefined),
    };
    store.useRedis(mockRedisStore);

    await store.resetKey('redis:rk');
    expect(mockRedisStore.resetKey).toHaveBeenCalledWith('redis:rk');

    store._redisStore = null;
  });

  it('resetKey — Redis fail: xóa in-memory, không throw', async () => {
    const store = getApiStore();
    store._hits.clear();
    const mockRedisStore = {
      increment: jest.fn().mockRejectedValue(new Error('down')),
      resetKey: jest.fn().mockRejectedValue(new Error('Redis error')),
    };
    store.useRedis(mockRedisStore);

    await store.increment('rk:fail');
    await expect(store.resetKey('rk:fail')).resolves.not.toThrow();
    expect(store._hits.has('rk:fail')).toBe(false);

    store._redisStore = null;
    store._hits.clear();
  });

  // ─── resetAll với redisStore delegate ───────────────────────────────────

  it('resetAll ủy quyền cho redisStore.resetAll', async () => {
    const store = getApiStore();
    const mockRedisStore = {
      resetAll: jest.fn().mockResolvedValue(undefined),
    };
    store.useRedis(mockRedisStore);

    await store.resetAll();
    expect(mockRedisStore.resetAll).toHaveBeenCalled();

    store._redisStore = null;
  });

  it('resetAll — Redis fail: xóa in-memory, không throw', async () => {
    const store = getApiStore();
    store._hits.clear();
    const mockRedisStore = {
      increment: jest.fn().mockRejectedValue(new Error('down')),
      resetAll: jest.fn().mockRejectedValue(new Error('Redis error')),
    };
    store.useRedis(mockRedisStore);

    await store.increment('ra:fail');
    await expect(store.resetAll()).resolves.not.toThrow();
    expect(store._hits.size).toBe(0);

    store._redisStore = null;
  });
});

// ════════════════════════════════════════════════════════════════════════════
// authLimiter handler (lines 96-97)
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
        // authLimiter được tạo thứ hai — nhận biết qua có handler
        if (options?.handler) {
          capturedAuthOptions = options;
        }
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        // Expose options để test có thể gọi handler
        mw.options = options;
        return mw;
      });
    });

    jest.doMock('rate-limit-redis', () => ({
      RedisStore: jest.fn().mockImplementation(() => ({})),
    }));

    jest.doMock('../utils/logger', () => mockLoggerInstance);

    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(null),
    }));

    require('./rateLimiter');
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

    expect(mockLoggerInstance.warn).toHaveBeenCalledWith(
      '[AUTH] Rate limited',
      { ip: '10.0.0.1', email: 'attacker@mail.com' }
    );
  });

  it('handler trả về statusCode và message từ options', () => {
    const handler = capturedAuthOptions.handler;
    const req = { ip: '192.168.1.1', body: {} }; // không có email
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

    // Không throw dù body undefined (optional chaining ?.)
    expect(() => handler(req, res, jest.fn(), options)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Line 153: catch branch khi getRedisClient reject
// ════════════════════════════════════════════════════════════════════════════

describe('rateLimiter — catch branch khi Redis không khả dụng (line 153)', () => {
  it('log info về memory store khi getRedisClient reject', async () => {
    jest.resetModules();

    const mockCatchLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    jest.doMock('../utils/logger', () => mockCatchLogger);
    jest.doMock('rate-limit-redis', () => ({
      RedisStore: jest.fn(),
    }));
    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        return mw;
      });
    });
    // Reject để trigger catch tại line 152-154
    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockRejectedValue(new Error('Connection refused')),
    }));

    require('./rateLimiter');

    // Chờ async initialization settle
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    expect(mockCatchLogger.info).toHaveBeenCalledWith(
      '[RateLimiter] Sử dụng memory store (Redis không khả dụng)'
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Line 108: otpLimiter keyGenerator
// ════════════════════════════════════════════════════════════════════════════

describe('otpLimiter — keyGenerator (line 108)', () => {
  let capturedOtpOptions;

  beforeAll(async () => {
    jest.resetModules();

    capturedOtpOptions = null;
    let callIndex = 0;

    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        callIndex++;
        // otpLimiter là lần gọi thứ 3 (api, auth, otp)
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

    jest.doMock('rate-limit-redis', () => ({
      RedisStore: jest.fn().mockImplementation(() => ({})),
    }));

    jest.doMock('../utils/logger', () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    }));

    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(null),
    }));

    require('./rateLimiter');
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
// Lines 144-150: Redis upgrade path (khi getRedisClient resolve với client hợp lệ)
// ════════════════════════════════════════════════════════════════════════════

describe('rateLimiter — Redis upgrade path (lines 144-150)', () => {
  it('nâng cấp tất cả proxy stores lên RedisStore khi client.sendCommand khả dụng', async () => {
    jest.resetModules();

    const mockUpgradeLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const mockRedisClient = {
      sendCommand: jest.fn().mockResolvedValue('OK'),
    };

    const mockRedisStoreInstances = [];
    const MockRedisStore = jest.fn().mockImplementation((opts) => {
      const instance = {
        increment: jest.fn(),
        decrement: jest.fn(),
        resetKey: jest.fn(),
        resetAll: jest.fn(),
        _opts: opts,
      };
      mockRedisStoreInstances.push(instance);
      return instance;
    });

    jest.doMock('rate-limit-redis', () => ({
      RedisStore: MockRedisStore,
    }));

    jest.doMock('express-rate-limit', () => {
      return jest.fn().mockImplementation((options) => {
        if (options?.store?.init) {
          options.store.init({ windowMs: options.windowMs || 60000 });
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        mw.getKey = jest.fn();
        return mw;
      });
    });

    jest.doMock('../utils/logger', () => mockUpgradeLogger);

    // getRedisClient resolve với client có sendCommand — trigger upgrade path
    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(mockRedisClient),
    }));

    require('./rateLimiter');

    // Chờ async initialization settle
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // RedisStore phải được khởi tạo cho từng proxy store (api, auth, otp, chatbot, chat = 5)
    expect(MockRedisStore).toHaveBeenCalledTimes(5);

    // Logger.info với thông báo upgrade
    expect(mockUpgradeLogger.info).toHaveBeenCalledWith(
      '[RateLimiter] Đã nâng cấp lên Redis store — counter persist qua restart'
    );

    // Mỗi RedisStore được tạo với prefix đúng format rl:<name>:
    const prefixes = MockRedisStore.mock.calls.map((call) => call[0].prefix);
    expect(prefixes).toContain('rl:api:');
    expect(prefixes).toContain('rl:auth:');
    expect(prefixes).toContain('rl:otp:');
    expect(prefixes).toContain('rl:chatbot:');
    expect(prefixes).toContain('rl:chat:');

    // Line 146: sendCommand wrapper — gọi thử để cover line
    const firstCallOpts = MockRedisStore.mock.calls[0][0];
    const wrappedSendCommand = firstCallOpts.sendCommand;
    await wrappedSendCommand('SET', 'key', 'value');
    expect(mockRedisClient.sendCommand).toHaveBeenCalledWith(['SET', 'key', 'value']);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Line 17: ProxyStore.init — windowMs branch (options.windowMs truthy)
// Lines 73, 86: NODE_ENV === 'development' ternary — true branch (max limits)
// ════════════════════════════════════════════════════════════════════════════

describe('ProxyStore.init — windowMs branches (line 17)', () => {
  // Instantiate ProxyStore trực tiếp từ module gốc bằng cách capture constructor.
  // Vì ProxyStore không được export, ta dùng kỹ thuật capture qua express-rate-limit mock.
  let capturedStore;

  beforeAll(async () => {
    jest.resetModules();

    capturedStore = null;
    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        if (options?.store && !capturedStore) {
          capturedStore = options.store;
          // KHÔNG gọi init ở đây — để test tự gọi với các giá trị khác nhau
        }
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      })
    );
    jest.doMock('rate-limit-redis', () => ({ RedisStore: jest.fn() }));
    jest.doMock('../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(null),
    }));

    require('./rateLimiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => { jest.resetModules(); });

  it('init với windowMs=undefined → fallback 60000 (line 17 false/right branch)', () => {
    // options.windowMs falsy (undefined) → || 60000 → right operand → _windowMs = 60000
    expect(capturedStore).not.toBeNull();
    capturedStore.init({}); // windowMs không có → falsy
    expect(capturedStore._windowMs).toBe(60000);
  });

  it('init với windowMs=120000 → dùng giá trị được truyền (line 17 true/left branch)', () => {
    // options.windowMs truthy → || short-circuits → _windowMs = 120000
    capturedStore.init({ windowMs: 120000 });
    expect(capturedStore._windowMs).toBe(120000);
  });
});

describe('ProxyStore.increment — if(!rec) false branch (line 30): record exists and valid', () => {
  // Cần gọi increment 2 lần trên cùng key trong cùng window
  // → lần 2: rec tồn tại + resetTime còn hạn → if(!rec || expired) = false
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
      })
    );
    jest.doMock('rate-limit-redis', () => ({ RedisStore: jest.fn() }));
    jest.doMock('../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(null),
    }));

    require('./rateLimiter');
    await new Promise((r) => setImmediate(r));
  });

  afterAll(() => { jest.resetModules(); });

  it('increment cùng key 2 lần trong window → lần 2 không tạo rec mới (if false branch line 30)', async () => {
    capturedStore2.init({ windowMs: 60000 });

    // Lần 1: rec chưa tồn tại → if(!rec) = true → tạo rec mới
    const first = await capturedStore2.increment('test-key-double');
    expect(first.totalHits).toBe(1);

    // Lần 2: rec đã tồn tại và còn hạn → if(!rec || expired) = false → dùng rec cũ
    const second = await capturedStore2.increment('test-key-double');
    expect(second.totalHits).toBe(2);
  });
});

describe('rateLimiter — client không có sendCommand (line 143 false branch)', () => {
  it('không nâng cấp store khi client không có sendCommand', async () => {
    jest.resetModules();

    const mockLogger = {
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    };

    // Client hợp lệ nhưng không có sendCommand → if(sendCommand) = false
    const clientWithoutSendCommand = { ping: jest.fn() };

    jest.doMock('express-rate-limit', () =>
      jest.fn().mockImplementation((options) => {
        if (options?.store?.init) options.store.init({ windowMs: 60000 });
        const mw = jest.fn();
        mw.resetKey = jest.fn();
        return mw;
      })
    );
    jest.doMock('rate-limit-redis', () => ({ RedisStore: jest.fn() }));
    jest.doMock('../utils/logger', () => mockLogger);
    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(clientWithoutSendCommand),
    }));

    require('./rateLimiter');
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));

    // Không log upgrade message
    expect(mockLogger.info).not.toHaveBeenCalledWith(
      expect.stringContaining('nâng cấp')
    );

    jest.resetModules();
  });
});

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
      })
    );
    jest.doMock('rate-limit-redis', () => ({ RedisStore: jest.fn() }));
    jest.doMock('../utils/logger', () => ({
      info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
    }));
    jest.doMock('../config/redis', () => ({
      getRedisClient: jest.fn().mockResolvedValue(null),
    }));

    require('./rateLimiter');
    await new Promise((r) => setImmediate(r));

    process.env.NODE_ENV = originalEnv;
  });

  afterAll(() => { jest.resetModules(); });

  it('apiLimiter max = 1000 khi NODE_ENV=development (line 73 true branch)', () => {
    // apiLimiter là limiter đầu tiên được tạo
    const apiConfig = capturedLimiters[0];
    expect(apiConfig.max).toBe(1000);
  });

  it('authLimiter max = 100 khi NODE_ENV=development (line 86 true branch)', () => {
    // authLimiter là limiter thứ hai (có handler)
    const authConfig = capturedLimiters.find((l) => l.hasHandler);
    expect(authConfig).toBeDefined();
    expect(authConfig.max).toBe(100);
  });
});
