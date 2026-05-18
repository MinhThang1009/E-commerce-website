// Unit tests cho SequelizeAuthRepository — phủ các nhánh còn thiếu:
//   - findById (line 18)
//   - findByIdWithAddresses (lines 22-30)
//   - findByGoogleIdOrEmail (lines 32-38)
//   - findByResetToken
//   - createUser
//   - saveUser

const SequelizeAuthRepository = require('./sequelize-auth-repository');

function makeUserModel(defaults = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
  };
}

function makeRepo(userOverrides = {}) {
  const User = makeUserModel(userOverrides);
  const repo = new SequelizeAuthRepository({ User });
  return { repo, User };
}

// ────────────────────────────────────────────────────────────
// Constructor
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — constructor', () => {
  test('ném lỗi khi thiếu User model', () => {
    expect(() => new SequelizeAuthRepository({})).toThrow(
      'SequelizeAuthRepository: User model bắt buộc'
    );
  });

  test('khởi tạo thành công với User model', () => {
    expect(() => makeRepo()).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────
// findByEmail
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — findByEmail', () => {
  test('gọi User.findOne với where { email }', async () => {
    const fakeUser = { id: 1, email: 'test@example.com' };
    const { repo, User } = makeRepo({ findOne: fakeUser });

    const result = await repo.findByEmail('test@example.com');

    expect(User.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    expect(result).toBe(fakeUser);
  });

  test('trả về null khi không tìm thấy email', async () => {
    const { repo } = makeRepo({ findOne: null });

    const result = await repo.findByEmail('notfound@example.com');

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// findById (line 18)
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — findById', () => {
  test('gọi User.findByPk với id (line 18)', async () => {
    const fakeUser = { id: 5, email: 'user@x.com' };
    const { repo, User } = makeRepo({ findByPk: fakeUser });

    const result = await repo.findById(5);

    expect(User.findByPk).toHaveBeenCalledWith(5);
    expect(result).toBe(fakeUser);
  });

  test('trả về null khi không tìm thấy id', async () => {
    const { repo } = makeRepo({ findByPk: null });

    const result = await repo.findById(9999);

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// findByIdWithAddresses (lines 22-30)
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — findByIdWithAddresses', () => {
  test('gọi User.findByPk với id và include addresses (lines 22-30)', async () => {
    const fakeUser = { id: 3, email: 'addr@x.com', addresses: [] };
    const { repo, User } = makeRepo({ findByPk: fakeUser });

    const result = await repo.findByIdWithAddresses(3);

    expect(User.findByPk).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({
            association: 'addresses',
            attributes: expect.objectContaining({ exclude: ['userId'] }),
          }),
        ]),
      })
    );
    expect(result).toBe(fakeUser);
  });

  test('trả về null khi không tìm thấy', async () => {
    const { repo } = makeRepo({ findByPk: null });

    const result = await repo.findByIdWithAddresses(999);

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// findByGoogleIdOrEmail (lines 32-38)
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — findByGoogleIdOrEmail', () => {
  test('gọi User.findOne với Op.or [googleId, email] (lines 32-38)', async () => {
    const fakeUser = { id: 7, email: 'google@x.com', googleId: 'g-abc123' };
    const { repo, User } = makeRepo({ findOne: fakeUser });

    const result = await repo.findByGoogleIdOrEmail('g-abc123', 'google@x.com');

    // Kiểm tra findOne được gọi với where chứa Op.or
    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          [Symbol.for('or')]: expect.arrayContaining([
            expect.objectContaining({ googleId: 'g-abc123' }),
            expect.objectContaining({ email: 'google@x.com' }),
          ]),
        }),
      })
    );
    expect(result).toBe(fakeUser);
  });

  test('trả về null khi không tìm thấy googleId hoặc email', async () => {
    const { repo } = makeRepo({ findOne: null });

    const result = await repo.findByGoogleIdOrEmail('unknown-id', 'nobody@x.com');

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// findByResetToken
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — findByResetToken', () => {
  test('gọi User.findOne với resetPasswordToken và resetPasswordExpires > now', async () => {
    const fakeUser = { id: 2, resetPasswordToken: 'tok-abc' };
    const { repo, User } = makeRepo({ findOne: fakeUser });

    const result = await repo.findByResetToken('tok-abc');

    expect(User.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resetPasswordToken: 'tok-abc',
        }),
      })
    );
    expect(result).toBe(fakeUser);
  });

  test('trả về null khi token hết hạn hoặc không tồn tại', async () => {
    const { repo } = makeRepo({ findOne: null });

    const result = await repo.findByResetToken('expired-token');

    expect(result).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────
// createUser
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — createUser', () => {
  test('gọi User.create với payload và trả về user mới', async () => {
    const payload = { email: 'new@x.com', password: 'hash', firstName: 'An' };
    const createdUser = { id: 10, ...payload };
    const { repo, User } = makeRepo({ create: createdUser });

    const result = await repo.createUser(payload);

    expect(User.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(createdUser);
  });
});

// ────────────────────────────────────────────────────────────
// saveUser
// ────────────────────────────────────────────────────────────

describe('SequelizeAuthRepository — saveUser', () => {
  test('gọi user.save() và trả về kết quả', async () => {
    const { repo } = makeRepo();
    const fakeUser = { id: 1, save: jest.fn().mockResolvedValue({ id: 1 }) };

    const result = await repo.saveUser(fakeUser);

    expect(fakeUser.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ id: 1 });
  });
});
