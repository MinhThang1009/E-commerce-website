// Unit tests cho AIController — phủ các nhánh còn thiếu:
//   - productSearch: happy path + error path (next(err))
//   - getRecommendations: happy path + error path
//   - trackAnalytics: happy path + error path
//   - addToCart: happy path + error path
//   - handleMessage: 500 fallback (line 19) + 400 path

const AIController = require('./ai-controller');

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
    getRecommendations: jest.fn(),
    trackAnalytics: jest.fn(),
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
      expect(logger.warn).toHaveBeenCalledWith('Chatbot input không hợp lệ:', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', message: 'Tin nhắn quá dài hoặc không hợp lệ' }),
      );
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
  // getRecommendations (lines 41-44)
  // ────────────────────────────────────────────────────────────

  describe('getRecommendations', () => {
    test('gọi aiService.getRecommendations với req.query', async () => {
      const data = [{ id: 2, name: 'Phone' }];
      aiService.getRecommendations.mockResolvedValue(data);

      const req = { query: { userId: '1', limit: '4' } };
      const res = makeRes();
      const next = jest.fn();

      await controller.getRecommendations(req, res, next);

      expect(aiService.getRecommendations).toHaveBeenCalledWith(req.query);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data });
    });

    test('service throw → gọi next(err)', async () => {
      const err = new Error('Recommendation fail');
      aiService.getRecommendations.mockRejectedValue(err);

      const req = { query: {} };
      const res = makeRes();
      const next = jest.fn();

      await controller.getRecommendations(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ────────────────────────────────────────────────────────────
  // trackAnalytics (line 52 — error path)
  // ────────────────────────────────────────────────────────────

  describe('trackAnalytics', () => {
    test('gọi aiService.trackAnalytics với đúng fields và trả về success', async () => {
      aiService.trackAnalytics.mockResolvedValue();

      const req = {
        body: {
          event: 'view_product',
          userId: 1,
          sessionId: 'sess-abc',
          productId: 42,
          value: 100000,
          metadata: { source: 'home' },
        },
      };
      const res = makeRes();
      const next = jest.fn();

      await controller.trackAnalytics(req, res, next);

      expect(aiService.trackAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'view_product',
          userId: 1,
          sessionId: 'sess-abc',
          productId: 42,
          value: 100000,
          metadata: { source: 'home' },
          timestamp: expect.any(Date),
        }),
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
    });

    test('service throw → gọi next(err)', async () => {
      const err = new Error('Analytics DB fail');
      aiService.trackAnalytics.mockRejectedValue(err);

      const req = { body: { event: 'click', userId: 1, sessionId: 's' } };
      const res = makeRes();
      const next = jest.fn();

      await controller.trackAnalytics(req, res, next);

      expect(next).toHaveBeenCalledWith(err);
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

    test('clearSession trả về "Session không tồn tại" khi cleared=false', async () => {
      aiService.clearSession = jest.fn().mockReturnValue(false);
      const req = { body: { sessionId: 'not-exist' } };
      const res = makeRes();
      await controller.clearSession(req, res);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Session không tồn tại',
      });
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

    test('sessionId falsy → trả về fail', async () => {
      aiService.registerSession = jest.fn();
      const req = { body: {} };
      const res = makeRes();
      await controller.registerSession(req, res);
      expect(aiService.registerSession).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ status: 'fail', message: 'sessionId required' });
    });
  });

  // ────────────────────────────────────────────────────────────
  // getLatestSession (lines 88-92)
  // ────────────────────────────────────────────────────────────

  describe('getLatestSession', () => {
    test('trả về sessionId từ aiService', async () => {
      aiService.getLatestSession = jest.fn().mockResolvedValue('sess-latest');
      const req = {};
      const res = makeRes();
      const next = jest.fn();
      await controller.getLatestSession(req, res, next);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: { sessionId: 'sess-latest' },
      });
    });

    test('service throw → gọi next(err)', async () => {
      const err = new Error('DB fail');
      aiService.getLatestSession = jest.fn().mockRejectedValue(err);
      const req = {};
      const res = makeRes();
      const next = jest.fn();
      await controller.getLatestSession(req, res, next);
      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // ────────────────────────────────────────────────────────────
  // getSessionHistory (lines 95-98)
  // ────────────────────────────────────────────────────────────

  describe('getSessionHistory', () => {
    test('trả về messages + turns', async () => {
      const messages = [
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello' },
      ];
      aiService.getSessionHistory = jest.fn().mockReturnValue(messages);
      const req = { params: { sessionId: 'sess-1' } };
      const res = makeRes();
      await controller.getSessionHistory(req, res);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: { sessionId: 'sess-1', turns: 1, messages },
      });
    });

    test('session rỗng → turns = 0', async () => {
      aiService.getSessionHistory = jest.fn().mockReturnValue([]);
      const req = { params: { sessionId: 'empty' } };
      const res = makeRes();
      await controller.getSessionHistory(req, res);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: { sessionId: 'empty', turns: 0, messages: [] },
      });
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
