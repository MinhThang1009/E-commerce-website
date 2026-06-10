/**
 * Integration tests — AI Chatbot với database thật (techstore).
 *
 * Scope: DB operations của chatbot module
 *   - ChatMessage: lưu/đọc/filter lịch sử chat
 *   - AIRepository: createAnalyticsEvent, findProductForCart, addToCart
 *   - Chatbot flow: session history persistence
 *
 * KHÔNG test LLM generation (cần API key).
 * KHÔNG test vector store search (cần embedding API key).
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { ChatMessage, User, Product, ProductVariant, Category, Brand } = require('@models');
const { Op } = require('sequelize');
const SequelizeAIRepository = require('@modules/ai/repositories/sequelize-ai-repository');

const TS = Date.now();
let user, testProduct, testCategory, aiRepo;

beforeAll(async () => {
  await sequelize.authenticate();

  // Tạo user cho các test cần userId
  user = await User.create({
    firstName: '__INT_Chatbot',
    lastName: 'User',
    email: `__int_chatbot_${TS}@t.com`,
    password: 'Chatbot123!',
    role: 'customer',
  });

  // Tạo category + brand + product để test AI repository search
  testCategory = await Category.create({
    nameVi: `__INT_AI_Cat_${TS}`,
    nameEn: `__INT_AI_Cat_${TS}`,
    slug: `int-ai-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_AI_Brand_${TS}`,
    nameEn: `__INT_AI_Brand_${TS}`,
    slug: `int-ai-brand-${TS}`,
  });
  testProduct = await Product.create({
    nameVi: `__INT_AI_Laptop_${TS}`,
    nameEn: `__INT_AI_Laptop_EN_${TS}`,
    baseName: `__INT_AI_Laptop_${TS}`,
    slug: `int-ai-laptop-${TS}`,
    description: `laptop test description ${TS}`,
    basePrice: 15_000_000,
    compareAtPrice: 18_000_000,
    categoryId: testCategory.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
    isFeatured: true,
  });
  await ProductVariant.create({
    productId: testProduct.id,
    sku: `INT-AI-VAR-${TS}`,
    variantName: 'Base',
    price: 15_000_000,
    stockQuantity: 10,
    isDefault: true,
  });

  // Khởi tạo AI repository với real models
  aiRepo = new SequelizeAIRepository({
    Product,
    ProductVariant,
    Category,
    sequelize,
  });
});

afterAll(async () => {
  await ChatMessage.destroy({
    where: { sessionId: { [Op.like]: `int-session-${TS}%` } },
    force: true,
  });
  await ChatMessage.destroy({ where: { userId: user?.id } }, { force: true });
  await ProductVariant.destroy({ where: { productId: testProduct?.id }, force: true });
  if (testProduct) await testProduct.destroy({ force: true });
  if (testCategory) await testCategory.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

// ─────────────────────────────────────────────────────────────
describe('ChatMessage Integration — Lưu & đọc lịch sử', () => {
  const sessionId = `int-session-${TS}-1`;

  test('Lưu tin nhắn user vào DB', async () => {
    const msg = await ChatMessage.create({
      sessionId,
      userId: user.id,
      role: 'user',
      content: 'Laptop nào tốt dưới 20 triệu?',
      messageType: 'ai_chatbot',
      isFallback: false,
      isArchived: false,
    });
    expect(msg.id).toBeDefined();
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Laptop nào tốt dưới 20 triệu?');
  });

  test('Lưu tin nhắn assistant (response)', async () => {
    const msg = await ChatMessage.create({
      sessionId,
      userId: user.id,
      role: 'assistant',
      content: 'Dưới đây là các laptop tốt dưới 20 triệu...',
      messageType: 'ai_chatbot',
      intent: 'product_search',
      responseTimeMs: 450,
      isFallback: false,
      isArchived: false,
    });
    expect(msg.role).toBe('assistant');
    expect(msg.intent).toBe('product_search');
    expect(msg.responseTimeMs).toBe(450);
  });

  test('Đọc lịch sử chat theo sessionId — đúng thứ tự', async () => {
    const history = await ChatMessage.findAll({
      where: { sessionId },
      order: [['createdAt', 'ASC']],
    });
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[1].role).toBe('assistant');
  });

  test('Lưu nhiều turns — max 10 turns logic', async () => {
    const extraSession = `int-session-${TS}-extra`;
    for (let i = 0; i < 5; i++) {
      await ChatMessage.create({
        sessionId: extraSession,
        userId: user.id,
        role: 'user',
        content: `Turn ${i} user`,
        messageType: 'ai_chatbot',
        isFallback: false,
        isArchived: false,
      });
      await ChatMessage.create({
        sessionId: extraSession,
        userId: user.id,
        role: 'assistant',
        content: `Turn ${i} assistant`,
        messageType: 'ai_chatbot',
        isFallback: false,
        isArchived: false,
      });
    }
    const all = await ChatMessage.findAll({ where: { sessionId: extraSession } });
    expect(all).toHaveLength(10); // 5 turns = 10 messages
    await ChatMessage.destroy({ where: { sessionId: extraSession }, force: true });
  });

  test('Filter theo userId — chỉ messages của user này', async () => {
    const msgs = await ChatMessage.findAll({ where: { userId: user.id, sessionId } });
    expect(msgs.length).toBeGreaterThanOrEqual(2);
    for (const m of msgs) expect(m.userId).toBe(user.id);
  });

  test('isFallback flag — đánh dấu response từ keyword fallback', async () => {
    const fallback = await ChatMessage.create({
      sessionId: `int-session-${TS}-fallback`,
      userId: user.id,
      role: 'assistant',
      content: 'Xin lỗi, tôi không hiểu câu hỏi này.',
      messageType: 'ai_chatbot',
      isFallback: true,
      isArchived: false,
    });
    expect(fallback.isFallback).toBe(true);
  });

  test('Soft archive messages cũ', async () => {
    const oldMsg = await ChatMessage.create({
      sessionId: `int-session-${TS}-old`,
      userId: user.id,
      role: 'user',
      content: 'Câu hỏi cũ',
      messageType: 'ai_chatbot',
      isFallback: false,
      isArchived: false,
    });
    await oldMsg.update({ isArchived: true });
    await oldMsg.reload();
    expect(oldMsg.isArchived).toBe(true);

    // Active messages không include archived
    const active = await ChatMessage.findAll({
      where: { sessionId: `int-session-${TS}-old`, isArchived: false },
    });
    expect(active).toHaveLength(0);
  });
});

// searchProducts đã bị xóa khỏi SequelizeAIRepository (dead code — AI module dùng vector search, không dùng SQL keyword search).

// ─────────────────────────────────────────────────────────────
describe('AI Repository Integration — Analytics Event', () => {
  test('createAnalyticsEvent lưu vào ChatMessage', async () => {
    const before = await ChatMessage.count({ where: { userId: user.id, intent: 'view_product' } });
    await aiRepo.createAnalyticsEvent({
      event: 'view_product',
      userId: user.id,
      sessionId: `int-session-${TS}-analytics`,
      productId: testProduct.id,
      value: 1,
      metadata: { source: 'chatbot_recommendation' },
    });
    // Đợi async
    await new Promise((r) => setTimeout(r, 100));
    const after = await ChatMessage.count({ where: { userId: user.id, intent: 'view_product' } });
    expect(after).toBe(before + 1);
  });

  test('Analytics event content có thể parse JSON', async () => {
    const event = await ChatMessage.findOne({
      where: { userId: user.id, intent: 'view_product', sessionId: `int-session-${TS}-analytics` },
    });
    expect(event).not.toBeNull();
    const parsed = JSON.parse(event.content);
    expect(parsed.event).toBe('view_product');
    expect(parsed.productId).toBe(testProduct.id);
  });
});

// ─────────────────────────────────────────────────────────────
describe('AI Repository Integration — findProductForCart', () => {
  test('findProductForCart lấy product với variants', async () => {
    const p = await aiRepo.findProductForCart(testProduct.id);
    expect(p).not.toBeNull();
    expect(p.id).toBe(testProduct.id);
    expect(p.variants).toBeDefined();
    expect(p.variants.length).toBeGreaterThan(0);
  });

  test('findProductForCart trả null cho productId không tồn tại', async () => {
    const p = await aiRepo.findProductForCart(999999999);
    expect(p).toBeNull();
  });
});

// searchProducts với categoryName đã bị xóa cùng với searchProducts method.

// ─────────────────────────────────────────────────────────────
describe('AI Repository Integration — addToCart', () => {
  test('addToCart tạo cart mới nếu user chưa có, thêm CartItem', async () => {
    const { Cart, CartItem } = require('@models');

    // Đảm bảo user chưa có cart
    await CartItem.destroy({ where: {}, force: true });
    await Cart.destroy({ where: { userId: user.id }, force: true });

    await aiRepo.addToCart({
      userId: user.id,
      productId: testProduct.id,
      variantId: (
        await require('@models').ProductVariant.findOne({ where: { productId: testProduct.id } })
      ).id,
      quantity: 2,
    });

    const cart = await Cart.findOne({ where: { userId: user.id } });
    expect(cart).not.toBeNull();

    const item = await CartItem.findOne({ where: { cartId: cart.id, productId: testProduct.id } });
    expect(item).not.toBeNull();
    expect(item.quantity).toBe(2);

    // Cleanup
    await CartItem.destroy({ where: { cartId: cart.id }, force: true });
    await cart.destroy({ force: true });
  });

  // Verifies [M8]: SP không có variant + body không gửi variantId — trước fix Sequelize throw
  // 'WHERE parameter "variantId" has invalid "undefined" value' → 500
  test('addToCart không truyền variantId với SP không có variant → tạo item variantId=null', async () => {
    const { Cart, CartItem, Brand } = require('@models');
    const brand2 = await Brand.findOne({ where: { slug: `int-ai-brand-${TS}` } });
    const noVariantProduct = await Product.create({
      nameVi: `__INT_AI_NoVar_${TS}`,
      nameEn: `__INT_AI_NoVar_EN_${TS}`,
      baseName: `__INT_AI_NoVar_${TS}`,
      slug: `int-ai-novar-${TS}`,
      description: 'sp không variant',
      basePrice: 2_000_000,
      categoryId: testCategory.id,
      brandId: brand2.id,
      status: 'active',
      stockQuantity: 5,
    });

    try {
      const item = await aiRepo.addToCart({
        userId: user.id,
        productId: noVariantProduct.id,
        quantity: 1,
      });
      expect(item).not.toBeNull();
      expect(item.variantId).toBeNull();
      expect(Number(item.unitPrice)).toBe(2_000_000);
    } finally {
      const cart = await Cart.findOne({ where: { userId: user.id } });
      if (cart) {
        await CartItem.destroy({ where: { cartId: cart.id }, force: true });
        await cart.destroy({ force: true });
      }
      await noVariantProduct.destroy({ force: true });
    }
  });

  test('addToCart tái sử dụng cart hiện có', async () => {
    const { Cart, CartItem } = require('@models');

    // Tạo cart trước
    const existingCart = await Cart.create({ userId: user.id, status: 'active' });

    await aiRepo.addToCart({
      userId: user.id,
      productId: testProduct.id,
      variantId: (
        await require('@models').ProductVariant.findOne({ where: { productId: testProduct.id } })
      ).id,
      quantity: 1,
    });

    // Phải dùng cart cũ, không tạo mới
    const carts = await Cart.findAll({ where: { userId: user.id } });
    expect(carts.length).toBe(1);
    expect(carts[0].id).toBe(existingCart.id);

    // Cleanup
    await CartItem.destroy({ where: { cartId: existingCart.id }, force: true });
    await existingCart.destroy({ force: true });
  });
});
