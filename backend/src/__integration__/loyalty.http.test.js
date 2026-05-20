require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, LoyaltyHistory } = require('@models');

const TS = Date.now();
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_loyalty_${TS}@t.com` }));
});

afterAll(async () => {
  await LoyaltyHistory.destroy({ where: { userId: user?.id }, force: true });
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('GET /api/loyalty', () => {
  test('authenticated → 200 + points', async () => {
    const res = await request(app).get('/api/loyalty').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('points');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/loyalty');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/loyalty/redeem', () => {
  test('points = 0 → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/loyalty/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ points: 0 });
    expect([400, 422]).toContain(res.status);
  });
  test('không đủ điểm → 400', async () => {
    const res = await request(app)
      .post('/api/loyalty/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ points: 999999 });
    expect(res.status).toBe(400);
  });
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/loyalty/redeem').send({ points: 10 });
    expect(res.status).toBe(401);
  });
});
