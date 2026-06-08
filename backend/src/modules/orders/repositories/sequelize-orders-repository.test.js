const SequelizeOrdersRepository = require('./sequelize-orders-repository');

describe('SequelizeOrdersRepository', () => {
  let repo;
  let mockOrder;
  let mockProduct;
  let mockProductVariant;
  let mockCart;
  let mockCartItem;
  let mockDiscountCode;
  let mockInventoryLog;
  let mockSequelize;

  beforeEach(() => {
    mockOrder = { findAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() };
    mockProduct = { findByPk: jest.fn(), findOne: jest.fn() };
    mockProductVariant = { findByPk: jest.fn() };
    mockCart = { findOrCreate: jest.fn(), findOne: jest.fn(), findByPk: jest.fn() };
    mockCartItem = { findOne: jest.fn(), destroy: jest.fn() };
    mockDiscountCode = { findOne: jest.fn() };
    mockInventoryLog = { bulkCreate: jest.fn() };
    mockSequelize = {};

    repo = new SequelizeOrdersRepository({
      Order: mockOrder,
      OrderItem: { create: jest.fn() },
      Product: mockProduct,
      ProductVariant: mockProductVariant,
      Cart: mockCart,
      CartItem: mockCartItem,
      User: { findByPk: jest.fn() },
      DiscountCode: mockDiscountCode,
      InventoryLog: mockInventoryLog,
      sequelize: mockSequelize,
    });
  });

  describe('cancelPendingOrdersByUser', () => {
    test('đơn COD có discount → gọi decrementDiscountCodeUsage', async () => {
      const discount = { id: 10, code: 'TEST10' };
      const pendingOrder = {
        id: 1,
        status: 'pending',
        paymentMethod: 'cod',
        appliedDiscount: discount,
        items: [],
        save: jest.fn().mockResolvedValue(),
      };
      mockOrder.findAll.mockResolvedValue([pendingOrder]);
      const tx = { LOCK: { UPDATE: 'FOR UPDATE' } };

      const spy = jest.spyOn(repo, 'decrementDiscountCodeUsage').mockResolvedValue();
      const count = await repo.cancelPendingOrdersByUser(1, { transaction: tx });

      expect(count).toBe(1);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe(discount);
      expect(pendingOrder.status).toBe('cancelled');
      expect(pendingOrder.save).toHaveBeenCalledWith({ transaction: tx });
    });

    test('đơn MoMo có discount → KHÔNG gọi decrementDiscountCodeUsage', async () => {
      const discount = { id: 10, code: 'TEST10' };
      const pendingOrder = {
        id: 2,
        status: 'pending',
        paymentMethod: 'momo',
        appliedDiscount: discount,
        items: [],
        save: jest.fn().mockResolvedValue(),
      };
      mockOrder.findAll.mockResolvedValue([pendingOrder]);
      const tx = { LOCK: { UPDATE: 'FOR UPDATE' } };

      const spy = jest.spyOn(repo, 'decrementDiscountCodeUsage').mockResolvedValue();
      await repo.cancelPendingOrdersByUser(1, { transaction: tx });

      expect(spy).not.toHaveBeenCalled();
    });

    test('đơn COD không có discount → KHÔNG gọi decrementDiscountCodeUsage', async () => {
      const pendingOrder = {
        id: 3,
        status: 'pending',
        paymentMethod: 'cod',
        appliedDiscount: null,
        items: [],
        save: jest.fn().mockResolvedValue(),
      };
      mockOrder.findAll.mockResolvedValue([pendingOrder]);
      const tx = { LOCK: { UPDATE: 'FOR UPDATE' } };

      const spy = jest.spyOn(repo, 'decrementDiscountCodeUsage').mockResolvedValue();
      await repo.cancelPendingOrdersByUser(1, { transaction: tx });

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('decrementDiscountCodeUsage', () => {
    test('gọi code.decrement đúng tham số', async () => {
      const code = { decrement: jest.fn().mockResolvedValue() };
      await repo.decrementDiscountCodeUsage(code, { transaction: 'tx' });
      expect(code.decrement).toHaveBeenCalledWith('usedCount', { transaction: 'tx' });
    });
  });

  describe('incrementDiscountCodeUsage', () => {
    test('gọi code.increment đúng tham số', async () => {
      const code = { increment: jest.fn().mockResolvedValue() };
      await repo.incrementDiscountCodeUsage(code, { transaction: 'tx' });
      expect(code.increment).toHaveBeenCalledWith('usedCount', { transaction: 'tx' });
    });
  });
});
