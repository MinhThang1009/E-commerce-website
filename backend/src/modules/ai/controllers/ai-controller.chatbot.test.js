/**
 * Test HTTP endpoints của chatbot:
 *  - POST /api/chatbot/cart/add  → 401 không có token, 404 sản phẩm không tồn tại, 400 hết hàng, 200 thành công
 *  - POST /api/chatbot/analytics → 401 không có token, 200 thành công
 *  - chatbotLimiter              → 429 sau khi vượt 20 requests/phút
 *
 * Chiến lược mock:
 *  - Sequelize models: mock để tránh kết nối DB
 *  - authenticate middleware: check header Authorization → 401 nếu thiếu
 *  - chatbotLimiter: mock pass-through trong main describe, test riêng dùng requireActual
 *  - AI services: mock để tránh gọi API ngoài
 */

// ---------- Mocks (Jest hoist lên trước require) ----------

jest.mock('@models', () => ({
  Product: { findByPk: jest.fn(), findOne: jest.fn() },
  ProductVariant: {
    findByPk: jest.fn().mockResolvedValue({ price: 500_000 }),
    findOne: jest.fn().mockResolvedValue({ id: 1, price: 500_000 }),
  },
  Cart: { findOne: jest.fn(), create: jest.fn() },
  CartItem: { findOne: jest.fn().mockResolvedValue(null), create: jest.fn() },
  ChatMessage: { create: jest.fn().mockResolvedValue({}) },
  Category: {},
  Brand: {},
  Order: {},
  OrderItem: {},
  User: {},
  sequelize: {},
  Op: {},
}));

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@modules/ai/services/chatbot/chatbot-service', () => ({
  handleMessage: jest.fn().mockResolvedValue({
    response: 'Xin chào!',
    suggestions: [],
    products: [],
    sessionId: 'sess_test',
  }),
}));

const authMiddlewareMock = {
  authenticate: (req, res, next) => {
    if (!req.headers.authorization) {
      return res.status(401).json({ status: 'error', message: 'Không được phép truy cập' });
    }
    req.user = { id: 1 };
    next();
  },
  optionalAuthenticate: (req, res, next) => {
    if (req.headers.authorization) req.user = { id: 1 };
    next();
  },
};
// Mock cả legacy path và shared path (ai module dùng shared path)
jest.mock('@middlewares/authenticate', () => authMiddlewareMock);
jest.mock('@middlewares/authenticate', () => authMiddlewareMock);

const rateLimiterMock = {
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
};
jest.mock('@middlewares/rate-limiter', () => rateLimiterMock);
jest.mock('@middlewares/rate-limiter', () => rateLimiterMock);

// ---------- Require sau khi mocks đã đăng ký ----------

const express = require('express');
const supertest = require('supertest');
// Dùng ai module routes (đã migrate từ routes/chatbot.js)
const buildAIModule = require('@modules/ai/module');
const chatbotService = require('@modules/ai/services/chatbot/chatbot-service');
const { Product, ProductVariant, Category, Cart, CartItem } = require('@models');
const sequelize = require('@config/sequelize');

const aiModule = buildAIModule({
  Product,
  ProductVariant,
  Category,
  chatbotService,
  sequelize,
  eventBus: { publish: () => {} },
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
});

// App Express tối giản chỉ có chatbot routes
const app = express();
app.use(express.json());
app.use('/api/chatbot', aiModule.router);
// Error handler cần thiết để AppError → JSON response
app.use((err, _req, res, _next) => {
  res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
});
const request = supertest(app);

// ============================================================
// POST /api/chatbot/message
// ============================================================

