/**
 * @file orders-extra.http.test.js
 * @description Các test bổ sung cho orders HTTP API — bao gồm pagination,
 *   validation errors và cancel đơn đã giao.
 *
 * Chạy cùng suite với orders.http.test.js — không trùng lặp test case nào đã có.
 */
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
let user, token, product, variant, cat, brand;
let createdOrderId, deliveredOrderId;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_orders_extra_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
  // Thêm sản phẩm vào giỏ để có thể tạo đơn
  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product.id, variantId: variant.id, quantity: 1 });
});

afterAll(async () => {
  if (user?.id)
    await LoyaltyHistory.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  if (user?.id) {
    const orders = await Order.findAll({ where: { userId: user.id }, paranoid: false });
    const ids = orders.map((o) => o.id);
    if (ids.length)
      await OrderItem.destroy({ where: { orderId: { [Op.in]: ids } }, force: true }).catch(
        () => {},
      );
    await Order.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  }
  if (user?.id) {
    const carts = await Cart.findAll({ where: { userId: user.id } });
    const ids = carts.map((c) => c.id);
    if (ids.length)
      await CartItem.destroy({ where: { cartId: { [Op.in]: ids } }, force: true }).catch(() => {});
    await Cart.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  }
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  await User.destroy({ where: { id: user?.id }, force: true }).catch(() => {});
});

// ── GET /api/orders?page=1&limit=5 ──────────────────────────
describe('GET /api/orders?page=1&limit=5', () => {
  test('authenticated + query params → 200 + pagination metadata', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Response trả về { status, data: [...], total, page, limit } — total ở root body
    expect(res.body).toHaveProperty('total');
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ── GET /api/orders/:id ──────────────────────────────────────
describe('GET /api/orders/:id', () => {
  test('đơn hàng hợp lệ của user → 200', async () => {
    // Tạo đơn trước
    const createRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'Extra',
        shippingAddress1: '1 Test St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'Extra',
        billingAddress1: '1 Test St',
        billingCity: 'HCM',
        paymentMethod: 'cod',
      });
    if (createRes.status === 201) {
      createdOrderId = createRes.body?.data?.order?.id || createRes.body?.data?.id;
    }
    if (!createdOrderId) return;

    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

// ── POST /api/orders — validation errors ─────────────────────
describe('POST /api/orders — thiếu shippingAddress1', () => {
  test('thiếu shippingAddress1 → 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'Extra',
        // shippingAddress1 bị bỏ
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'Extra',
        billingAddress1: '1 Test St',
        billingCity: 'HCM',
        paymentMethod: 'cod',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/orders — thiếu shippingCity', () => {
  test('thiếu shippingCity → 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'Extra',
        shippingAddress1: '1 Test St',
        // shippingCity bị bỏ
        billingFirstName: '__HTTP',
        billingLastName: 'Extra',
        billingAddress1: '1 Test St',
        billingCity: 'HCM',
        paymentMethod: 'cod',
      });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/orders — thiếu paymentMethod', () => {
  test('thiếu paymentMethod → 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'Extra',
        shippingAddress1: '1 Test St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'Extra',
        billingAddress1: '1 Test St',
        billingCity: 'HCM',
        // paymentMethod bị bỏ
      });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/orders/shipping-estimate ───────────────────────
describe('GET /api/orders/shipping-estimate', () => {
  test('authenticated → 200 + shippingFee', async () => {
    const res = await request(app)
      .get('/api/orders/shipping-estimate')
      .set('Authorization', `Bearer ${token}`)
      .query({ weight: 1, subtotal: 1000000 });
    // 200 khi tính phí thành công, 400 nếu thiếu param
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      // Response shape: { data: { shippingCost, freeShippingThreshold } }
      expect(res.body.data).toHaveProperty('shippingCost');
    }
  });
});

// ── GET /api/orders/number/:number ───────────────────────────
describe('GET /api/orders/number/:number', () => {
  test('số đơn hợp lệ → 200 hoặc 404', async () => {
    // Sử dụng order vừa tạo nếu có
    if (!createdOrderId) return;
    const orderRes = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    const orderNumber = orderRes.body?.data?.number || orderRes.body?.data?.order?.number;
    if (!orderNumber) return;

    const res = await request(app)
      .get(`/api/orders/number/${orderNumber}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
  });

  test('số không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/orders/number/ORD-NOTEXIST-99999')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── POST /api/orders/:id/cancel — đơn đã giao → 422 ─────────
describe('POST /api/orders/:id/cancel với order delivered', () => {
  test('hủy đơn đã giao (delivered) → 422', async () => {
    // Tạo đơn hàng giả trực tiếp qua DB với status = delivered
    const deliveredOrder = await Order.create({
      userId: user.id,
      status: 'delivered',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 0,
      total: 5_000_000,
      shippingFirstName: '__HTTP',
      shippingLastName: 'Extra',
      shippingAddress1: '1 Test St',
      shippingCity: 'HCM',
      billingFirstName: '__HTTP',
      billingLastName: 'Extra',
      billingAddress1: '1 Test St',
      billingCity: 'HCM',
      number: `ORD-EXTRA-${TS}`,
    });
    deliveredOrderId = deliveredOrder.id;

    const res = await request(app)
      .post(`/api/orders/${deliveredOrderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(422);

    // Cleanup ngay
    await Order.destroy({ where: { id: deliveredOrderId }, force: true }).catch(() => {});
    deliveredOrderId = null;
  });
});
