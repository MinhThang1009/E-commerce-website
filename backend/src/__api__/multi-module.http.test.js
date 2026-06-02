/**
 * HTTP tests cho các module nhỏ:
 * attribute, content, search-history, inventory, discount-code
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const {
  User,
  Category,
  Brand,
  AttributeGroup,
  AttributeValue,
  SearchHistory,
  InventoryLog,
  DiscountCode,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let admin, staffToken, user, userToken;
let prod, variant, cat, brand;
let attrGroupId, attrValueId;

beforeAll(async () => {
  ({ user: admin, token: staffToken } = await createTestUser({
    email: `__http_misc_admin_${TS}@t.com`,
    role: 'staff',
  }));
  ({ user, token: userToken } = await createTestUser({
    email: `__http_misc_user_${TS}@t.com`,
    role: 'customer',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (attrValueId) await AttributeValue.destroy({ where: { id: attrValueId }, force: true });
  if (attrGroupId) await AttributeGroup.destroy({ where: { id: attrGroupId }, force: true });
  await SearchHistory.destroy({ where: { userId: user?.id }, force: true });
  await DiscountCode.destroy({ where: { code: { [Op.like]: `HTTP-MISC-${TS}%` } }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (prod) await prod.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
  if (user) await user.destroy({ force: true }).catch(() => {});
});

// ── Attributes ───────────────────────────────────────────────
describe('GET /api/attributes/groups', () => {
  test('public → 200', async () => {
    const res = await request(app).get('/api/attributes/groups');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/attributes/groups', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/attributes/groups').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
  test('admin → 201', async () => {
    const res = await request(app)
      .post('/api/attributes/groups')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_AttrG_${TS}`, type: 'config' });
    expect([200, 201]).toContain(res.status);
    attrGroupId = res.body.data?.id || res.body.data?.group?.id;
  });
});

describe('GET /api/attributes/products/:productId/groups', () => {
  test('→ 200', async () => {
    const res = await request(app).get(`/api/attributes/products/${prod.id}/groups`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/attributes/groups/:groupId/values', () => {
  test('admin → 201', async () => {
    if (!attrGroupId) return;
    const res = await request(app)
      .post(`/api/attributes/groups/${attrGroupId}/values`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_Val_${TS}`, value: `val_${TS}` });
    expect([200, 201]).toContain(res.status);
    attrValueId = res.body.data?.id || res.body.data?.value?.id;
  });
});

describe('PUT /api/attributes/values/:id', () => {
  test('admin → 200', async () => {
    if (!attrValueId) return;
    const res = await request(app)
      .put(`/api/attributes/values/${attrValueId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_Val_Updated_${TS}` });
    expect([200, 201]).toContain(res.status);
  });
});

// ── Content — Contact/Feedback ───────────────────────────────
describe('POST /api/contact/feedback', () => {
  test('→ 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/contact/feedback')
      .send({
        name: '__HTTP Test',
        email: `__http_fb_${TS}@t.com`,
        subject: 'Test',
        content: 'Test feedback',
      });
    expect([200, 201]).toContain(res.status);
  });
});

// ── Search History ───────────────────────────────────────────
describe('POST /api/search-histories', () => {
  test('guest → 200 hoặc 201', async () => {
    const res = await request(app)
      .post('/api/search-histories')
      .send({ keyword: `http_search_${TS}`, resultsCount: 5 });
    expect([200, 201]).toContain(res.status);
  });
});

describe('GET /api/search-histories', () => {
  test('authenticated → 200', async () => {
    const res = await request(app)
      .get('/api/search-histories')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/search-histories');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/search-histories', () => {
  test('authenticated clear all → 200', async () => {
    const res = await request(app)
      .delete('/api/search-histories')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
  });
});

// ── Discount Codes (public apply) ────────────────────────────
describe('POST /api/discount-codes/apply', () => {
  test('mã không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/discount-codes/apply')
      .send({ code: `NOTEXIST_${TS}`, orderAmount: 500000 });
    expect([400, 404]).toContain(res.status);
  });
  test('mã hợp lệ → 200', async () => {
    const dc = await DiscountCode.create({
      code: `HTTP-MISC-${TS}`,
      type: 'percent',
      value: 10,
      minOrderAmount: 0,
      usageLimit: 5,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });
    const res = await request(app)
      .post('/api/discount-codes/apply')
      .send({ code: dc.code, orderAmount: 500000 });
    expect([200, 201]).toContain(res.status);
    await dc.destroy({ force: true });
  });
});

// ── Inventory (admin) ────────────────────────────────────────
describe('GET /api/inventory/logs', () => {
  test('admin → 200', async () => {
    const res = await request(app)
      .get('/api/inventory/logs')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/inventory/logs');
    expect(res.status).toBe(401);
  });
});

// ── Health check ─────────────────────────────────────────────
describe('GET /api/health', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});

// ── Attribute endpoints còn thiếu ────────────────────────────
describe('PUT /api/attributes/groups/:id', () => {
  test('admin → 200 hoặc 404', async () => {
    if (!attrGroupId) return;
    const res = await request(app)
      .put(`/api/attributes/groups/${attrGroupId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: `__HTTP_AttrG_Updated_${Date.now()}` });
    expect([200, 400, 404]).toContain(res.status);
  });
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/attributes/groups/1').send({ name: 'X' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/attributes/groups/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/attributes/groups/1');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/attributes/values/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/attributes/values/1');
    expect(res.status).toBe(401);
  });
  test('admin → 200 hoặc 404', async () => {
    if (!attrValueId) return;
    const res = await request(app)
      .delete(`/api/attributes/values/${attrValueId}`)
      .set('Authorization', `Bearer ${staffToken}`);
    expect([200, 400, 404]).toContain(res.status);
    attrValueId = null;
  });
});

describe('POST /api/attributes/preview-name', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .post('/api/attributes/preview-name')
      .send({ baseName: 'Laptop', selectedAttributes: [], separator: ' ' });
    expect([200, 400]).toContain(res.status);
  });
});

describe('POST /api/attributes/generate-name-realtime', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .post('/api/attributes/generate-name-realtime')
      .send({ baseName: 'Laptop', selectedAttributes: [] });
    expect([200, 400]).toContain(res.status);
  });
});

describe('GET /api/attributes/name-affecting', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/attributes/name-affecting');
    expect(res.status).toBe(200);
  });
});

describe('POST /api/attributes/batch-generate-names', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/attributes/batch-generate-names').send({});
    expect(res.status).toBe(401);
  });
});

// ── Search History còn thiếu ─────────────────────────────────
describe('DELETE /api/search-histories/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/search-histories/1');
    expect(res.status).toBe(401);
  });
  test('authenticated, không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/search-histories/999999999')
      .set('Authorization', `Bearer ${userToken}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── Inventory còn thiếu ──────────────────────────────────────
describe('POST /api/inventory/products/:productId/restock', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/inventory/products/1/restock').send({ quantity: 10 });
    expect(res.status).toBe(401);
  });
  test('customer → 403', async () => {
    const res = await request(app)
      .post(`/api/inventory/products/${prod.id}/restock`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 10 });
    expect(res.status).toBe(403);
  });
});
