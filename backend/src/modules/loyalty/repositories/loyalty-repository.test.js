// Unit tests cho SequelizeLoyaltyRepository — phủ các methods còn thiếu:
//   - findUserPointsById
//   - decrementPoints
//   - findHistory
//   - createHistoryRecord
//   - runInTransactionWithLock

const SequelizeLoyaltyRepository = require('./sequelize-loyalty-repository');

function makeUserModel(defaults = {}) {
  return {
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
  };
}

function makeLoyaltyHistoryModel(defaults = {}) {
  return {
    findAndCountAll: jest
      .fn()
      .mockResolvedValue(defaults.findAndCountAll ?? { count: 0, rows: [] }),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
  };
}

function makeSequelize() {
  return {
    transaction: jest.fn((work) => work({ id: 'fake-transaction' })),
  };
}

function makeRepo(overrides = {}) {
  const User = overrides.User || makeUserModel();
  const LoyaltyHistory = overrides.LoyaltyHistory || makeLoyaltyHistoryModel();
  const sequelize = overrides.sequelize || makeSequelize();

  const repo = new SequelizeLoyaltyRepository({ User, LoyaltyHistory, sequelize });
  return { repo, User, LoyaltyHistory, sequelize };
}

// ────────────────────────────────────────────────────────────
// findUserPointsById
// ────────────────────────────────────────────────────────────

describe('SequelizeLoyaltyRepository — findUserPointsById', () => {
  test('gọi User.findByPk với id và attributes [id, loyaltyPoints]', async () => {
    const mockUser = { id: 1, loyaltyPoints: 500 };
    const User = makeUserModel({ findByPk: mockUser });
    const { repo } = makeRepo({ User });

    const result = await repo.findUserPointsById(1);

    expect(User.findByPk).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        attributes: ['id', 'loyaltyPoints'],
      }),
    );
    expect(result).toBe(mockUser);
  });

  test('merge options vào query (SELECT FOR UPDATE)', async () => {
    const User = makeUserModel({ findByPk: null });
    const { repo } = makeRepo({ User });
    const opts = { lock: 'UPDATE', transaction: {} };

    await repo.findUserPointsById(5, opts);

    expect(User.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ lock: 'UPDATE', transaction: {} }),
    );
  });

  test('trả về null khi không tìm thấy user', async () => {
    const { repo } = makeRepo();

    const result = await repo.findUserPointsById(9999);

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// decrementPoints
// ────────────────────────────────────────────────────────────

describe('SequelizeLoyaltyRepository — decrementPoints', () => {
  test('gọi user.decrement("loyaltyPoints") với amount', async () => {
    const { repo } = makeRepo();
    const fakeUser = {
      id: 1,
      loyaltyPoints: 1000,
      decrement: jest.fn().mockResolvedValue(true),
    };

    await repo.decrementPoints(fakeUser, 200);

    expect(fakeUser.decrement).toHaveBeenCalledWith('loyaltyPoints', { by: 200 });
  });

  test('merge options vào decrement call', async () => {
    const { repo } = makeRepo();
    const fakeUser = { decrement: jest.fn().mockResolvedValue(true) };
    const opts = { transaction: { id: 't1' } };

    await repo.decrementPoints(fakeUser, 50, opts);

    expect(fakeUser.decrement).toHaveBeenCalledWith('loyaltyPoints', {
      by: 50,
      transaction: { id: 't1' },
    });
  });
});

// ────────────────────────────────────────────────────────────
// findHistory
// ────────────────────────────────────────────────────────────

describe('SequelizeLoyaltyRepository — findHistory', () => {
  test('gọi LoyaltyHistory.findAndCountAll với userId và ORDER DESC', async () => {
    const mockResult = { count: 3, rows: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    const LoyaltyHistory = makeLoyaltyHistoryModel({ findAndCountAll: mockResult });
    const { repo } = makeRepo({ LoyaltyHistory });

    const result = await repo.findHistory(7, { limit: 10, offset: 0 });

    expect(LoyaltyHistory.findAndCountAll).toHaveBeenCalledWith({
      where: { userId: 7 },
      limit: 10,
      offset: 0,
      order: [['createdAt', 'DESC']],
    });
    expect(result).toBe(mockResult);
  });

  test('không truyền limit/offset → dùng giá trị undefined từ destructuring', async () => {
    const LoyaltyHistory = makeLoyaltyHistoryModel();
    const { repo } = makeRepo({ LoyaltyHistory });

    await repo.findHistory(3);

    expect(LoyaltyHistory.findAndCountAll).toHaveBeenCalledWith({
      where: { userId: 3 },
      limit: undefined,
      offset: undefined,
      order: [['createdAt', 'DESC']],
    });
  });

  test('trả về count và rows đúng', async () => {
    const rows = [{ id: 10, points: 100, type: 'earn' }];
    const LoyaltyHistory = makeLoyaltyHistoryModel({ findAndCountAll: { count: 1, rows } });
    const { repo } = makeRepo({ LoyaltyHistory });

    const result = await repo.findHistory(1, { limit: 5, offset: 0 });

    expect(result.count).toBe(1);
    expect(result.rows).toBe(rows);
  });
});

// ────────────────────────────────────────────────────────────
// createHistoryRecord
// ────────────────────────────────────────────────────────────

describe('SequelizeLoyaltyRepository — createHistoryRecord', () => {
  test('gọi LoyaltyHistory.create với payload', async () => {
    const payload = { userId: 1, points: 100, type: 'earn', description: 'Tích điểm' };
    const created = { id: 5, ...payload };
    const LoyaltyHistory = makeLoyaltyHistoryModel({ create: created });
    const { repo } = makeRepo({ LoyaltyHistory });

    const result = await repo.createHistoryRecord(payload);

    expect(LoyaltyHistory.create).toHaveBeenCalledWith(payload, {});
    expect(result).toBe(created);
  });

  test('truyền options (transaction) vào create', async () => {
    const LoyaltyHistory = makeLoyaltyHistoryModel();
    const { repo } = makeRepo({ LoyaltyHistory });
    const opts = { transaction: {} };

    await repo.createHistoryRecord({ userId: 1, points: -50 }, opts);

    expect(LoyaltyHistory.create).toHaveBeenCalledWith(expect.any(Object), opts);
  });
});

// ────────────────────────────────────────────────────────────
// runInTransactionWithLock
// ────────────────────────────────────────────────────────────

describe('SequelizeLoyaltyRepository — runInTransactionWithLock', () => {
  test('gọi sequelize.transaction và truyền work callback', async () => {
    const sequelize = makeSequelize();
    const { repo } = makeRepo({ sequelize });

    const work = jest.fn().mockResolvedValue('done');
    await repo.runInTransactionWithLock(work);

    expect(sequelize.transaction).toHaveBeenCalledWith(expect.any(Function));
    expect(work).toHaveBeenCalledWith({ id: 'fake-transaction' });
  });

  test('trả về kết quả của work', async () => {
    const sequelize = makeSequelize();
    const { repo } = makeRepo({ sequelize });

    const result = await repo.runInTransactionWithLock(async (t) => {
      return `result-with-${t.id}`;
    });

    expect(result).toBe('result-with-fake-transaction');
  });
});
