// Unit tests cho SequelizeOrdersRepository
// Mock toàn bộ Sequelize models — không chạm DB
const SequelizeOrdersRepository = require('./sequelize-orders-repository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findAndCountAll: jest
      .fn()
      .mockResolvedValue(defaults.findAndCountAll ?? { count: 0, rows: [] }),
    findOrCreate: jest.fn().mockResolvedValue([defaults.findOrCreate ?? {}, true]),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(1),
    bulkCreate: jest.fn().mockResolvedValue(defaults.bulkCreate ?? []),
  };
}

function makeInstance(extra = {}) {
  return {
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    decrement: jest.fn().mockResolvedValue(true),
    increment: jest.fn().mockResolvedValue(true),
    stockQuantity: 100,
    ...extra,
  };
}

function makeRepo(overrides = {}) {
  const deps = {
    Order: makeModel(),
    OrderItem: makeModel(),
    Cart: makeModel(),
    CartItem: makeModel(),
    Product: makeModel(),
    ProductVariant: makeModel(),
    User: makeModel(),
    DiscountCode: makeModel(),
    InventoryLog: makeModel(),
    sequelize: {
      transaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
    },
    ...overrides,
  };
  return { repo: new SequelizeOrdersRepository(deps), deps };
}

// ════════════════════════════════════════════════════════════════════════════
// Constructor validation
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — constructor', () => {
  test('ném lỗi khi thiếu Order model', () => {
    expect(() => new SequelizeOrdersRepository({})).toThrow(
      'SequelizeOrdersRepository: Order model bắt buộc',
    );
  });

  test('khởi tạo thành công với đủ dependencies', () => {
    expect(() => makeRepo()).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Order methods
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — Order', () => {
  test('findOrderByPkBasic — gọi Order.findByPk với id và options', async () => {
    const mockOrder = { id: 1, status: 'pending' };
    const { repo, deps } = makeRepo({ Order: makeModel({ findByPk: mockOrder }) });
    const opts = { attributes: ['id', 'status'] };

    const result = await repo.findOrderByPkBasic(1, opts);

    expect(deps.Order.findByPk).toHaveBeenCalledWith(1, opts);
    expect(result).toBe(mockOrder);
  });

  test('findOrderByIdAndUserId — gọi findOne với where {id, userId}', async () => {
    const { repo, deps } = makeRepo();
    await repo.findOrderByIdAndUserId(5, 3);

    expect(deps.Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 5, userId: 3 } }),
    );
  });

  test('findOrderByPkWithItemsAndUser — gọi findByPk với include User và items', async () => {
    const { repo, deps } = makeRepo();
    await repo.findOrderByPkWithItemsAndUser(10);

    expect(deps.Order.findByPk).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ include: expect.any(Array) }),
    );
  });

  test('findOrderByPkWithItemsAndUser — truyền transaction + lock → findByPk kèm transaction và lock {level, of}', async () => {
    const { repo, deps } = makeRepo();
    await repo.findOrderByPkWithItemsAndUser(10, { transaction: 'tx', lock: 'FOR UPDATE' });

    expect(deps.Order.findByPk).toHaveBeenCalledWith(
      10,
      expect.objectContaining({
        transaction: 'tx',
        lock: { level: 'FOR UPDATE', of: deps.Order },
      }),
    );
  });

  test('findOrderByNumberAndUserId — gọi findOne với where {number, userId}', async () => {
    const { repo, deps } = makeRepo();
    await repo.findOrderByNumberAndUserId('ORD-001', 2);

    expect(deps.Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { number: 'ORD-001', userId: 2 } }),
    );
  });

  test('findOrderByNumberWithUserEmail — gọi findOne với where {number} và include User', async () => {
    const { repo, deps } = makeRepo();
    await repo.findOrderByNumberWithUserEmail('ORD-002');

    expect(deps.Order.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { number: 'ORD-002' },
        include: expect.any(Array),
      }),
    );
  });

  test('findUserOrdersWithItems — gọi findAndCountAll với userId và pagination', async () => {
    const mockResult = { count: 5, rows: [] };
    const { repo, deps } = makeRepo({ Order: makeModel({ findAndCountAll: mockResult }) });

    const result = await repo.findUserOrdersWithItems(7, { limit: 10, offset: 0 });

    expect(deps.Order.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 7 }, limit: 10, offset: 0 }),
    );
    expect(result).toBe(mockResult);
  });

  test('findAllOrdersWithUser — gọi findAndCountAll với where và include user', async () => {
    const { repo, deps } = makeRepo();
    await repo.findAllOrdersWithUser({ where: { status: 'pending' }, limit: 20, offset: 0 });

    expect(deps.Order.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'pending' }, limit: 20 }),
    );
  });

  test('createOrder — gọi Order.create với payload và options', async () => {
    const payload = { userId: 1, status: 'pending', total: 150000 };
    const created = { id: 50, ...payload };
    const { repo, deps } = makeRepo({ Order: makeModel({ create: created }) });

    const result = await repo.createOrder(payload);

    expect(deps.Order.create).toHaveBeenCalledWith(payload, {});
    expect(result).toBe(created);
  });

  test('saveOrder — gọi order.save()', async () => {
    const { repo } = makeRepo();
    const order = makeInstance();

    await repo.saveOrder(order);

    expect(order.save).toHaveBeenCalledTimes(1);
  });

  test('cancelPendingOrdersByUser — restore tồn kho + set cancelled cho từng pending order', async () => {
    const { repo, deps } = makeRepo();
    const variant = makeInstance();
    const product = makeInstance();
    const pendingOrder = {
      status: 'pending',
      items: [
        { variantId: 10, quantity: 2, ProductVariant: variant, Product: {} },
        { variantId: null, quantity: 3, Product: product, ProductVariant: null },
      ],
      save: jest.fn().mockResolvedValue(true),
    };
    deps.Order.findAll.mockResolvedValue([pendingOrder]);

    const result = await repo.cancelPendingOrdersByUser(3, { transaction: 'tx' });

    expect(deps.Order.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 3, status: 'pending' }, transaction: 'tx' }),
    );
    // BUG-HIGH-1: findAll phải truyền lock để serialize concurrent createOrder (chống double-restore)
    expect(deps.Order.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ lock: undefined }), // mock tx không có LOCK.UPDATE → undefined an toàn
    );
    // Hoàn kho: variant +2, product +3
    expect(variant.increment).toHaveBeenCalledWith('stockQuantity', { by: 2, transaction: 'tx' });
    expect(product.increment).toHaveBeenCalledWith('stockQuantity', { by: 3, transaction: 'tx' });
    expect(pendingOrder.status).toBe('cancelled');
    expect(pendingOrder.save).toHaveBeenCalledWith({ transaction: 'tx' });
    expect(result).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Cart methods
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — Cart', () => {
  test('findOrCreateActiveCart — gọi Cart.findOrCreate với userId và status active', async () => {
    const mockCart = { id: 1, userId: 5 };
    const { repo, deps } = makeRepo({ Cart: makeModel({ findOrCreate: mockCart }) });

    const result = await repo.findOrCreateActiveCart(5);

    expect(deps.Cart.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 5, status: 'active' },
        defaults: { userId: 5 },
      }),
    );
    expect(result).toBe(mockCart);
  });

  test('clearCartItems — gọi CartItem.destroy với cartId', async () => {
    const { repo, deps } = makeRepo();
    await repo.clearCartItems(3);

    expect(deps.CartItem.destroy).toHaveBeenCalledWith({ where: { cartId: 3 } });
  });

  test('clearCartItems — chuyển transaction vào CartItem.destroy khi options có transaction', async () => {
    // Regression: trước fix, second arg bị ignored → CartItem.destroy chạy ngoài transaction
    // Sau fix: transaction được pass → rollback được nếu outer transaction fail
    const { repo, deps } = makeRepo();
    const mockTx = { id: 'tx-mock' };

    await repo.clearCartItems(3, { transaction: mockTx });

    expect(deps.CartItem.destroy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cartId: 3 }, transaction: mockTx }),
    );
  });

  test('saveCartItem — gọi item.save()', async () => {
    const { repo } = makeRepo();
    const item = makeInstance();

    await repo.saveCartItem(item);

    expect(item.save).toHaveBeenCalledTimes(1);
  });

  test('deleteCartItem — gọi item.destroy()', async () => {
    const { repo } = makeRepo();
    const item = makeInstance();

    await repo.deleteCartItem(item);

    expect(item.destroy).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Product / Variant stock management
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — Stock management', () => {
  test('decrementProductStock — gọi product.decrement với stockQuantity by', async () => {
    const { repo } = makeRepo();
    const product = makeInstance();

    await repo.decrementProductStock(product, 3);

    expect(product.decrement).toHaveBeenCalledWith('stockQuantity', { by: 3 });
  });

  test('restoreProductStock — gọi increment atomic stockQuantity by', async () => {
    const { repo } = makeRepo();
    const product = makeInstance({ stockQuantity: 10 });

    await repo.restoreProductStock(product, 5);

    // Atomic increment (UPDATE ... stock = stock + by) thay vì read-modify-write
    expect(product.increment).toHaveBeenCalledWith('stockQuantity', { by: 5 });
    expect(product.save).not.toHaveBeenCalled();
  });

  test('restoreVariantStock — gọi increment atomic stockQuantity by', async () => {
    const { repo } = makeRepo();
    const variant = makeInstance({ stockQuantity: 8 });

    await repo.restoreVariantStock(variant, 2);

    expect(variant.increment).toHaveBeenCalledWith('stockQuantity', { by: 2 });
    expect(variant.save).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// InventoryLog
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — InventoryLog', () => {
  test('createInventoryLogs — gọi bulkCreate với rows', async () => {
    const rows = [
      { productId: 1, change: -2 },
      { productId: 2, change: -1 },
    ];
    const { repo, deps } = makeRepo();

    await repo.createInventoryLogs(rows);

    expect(deps.InventoryLog.bulkCreate).toHaveBeenCalledWith(rows, {});
  });

  test('createInventoryLogs — trả [] khi rows rỗng (không gọi bulkCreate)', async () => {
    const { repo, deps } = makeRepo();

    const result = await repo.createInventoryLogs([]);

    expect(deps.InventoryLog.bulkCreate).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  test('createInventoryLogs — trả [] khi rows = null', async () => {
    const { repo, deps } = makeRepo();

    const result = await repo.createInventoryLogs(null);

    expect(deps.InventoryLog.bulkCreate).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Transaction
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — Transaction', () => {
  test('runInTransaction — gọi sequelize.transaction và truyền work callback', async () => {
    const { repo, deps } = makeRepo();
    const work = jest.fn().mockResolvedValue('done');

    const result = await repo.runInTransaction(work);

    expect(deps.sequelize.transaction).toHaveBeenCalledWith(work);
    expect(result).toBe('done');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// DiscountCode
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — DiscountCode', () => {
  test('findActiveDiscountCode — gọi findOne với code và isActive=true', async () => {
    const mockCode = { id: 1, code: 'SALE10', isActive: true };
    const { repo, deps } = makeRepo({ DiscountCode: makeModel({ findOne: mockCode }) });

    const result = await repo.findActiveDiscountCode('SALE10');

    expect(deps.DiscountCode.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'SALE10', isActive: true } }),
    );
    expect(result).toBe(mockCode);
  });

  test('incrementDiscountCodeUsage — gọi code.increment(usedCount)', async () => {
    const { repo } = makeRepo();
    const code = makeInstance({ increment: jest.fn().mockResolvedValue(true) });

    await repo.incrementDiscountCodeUsage(code);

    expect(code.increment).toHaveBeenCalledWith('usedCount', {});
  });
});
