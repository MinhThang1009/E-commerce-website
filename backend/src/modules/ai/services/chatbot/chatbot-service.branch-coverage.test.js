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

describe('ChatbotService — branch coverage', () => {
  test('clearSession: DB destroy fails → catches', async () => {
    const svc = require('./chatbot-service');
    svc.conversationHistory.set('test-sess', { messages: [], lastAccess: Date.now() });
    svc.ChatMessage = { destroy: jest.fn().mockRejectedValue(new Error('DB down')) };
    const result = await svc.clearSession('test-sess');
    expect(result).toBe(true);
  });

  test('getSessionMessages: userId truthy → where.userId set', async () => {
    const svc = require('./chatbot-service');
    const mockFindAll = jest.fn().mockResolvedValue([]);
    svc.ChatMessage = { findAll: mockFindAll, destroy: jest.fn() };
    await svc.getSessionMessages('sess-1', 50, 42);
    expect(mockFindAll.mock.calls[0][0].where.userId).toBe(42);
  });

  test('getSessionMessages: userId falsy → where.userId NOT set', async () => {
    const svc = require('./chatbot-service');
    const mockFindAll = jest.fn().mockResolvedValue([]);
    svc.ChatMessage = { findAll: mockFindAll, destroy: jest.fn() };
    await svc.getSessionMessages('sess-2', 50, null);
    expect(mockFindAll.mock.calls[0][0].where.userId).toBeUndefined();
  });
});
