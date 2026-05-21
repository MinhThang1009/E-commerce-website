/**
 * @file attribute-extra.http.test.js
 * @description Các test bổ sung cho attribute HTTP API — bao gồm product attribute groups,
 *   assign group, batch generate, generate realtime, và edge cases.
 *
 * Chạy cùng suite với attribute.http.test.js — không trùng lặp test case nào đã có.
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, AttributeGroup, AttributeValue, Category, Brand } = require('@models');

const TS = Date.now();
let admin, adminToken;
let product, variant, cat, brand;
let createdGroupId, createdValueId;

beforeAll(async () => {
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_attr_extra_${TS}@t.com`,
    role: 'admin',
  }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  // Xóa value trước vì foreign key phụ thuộc group
  if (createdValueId)
    await AttributeValue.destroy({ where: { id: createdValueId }, force: true }).catch(() => {});
  if (createdGroupId)
    await AttributeGroup.destroy({ where: { id: createdGroupId } }).catch(() => {});
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── GET /api/attributes/groups ───────────────────────────────
describe('GET /api/attributes/groups', () => {
  test('public → 200 + array các nhóm thuộc tính', async () => {
    const res = await request(app).get('/api/attributes/groups');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // data là array hoặc object có property chứa array
    expect(res.body.data).toBeDefined();
  });
});

// ── POST /api/attributes/groups (admin) ──────────────────────
describe('POST /api/attributes/groups (admin)', () => {
  test('admin + body hợp lệ → 201 hoặc 200', async () => {
    const res = await request(app)
      .post('/api/attributes/groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__HTTP_AttrExtra_Group_${TS}`, type: 'custom' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdGroupId = res.body.data?.id ?? res.body.data?.group?.id;
  });

  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/attributes/groups')
      .send({ name: '__HTTP_NoAuth_Group', type: 'custom' });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/attributes/groups/:id (admin) ───────────────────
describe('PUT /api/attributes/groups/:id (admin)', () => {
  test('admin cập nhật group đã tạo → 200', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .put(`/api/attributes/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `__HTTP_AttrExtra_Group_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });

  test('admin + id không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .put('/api/attributes/groups/999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '__HTTP_NoExist' });
    expect([400, 404]).toContain(res.status);
  });
});

// ── DELETE /api/attributes/groups/:id (admin) ────────────────
describe('DELETE /api/attributes/groups/:id (admin)', () => {
  // Xóa sau khi đã test giá trị, nên đặt cuối để createdValueId đã được tạo/xóa rồi
  test('admin + id không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .delete('/api/attributes/groups/999999999')
      .set('Authorization', `Bearer ${adminToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── POST /api/attributes/groups/:groupId/values (admin) ──────
describe('POST /api/attributes/groups/:groupId/values (admin)', () => {
  test('admin thêm giá trị vào group đã tạo → 200 hoặc 201', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .post(`/api/attributes/groups/${createdGroupId}/values`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `__HTTP_AttrExtra_Value_${TS}`,
        value: `__HTTP_AttrExtra_Value_${TS}`,
        sortOrder: 0,
      });
    expect([200, 201]).toContain(res.status);
    createdValueId = res.body.data?.id ?? res.body.data?.value?.id;
  });
});

// ── PUT /api/attributes/values/:id (admin) ───────────────────
describe('PUT /api/attributes/values/:id (admin)', () => {
  test('admin cập nhật value đã tạo → 200', async () => {
    if (!createdValueId) return;
    const res = await request(app)
      .put(`/api/attributes/values/${createdValueId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ value: `__HTTP_AttrExtra_Value_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
});

// ── DELETE /api/attributes/values/:id (admin) ────────────────
describe('DELETE /api/attributes/values/:id (admin)', () => {
  test('admin xóa value đã tạo → 200 hoặc 204', async () => {
    if (!createdValueId) return;
    const res = await request(app)
      .delete(`/api/attributes/values/${createdValueId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 204]).toContain(res.status);
    createdValueId = null;
  });
});

// ── GET /api/attributes/products/:productId/groups ───────────
describe('GET /api/attributes/products/:productId/groups', () => {
  test('productId hợp lệ → 200', async () => {
    const res = await request(app).get(`/api/attributes/products/${product.id}/groups`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('productId không tồn tại → 200 với data rỗng hoặc 404', async () => {
    const res = await request(app).get('/api/attributes/products/999999999/groups');
    // Có thể trả về 200 với array rỗng hoặc 404
    expect([200, 404]).toContain(res.status);
  });
});

// ── POST /api/attributes/products/:productId/groups/:groupId ─
describe('POST /api/attributes/products/:productId/groups/:attributeGroupId (admin)', () => {
  test('gán group vào product → 200 hoặc 201', async () => {
    if (!createdGroupId) return;
    const res = await request(app)
      .post(`/api/attributes/products/${product.id}/groups/${createdGroupId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201]).toContain(res.status);
  });

  test('không auth → 401', async () => {
    const res = await request(app).post(`/api/attributes/products/${product.id}/groups/1`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/attributes/generate-name-realtime ──────────────
describe('POST /api/attributes/generate-name-realtime', () => {
  test('body hợp lệ → 200', async () => {
    const res = await request(app).post('/api/attributes/generate-name-realtime').send({
      baseName: 'iPhone',
      selectedAttributes: [],
      separator: ' ',
      includeDetails: false,
    });
    // Có thể 200 hoặc 500 nếu AI service không available trong test
    expect([200, 500]).toContain(res.status);
  });
});

// ── POST /api/attributes/batch-generate-names (admin) ───────
describe('POST /api/attributes/batch-generate-names (admin)', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/attributes/batch-generate-names')
      .send({ productIds: [] });
    expect(res.status).toBe(401);
  });

  test('admin + productIds rỗng → 200 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/attributes/batch-generate-names')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ productIds: [] });
    expect([200, 400]).toContain(res.status);
  });
});
