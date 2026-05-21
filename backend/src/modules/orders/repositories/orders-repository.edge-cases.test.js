// Tests bổ sung cho SequelizeOrdersRepository — phủ 22 lines còn thiếu:
//   - findOrderForCancel
//   - findActiveCartBySessionId
//   - findCartByPkWithItemsDetails
//   - findCartItemMatching
//   - saveCart
//   - findActiveCartsByUser
//   - findProductWithDefaultVariant
//   - findVariantBasic
//   - lockProduct / lockVariant
//   - decrementVariantStock
//   - findActiveWarrantyPackagesByIds
//   - findUserById
//   - updateUserPoints
//   - updateLoyaltyHistoryOrderId
//   - createOrderItem

const SequelizeOrdersRepository = require('./sequelize-orders-repository');

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
    loyaltyPoints: 500,
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
    LoyaltyHistory: makeModel(),
    InventoryLog: makeModel(),
    WarrantyPackage: makeModel(),
    sequelize: {
      transaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
    },
    ...overrides,
  };
  return { repo: new SequelizeOrdersRepository(deps), deps };
}

// ════════════════════════════════════════════════════════════════════════════
// findOrderForCancel
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findOrderForCancel', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// findActiveCartBySessionId
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findActiveCartBySessionId', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// findCartByPkWithItemsDetails
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findCartByPkWithItemsDetails', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// findCartItemMatching
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findCartItemMatching', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// saveCart
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — saveCart', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// findActiveCartsByUser
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findActiveCartsByUser', () => {
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
});

// ════════════════════════════════════════════════════════════════════════════
// findProductWithDefaultVariant
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findProductWithDefaultVariant', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// findVariantBasic
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findVariantBasic', () => {
  test('gọi ProductVariant.findByPk với attributes giới hạn', async () => {
    const mockVariant = { id: 5, sku: 'SKU-001', price: 100000 };
    const { repo, deps } = makeRepo({ ProductVariant: makeModel({ findByPk: mockVariant }) });

    const result = await repo.findVariantBasic(5);

    expect(deps.ProductVariant.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        attributes: expect.any(Array),
      }),
    );
    expect(result).toBe(mockVariant);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// lockProduct / lockVariant
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — lockProduct và lockVariant', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// decrementVariantStock
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — decrementVariantStock', () => {
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

// ════════════════════════════════════════════════════════════════════════════
// findActiveWarrantyPackagesByIds
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findActiveWarrantyPackagesByIds', () => {
  test('gọi WarrantyPackage.findAll với ids và isActive=true', async () => {
    const mockPackages = [{ id: 1, name: 'Bảo hành 1 năm', price: 50000 }];
    const { repo, deps } = makeRepo({ WarrantyPackage: makeModel({ findAll: mockPackages }) });

    const result = await repo.findActiveWarrantyPackagesByIds([1, 2]);

    expect(deps.WarrantyPackage.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: [1, 2], isActive: true }),
      }),
    );
    expect(result).toBe(mockPackages);
  });

  test('trả về mảng rỗng khi không có package nào active', async () => {
    const { repo } = makeRepo({ WarrantyPackage: makeModel({ findAll: [] }) });

    const result = await repo.findActiveWarrantyPackagesByIds([999]);

    expect(result).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findUserById
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — findUserById', () => {
  test('gọi User.findByPk với id', async () => {
    const mockUser = { id: 1, loyaltyPoints: 100 };
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
});

// ════════════════════════════════════════════════════════════════════════════
// updateUserPoints
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — updateUserPoints', () => {
  test('set user.loyaltyPoints và gọi user.save()', async () => {
    const { repo } = makeRepo();
    const user = makeInstance({ loyaltyPoints: 100 });

    await repo.updateUserPoints(user, 250);

    expect(user.loyaltyPoints).toBe(250);
    expect(user.save).toHaveBeenCalledTimes(1);
  });

  test('merge options vào user.save()', async () => {
    const { repo } = makeRepo();
    const user = makeInstance();
    const opts = { transaction: {} };

    await repo.updateUserPoints(user, 0, opts);

    expect(user.save).toHaveBeenCalledWith(opts);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// updateLoyaltyHistoryOrderId
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — updateLoyaltyHistoryOrderId', () => {
  test('gọi LoyaltyHistory.update với orderId và filter', async () => {
    const { repo, deps } = makeRepo();

    const filter = { userId: 1, type: 'spend', description: 'Sử dụng điểm cho đơn hàng ORD-001' };
    await repo.updateLoyaltyHistoryOrderId(filter, 99);

    expect(deps.LoyaltyHistory.update).toHaveBeenCalledWith(
      { orderId: 99 },
      expect.objectContaining({ where: filter }),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// createOrderItem
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeOrdersRepository — createOrderItem', () => {
  test('gọi OrderItem.create với payload và options', async () => {
    const payload = { orderId: 10, productId: 1, quantity: 2, unitPrice: 100000 };
    const createdItem = { id: 5, ...payload };
    const { repo, deps } = makeRepo({ OrderItem: makeModel({ create: createdItem }) });

    const result = await repo.createOrderItem(payload);

    expect(deps.OrderItem.create).toHaveBeenCalledWith(payload, {});
    expect(result).toBe(createdItem);
  });
});
