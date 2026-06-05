/**
 * rate-limiter.mutation-kill.test.js
 *
 * Kill mutant: ProxyStore (increment window-reset, decrement Math.max, resetKey/All, init) +
 * config từng limiter (windowMs, max, message) + authLimiter handler + otpLimiter keyGenerator.
 * Mock express-rate-limit để CAPTURE config (ProxyStore không export).
 */

const captured = {};
jest.mock('express-rate-limit', () => (config) => {
  // Lưu config theo store để truy xuất; trả về chính config làm "middleware"
  captured._last = config;
  return config;
});
jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('@utils/logger');
const limiters = require('@middlewares/rate-limiter');

// ── Config từng limiter ─────────────────────────────────────────────────────
describe('limiter configs', () => {
  it('apiLimiter: windowMs 15 phút, standardHeaders true, legacyHeaders false', () => {
    expect(limiters.apiLimiter.windowMs).toBe(15 * 60 * 1000);
    expect(limiters.apiLimiter.standardHeaders).toBe(true);
    expect(limiters.apiLimiter.legacyHeaders).toBe(false);
    expect(limiters.apiLimiter.max).toBe(100); // NODE_ENV=test → không phải dev → 100
  });

  it('authLimiter: windowMs 1 giờ, max 10 (prod)', () => {
    expect(limiters.authLimiter.windowMs).toBe(60 * 60 * 1000);
    expect(limiters.authLimiter.max).toBe(10);
  });

  it('otpLimiter: windowMs 15 phút, max 5', () => {
    expect(limiters.otpLimiter.windowMs).toBe(15 * 60 * 1000);
    expect(limiters.otpLimiter.max).toBe(5);
  });

  it('chatbotLimiter: windowMs 60s, max 20', () => {
    expect(limiters.chatbotLimiter.windowMs).toBe(60 * 1000);
    expect(limiters.chatbotLimiter.max).toBe(20);
  });

  it('chatLimiter: windowMs 5 phút, max 30', () => {
    expect(limiters.chatLimiter.windowMs).toBe(5 * 60 * 1000);
    expect(limiters.chatLimiter.max).toBe(30);
  });

  it('message body có status "error"', () => {
    expect(limiters.apiLimiter.message.status).toBe('error');
    expect(limiters.apiLimiter.message.message).toContain('Quá nhiều');
  });
});

// ── ProxyStore (qua store của apiLimiter) ───────────────────────────────────
describe('ProxyStore', () => {
  let store;
  beforeEach(() => {
    store = limiters.apiLimiter.store;
    store.resetAll();
    store.init({ windowMs: 60000 });
  });

  it('increment lần đầu → totalHits 1 + resetTime tương lai', async () => {
    const r = await store.increment('k1');
    expect(r.totalHits).toBe(1);
    expect(r.resetTime.getTime()).toBeGreaterThan(Date.now());
  });

  it('increment nhiều lần cùng key → totalHits tăng dần', async () => {
    await store.increment('k2');
    const r = await store.increment('k2');
    expect(r.totalHits).toBe(2);
  });

  it('init set windowMs → resetTime = now + windowMs', async () => {
    store.init({ windowMs: 10000 });
    const before = Date.now();
    const r = await store.increment('k3');
    expect(r.resetTime.getTime()).toBeGreaterThanOrEqual(before + 10000 - 50);
    expect(r.resetTime.getTime()).toBeLessThanOrEqual(before + 10000 + 1000);
  });

  it('decrement → giảm 1, không xuống dưới 0 (Math.max)', async () => {
    await store.increment('k4'); // 1
    await store.decrement('k4'); // 0
    await store.decrement('k4'); // vẫn 0 (Math.max)
    const r = await store.increment('k4');
    expect(r.totalHits).toBe(1); // 0 + 1
  });

  it('resetKey → xóa key đó', async () => {
    await store.increment('k5');
    await store.resetKey('k5');
    const r = await store.increment('k5');
    expect(r.totalHits).toBe(1);
  });
});

// ── authLimiter handler + otpLimiter keyGenerator ───────────────────────────
describe('authLimiter handler', () => {
  it('log warn + res.status(options.statusCode).json(options.message)', () => {
    const req = { ip: '1.2.3.4', body: { email: 'a@b.com' } };
    const json = jest.fn();
    const res = { status: jest.fn(() => ({ json })) };
    const options = { statusCode: 429, message: { status: 'error' } };
    limiters.authLimiter.handler(req, res, jest.fn(), options);
    expect(logger.warn).toHaveBeenCalledWith('[AUTH] Rate limited', {
      ip: '1.2.3.4',
      email: 'a@b.com',
    });
    expect(res.status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ status: 'error' });
  });
});

describe('otpLimiter keyGenerator', () => {
  it('ưu tiên email, fallback ip', () => {
    expect(limiters.otpLimiter.keyGenerator({ body: { email: 'x@y.com' }, ip: '9.9.9.9' })).toBe(
      'x@y.com',
    );
    expect(limiters.otpLimiter.keyGenerator({ body: {}, ip: '9.9.9.9' })).toBe('9.9.9.9');
  });
});

// ── dev max branch ──────────────────────────────────────────────────────────
describe('max theo NODE_ENV', () => {
  it('development → apiLimiter max 1000, authLimiter max 100', () => {
    jest.isolateModules(() => {
      const old = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const l = require('@middlewares/rate-limiter');
      expect(l.apiLimiter.max).toBe(1000);
      expect(l.authLimiter.max).toBe(100);
      process.env.NODE_ENV = old;
    });
  });
});
