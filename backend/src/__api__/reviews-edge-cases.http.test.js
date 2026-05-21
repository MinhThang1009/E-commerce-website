/**
 * HTTP tests — Reviews edge cases.
 * Kiểm tra: rating ngoài [1,5], sửa/xóa review của user khác, GET với pagination,
 * tạo review khi chưa có đơn hàng delivered.
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Order, OrderItem, Review } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let userA, tokenA, userB, tokenB;
let product, variant, cat, brand;
let reviewByA; // Review thuộc userA — dùng cho test ownership

beforeAll(async () => {
  ({ user: userA, token: tokenA } = await createTestUser({
    email: `__http_rev_edge_a_${TS}@t.com`,
  }));
  ({ user: userB, token: tokenB } = await createTestUser({
    email: `__http_rev_edge_b_${TS}@t.com`,
  }));
  ({ product, variant, cat, brand } = await createTestProduct());

  // Tạo đơn hàng delivered cho userA — bắt buộc để review được phép tạo
  const deliveredOrder = await Order.create({
    number: `HTTP-REV-EDGE-ORD-${TS}`,
    userId: userA.id,
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    shippingFirstName: '__HTTP',
    shippingLastName: 'RevEdge',
    shippingAddress1: '1 Rev Edge St',
    shippingCity: 'HCM',
    billingFirstName: '__HTTP',
    billingLastName: 'RevEdge',
    billingAddress1: '1 Rev Edge St',
    billingCity: 'HCM',
    subtotal: 5_000_000,
    tax: 0,
    shippingCost: 0,
    total: 5_000_000,
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

  // Tạo review trực tiếp qua model cho userA — bypass service để test
  // ownership (update/delete) mà không cần gọi lại POST /api/reviews
  reviewByA = await Review.create({
    userId: userA.id,
    productId: product.id,
    rating: 5,
    title: '__HTTP review title',
    content: '__HTTP review content edge case',
    isVerified: true,
  });
});

afterAll(async () => {
  await Review.destroy({ where: { productId: product?.id }, force: true });

  const ordersByA = await Order.findAll({ where: { userId: userA?.id }, paranoid: false });
  const orderIds = ordersByA.map((o) => o.id);
  if (orderIds.length) {
    await OrderItem.destroy({ where: { orderId: { [Op.in]: orderIds } }, force: true });
  }
  await Order.destroy({ where: { userId: userA?.id }, force: true });

  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({
    where: { id: { [Op.in]: [userA?.id, userB?.id].filter(Boolean) } },
    force: true,
  });
});

describe('POST /api/reviews với rating ngoài [1,5] → 400', () => {
  test('rating = 0 → 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
        rating: 0,
        title: '__HTTP bad rating',
        comment: '__HTTP comment',
      });

    expect(res.status).toBe(400);
  });

  test('rating = 6 → 400', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
        rating: 6,
        title: '__HTTP bad rating',
        comment: '__HTTP comment',
      });

    expect(res.status).toBe(400);
  });
});

describe('PUT /api/reviews/:id của user khác → 403 hoặc 404', () => {
  test('userB cố sửa review của userA → 403 hoặc 404', async () => {
    const res = await request(app)
      .put(`/api/reviews/${reviewByA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        productId: product.id,
        rating: 2,
        title: '__HTTP tampered title',
        comment: '__HTTP tampered comment',
      });

    expect([403, 404]).toContain(res.status);
  });
});

describe('DELETE /api/reviews/:id của user khác → 403', () => {
  test('userB cố xóa review của userA → 403 hoặc 404', async () => {
    const res = await request(app)
      .delete(`/api/reviews/${reviewByA.id}`)
      .set('Authorization', `Bearer ${tokenB}`);

    expect([403, 404]).toContain(res.status);

    // Xác nhận review vẫn còn tồn tại sau khi bị từ chối
    const stillExists = await Review.findByPk(reviewByA.id);
    expect(stillExists).not.toBeNull();
  });
});

describe('GET /api/reviews/product/:productId → 200 với pagination', () => {
  test('trả về 200 và có totalPages + currentPage', async () => {
    const res = await request(app)
      .get(`/api/reviews/product/${product.id}`)
      .query({ page: 1, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
    // Kiểm tra shape pagination
    expect(typeof res.body.data.pages).toBe('number');
    expect(res.body.data.currentPage).toBe(1);
    expect(Array.isArray(res.body.data.reviews)).toBe(true);
    // Đảm bảo review của userA có trong kết quả
    expect(res.body.data.reviews.length).toBeGreaterThanOrEqual(1);
  });
});

describe('POST /api/reviews khi chưa có đơn hàng delivered → 400 hoặc 403', () => {
  test('userB không có đơn hàng nào → 400 hoặc 403', async () => {
    // userB không có order nào — service sẽ reject
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        productId: product.id,
        rating: 4,
        title: '__HTTP no order review',
        comment: '__HTTP no order comment',
      });

    expect([400, 403]).toContain(res.status);
  });
});