describe('POST /api/chatbot/message', () => {
  test('400 khi message rỗng', async () => {
    const res = await request.post('/api/chatbot/message').send({ message: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
  });

  test('400 khi message vượt 2000 ký tự', async () => {
    const res = await request.post('/api/chatbot/message').send({ message: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/quá dài|2000/);
  });

  test('200 khi message đúng 2000 ký tự', async () => {
    const res = await request.post('/api/chatbot/message').send({ message: 'a'.repeat(2000) });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
  });

  test('200 khi gửi message bình thường', async () => {
    const res = await request
      .post('/api/chatbot/message')
      .send({ message: 'Sản phẩm nào đang giảm giá?' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('response');
  });
});

// ============================================================
// POST /api/chatbot/cart/add
// ============================================================

describe('POST /api/chatbot/cart/add', () => {
  beforeEach(() => {
    // Mặc định: giỏ hàng tồn tại, sản phẩm active và còn hàng
    Cart.findOne.mockResolvedValue({ id: 1 });
    Cart.create.mockResolvedValue({ id: 2 });
    Product.findByPk.mockResolvedValue({ id: 1, status: 'active', stockQuantity: 10 });
    CartItem.findOne.mockResolvedValue(null);
    CartItem.create.mockResolvedValue({ id: 10, cartId: 1, productId: 1, quantity: 1 });
  });

  test('401 khi không có Authorization header', async () => {
    const res = await request.post('/api/chatbot/cart/add').send({ productId: 1, quantity: 1 });
    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  test('404 khi productId không tồn tại trong DB', async () => {
    Product.findByPk.mockResolvedValue(null);

    const res = await request
      .post('/api/chatbot/cart/add')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 99999, quantity: 1 });

    expect(res.status).toBe(404);
    expect(res.body.status).toBe('error');
  });

  test('400 khi sản phẩm hết hàng (stockQuantity = 0)', async () => {
    Product.findByPk.mockResolvedValue({ id: 1, status: 'active', stockQuantity: 0 });

    const res = await request
      .post('/api/chatbot/cart/add')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 1 });

    expect(res.status).toBe(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(/hết hàng/);
  });

  test('400 khi sản phẩm không active (status !== active)', async () => {
    Product.findByPk.mockResolvedValue({ id: 1, status: 'inactive', stockQuantity: 10 });

    const res = await request
      .post('/api/chatbot/cart/add')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 1 });

    expect(res.status).toBe(400);
  });

  test('200 khi thêm sản phẩm thành công', async () => {
    const res = await request
      .post('/api/chatbot/cart/add')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(CartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 1, quantity: 2 }),
    );
  });

  test('tạo mới giỏ hàng khi user chưa có cart', async () => {
    Cart.findOne.mockResolvedValue(null); // chưa có cart
    Cart.create.mockResolvedValue({ id: 5 });

    const res = await request
      .post('/api/chatbot/cart/add')
      .set('Authorization', 'Bearer test-token')
      .send({ productId: 1, quantity: 1 });

    expect(res.status).toBe(200);
    expect(Cart.create).toHaveBeenCalledWith({ userId: 1, status: 'active' });
  });
});

// ============================================================
// POST /api/chatbot/analytics
// ============================================================

describe('POST /api/chatbot/analytics', () => {
  test('401 khi không có Authorization header', async () => {
    const res = await request
      .post('/api/chatbot/analytics')
      .send({ event: 'product_clicked', productId: 1 });

    expect(res.status).toBe(401);
    expect(res.body.status).toBe('error');
  });

  test('200 khi ghi nhận analytics thành công', async () => {
    const res = await request
      .post('/api/chatbot/analytics')
      .set('Authorization', 'Bearer test-token')
      .send({ event: 'product_clicked', productId: 1, sessionId: 'sess_1' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    // Analytics giờ lưu qua aiRepository.createAnalyticsEvent (chat_messages)
    // không còn gọi chatbotService.trackAnalytics trực tiếp
  });
});

// ============================================================
// chatbotLimiter — rate limiting (test riêng biệt với requireActual)
// ============================================================

describe('chatbotLimiter — rate limiting', () => {
  // Dùng jest.resetModules() + jest.requireActual để lấy instance chatbotLimiter
  // hoàn toàn mới (store counter bắt đầu từ 0), không bị ảnh hưởng bởi mock ở trên
  let rlRequest;

  beforeAll(() => {
    jest.resetModules();

    // Require lại các module thực tế (không bị mock) để tạo app test rate limit
    const freshExpress = jest.requireActual('express');
    const freshSupertest = jest.requireActual('supertest');
    const { chatbotLimiter } = jest.requireActual('@middlewares/rate-limiter');

    const rlApp = freshExpress();
    rlApp.use(freshExpress.json());
    // Route đơn giản chỉ để đo rate limit
    rlApp.post('/probe', chatbotLimiter, (_req, res) => res.status(200).json({ ok: true }));

    rlRequest = freshSupertest(rlApp);
  });

  test('429 sau khi vượt 20 requests trong 1 phút', async () => {
    // Gửi đúng 20 requests (nằm trong giới hạn)
    const batch = Array.from({ length: 20 }, () => rlRequest.post('/probe').send({}));
    const responses = await Promise.all(batch);
    responses.forEach((r) => expect(r.status).toBe(200));

    // Request thứ 21 phải bị từ chối
    const overLimit = await rlRequest.post('/probe').send({});
    expect(overLimit.status).toBe(429);
    expect(overLimit.body.status).toBe('error');
  }, 20000);
});
