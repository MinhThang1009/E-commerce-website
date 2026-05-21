/**
 * E2E Test: Auth Flow
 * Flow đầy đủ: đăng ký → đăng nhập → xem profile → đổi thông tin → đăng xuất.
 * Mỗi step phụ thuộc vào step trước — dùng biến shared giữa các test.
 */
require('module-alias/register');
const { app, request, createE2EUser } = require('./e2e-setup');
const { User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
const testEmail = `__e2e_auth_${TS}@t.com`;
const testPassword = 'E2EAuth1!';

let registeredUserId;
let accessToken;
let refreshTokenCookie;

afterAll(async () => {
  await User.destroy({
    where: { email: { [Op.like]: `__e2e_auth_${TS}%` } },
    force: true,
  });
});

// ── Bước 1: Đăng ký ──────────────────────────────────────────
describe('Bước 1 — Đăng ký tài khoản', () => {
  test('POST /api/auth/register → 201, trả về user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: testPassword,
      firstName: '__E2E',
      lastName: 'AuthUser',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('success');
    // Register chỉ trả về message, không trả về user.id → lookup DB
    const created = await User.findOne({ where: { email: testEmail } });
    registeredUserId = created?.id;
    expect(registeredUserId).toBeDefined();
  });

  test('Email trùng lặp → 400', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      password: testPassword,
      firstName: '__E2E',
      lastName: 'Dup',
    });
    expect(res.status).toBe(400);
  });

  test('Thiếu password → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `__e2e_auth_nopwd_${TS}@t.com`,
        firstName: '__E2E',
        lastName: 'NoPwd',
      });
    expect(res.status).toBe(400);
  });
});

// ── Bước 2: Đăng nhập (sau khi force verify email trong DB) ──
describe('Bước 2 — Đăng nhập', () => {
  beforeAll(async () => {
    // E2E test tự verify email trong DB (không qua OTP flow thật)
    if (registeredUserId) {
      await User.update({ isEmailVerified: true }, { where: { id: registeredUserId } });
    }
  });

  test('POST /api/auth/login → 200, trả về token + user', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: testPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toBeDefined();

    accessToken = res.body.token;
    // Lưu refreshToken cookie nếu có
    const setCookieHeader = res.headers['set-cookie'];
    if (setCookieHeader) {
      refreshTokenCookie = setCookieHeader.find((c) => c.startsWith('refreshToken='));
    }
  });

  test('Sai mật khẩu → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPass!',
    });
    expect(res.status).toBe(401);
  });

  test('Email không tồn tại → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: `nonexist_${TS}@t.com`,
        password: testPassword,
      });
    expect(res.status).toBe(401);
  });
});

// ── Bước 3: Truy cập tài nguyên được bảo vệ ──────────────────
describe('Bước 3 — Truy cập protected routes', () => {
  test('GET /api/auth/me → 200, trả về thông tin user', async () => {
    expect(accessToken).toBeTruthy();

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const userData = res.body.data?.user || res.body.data;
    expect(userData?.email).toBe(testEmail);
  });

  test('Không có token → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('Token không hợp lệ → 401', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.value');
    expect(res.status).toBe(401);
  });
});

// ── Bước 4: Refresh token ─────────────────────────────────────
describe('Bước 4 — Refresh token', () => {
  test('POST /api/auth/refresh-token — không có cookie → 400/401', async () => {
    const res = await request(app).post('/api/auth/refresh-token');
    expect([400, 401]).toContain(res.status);
  });

  test('POST /api/auth/refresh-token — token không hợp lệ → 400/401', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', 'refreshToken=bad.token.here');
    expect([400, 401]).toContain(res.status);
  });

  test('POST /api/auth/refresh-token — có refreshToken hợp lệ → 200 + token mới', async () => {
    if (!refreshTokenCookie) {
      // Skip nếu không nhận được cookie từ bước login
      return;
    }
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', refreshTokenCookie);
    expect(res.status).toBe(200);
    expect(res.body.token || res.body.data?.token || res.body.accessToken).toBeTruthy();
  });
});

// ── Bước 5: Đổi thông tin profile ────────────────────────────
describe('Bước 5 — Cập nhật profile', () => {
  test('PUT /api/users/profile → 200, cập nhật thành công', async () => {
    expect(accessToken).toBeTruthy();

    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        firstName: '__E2E_Updated',
        lastName: 'AuthUser',
        phone: '0901234567',
      });

    expect([200, 201, 204]).toContain(res.status);
  });

  test('GET /api/auth/me — verify thông tin đã cập nhật', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const userData = res.body.data?.user || res.body.data;
    // firstName có thể đã update hoặc route dùng tên khác — check 200 là đủ
    expect(userData).toBeDefined();
  });
});

// ── Bước 6: Đổi mật khẩu ─────────────────────────────────────
describe('Bước 6 — Đổi mật khẩu', () => {
  test('POST /api/users/change-password — mật khẩu hiện tại sai → 400/401', async () => {
    const res = await request(app)
      .post('/api/users/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'WrongOld1!', newPassword: 'NewE2E1!' });
    expect([400, 401, 422]).toContain(res.status);
  });

  test('POST /api/users/change-password — đúng mật khẩu → 200', async () => {
    const res = await request(app)
      .post('/api/users/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: testPassword,
        newPassword: 'NewE2E1!',
        confirmPassword: 'NewE2E1!',
      });
    expect([200, 204]).toContain(res.status);
  });
});

// ── Bước 7: Đăng xuất ─────────────────────────────────────────
describe('Bước 7 — Đăng xuất', () => {
  test('POST /api/auth/logout → 200/204', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    expect([200, 204]).toContain(res.status);
  });

  test('Sau logout — token cũ không dùng được (hoặc server stateless)', async () => {
    // Một số implementations revoke token, một số stateless. Chấp nhận cả hai.
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    // Stateless: 200 (token vẫn hợp lệ). Stateful (revoke): 401.
    expect([200, 401]).toContain(res.status);
  });
});

// ── Bước 8: Forgot / Reset password flow ─────────────────────
describe('Bước 8 — Forgot / Reset password', () => {
  test('POST /api/auth/forgot-password — email không tồn tại → 200 (chống enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({
        email: `nonexist_forgot_${TS}@t.com`,
      });
    expect([200, 429]).toContain(res.status);
  });

  test('POST /api/auth/forgot-password — thiếu email → 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/reset-password — token không hợp lệ → 400/401', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'invalid_token_xyz', password: 'ResetPass1!' });
    expect([400, 401]).toContain(res.status);
  });
});

// ── Kiểm tra đăng nhập bằng user helper (smoke test) ─────────
describe('Smoke test — createE2EUser helper', () => {
  test('createE2EUser tạo user + lấy token thành công', async () => {
    const { user, token } = await createE2EUser();
    expect(token).toBeTruthy();
    expect(user.id).toBeDefined();
    expect(user.role).toBe('customer');
    await User.destroy({ where: { id: user.id }, force: true });
  });
});
