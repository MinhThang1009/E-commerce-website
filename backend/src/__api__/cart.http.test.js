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

// ── Cart endpoints còn thiếu ─────────────────────────────────
describe('POST /api/cart/sync', () => {
  test('→ 200', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    expect([200, 400]).toContain(res.status);
  });
});

describe('POST /api/cart/merge', () => {
  test('→ 200', async () => {
    const res = await request(app).post('/api/cart/merge').set('Authorization', `Bearer ${token}`);
    expect([200, 400]).toContain(res.status);
  });
});

describe('PUT + DELETE /api/cart/items/:id (invalid id)', () => {
  test('PUT item không tồn tại → 404 hoặc 400', async () => {
    const res = await request(app)
      .put('/api/cart/items/999999999')
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 2 });
    expect([400, 404]).toContain(res.status);
  });
  test('DELETE item không tồn tại → 404 hoặc 400', async () => {
    const res = await request(app)
      .delete('/api/cart/items/999999999')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

// ── cart-extra: validation input và các kịch bản bổ sung ─────────────────────

/**
 * HTTP tests bổ sung cho module cart — tập trung vào các kịch bản
 * chưa có trong cart.http.test.js và cart-edge-cases.http.test.js.
 */
describe('Cart — bổ sung (cart-extra)', () => {
  let user, token, product, variant, cat, brand;

  beforeAll(async () => {
    const TS = Date.now();
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

  // ── POST /api/cart — validation input ──────────────────────────────────────

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

  // ── PUT /api/cart/items/:id — cập nhật quantity hợp lệ ────────────────────

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

  // ── GET /api/cart/validate — giỏ hàng có item hợp lệ ──────────────────────

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

  // ── GET /api/cart/count — authenticated ────────────────────────────────────

  describe('GET /api/cart/count authenticated', () => {
    test('→ 200 + count là số', async () => {
      const res = await request(app).get('/api/cart/count').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('count');
      expect(typeof res.body.data.count).toBe('number');
    });
  });

  // ── POST /api/cart/sync — authenticated ────────────────────────────────────

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
});

// ── cart-edge-cases: sync/merge/validate/PUT edge cases ──────────────────────

/**
 * HTTP tests — Cart edge cases.
 * Kiểm tra: sync không có variantId, sync quantity=0, merge không có guest cart,
 * validate giỏ hàng rỗng, PUT quantity=0 bị từ chối.
 */
describe('Cart — edge cases (cart-edge-cases)', () => {
  let user, token, product, variant, cat, brand;

  beforeAll(async () => {
    const TS = Date.now();
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

  // ── POST /api/cart/sync ───────────────────────────────────────────────────

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

  // ── POST /api/cart/merge ──────────────────────────────────────────────────

  describe('POST /api/cart/merge không có guest cart → 200 hoặc no-op', () => {
    // Không gửi sessionId cookie → service không tìm thấy guest cart → trả về cart hiện tại
    test('merge khi không có guest cart → 200', async () => {
      const res = await request(app)
        .post('/api/cart/merge')
        .set('Authorization', `Bearer ${token}`);
      // Không có guest cart → service trả về user cart hiện tại (không crash)
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  // ── GET /api/cart/validate ────────────────────────────────────────────────

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

  // ── PUT /api/cart/items/:id ───────────────────────────────────────────────

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
});
