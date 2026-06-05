const AIService = require('./ai-service');

describe('AIService', () => {
  let repo;
  let ruleBasedChatbot;
  let service;

  beforeEach(() => {
    repo = {
      createAnalyticsEvent: jest.fn().mockResolvedValue({ id: 1 }),
      findProductForCart: jest.fn(),
      addToCart: jest.fn(),
    };
    ruleBasedChatbot = { extractSearchParams: jest.fn() };
    service = new AIService({
      aiRepository: repo,
      chatbotService: { handleMessage: jest.fn() },
      ruleBasedChatbot,
      logger: { info: jest.fn(), error: jest.fn() },
    });
  });

  describe('handleMessage', () => {
    test('delegate sang chatbotService.handleMessage', async () => {
      service.chatbotService.handleMessage.mockResolvedValue({ response: 'hi' });
      const result = await service.handleMessage({
        message: 'hello',
        userId: 1,
        sessionId: 'sess',
      });
      expect(service.chatbotService.handleMessage).toHaveBeenCalledWith('hello', 1, 'sess');
      expect(result.response).toBe('hi');
    });
  });

  // ─── addToCart (lines 46-55) ──────────────────────────────────────────────

  describe('addToCart', () => {
    test('sản phẩm không tồn tại → AppError 404', async () => {
      repo.findProductForCart.mockResolvedValue(null);

      await expect(
        service.addToCart({
          productId: 999,
          variantId: null,
          quantity: 1,
          sessionId: 'sess',
          userId: 1,
        }),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: expect.stringContaining('không tồn tại'),
      });
    });

    test('sản phẩm hết hàng (status inactive) → AppError 400', async () => {
      repo.findProductForCart.mockResolvedValue({
        id: 1,
        status: 'inactive',
        stockQuantity: 0,
        variants: [],
      });

      await expect(
        service.addToCart({
          productId: 1,
          variantId: null,
          quantity: 1,
          sessionId: 'sess',
          userId: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hết hàng') });
    });

    test('sản phẩm active + còn hàng → addToCart + createAnalyticsEvent', async () => {
      repo.findProductForCart.mockResolvedValue({
        id: 5,
        status: 'active',
        stockQuantity: 10,
        variants: [{ stockQuantity: 5 }],
      });
      repo.addToCart.mockResolvedValue({ id: 20, productId: 5, quantity: 2 });

      const result = await service.addToCart({
        productId: 5,
        variantId: null,
        quantity: 2,
        sessionId: 'sess-xyz',
        userId: 3,
      });

      expect(repo.addToCart).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 3, productId: 5, quantity: 2 }),
      );
      expect(repo.createAnalyticsEvent).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'product_added_to_cart', productId: 5 }),
      );
      expect(result).toMatchObject({ id: 20 });
    });

    test('variantId cụ thể hết hàng dù total stock > 0 → AppError 400', async () => {
      repo.findProductForCart.mockResolvedValue({
        id: 4,
        status: 'active',
        stockQuantity: 10,
        variants: [
          { id: 10, stockQuantity: 0 }, // Xanh hết
          { id: 11, stockQuantity: 5 }, // Đỏ còn
        ],
      });

      await expect(
        service.addToCart({
          productId: 4,
          variantId: 10, // Xanh hết hàng
          quantity: 1,
          sessionId: 'sess',
          userId: 1,
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('hết hàng') });
    });

    test('sản phẩm active nhưng stock = 0 ở cả product và variants → AppError 400', async () => {
      repo.findProductForCart.mockResolvedValue({
        id: 3,
        status: 'active',
        stockQuantity: 0,
        variants: [{ stockQuantity: 0 }],
      });

      await expect(
        service.addToCart({
          productId: 3,
          variantId: null,
          quantity: 1,
          sessionId: 's',
          userId: 2,
        }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });
  });

  describe('session delegators', () => {
    beforeEach(() => {
      service.chatbotService = {
        handleMessage: jest.fn(),
        clearSession: jest.fn().mockReturnValue(true),
        getSessionMessages: jest.fn().mockResolvedValue([]),
        registerSession: jest.fn().mockReturnValue('sess-1'),
      };
    });

    test('clearSession delegate sang chatbotService', () => {
      const result = service.clearSession('sess-1');
      expect(service.chatbotService.clearSession).toHaveBeenCalledWith('sess-1');
      expect(result).toBe(true);
    });

    test('getSessionMessages delegate sang chatbotService', async () => {
      const result = await service.getSessionMessages('sess-1');
      expect(service.chatbotService.getSessionMessages).toHaveBeenCalledWith('sess-1');
      expect(result).toEqual([]);
    });

    test('registerSession delegate sang chatbotService', () => {
      const result = service.registerSession('sess-1');
      expect(service.chatbotService.registerSession).toHaveBeenCalledWith('sess-1');
      expect(result).toBe('sess-1');
    });
  });
});
