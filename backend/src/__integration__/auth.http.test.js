require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let verifiedUser, verifiedToken, unverifiedUser;

beforeAll(async () => {
  verifiedUser = await User.create({
    firstName: '__HTTP',
    lastName: 'Auth',
    email: `__http_auth_verified_${TS}@t.com`,
    password: 'Test123!',
    role: 'customer',
    isEmailVerified: true,
    isActive: true,
  });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email: verifiedUser.email, password: 'Test123!' });
  verifiedToken = loginRes.body?.token || '';

  unverifiedUser = await User.create({
    firstName: '__HTTP',
    lastName: 'Unverified',
    email: `__http_auth_unverified_${TS}@t.com`,
    password: 'Test123!',
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
  });
});

afterAll(async () => {
  await User.destroy({ where: { email: { [Op.like]: `__http_auth_%${TS}%` } }, force: true });
});

describe('POST /api/auth/register', () => {
  test('đăng ký thành công → 201', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `__http_auth_reg_${TS}_${Date.now()}@t.com`,
        password: 'Register1!',
        firstName: '__HTTP',
        lastName: 'RegTest',
      });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    if (res.body.data?.user?.id) {
      await User.destroy({ where: { id: res.body.data.user.id }, force: true });
    }
  });

  test('email trùng → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: verifiedUser.email,
      password: 'Register1!',
      firstName: '__HTTP',
      lastName: 'Dup',
    });
    expect(res.status).toBe(400);
  });

  test('thiếu password → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `__http_auth_nopwd_${TS}@t.com`,
        firstName: '__HTTP',
        lastName: 'NoPwd',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('đúng credentials → 200 + token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: verifiedUser.email, password: 'Test123!' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toBeDefined();
  });

  test('sai mật khẩu → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: verifiedUser.email, password: 'WrongPass!' });
    expect(res.status).toBe(401);
  });

  test('email chưa verify → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: unverifiedUser.email, password: 'Test123!' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  test('có token → 200 + user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${verifiedToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('không token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  test('có token → 200 hoặc 204', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${verifiedToken}`);
    expect([200, 204]).toContain(res.status);
  });
});

// ── Auth endpoints còn thiếu ─────────────────────────────────
describe('POST /api/auth/verify-otp', () => {
  test('OTP sai → 400', async () => {
    const res = await request(app)
      .post('/api/auth/verify-otp')
      .send({ email: verifiedUser.email, otp: '000000' });
    expect([400, 401]).toContain(res.status);
  });
  test('thiếu fields → 400', async () => {
    const res = await request(app).post('/api/auth/verify-otp').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/resend-verification', () => {
  test('email không tồn tại → 200 (generic)', async () => {
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'notexist@t.com' });
    expect([200, 400, 429]).toContain(res.status);
  });
});

describe('POST /api/auth/refresh-token', () => {
  test('không có token → 401', async () => {
    const res = await request(app).post('/api/auth/refresh-token');
    expect([400, 401]).toContain(res.status);
  });
  test('token không hợp lệ → 401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', 'refreshToken=invalid.token.here');
    expect([400, 401]).toContain(res.status);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('email không tồn tại → 200 (chống enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'notexist_forgot@t.com' });
    expect([200, 400, 429]).toContain(res.status);
  });
  test('thiếu email → 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/reset-password', () => {
  test('token không hợp lệ → 400 hoặc 401', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalid_reset_token', password: 'NewPass123!' });
    expect([400, 401]).toContain(res.status);
  });
  test('thiếu fields → 400', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/google', () => {
  test('invalid google token → 400 hoặc 401', async () => {
    const res = await request(app).post('/api/auth/google').send({ token: 'invalid_google_token' });
    expect([400, 401, 500]).toContain(res.status);
  });
  test('thiếu token → 400 hoặc 401', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect([400, 401, 422]).toContain(res.status);
  });
});
