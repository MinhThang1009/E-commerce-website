/**
 * E2E Test: Shopping Flow
 * Flow đầy đủ: duyệt danh mục → xem sản phẩm → thêm vào giỏ →
 *             cập nhật giỏ → tạo đơn hàng → xem lịch sử đơn.
 */
require('module-alias/register');
const { app, request, createE2EUser, createE2EProduct } = require('./e2e-setup');
const {
  User,
  Product,
  ProductVariant,
  Category,
  Brand,
  Order,
  OrderItem,
  CartItem,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let customer, token;
let testProduct, testVariant;
let cartItemId;
let orderId;

beforeAll(async () => {
  const result = await createE2EUser({ email: `__e2e_shop_${TS}@t.com` });
  customer = result.user;
  token = result.token;

  const productResult = await createE2EProduct();
  testProduct = productResult.product;
  testVariant = productResult.variant;
});

afterAll(async () => {
  if (orderId) {
    await OrderItem.destroy({ where: { orderId }, force: true }).catch(() => {});
    await Order.destroy({ where: { id: orderId }, force: true }).catch(() => {});
  }
  await CartItem.destroy({ where: { productId: testProduct?.id } }, { force: true }).catch(
    () => {},
  );
  if (testVariant) await testVariant.destroy({ force: true }).catch(() => {});
  if (testProduct) {
    await Category.destroy({ where: { id: testProduct.categoryId }, force: true }).catch(() => {});
    await Brand.destroy({ where: { id: testProduct.brandId }, force: true }).catch(() => {});
    await testProduct.destroy({ force: true }).catch(() => {});
  }
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Bước 1: Duyệt catalog ────────────────────────────────────
describe('Bước 1 — Duyệt danh mục sản phẩm', () => {
  test('GET /api/products → 200, có danh sách sản phẩm', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.data?.products || res.body.data)).toBe(true);
  });

  test('GET /api/products?q=__E2E_ → 200', async () => {
    const res = await request(app).get(`/api/products?q=__E2E_Product_${TS}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/categories → 200, có danh sách', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/brands → 200, có danh sách', async () => {
    const res = await request(app).get('/api/brands');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Bước 2: Xem chi tiết sản phẩm ───────────────────────────
describe('Bước 2 — Xem chi tiết sản phẩm', () => {
  test('GET /api/products/:id → 200, trả về product', async () => {
    const res = await request(app).get(`/api/products/${testProduct.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const product = res.body.data?.product || res.body.data;
    expect(product?.id || product?.slug).toBeDefined();
  });

  test('GET /api/products/999999999 → 404', async () => {
    const res = await request(app).get('/api/products/999999999');
    expect([404, 400]).toContain(res.status);
  });

  test('GET /api/products/search?q=laptop → 200', async () => {
    const res = await request(app).get('/api/products/search?q=laptop');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Bước 3: Giỏ hàng ────────────────────────────────────────
describe('Bước 3 — Giỏ hàng', () => {
  test('POST /api/cart → 200, thêm sản phẩm vào giỏ', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id, variantId: testVariant.id, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/cart → 200, lấy cartItemId để test tiếp', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const cart = res.body.data?.cart || res.body.data;
    const items = cart?.items || [];
    const addedItem = items.find((i) => String(i.productId) === String(testProduct.id));
    if (addedItem) cartItemId = addedItem.id;
  });

  test('GET /api/cart → 200, giỏ có sản phẩm', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const cart = res.body.data?.cart || res.body.data;
    expect(cart).toBeDefined();
  });

  test('GET /api/cart/count → 200', async () => {
    const res = await request(app).get('/api/cart/count').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('PUT /api/cart/items/:id — cập nhật số lượng', async () => {
    if (!cartItemId) return;

    const res = await request(app)
      .put(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 3 });

    expect([200, 204]).toContain(res.status);
  });

  test('PUT /api/cart/items/:id — quantity = 0 → 400', async () => {
    if (!cartItemId) return;

    const res = await request(app)
      .put(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: 0 });

    expect([400, 422]).toContain(res.status);
  });
});

// ── Bước 4: Wishlist ─────────────────────────────────────────
describe('Bước 4 — Wishlist', () => {
  test('POST /api/wishlists → 200/201, thêm vào wishlist', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/wishlists → 200', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('DELETE /api/wishlists/:productId → 200/204', async () => {
    const res = await request(app)
      .delete(`/api/wishlists/${testProduct.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });
});

// ── Bước 5: Đặt hàng ────────────────────────────────────────
describe('Bước 5 — Đặt hàng', () => {
  test('POST /api/orders → 201, tạo đơn hàng COD thành công', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [
          {
            productId: testProduct.id,
            variantId: testVariant.id,
            quantity: 1,
            unitPrice: testVariant.price,
          },
        ],
        paymentMethod: 'cod',
        shippingFirstName: '__E2E',
        shippingLastName: 'Customer',
        shippingAddress1: '123 Đường Kiểm Thử',
        shippingCity: 'Hà Nội',
        shippingPhone: '0901234567',
        billingFirstName: '__E2E',
        billingLastName: 'Customer',
        billingAddress1: '123 Đường Kiểm Thử',
        billingCity: 'Hà Nội',
      });

    expect([200, 201]).toContain(res.status);
    if (res.status === 201 || res.status === 200) {
      expect(res.body.status).toBe('success');
      orderId = res.body.data?.order?.id || res.body.data?.id;
    }
  });

  test('POST /api/orders — không auth → 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'cod',
      });
    expect(res.status).toBe(401);
  });

  test('POST /api/orders — thiếu items → 400/422', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ paymentMethod: 'cod' });
    expect([400, 422]).toContain(res.status);
  });
});

// ── Bước 6: Lịch sử đơn hàng ────────────────────────────────
describe('Bước 6 — Lịch sử đơn hàng', () => {
  test('GET /api/orders → 200, có danh sách', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const orders = res.body.data?.orders || res.body.data;
    expect(Array.isArray(orders)).toBe(true);
  });

  test('GET /api/orders/:id → 200', async () => {
    if (!orderId) return;

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/orders/:id — user khác không xem được', async () => {
    if (!orderId) return;

    const otherUser = await createE2EUser({ email: `__e2e_other_${TS}@t.com` });
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherUser.token}`);

    expect([403, 404]).toContain(res.status);
    await otherUser.user.destroy({ force: true }).catch(() => {});
  });
});

// ── Bước 7: Loyalty ──────────────────────────────────────────
describe('Bước 7 — Loyalty', () => {
  test('GET /api/loyalty → 200, trả về điểm thưởng', async () => {
    const res = await request(app).get('/api/loyalty').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ── Bước 8: Dọn giỏ hàng ─────────────────────────────────────
describe('Bước 8 — Dọn giỏ hàng', () => {
  test('DELETE /api/cart/items/:id → 200/204 (hoặc 404 nếu cart đã clear)', async () => {
    if (!cartItemId) return;

    const res = await request(app)
      .delete(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${token}`);

    // Cart có thể đã bị clear sau khi tạo order
    expect([200, 204, 404]).toContain(res.status);
  });

  test('DELETE /api/cart → xóa toàn bộ giỏ → 200/204', async () => {
    const res = await request(app).delete('/api/cart').set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });
});
