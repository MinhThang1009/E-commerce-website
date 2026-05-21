/**
 * E2E Test: Checkout Flow
 * Kiểm tra các flow liên quan đến checkout, wishlist, profile và lịch sử đơn hàng.
 * Mỗi describe là 1 flow độc lập — không phụ thuộc thứ tự giữa các describe.
 */
require('module-alias/register');
const { app, request, createE2EUser, createE2EProduct } = require('./e2e-setup');
const { User, Order, OrderItem, CartItem, Wishlist } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let customer, token;
let testProduct, testVariant;
let createdOrderId;

beforeAll(async () => {
  const result = await createE2EUser({ email: `__e2e_checkout_${TS}@t.com` });
  customer = result.user;
  token = result.token;

  const productResult = await createE2EProduct();
  testProduct = productResult.product;
  testVariant = productResult.variant;
});

afterAll(async () => {
  if (createdOrderId) {
    await OrderItem.destroy({ where: { orderId: createdOrderId }, force: true }).catch(() => {});
    await Order.destroy({ where: { id: createdOrderId }, force: true }).catch(() => {});
  }
  // Xóa wishlist test còn sót nếu có
  if (customer?.id && testProduct?.id) {
    await Wishlist.destroy({
      where: { userId: customer.id, productId: testProduct.id },
      force: true,
    }).catch(() => {});
  }
  // Xóa cart items test
  if (testProduct?.id) {
    await CartItem.destroy({ where: { productId: testProduct.id }, force: true }).catch(() => {});
  }
  if (testVariant) await testVariant.destroy({ force: true }).catch(() => {});
  if (testProduct) {
    const { Category, Brand } = require('@models');
    await Category.destroy({ where: { id: testProduct.categoryId }, force: true }).catch(() => {});
    await Brand.destroy({ where: { id: testProduct.brandId }, force: true }).catch(() => {});
    await testProduct.destroy({ force: true }).catch(() => {});
  }
  if (customer) await customer.destroy({ force: true }).catch(() => {});
});

// ── Flow 1: Thêm vào giỏ rồi navigate đến checkout ──────────
describe('Checkout — thêm sản phẩm vào giỏ rồi navigate đến checkout', () => {
  test('POST /api/cart → 200, thêm sản phẩm vào giỏ', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id, variantId: testVariant.id, quantity: 1 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/cart → 200, giỏ chứa sản phẩm vừa thêm', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const cart = res.body.data?.cart || res.body.data;
    const items = cart?.items || [];
    const found = items.find((i) => String(i.productId) === String(testProduct.id));
    expect(found).toBeDefined();
  });

  test('POST /api/orders → 200/201, tạo đơn hàng từ giỏ', async () => {
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
        shippingLastName: 'Checkout',
        shippingAddress1: '456 Đường Kiểm Thử',
        shippingCity: 'Hà Nội',
        shippingPhone: '0901234568',
        billingFirstName: '__E2E',
        billingLastName: 'Checkout',
        billingAddress1: '456 Đường Kiểm Thử',
        billingCity: 'Hà Nội',
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
    createdOrderId = res.body.data?.order?.id || res.body.data?.id;
  });
});

// ── Flow 2: Validate form địa chỉ checkout ──────────────────
describe('Checkout — form địa chỉ validate required fields', () => {
  test('POST /api/orders thiếu shippingAddress1 → 400/422', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: testProduct.id, variantId: testVariant.id, quantity: 1 }],
        paymentMethod: 'cod',
        shippingFirstName: '__E2E',
        shippingLastName: 'NoAddr',
        // shippingAddress1 bị thiếu
        shippingCity: 'Hà Nội',
      });

    expect([400, 422]).toContain(res.status);
  });

  test('POST /api/orders thiếu paymentMethod → 400/422', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: testProduct.id, variantId: testVariant.id, quantity: 1 }],
        shippingFirstName: '__E2E',
        shippingLastName: 'NoPayment',
        shippingAddress1: '789 Đường Test',
        shippingCity: 'HCM',
        // paymentMethod bị thiếu
      });

    expect([400, 422]).toContain(res.status);
  });

  test('POST /api/orders không auth → 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'cod',
        shippingFirstName: '__E2E',
        shippingLastName: 'Guest',
        shippingAddress1: '1 Test',
        shippingCity: 'HCM',
      });

    expect(res.status).toBe(401);
  });
});

// ── Flow 3: Toggle yêu thích sản phẩm ───────────────────────
describe('Wishlist — toggle yêu thích sản phẩm', () => {
  test('POST /api/wishlists → 200/201, thêm sản phẩm vào wishlist', async () => {
    const res = await request(app)
      .post('/api/wishlists')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: testProduct.id });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toBe('success');
  });

  test('GET /api/wishlists → 200, có sản phẩm vừa thêm', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // data là mảng product objects, mỗi item có id = productId
    const items = Array.isArray(res.body.data) ? res.body.data : [];
    const found = items.find((i) => String(i.id) === String(testProduct.id));
    expect(found).toBeDefined();
  });

  test('DELETE /api/wishlists/:productId → 200/204, xóa khỏi wishlist', async () => {
    const res = await request(app)
      .delete(`/api/wishlists/${testProduct.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect([200, 204]).toContain(res.status);
  });

  test('GET /api/wishlists sau khi xóa → sản phẩm không còn trong wishlist', async () => {
    const res = await request(app).get('/api/wishlists').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // data là mảng product objects, mỗi item có id = productId
    const items = Array.isArray(res.body.data) ? res.body.data : [];
    const found = items.find((i) => String(i.id) === String(testProduct.id));
    expect(found).toBeUndefined();
  });
});

// ── Flow 4: Xem trang profile ────────────────────────────────
describe('Profile — xem trang profile khi đăng nhập', () => {
  test('GET /api/auth/me → 200, trả về thông tin user hiện tại', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const user = res.body.data?.user || res.body.data;
    expect(user).toBeDefined();
    expect(user?.email || user?.id).toBeTruthy();
  });

  test('GET /api/auth/me không auth → 401', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });

  test('PUT /api/users/profile → 200, cập nhật thông tin thành công', async () => {
    const res = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: '__E2E_Updated', lastName: 'Profile' });

    expect([200, 204]).toContain(res.status);
  });
});

// ── Flow 5: Xem danh sách đơn hàng ──────────────────────────
describe('Orders — xem danh sách đơn hàng khi đã đăng nhập', () => {
  test('GET /api/orders → 200, trả về mảng đơn hàng', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const orders = res.body.data?.orders || res.body.data;
    expect(Array.isArray(orders)).toBe(true);
  });

  test('GET /api/orders không auth → 401', async () => {
    const res = await request(app).get('/api/orders');

    expect(res.status).toBe(401);
  });

  test('GET /api/orders/:id → 200, trả về chi tiết đơn hàng của mình', async () => {
    if (!createdOrderId) return;

    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const order = res.body.data?.order || res.body.data;
    expect(order?.id || order?.number).toBeTruthy();
  });

  test('GET /api/orders/:id user khác không xem được đơn của mình', async () => {
    if (!createdOrderId) return;

    const otherUser = await createE2EUser({ email: `__e2e_checkout_other_${TS}@t.com` });
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${otherUser.token}`);

    expect([403, 404]).toContain(res.status);
    await otherUser.user.destroy({ force: true }).catch(() => {});
  });
});
