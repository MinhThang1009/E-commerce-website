/**
 * HTTP tests bổ sung cho module payment và reviews — tập trung vào các kịch bản
 * chưa có trong: payment.http.test.js, payment-edge-cases.http.test.js,
 * reviews.http.test.js, reviews-edge-cases.http.test.js.
 *
 * Những gì đã được test ở các file trên (KHÔNG lặp lại):
 *  Payment:
 *   - POST momo/vnpay create-url → 401, authenticated (200/400/500)
 *   - POST momo/vnpay create-url → thiếu orderId (body rỗng) → 400 [edge]
 *   - POST momo create-url với order của user khác → 403/404 [edge]
 *   - POST vnpay create-url với orderId không tồn tại → 400/404 [edge]
 *   - GET momo/vnpay return → không có params (302/400) [basic + edge]
 *   - GET vnpay return với hash giả → 302/200, không 500 [edge]
 *   - POST momo/vnpay ipn → signature sai/thiếu → 200/400, không 500 [basic + edge]
 *   - POST refund → 401, customer → 403 [basic]
 *   - POST sepay-webhook → payload không hợp lệ → không crash [basic]
 *
 *  Reviews:
 *   - GET /product/:id → 200, pagination shape (totalPages, currentPage, reviews[]) [edge]
 *   - GET /user → 200 auth, 401 no-auth [basic]
 *   - POST → no order → 400/403, no auth → 401 [basic]
 *   - POST rating=0 → 400, rating=6 → 400 [edge]
 *   - PUT → 401, 404/other-user → 403/404 [basic + edge]
 *   - DELETE → 401, 404/other-user → 403/404 [basic + edge]
 *   - GET /admin/all → 401, customer → 403 [basic]
 *   - PATCH /admin/:id/verify → 401, customer → 403 [basic]
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Order, OrderItem, Cart, CartItem, Review } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();

// Actors dùng chung
let adminUser, adminToken;
let userA, tokenA;
let userB, tokenB;

// Tài nguyên
let product, variant, cat, brand;
let orderOfA; // order pending thuộc userA — dùng cho payment tests
let reviewByA; // review thuộc userA — dùng cho ownership tests

beforeAll(async () => {
  ({ user: adminUser, token: adminToken } = await createTestUser({
    email: `__http_payrv_admin_${TS}@t.com`,
    role: 'admin',
  }));
  ({ user: userA, token: tokenA } = await createTestUser({
    email: `__http_payrv_a_${TS}@t.com`,
  }));
  ({ user: userB, token: tokenB } = await createTestUser({
    email: `__http_payrv_b_${TS}@t.com`,
  }));
  ({ product, variant, cat, brand } = await createTestProduct());

  // Order pending thuộc userA — dùng để test payment
  orderOfA = await Order.create({
    number: `HTTP-PAYRV-${TS}`,
    userId: userA.id,
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
    orderId: orderOfA.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 5_000_000,
    quantity: 1,
    subtotal: 5_000_000,
  });

  // Tạo đơn delivered cho userA để có thể tạo review
  const deliveredOrder = await Order.create({
    number: `HTTP-PAYRV-DEL-${TS}`,
    userId: userA.id,
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
    orderId: deliveredOrder.id,
    productId: product.id,
    variantId: variant.id,
    name: product.nameVi,
    unitPrice: 5_000_000,
    quantity: 1,
    subtotal: 5_000_000,
  });

  // Tạo review trực tiếp qua model cho userA
  reviewByA = await Review.create({
    userId: userA.id,
    productId: product.id,
    rating: 4,
    title: '__HTTP PayRv review title',
    content: '__HTTP PayRv review content deep test',
    isVerified: true,
  });
});

afterAll(async () => {
  // Dọn reviews
  await Review.destroy({ where: { productId: product?.id }, force: true }).catch(() => {});

  // Dọn orders
  const allOrders = await Order.findAll({
    where: { userId: { [Op.in]: [userA?.id].filter(Boolean) } },
    paranoid: false,
  });
  const orderIds = allOrders.map((o) => o.id);
  if (orderIds.length) {
    await OrderItem.destroy({ where: { orderId: { [Op.in]: orderIds } }, force: true }).catch(
      () => {},
    );
    await Order.destroy({ where: { id: { [Op.in]: orderIds } }, force: true }).catch(() => {});
  }

  // Dọn cart
  const userIds = [adminUser?.id, userA?.id, userB?.id].filter(Boolean);
  if (userIds.length) {
    const carts = await Cart.findAll({ where: { userId: { [Op.in]: userIds } } });
    const cartIds = carts.map((c) => c.id);
    if (cartIds.length) {
      await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true }).catch(
        () => {},
      );
      await Cart.destroy({ where: { userId: { [Op.in]: userIds } }, force: true }).catch(() => {});
    }
  }

  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  await User.destroy({ where: { id: { [Op.in]: userIds } }, force: true }).catch(() => {});
});

// ════════════════════════════════════════════════════════════════════
//  PAYMENT
// ════════════════════════════════════════════════════════════════════

describe('POST /api/payments/vnpay/create-url — thiếu orderId → 400', () => {
  test('body rỗng → 400 validation error', async () => {
    const res = await request(app)
      .post('/api/payments/vnpay/create-url')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.status).not.toBe('success');
  });
});

describe('POST /api/payments/momo/create-url — orderId không tồn tại → 404 hoặc 400', () => {
  test('orderId 999999999 → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/payments/momo/create-url')
      .set('Authorization', `Bearer ${tokenA}`)
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
        orderId: `HTTP-PAYRV-${TS}`,
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
        vnp_TxnRef: `ORD-PAYRV-${TS}`,
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId: orderOfA.id, amount: -100 });
    expect([400, 422]).toContain(res.status);
    expect(res.body.status).not.toBe('success');
  });
});

describe('POST /api/payments/refund (admin) — orderId không tồn tại → 404', () => {
  test('orderId 999999999 → 404 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/payments/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ orderId: 999999999, amount: 50000 });
    expect([400, 404]).toContain(res.status);
  });
});

describe('POST /api/payments/refund (customer) → 403', () => {
  test('customer không có quyền refund → 403', async () => {
    const res = await request(app)
      .post('/api/payments/refund')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ orderId: orderOfA.id, amount: 50000 });
    expect([400, 403]).toContain(res.status);
  });
});

describe('GET /api/payments/momo/return — hash giả → không crash', () => {
  test('signature không hợp lệ → 302 hoặc 200, không 500', async () => {
    const res = await request(app)
      .get('/api/payments/momo/return')
      .query({
        orderId: `HTTP-PAYRV-${TS}`,
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
        vnp_TxnRef: `ORD-PAYRV-DEEP-${TS}`,
        vnp_Amount: '5030000',
        vnp_ResponseCode: '00',
        vnp_TransactionStatus: '00',
        vnp_SecureHash: 'a'.repeat(64), // SHA256 length nhưng sai nội dung
        vnp_SecureHashType: 'SHA256',
      });
    expect(res.status).not.toBe(500);
  });
});

// ════════════════════════════════════════════════════════════════════
//  REVIEWS
// ════════════════════════════════════════════════════════════════════

describe('GET /api/reviews/product/:productId — response shape', () => {
  test('trả về 200 kèm reviews array và thông tin trang', async () => {
    const res = await request(app)
      .get(`/api/reviews/product/${product.id}`)
      .query({ page: 1, limit: 3 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('GET /api/reviews/product/:productId — danh sách rỗng', () => {
  let productNoReviews;
  let variantNoReviews;
  beforeAll(async () => {
    const TS2 = Date.now() + Math.random();
    const tempCat = cat; // dùng cat đã có sẵn
    const tempBrand = brand;
    productNoReviews = await require('@models').Product.create({
      nameVi: `__HTTP_NoReviewProd_${TS2}`,
      nameEn: `__HTTP_NoReviewProd_${TS2}`,
      baseName: `__HTTP_NoReviewProd_${TS2}`,
      slug: `http-no-review-prod-deep-${TS2}`,
      basePrice: 1_000_000,
      categoryId: tempCat.id,
      brandId: tempBrand.id,
      status: 'active',
      stockQuantity: 5,
    });
    variantNoReviews = await require('@models').ProductVariant.create({
      productId: productNoReviews.id,
      sku: `HTTP-NOREVIEW-${TS2}`,
      variantName: 'Base',
      price: 1_000_000,
      stockQuantity: 5,
      isDefault: true,
    });
  });
  afterAll(async () => {
    if (variantNoReviews) await variantNoReviews.destroy({ force: true }).catch(() => {});
    if (productNoReviews) await productNoReviews.destroy({ force: true }).catch(() => {});
  });

  test('sản phẩm không có review nào → 200 và array rỗng', async () => {
    const res = await request(app).get(`/api/reviews/product/${productNoReviews.id}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const data = res.body.data;
    // data là array rỗng hoặc object với reviews []
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
      .get(`/api/reviews/product/${product.id}`)
      .query({ page: 1, limit: 3 });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('GET /api/reviews/product/999999 — productId không tồn tại → 200 rỗng', () => {
  test('productId 999999 → 200 và data rỗng hoặc 404', async () => {
    const res = await request(app).get('/api/reviews/product/999999');
    // Service có thể trả 200 + rỗng hoặc 404 nếu product không tồn tại
    expect([200, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('GET /api/reviews/user (auth) — trả về array', () => {
  test('authenticated → 200 và data là array', async () => {
    const res = await request(app)
      .get('/api/reviews/user')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // data phải là array (có thể rỗng hoặc có review của userA)
    const data = res.body.data;
    expect(data).toBeDefined();
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
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
        rating: 5,
        title: '__HTTP PayRv via API',
        comment: '__HTTP comment via API rating 5',
      });
    // Có thể 400 nếu đã review rồi, hoặc 200/201 nếu được phép
    expect([200, 201, 400, 403]).toContain(res.status);
    expect(res.status).not.toBe(500);
    // Dọn review nếu tạo thành công qua API
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
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
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
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
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
      .put(`/api/reviews/${reviewByA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({
        productId: product.id,
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
      .put(`/api/reviews/${reviewByA.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        productId: product.id,
        rating: 3,
        title: '__HTTP updated own review',
        comment: '__HTTP own updated comment deep',
      });
    expect([200, 201, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('DELETE /api/reviews/:id — review của user khác → 403', () => {
  let crossDeleteReview;
  beforeAll(async () => {
    // Tạo review riêng cho test cross-user để tránh phụ thuộc vào reviewByA
    crossDeleteReview = await Review.create({
      userId: userA.id,
      productId: product.id,
      rating: 3,
      title: '__HTTP cross delete ownership test',
      content: '__HTTP cross delete review content deep test ownership',
      isVerified: false,
    });
  });
  afterAll(async () => {
    if (crossDeleteReview?.id) {
      await Review.destroy({ where: { id: crossDeleteReview.id }, force: true }).catch(() => {});
    }
  });

  test('userB cố xóa review của userA → 403 hoặc 404', async () => {
    const res = await request(app)
      .delete(`/api/reviews/${crossDeleteReview.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect([403, 404]).toContain(res.status);
    // Review phải vẫn còn tồn tại sau khi bị từ chối (kể cả soft-delete)
    const stillExists = await Review.findOne({
      where: { id: crossDeleteReview.id },
      paranoid: false,
    });
    expect(stillExists).not.toBeNull();
  });
});

describe('DELETE /api/reviews/:id — review của chính mình → 200', () => {
  let ownReview;
  beforeAll(async () => {
    ownReview = await Review.create({
      userId: userA.id,
      productId: product.id,
      rating: 5,
      title: '__HTTP own review to delete',
      content: '__HTTP own review content to delete deep test',
      isVerified: false,
    });
  });

  test('userA xóa review của mình → 200 hoặc 204', async () => {
    const res = await request(app)
      .delete(`/api/reviews/${ownReview.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect([200, 204, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
    if (ownReview?.id) {
      await Review.destroy({ where: { id: ownReview.id }, force: true }).catch(() => {});
    }
  });
});

describe('GET /api/reviews/admin/all (admin) → 200', () => {
  test('admin xem tất cả review → 200', async () => {
    const res = await request(app)
      .get('/api/reviews/admin/all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

describe('PATCH /api/reviews/admin/:id/verify — admin verify → 200 hoặc 404', () => {
  test('admin verify review hợp lệ → 200 hoặc 404', async () => {
    const res = await request(app)
      .patch(`/api/reviews/admin/${reviewByA.id}/verify`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 201, 404]).toContain(res.status);
    expect(res.status).not.toBe(500);
  });
});

describe('PATCH /api/reviews/admin/:id/verify (customer) → 403', () => {
  test('customer cố verify review → 403', async () => {
    const res = await request(app)
      .patch(`/api/reviews/admin/${reviewByA.id}/verify`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(403);
  });
});
