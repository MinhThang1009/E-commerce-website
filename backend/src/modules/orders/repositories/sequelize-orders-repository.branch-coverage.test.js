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
const SequelizeOrdersRepo = require('./sequelize-orders-repository');

describe('SequelizeOrdersRepository — branch coverage', () => {
  let repo;
  beforeEach(() => {
    repo = new SequelizeOrdersRepo({
      Order: { findAll: jest.fn() },
      OrderItem: { create: jest.fn() },
      Product: {},
      ProductVariant: { findByPk: jest.fn(), findOne: jest.fn() },
      Cart: { findOrCreate: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() },
      CartItem: { findOne: jest.fn() },
      User: { findByPk: jest.fn() },
      DiscountCode: { findOne: jest.fn() },
      InventoryLog: { bulkCreate: jest.fn() },
      sequelize: {},
    });
  });

  test('variant soft-deleted → skip restore', async () => {
    repo.Order.findAll.mockResolvedValue([
      {
        id: 1,
        status: 'pending',
        paymentMethod: 'momo',
        appliedDiscount: null,
        items: [{ variantId: 5, quantity: 2, ProductVariant: null }],
        save: jest.fn(),
      },
    ]);
    jest.spyOn(repo, 'restoreVariantStock').mockResolvedValue();
    await repo.cancelPendingOrdersByUser(1, {});
    expect(repo.restoreVariantStock).not.toHaveBeenCalled();
  });

  test('decrementDiscountCodeUsage no options → empty obj', async () => {
    const code = { decrement: jest.fn().mockResolvedValue() };
    await repo.decrementDiscountCodeUsage(code);
    expect(code.decrement).toHaveBeenCalledWith('usedCount', {});
  });
});
