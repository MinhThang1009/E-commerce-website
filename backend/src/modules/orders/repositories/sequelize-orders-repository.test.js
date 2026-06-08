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
    mockProductVariant = { findByPk: jest.fn(), findOne: jest.fn() };
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
    test('đơn COD có discount → gọi code.decrement (không spy, chạy thật qua dòng 223+372)', async () => {
      const discount = { id: 10, code: 'TEST10', decrement: jest.fn().mockResolvedValue() };
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

      const count = await repo.cancelPendingOrdersByUser(1, { transaction: tx });

      expect(count).toBe(1);
      expect(discount.decrement).toHaveBeenCalledWith('usedCount', { transaction: tx });
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

    test('đơn có items variant tồn tại → gọi restoreVariantStock', async () => {
      const variant = { id: 5, stockQuantity: 10 };
      const pendingOrder = {
        id: 5,
        status: 'pending',
        paymentMethod: 'momo',
        appliedDiscount: null,
        items: [{ variantId: 5, quantity: 2, ProductVariant: variant, Product: null }],
        save: jest.fn().mockResolvedValue(),
      };
      mockOrder.findAll.mockResolvedValue([pendingOrder]);

      const spy = jest.spyOn(repo, 'restoreVariantStock').mockResolvedValue();
      await repo.cancelPendingOrdersByUser(1, {});

      expect(spy).toHaveBeenCalledWith(variant, 2, expect.any(Object));
    });

    test('đơn có items product-only → gọi restoreProductStock', async () => {
      const product = { id: 10 };
      const pendingOrder = {
        id: 6,
        status: 'pending',
        paymentMethod: 'cod',
        appliedDiscount: null,
        items: [{ variantId: null, quantity: 3, ProductVariant: null, Product: product }],
        save: jest.fn().mockResolvedValue(),
      };
      mockOrder.findAll.mockResolvedValue([pendingOrder]);

      const spy = jest.spyOn(repo, 'restoreProductStock').mockResolvedValue();
      await repo.cancelPendingOrdersByUser(1, {});

      expect(spy).toHaveBeenCalledWith(product, 3, expect.any(Object));
    });
  });

  describe('findVariantBasic', () => {
    test('productId undefined → where chỉ có id', async () => {
      mockProductVariant.findOne.mockResolvedValue({ id: 5 });
      await repo.findVariantBasic(5, undefined);
      expect(mockProductVariant.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5 } }),
      );
    });

    test('productId có giá trị → where có cả id và productId', async () => {
      mockProductVariant.findOne.mockResolvedValue({ id: 5 });
      await repo.findVariantBasic(5, 10);
      expect(mockProductVariant.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 5, productId: 10 } }),
      );
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
