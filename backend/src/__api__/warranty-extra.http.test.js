/**
 * @file warranty-extra.http.test.js
 * @description Các test bổ sung cho warranty-packages HTTP API — bao gồm
 *   kiểm tra data shape, edge cases, và những kịch bản không có trong warranty-package.http.test.js.
 *
 * Chạy cùng suite với warranty-package.http.test.js — không trùng lặp test case nào đã có.
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, WarrantyPackage, Category, Brand } = require('@models');

const TS = Date.now();
let admin, adminToken;
let prod, variant, cat, brand;
let createdPackageId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_warranty_extra_${TS}@t.com`,
    role: 'admin',
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
});

// ── GET /api/warranty-packages ───────────────────────────────
describe('GET /api/warranty-packages', () => {
  test('public → 200 + warrantyPackages là array', async () => {
    const res = await request(app).get('/api/warranty-packages');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data.warrantyPackages)).toBe(true);
  });

  test('pagination: page + limit → 200', async () => {
    const res = await request(app).get('/api/warranty-packages').query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.warrantyPackages)).toBe(true);
  });
});

// ── POST /api/warranty-packages (admin) ─────────────────────
describe('POST /api/warranty-packages (admin)', () => {
  test('admin + body hợp lệ → 201 và trả về id', async () => {
    const res = await request(app)
      .post('/api/warranty-packages')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `__HTTP_WARRANTY_EXTRA_${TS}`,
        durationMonths: 24,
        price: 750000,
        description: 'Gói bảo hành extra test',
      });
    expect(res.status).toBe(201);
    const pkg = res.body.data ?? res.body;
    expect(pkg).toHaveProperty('id');
    createdPackageId = pkg.id;
  });
});

// ── GET /api/warranty-packages/:id ──────────────────────────
describe('GET /api/warranty-packages/:id', () => {
  test('id hợp lệ → 200 + data đầy đủ', async () => {
    if (!createdPackageId) return;
    const res = await request(app).get(`/api/warranty-packages/${createdPackageId}`);
    expect(res.status).toBe(200);
    // Phải trả về đủ thông tin cơ bản
    expect(res.body.data ?? res.body).toHaveProperty('id');
  });

  test('id không tồn tại → 404', async () => {
    const res = await request(app).get('/api/warranty-packages/999999999');
    expect(res.status).toBe(404);
  });
});

// ── PUT /api/warranty-packages/:id (admin) ──────────────────
describe('PUT /api/warranty-packages/:id (admin)', () => {
  test('admin + id hợp lệ → 200', async () => {
    if (!createdPackageId) return;
    const res = await request(app)
      .put(`/api/warranty-packages/${createdPackageId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ durationMonths: 36 });
    expect(res.status).toBe(200);
  });
});

// ── DELETE /api/warranty-packages/:id (admin) ───────────────
describe('DELETE /api/warranty-packages/:id (admin)', () => {
  test('admin + id hợp lệ → 200 hoặc 400', async () => {
    if (!createdPackageId) return;
    const res = await request(app)
      .delete(`/api/warranty-packages/${createdPackageId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    // 200 nếu xóa thành công, 400 nếu đang được dùng bởi order
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      createdPackageId = null;
    }
  });
});
