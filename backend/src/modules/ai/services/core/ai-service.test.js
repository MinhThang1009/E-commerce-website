const AIService = require('./ai-service');

describe('AIService', () => {
  let repo;
  let ruleBasedChatbot;
  let service;

  beforeEach(() => {
    repo = {
      findActiveDeals: jest.fn(),
      findFeaturedProducts: jest.fn(),
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
      const result = await service.handleMessage({ message: 'hello', userId: 1, sessionId: 'sess' });
      expect(service.chatbotService.handleMessage).toHaveBeenCalledWith('hello', 1, 'sess');
      expect(result.response).toBe('hi');
    });
  });

  describe('getRecommendations', () => {
    test('type=deals → findActiveDeals', async () => {
      repo.findActiveDeals.mockResolvedValue([]);
      await service.getRecommendations({ type: 'deals', limit: 10 });
      expect(repo.findActiveDeals).toHaveBeenCalledWith(10);
    });

    test('type=personal/default → findFeaturedProducts', async () => {
      repo.findFeaturedProducts.mockResolvedValue([]);
      await service.getRecommendations({ type: 'personal', limit: 5 });
      expect(repo.findFeaturedProducts).toHaveBeenCalledWith(5);
    });

    test('không truyền type → dùng default personal (branch line 25)', async () => {
      repo.findFeaturedProducts.mockResolvedValue([]);
      await service.getRecommendations({});
      expect(repo.findFeaturedProducts).toHaveBeenCalledWith(5);
    });
  });

  // ─── trackAnalytics (line 43) ─────────────────────────────────────────────

  describe('trackAnalytics', () => {
    test('delegate sang repo.createAnalyticsEvent với đúng tham số', async () => {
      const eventData = {
        event: 'product_view',
        userId: 1,
        sessionId: 'sess-abc',
        productId: 42,
        value: null,
        metadata: { source: 'chatbot' },
        timestamp: new Date(),
      };
      repo.createAnalyticsEvent.mockResolvedValue({ id: 99 });

      const result = await service.trackAnalytics(eventData);

      expect(repo.createAnalyticsEvent).toHaveBeenCalledWith(eventData);
      expect(result).toMatchObject({ id: 99 });
    });

    test('trả về kết quả từ repo', async () => {
      repo.createAnalyticsEvent.mockResolvedValue({ id: 7, event: 'click' });

      const result = await service.trackAnalytics({ event: 'click' });

      expect(result.id).toBe(7);
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
});
