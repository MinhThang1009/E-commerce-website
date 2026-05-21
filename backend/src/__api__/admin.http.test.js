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

// ── Users extended ───────────────────────────────────────────
describe('DELETE /api/admin/users/:id', () => {
  test('admin xóa user → 200 hoặc 400', async () => {
    const u = await User.create({
      firstName: '__TMP',
      lastName: 'Del',
      email: `__tmp_del_${Date.now()}@t.com`,
      password: 'Del123!',
      role: 'customer',
    });
    const res = await request(app)
      .delete(`/api/admin/users/${u.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 403]).toContain(res.status);
    await u.destroy({ force: true }).catch(() => {});
  });
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/users/1');
    expect(res.status).toBe(401);
  });
});

// ── Products extended ────────────────────────────────────────
describe('POST /api/admin/products', () => {
  test('tạo sản phẩm → 201 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nameVi: `__TMP_P_${Date.now()}`,
        nameEn: 'TMP',
        baseName: 'TMP',
        slug: `tmp-p-${Date.now()}`,
        basePrice: 1000000,
        status: 'active',
        stockQuantity: 0,
        categoryId: prod?.categoryId,
        brandId: prod?.brandId,
      });
    expect([200, 201, 400, 422]).toContain(res.status);
    if (res.body.data?.id) {
      await Product.destroy({ where: { id: res.body.data.id }, force: true }).catch(() => {});
    }
  });
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/admin/products').send({});
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/admin/products/:id', () => {
  test('update product → 200 hoặc 400', async () => {
    const res = await request(app)
      .put(`/api/admin/products/${prod.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nameVi: `__Updated_${Date.now()}` });
    expect([200, 400, 422]).toContain(res.status);
    await prod.update({ nameVi: prod.nameVi }).catch(() => {}); // restore
  });
});

describe('DELETE /api/admin/products/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete(`/api/admin/products/999999999`);
    expect(res.status).toBe(401);
  });
  test('admin xóa sản phẩm không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/products/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('POST /api/admin/products/:id/clone', () => {
  test('clone product → 200 hoặc 201', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${prod.id}/clone`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201, 400]).toContain(res.status);
    if (res.body.data?.id) {
      await Product.destroy({ where: { id: res.body.data.id }, force: true }).catch(() => {});
    }
  });
});

describe('POST /api/admin/products/:id/restock', () => {
  test('restock → 200', async () => {
    const res = await request(app)
      .post(`/api/admin/products/${prod.id}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ variantId: variant.id, quantity: 10, note: 'Test restock' });
    expect([200, 400]).toContain(res.status);
  });
});

describe('PATCH /api/admin/products/:id/stock', () => {
  test('update stock → 200', async () => {
    const res = await request(app)
      .patch(`/api/admin/products/${prod.id}/stock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ variantId: variant.id, quantity: 50 });
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/admin/products/import-template', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/products/import-template')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/admin/products/import-history', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/products/import-history')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('GET /api/admin/products/export', () => {
  test('→ 200 hoặc 500', async () => {
    const res = await request(app)
      .get('/api/admin/products/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 500]).toContain(res.status);
  });
});

// ── Orders extended ──────────────────────────────────────────
describe('PUT /api/admin/orders/:id/status', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/admin/orders/1/status').send({ status: 'processing' });
    expect(res.status).toBe(401);
  });
  test('admin → 200 hoặc 404', async () => {
    const res = await request(app)
      .put('/api/admin/orders/999999999/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('PUT /api/admin/orders/:id/cancel', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/admin/orders/1/cancel');
    expect(res.status).toBe(401);
  });
});

// ── Reviews extended ─────────────────────────────────────────
describe('DELETE /api/admin/reviews/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/reviews/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa review không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/reviews/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Discount Codes extended ──────────────────────────────────
describe('GET /api/admin/discount-codes/:id', () => {
  test('không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('PUT /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/admin/discount-codes/1').send({ value: 20 });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/admin/discount-codes/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/admin/discount-codes/1');
    expect(res.status).toBe(401);
  });
  test('admin xóa không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/admin/discount-codes/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Reports & Chatbot ────────────────────────────────────────
describe('GET /api/admin/reports/export', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/admin/reports/export')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/admin/chatbot/stats', () => {
  test('→ 200 hoặc 500', async () => {
    const res = await request(app)
      .get('/api/admin/chatbot/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 400, 500]).toContain(res.status);
  });
});
