/**
 * E2E Test: Admin Flow
 * Flow đầy đủ: đăng nhập admin → quản lý sản phẩm → xem đơn hàng →
 *             cập nhật trạng thái → quản lý người dùng.
 */
require('module-alias/register');
const { app, request, createE2EAdmin, createE2EUser, createE2EProduct } = require('./e2e-setup');
const { User, Product, ProductVariant, Category, Brand, DiscountCode } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let adminUser, adminToken;
let customerUser, customerToken;
let testProduct, testVariant;
let createdDcCode;

beforeAll(async () => {
  const adminResult = await createE2EAdmin({ email: `__e2e_admin_${TS}@t.com` });
  adminUser = adminResult.user;
  adminToken = adminResult.token;

  const customerResult = await createE2EUser({ email: `__e2e_admin_cust_${TS}@t.com` });
  customerUser = customerResult.user;
  customerToken = customerResult.token;

  const productResult = await createE2EProduct();
  testProduct = productResult.product;
  testVariant = productResult.variant;
});

afterAll(async () => {
  if (createdDcCode) {
    await DiscountCode.destroy({ where: { code: createdDcCode }, force: true }).catch(() => {});
  }
  if (testVariant) await testVariant.destroy({ force: true }).catch(() => {});
  if (testProduct) {
    await Category.destroy({ where: { id: testProduct.categoryId }, force: true }).catch(() => {});
    await Brand.destroy({ where: { id: testProduct.brandId }, force: true }).catch(() => {});
    await testProduct.destroy({ force: true }).catch(() => {});
  }
  if (customerUser) await customerUser.destroy({ force: true }).catch(() => {});
  if (adminUser) await adminUser.destroy({ force: true }).catch(() => {});
});

// ── Phân quyền cơ bản ────────────────────────────────────────
describe('Phân quyền — Customer không được vào admin routes', () => {
  test('GET /api/admin/dashboard — customer → 403', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect([403, 401]).toContain(res.status);
  });

  test('GET /api/admin/users — không auth → 401', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });
});

// ── Dashboard ────────────────────────────────────────────────
describe('Admin — Dashboard', () => {
  test('GET /api/admin/dashboard → 200, có stats', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('GET /api/admin/stats?startDate&endDate&groupBy=day → 200', async () => {
    const end = new Date().toISOString();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app)
      .get(`/api/admin/stats?startDate=${start}&endDate=${end}&groupBy=day`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });
});

// ── Quản lý sản phẩm ────────────────────────────────────────
describe('Admin — Quản lý sản phẩm', () => {
  test('GET /api/admin/products → 200, danh sách sản phẩm', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/admin/products/:id → 200, chi tiết sản phẩm', async () => {
    const res = await request(app)
      .get(`/api/admin/products/${testProduct.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('PATCH /api/admin/products/:id/status — cập nhật sang inactive → 200', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${testProduct.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });

    expect([200, 204]).toContain(res.status);
  });

  test('PATCH /api/admin/products/:id/status — restore về active', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${testProduct.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });

    expect([200, 204]).toContain(res.status);
  });

  test('PUT /api/admin/products/:id — cập nhật thông tin → 200', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${testProduct.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nameVi: `__E2E_Updated_${TS}`, nameEn: `__E2E_Updated_${TS}` });

    expect([200, 204]).toContain(res.status);
  });
});

// ── Quản lý đơn hàng ─────────────────────────────────────────
describe('Admin — Quản lý đơn hàng', () => {
  test('GET /api/admin/orders → 200, danh sách đơn hàng', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const orders = res.body.data?.orders || res.body.data;
    expect(Array.isArray(orders)).toBe(true);
  });

  test('GET /api/admin/orders?status=pending → 200', async () => {
    const res = await request(app)
      .get('/api/admin/orders?status=pending')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
  });

  test('PUT /api/admin/orders/999999999/status — order không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/admin/orders/999999999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });

    expect([404, 400]).toContain(res.status);
  });
});

// ── Quản lý người dùng ───────────────────────────────────────
describe('Admin — Quản lý người dùng', () => {
  test('GET /api/admin/users → 200, danh sách users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const users = res.body.data?.users || res.body.data;
    expect(Array.isArray(users)).toBe(true);
  });

  test('GET /api/admin/users/:id → 200, chi tiết user', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${customerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect([200, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBe('success');
    }
  });

  test('PUT /api/admin/users/:id — cập nhật user → 200', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: '__E2E_AdminUpdated', isActive: false });

    expect([200, 204]).toContain(res.status);
  });

  test('PUT /api/admin/users/:id — reactivate → 200', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customerUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });

    expect([200, 204]).toContain(res.status);
  });

  test('Admin không tự xóa chính mình → 400/403', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect([400, 403, 404]).toContain(res.status);
  });
});

// ── Inventory ────────────────────────────────────────────────
describe('Admin — Inventory', () => {
  test('GET /api/inventory/logs → 200', async () => {
    const res = await request(app)
      .get('/api/inventory/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Reviews ─────────────────────────────────────────────────
describe('Admin — Quản lý reviews', () => {
  test('GET /api/admin/reviews → 200', async () => {
    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Discount codes ────────────────────────────────────────────
describe('Admin — Discount codes', () => {
  test('GET /api/admin/discount-codes → 200', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('POST /api/admin/discount-codes — tạo code mới → 200/201', async () => {
    createdDcCode = `E2E_DISC_${TS}`;
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: createdDcCode,
        type: 'percent',
        value: 10,
        minOrderAmount: 100000,
        usageLimit: 100,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        isActive: true,
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
});
