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

// ════════════════════════════════════════════════════════════════════════════
// Edge cases — phủ các method còn thiếu và branch chưa cover
// (merged from orders-repository.edge-cases.test.js)
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — edge cases', () => {
  // ─── findOrderForCancel ────────────────────────────────────────────────────

  describe('findOrderForCancel', () => {
    test('gọi Order.findOne với id, userId và include items (Product + ProductVariant)', async () => {
      const mockOrder = { id: 5, userId: 3, items: [] };
      const { repo, deps } = makeRepo({ Order: makeModel({ findOne: mockOrder }) });

      const result = await repo.findOrderForCancel(5, 3);

      expect(deps.Order.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5, userId: 3 },
          include: expect.arrayContaining([
            expect.objectContaining({
              association: 'items',
              include: expect.any(Array),
            }),
          ]),
        }),
      );
      expect(result).toBe(mockOrder);
    });

    test('trả về null khi không tìm thấy đơn hàng', async () => {
      const { repo } = makeRepo();

      const result = await repo.findOrderForCancel(999, 1);

      expect(result).toBeNull();
    });
  });

  // ─── findActiveCartBySessionId ─────────────────────────────────────────────

  describe('findActiveCartBySessionId', () => {
    test('gọi Cart.findOne với sessionId, status=active, userId=null và include items', async () => {
      const mockCart = { id: 10, sessionId: 'sess-abc', status: 'active', items: [] };
      const { repo, deps } = makeRepo({ Cart: makeModel({ findOne: mockCart }) });

      const result = await repo.findActiveCartBySessionId('sess-abc');

      expect(deps.Cart.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sessionId: 'sess-abc', status: 'active', userId: null },
          include: expect.any(Array),
        }),
      );
      expect(result).toBe(mockCart);
    });

    test('trả về null khi không tìm thấy cart', async () => {
      const { repo } = makeRepo();

      const result = await repo.findActiveCartBySessionId('nonexistent-session');

      expect(result).toBeNull();
    });
  });

  // ─── findCartByPkWithItemsDetails ──────────────────────────────────────────

  describe('findCartByPkWithItemsDetails', () => {
    test('gọi Cart.findByPk với id và include items với Product và ProductVariant', async () => {
      const mockCart = { id: 7, items: [{ id: 1, productId: 5 }] };
      const { repo, deps } = makeRepo({ Cart: makeModel({ findByPk: mockCart }) });

      const result = await repo.findCartByPkWithItemsDetails(7);

      expect(deps.Cart.findByPk).toHaveBeenCalledWith(
        7,
        expect.objectContaining({
          include: expect.arrayContaining([expect.objectContaining({ association: 'items' })]),
        }),
      );
      expect(result).toBe(mockCart);
    });

    test('merge options vào query khi được cung cấp', async () => {
      const { repo, deps } = makeRepo();
      const opts = { transaction: { id: 't1' } };

      await repo.findCartByPkWithItemsDetails(3, opts);

      expect(deps.Cart.findByPk).toHaveBeenCalledWith(
        3,
        expect.objectContaining({ transaction: { id: 't1' } }),
      );
    });
  });

  // ─── findCartItemMatching ──────────────────────────────────────────────────

  describe('findCartItemMatching', () => {
    test('gọi CartItem.findOne với query như where clause', async () => {
      const mockItem = { id: 3, cartId: 1, productId: 5 };
      const { repo, deps } = makeRepo({ CartItem: makeModel({ findOne: mockItem }) });

      const query = { cartId: 1, productId: 5, variantId: null };
      const result = await repo.findCartItemMatching(query);

      expect(deps.CartItem.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: query }));
      expect(result).toBe(mockItem);
    });

    test('trả về null khi không tìm thấy cart item', async () => {
      const { repo } = makeRepo();

      const result = await repo.findCartItemMatching({ cartId: 999, productId: 1 });

      expect(result).toBeNull();
    });
  });

  // ─── saveCart ──────────────────────────────────────────────────────────────

  describe('saveCart', () => {
    test('gọi cart.save() và trả về kết quả', async () => {
      const { repo } = makeRepo();
      const cart = makeInstance();

      await repo.saveCart(cart);

      expect(cart.save).toHaveBeenCalledTimes(1);
    });

    test('truyền options vào cart.save()', async () => {
      const { repo } = makeRepo();
      const cart = makeInstance();
      const opts = { transaction: {} };

      await repo.saveCart(cart, opts);

      expect(cart.save).toHaveBeenCalledWith(opts);
    });
  });

  // ─── findActiveCartsByUser ─────────────────────────────────────────────────

  describe('findActiveCartsByUser', () => {
    test('gọi Cart.findAll với userId và status=active', async () => {
      const mockCarts = [{ id: 1 }, { id: 2 }];
      const { repo, deps } = makeRepo({ Cart: makeModel({ findAll: mockCarts }) });

      const result = await repo.findActiveCartsByUser(5);

      expect(deps.Cart.findAll).toHaveBeenCalledWith({
        where: { userId: 5, status: 'active' },
      });
      expect(result).toBe(mockCarts);
    });

    test('trả về mảng rỗng khi không có cart', async () => {
      const { repo } = makeRepo({ Cart: makeModel({ findAll: [] }) });

      const result = await repo.findActiveCartsByUser(999);

      expect(result).toEqual([]);
    });

    test('chuyển transaction vào Cart.findAll khi options có transaction', async () => {
      // Regression: trước fix, options bị ignored → Cart.findAll chạy ngoài transaction
      // Sau fix: transaction được pass → atomic với saveCart + clearCartItems
      const { repo, deps } = makeRepo({ Cart: makeModel({ findAll: [] }) });
      const mockTx = { id: 'tx-mock' };

      await repo.findActiveCartsByUser(5, { transaction: mockTx });

      expect(deps.Cart.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ transaction: mockTx }),
      );
    });
  });

  // ─── findProductWithDefaultVariant ────────────────────────────────────────

  describe('findProductWithDefaultVariant', () => {
    test('gọi Product.findByPk với attributes giới hạn và include defaultVariant', async () => {
      const mockProduct = { id: 1, name: 'Laptop', slug: 'laptop' };
      const { repo, deps } = makeRepo({ Product: makeModel({ findByPk: mockProduct }) });

      const result = await repo.findProductWithDefaultVariant(1);

      expect(deps.Product.findByPk).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          attributes: expect.arrayContaining(['id', 'nameVi', 'slug']),
          include: expect.arrayContaining([
            expect.objectContaining({ association: 'defaultVariant' }),
          ]),
        }),
      );
      expect(result).toBe(mockProduct);
    });
  });

  // ─── findVariantBasic ──────────────────────────────────────────────────────

  describe('findVariantBasic', () => {
    test('gọi ProductVariant.findOne với where id + productId và attributes giới hạn', async () => {
      const mockVariant = { id: 5, sku: 'SKU-001', price: 100000 };
      const { repo, deps } = makeRepo({ ProductVariant: makeModel({ findOne: mockVariant }) });

      const result = await repo.findVariantBasic(5, 1);

      expect(deps.ProductVariant.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 5, productId: 1 },
          attributes: expect.any(Array),
        }),
      );
      expect(result).toBe(mockVariant);
    });
  });

  // ─── lockProduct / lockVariant ────────────────────────────────────────────

  describe('lockProduct và lockVariant', () => {
    test('lockProduct — gọi Product.findByPk với lock UPDATE và transaction', async () => {
      const mockProduct = { id: 1, stockQuantity: 10 };
      const { repo, deps } = makeRepo({ Product: makeModel({ findByPk: mockProduct }) });

      const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } };
      const result = await repo.lockProduct(1, fakeTransaction);

      expect(deps.Product.findByPk).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          lock: 'UPDATE',
          transaction: fakeTransaction,
        }),
      );
      expect(result).toBe(mockProduct);
    });

    test('lockVariant — gọi ProductVariant.findByPk với lock UPDATE và transaction', async () => {
      const mockVariant = { id: 3, stockQuantity: 5 };
      const { repo, deps } = makeRepo({ ProductVariant: makeModel({ findByPk: mockVariant }) });

      const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } };
      const result = await repo.lockVariant(3, fakeTransaction);

      expect(deps.ProductVariant.findByPk).toHaveBeenCalledWith(
        3,
        expect.objectContaining({
          lock: 'UPDATE',
          transaction: fakeTransaction,
        }),
      );
      expect(result).toBe(mockVariant);
    });
  });

  // ─── decrementVariantStock ────────────────────────────────────────────────

  describe('decrementVariantStock', () => {
    test('gọi variant.decrement với stockQuantity by amount', async () => {
      const { repo } = makeRepo();
      const variant = makeInstance();

      await repo.decrementVariantStock(variant, 2);

      expect(variant.decrement).toHaveBeenCalledWith('stockQuantity', { by: 2 });
    });

    test('merge options vào decrement call', async () => {
      const { repo } = makeRepo();
      const variant = makeInstance();
      const opts = { transaction: {} };

      await repo.decrementVariantStock(variant, 1, opts);

      expect(variant.decrement).toHaveBeenCalledWith('stockQuantity', { by: 1, transaction: {} });
    });
  });

  // ─── findUserById ─────────────────────────────────────────────────────────

  describe('findUserById', () => {
    test('gọi User.findByPk với id', async () => {
      const mockUser = { id: 1 };
      const { repo, deps } = makeRepo({ User: makeModel({ findByPk: mockUser }) });

      const result = await repo.findUserById(1);

      expect(deps.User.findByPk).toHaveBeenCalledWith(1, {});
      expect(result).toBe(mockUser);
    });

    test('merge options vào findByPk call', async () => {
      const { repo, deps } = makeRepo();
      const opts = { transaction: { id: 't' } };

      await repo.findUserById(5, opts);

      expect(deps.User.findByPk).toHaveBeenCalledWith(5, opts);
    });

    it('gọi User.findByPk với id và default options {} khi không truyền options', async () => {
      const { repo, deps } = makeRepo();
      const user = { id: 3 };
      deps.User.findByPk.mockResolvedValue(user);

      const result = await repo.findUserById(3);

      expect(deps.User.findByPk).toHaveBeenCalledWith(3, {});
      expect(result).toBe(user);
    });
  });

  // ─── createOrderItem ──────────────────────────────────────────────────────

  describe('createOrderItem', () => {
    test('gọi OrderItem.create với payload và options', async () => {
      const payload = { orderId: 10, productId: 1, quantity: 2, unitPrice: 100000 };
      const createdItem = { id: 5, ...payload };
      const { repo, deps } = makeRepo({ OrderItem: makeModel({ create: createdItem }) });

      const result = await repo.createOrderItem(payload);

      expect(deps.OrderItem.create).toHaveBeenCalledWith(payload, {});
      expect(result).toBe(createdItem);
    });
  });

  // ─── findOrderByPkBasic — branch: default options ─────────────────────────

  describe('findOrderByPkBasic — branches', () => {
    it('gọi Order.findByPk với id và default options {} khi không truyền options', async () => {
      const { repo, deps } = makeRepo();
      const order = { id: 5, number: 'ORD-001' };
      deps.Order.findByPk.mockResolvedValue(order);

      const result = await repo.findOrderByPkBasic(5);

      expect(deps.Order.findByPk).toHaveBeenCalledWith(5, {});
      expect(result).toBe(order);
    });

    it('gọi Order.findByPk với id và options khi được truyền', async () => {
      const { repo, deps } = makeRepo();
      const order = { id: 5 };
      deps.Order.findByPk.mockResolvedValue(order);

      await repo.findOrderByPkBasic(5, { transaction: 'txn' });

      expect(deps.Order.findByPk).toHaveBeenCalledWith(5, { transaction: 'txn' });
    });
  });

  // ─── findUserOrdersWithItems — branches ───────────────────────────────────

  describe('findUserOrdersWithItems — branches', () => {
    it('truyền undefined limit và offset khi không cung cấp options', async () => {
      const { repo, deps } = makeRepo();
      const mockResult = { count: 2, rows: [{ id: 1 }, { id: 2 }] };
      deps.Order.findAndCountAll.mockResolvedValue(mockResult);

      const result = await repo.findUserOrdersWithItems(5);

      expect(deps.Order.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 5 },
          limit: undefined,
          offset: undefined,
          order: [['createdAt', 'DESC']],
        }),
      );
      expect(result).toBe(mockResult);
    });

    it('truyền limit và offset khi cung cấp options', async () => {
      const { repo, deps } = makeRepo();
      const mockResult = { count: 10, rows: [{ id: 3 }] };
      deps.Order.findAndCountAll.mockResolvedValue(mockResult);

      const result = await repo.findUserOrdersWithItems(7, { limit: 5, offset: 10 });

      expect(deps.Order.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 7 },
          limit: 5,
          offset: 10,
        }),
      );
      expect(result).toBe(mockResult);
    });

    it('include đúng associations: items, Product, ProductVariant', async () => {
      const { repo, deps } = makeRepo();
      deps.Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await repo.findUserOrdersWithItems(1, { limit: 10, offset: 0 });

      expect(deps.Order.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([expect.objectContaining({ association: 'items' })]),
        }),
      );
    });
  });

  // ─── findAllOrdersWithUser — branch: không truyền options ─────────────────

  describe('findAllOrdersWithUser — branch: không truyền options', () => {
    it('dùng where rỗng và limit/offset undefined khi không truyền options', async () => {
      const { repo, deps } = makeRepo();
      deps.Order.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

      await repo.findAllOrdersWithUser();

      expect(deps.Order.findAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          limit: undefined,
          offset: undefined,
        }),
      );
    });
  });

  // ─── findOrderByIdAndUserId — branch: không truyền options ────────────────

  describe('findOrderByIdAndUserId — branch: không truyền options', () => {
    it('gọi Order.findOne với where {id, userId} và default options {} khi không truyền options', async () => {
      const { repo, deps } = makeRepo();
      const order = { id: 3, userId: 7 };
      deps.Order.findOne.mockResolvedValue(order);

      const result = await repo.findOrderByIdAndUserId(3, 7);

      expect(deps.Order.findOne).toHaveBeenCalledWith({ where: { id: 3, userId: 7 } });
      expect(result).toBe(order);
    });
  });

  // ─── cancelPendingOrdersByUser — branch: không truyền options ─────────────

  describe('cancelPendingOrdersByUser — branch: không truyền options', () => {
    it('không truyền options → findAll + cancel với transaction undefined; items rỗng không restore', async () => {
      const { repo, deps } = makeRepo();
      const order = { status: 'pending', items: [], save: jest.fn().mockResolvedValue() };
      deps.Order.findAll.mockResolvedValue([order]);

      const result = await repo.cancelPendingOrdersByUser(5);

      expect(deps.Order.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 5, status: 'pending' },
          transaction: undefined,
        }),
      );
      expect(order.status).toBe('cancelled');
      expect(order.save).toHaveBeenCalledWith({ transaction: undefined });
      expect(result).toBe(1);
    });
  });

  // ─── createInventoryLogs — branches ───────────────────────────────────────

  describe('createInventoryLogs — branches', () => {
    it('trả [] ngay khi rows rỗng — không gọi bulkCreate', async () => {
      const { repo, deps } = makeRepo();

      const result = await repo.createInventoryLogs([]);

      expect(result).toEqual([]);
      expect(deps.InventoryLog.bulkCreate).not.toHaveBeenCalled();
    });

    it('trả [] ngay khi rows = null — không gọi bulkCreate', async () => {
      const { repo, deps } = makeRepo();

      const result = await repo.createInventoryLogs(null);

      expect(result).toEqual([]);
      expect(deps.InventoryLog.bulkCreate).not.toHaveBeenCalled();
    });

    it('gọi bulkCreate khi rows có dữ liệu', async () => {
      const { repo, deps } = makeRepo();
      const rows = [{ productId: 1, changeType: 'sale', changeAmount: -1 }];
      deps.InventoryLog.bulkCreate.mockResolvedValue(rows);

      const result = await repo.createInventoryLogs(rows, { transaction: 'txn' });

      expect(deps.InventoryLog.bulkCreate).toHaveBeenCalledWith(rows, { transaction: 'txn' });
      expect(result).toBe(rows);
    });
  });

  // ─── runInTransaction ─────────────────────────────────────────────────────

  describe('runInTransaction — branch', () => {
    it('gọi sequelize.transaction với work function', async () => {
      const { repo, deps } = makeRepo();
      const work = jest.fn().mockResolvedValue('done');

      const result = await repo.runInTransaction(work);

      expect(deps.sequelize.transaction).toHaveBeenCalledWith(work);
      expect(result).toBe('done');
    });
  });
});
