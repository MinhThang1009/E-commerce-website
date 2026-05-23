/**
 * HTTP tests — Payment edge cases.
 * Kiểm tra: thiếu orderId, order của user khác, orderId không tồn tại,
 * IPN không có signature, VNPay return với hash giả.
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Order, OrderItem, Cart, CartItem } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let userA, tokenA, userB, tokenB;
let product, variant, cat, brand;
let orderOfA; // Order thuộc userA — dùng để test userB không được tạo payment URL

beforeAll(async () => {
  ({ user: userA, token: tokenA } = await createTestUser({
    email: `__HTTP_PayEdge_a_${TS}@t.com`,
  }));
  ({ user: userB, token: tokenB } = await createTestUser({
    email: `__HTTP_PayEdge_b_${TS}@t.com`,
  }));
  ({ product, variant, cat, brand } = await createTestProduct());

  // Tạo order pending thuộc userA — method momo để test endpoint momo
  orderOfA = await Order.create({
    number: `HTTP-PAY-EDGE-${TS}`,
    userId: userA.id,
    status: 'pending',
    paymentMethod: 'momo',
    paymentStatus: 'pending',
    shippingFirstName: '__HTTP',
    shippingLastName: 'PayEdge',
    shippingAddress1: '1 Edge St',
    shippingCity: 'HCM',
    billingFirstName: '__HTTP',
    billingLastName: 'PayEdge',
    billingAddress1: '1 Edge St',
    billingCity: 'HCM',
    subtotal: 5_000_000,
    tax: 0,
    shippingCost: 30_000,
    total: 5_030_000,
  });
  await OrderItem.create({
    orderId: orderOfA.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 5_000_000,
    quantity: 1,
    subtotal: 5_000_000,
  });
});

afterAll(async () => {
  const userIds = [userA?.id, userB?.id].filter(Boolean);

  if (orderOfA?.id) {
    await OrderItem.destroy({ where: { orderId: orderOfA.id }, force: true });
    await Order.destroy({ where: { id: orderOfA.id }, force: true });
  }

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

// ── POST /api/payments/momo/create-url ─────────────────────────

describe('POST /api/payments/momo/create-url thiếu orderId → 400', () => {
  // Validator: orderId bắt buộc phải là số nguyên dương
  test('body rỗng → 400', async () => {
    const res = await request(app)
      .post('/api/payments/momo/create-url')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

describe('POST /api/payments/momo/create-url với order của user khác → 403 hoặc 404', () => {
  // userB cố tạo payment URL cho order của userA
  test('userB dùng orderId của userA → 403 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/payments/momo/create-url')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ orderId: orderOfA.id });

    expect([400, 403, 404]).toContain(res.status);
    expect(res.body.status).not.toBe('success');
  });
});

// ── POST /api/payments/vnpay/create-url ────────────────────────

describe('POST /api/payments/vnpay/create-url với orderId không tồn tại → 404 hoặc 400', () => {
  test('orderId 999999999 → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: 999999999 });

    expect([400, 404]).toContain(res.status);
    expect(res.body.status).not.toBe('success');
  });
});

// ── POST /api/payments/momo/ipn ────────────────────────────────

describe('POST /api/payments/momo/ipn không có field signature → không crash (không 500)', () => {
  // IPN từ MoMo có thể đến với payload không hoàn chỉnh — phải xử lý gracefully
  test('payload thiếu signature → 200 hoặc 400, không 500', async () => {
    const res = await request(app)
      .post('/api/payments/momo/ipn')
      .send({
        orderId: `HTTP-PAY-EDGE-${TS}`,
        amount: 5030000,
        resultCode: 0,
        // signature không có trong payload — mô phỏng tampered/incomplete IPN
      });

    expect(res.status).not.toBe(500);
    expect([200, 400]).toContain(res.status);
  });
});

// ── GET /api/payments/vnpay/return ─────────────────────────────

describe('GET /api/payments/vnpay/return với hash giả → redirect hoặc không crash', () => {
  // Return callback từ VNPay với signature sai — phải redirect về frontend với trạng thái lỗi,
  // không được crash server
  test('vnp_SecureHash không hợp lệ → 302 redirect hoặc 200, không 500', async () => {
    const res = await request(app)
      .get('/api/payments/vnpay/return')
      .query({
        vnp_TxnRef: `ORD-EDGE-${TS}`,
        vnp_Amount: '5030000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_SecureHash: 'tampered_hash_xyz_invalid',
      });

    // Dù hash sai, server phải xử lý gracefully — redirect về FE hoặc trả 200
    expect(res.status).not.toBe(500);
    expect([200, 302, 400]).toContain(res.status);
  });
});
