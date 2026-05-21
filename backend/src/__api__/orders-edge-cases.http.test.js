/**
 * HTTP tests — Orders edge cases.
 * Kiểm tra: paymentMethod không hợp lệ, xem order của user khác, hủy đơn đã delivered,
 * track order không tồn tại, admin cập nhật trạng thái.
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const {
  User,
  Category,
  Brand,
  Order,
  OrderItem,
  LoyaltyHistory,
  Cart,
  CartItem,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let userA, tokenA, userB, tokenB, admin, adminToken;
let product, variant, cat, brand;
let deliveredOrder;

beforeAll(async () => {
  ({ user: userA, token: tokenA } = await createTestUser({
    email: `__http_ord_edge_a_${TS}@t.com`,
  }));
  ({ user: userB, token: tokenB } = await createTestUser({
    email: `__http_ord_edge_b_${TS}@t.com`,
  }));
  ({ user: admin, token: adminToken } = await createTestUser({
    email: `__http_ord_edge_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ product, variant, cat, brand } = await createTestProduct());

  // Tạo đơn hàng trạng thái delivered cho userA — dùng cho test cancel
  deliveredOrder = await Order.create({
    number: `HTTP-ORD-EDGE-DELIV-${TS}`,
    userId: userA.id,
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    shippingFirstName: '__HTTP',
    shippingLastName: 'EdgeOrders',
    shippingAddress1: '1 Edge St',
    shippingCity: 'HCM',
    billingFirstName: '__HTTP',
    billingLastName: 'EdgeOrders',
    billingAddress1: '1 Edge St',
    billingCity: 'HCM',
    subtotal: 5_000_000,
    tax: 0,
    shippingCost: 30_000,
    total: 5_030_000,
  });
  await OrderItem.create({
    orderId: deliveredOrder.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 5_000_000,
    quantity: 1,
    subtotal: 5_000_000,
  });
});

afterAll(async () => {
  // Dọn LoyaltyHistory của cả 3 users
  const userIds = [userA?.id, userB?.id, admin?.id].filter(Boolean);
  if (userIds.length) {
    await LoyaltyHistory.destroy({ where: { userId: { [Op.in]: userIds } }, force: true });
  }

  // Dọn tất cả orders của userA và userB
  if (userA?.id) {
    const orders = await Order.findAll({ where: { userId: userA.id }, paranoid: false });
    const ids = orders.map((o) => o.id);
    if (ids.length) {
      await OrderItem.destroy({ where: { orderId: { [Op.in]: ids } }, force: true });
    }
    await Order.destroy({ where: { userId: userA.id }, force: true });
  }
  if (userB?.id) {
    await Order.destroy({ where: { userId: userB.id }, force: true });
  }

  // Dọn cart
  for (const uid of userIds) {
    const carts = await Cart.findAll({ where: { userId: uid } });
    const cartIds = carts.map((c) => c.id);
    if (cartIds.length) {
      await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true });
    }
    await Cart.destroy({ where: { userId: uid }, force: true });
  }

  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({ where: { id: { [Op.in]: userIds } }, force: true });
});

describe('POST /api/orders với paymentMethod không hợp lệ → 400', () => {
  test('paymentMethod rỗng → 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'EdgeOrders',
        shippingAddress1: '1 Edge St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'EdgeOrders',
        billingAddress1: '1 Edge St',
        billingCity: 'HCM',
        paymentMethod: '', // rỗng → validator reject
      });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/orders/:id của user khác → 404', () => {
  test('userB xem order của userA → 404', async () => {
    // deliveredOrder thuộc userA — userB không được xem
    const res = await request(app)
      .get(`/api/orders/${deliveredOrder.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(res.status);
  });
});

describe('POST /api/orders/:id/cancel khi status=delivered → 422', () => {
  test('hủy đơn hàng đã delivered → 422', async () => {
    const res = await request(app)
      .post(`/api/orders/${deliveredOrder.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(422);
  });
});

describe('GET /api/orders/track với orderNumber không tồn tại → 400 hoặc 404', () => {
  test('orderNumber không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .get('/api/orders/track')
      .query({ number: `NOTEXIST-${TS}` });

    // Controller xử lý trực tiếp: 400 khi thiếu param, 404 khi không tìm thấy
    expect([400, 404]).toContain(res.status);
    // Dù 400 hay 404, body phải có status 'error' (không phải 'success')
    expect(res.body.status).toBe('error');
  });
});

describe('PATCH /api/orders/admin/:id/status → 200 với valid status transition', () => {
  let pendingOrder;

  beforeAll(async () => {
    // Tạo đơn hàng pending để admin cập nhật
    pendingOrder = await Order.create({
      number: `HTTP-ORD-EDGE-ADMIN-${TS}`,
      userId: userA.id,
      status: 'pending',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      shippingFirstName: '__HTTP',
      shippingLastName: 'AdminEdge',
      shippingAddress1: '1 Admin St',
      shippingCity: 'HCM',
      billingFirstName: '__HTTP',
      billingLastName: 'AdminEdge',
      billingAddress1: '1 Admin St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });
  });

  test('admin cập nhật status pending → processing → 200', async () => {
    const res = await request(app)
      .patch(`/api/orders/admin/${pendingOrder.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'processing' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('customer cố cập nhật status → 403', async () => {
    const res = await request(app)
      .patch(`/api/orders/admin/${pendingOrder.id}/status`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'shipped' });

    expect(res.status).toBe(403);
  });

  test('status không hợp lệ → 400', async () => {
    const res = await request(app)
      .patch(`/api/orders/admin/${pendingOrder.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'unknown_status' });

    expect(res.status).toBe(400);
  });
});
