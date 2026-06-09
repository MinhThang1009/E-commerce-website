require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Order, OrderItem, Cart, CartItem } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token, product, variant, cat, brand, createdOrderId;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_orders_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product.id, variantId: variant.id, quantity: 1 });
});

afterAll(async () => {
  if (user?.id) {
    const orders = await Order.findAll({ where: { userId: user.id }, paranoid: false });
    const ids = orders.map((o) => o.id);
    if (ids.length) await OrderItem.destroy({ where: { orderId: { [Op.in]: ids } }, force: true });
    await Order.destroy({ where: { userId: user.id }, force: true });
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

describe('GET /api/orders', () => {
  test('authenticated → 200', async () => {
    const res = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/track', () => {
  test('số không tồn tại → 404 hoặc 200', async () => {
    const res = await request(app).get('/api/orders/track?number=NOTEXIST99999');
    expect([200, 400, 404]).toContain(res.status);
  });
});

describe('POST /api/orders', () => {
  test('tạo đơn từ cart → 201 hoặc 400', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'Test',
        shippingAddress1: '1 Test St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'Test',
        billingAddress1: '1 Test St',
        billingCity: 'HCM',
        paymentMethod: 'cod',
      });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      createdOrderId = res.body?.data?.order?.id || res.body?.data?.id;
    }
  });
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/orders').send({ paymentMethod: 'cod' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/:id', () => {
  test('đơn của mình → 200', async () => {
    if (!createdOrderId) return;
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

describe('POST /api/orders/:id/cancel', () => {
  test('hủy đơn → 200 hoặc 400', async () => {
    if (!createdOrderId) return;
    const res = await request(app)
      .post(`/api/orders/${createdOrderId}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 400]).toContain(res.status);
  });
});

// ── Orders endpoints còn thiếu (base) ────────────────────────
describe('GET /api/orders/shipping-estimate', () => {
  test('authenticated → 200 hoặc 400', async () => {
    const res = await request(app)
      .get('/api/orders/shipping-estimate')
      .set('Authorization', `Bearer ${token}`)
      .query({ weight: 1 });
    expect([200, 400]).toContain(res.status);
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/orders/shipping-estimate');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/orders/number/:number', () => {
  test('số không tồn tại → 404', async () => {
    const res = await request(app)
      .get('/api/orders/number/NOTEXIST999')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/orders/number/ORD-001');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/orders/:id/repay', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/orders/999999999/repay');
    expect(res.status).toBe(401);
  });
  test('order không tồn tại → 404', async () => {
    const res = await request(app)
      .post('/api/orders/999999999/repay')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('POST /api/orders/:id/receive', () => {
  test('không auth → 401', async () => {
    const res = await request(app).post('/api/orders/999999999/receive');
    expect(res.status).toBe(401);
  });
  test('order không tồn tại → 404', async () => {
    const res = await request(app)
      .post('/api/orders/999999999/receive')
      .set('Authorization', `Bearer ${token}`);
    expect([400, 404]).toContain(res.status);
  });
});

describe('GET /api/orders/admin/all', () => {
  test('không auth → 401', async () => {
    const res = await request(app).get('/api/orders/admin/all');
    expect(res.status).toBe(401);
  });
  test('customer → 403', async () => {
    const res = await request(app)
      .get('/api/orders/admin/all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// orders-extra: Pagination, validation errors, cancel đơn đã giao
// ─────────────────────────────────────────────────────────────────────────────
describe('orders-extra', () => {
  let extraUser, extraToken, extraProduct, extraVariant, extraCat, extraBrand;
  let extraCreatedOrderId, extraDeliveredOrderId;
  const EXTRA_TS = Date.now();

  beforeAll(async () => {
    ({ user: extraUser, token: extraToken } = await createTestUser({
      email: `__http_orders_extra_${EXTRA_TS}@t.com`,
    }));
    ({
      product: extraProduct,
      variant: extraVariant,
      cat: extraCat,
      brand: extraBrand,
    } = await createTestProduct());
    // Thêm sản phẩm vào giỏ để có thể tạo đơn
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${extraToken}`)
      .send({ productId: extraProduct.id, variantId: extraVariant.id, quantity: 1 });
  });

  afterAll(async () => {
    if (extraUser?.id) {
      const orders = await Order.findAll({ where: { userId: extraUser.id }, paranoid: false });
      const ids = orders.map((o) => o.id);
      if (ids.length)
        await OrderItem.destroy({ where: { orderId: { [Op.in]: ids } }, force: true }).catch(
          () => {},
        );
      await Order.destroy({ where: { userId: extraUser.id }, force: true }).catch(() => {});
    }
    if (extraUser?.id) {
      const carts = await Cart.findAll({ where: { userId: extraUser.id } });
      const ids = carts.map((c) => c.id);
      if (ids.length)
        await CartItem.destroy({ where: { cartId: { [Op.in]: ids } }, force: true }).catch(
          () => {},
        );
      await Cart.destroy({ where: { userId: extraUser.id }, force: true }).catch(() => {});
    }
    if (extraVariant) await extraVariant.destroy({ force: true }).catch(() => {});
    if (extraProduct) await extraProduct.destroy({ force: true }).catch(() => {});
    if (extraCat) await Category.destroy({ where: { id: extraCat.id } }).catch(() => {});
    if (extraBrand) await Brand.destroy({ where: { id: extraBrand.id } }).catch(() => {});
    await User.destroy({ where: { id: extraUser?.id }, force: true }).catch(() => {});
  });

  // ── GET /api/orders?page=1&limit=5 ──────────────────────────
  describe('GET /api/orders?page=1&limit=5', () => {
    test('authenticated + query params → 200 + pagination metadata', async () => {
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${extraToken}`)
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
        .set('Authorization', `Bearer ${extraToken}`)
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
        extraCreatedOrderId = createRes.body?.data?.order?.id || createRes.body?.data?.id;
      }
      if (!extraCreatedOrderId) return;

      const res = await request(app)
        .get(`/api/orders/${extraCreatedOrderId}`)
        .set('Authorization', `Bearer ${extraToken}`);
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
        .set('Authorization', `Bearer ${extraToken}`)
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
        .set('Authorization', `Bearer ${extraToken}`)
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
        .set('Authorization', `Bearer ${extraToken}`)
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
        .set('Authorization', `Bearer ${extraToken}`)
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
      if (!extraCreatedOrderId) return;
      const orderRes = await request(app)
        .get(`/api/orders/${extraCreatedOrderId}`)
        .set('Authorization', `Bearer ${extraToken}`);
      const orderNumber = orderRes.body?.data?.number || orderRes.body?.data?.order?.number;
      if (!orderNumber) return;

      const res = await request(app)
        .get(`/api/orders/number/${orderNumber}`)
        .set('Authorization', `Bearer ${extraToken}`);
      expect([200, 404]).toContain(res.status);
    });

    test('số không tồn tại → 404', async () => {
      const res = await request(app)
        .get('/api/orders/number/ORD-NOTEXIST-99999')
        .set('Authorization', `Bearer ${extraToken}`);
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── POST /api/orders/:id/cancel — đơn đã giao → 422 ─────────
  describe('POST /api/orders/:id/cancel với order delivered', () => {
    test('hủy đơn đã giao (delivered) → 422', async () => {
      // Tạo đơn hàng giả trực tiếp qua DB với status = delivered
      const deliveredOrder = await Order.create({
        userId: extraUser.id,
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
        number: `ORD-EXTRA-${EXTRA_TS}`,
      });
      extraDeliveredOrderId = deliveredOrder.id;

      const res = await request(app)
        .post(`/api/orders/${extraDeliveredOrderId}/cancel`)
        .set('Authorization', `Bearer ${extraToken}`);
      expect(res.status).toBe(422);

      // Cleanup ngay
      await Order.destroy({ where: { id: extraDeliveredOrderId }, force: true }).catch(() => {});
      extraDeliveredOrderId = null;
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// orders-edge-cases: paymentMethod không hợp lệ, xem order của user khác,
//   hủy đơn đã delivered, track không tồn tại, admin cập nhật trạng thái
// ─────────────────────────────────────────────────────────────────────────────
describe('orders-edge-cases', () => {
  let userA, tokenA, userB, tokenB, edgeAdmin, staffToken;
  let edgeProduct, edgeVariant, edgeCat, edgeBrand;
  let deliveredOrder;
  const EDGE_TS = Date.now();

  beforeAll(async () => {
    ({ user: userA, token: tokenA } = await createTestUser({
      email: `__http_ord_edge_a_${EDGE_TS}@t.com`,
    }));
    ({ user: userB, token: tokenB } = await createTestUser({
      email: `__http_ord_edge_b_${EDGE_TS}@t.com`,
    }));
    ({ user: edgeAdmin, token: staffToken } = await createTestUser({
      email: `__http_ord_edge_admin_${EDGE_TS}@t.com`,
      role: 'staff',
    }));
    ({
      product: edgeProduct,
      variant: edgeVariant,
      cat: edgeCat,
      brand: edgeBrand,
    } = await createTestProduct());

    // Tạo đơn hàng trạng thái delivered cho userA — dùng cho test cancel
    deliveredOrder = await Order.create({
      number: `HTTP-ORD-EDGE-DELIV-${EDGE_TS}`,
      userId: userA.id,
      status: 'delivered',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      shippingFirstName: '__HTTP',
      shippingLastName: 'EdgeOrders',
      shippingAddress1: '1 Edge St',
      shippingCity: 'HCM',
      billingFirstName: '__HTTP',
      billingLastName: 'EdgeOrders',
      billingAddress1: '1 Edge St',
      billingCity: 'HCM',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 30_000,
      total: 5_030_000,
    });
    await OrderItem.create({
      orderId: deliveredOrder.id,
      productId: edgeProduct.id,
      variantId: edgeVariant.id,
      name: edgeProduct.nameVi,
      unitPrice: 5_000_000,
      quantity: 1,
      subtotal: 5_000_000,
    });
  });

  afterAll(async () => {
    // Dọn tất cả orders của userA và userB
    if (userA?.id) {
      const orders = await Order.findAll({ where: { userId: userA.id }, paranoid: false });
      const ids = orders.map((o) => o.id);
      if (ids.length) {
        await OrderItem.destroy({ where: { orderId: { [Op.in]: ids } }, force: true });
      }
      await Order.destroy({ where: { userId: userA.id }, force: true });
    }
    if (userB?.id) {
      await Order.destroy({ where: { userId: userB.id }, force: true });
    }

    // Dọn cart
    const userIds = [userA?.id, userB?.id, edgeAdmin?.id].filter(Boolean);
    for (const uid of userIds) {
      const carts = await Cart.findAll({ where: { userId: uid } });
      const cartIds = carts.map((c) => c.id);
      if (cartIds.length) {
        await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true });
      }
      await Cart.destroy({ where: { userId: uid }, force: true });
    }

    if (edgeVariant) await edgeVariant.destroy({ force: true });
    if (edgeProduct) await edgeProduct.destroy({ force: true });
    if (edgeCat) await Category.destroy({ where: { id: edgeCat.id } });
    if (edgeBrand) await Brand.destroy({ where: { id: edgeBrand.id } });
    await User.destroy({ where: { id: { [Op.in]: userIds } }, force: true });
  });

  describe('POST /api/orders với paymentMethod không hợp lệ → 400', () => {
    test('paymentMethod rỗng → 400', async () => {
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          shippingFirstName: '__HTTP',
          shippingLastName: 'EdgeOrders',
          shippingAddress1: '1 Edge St',
          shippingCity: 'HCM',
          billingFirstName: '__HTTP',
          billingLastName: 'EdgeOrders',
          billingAddress1: '1 Edge St',
          billingCity: 'HCM',
          paymentMethod: '', // rỗng → validator reject
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/orders/:id của user khác → 404', () => {
    test('userB xem order của userA → 404', async () => {
      // deliveredOrder thuộc userA — userB không được xem
      const res = await request(app)
        .get(`/api/orders/${deliveredOrder.id}`)
        .set('Authorization', `Bearer ${tokenB}`);

      expect([403, 404]).toContain(res.status);
    });
  });

  describe('POST /api/orders/:id/cancel khi status=delivered → 422', () => {
    test('hủy đơn hàng đã delivered → 422', async () => {
      const res = await request(app)
        .post(`/api/orders/${deliveredOrder.id}/cancel`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/orders/track với orderNumber không tồn tại → 400 hoặc 404', () => {
    test('orderNumber không tồn tại → 400 hoặc 404', async () => {
      const res = await request(app)
        .get('/api/orders/track')
        .query({ number: `NOTEXIST-${EDGE_TS}` });

      // Controller xử lý trực tiếp: 400 khi thiếu param, 404 khi không tìm thấy
      expect([400, 404]).toContain(res.status);
      // Dù 400 hay 404, body phải có status 'error' (không phải 'success')
      expect(res.body.status).toBe('error');
    });
  });

  describe('PATCH /api/orders/admin/:id/status → 200 với valid status transition', () => {
    let pendingOrder;

    beforeAll(async () => {
      // Tạo đơn hàng pending để admin cập nhật
      pendingOrder = await Order.create({
        number: `HTTP-ORD-EDGE-ADMIN-${EDGE_TS}`,
        userId: userA.id,
        status: 'pending',
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        shippingFirstName: '__HTTP',
        shippingLastName: 'AdminEdge',
        shippingAddress1: '1 Admin St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'AdminEdge',
        billingAddress1: '1 Admin St',
        billingCity: 'HCM',
        subtotal: 5_000_000,
        tax: 0,
        shippingCost: 30_000,
        total: 5_030_000,
      });
    });

    test('admin cập nhật status pending → processing → 200', async () => {
      const res = await request(app)
        .patch(`/api/orders/admin/${pendingOrder.id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'processing' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
    });

    test('customer cố cập nhật status → 403', async () => {
      const res = await request(app)
        .patch(`/api/orders/admin/${pendingOrder.id}/status`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'shipped' });

      expect(res.status).toBe(403);
    });

    test('status không hợp lệ → 400', async () => {
      const res = await request(app)
        .patch(`/api/orders/admin/${pendingOrder.id}/status`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ status: 'unknown_status' });

      expect(res.status).toBe(400);
    });
  });
});
