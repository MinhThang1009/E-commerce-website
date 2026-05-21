/**
 * HTTP tests — Auth edge cases.
 * Kiểm tra: mật khẩu quá ngắn, mật khẩu thiếu số, tài khoản bị vô hiệu hóa,
 * email không tồn tại, anti-enumeration forgot-password, refresh-token không hợp lệ.
 */
require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let inactiveUser;

beforeAll(async () => {
  // Tạo user với isActive=false để test đăng nhập bị chặn
  inactiveUser = await User.create({
    firstName: '__HTTP',
    lastName: 'AuthEdge',
    email: `__HTTP_AuthEdge_inactive_${TS}@t.com`,
    password: 'Test123!',
    role: 'customer',
    isEmailVerified: true,
    isActive: false,
  });
});

afterAll(async () => {
  await User.destroy({
    where: { email: { [Op.like]: `__HTTP_AuthEdge_%${TS}%` } },
    force: true,
  }).catch(() => {});
  // Dọn user đăng ký thành công trong test (nếu có)
  await User.destroy({
    where: { email: { [Op.like]: `__HTTP_AuthEdge_reg_%` } },
    force: true,
  }).catch(() => {});
});

// ── POST /api/auth/register — password validation ────────────────

describe('POST /api/auth/register mật khẩu quá ngắn (<8 ký tự) → 400', () => {
  test('password "ab" → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `__HTTP_AuthEdge_short_${TS}@t.com`,
        password: 'ab',
        firstName: '__HTTP',
        lastName: 'AuthEdge',
      });

    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

describe('POST /api/auth/register mật khẩu không có số → 400', () => {
  // Validator yêu cầu: min 8 ký tự + 1 chữ hoa + 1 chữ thường + 1 chữ số
  // Password không có số → validator reject → 400
  test('password "Abcdefgh" (không có số) → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: `__HTTP_AuthEdge_nodigit_${TS}@t.com`,
        password: 'Abcdefgh',
        firstName: '__HTTP',
        lastName: 'AuthEdge',
      });

    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

// ── POST /api/auth/login — account isActive=false ───────────────

describe('POST /api/auth/login account isActive=false → 401', () => {
  test('đăng nhập với tài khoản bị vô hiệu hóa → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: inactiveUser.email, password: 'Test123!' });

    expect(res.status).toBe(401);
    expect(res.body.status).not.toBe('success');
  });
});

// ── POST /api/auth/login — email không tồn tại ──────────────────

describe('POST /api/auth/login email không tồn tại → 401', () => {
  test('email nonexistent@test.com → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent_xyzzy_12345@test.com', password: 'Test123!' });

    expect(res.status).toBe(401);
    expect(res.body.status).not.toBe('success');
  });
});

// ── POST /api/auth/forgot-password — anti-enumeration ───────────

describe('POST /api/auth/forgot-password generic response bất kể email có tồn tại hay không → 200', () => {
  test('email tồn tại và email không tồn tại trả về cùng status code', async () => {
    // Tạo user thật để test với email tồn tại
    const realUser = await createTestUser({
      email: `__HTTP_AuthEdge_forgot_real_${TS}@t.com`,
    });

    const [existRes, notExistRes] = await Promise.all([
      request(app).post('/api/auth/forgot-password').send({ email: realUser.user.email }),
      request(app)
        .post('/api/auth/forgot-password')
        .send({ email: `__HTTP_AuthEdge_forgot_ghost_${TS}@t.com` }),
    ]);

    // Cả hai phải trả về cùng status (thường là 200) để không lộ thông tin user
    expect(existRes.status).toBe(notExistRes.status);
    // Không được là 404 (sẽ lộ rằng email không tồn tại)
    expect(existRes.status).not.toBe(404);

    await realUser.user.destroy({ force: true }).catch(() => {});
  });
});

// ── POST /api/auth/refresh-token — token không hợp lệ ──────────

describe('POST /api/auth/refresh-token với token không hợp lệ → 401', () => {
  test('random string token → 400 hoặc 401', async () => {
    const randomToken = 'this.is.definitely.not.a.valid.refresh.token.abc123xyz';
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .set('Cookie', `refreshToken=${randomToken}`);

    expect([400, 401]).toContain(res.status);
    expect(res.body.status).not.toBe('success');
  });
});
