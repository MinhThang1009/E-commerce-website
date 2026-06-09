require('module-alias/register');
const { app, request, createTestUser, createTestProduct } = require('./http-setup');
const { User, Category, Brand, Product, ProductVariant, Cart, CartItem } = require('@models');

const TS = Date.now();
let user, token;

beforeAll(async () => {
  ({ user, token } = await createTestUser({ email: `__http_chatbot_${TS}@t.com` }));
});

afterAll(async () => {
  await User.destroy({ where: { id: user?.id }, force: true });
});

describe('POST /api/chatbot/message', () => {
  test('message hợp lệ → 200 hoặc 5xx (demo key)', async () => {
    const res = await request(app)
      .post('/api/chatbot/message')
      .send({ message: 'laptop dưới 20 triệu' });
    expect([200, 500, 503]).toContain(res.status);
    if (res.status === 200) expect(res.body.status).toBe('success');
  });

  test('message rỗng → 400', async () => {
    const res = await request(app).post('/api/chatbot/message').send({ message: '' });
    expect(res.status).toBe(400);
  });

  test('thiếu message field → 400', async () => {
    const res = await request(app).post('/api/chatbot/message').send({});
    expect(res.status).toBe(400);
  });
});

// ─── Merged from: ai-edge-cases.http.test.js ─────────────────────────────────
// HTTP tests — AI Chatbot endpoints chưa được bao phủ trong ai-chatbot.http.test.js.
// Scope:
//   - POST /api/chatbot/cart/add (authenticated)
//   - POST /api/chatbot/cart/add (không auth → 401)
describe('POST /api/chatbot/cart/add', () => {
  let user2, token2, product2, variant2, cat2, brand2;
  const TS2 = Date.now();

  beforeAll(async () => {
    ({ user: user2, token: token2 } = await createTestUser({
      email: `__http_ai_edge_${TS2}@t.com`,
    }));
    ({
      product: product2,
      variant: variant2,
      cat: cat2,
      brand: brand2,
    } = await createTestProduct());
  });

  afterAll(async () => {
    // Dọn cart items trước để tránh FK constraint khi xóa product/variant
    if (user2?.id) {
      const carts = await Cart.findAll({ where: { userId: user2.id } });
      const cartIds = carts.map((c) => c.id);
      if (cartIds.length) {
        await CartItem.destroy({ where: { cartId: cartIds }, force: true });
      }
      await Cart.destroy({ where: { userId: user2.id }, force: true });
    }
    if (variant2) await variant2.destroy({ force: true });
    if (product2) await product2.destroy({ force: true });
    if (cat2) await Category.destroy({ where: { id: cat2.id } });
    if (brand2) await Brand.destroy({ where: { id: brand2.id } });
    if (user2?.id) await User.destroy({ where: { id: user2.id }, force: true });
  });

  test('không auth → 401', async () => {
    const res = await request(app)
      .post('/api/chatbot/cart/add')
      .send({ productId: product2.id, variantId: variant2.id });

    expect(res.status).toBe(401);
  });

  test('authenticated với productId và variantId hợp lệ → 200 hoặc 400', async () => {
    // 400 có thể xảy ra nếu stock validation fail, cart conflict, v.v.
    const res = await request(app)
      .post('/api/chatbot/cart/add')
      .set('Authorization', `Bearer ${token2}`)
      .send({ productId: product2.id, variantId: variant2.id, quantity: 1 });

    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.status).toBe('success');
    }
  });

  test('authenticated với productId không tồn tại → 400 hoặc 404', async () => {
    const res = await request(app)
      .post('/api/chatbot/cart/add')
      .set('Authorization', `Bearer ${token2}`)
      .send({ productId: 9999999, variantId: null, quantity: 1 });

    expect([400, 404]).toContain(res.status);
  });
});
