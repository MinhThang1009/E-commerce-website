// Tests cho SequelizePaymentRepository (0% covered).
// Mock toàn bộ Sequelize models — chỉ test hành vi query của repository.
const SequelizePaymentRepository = require('./SequelizePaymentRepository');

// ---------- Model mock factories ----------

function makeOrderModel() {
  return {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
}

function makeOrderItemModel() {
  return {};
}

function makeUserModel() {
  return { findByPk: jest.fn() };
}

function makeCartModel() {
  return { findAll: jest.fn() };
}

function makeCartItemModel() {
  return { destroy: jest.fn() };
}

function makeDiscountCodeModel() {
  return { findByPk: jest.fn() };
}

function makeRepo(overrides = {}) {
  return new SequelizePaymentRepository({
    Order: overrides.Order || makeOrderModel(),
    OrderItem: overrides.OrderItem || makeOrderItemModel(),
    User: overrides.User || makeUserModel(),
    Cart: overrides.Cart || makeCartModel(),
    CartItem: overrides.CartItem || makeCartItemModel(),
    DiscountCode: overrides.DiscountCode || makeDiscountCodeModel(),
    sequelize: overrides.sequelize || { transaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })) },
  });
}

describe('SequelizePaymentRepository', () => {
  // ============================================================
  // Order
  // ============================================================

  describe('findOrderByPk', () => {
    test('gọi Order.findByPk với id', async () => {
      const Order = makeOrderModel();
      Order.findByPk.mockResolvedValue({ id: 1 });
      const repo = makeRepo({ Order });

      const result = await repo.findOrderByPk(1);

      expect(Order.findByPk).toHaveBeenCalledWith(1, {});
      expect(result.id).toBe(1);
    });

    test('truyền options vào findByPk', async () => {
      const Order = makeOrderModel();
      Order.findByPk.mockResolvedValue({ id: 2 });
      const repo = makeRepo({ Order });

      await repo.findOrderByPk(2, { include: ['items'] });

      expect(Order.findByPk).toHaveBeenCalledWith(2, { include: ['items'] });
    });

    test('trả về null khi không tìm thấy', async () => {
      const Order = makeOrderModel();
      Order.findByPk.mockResolvedValue(null);
      const repo = makeRepo({ Order });

      expect(await repo.findOrderByPk(99)).toBeNull();
    });
  });

  describe('findOrderByNumber', () => {
    test('gọi Order.findOne với where number', async () => {
      const Order = makeOrderModel();
      Order.findOne.mockResolvedValue({ id: 1, number: 'ORD-001' });
      const repo = makeRepo({ Order });

      const result = await repo.findOrderByNumber('ORD-001');

      expect(Order.findOne).toHaveBeenCalledWith({ where: { number: 'ORD-001' } });
      expect(result.number).toBe('ORD-001');
    });

    test('trả về null khi order number không tồn tại', async () => {
      const Order = makeOrderModel();
      Order.findOne.mockResolvedValue(null);
      const repo = makeRepo({ Order });

      expect(await repo.findOrderByNumber('MISSING')).toBeNull();
    });
  });

  describe('findOrderByPkWithItemsAndUser', () => {
    test('gọi Order.findByPk với include OrderItem và User', async () => {
      const Order = makeOrderModel();
      const OrderItem = makeOrderItemModel();
      const User = makeUserModel();
      Order.findByPk.mockResolvedValue({ id: 5 });
      const repo = makeRepo({ Order, OrderItem, User });

      await repo.findOrderByPkWithItemsAndUser(5);

      expect(Order.findByPk).toHaveBeenCalledWith(5, expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: OrderItem, as: 'items' }),
          expect.objectContaining({ model: User }),
        ]),
      }));
    });
  });

  describe('lockOrder', () => {
    test('gọi Order.findByPk với lock UPDATE và transaction', async () => {
      const Order = makeOrderModel();
      Order.findByPk.mockResolvedValue({ id: 1 });
      const repo = makeRepo({ Order });
      const transaction = { LOCK: { UPDATE: 'UPDATE' } };

      await repo.lockOrder(1, transaction);

      expect(Order.findByPk).toHaveBeenCalledWith(1, {
        lock: 'UPDATE',
        transaction,
      });
    });
  });

  describe('updateOrderPayment', () => {
    test('gọi Order.update với patch và where orderId', async () => {
      const Order = makeOrderModel();
      Order.update.mockResolvedValue([1]);
      const repo = makeRepo({ Order });

      await repo.updateOrderPayment(10, { status: 'paid' });

      expect(Order.update).toHaveBeenCalledWith(
        { status: 'paid' },
        { where: { id: 10 } }
      );
    });

    test('truyền options (transaction) vào update', async () => {
      const Order = makeOrderModel();
      Order.update.mockResolvedValue([1]);
      const repo = makeRepo({ Order });
      const transaction = {};

      await repo.updateOrderPayment(11, { status: 'failed' }, { transaction });

      expect(Order.update).toHaveBeenCalledWith(
        { status: 'failed' },
        { where: { id: 11 }, transaction }
      );
    });
  });

  describe('saveOrder', () => {
    test('gọi order.save() và trả về kết quả', async () => {
      const repo = makeRepo();
      const order = { id: 1, save: jest.fn().mockResolvedValue({ id: 1, status: 'paid' }) };

      const result = await repo.saveOrder(order);

      expect(order.save).toHaveBeenCalled();
      expect(result.status).toBe('paid');
    });

    test('truyền options vào save', async () => {
      const repo = makeRepo();
      const transaction = {};
      const order = { save: jest.fn().mockResolvedValue() };

      await repo.saveOrder(order, { transaction });

      expect(order.save).toHaveBeenCalledWith({ transaction });
    });
  });

  // ============================================================
  // User
  // ============================================================

  describe('findUserById', () => {
    test('gọi User.findByPk với id', async () => {
      const User = makeUserModel();
      User.findByPk.mockResolvedValue({ id: 7, email: 'u@x.com' });
      const repo = makeRepo({ User });

      const result = await repo.findUserById(7);

      expect(User.findByPk).toHaveBeenCalledWith(7, {});
      expect(result.email).toBe('u@x.com');
    });
  });

  describe('saveUser', () => {
    test('gọi user.save()', async () => {
      const repo = makeRepo();
      const user = { id: 1, save: jest.fn().mockResolvedValue() };
      await repo.saveUser(user);
      expect(user.save).toHaveBeenCalled();
    });
  });

  // ============================================================
  // DiscountCode
  // ============================================================

  describe('findOrderDiscountCode', () => {
    test('trả về null khi order không tồn tại', async () => {
      const Order = makeOrderModel();
      Order.findByPk.mockResolvedValue(null);
      const repo = makeRepo({ Order });

      const result = await repo.findOrderDiscountCode(99);

      expect(result).toBeNull();
    });

    test('trả về null khi order không có discountCodeId', async () => {
      const Order = makeOrderModel();
      Order.findByPk.mockResolvedValue({ id: 1, discountCodeId: null });
      const repo = makeRepo({ Order });

      const result = await repo.findOrderDiscountCode(1);

      expect(result).toBeNull();
    });

    test('tìm và trả về DiscountCode khi order có discountCodeId', async () => {
      const Order = makeOrderModel();
      const DiscountCode = makeDiscountCodeModel();
      Order.findByPk.mockResolvedValue({ id: 1, discountCodeId: 5 });
      DiscountCode.findByPk.mockResolvedValue({ id: 5, code: 'SAVE10' });
      const repo = makeRepo({ Order, DiscountCode });

      const result = await repo.findOrderDiscountCode(1);

      expect(DiscountCode.findByPk).toHaveBeenCalledWith(5, {});
      expect(result.code).toBe('SAVE10');
    });
  });

  describe('incrementDiscountCodeUsedCount', () => {
    test('trả về null khi DiscountCode không tồn tại', async () => {
      const DiscountCode = makeDiscountCodeModel();
      DiscountCode.findByPk.mockResolvedValue(null);
      const repo = makeRepo({ DiscountCode });

      const result = await repo.incrementDiscountCodeUsedCount(999);

      expect(result).toBeNull();
    });

    test('gọi code.increment("usedCount") khi tìm thấy code', async () => {
      const DiscountCode = makeDiscountCodeModel();
      const code = { id: 3, usedCount: 5, increment: jest.fn().mockResolvedValue({ usedCount: 6 }) };
      DiscountCode.findByPk.mockResolvedValue(code);
      const repo = makeRepo({ DiscountCode });

      await repo.incrementDiscountCodeUsedCount(3);

      expect(code.increment).toHaveBeenCalledWith('usedCount', {});
    });

    test('truyền options (transaction) vào increment', async () => {
      const DiscountCode = makeDiscountCodeModel();
      const transaction = {};
      const code = { increment: jest.fn().mockResolvedValue() };
      DiscountCode.findByPk.mockResolvedValue(code);
      const repo = makeRepo({ DiscountCode });

      await repo.incrementDiscountCodeUsedCount(3, { transaction });

      expect(DiscountCode.findByPk).toHaveBeenCalledWith(3, { transaction });
      expect(code.increment).toHaveBeenCalledWith('usedCount', { transaction });
    });
  });

  // ============================================================
  // Cart
  // ============================================================

  describe('findActiveCartsByUser', () => {
    test('gọi Cart.findAll với userId và status=active', async () => {
      const Cart = makeCartModel();
      Cart.findAll.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const repo = makeRepo({ Cart });

      const result = await repo.findActiveCartsByUser(7);

      expect(Cart.findAll).toHaveBeenCalledWith({
        where: { userId: 7, status: 'active' },
      });
      expect(result).toHaveLength(2);
    });

    test('trả về mảng rỗng khi không có active cart', async () => {
      const Cart = makeCartModel();
      Cart.findAll.mockResolvedValue([]);
      const repo = makeRepo({ Cart });

      const result = await repo.findActiveCartsByUser(99);

      expect(result).toEqual([]);
    });
  });

  describe('saveCart', () => {
    test('gọi cart.save() và trả về cart đã lưu', async () => {
      const repo = makeRepo();
      const cart = { id: 1, status: 'merged', save: jest.fn().mockResolvedValue({ id: 1, status: 'merged' }) };

      const result = await repo.saveCart(cart);

      expect(cart.save).toHaveBeenCalled();
      expect(result.status).toBe('merged');
    });
  });

  describe('clearCartItems', () => {
    test('gọi CartItem.destroy với where cartId', async () => {
      const CartItem = makeCartItemModel();
      CartItem.destroy.mockResolvedValue(3);
      const repo = makeRepo({ CartItem });

      const result = await repo.clearCartItems(5);

      expect(CartItem.destroy).toHaveBeenCalledWith({ where: { cartId: 5 } });
      expect(result).toBe(3);
    });
  });

  // ============================================================
  // Transaction
  // ============================================================

  describe('runInTransaction', () => {
    test('gọi sequelize.transaction với work function', async () => {
      const sequelize = { transaction: jest.fn((work) => work({ LOCK: { UPDATE: 'UPDATE' } })) };
      const repo = makeRepo({ sequelize });

      const workFn = jest.fn().mockResolvedValue('done');
      await repo.runInTransaction(workFn);

      expect(sequelize.transaction).toHaveBeenCalledWith(workFn);
    });

    test('trả về kết quả của work function', async () => {
      const sequelize = { transaction: jest.fn((work) => work({})) };
      const repo = makeRepo({ sequelize });

      const result = await repo.runInTransaction(async () => 'transaction result');

      expect(result).toBe('transaction result');
    });
  });
});
