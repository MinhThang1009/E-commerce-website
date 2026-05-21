require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, WarrantyPackage, Category, Brand, Product, ProductVariant } = require('@models');

const TS = Date.now();
let admin, adminToken, customer, customerToken;
let prod, variant, cat, brand;
let createdPackageId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_warranty_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: customer, token: customerToken } = await createTestUser({
    email: `__http_warranty_cust_${TS}@t.com`,
    role: 'customer',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (createdPackageId)
    await WarrantyPackage.destroy({ where: { id: createdPackageId }, force: true }).catch(() => {});
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

const validPackageBody = () => ({
  name: `__HTTP_WARRANTY_${TS}`,
  durationMonths: 12,
  price: 500000,
  description: 'Gói bảo hành test',
});

// ── Public GET ───────────────────────────────────────────────
describe('GET /api/warranty-packages', () => {
  test('không cần auth → 200 + warrantyPackages array', async () => {
    const res = await request(app).get('/api/warranty-packages');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // getAll trả về { warrantyPackages: [...], pagination: {...} }
    expect(Array.isArray(res.body.data.warrantyPackages)).toBe(true);
  });
});

describe('GET /api/warranty-packages/product/:productId', () => {
  test('productId hợp lệ → 200', async () => {
    const res = await request(app).get(`/api/warranty-packages/product/${prod.id}`);
    expect(res.status).toBe(200);
  });

  test('productId không tồn tại → 200 với array rỗng hoặc 404', async () => {
    const res = await request(app).get('/api/warranty-packages/product/999999999');
    expect([200, 404]).toContain(res.status);
  });
});

describe('GET /api/warranty-packages/:id', () => {
  test('id không tồn tại → 404', async () => {
    const res = await request(app).get('/api/warranty-packages/999999999');
    expect(res.status).toBe(404);
  });
});

// ── Admin POST ───────────────────────────────────────────────
describe('POST /api/warranty-packages', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/warranty-packages').send(validPackageBody());
    expect(res.status).toBe(401);
  });

  test('customer token → 403', async () => {
    const res = await request(app)
      .post('/api/warranty-packages')
      .set('Authorization', `Bearer ${customerToken}`)
      .send(validPackageBody());
    expect(res.status).toBe(403);
  });

  test('admin + body hợp lệ → 201', async () => {
    const res = await request(app)
      .post('/api/warranty-packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(validPackageBody());
    expect(res.status).toBe(201);
    expect(res.body.data ?? res.body).toHaveProperty('id');
    createdPackageId = (res.body.data ?? res.body).id;
  });

  test('admin + thiếu trường bắt buộc → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/warranty-packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'chỉ có description' });
    expect([400, 422]).toContain(res.status);
  });
});

// ── Admin PUT ────────────────────────────────────────────────
describe('PUT /api/warranty-packages/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .put(`/api/warranty-packages/${createdPackageId ?? 1}`)
      .send({ price: 600000 });
    expect(res.status).toBe(401);
  });

  test('admin + id hợp lệ → 200', async () => {
    if (!createdPackageId) return; // bỏ qua nếu POST bước trên thất bại
    const res = await request(app)
      .put(`/api/warranty-packages/${createdPackageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 600000 });
    expect(res.status).toBe(200);
  });

  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/warranty-packages/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 600000 });
    expect(res.status).toBe(404);
  });
});

// ── Admin DELETE ─────────────────────────────────────────────
describe('DELETE /api/warranty-packages/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete(`/api/warranty-packages/${createdPackageId ?? 1}`);
    expect(res.status).toBe(401);
  });

  test('admin + id hợp lệ → 200', async () => {
    if (!createdPackageId) return;
    const res = await request(app)
      .delete(`/api/warranty-packages/${createdPackageId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    createdPackageId = null; // đã xóa, không cần cleanup afterAll nữa
  });

  test('admin + id không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/warranty-packages/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });
});
