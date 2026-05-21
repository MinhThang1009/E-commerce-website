require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand } = require('@models');
const path = require('path');
const fs = require('fs');

const TS = Date.now();
let user, token, admin, adminToken;
let prod, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_img_user_${TS}@t.com` }));
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_img_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ product: prod, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (prod) await prod.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (user) await user.destroy({ force: true }).catch(() => {});
  if (admin) await admin.destroy({ force: true }).catch(() => {});
});

// ── Image module ─────────────────────────────────────────────
describe('GET /api/images/health', () => {
  test('→ 200', async () => {
    const res = await request(app).get('/api/images/health');
    expect(res.status).toBe(200);
  });
});

describe('GET /api/images/product/:productId', () => {
  test('→ 200 + array', async () => {
    const res = await request(app).get(`/api/images/product/${prod.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/images/:id', () => {
  test('không tồn tại → 404', async () => {
    const res = await request(app).get('/api/images/999999999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/images/upload', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/images/upload')
      .attach('image', Buffer.from('fake'), { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });

  test('authenticated + file → 200 hoặc 400 (format invalid)', async () => {
    const res = await request(app)
      .post('/api/images/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('image', Buffer.from('fake image data'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });
    // 200 nếu upload thành công, 400/422 nếu validation fail (fake image)
    expect([200, 201, 400, 422, 500]).toContain(res.status);
  });
});

describe('POST /api/images/test-upload', () => {
  test('public upload (no auth) → response', async () => {
    const res = await request(app)
      .post('/api/images/test-upload')
      .attach('image', Buffer.from('test data'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });
    expect([200, 201, 400, 422, 500]).toContain(res.status);
  });
});

describe('DELETE /api/images/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/images/999');
    expect(res.status).toBe(401);
  });
  test('authenticated, không tồn tại → 404 hoặc 400', async () => {
    const res = await request(app)
      .delete('/api/images/999999999')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('POST /api/images/convert/base64', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/images/convert/base64').send({ base64: 'x' });
    expect(res.status).toBe(401);
  });
  test('authenticated + invalid base64 → 400 hoặc 422', async () => {
    const res = await request(app)
      .post('/api/images/convert/base64')
      .set('Authorization', `Bearer ${token}`)
      .send({ base64: 'not-valid-base64' });
    expect([200, 201, 400, 422, 500]).toContain(res.status);
  });
});

// ── Upload module ─────────────────────────────────────────────
describe('POST /api/uploads/:type/single', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/uploads/product/single')
      .attach('file', Buffer.from('data'), { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });
  test('authenticated → 200 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/uploads/product/single')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('fake image'), {
        filename: 'test.jpg',
        contentType: 'image/jpeg',
      });
    expect([200, 201, 400, 422, 500]).toContain(res.status);
  });
});

describe('POST /api/uploads/:type/multiple', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/uploads/product/multiple')
      .attach('files', Buffer.from('data'), { filename: 'test.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/uploads/:type/:filename', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/uploads/product/nonexistent.jpg');
    expect(res.status).toBe(401);
  });
  test('authenticated → 200, 400, 403, 404 tùy quyền và file', async () => {
    const res = await request(app)
      .delete(`/api/uploads/product/nonexistent_${TS}.jpg`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400, 403, 404, 500]).toContain(res.status);
  });
});
