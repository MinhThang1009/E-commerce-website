// Tests nhắm vào các nhánh chưa được cover trong SequelizeOrdersRepository.
// Uncovered: 42 (findOrderByPkBasic options default),
//            108-135 (findUserOrdersWithItems limit/offset undefined)

const SequelizeOrdersRepository = require('./sequelize-orders-repository');
const { col } = require('sequelize');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findAndCountAll: jest
      .fn()
      .mockResolvedValue(defaults.findAndCountAll ?? { count: 0, rows: [] }),
    findOrCreate: jest.fn().mockResolvedValue([defaults.findOrCreate ?? {}, false]),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    update: jest.fn().mockResolvedValue([1]),
    destroy: jest.fn().mockResolvedValue(0),
    decrement: jest.fn().mockResolvedValue(),
    increment: jest.fn().mockResolvedValue(),
    bulkCreate: jest.fn().mockResolvedValue([]),
  };
}

function makeSequelize() {
  return {
    transaction: jest.fn(async (work) => work({ LOCK: { UPDATE: 'UPDATE' } })),
  };
}

function makeRepo(overrides = {}) {
  const sequelize = makeSequelize();
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
    sequelize,
    ...overrides,
  };
  return { repo: new SequelizeOrdersRepository(deps), deps, sequelize };
}

// ─── findOrderByPkBasic — branch: không truyền options (line 42) ──────────────

describe('findOrderByPkBasic', () => {
  it('gọi Order.findByPk với id và default options {} khi không truyền options', async () => {
    // Branch: options = {} (default parameter branch)
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

// ─── findUserOrdersWithItems — branch: không truyền options (limit/offset = undefined) ──

describe('findUserOrdersWithItems', () => {
  it('truyền undefined limit và offset khi không cung cấp options (line 108)', async () => {
    // Branch: { limit, offset } = {} → limit = undefined, offset = undefined
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

  it('truyền limit và offset khi cung cấp options (line 108)', async () => {
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

// ─── findAllOrdersWithUser — branch: không truyền options ─────────────────────

describe('findAllOrdersWithUser', () => {
  it('dùng where rỗng và limit/offset undefined khi không truyền options', async () => {
    // Branch: { where = {}, limit, offset } = {} → default values
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

// ─── findOrderByIdAndUserId — branch: không truyền options ────────────────────

describe('findOrderByIdAndUserId', () => {
  it('gọi Order.findOne với where {id, userId} và default options {} khi không truyền options', async () => {
    const { repo, deps } = makeRepo();
    const order = { id: 3, userId: 7 };
    deps.Order.findOne.mockResolvedValue(order);

    const result = await repo.findOrderByIdAndUserId(3, 7);

    expect(deps.Order.findOne).toHaveBeenCalledWith({ where: { id: 3, userId: 7 } });
    expect(result).toBe(order);
  });
});

// ─── cancelPendingOrdersByUser — branch: không truyền options ─────────────────

describe('cancelPendingOrdersByUser', () => {
  it('gọi Order.update với default options {} khi không truyền options', async () => {
    const { repo, deps } = makeRepo();
    deps.Order.update.mockResolvedValue([2]);

    const result = await repo.cancelPendingOrdersByUser(5);

    expect(deps.Order.update).toHaveBeenCalledWith(
      { status: 'cancelled' },
      expect.objectContaining({ where: { userId: 5, status: 'pending' } }),
    );
    expect(result).toEqual([2]);
  });
});

// ─── createInventoryLogs — branch: rows rỗng → trả [] (line 339) ──────────────

describe('createInventoryLogs', () => {
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

// ─── findActiveWarrantyPackagesByIds — branch: không truyền options ────────────

describe('findActiveWarrantyPackagesByIds', () => {
  it('gọi WarrantyPackage.findAll với default options {} khi không truyền options', async () => {
    const { repo, deps } = makeRepo();
    const pkgs = [{ id: 1, isActive: true }];
    deps.WarrantyPackage.findAll.mockResolvedValue(pkgs);

    const result = await repo.findActiveWarrantyPackagesByIds([1]);

    expect(deps.WarrantyPackage.findAll).toHaveBeenCalledWith({
      where: { id: [1], isActive: true },
    });
    expect(result).toBe(pkgs);
  });
});

// ─── findUserById — branch: không truyền options ─────────────────────────────

describe('findUserById', () => {
  it('gọi User.findByPk với id và default options {} khi không truyền options', async () => {
    const { repo, deps } = makeRepo();
    const user = { id: 3, loyaltyPoints: 100 };
    deps.User.findByPk.mockResolvedValue(user);

    const result = await repo.findUserById(3);

    expect(deps.User.findByPk).toHaveBeenCalledWith(3, {});
    expect(result).toBe(user);
  });
});

// ─── runInTransaction ─────────────────────────────────────────────────────────

describe('runInTransaction', () => {
  it('gọi sequelize.transaction với work function', async () => {
    const { repo, sequelize } = makeRepo();
    const work = jest.fn().mockResolvedValue('done');

    const result = await repo.runInTransaction(work);

    expect(sequelize.transaction).toHaveBeenCalledWith(work);
    expect(result).toBe('done');
  });
});
