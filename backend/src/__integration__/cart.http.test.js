require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Cart, CartItem } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_cart_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  const carts = await Cart.findAll({ where: { userId: user?.id } });
  const ids = carts.map((c) => c.id);
  if (ids.length) await CartItem.destroy({ where: { cartId: { [Op.in]: ids } }, force: true });
  await Cart.destroy({ where: { userId: user?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('GET /api/cart', () => {
  test('guest → 200', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('authenticated → 200', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/cart', () => {
  test('thêm item → 200', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/cart/count', () => {
  test('→ 200 + count', async () => {
    const res = await request(app).get('/api/cart/count').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('count');
  });
});

describe('GET /api/cart/validate', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .get('/api/cart/validate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/cart', () => {
  test('clear → 200', async () => {
    const res = await request(app).delete('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});
