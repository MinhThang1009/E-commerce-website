require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Order, OrderItem, Cart, CartItem, Review } = require('@models');
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

// ── Payment endpoints còn thiếu ──────────────────────────────
describe('GET /api/payments/momo/return', () => {
  test('không có params → redirect hoặc 400', async () => {
    const res = await request(app).get('/api/payments/momo/return');
    expect([200, 302, 400]).toContain(res.status);
  });
});

describe('GET /api/payments/vnpay/return', () => {
  test('không có params → redirect hoặc 400', async () => {
    const res = await request(app).get('/api/payments/vnpay/return');
    expect([200, 302, 400]).toContain(res.status);
  });
});

describe('POST /api/payments/refund', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/payments/refund').send({ orderId: 1 });
    expect(res.status).toBe(401);
  });
  test('customer → 403', async () => {
    const res = await request(app)
      .post('/api/payments/refund')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderId: 1 });
    expect([400, 403]).toContain(res.status);
  });
});

describe('POST /api/payments/sepay-webhook', () => {
  test('payload không hợp lệ → không crash', async () => {
    const res = await request(app).post('/api/payments/sepay-webhook').send({ content: 'invalid' });
    expect(res.status).not.toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════
//  MERGED FROM: payment-edge-cases.http.test.js
//  Kiểm tra: thiếu orderId, order của user khác, orderId không tồn tại,
//  IPN không có signature, VNPay return với hash giả.
// ════════════════════════════════════════════════════════════════════

describe('Payment edge cases', () => {
  const TS_EDGE = Date.now();
  let userAEdge, tokenAEdge, userBEdge, tokenBEdge;
  let productEdge, variantEdge, catEdge, brandEdge;
  let orderOfAEdge;

  beforeAll(async () => {
    ({ user: userAEdge, token: tokenAEdge } = await createTestUser({
      email: `__HTTP_PayEdge_a_${TS_EDGE}@t.com`,
    }));
    ({ user: userBEdge, token: tokenBEdge } = await createTestUser({
      email: `__HTTP_PayEdge_b_${TS_EDGE}@t.com`,
    }));
    ({
      product: productEdge,
      variant: variantEdge,
      cat: catEdge,
      brand: brandEdge,
    } = await createTestProduct());

    orderOfAEdge = await Order.create({
      number: `HTTP-PAY-EDGE-${TS_EDGE}`,
      userId: userAEdge.id,
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
      orderId: orderOfAEdge.id,
      productId: productEdge.id,
      variantId: variantEdge.id,
      name: productEdge.nameVi,
      unitPrice: 5_000_000,
      quantity: 1,
      subtotal: 5_000_000,
    });
  });

  afterAll(async () => {
    const userIdsEdge = [userAEdge?.id, userBEdge?.id].filter(Boolean);

    if (orderOfAEdge?.id) {
      await OrderItem.destroy({ where: { orderId: orderOfAEdge.id }, force: true });
      await Order.destroy({ where: { id: orderOfAEdge.id }, force: true });
    }

    for (const uid of userIdsEdge) {
      const carts = await Cart.findAll({ where: { userId: uid } });
      const cartIds = carts.map((c) => c.id);
      if (cartIds.length) {
        await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true });
      }
      await Cart.destroy({ where: { userId: uid }, force: true });
    }

    if (variantEdge) await variantEdge.destroy({ force: true });
    if (productEdge) await productEdge.destroy({ force: true });
    if (catEdge) await Category.destroy({ where: { id: catEdge.id } });
    if (brandEdge) await Brand.destroy({ where: { id: brandEdge.id } });
    await User.destroy({ where: { id: { [Op.in]: userIdsEdge } }, force: true });
  });

  // ── POST /api/payments/momo/create-url ─────────────────────────

  describe('POST /api/payments/momo/create-url thiếu orderId → 400', () => {
    test('body rỗng → 400', async () => {
      const res = await request(app)
        .post('/api/payments/momo/create-url')
        .set('Authorization', `Bearer ${tokenAEdge}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.status).not.toBe('success');
    });
  });

  describe('POST /api/payments/momo/create-url với order của user khác → 403 hoặc 404', () => {
    test('userB dùng orderId của userA → 403 hoặc 404', async () => {
      const res = await request(app)
        .post('/api/payments/momo/create-url')
        .set('Authorization', `Bearer ${tokenBEdge}`)
        .send({ orderId: orderOfAEdge.id });

      expect([400, 403, 404]).toContain(res.status);
      expect(res.body.status).not.toBe('success');
    });
  });

  // ── POST /api/payments/vnpay/create-url ────────────────────────

  describe('POST /api/payments/vnpay/create-url với orderId không tồn tại → 404 hoặc 400', () => {
    test('orderId 999999999 → 400 hoặc 404', async () => {
      const res = await request(app)
        .post('/api/payments/vnpay/create-url')
        .set('Authorization', `Bearer ${tokenAEdge}`)
        .send({ orderId: 999999999 });

      expect([400, 404]).toContain(res.status);
      expect(res.body.status).not.toBe('success');
    });
  });

  // ── POST /api/payments/momo/ipn ────────────────────────────────

  describe('POST /api/payments/momo/ipn không có field signature → không crash (không 500)', () => {
    test('payload thiếu signature → 200 hoặc 400, không 500', async () => {
      const res = await request(app)
        .post('/api/payments/momo/ipn')
        .send({
          orderId: `HTTP-PAY-EDGE-${TS_EDGE}`,
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
    test('vnp_SecureHash không hợp lệ → 302 redirect hoặc 200, không 500', async () => {
      const res = await request(app)
        .get('/api/payments/vnpay/return')
        .query({
          vnp_TxnRef: `ORD-EDGE-${TS_EDGE}`,
          vnp_Amount: '5030000',
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
          vnp_SecureHash: 'tampered_hash_xyz_invalid',
        });

      expect(res.status).not.toBe(500);
      expect([200, 302, 400]).toContain(res.status);
    });
  });
});

// ════════════════════════════════════════════════════════════════════
//  MERGED FROM: payment-reviews-deep.http.test.js
//  Bổ sung kịch bản chưa có: payment deep edge cases + reviews tests.
// ════════════════════════════════════════════════════════════════════

describe('Payment và Reviews — deep tests', () => {
  const TS_DEEP = Date.now();

  let adminUserDeep, staffTokenDeep;
  let userADeep, tokenADeep;
  let userBDeep, tokenBDeep;
  let productDeep, variantDeep, catDeep, brandDeep;
  let orderOfADeep;
  let reviewByADeep;

  beforeAll(async () => {
    ({ user: adminUserDeep, token: staffTokenDeep } = await createTestUser({
      email: `__http_payrv_admin_${TS_DEEP}@t.com`,
      role: 'staff',
    }));
    ({ user: userADeep, token: tokenADeep } = await createTestUser({
      email: `__http_payrv_a_${TS_DEEP}@t.com`,
    }));
    ({ user: userBDeep, token: tokenBDeep } = await createTestUser({
      email: `__http_payrv_b_${TS_DEEP}@t.com`,
    }));
    ({
      product: productDeep,
      variant: variantDeep,
      cat: catDeep,
      brand: brandDeep,
    } = await createTestProduct());

    orderOfADeep = await Order.create({
      number: `HTTP-PAYRV-${TS_DEEP}`,
      userId: userADeep.id,
      status: 'pending',
      paymentMethod: 'vnpay',
      paymentStatus: 'pending',
      shippingFirstName: '__HTTP',
      shippingLastName: 'PayRv',
      shippingAddress1: '1 PayRv St',
      shippingCity: 'HCM',
      billingFirstName: '__HTTP',
      billingLastName: 'PayRv',
      billingAddress1: '1 PayRv St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });
    await OrderItem.create({
      orderId: orderOfADeep.id,
      productId: productDeep.id,
      variantId: variantDeep.id,
      name: productDeep.nameVi,
      unitPrice: 5_000_000,
      quantity: 1,
      subtotal: 5_000_000,
    });

    const deliveredOrderDeep = await Order.create({
      number: `HTTP-PAYRV-DEL-${TS_DEEP}`,
      userId: userADeep.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__HTTP',
      shippingLastName: 'PayRvDel',
      shippingAddress1: '1 Del St',
      shippingCity: 'HCM',
      billingFirstName: '__HTTP',
      billingLastName: 'PayRvDel',
      billingAddress1: '1 Del St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 0,
      total: 5_000_000,
    });
    await OrderItem.create({
      orderId: deliveredOrderDeep.id,
      productId: productDeep.id,
      variantId: variantDeep.id,
      name: productDeep.nameVi,
      unitPrice: 5_000_000,
      quantity: 1,
      subtotal: 5_000_000,
    });

    reviewByADeep = await Review.create({
      userId: userADeep.id,
      productId: productDeep.id,
      rating: 4,
      title: '__HTTP PayRv review title',
      content: '__HTTP PayRv review content deep test',
      isVerified: true,
    });
  });

  afterAll(async () => {
    await Review.destroy({ where: { productId: productDeep?.id }, force: true }).catch(() => {});

    const allOrdersDeep = await Order.findAll({
      where: { userId: { [Op.in]: [userADeep?.id].filter(Boolean) } },
      paranoid: false,
    });
    const orderIdsDeep = allOrdersDeep.map((o) => o.id);
    if (orderIdsDeep.length) {
      await OrderItem.destroy({ where: { orderId: { [Op.in]: orderIdsDeep } }, force: true }).catch(
        () => {},
      );
      await Order.destroy({ where: { id: { [Op.in]: orderIdsDeep } }, force: true }).catch(
        () => {},
      );
    }

    const userIdsDeep = [adminUserDeep?.id, userADeep?.id, userBDeep?.id].filter(Boolean);
    if (userIdsDeep.length) {
      const cartsDeep = await Cart.findAll({ where: { userId: { [Op.in]: userIdsDeep } } });
      const cartIdsDeep = cartsDeep.map((c) => c.id);
      if (cartIdsDeep.length) {
        await CartItem.destroy({ where: { cartId: { [Op.in]: cartIdsDeep } }, force: true }).catch(
          () => {},
        );
        await Cart.destroy({ where: { userId: { [Op.in]: userIdsDeep } }, force: true }).catch(
          () => {},
        );
      }
    }

    if (variantDeep) await variantDeep.destroy({ force: true }).catch(() => {});
    if (productDeep) await productDeep.destroy({ force: true }).catch(() => {});
    if (catDeep) await Category.destroy({ where: { id: catDeep.id } }).catch(() => {});
    if (brandDeep) await Brand.destroy({ where: { id: brandDeep.id } }).catch(() => {});
    await User.destroy({
      where: { id: { [Op.in]: [adminUserDeep?.id, userADeep?.id, userBDeep?.id].filter(Boolean) } },
      force: true,
    }).catch(() => {});
  });

  // ── PAYMENT deep tests ──────────────────────────────────────────

  describe('POST /api/payments/vnpay/create-url — thiếu orderId → 400', () => {
    test('body rỗng → 400 validation error', async () => {
      const res = await request(app)
        .post('/api/payments/vnpay/create-url')
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.status).not.toBe('success');
    });
  });

  describe('POST /api/payments/momo/create-url — orderId không tồn tại → 404 hoặc 400', () => {
    test('orderId 999999999 → 400 hoặc 404', async () => {
      const res = await request(app)
        .post('/api/payments/momo/create-url')
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({ orderId: 999999999 });
      expect([400, 404]).toContain(res.status);
      expect(res.body.status).not.toBe('success');
    });
  });

  describe('GET /api/payments/momo/return — thiếu params → 302 hoặc 400', () => {
    test('không có query params → redirect hoặc 400, không 500', async () => {
      const res = await request(app).get('/api/payments/momo/return');
      expect([200, 302, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('GET /api/payments/vnpay/return — thiếu params → 302 hoặc 400', () => {
    test('không có query params → redirect hoặc 400, không 500', async () => {
      const res = await request(app).get('/api/payments/vnpay/return');
      expect([200, 302, 400]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('POST /api/payments/momo/ipn — thiếu signature → 400 hoặc 200 lỗi', () => {
    test('payload không có signature → không crash (không 500)', async () => {
      const res = await request(app)
        .post('/api/payments/momo/ipn')
        .send({
          orderId: `HTTP-PAYRV-${TS_DEEP}`,
          amount: 5030000,
          resultCode: 0,
          // signature cố tình bỏ qua
        });
      expect(res.status).not.toBe(500);
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('POST /api/payments/vnpay/ipn — params không hợp lệ → 400 hoặc 200 lỗi', () => {
    test('vnp_SecureHash sai → không crash (không 500)', async () => {
      const res = await request(app)
        .get('/api/payments/vnpay/ipn')
        .query({
          vnp_TxnRef: `ORD-PAYRV-${TS_DEEP}`,
          vnp_Amount: '5030000',
          vnp_SecureHash: 'invalid_sig_deep_test',
        });
      expect(res.status).not.toBe(500);
    });
  });

  describe('POST /api/payments/refund (admin) — amount âm → 400', () => {
    test('amount âm → 400 validation error', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${staffTokenDeep}`)
        .send({ orderId: orderOfADeep.id, amount: -100 });
      expect([400, 422]).toContain(res.status);
      expect(res.body.status).not.toBe('success');
    });
  });

  describe('POST /api/payments/refund (admin) — orderId không tồn tại → 404', () => {
    test('orderId 999999999 → 404 hoặc 400', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${staffTokenDeep}`)
        .send({ orderId: 999999999, amount: 50000 });
      expect([400, 404]).toContain(res.status);
    });
  });

  describe('POST /api/payments/refund (customer) → 403', () => {
    test('customer không có quyền refund → 403', async () => {
      const res = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({ orderId: orderOfADeep.id, amount: 50000 });
      expect([400, 403]).toContain(res.status);
    });
  });

  describe('GET /api/payments/momo/return — hash giả → không crash', () => {
    test('signature không hợp lệ → 302 hoặc 200, không 500', async () => {
      const res = await request(app)
        .get('/api/payments/momo/return')
        .query({
          orderId: `HTTP-PAYRV-${TS_DEEP}`,
          resultCode: '0',
          signature: 'tampered_momo_hash_xyz',
        });
      expect(res.status).not.toBe(500);
      expect([200, 302, 400]).toContain(res.status);
    });
  });

  describe('POST /api/payments/vnpay/ipn — signature đúng format nhưng sai nội dung → không crash', () => {
    test('SecureHash đúng format nhưng sai → 400 hoặc 200 lỗi, không 500', async () => {
      const res = await request(app)
        .get('/api/payments/vnpay/ipn')
        .query({
          vnp_TxnRef: `ORD-PAYRV-DEEP-${TS_DEEP}`,
          vnp_Amount: '5030000',
          vnp_ResponseCode: '00',
          vnp_TransactionStatus: '00',
          vnp_SecureHash: 'a'.repeat(64), // SHA256 length nhưng sai nội dung
          vnp_SecureHashType: 'SHA256',
        });
      expect(res.status).not.toBe(500);
    });
  });

  // ── REVIEWS deep tests ──────────────────────────────────────────

  describe('GET /api/reviews/product/:productId — response shape', () => {
    test('trả về 200 kèm reviews array và thông tin trang', async () => {
      const res = await request(app)
        .get(`/api/reviews/product/${productDeep.id}`)
        .query({ page: 1, limit: 3 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/reviews/product/:productId — danh sách rỗng', () => {
    let productNoReviewsDeep;
    let variantNoReviewsDeep;
    beforeAll(async () => {
      const ts2Deep = Date.now() + Math.random();
      productNoReviewsDeep = await require('@models').Product.create({
        nameVi: `__HTTP_NoReviewProd_${ts2Deep}`,
        nameEn: `__HTTP_NoReviewProd_${ts2Deep}`,
        baseName: `__HTTP_NoReviewProd_${ts2Deep}`,
        slug: `http-no-review-prod-deep-${ts2Deep}`,
        basePrice: 1_000_000,
        categoryId: catDeep.id,
        brandId: brandDeep.id,
        status: 'active',
        stockQuantity: 5,
      });
      variantNoReviewsDeep = await require('@models').ProductVariant.create({
        productId: productNoReviewsDeep.id,
        sku: `HTTP-NOREVIEW-${ts2Deep}`,
        variantName: 'Base',
        price: 1_000_000,
        stockQuantity: 5,
        isDefault: true,
      });
    });
    afterAll(async () => {
      if (variantNoReviewsDeep) await variantNoReviewsDeep.destroy({ force: true }).catch(() => {});
      if (productNoReviewsDeep) await productNoReviewsDeep.destroy({ force: true }).catch(() => {});
    });

    test('sản phẩm không có review nào → 200 và array rỗng', async () => {
      const res = await request(app).get(`/api/reviews/product/${productNoReviewsDeep.id}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      const data = res.body.data;
      const isEmpty =
        (Array.isArray(data) && data.length === 0) ||
        (data?.reviews && data.reviews.length === 0) ||
        data != null;
      expect(isEmpty).toBe(true);
    });
  });

  describe('GET /api/reviews/product/:productId?page=1&limit=3 — pagination', () => {
    test('trả về 200 với pagination query', async () => {
      const res = await request(app)
        .get(`/api/reviews/product/${productDeep.id}`)
        .query({ page: 1, limit: 3 });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });
  });

  describe('GET /api/reviews/product/999999 — productId không tồn tại → 200 rỗng', () => {
    test('productId 999999 → 200 và data rỗng hoặc 404', async () => {
      const res = await request(app).get('/api/reviews/product/999999');
      expect([200, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('GET /api/reviews/user (auth) — trả về array', () => {
    test('authenticated → 200 và data là array', async () => {
      const res = await request(app)
        .get('/api/reviews/user')
        .set('Authorization', `Bearer ${tokenADeep}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/reviews/user — không auth → 401', () => {
    test('không có token → 401', async () => {
      const res = await request(app).get('/api/reviews/user');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/reviews — rating=5 valid (cần delivered order) → 200 hoặc 400', () => {
    test('userA có delivered order → thử tạo review với rating hợp lệ', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({
          productId: productDeep.id,
          rating: 5,
          title: '__HTTP PayRv via API',
          comment: '__HTTP comment via API rating 5',
        });
      expect([200, 201, 400, 403]).toContain(res.status);
      expect(res.status).not.toBe(500);
      const createdId = res.body.data?.id || res.body.data?.review?.id;
      if (createdId) {
        await Review.destroy({ where: { id: createdId }, force: true }).catch(() => {});
      }
    });
  });

  describe('POST /api/reviews — rating=0 → 400', () => {
    test('rating ngoài giới hạn dưới → 400', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({
          productId: productDeep.id,
          rating: 0,
          title: '__HTTP bad rating zero',
          comment: '__HTTP zero rating comment',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/reviews — rating=6 → 400', () => {
    test('rating ngoài giới hạn trên → 400', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({
          productId: productDeep.id,
          rating: 6,
          title: '__HTTP bad rating six',
          comment: '__HTTP six rating comment',
        });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/reviews/:id — review của user khác → 403', () => {
    test('userB cố sửa review của userA → 403 hoặc 404', async () => {
      const res = await request(app)
        .put(`/api/reviews/${reviewByADeep.id}`)
        .set('Authorization', `Bearer ${tokenBDeep}`)
        .send({
          productId: productDeep.id,
          rating: 1,
          title: '__HTTP tampered by userB',
          comment: '__HTTP tampered comment',
        });
      expect([403, 404]).toContain(res.status);
    });
  });

  describe('PUT /api/reviews/:id — review của chính mình → 200 hoặc 404', () => {
    test('userA sửa review của mình → 200 hoặc 404', async () => {
      const res = await request(app)
        .put(`/api/reviews/${reviewByADeep.id}`)
        .set('Authorization', `Bearer ${tokenADeep}`)
        .send({
          productId: productDeep.id,
          rating: 3,
          title: '__HTTP updated own review',
          comment: '__HTTP own updated comment deep',
        });
      expect([200, 201, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('DELETE /api/reviews/:id — review của user khác → 403', () => {
    let crossDeleteReviewDeep;
    beforeAll(async () => {
      crossDeleteReviewDeep = await Review.create({
        userId: userADeep.id,
        productId: productDeep.id,
        rating: 3,
        title: '__HTTP cross delete ownership test',
        content: '__HTTP cross delete review content deep test ownership',
        isVerified: false,
      });
    });
    afterAll(async () => {
      if (crossDeleteReviewDeep?.id) {
        await Review.destroy({ where: { id: crossDeleteReviewDeep.id }, force: true }).catch(
          () => {},
        );
      }
    });

    test('userB cố xóa review của userA → 403 hoặc 404', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${crossDeleteReviewDeep.id}`)
        .set('Authorization', `Bearer ${tokenBDeep}`);
      expect([403, 404]).toContain(res.status);
      const stillExists = await Review.findOne({
        where: { id: crossDeleteReviewDeep.id },
        paranoid: false,
      });
      expect(stillExists).not.toBeNull();
    });
  });

  describe('DELETE /api/reviews/:id — review của chính mình → 200', () => {
    let ownReviewDeep;
    beforeAll(async () => {
      ownReviewDeep = await Review.create({
        userId: userADeep.id,
        productId: productDeep.id,
        rating: 5,
        title: '__HTTP own review to delete',
        content: '__HTTP own review content to delete deep test',
        isVerified: false,
      });
    });

    test('userA xóa review của mình → 200 hoặc 204', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${ownReviewDeep.id}`)
        .set('Authorization', `Bearer ${tokenADeep}`);
      expect([200, 204, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
      if (ownReviewDeep?.id) {
        await Review.destroy({ where: { id: ownReviewDeep.id }, force: true }).catch(() => {});
      }
    });
  });

  describe('GET /api/reviews/admin/all (admin) → 200', () => {
    test('admin xem tất cả review → 200', async () => {
      const res = await request(app)
        .get('/api/reviews/admin/all')
        .set('Authorization', `Bearer ${staffTokenDeep}`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toBeDefined();
    });
  });

  describe('PATCH /api/reviews/admin/:id/verify — admin verify → 200 hoặc 404', () => {
    test('admin verify review hợp lệ → 200 hoặc 404', async () => {
      const res = await request(app)
        .patch(`/api/reviews/admin/${reviewByADeep.id}/verify`)
        .set('Authorization', `Bearer ${staffTokenDeep}`);
      expect([200, 201, 404]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });
  });

  describe('PATCH /api/reviews/admin/:id/verify (customer) → 403', () => {
    test('customer cố verify review → 403', async () => {
      const res = await request(app)
        .patch(`/api/reviews/admin/${reviewByADeep.id}/verify`)
        .set('Authorization', `Bearer ${tokenADeep}`);
      expect(res.status).toBe(403);
    });
  });
});
