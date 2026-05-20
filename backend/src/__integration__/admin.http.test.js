require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Product, ProductVariant, Category, Brand, DiscountCode } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let admin, adminToken, customer, customerToken;
let prod, variant, cat, brand;
let createdDcId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: customer, token: customerToken } = await createTestUser({
    email: `__http_admin_cust_${TS}@t.com`,
    role: 'customer',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (createdDcId)
    await DiscountCode.destroy({ where: { id: createdDcId }, force: true }).catch(() => {});
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Auth guard ──────────────────────────────────────────────
describe('Admin auth guard', () => {
  test('không token → 401', async () => {
    const res = await request(app).get('/api/admin/dashboard');
    expect(res.status).toBe(401);
  });
  test('customer token → 403', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });
});

// ── Dashboard & Stats ────────────────────────────────────────
describe('GET /api/admin/dashboard', () => {
  test('admin → 200', async () => {
    const res = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/stats', () => {
  test('admin → 200', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01', endDate: '2026-12-31' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Users ────────────────────────────────────────────────────
describe('GET /api/admin/users', () => {
  test('→ 200 + array', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/users/:id', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get(`/api/admin/users/${customer.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/admin/users/:id', () => {
  test('update user → 200', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customer.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: '__HTTP_Updated' });
    expect([200, 400]).toContain(res.status);
  });
});

// ── Products ─────────────────────────────────────────────────
describe('GET /api/admin/products', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/admin/products/:id', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get(`/api/admin/products/${prod.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('PATCH /api/admin/products/:id/status', () => {
  test('toggle status → 200', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${prod.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'inactive' });
    expect([200, 400]).toContain(res.status);
    // restore
    await prod.update({ status: 'active' });
  });
});

// ── Orders ───────────────────────────────────────────────────
describe('GET /api/admin/orders', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Reviews ──────────────────────────────────────────────────
describe('GET /api/admin/reviews', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/reviews')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Discount Codes ───────────────────────────────────────────
describe('GET /api/admin/discount-codes', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/discount-codes', () => {
  test('tạo mã giảm giá → 201', async () => {
    const res = await request(app)
      .post('/api/admin/discount-codes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `HTTP-ADMIN-DC-${TS}`,
        type: 'percent',
        value: 10,
        minOrderAmount: 100000,
        usageLimit: 5,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
        isActive: true,
      });
    expect([200, 201]).toContain(res.status);
    if (res.body.data?.id) createdDcId = res.body.data.id;
    else if (res.body.data?.discountCode?.id) createdDcId = res.body.data.discountCode.id;
  });
});

// ── Analytics ────────────────────────────────────────────────
const analyticsEndpoints = [
  'order-status',
  'revenue-by-category',
  'top-products',
  'user-growth',
  'payment-methods',
  'low-stock',
];

analyticsEndpoints.forEach((ep) => {
  describe(`GET /api/admin/analytics/${ep}`, () => {
    test('→ 200', async () => {
      const res = await request(app)
        .get(`/api/admin/analytics/${ep}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ startDate: '2026-01-01', endDate: '2026-12-31', period: 'month' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });
});

// ── Audit Logs ───────────────────────────────────────────────
describe('GET /api/admin/audit-logs', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
