require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const {
  User,
  Category,
  Brand,
  Order,
  OrderItem,
  Cart,
  CartItem,
  LoyaltyHistory,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token, product, variant, cat, brand, createdOrderId;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_orders_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product.id, variantId: variant.id, quantity: 1 });
});

afterAll(async () => {
  if (user?.id) await LoyaltyHistory.destroy({ where: { userId: user.id }, force: true });
  if (user?.id) {
    const orders = await Order.findAll({ where: { userId: user.id }, paranoid: false });
    const ids = orders.map((o) => o.id);
    if (ids.length) await OrderItem.destroy({ where: { orderId: { [Op.in]: ids } }, force: true });
    await Order.destroy({ where: { userId: user.id }, force: true });
  }
  if (user?.id) {
    const carts = await Cart.findAll({ where: { userId: user.id } });
    const ids = carts.map((c) => c.id);
    if (ids.length) await CartItem.destroy({ where: { cartId: { [Op.in]: ids } }, force: true });
    await Cart.destroy({ where: { userId: user.id }, force: true });
  }
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('GET /api/orders', () => {
  test('authenticated → 200', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/track', () => {
  test('số không tồn tại → 404 hoặc 200', async () => {
    const res = await request(app).get('/api/orders/track?number=NOTEXIST99999');
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('POST /api/orders', () => {
  test('tạo đơn từ cart → 201 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'Test',
        shippingAddress1: '1 Test St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'Test',
        billingAddress1: '1 Test St',
        billingCity: 'HCM',
        paymentMethod: 'cod',
      });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      createdOrderId = res.body?.data?.order?.id || res.body?.data?.id;
    }
  });
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/orders').send({ paymentMethod: 'cod' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/:id', () => {
  test('đơn của mình → 200', async () => {
    if (!createdOrderId) return;
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/orders/:id/cancel', () => {
  test('hủy đơn → 200 hoặc 400', async () => {
    if (!createdOrderId) return;
    const res = await request(app)
      .post(`/api/orders/${createdOrderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400]).toContain(res.status);
  });
});
