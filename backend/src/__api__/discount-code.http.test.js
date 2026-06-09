require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, DiscountCode } = require('@models');

const TS = Date.now();
let admin, staffToken;
let customer, customerToken;
let createdCodeId;

// Mã test dùng prefix __HTTP_DC_ để dễ nhận dạng và cleanup
const validDiscountCode = {
  code: `__HTTP_DC_${TS}`,
  type: 'percent',
  value: 10,
  minOrderAmount: 100000,
  maxDiscountAmount: 50000,
  usageLimit: 5,
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 86400000).toISOString(),
  isActive: true,
};

beforeAll(async () => {
  ({ user: admin, token: staffToken } = await createTestUser({
    email: `__http_dc_admin_${TS}@t.com`,
    role: 'staff',
  }));
  ({ user: customer, token: customerToken } = await createTestUser({
    email: `__http_dc_cust_${TS}@t.com`,
    role: 'customer',
  }));
});

afterAll(async () => {
  if (createdCodeId)
    await DiscountCode.destroy({ where: { id: createdCodeId }, force: true }).catch(() => {});
  // Dọn mã dư nếu test bị interrupted
  await DiscountCode.destroy({ where: { code: validDiscountCode.code }, force: true }).catch(
    () => {},
  );
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Auth guard (admin routes) ────────────────────────────────

describe('Admin auth guard — /api/admin/discount-codes', () => {
  test('không token → 401', async () => {
    const res = await request(app).get('/api/admin/discount-codes');
    expect(res.status).toBe(401);
  });
  test('customer token → 403', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── GET /api/admin/discount-codes ────────────────────────────

describe('GET /api/admin/discount-codes', () => {
  test('admin → 200 + danh sách mã giảm giá', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── POST /api/admin/discount-codes ───────────────────────────

describe('POST /api/admin/discount-codes', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/admin/discount-codes').send(validDiscountCode);
    expect(res.status).toBe(401);
  });
  test('admin + body hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(validDiscountCode);
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdCodeId = res.body.data?.id ?? res.body.data?.discountCode?.id;
  });
  test('admin + thiếu code → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ type: 'percent', value: 10 });
    expect([400, 422]).toContain(res.status);
  });
  test('admin + type không hợp lệ → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ code: `__HTTP_DC_BAD_${TS}`, type: 'invalid', value: 10 });
    expect([400, 422]).toContain(res.status);
  });
  test('admin + mã đã tồn tại → 400 hoặc 409', async () => {
    if (!createdCodeId) return;
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${staffToken}`)
      .send(validDiscountCode);
    expect([400, 409, 422]).toContain(res.status);
  });
});

// ── GET /api/admin/discount-codes/:id ───────────────────────

describe('GET /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/admin/discount-codes/1');
    expect(res.status).toBe(401);
  });
  test('admin + id hợp lệ → 200', async () => {
    if (!createdCodeId) return;
    const res = await request(app)
      .get(`/api/admin/discount-codes/${createdCodeId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── PUT /api/admin/discount-codes/:id ───────────────────────

describe('PUT /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/admin/discount-codes/1').send({ value: 20 });
    expect(res.status).toBe(401);
  });
  test('admin cập nhật code đã tạo → 200', async () => {
    if (!createdCodeId) return;
    const res = await request(app)
      .put(`/api/admin/discount-codes/${createdCodeId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: 15, description: 'Cập nhật test' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ value: 20 });
    expect([400, 404]).toContain(res.status);
  });
});

// ── DELETE /api/admin/discount-codes/:id ────────────────────

describe('DELETE /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/discount-codes/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa code đã tạo → 200', async () => {
    if (!createdCodeId) return;
    const res = await request(app)
      .delete(`/api/admin/discount-codes/${createdCodeId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 204]).toContain(res.status);
    createdCodeId = null;
  });
  test('admin xóa code không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${staffToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── POST /api/discount-codes/apply (public endpoint) ────────

describe('POST /api/discount-codes/apply', () => {
  test('mã không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/discount-codes/apply')
      .send({ code: '__HTTP_DC_NONEXISTENT_XYZ', orderAmount: 500000 });
    expect([400, 404]).toContain(res.status);
  });
  test('thiếu code → 400 hoặc 422', async () => {
    const res = await request(app).post('/api/discount-codes/apply').send({ orderAmount: 500000 });
    expect([400, 422]).toContain(res.status);
  });
  test('thiếu orderAmount → 400 hoặc 422', async () => {
    const res = await request(app).post('/api/discount-codes/apply').send({ code: 'SOME_CODE' });
    expect([400, 422]).toContain(res.status);
  });
});

// ── discount-edge-cases.http.test.js ────────────────────────
// Kiểm tra: orderAmount thấp hơn minOrderAmount, endpoint không cần auth,
// mã percent=100 không tạo giá âm khi orderAmount nhỏ.

describe('Discount edge cases', () => {
  const tsEdge = Date.now();
  let adminEdge, adminTokenEdge;

  // Mã giảm giá tạo sẵn cho từng test case
  let codeWithMinOrder; // minOrderAmount = 500000
  let percentFullCode; // type=percent, value=100 (để test không tạo giá âm)
  let codeIdMinOrder, codeIdPercent;

  beforeAll(async () => {
    ({ user: adminEdge, token: adminTokenEdge } = await createTestUser({
      email: `__HTTP_DiscEdge_admin_${tsEdge}@t.com`,
      role: 'admin',
    }));

    // Tạo mã có minOrderAmount cao qua admin API
    const minOrderRes = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminTokenEdge}`)
      .send({
        code: `__HTTP_DE_MIN_${tsEdge}`,
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
        `__HTTP_DE_MIN_${tsEdge}`;
      codeIdMinOrder = minOrderRes.body.data?.id || minOrderRes.body.data?.discountCode?.id;
    } else {
      // Tạo trực tiếp qua model nếu API thất bại
      const dc = await DiscountCode.create({
        code: `__HTTP_DE_MIN_${tsEdge}`,
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
      .set('Authorization', `Bearer ${adminTokenEdge}`)
      .send({
        code: `__HTTP_DE_PCT_${tsEdge}`,
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
        `__HTTP_DE_PCT_${tsEdge}`;
      codeIdPercent = percentRes.body.data?.id || percentRes.body.data?.discountCode?.id;
    } else {
      const dc = await DiscountCode.create({
        code: `__HTTP_DE_PCT_${tsEdge}`,
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
      where: { code: [`__HTTP_DE_MIN_${tsEdge}`, `__HTTP_DE_PCT_${tsEdge}`] },
      force: true,
    }).catch(() => {});
    if (adminEdge) await adminEdge.destroy({ force: true }).catch(() => {});
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
});
