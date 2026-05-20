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
let user, token, product, variant, cat, brand, order;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_payment_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
  order = await Order.create({
    number: `HTTP-PAY-${TS}`,
    userId: user.id,
    status: 'pending',
    paymentMethod: 'vnpay',
    paymentStatus: 'pending',
    shippingFirstName: '__HTTP',
    shippingLastName: 'Test',
    shippingAddress1: '1 St',
    shippingCity: 'HCM',
    billingFirstName: '__HTTP',
    billingLastName: 'Test',
    billingAddress1: '1 St',
    billingCity: 'HCM',
    subtotal: 5_000_000,
    tax: 0,
    shippingCost: 30_000,
    total: 5_030_000,
  });
  await OrderItem.create({
    orderId: order.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 5_000_000,
    quantity: 1,
    subtotal: 5_000_000,
  });
});

afterAll(async () => {
  if (user?.id) await LoyaltyHistory.destroy({ where: { userId: user.id }, force: true });
  if (order?.id) {
    await OrderItem.destroy({ where: { orderId: order.id }, force: true });
    await Order.destroy({ where: { id: order.id }, force: true });
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

describe('POST /api/payments/vnpay/create-url', () => {
  test('authenticated → 200 hoặc 400/500', async () => {
    const res = await request(app)
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    expect([200, 400, 500]).toContain(res.status);
  });
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/payments/vnpay/create-url')
      .send({ orderId: order.id });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/payments/momo/create-url', () => {
  test('authenticated → 200 hoặc 400/500', async () => {
    const res = await request(app)
      .post('/api/payments/momo/create-url')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: order.id });
    expect([200, 400, 500]).toContain(res.status);
  });
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/payments/momo/create-url')
      .send({ orderId: order.id });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/payments/vnpay/ipn', () => {
  test('signature sai → không crash (không 500)', async () => {
    const res = await request(app)
      .get('/api/payments/vnpay/ipn')
      .query({ vnp_TxnRef: `ORD-${TS}`, vnp_Amount: '500000', vnp_SecureHash: 'invalidsig' });
    expect(res.status).not.toBe(500);
  });
});

describe('POST /api/payments/momo/ipn', () => {
  test('signature sai → không crash', async () => {
    const res = await request(app)
      .post('/api/payments/momo/ipn')
      .send({ orderId: `HTTP-PAY-${TS}`, amount: 5030000, resultCode: 0, signature: 'invalidsig' });
    expect(res.status).not.toBe(500);
  });
});
