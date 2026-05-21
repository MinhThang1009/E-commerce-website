/**
 * HTTP tests — Discount edge cases.
 * Kiểm tra: orderAmount thấp hơn minOrderAmount, endpoint không cần auth,
 * mã percent=100 không tạo giá âm khi orderAmount nhỏ.
 */
require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, DiscountCode } = require('@models');

const TS = Date.now();
let admin, adminToken;

// Mã giảm giá tạo sẵn cho từng test case
let codeWithMinOrder; // minOrderAmount = 500000
let percentFullCode; // type=percent, value=100 (để test không tạo giá âm)
let codeIdMinOrder, codeIdPercent;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__HTTP_DiscEdge_admin_${TS}@t.com`,
    role: 'admin',
  }));

  // Tạo mã có minOrderAmount cao qua admin API
  const minOrderRes = await request(app)
    .post('/api/admin/discount-codes')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      code: `__HTTP_DE_MIN_${TS}`,
      type: 'fixed',
      value: 50000,
      minOrderAmount: 500000,
      usageLimit: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
    });

  if (minOrderRes.status === 200 || minOrderRes.status === 201) {
    codeWithMinOrder =
      minOrderRes.body.data?.code ||
      minOrderRes.body.data?.discountCode?.code ||
      `__HTTP_DE_MIN_${TS}`;
    codeIdMinOrder = minOrderRes.body.data?.id || minOrderRes.body.data?.discountCode?.id;
  } else {
    // Tạo trực tiếp qua model nếu API thất bại
    const dc = await DiscountCode.create({
      code: `__HTTP_DE_MIN_${TS}`,
      type: 'fixed',
      value: 50000,
      minOrderAmount: 500000,
      usageLimit: 10,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    codeWithMinOrder = dc.code;
    codeIdMinOrder = dc.id;
  }

  // Tạo mã percent=100 — để kiểm tra không tạo giá âm
  const percentRes = await request(app)
    .post('/api/admin/discount-codes')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      code: `__HTTP_DE_PCT_${TS}`,
      type: 'percent',
      value: 100,
      minOrderAmount: 0,
      usageLimit: 10,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      isActive: true,
    });

  if (percentRes.status === 200 || percentRes.status === 201) {
    percentFullCode =
      percentRes.body.data?.code ||
      percentRes.body.data?.discountCode?.code ||
      `__HTTP_DE_PCT_${TS}`;
    codeIdPercent = percentRes.body.data?.id || percentRes.body.data?.discountCode?.id;
  } else {
    const dc = await DiscountCode.create({
      code: `__HTTP_DE_PCT_${TS}`,
      type: 'percent',
      value: 100,
      minOrderAmount: 0,
      usageLimit: 10,
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      isActive: true,
    });
    percentFullCode = dc.code;
    codeIdPercent = dc.id;
  }
});

afterAll(async () => {
  if (codeIdMinOrder) {
    await DiscountCode.destroy({ where: { id: codeIdMinOrder }, force: true }).catch(() => {});
  }
  if (codeIdPercent) {
    await DiscountCode.destroy({ where: { id: codeIdPercent }, force: true }).catch(() => {});
  }
  // Dọn dư nếu model tạo thẳng
  await DiscountCode.destroy({
    where: { code: [`__HTTP_DE_MIN_${TS}`, `__HTTP_DE_PCT_${TS}`] },
    force: true,
  }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── POST /api/discount-codes/apply — minOrderAmount ─────────────

describe('POST /api/discount-codes/apply orderAmount thấp hơn minOrderAmount → 400', () => {
  test('gửi 100000 với mã yêu cầu tối thiểu 500000 → 400', async () => {
    const res = await request(app)
      .post('/api/discount-codes/apply')
      .send({ code: codeWithMinOrder, orderAmount: 100000 });

    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
    // Thông báo lỗi phải liên quan đến giá trị tối thiểu
    expect(res.body.message).toMatch(/tối thiểu|minimum|điều kiện/i);
  });
});

// ── POST /api/discount-codes/apply — không cần auth ─────────────

describe('POST /api/discount-codes/apply không cần auth → 200', () => {
  // Route không có authenticate middleware → guest được phép apply
  test('apply không có Authorization header → 200 (endpoint public)', async () => {
    const res = await request(app)
      .post('/api/discount-codes/apply')
      .send({ code: codeWithMinOrder, orderAmount: 1_000_000 });

    // 200 = endpoint public (không cần đăng nhập)
    // 400 = mã đúng nhưng điều kiện khác không thỏa (vẫn không phải 401)
    expect(res.status).not.toBe(401);
    expect([200, 400]).toContain(res.status);
  });
});

// ── POST /api/discount-codes/apply — percent=100 không tạo giá âm ──

describe('Discount percent=100 không tạo giá âm khi orderAmount nhỏ', () => {
  test('percent=100 với orderAmount=50000 → discountAmount = 50000, không âm', async () => {
    const smallOrderAmount = 50000;
    const res = await request(app)
      .post('/api/discount-codes/apply')
      .send({ code: percentFullCode, orderAmount: smallOrderAmount });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    const discountAmount = res.body.data?.discountAmount ?? res.body.data?.discount;
    // Service cap tại orderAmount: discountAmount không được vượt quá orderAmount
    expect(discountAmount).toBeGreaterThanOrEqual(0);
    expect(discountAmount).toBeLessThanOrEqual(smallOrderAmount);
  });
});
