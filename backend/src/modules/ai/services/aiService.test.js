const AIService = require('../services/aiService');
const ChatbotLLMGateway = require('../services/chatbotLLMGateway');

describe('AIService', () => {
  let repo;
  let ragPipeline;
  let ruleBasedChatbot;
  let service;

  beforeEach(() => {
    repo = {
      searchProducts: jest.fn(),
      findActiveDeals: jest.fn(),
      findFeaturedProducts: jest.fn(),
      createAnalyticsEvent: jest.fn().mockResolvedValue({ id: 1 }),
      findProductForCart: jest.fn(),
      addToCart: jest.fn(),
    };
    ragPipeline = { run: jest.fn() };
    ruleBasedChatbot = { extractSearchParams: jest.fn() };
    service = new AIService({
      aiRepository: repo,
      ragPipeline,
      ruleBasedChatbot,
      logger: { info: jest.fn(), error: jest.fn() },
    });
  });

  describe('handleMessage', () => {
    test('delegate sang ragPipeline.run', async () => {
      ragPipeline.run.mockResolvedValue({ response: 'hi' });
      const result = await service.handleMessage({ message: 'hello' });
      expect(ragPipeline.run).toHaveBeenCalledWith({ message: 'hello' });
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

// ─── ChatbotLLMGateway.getAIResponse — line 15 ────────────────────────────────
// Covers line 15: delegate getAIResponse sang chatbotService.getAIResponse

describe('ChatbotLLMGateway', () => {
  test('getAIResponse delegate sang chatbotService.getAIResponse — covers line 15', async () => {
    const mockGeminiService = {
      handleMessage: jest.fn().mockResolvedValue({ response: 'hi' }),
      getAIResponse: jest.fn().mockResolvedValue({ response: 'AI response', products: [] }),
    };

    const gateway = new ChatbotLLMGateway({ chatbotService: mockGeminiService });

    const result = await gateway.getAIResponse('tìm iphone', [{ id: 1 }], { timeOfDay: 'morning' });

    expect(mockGeminiService.getAIResponse).toHaveBeenCalledWith(
      'tìm iphone',
      [{ id: 1 }],
      { timeOfDay: 'morning' },
      undefined,
    );
    expect(result).toMatchObject({ response: 'AI response' });
  });

  test('handleMessage delegate sang chatbotService.handleMessage', async () => {
    const mockGeminiService = {
      handleMessage: jest.fn().mockResolvedValue({ response: 'pong' }),
      getAIResponse: jest.fn(),
    };

    const gateway = new ChatbotLLMGateway({ chatbotService: mockGeminiService });

    const result = await gateway.handleMessage('ping', 1, 'sess', {});

    expect(mockGeminiService.handleMessage).toHaveBeenCalledWith('ping', 1, 'sess', {});
    expect(result).toMatchObject({ response: 'pong' });
  });
});
