jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_r, _s, n) => n(),
  apiLimiter: (_r, _s, n) => n(),
  authLimiter: (_r, _s, n) => n(),
  otpLimiter: (_r, _s, n) => n(),
}));
const logger = require('@utils/logger');
const AIController = require('./ai-controller');

describe('AIController — branch coverage', () => {
  test('addToCart error → next(err)', async () => {
    const ctrl = new AIController({
      aiService: { addToCart: jest.fn().mockRejectedValue(new Error('x')) },
      logger,
    });
    const next = jest.fn();
    await ctrl.addToCart({ body: { productId: 1 }, user: { id: 1 } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('clearSession error → next(err)', async () => {
    const ctrl = new AIController({
      aiService: { clearSession: jest.fn().mockRejectedValue(new Error('fail')) },
      logger,
    });
    const next = jest.fn();
    await ctrl.clearSession({ body: { sessionId: 's1' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('registerSession error → next(err)', async () => {
    const ctrl = new AIController({
      aiService: {
        registerSession: jest.fn().mockImplementation(() => {
          throw new Error('fail');
        }),
      },
      logger,
    });
    const next = jest.fn();
    await ctrl.registerSession({ body: { sessionId: 's1' } }, {}, next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });

  test('handleMessage: statusCode >= 500 → logger.error', async () => {
    const err500 = new Error('internal');
    err500.statusCode = 500;
    const ctrl = new AIController({
      aiService: { handleMessage: jest.fn().mockRejectedValue(err500) },
      logger,
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await ctrl.handleMessage(
      { body: { message: 'hi', sessionId: 's1' }, user: null, locale: 'vi' },
      res,
      jest.fn(),
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Chatbot error:',
      expect.objectContaining({ statusCode: 500 }),
    );
  });

  test('handleMessage: statusCode < 500 → logger.warn', async () => {
    const err400 = new Error('bad');
    err400.statusCode = 400;
    const ctrl = new AIController({
      aiService: { handleMessage: jest.fn().mockRejectedValue(err400) },
      logger,
    });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    await ctrl.handleMessage(
      { body: { message: 'hi', sessionId: 's1' }, user: null, locale: 'vi' },
      res,
      jest.fn(),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'Chatbot error:',
      expect.objectContaining({ statusCode: 400 }),
    );
  });
});
