/**
 * HTTP tests — Cart edge cases.
 * Kiểm tra: sync không có variantId, sync quantity=0, merge không có guest cart,
 * validate giỏ hàng rỗng, PUT quantity=0 bị từ chối.
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Cart, CartItem } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__HTTP_CartEdge_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  const carts = await Cart.findAll({ where: { userId: user?.id } });
  const cartIds = carts.map((c) => c.id);
  if (cartIds.length) {
    await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true });
  }
  await Cart.destroy({ where: { userId: user?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  await User.destroy({ where: { id: user?.id }, force: true });
});

// ── POST /api/cart/sync ─────────────────────────────────────────

describe('POST /api/cart/sync với item không có variantId → 200', () => {
  // variantId là optional trong schema — item không có variantId phải được chấp nhận
  test('sync items không có variantId → 200', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, quantity: 1 }],
      });

    // Validator cho phép không có variantId; service xử lý gracefully
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/cart/sync với quantity=0 → item không được tạo', () => {
  // Validator: quantity.min(1) → 400 trước khi đến service
  test('sync với quantity=0 → 400 (validator reject)', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, variantId: variant.id, quantity: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

// ── POST /api/cart/merge ────────────────────────────────────────

describe('POST /api/cart/merge không có guest cart → 200 hoặc no-op', () => {
  // Không gửi sessionId cookie → service không tìm thấy guest cart → trả về cart hiện tại
  test('merge khi không có guest cart → 200', async () => {
    const res = await request(app).post('/api/cart/merge').set('Authorization', `Bearer ${token}`);
    // Không có guest cart → service trả về user cart hiện tại (không crash)
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── GET /api/cart/validate ──────────────────────────────────────

describe('GET /api/cart/validate với giỏ hàng rỗng → 200 + valid', () => {
  test('giỏ hàng rỗng vẫn trả về 200', async () => {
    // Xóa giỏ hàng trước để đảm bảo rỗng
    await request(app).delete('/api/cart').set('Authorization', `Bearer ${token}`);

    const res = await request(app)
      .get('/api/cart/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Cart rỗng không phải lỗi — response thành công với danh sách issues rỗng
    expect(res.body.status).toBe('success');
  });
});

// ── PUT /api/cart/items/:id ─────────────────────────────────────

describe('PUT /api/cart/items/:id với quantity=0 → 400', () => {
  // updateCartItemSchema: quantity.min(1) → validator reject trước khi vào service
  test('cập nhật quantity=0 → 400 (validator reject)', async () => {
    // Thêm item vào giỏ để lấy id thực
    const addRes = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 2 });

    // Lấy id của item vừa thêm từ response
    const cartItems = addRes.body?.data?.items || [];
    const itemId = cartItems.length > 0 ? cartItems[0].id : 999999999;

    const res = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 0 });

    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});
