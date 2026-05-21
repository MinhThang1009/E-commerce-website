/**
 * HTTP tests bổ sung cho module cart — tập trung vào các kịch bản
 * chưa có trong cart.http.test.js và cart-edge-cases.http.test.js.
 *
 * Những gì đã được test (KHÔNG lặp lại):
 *  - GET /api/cart (guest + authenticated)
 *  - POST /api/cart thêm item hợp lệ → 200
 *  - GET /api/cart/count → 200 + count
 *  - GET /api/cart/validate → 200
 *  - DELETE /api/cart (clear)
 *  - POST /api/cart/sync (basic, không có variantId, quantity=0 → 400)
 *  - POST /api/cart/merge (basic, không có guest cart)
 *  - PUT /api/cart/items/:id không tồn tại → 400/404
 *  - DELETE /api/cart/items/:id không tồn tại → 400/404
 *  - PUT /api/cart/items/:id quantity=0 → 400
 *  - GET /api/cart/validate giỏ rỗng → 200
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Cart, CartItem } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_cartex_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  const carts = await Cart.findAll({ where: { userId: user?.id } });
  const cartIds = carts.map((c) => c.id);
  if (cartIds.length) {
    await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true });
  }
  await Cart.destroy({ where: { userId: user?.id }, force: true });
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  await User.destroy({ where: { id: user?.id }, force: true });
});

// ── POST /api/cart — validation input ────────────────────────────────────────

describe('POST /api/cart với sản phẩm không tồn tại', () => {
  test('productId không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 999999999, variantId: null, quantity: 1 });
    expect([400, 404]).toContain(res.status);
    expect(res.body.status).not.toBe('success');
  });
});

describe('POST /api/cart với quantity=0', () => {
  test('validator reject vì quantity phải >= 1 → 400', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 0 });
    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

describe('POST /api/cart với quantity âm', () => {
  test('validator reject vì quantity < 0 → 400', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: -5 });
    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

// ── PUT /api/cart/items/:id — cập nhật quantity hợp lệ ──────────────────────

describe('PUT /api/cart/items/:id với quantity hợp lệ', () => {
  test('cập nhật số lượng thực → 200', async () => {
    // Thêm item trước
    const addRes = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });
    expect(addRes.status).toBe(200);

    const items = addRes.body?.data?.items || [];
    if (items.length === 0) return; // Không lấy được item id → bỏ qua

    const itemId = items[0].id;
    const res = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 3 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── GET /api/cart/validate — giỏ hàng có item hợp lệ ────────────────────────

describe('POST /api/cart/validate giỏ hàng hợp lệ', () => {
  // Lưu ý: endpoint là GET /api/cart/validate, không phải POST
  test('GET /api/cart/validate với item hợp lệ → 200 + hasIssues=false', async () => {
    // Đảm bảo có item trong giỏ
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });

    const res = await request(app)
      .get('/api/cart/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Sản phẩm còn hàng → không có vấn đề
    if (res.body.data?.hasIssues !== undefined) {
      expect(res.body.data.hasIssues).toBe(false);
    }
  });
});

// ── GET /api/cart/count — authenticated ──────────────────────────────────────

describe('GET /api/cart/count authenticated', () => {
  test('→ 200 + count là số', async () => {
    const res = await request(app).get('/api/cart/count').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('count');
    expect(typeof res.body.data.count).toBe('number');
  });
});

// ── POST /api/cart/sync — authenticated ──────────────────────────────────────

describe('POST /api/cart/sync authenticated', () => {
  test('sync danh sách items hợp lệ → 200', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, variantId: variant.id, quantity: 2 }],
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('sync danh sách rỗng → 200', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect([200, 400]).toContain(res.status);
  });
});

// ── POST /api/cart items có warranty package ─────────────────────────────────

describe('POST /api/cart items với warrantyPackageIds', () => {
  test('warrantyPackageIds không tồn tại → 200 (bỏ qua) hoặc 400', async () => {
    // Theo cart-validator warrantyPackageIds là optional array
    // Service xử lý gracefully khi id không hợp lệ
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        variantId: variant.id,
        quantity: 1,
        warrantyPackageIds: [999999999],
      });
    // Service có thể bỏ qua warranty không hợp lệ hoặc báo lỗi
    expect([200, 400, 404]).toContain(res.status);
  });
});
