require('module-alias/register');
const { app, request, createTestUser } = require('./http-setup');
const { User, DiscountCode } = require('@models');

const TS = Date.now();
let admin, adminToken;
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
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_dc_admin_${TS}@t.com`,
    role: 'admin',
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
      .set('Authorization', `Bearer ${adminToken}`);
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validDiscountCode);
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdCodeId = res.body.data?.id ?? res.body.data?.discountCode?.id;
  });
  test('admin + thiếu code → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'percent', value: 10 });
    expect([400, 422]).toContain(res.status);
  });
  test('admin + type không hợp lệ → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `__HTTP_DC_BAD_${TS}`, type: 'invalid', value: 10 });
    expect([400, 422]).toContain(res.status);
  });
  test('admin + mã đã tồn tại → 400 hoặc 409', async () => {
    if (!createdCodeId) return;
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: 15, description: 'Cập nhật test' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    createdCodeId = null;
  });
  test('admin xóa code không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
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
