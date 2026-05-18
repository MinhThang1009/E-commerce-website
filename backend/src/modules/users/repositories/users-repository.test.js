// Unit tests cho SequelizeUsersRepository
// Mock toàn bộ Sequelize models — không chạm DB
const SequelizeUsersRepository = require('./sequelize-users-repository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    count: jest.fn().mockResolvedValue(defaults.count ?? 0),
    update: jest.fn().mockResolvedValue([1]),
  };
}

function makeInstance(extra = {}) {
  return {
    save: jest.fn().mockResolvedValue(true),
    destroy: jest.fn().mockResolvedValue(true),
    ...extra,
  };
}

function makeRepo(modelOverrides = {}) {
  const deps = {
    User: makeModel(),
    Address: makeModel(),
    ...modelOverrides,
  };
  return { repo: new SequelizeUsersRepository(deps), deps };
}

// ════════════════════════════════════════════════════════════════════════════
// Constructor validation
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeUsersRepository — constructor', () => {
  test('ném lỗi khi thiếu User model', () => {
    expect(() => new SequelizeUsersRepository({ Address: makeModel() })).toThrow(
      'SequelizeUsersRepository: User model bắt buộc'
    );
  });

  test('ném lỗi khi thiếu Address model', () => {
    expect(() => new SequelizeUsersRepository({ User: makeModel() })).toThrow(
      'SequelizeUsersRepository: Address model bắt buộc'
    );
  });

  test('khởi tạo thành công khi đủ cả User và Address', () => {
    expect(() => makeRepo()).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// User methods
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeUsersRepository — User', () => {
  test('findUserById — gọi User.findByPk với id đúng', async () => {
    const mockUser = { id: 1, email: 'user@example.com' };
    const { repo, deps } = makeRepo({ User: makeModel({ findByPk: mockUser }) });

    const result = await repo.findUserById(1);

    expect(deps.User.findByPk).toHaveBeenCalledWith(1);
    expect(result).toBe(mockUser);
  });

  test('findUserById — trả null khi user không tồn tại', async () => {
    const { repo } = makeRepo({ User: makeModel({ findByPk: null }) });

    const result = await repo.findUserById(9999);

    expect(result).toBeNull();
  });

  test('saveUser — gọi user.save()', async () => {
    const { repo } = makeRepo();
    const user = makeInstance();

    await repo.saveUser(user);

    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Address methods
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeUsersRepository — Address', () => {
  test('findAddressesByUserId — gọi findAll với order isDefault DESC rồi createdAt DESC', async () => {
    const addresses = [{ id: 1, isDefault: true }, { id: 2, isDefault: false }];
    const { repo, deps } = makeRepo({ Address: makeModel({ findAll: addresses }) });

    const result = await repo.findAddressesByUserId(5);

    expect(deps.Address.findAll).toHaveBeenCalledWith({
      where: { userId: 5 },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
    expect(result).toBe(addresses);
  });

  test('findAddressByIdAndUserId — gọi findOne với where {id, userId}', async () => {
    const mockAddr = { id: 3, userId: 5, city: 'Hà Nội' };
    const { repo, deps } = makeRepo({ Address: makeModel({ findOne: mockAddr }) });

    const result = await repo.findAddressByIdAndUserId(3, 5);

    expect(deps.Address.findOne).toHaveBeenCalledWith({ where: { id: 3, userId: 5 } });
    expect(result).toBe(mockAddr);
  });

  test('countAddressesByUserId — gọi Address.count với userId', async () => {
    const { repo, deps } = makeRepo({ Address: makeModel({ count: 3 }) });

    const result = await repo.countAddressesByUserId(5);

    expect(deps.Address.count).toHaveBeenCalledWith({ where: { userId: 5 } });
    expect(result).toBe(3);
  });

  test('createAddress — gọi Address.create với payload', async () => {
    const payload = { userId: 5, city: 'TP.HCM', address1: '1 Lê Lợi', isDefault: false };
    const created = { id: 10, ...payload };
    const { repo, deps } = makeRepo({ Address: makeModel({ create: created }) });

    const result = await repo.createAddress(payload);

    expect(deps.Address.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(created);
  });

  test('saveAddress — gọi address.save()', async () => {
    const { repo } = makeRepo();
    const address = makeInstance();

    await repo.saveAddress(address);

    expect(address.save).toHaveBeenCalledTimes(1);
  });

  test('deleteAddress — gọi address.destroy()', async () => {
    const { repo } = makeRepo();
    const address = makeInstance();

    await repo.deleteAddress(address);

    expect(address.destroy).toHaveBeenCalledTimes(1);
  });

  test('clearDefaultAddresses — gọi Address.update để bỏ isDefault', async () => {
    const { repo, deps } = makeRepo();

    await repo.clearDefaultAddresses(5);

    expect(deps.Address.update).toHaveBeenCalledWith(
      { isDefault: false },
      { where: { userId: 5, isDefault: true } }
    );
  });

  test('findLatestAddressByUserId — gọi findOne với order createdAt DESC', async () => {
    const latestAddr = { id: 7, userId: 5, createdAt: new Date() };
    const { repo, deps } = makeRepo({ Address: makeModel({ findOne: latestAddr }) });

    const result = await repo.findLatestAddressByUserId(5);

    expect(deps.Address.findOne).toHaveBeenCalledWith({
      where: { userId: 5 },
      order: [['createdAt', 'DESC']],
    });
    expect(result).toBe(latestAddr);
  });
});
