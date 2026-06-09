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

describe('DiscountCodeService — branch coverage', () => {
  test('getAll: NaN limit → fallback 10', async () => {
    const discountRepo = require('../repositories/sequelize-discount-code-repository');
    const orig = discountRepo.findAll;
    discountRepo.findAll = jest.fn().mockResolvedValue({ count: 0, rows: [] });
    const svc = require('./discount-code-service');
    await svc.getAllDiscountCodes({ page: 'x', limit: 'y' });
    expect(discountRepo.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    discountRepo.findAll = orig;
  });
});
