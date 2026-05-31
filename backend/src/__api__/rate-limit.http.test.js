/**
 * Integration tests — Rate Limiting.
 * chatbotLimiter: 20 req/60s → 21st request → 429
 * otpLimiter: 5 req/15min → 6th request → 429
 * authLimiter: 100 req/60min (dev) → nhiều hơn → 429
 */
require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_ratelimit_${TS}@t.com` }));
});

afterAll(async () => {
  if (user) await user.destroy({ force: true }).catch(() => {});
});

describe('chatbotLimiter — 20 req/60s', () => {
  // Dùng message off-topic ("thời tiết...") để 20 request qua được rate-limiter
  // trúng rule-based gate (isOffTopic, 0 API call) → trả về tức thì, không gọi LLM.
  // Tránh timeout do 20 LLM call song song; vẫn test đúng rate-limit vì limiter
  // đếm mọi request TRƯỚC controller.
  test('gửi 21 requests song song → ít nhất 1 request bị 429', async () => {
    // Gửi 21 requests đồng thời — rate limiter sẽ block vài cái
    const promises = Array.from({ length: 21 }, (_, i) =>
      request(app)
        .post('/api/chatbot/message')
        .send({ message: `thời tiết hôm nay thế nào ${i}` }),
    );
    const results = await Promise.all(promises);
    const statuses = results.map((r) => r.status);

    // Ít nhất 1 request phải bị 429
    expect(statuses).toContain(429);
    // Số lượng bị throttle
    const throttled = statuses.filter((s) => s === 429).length;
    console.log(`Rate limit: ${throttled}/21 requests bị 429`);
  }, 60000); // 60s timeout cho concurrent requests
});

describe('otpLimiter — 5 req/15min', () => {
  const email = `__http_otp_limit_${TS}@t.com`;

  test('5 requests đầu → không phải 429', async () => {
    // Tạo user để test
    const u = await User.create({
      firstName: '__HTTP',
      lastName: 'OTP',
      email,
      password: 'Test123!',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
    });

    const results = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post('/api/auth/forgot-password').send({ email });
      results.push(res.status);
    }
    // Không có request nào bị 429 trong 5 lần đầu
    expect(results.every((s) => s !== 429)).toBe(true);
    await u.destroy({ force: true });
  });

  test('request thứ 6 → 429', async () => {
    const u = await User.create({
      firstName: '__HTTP',
      lastName: 'OTP2',
      email: `__http_otp2_${TS}@t.com`,
      password: 'Test123!',
      role: 'customer',
      isEmailVerified: true,
      isActive: true,
    });

    // Drain 5 requests
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/forgot-password').send({ email: u.email });
    }

    // Request thứ 6 → 429
    const res = await request(app).post('/api/auth/forgot-password').send({ email: u.email });
    expect(res.status).toBe(429);
    await u.destroy({ force: true });
  });
});
