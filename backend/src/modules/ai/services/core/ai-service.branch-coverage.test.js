describe('AIService — branch coverage', () => {
  beforeAll(() => jest.resetModules());

  test('addToCart: analytics event fails → warn logged, no throw', async () => {
    jest.mock('@utils/logger', () => ({
      info: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    }));
    const logger = require('@utils/logger');
    const AIService = require('./ai-service');
    const repo = {
      addToCart: jest.fn().mockResolvedValue({ id: 1, quantity: 1 }),
      createAnalyticsEvent: jest.fn().mockRejectedValue(new Error('analytics fail')),
    };
    const svc = new AIService({ aiRepository: repo, logger });
    await svc.addToCart({ userId: 1, productId: 1, sessionId: 's1', quantity: 1 });
    await new Promise((r) => setTimeout(r, 50));
    expect(logger.warn).toHaveBeenCalledWith(
      '[Analytics] addToCart event thất bại:',
      'analytics fail',
    );
  });
});
