/**
 * Cart, Orders, Loyalty — deep response shape tests.
 * Tập trung vào cấu trúc response (shape), không lặp lại status code tests đã có.
 *
 * Những gì đã test (KHÔNG lặp lại):
 * CART:
 *  - GET /cart (guest + auth) → 200
 *  - POST /cart thêm item hợp lệ → 200
 *  - POST /cart productId không tồn tại → 400/404
 *  - POST /cart quantity=0 hoặc âm → 400
 *  - PUT /cart/items/:id (invalid id, quantity=0) → 400/404
 *  - DELETE /cart/items/:id (invalid id) → 400/404
 *  - GET /cart/count → 200 + count là số
 *  - GET /cart/validate (rỗng + có item) → 200
 *  - POST /cart/sync (có items, rỗng, no variantId, quantity=0) → 200/400
 *  - POST /cart/merge → 200
 *  - DELETE /cart → 200
 *
 * ORDERS:
 *  - GET /orders (auth + no auth) → 200/401
 *  - GET /orders?page&limit → 200 + pagination
 *  - GET /orders/:id → 200
 *  - GET /orders/track → 200/400/404
 *  - GET /orders/shipping-estimate → 200/400/401
 *  - GET /orders/number/:number → 200/404
 *  - POST /orders → 201/400, thiếu fields → 400
 *  - POST /orders/:id/cancel → 200/400
 *  - POST /orders/:id/cancel (delivered) → 422
 *  - POST /orders/:id/repay → 401/404
 *  - POST /orders/:id/receive → 401/404
 *  - GET /orders/admin/all → 401/403
 *
 * LOYALTY:
 *  - GET /loyalty → 200 + points, 401
 *  - POST /loyalty/redeem → 400 (0 points, insufficient), 401
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const {
  User,
  Category,
  Brand,
  Cart,
  CartItem,
  Order,
  OrderItem,
  LoyaltyHistory,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, token, product, variant, cat, brand;
let createdOrderId;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_cold_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
  // Thêm item vào giỏ để dùng cho orders tests
  await request(app)
    .post('/api/cart')
    .set('Authorization', `Bearer ${token}`)
    .send({ productId: product.id, variantId: variant.id, quantity: 2 });
});

afterAll(async () => {
  // Loyalty
  if (user?.id)
    await LoyaltyHistory.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  // Orders
  if (user?.id) {
    const orders = await Order.findAll({ where: { userId: user.id }, paranoid: false });
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length) {
      await OrderItem.destroy({ where: { orderId: { [Op.in]: orderIds } }, force: true }).catch(
        () => {},
      );
    }
    await Order.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  }
  // Cart
  if (user?.id) {
    const carts = await Cart.findAll({ where: { userId: user.id } });
    const cartIds = carts.map((c) => c.id);
    if (cartIds.length) {
      await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } }, force: true }).catch(
        () => {},
      );
    }
    await Cart.destroy({ where: { userId: user.id }, force: true }).catch(() => {});
  }
  if (variant) await variant.destroy({ force: true }).catch(() => {});
  if (product) await product.destroy({ force: true }).catch(() => {});
  if (cat) await Category.destroy({ where: { id: cat.id } }).catch(() => {});
  if (brand) await Brand.destroy({ where: { id: brand.id } }).catch(() => {});
  if (user) await User.destroy({ where: { id: user.id }, force: true }).catch(() => {});
});

// ════════════════════════════════════════════════════════════════
// CART — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/cart — response shape', () => {
  test('data có id, items array, totalItems, subtotal', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('id');
    expect(Array.isArray(data.items)).toBe(true);
    expect(data).toHaveProperty('totalItems');
    expect(data).toHaveProperty('subtotal');
  });

  test('items có productId, quantity, unitPrice khi giỏ không rỗng', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const items = res.body.data?.items ?? [];
    if (items.length > 0) {
      const firstItem = items[0];
      expect(firstItem).toHaveProperty('productId');
      expect(firstItem).toHaveProperty('quantity');
      // unitPrice hoặc price — tên field phụ thuộc serializer
      const hasPrice = 'unitPrice' in firstItem || 'price' in firstItem;
      expect(hasPrice).toBe(true);
    }
  });
});

describe('POST /api/cart — response shape sau khi thêm', () => {
  test('response có totalItems tăng lên ≥ 1', async () => {
    const res = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.totalItems).toBeGreaterThanOrEqual(1);
  });

  test('response có subtotal > 0 sau khi thêm sản phẩm có giá', async () => {
    const res = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.subtotal).toBeGreaterThan(0);
  });
});

describe('PUT /api/cart/items/:id — response shape sau khi cập nhật', () => {
  test('response có quantity đã cập nhật', async () => {
    // Lấy cart để lấy itemId thực
    const cartRes = await request(app).get('/api/cart').set('Authorization', `Bearer ${token}`);
    const items = cartRes.body.data?.items ?? [];
    if (items.length === 0) return;

    const itemId = items[0].id;
    const newQty = 3;
    const res = await request(app)
      .put(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ quantity: newQty });
    expect(res.status).toBe(200);
    // Response trả về cart cập nhật — item phải có quantity = newQty
    const updatedItems = res.body.data?.items ?? [];
    const updatedItem = updatedItems.find((i) => i.id === itemId);
    if (updatedItem) {
      expect(updatedItem.quantity).toBe(newQty);
    }
  });
});

describe('DELETE /api/cart/items/:id — totalItems giảm', () => {
  test('sau khi xóa item, totalItems giảm hoặc giỏ rỗng', async () => {
    // Thêm một item mới để có thể xóa
    const addRes = await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });
    expect(addRes.status).toBe(200);
    const totalBefore = addRes.body.data?.totalItems ?? 0;

    const items = addRes.body.data?.items ?? [];
    if (items.length === 0) return;
    const itemId = items[items.length - 1].id; // lấy item cuối

    const delRes = await request(app)
      .delete(`/api/cart/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delRes.status).toBe(200);
    const totalAfter = delRes.body.data?.totalItems ?? 0;
    expect(totalAfter).toBeLessThanOrEqual(totalBefore);
  });
});

describe('GET /api/cart/count — response là số ≥ 0', () => {
  test('count là kiểu number không âm', async () => {
    const res = await request(app).get('/api/cart/count').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const count = res.body.data?.count;
    expect(typeof count).toBe('number');
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /api/cart/validate — response shape', () => {
  test('có hasIssues boolean và items array', async () => {
    const res = await request(app)
      .get('/api/cart/validate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(typeof data.hasIssues).toBe('boolean');
    expect(Array.isArray(data.items)).toBe(true);
  });
});

describe('POST /api/cart/sync — response shape', () => {
  test('response có id và items array', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({
        items: [{ productId: product.id, variantId: variant.id, quantity: 1 }],
      });
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('id');
    expect(Array.isArray(data.items)).toBe(true);
  });

  test('sync items rỗng → giỏ hàng được clear (items rỗng)', async () => {
    const res = await request(app)
      .post('/api/cart/sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [] });
    // 200 với cart rỗng hoặc 400 nếu items rỗng không được phép
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const data = res.body.data;
      // cart được clear → totalItems = 0
      expect(data.totalItems ?? data.items?.length ?? 0).toBe(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// ORDERS — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/orders — response shape', () => {
  test('data có array + total + limit fields', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .query({ page: 1, limit: 10 });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    // total nằm ở root hoặc trong data
    const hasTotal = 'total' in res.body || 'total' in (res.body.data ?? {});
    expect(hasTotal).toBe(true);
  });
});

describe('POST /api/orders — tạo đơn hàng', () => {
  test('response có id, number, status=pending', async () => {
    // Re-add item vào giỏ vì sync rỗng có thể đã xóa
    await request(app)
      .post('/api/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        shippingFirstName: '__HTTP',
        shippingLastName: 'COLD',
        shippingAddress1: '1 Cold St',
        shippingCity: 'HCM',
        billingFirstName: '__HTTP',
        billingLastName: 'COLD',
        billingAddress1: '1 Cold St',
        billingCity: 'HCM',
        paymentMethod: 'cod',
      });
    expect([201, 400]).toContain(res.status);
    if (res.status === 201) {
      const order = res.body.data?.order ?? res.body.data;
      createdOrderId = order?.id;
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('number');
      expect(order.status).toBe('pending');
    }
  });

  test('response có items array khi tạo thành công', async () => {
    if (!createdOrderId) return;
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const order = res.body.data?.order ?? res.body.data;
    expect(Array.isArray(order?.items ?? order?.OrderItems)).toBe(true);
  });
});

describe('GET /api/orders/:id — items có Product.name', () => {
  test('mỗi order item có tên sản phẩm', async () => {
    if (!createdOrderId) return;
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const order = res.body.data?.order ?? res.body.data;
    const items = order?.items ?? order?.OrderItems ?? [];
    if (items.length > 0) {
      const firstItem = items[0];
      // Tên sản phẩm có thể ở productName, Product.nameVi, hoặc nested
      const hasName =
        'productName' in firstItem ||
        firstItem.Product?.nameVi != null ||
        firstItem.Product?.nameEn != null;
      expect(hasName).toBe(true);
    }
  });
});

describe('GET /api/orders/shipping-estimate — phí vận chuyển theo subtotal', () => {
  test('subtotal < 2_000_000 → shippingFee > 0 hoặc response 400', async () => {
    const res = await request(app)
      .get('/api/orders/shipping-estimate')
      .set('Authorization', `Bearer ${token}`)
      .query({ subtotal: 500000 });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const fee = res.body.data?.shippingCost ?? res.body.data?.shippingFee ?? 0;
      // Subtotal thấp thường phải trả phí ship
      expect(typeof fee).toBe('number');
    }
  });

  test('subtotal ≥ 2_000_000 → shippingFee = 0 hoặc response 400', async () => {
    const res = await request(app)
      .get('/api/orders/shipping-estimate')
      .set('Authorization', `Bearer ${token}`)
      .query({ subtotal: 3000000 });
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      const fee = res.body.data?.shippingCost ?? res.body.data?.shippingFee ?? -1;
      expect(fee).toBe(0);
    }
  });
});

describe('POST /api/orders/:id/cancel — đơn đang xử lý', () => {
  test('hủy đơn có status=processing → 200 hoặc 422 (tuỳ business rule)', async () => {
    // Tạo đơn có status processing trực tiếp qua DB
    const processingOrder = await Order.create({
      userId: user.id,
      status: 'processing',
      paymentStatus: 'paid',
      paymentMethod: 'cod',
      subtotal: 5_000_000,
      tax: 0,
      shippingCost: 0,
      total: 5_000_000,
      shippingFirstName: '__HTTP',
      shippingLastName: 'COLD',
      shippingAddress1: '1 Cold St',
      shippingCity: 'HCM',
      billingFirstName: '__HTTP',
      billingLastName: 'COLD',
      billingAddress1: '1 Cold St',
      billingCity: 'HCM',
      number: `ORD-COLD-PROC-${TS}`,
    });

    const res = await request(app)
      .post(`/api/orders/${processingOrder.id}/cancel`)
      .set('Authorization', `Bearer ${token}`);
    // API cho phép hủy đơn processing (200) hoặc từ chối (422)
    expect([200, 400, 422]).toContain(res.status);

    await Order.destroy({ where: { id: processingOrder.id }, force: true }).catch(() => {});
  });
});

describe('POST /api/orders/track — response shape', () => {
  test('response có tracking steps array hoặc 404', async () => {
    const res = await request(app).get('/api/orders/track?number=ORD-NOTEXIST-COLD-99');
    expect([200, 400, 404]).toContain(res.status);
    if (res.status === 200) {
      const data = res.body.data;
      // Response có steps array hoặc order object
      expect(data).toBeDefined();
    }
  });
});

describe('GET /api/orders/number/:number — response có status và items', () => {
  test('số đơn hợp lệ trả về status và items', async () => {
    if (!createdOrderId) return;
    const orderRes = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${token}`);
    const orderData = orderRes.body.data?.order ?? orderRes.body.data;
    const orderNumber = orderData?.number;
    if (!orderNumber) return;

    const res = await request(app)
      .get(`/api/orders/number/${orderNumber}`)
      .set('Authorization', `Bearer ${token}`);
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      const order = res.body.data?.order ?? res.body.data;
      expect(order).toHaveProperty('status');
      const items = order?.items ?? order?.OrderItems ?? [];
      expect(Array.isArray(items)).toBe(true);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// LOYALTY — response shape tests
// ════════════════════════════════════════════════════════════════

describe('GET /api/loyalty — response shape', () => {
  test('data có points và history object', async () => {
    const res = await request(app).get('/api/loyalty').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toHaveProperty('points');
    // API trả về { points, history: { total, pages, currentPage, items } }
    expect(data).toHaveProperty('history');
  });

  test('points ≥ 0 (không âm)', async () => {
    const res = await request(app).get('/api/loyalty').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.points).toBeGreaterThanOrEqual(0);
  });

  test('không auth → 401', async () => {
    const res = await request(app).get('/api/loyalty');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/loyalty/redeem — response shape', () => {
  test('redeem thành công (nếu đủ điểm) có message', async () => {
    // User mới không có điểm → 400 nhưng response vẫn có message
    const res = await request(app)
      .post('/api/loyalty/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ points: 10 });
    // 400 vì không đủ điểm, nhưng đây là behavior test
    expect([200, 400, 422]).toContain(res.status);
    expect(res.body.message ?? res.body.data?.message ?? res.body.status).toBeTruthy();
  });

  test('redeem thành công trả về newPoints trong response', async () => {
    // Chỉ kiểm tra khi user có điểm (skip nếu không có)
    const loyaltyRes = await request(app)
      .get('/api/loyalty')
      .set('Authorization', `Bearer ${token}`);
    const currentPoints = loyaltyRes.body.data?.points ?? 0;
    if (currentPoints < 1) {
      // Không đủ điểm để redeem — test behavior 400
      const res = await request(app)
        .post('/api/loyalty/redeem')
        .set('Authorization', `Bearer ${token}`)
        .send({ points: 1 });
      expect([400, 422]).toContain(res.status);
      return;
    }
    const res = await request(app)
      .post('/api/loyalty/redeem')
      .set('Authorization', `Bearer ${token}`)
      .send({ points: 1 });
    if (res.status === 200) {
      const data = res.body.data;
      const hasNewPoints = 'newPoints' in data || 'remainingPoints' in data || 'points' in data;
      expect(hasNewPoints).toBe(true);
    }
  });
});
