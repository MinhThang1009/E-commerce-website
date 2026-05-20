require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Wishlist } = require('@models');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_wishlist_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  await Wishlist.destroy({ where: { userId: user?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('GET /api/wishlists', () => {
  test('authenticated → 200', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/wishlists');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/wishlists', () => {
  test('thêm → 201 hoặc 200', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id });
    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/wishlists/check/:productId', () => {
  test('→ 200 + inWishlist boolean', async () => {
    const res = await request(app)
      .get(`/api/wishlists/check/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.data?.inWishlist).toBe('boolean');
  });
});

describe('DELETE /api/wishlists/:productId', () => {
  test('xóa → 200', async () => {
    await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id });
    const res = await request(app)
      .delete(`/api/wishlists/${product.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
