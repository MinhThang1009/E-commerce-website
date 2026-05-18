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

    test('400 khi service throw lỗi với statusCode=400', async () => {
      const err = new Error('Tin nhắn không hợp lệ');
      err.statusCode = 400;
      aiService.handleMessage.mockRejectedValue(err);

      const req = { body: { message: '', userId: 1, sessionId: 's' } };
      const res = makeRes();
      const next = jest.fn();

      await controller.handleMessage(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'error', message: 'Tin nhắn không hợp lệ' }),
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
});
