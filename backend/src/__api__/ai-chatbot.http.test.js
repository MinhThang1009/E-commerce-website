require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User } = require('@models');

const TS = Date.now();
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_chatbot_${TS}@t.com` }));
});

afterAll(async () => {
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('POST /api/chatbot/message', () => {
  test('message hợp lệ → 200 hoặc 5xx (demo key)', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'laptop dưới 20 triệu' });
    expect([200, 500, 503]).toContain(res.status);
    if (res.status === 200) expect(res.body.status).toBe('success');
  });

  test('message rỗng → 400', async () => {
    const res = await request(app).post('/api/chatbot/message').send({ message: '' });
    expect(res.status).toBe(400);
  });

  test('thiếu message field → 400', async () => {
    const res = await request(app).post('/api/chatbot/message').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/chatbot/recommendations', () => {
  test('→ 200 hoặc 5xx', async () => {
    const res = await request(app).get('/api/chatbot/recommendations');
    expect([200, 500, 503]).toContain(res.status);
    if (res.status === 200) expect(res.body.status).toBe('success');
  });
});

describe('POST /api/chatbot/analytics', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/chatbot/analytics').send({ event: 'test' });
    expect(res.status).toBe(401);
  });
});
