const AiService = require('../modules/ai/services/aiService');

describe('AiService', () => {
  let repo;
  let ragPipeline;
  let ruleBasedChatbot;
  let service;

  beforeEach(() => {
    repo = {
      searchProducts: jest.fn(),
      findActiveDeals: jest.fn(),
      findFeaturedProducts: jest.fn(),
    };
    ragPipeline = { run: jest.fn() };
    ruleBasedChatbot = { extractSearchParams: jest.fn() };
    service = new AiService({
      aiRepository: repo, ragPipeline, ruleBasedChatbot,
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

  describe('productSearch', () => {
    test('query rỗng → 400', async () => {
      await expect(service.productSearch({ query: '' })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('query có giá trị → extract params + search', async () => {
      ruleBasedChatbot.extractSearchParams.mockReturnValue({ keyword: 'shoe', maxPrice: 1000000 });
      repo.searchProducts.mockResolvedValue([{ id: 1 }]);

      const result = await service.productSearch({ query: 'giày dưới 1tr', limit: 5 });

      expect(ruleBasedChatbot.extractSearchParams).toHaveBeenCalledWith('giày dưới 1tr');
      expect(repo.searchProducts).toHaveBeenCalledWith(expect.objectContaining({
        keyword: 'shoe', maxPrice: 1000000, limit: 5,
      }));
      expect(result).toEqual([{ id: 1 }]);
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
});
