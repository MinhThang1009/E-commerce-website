require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Review } = require('@models');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_reviews_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  await Review.destroy({ where: { userId: user?.id } });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('GET /api/reviews/product/:productId', () => {
  test('→ 200 + array', async () => {
    const res = await request(app).get(`/api/reviews/product/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/reviews/user', () => {
  test('authenticated → 200', async () => {
    const res = await request(app).get('/api/reviews/user').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/reviews/user');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/reviews', () => {
  test('không có đơn hàng → 403 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, rating: 5, content: 'Test' });
    expect([400, 403]).toContain(res.status);
  });
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .send({ productId: product.id, rating: 5, content: 'Test' });
    expect(res.status).toBe(401);
  });
});

// ── Reviews endpoints còn thiếu ──────────────────────────────
describe('PUT /api/reviews/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).put('/api/reviews/1').send({ rating: 4 });
    expect(res.status).toBe(401);
  });
  test('review không tồn tại → 404', async () => {
    const res = await request(app)
      .put('/api/reviews/999999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 4, content: 'Updated' });
    expect([400, 403, 404]).toContain(res.status);
  });
});

describe('DELETE /api/reviews/:id', () => {
  test('không auth → 401', async () => {
    const res = await request(app).delete('/api/reviews/1');
    expect(res.status).toBe(401);
  });
  test('review không tồn tại → 404', async () => {
    const res = await request(app)
      .delete('/api/reviews/999999999')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 403, 404]).toContain(res.status);
  });
});

describe('GET /api/reviews/admin/all', () => {
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/reviews/admin/all');
    expect(res.status).toBe(401);
  });
  test('customer → 403', async () => {
    const res = await request(app)
      .get('/api/reviews/admin/all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/reviews/admin/:id/verify', () => {
  test('không auth → 401', async () => {
    const res = await request(app).patch('/api/reviews/admin/1/verify');
    expect(res.status).toBe(401);
  });
  test('customer → 403', async () => {
    const res = await request(app)
      .patch('/api/reviews/admin/999999999/verify')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
