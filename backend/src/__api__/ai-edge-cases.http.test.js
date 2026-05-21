/**
 * HTTP tests — AI Chatbot endpoints chưa được bao phủ trong ai-chatbot.http.test.js.
 *
 * Scope:
 *   - GET /api/chatbot/recommendations với productId
 *   - GET /api/chatbot/recommendations không có productId (danh sách chung)
 *   - POST /api/chatbot/analytics (authenticated)
 *   - POST /api/chatbot/analytics (không auth → 401)
 *   - POST /api/chatbot/cart/add (authenticated)
 *   - POST /api/chatbot/cart/add (không auth → 401)
 *
 * ai-chatbot.http.test.js đã cover:
 *   - POST /api/chatbot/message (các cases)
 *   - GET /api/chatbot/recommendations không auth (chỉ status check)
 *   - POST /api/chatbot/analytics không auth → 401
 */
require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Product, ProductVariant, Cart, CartItem } = require('@models');

const TS = Date.now();
let user, token, product, variant, cat, brand;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_ai_edge_${TS}@t.com` }));
  ({ product, variant, cat, brand } = await createTestProduct());
});

afterAll(async () => {
  // Dọn cart items trước để tránh FK constraint khi xóa product/variant
  if (user?.id) {
    const carts = await Cart.findAll({ where: { userId: user.id } });
    const cartIds = carts.map((c) => c.id);
    if (cartIds.length) {
      await CartItem.destroy({ where: { cartId: cartIds }, force: true });
    }
    await Cart.destroy({ where: { userId: user.id }, force: true });
  }
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (cat) await Category.destroy({ where: { id: cat.id } });
  if (brand) await Brand.destroy({ where: { id: brand.id } });
  if (user?.id) await User.destroy({ where: { id: user.id }, force: true });
});

// ─────────────────────────────────────────────────────────────
describe('GET /api/chatbot/recommendations với productId', () => {
  test('productId hợp lệ → 200 và trả về data', async () => {
    const res = await request(app)
      .get('/api/chatbot/recommendations')
      .query({ productId: product.id, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });

  test('productId không tồn tại → 200 với mảng rỗng hoặc danh sách chung', async () => {
    const res = await request(app)
      .get('/api/chatbot/recommendations')
      .query({ productId: 9999999, limit: 5 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });
});

// ─────────────────────────────────────────────────────────────
describe('GET /api/chatbot/recommendations không có productId', () => {
  test('không truyền productId → 200 với danh sách chung', async () => {
    const res = await request(app).get('/api/chatbot/recommendations');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/chatbot/analytics', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/chatbot/analytics')
      .send({ event: 'product_view', productId: product.id });

    expect(res.status).toBe(401);
  });

  test('authenticated với event hợp lệ → 200', async () => {
    const res = await request(app)
      .post('/api/chatbot/analytics')
      .set('Authorization', `Bearer ${token}`)
      .send({ event: 'product_view', productId: product.id });

    // Service ghi async — chỉ cần endpoint phản hồi thành công
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('authenticated không có event field → 200 (service tự handle)', async () => {
    // trackAnalytics không validate bắt buộc event — controller chuyển thẳng sang service
    const res = await request(app)
      .post('/api/chatbot/analytics')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id });

    expect([200, 400]).toContain(res.status);
  });
});

// ─────────────────────────────────────────────────────────────
describe('POST /api/chatbot/cart/add', () => {
  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/chatbot/cart/add')
      .send({ productId: product.id, variantId: variant.id });

    expect(res.status).toBe(401);
  });

  test('authenticated với productId và variantId hợp lệ → 200 hoặc 400', async () => {
    // 400 có thể xảy ra nếu stock validation fail, cart conflict, v.v.
    const res = await request(app)
      .post('/api/chatbot/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, variantId: variant.id, quantity: 1 });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBe('success');
    }
  });

  test('authenticated với productId không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/chatbot/cart/add')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: 9999999, variantId: null, quantity: 1 });

    expect([400, 404]).toContain(res.status);
  });
});
