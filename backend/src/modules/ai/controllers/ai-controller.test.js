// Unit tests cho AIController — phủ các nhánh còn thiếu:
//   - productSearch: happy path + error path (next(err))
//   - addToCart: happy path + error path
//   - handleMessage: 500 fallback (line 19) + 400 path

const AIController = require('./ai-controller');

// ---------- Mocks cho chatbot HTTP endpoint tests (Jest hoist lên trước require) ----------

// sequelize.transaction cần mock để tránh kết nối DB thật trong unit test
jest.mock('@config/sequelize', () => ({
  transaction: jest.fn(async (cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
  fn: jest.fn(),
  col: jest.fn(),
  literal: jest.fn((s) => s),
}));

jest.mock('@models', () => ({
  Product: { findByPk: jest.fn(), findOne: jest.fn() },
  ProductVariant: {
    findByPk: jest.fn().mockResolvedValue({ price: 500_000 }),
    findOne: jest.fn().mockResolvedValue({ id: 1, price: 500_000 }),
  },
  Cart: { findOne: jest.fn(), create: jest.fn(), findOrCreate: jest.fn() },
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

const rateLimiterMock = {
  chatbotLimiter: (_req, _res, next) => next(),
  chatLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
  otpLimiter: (_req, _res, next) => next(),
};
jest.mock('@middlewares/rate-limiter', () => rateLimiterMock);

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeLogger() {
  return { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
}

function makeService() {
  return {
    handleMessage: jest.fn(),
    addToCart: jest.fn(),
  };
}

describe('AIController', () => {
  let controller;
  let aiService;
  let logger;

  beforeEach(() => {
    aiService = makeService();
    logger = makeLogger();
    controller = new AIController({ aiService, logger });
  });

  // ────────────────────────────────────────────────────────────
  // handleMessage
  // ────────────────────────────────────────────────────────────

  describe('handleMessage', () => {
    test('500 fallback khi service throw lỗi generic (line 19)', async () => {
      aiService.handleMessage.mockRejectedValue(new Error('DB down'));

      const req = { body: { message: 'Xin chào', userId: 1, sessionId: 'sess-1', context: {} } };
      const res = makeRes();
      const next = jest.fn();

      await controller.handleMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Xử lý tin nhắn thất bại',
          data: expect.objectContaining({ suggestions: expect.any(Array) }),
        }),
      );
    });

    test('400 khi service throw lỗi với statusCode=400 (empty message → early return)', async () => {
      // Trường hợp này message rỗng → controller trả về sớm trước khi gọi service
      const err = new Error('Tin nhắn không hợp lệ');
      err.statusCode = 400;
      aiService.handleMessage.mockRejectedValue(err);

      const req = { body: { message: '', userId: 1, sessionId: 's' } };
      const res = makeRes();
      const next = jest.fn();

      await controller.handleMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('400 khi service throw lỗi statusCode=400 với message hợp lệ → logger.warn và trả về 400 (lines 29-30)', async () => {
      // Message hợp lệ → vượt validation → gọi service → service throw 400
      const err = new Error('Tin nhắn quá dài hoặc không hợp lệ');
      err.statusCode = 400;
      aiService.handleMessage.mockRejectedValue(err);

      const req = {
        body: { message: 'Xin chào tôi muốn mua laptop', userId: 1, sessionId: 's' },
        locale: 'vi',
      };
      const res = makeRes();
      const next = jest.fn();

      await controller.handleMessage(req, res, next);

      // Lines 29-30: logger.warn được gọi và trả về 400
      expect(logger.warn).toHaveBeenCalledWith('Chatbot error:', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(400);
      // t(err.message) = null (không phải i18n key) → fallback t('ai.messageFailed')
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
    });

    test('success → trả về status success và data', async () => {
      const data = { response: 'Xin chào!', suggestions: [] };
      aiService.handleMessage.mockResolvedValue(data);

      const req = { body: { message: 'Hi', userId: 1, sessionId: 's' } };
      const res = makeRes();
      const next = jest.fn();

      await controller.handleMessage(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });
  });

  // ────────────────────────────────────────────────────────────
  // addToCart
  // ────────────────────────────────────────────────────────────

  describe('addToCart', () => {
    test('gọi aiService.addToCart với userId từ req.user.id', async () => {
      const data = { cartId: 10, items: [] };
      aiService.addToCart.mockResolvedValue(data);

      const req = {
        body: { productId: 5, variantId: 2, quantity: 3, sessionId: 'sess-xyz' },
        user: { id: 7 },
      };
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(aiService.addToCart).toHaveBeenCalledWith({
        productId: 5,
        variantId: 2,
        quantity: 3,
        sessionId: 'sess-xyz',
        userId: 7,
      });
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('quantity mặc định là 1 khi không truyền', async () => {
      aiService.addToCart.mockResolvedValue({});

      const req = {
        body: { productId: 5, variantId: null, sessionId: 's' },
        user: { id: 1 },
      };
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(aiService.addToCart).toHaveBeenCalledWith(expect.objectContaining({ quantity: 1 }));
    });

    test('service throw → gọi next(err)', async () => {
      const err = new Error('Thêm giỏ hàng thất bại');
      aiService.addToCart.mockRejectedValue(err);

      const req = {
        body: { productId: 5 },
        user: { id: 1 },
      };
      const res = makeRes();
      const next = jest.fn();

      await controller.addToCart(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ────────────────────────────────────────────────────────────
  // clearSession (lines 75-78)
  // ────────────────────────────────────────────────────────────

  describe('clearSession', () => {
    test('clearSession trả về "Session đã xóa" khi cleared=true', async () => {
      aiService.clearSession = jest.fn().mockReturnValue(true);
      const req = { body: { sessionId: 'sess-1' } };
      const res = makeRes();
      await controller.clearSession(req, res);
      expect(aiService.clearSession).toHaveBeenCalledWith('sess-1');
      expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Session đã xóa' });
    });

    test('clearSession → 200 idempotent dù session không trong Map (DB cleanup vẫn chạy)', async () => {
      aiService.clearSession = jest.fn().mockResolvedValue(false);
      const req = { body: { sessionId: 'not-exist' }, locale: 'vi' };
      const res = makeRes();
      await controller.clearSession(req, res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });
  });

  // ────────────────────────────────────────────────────────────
  // registerSession (lines 81-85)
  // ────────────────────────────────────────────────────────────

  describe('registerSession', () => {
    test('sessionId hợp lệ → gọi aiService.registerSession và trả success', async () => {
      aiService.registerSession = jest.fn();
      const req = { body: { sessionId: 'sess-abc' } };
      const res = makeRes();
      await controller.registerSession(req, res);
      expect(aiService.registerSession).toHaveBeenCalledWith('sess-abc');
      expect(res.json).toHaveBeenCalledWith({ status: 'success' });
    });

    test('sessionId falsy → route-layer Zod schema chặn trước khi vào controller (không test tại controller)', async () => {
      // sessionSchema yêu cầu sessionId min(1) — validateRequest middleware reject trước.
      // Test này chỉ xác nhận controller không tự reject khi thiếu sessionId.
      aiService.registerSession = jest.fn();
      const req = { body: {} };
      const res = makeRes();
      await controller.registerSession(req, res);
      expect(aiService.registerSession).toHaveBeenCalledWith(undefined);
      expect(res.json).toHaveBeenCalledWith({ status: 'success' });
    });
  });

  // ────────────────────────────────────────────────────────────
  // getSessionMessages (lines 101-106)
  // ────────────────────────────────────────────────────────────

  describe('getSessionMessages', () => {
    test('trả về messages từ DB', async () => {
      const msgs = [{ role: 'user', content: 'Test' }];
      aiService.getSessionMessages = jest.fn().mockResolvedValue(msgs);
      const req = { params: { sessionId: 'sess-db' } };
      const res = makeRes();
      const next = jest.fn();
      await controller.getSessionMessages(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: { sessionId: 'sess-db', messages: msgs },
      });
    });

    test('service throw → gọi next(err)', async () => {
      const err = new Error('DB fail');
      aiService.getSessionMessages = jest.fn().mockRejectedValue(err);
      const req = { params: { sessionId: 'sess-x' } };
      const res = makeRes();
      const next = jest.fn();
      await controller.getSessionMessages(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });
});

// ============================================================
// Chatbot HTTP endpoint tests — POST /api/chatbot/* + rate limiting
// (supertest, module-level mocks wired above)
// ============================================================

describe('Chatbot HTTP endpoints', () => {
  const express = require('express');
  const supertest = require('supertest');
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

  const app = express();
  app.use(express.json());
  app.use('/api/chatbot', aiModule.router);
  // Error handler cần thiết để AppError → JSON response
  app.use((err, _req, res, _next) => {
    res.status(err.statusCode || 500).json({ status: 'error', message: err.message });
  });
  const request = supertest(app);

  // ────────────────────────────────────────────────────────────
  // POST /api/chatbot/message
  // ────────────────────────────────────────────────────────────

  describe('POST /api/chatbot/message', () => {
    test('400 khi message rỗng', async () => {
      const res = await request.post('/api/chatbot/message').send({ message: '   ' });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });

    test('400 khi message vượt 500 ký tự', async () => {
      const res = await request.post('/api/chatbot/message').send({ message: 'a'.repeat(501) });
      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
      // i18n key 'ai.messageTooLong' (hoặc resolved translation nếu locale được set)
      expect(res.body.message).toMatch(/quá dài|500|messageTooLong/);
    });

    test('200 khi message đúng 500 ký tự', async () => {
      const res = await request.post('/api/chatbot/message').send({ message: 'a'.repeat(500) });
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

  // ────────────────────────────────────────────────────────────
  // POST /api/chatbot/cart/add
  // ────────────────────────────────────────────────────────────

  describe('POST /api/chatbot/cart/add', () => {
    beforeEach(() => {
      // Mặc định: giỏ hàng tồn tại, sản phẩm active và còn hàng
      Cart.findOrCreate.mockResolvedValue([{ id: 1 }, false]);
      // Bao gồm variants để resolvedVariantData không null khi resolve default variant
      Product.findByPk.mockResolvedValue({
        id: 1,
        status: 'active',
        stockQuantity: 10,
        variants: [{ id: 1, stockQuantity: 5 }],
      });
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
      expect(res.body.message).toMatch(/hết hàng|productOutOfStock/);
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
        expect.objectContaining({
          transaction: expect.objectContaining({ LOCK: { UPDATE: 'UPDATE' } }),
        }),
      );
    });

    test('tạo mới giỏ hàng khi user chưa có cart (findOrCreate atomic)', async () => {
      Cart.findOrCreate.mockResolvedValue([{ id: 5 }, true]); // created=true

      const res = await request
        .post('/api/chatbot/cart/add')
        .set('Authorization', 'Bearer test-token')
        .send({ productId: 1, quantity: 1 });

      expect(res.status).toBe(200);
      expect(Cart.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 1, status: 'active' } }),
      );
    });
  });

  // ────────────────────────────────────────────────────────────
  // chatbotLimiter — rate limiting (test riêng biệt với requireActual)
  // ────────────────────────────────────────────────────────────

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
});
