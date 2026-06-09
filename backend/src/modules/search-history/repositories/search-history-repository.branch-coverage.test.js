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

describe('SearchHistoryRepository — branch coverage', () => {
  test('findDuplicate: sessionId truthy, userId falsy → where.sessionId', async () => {
    const { SearchHistory } = require('@models');
    const orig = SearchHistory.findOne;
    SearchHistory.findOne = jest.fn().mockResolvedValue(null);
    const mod = require('./sequelize-search-history-repository');
    await mod.findDuplicate({ keyword: 'test', sessionId: 'sess-1', since: new Date() });
    expect(SearchHistory.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ sessionId: 'sess-1' }) }),
    );
    SearchHistory.findOne = orig;
  });

  test('findDuplicate: userId=null, sessionId=null → where has neither', async () => {
    const { SearchHistory } = require('@models');
    const orig = SearchHistory.findOne;
    SearchHistory.findOne = jest.fn().mockResolvedValue(null);
    const mod = require('./sequelize-search-history-repository');
    await mod.findDuplicate({ keyword: 'test', userId: null, sessionId: null, since: new Date() });
    const where = SearchHistory.findOne.mock.calls[0][0].where;
    expect(where.userId).toBeUndefined();
    expect(where.sessionId).toBeUndefined();
    SearchHistory.findOne = orig;
  });
});
