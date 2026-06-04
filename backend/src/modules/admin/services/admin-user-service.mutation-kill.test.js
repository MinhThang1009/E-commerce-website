/**
 * Mutation-kill tests cho admin-user-service.js.
 *
 * Mục tiêu: giết các survivor còn sót sau baseline (24→≥90) bằng cách assert
 * OUTCOME thật — không chỉ status code. Gọi service TRỰC TIẾP (catchAsync(req,res))
 * với mock req/res/next để kiểm soát hoàn toàn req.user (role/id), điều mà
 * supertest không làm được (mock authenticate hardcode admin).
 *
 * Trọng tâm kill:
 *  - getAllUsers: default sortBy/sortOrder, order array, toUpperCase, attributes.exclude,
 *    Op.or search clause (field + pattern), isEmailVerified branch.
 *  - updateUser: guard self-role / self-deactivate / admin-only-role (cả message),
 *    updatePayload fallback (role || user.role, lastName ternary).
 *  - deleteUser / getUserById: message 404, response shape, include shape (as/limit/order).
 */

process.env.NODE_ENV = 'test';

jest.mock('@models', () => {
  const sentinel = (name) => ({ __model: name });
  return {
    sequelize: {},
    User: {
      findAndCountAll: jest.fn(),
      findByPk: jest.fn(),
    },
    Order: sentinel('Order'),
    Address: sentinel('Address'),
    SearchHistory: sentinel('SearchHistory'),
    RecentlyViewed: sentinel('RecentlyViewed'),
  };
});

const { Op } = require('sequelize');
const { User, Order, Address, SearchHistory, RecentlyViewed } = require('@models');
const service = require('@modules/admin/services/admin-user-service');

/**
 * Chạy 1 handler catchAsync(req,res,next) và resolve khi res.json HOẶC next được gọi.
 * @returns {Promise<{res?:object, err?:Error}>}
 */
function invoke(handler, req) {
  return new Promise((resolve) => {
    const res = {
      statusCode: undefined,
      payload: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        resolve({ res: this });
        return this;
      },
    };
    const next = (err) => resolve({ err });
    handler(req, res, next);
  });
}

function makeUserRow(overrides = {}) {
  const data = {
    id: 99,
    firstName: 'Test',
    lastName: 'User',
    phone: '0900000000',
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
    ...overrides,
  };
  return {
    ...data,
    update: jest.fn().mockImplementation((payload) => Promise.resolve({ ...data, ...payload })),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
});

// ─── getAllUsers ────────────────────────────────────────────────────────────

describe('getAllUsers — query building', () => {
  test('default sortBy=createdAt, sortOrder=DESC → order=[[createdAt, DESC]]', async () => {
    await invoke(service.getAllUsers, { query: {}, user: { id: 1, role: 'admin' } });

    const args = User.findAndCountAll.mock.calls[0][0];
    // Kill L19 ('createdAt'→''), L20 ('DESC'→''), L49 array [], inner []
    expect(args.order).toEqual([['createdAt', 'DESC']]);
  });

  test('sortOrder thường hoá HOA: sortOrder=asc → ASC (toUpperCase, không toLowerCase)', async () => {
    await invoke(service.getAllUsers, {
      query: { sortBy: 'email', sortOrder: 'asc' },
      user: { id: 1, role: 'admin' },
    });

    const args = User.findAndCountAll.mock.calls[0][0];
    // Kill L49:22 toUpperCase→toLowerCase
    expect(args.order).toEqual([['email', 'ASC']]);
  });

  test('attributes.exclude loại bỏ password/verificationToken/resetPasswordToken', async () => {
    await invoke(service.getAllUsers, { query: {}, user: { id: 1, role: 'admin' } });

    const args = User.findAndCountAll.mock.calls[0][0];
    // Kill L50 {} (attributes rỗng), L51 [] (exclude rỗng), L51 strings ''
    expect(args.attributes).toEqual({
      exclude: ['password', 'verificationToken', 'resetPasswordToken'],
    });
  });

  test('search → Op.or với đúng 4 field và pattern %search%', async () => {
    await invoke(service.getAllUsers, {
      query: { search: 'john' },
      user: { id: 1, role: 'admin' },
    });

    const args = User.findAndCountAll.mock.calls[0][0];
    // Kill L30-33 ObjectLiteral {} (clause rỗng) + StringLiteral `` (pattern rỗng)
    expect(args.where[Op.or]).toEqual([
      { firstName: { [Op.like]: '%john%' } },
      { lastName: { [Op.like]: '%john%' } },
      { email: { [Op.like]: '%john%' } },
      { phone: { [Op.like]: '%john%' } },
    ]);
  });

  test('không search → where KHÔNG có Op.or', async () => {
    await invoke(service.getAllUsers, { query: {}, user: { id: 1, role: 'admin' } });

    const args = User.findAndCountAll.mock.calls[0][0];
    expect(args.where[Op.or]).toBeUndefined();
  });

  test('role filter → where.role; không role → where không có role', async () => {
    await invoke(service.getAllUsers, {
      query: { role: 'staff' },
      user: { id: 1, role: 'admin' },
    });
    expect(User.findAndCountAll.mock.calls[0][0].where.role).toBe('staff');
  });

  test('isEmailVerified=true → where.isEmailVerified===true', async () => {
    await invoke(service.getAllUsers, {
      query: { isEmailVerified: 'true' },
      user: { id: 1, role: 'admin' },
    });
    expect(User.findAndCountAll.mock.calls[0][0].where.isEmailVerified).toBe(true);
  });

  test('isEmailVerified=false → where.isEmailVerified===false', async () => {
    await invoke(service.getAllUsers, {
      query: { isEmailVerified: 'false' },
      user: { id: 1, role: 'admin' },
    });
    expect(User.findAndCountAll.mock.calls[0][0].where.isEmailVerified).toBe(false);
  });

  test('KHÔNG truyền isEmailVerified → where KHÔNG có key này (kill L41 conditional→true)', async () => {
    await invoke(service.getAllUsers, { query: {}, user: { id: 1, role: 'admin' } });
    expect('isEmailVerified' in User.findAndCountAll.mock.calls[0][0].where).toBe(false);
  });

  test('limit cap 100, offset đúng theo page', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 50, rows: [] });
    await invoke(service.getAllUsers, {
      query: { page: '3', limit: '500' },
      user: { id: 1, role: 'admin' },
    });
    const args = User.findAndCountAll.mock.calls[0][0];
    expect(args.limit).toBe(100);
    expect(args.offset).toBe(200);
  });

  test('pagination payload phản ánh count + page', async () => {
    User.findAndCountAll.mockResolvedValueOnce({ count: 25, rows: [makeUserRow()] });
    const { res } = await invoke(service.getAllUsers, {
      query: { page: '2', limit: '10' },
      user: { id: 1, role: 'admin' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('success');
    expect(res.payload.data.pagination).toEqual({
      currentPage: 2,
      totalPages: 3,
      totalItems: 25,
      itemsPerPage: 10,
    });
  });
});

// ─── updateUser ───────────────────────────────────────────────────────────────

describe('updateUser — guards và payload', () => {
  test('user không tồn tại → AppError 404 đúng message', async () => {
    User.findByPk.mockResolvedValueOnce(null);
    const { err } = await invoke(service.updateUser, {
      params: { id: '5' },
      body: { firstName: 'X' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy người dùng');
  });

  test('self đổi role → 403 "Không thể thay đổi role của chính mình"', async () => {
    User.findByPk.mockResolvedValueOnce(makeUserRow({ id: 7, role: 'admin' }));
    const { err } = await invoke(service.updateUser, {
      params: { id: '7' },
      body: { role: 'customer' },
      user: { id: 7, role: 'admin' },
    });
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Không thể thay đổi role của chính mình');
  });

  test('self nhưng KHÔNG đổi role (role===user.role) → không lỗi self-role', async () => {
    const row = makeUserRow({ id: 7, role: 'admin' });
    User.findByPk.mockResolvedValueOnce(row);
    const { res, err } = await invoke(service.updateUser, {
      params: { id: '7' },
      body: { role: 'admin' },
      user: { id: 7, role: 'admin' },
    });
    expect(err).toBeUndefined();
    expect(res.statusCode).toBe(200);
  });

  test('KHÔNG self + đổi role (admin) → không bị chặn self-role (kill && → ||)', async () => {
    const row = makeUserRow({ id: 8, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(row);
    const { res, err } = await invoke(service.updateUser, {
      params: { id: '8' },
      body: { role: 'staff' },
      user: { id: 1, role: 'admin' },
    });
    expect(err).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'staff' }));
  });

  test('self vô hiệu hoá (isActive=false) → 403 "Không thể vô hiệu hóa tài khoản của chính mình"', async () => {
    User.findByPk.mockResolvedValueOnce(makeUserRow({ id: 7 }));
    const { err } = await invoke(service.updateUser, {
      params: { id: '7' },
      body: { isActive: false },
      user: { id: 7, role: 'admin' },
    });
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Không thể vô hiệu hóa tài khoản của chính mình');
  });

  test('self + isActive=true → không lỗi self-deactivate', async () => {
    User.findByPk.mockResolvedValueOnce(makeUserRow({ id: 7 }));
    const { err } = await invoke(service.updateUser, {
      params: { id: '7' },
      body: { isActive: true },
      user: { id: 7, role: 'admin' },
    });
    expect(err).toBeUndefined();
  });

  test('non-admin đổi role người khác → 403 "Chỉ admin mới có quyền thay đổi role"', async () => {
    User.findByPk.mockResolvedValueOnce(makeUserRow({ id: 8, role: 'customer' }));
    const { err } = await invoke(service.updateUser, {
      params: { id: '8' },
      body: { role: 'staff' },
      user: { id: 1, role: 'staff' },
    });
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Chỉ admin mới có quyền thay đổi role');
  });

  test('non-admin KHÔNG đổi role → cho phép update (kill admin-only guard)', async () => {
    const row = makeUserRow({ id: 8, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(row);
    const { err } = await invoke(service.updateUser, {
      params: { id: '8' },
      body: { firstName: 'Abc' },
      user: { id: 1, role: 'staff' },
    });
    expect(err).toBeUndefined();
    expect(row.update).toHaveBeenCalled();
  });

  test('non-admin + role GIỐNG user.role → KHÔNG chặn admin-only (kill role!==user.role → true)', async () => {
    // role có gửi nhưng === user.role hiện tại → role!==user.role là false → guard không kích hoạt.
    // Mutant biến (role!==user.role) thành true sẽ chặn nhầm → 403.
    const row = makeUserRow({ id: 8, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(row);
    const { err } = await invoke(service.updateUser, {
      params: { id: '8' },
      body: { role: 'customer' },
      user: { id: 1, role: 'staff' },
    });
    expect(err).toBeUndefined();
  });

  test('role absent → updatePayload.role = user.role (fallback ||)', async () => {
    const row = makeUserRow({ id: 8, role: 'customer' });
    User.findByPk.mockResolvedValueOnce(row);
    await invoke(service.updateUser, {
      params: { id: '8' },
      body: { firstName: 'Abc' },
      user: { id: 1, role: 'admin' },
    });
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ role: 'customer' }));
  });

  test('lastName="" (có gửi, rỗng) → fallback user.lastName (kill || → &&)', async () => {
    const row = makeUserRow({ id: 8, lastName: 'OldLast' });
    User.findByPk.mockResolvedValueOnce(row);
    await invoke(service.updateUser, {
      params: { id: '8' },
      body: { lastName: '' },
      user: { id: 1, role: 'admin' },
    });
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ lastName: 'OldLast' }));
  });

  test('lastName="New" → cập nhật "New" (kill hasOwnProperty("lastName")→"" và conditional)', async () => {
    const row = makeUserRow({ id: 8, lastName: 'OldLast' });
    User.findByPk.mockResolvedValueOnce(row);
    await invoke(service.updateUser, {
      params: { id: '8' },
      body: { lastName: 'New' },
      user: { id: 1, role: 'admin' },
    });
    expect(row.update).toHaveBeenCalledWith(expect.objectContaining({ lastName: 'New' }));
  });

  test('update thành công → 200 với user trả về', async () => {
    const row = makeUserRow({ id: 8 });
    User.findByPk.mockResolvedValueOnce(row);
    const { res } = await invoke(service.updateUser, {
      params: { id: '8' },
      body: { firstName: 'Abc' },
      user: { id: 1, role: 'admin' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('success');
    expect(res.payload.data).toHaveProperty('user');
  });
});

// ─── deleteUser ────────────────────────────────────────────────────────────────

describe('deleteUser', () => {
  test('xoá chính mình → 403', async () => {
    const { err } = await invoke(service.deleteUser, {
      params: { id: '1' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Không thể xóa tài khoản của chính mình');
  });

  test('user không tồn tại → 404 đúng message', async () => {
    User.findByPk.mockResolvedValueOnce(null);
    const { err } = await invoke(service.deleteUser, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy người dùng');
  });

  test('xoá thành công → destroy gọi + 200 message "Xóa người dùng thành công"', async () => {
    const row = makeUserRow({ id: 5 });
    User.findByPk.mockResolvedValueOnce(row);
    const { res } = await invoke(service.deleteUser, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });
    expect(row.destroy).toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ status: 'success', message: 'Xóa người dùng thành công' });
  });
});

// ─── getUserById ───────────────────────────────────────────────────────────────

describe('getUserById — include shape', () => {
  test('include đủ 4 association với as/limit/order đúng', async () => {
    const row = makeUserRow({ id: 5 });
    User.findByPk.mockResolvedValueOnce(row);
    await invoke(service.getUserById, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });

    const [idArg, opts] = User.findByPk.mock.calls[0];
    expect(idArg).toBe('5');
    expect(opts.include).toHaveLength(4);
    expect(opts.include[0]).toEqual({ model: Address, as: 'addresses' });
    expect(opts.include[1]).toEqual({
      model: Order,
      as: 'orders',
      limit: 10,
      order: [['createdAt', 'DESC']],
    });
    expect(opts.include[2]).toEqual({ model: SearchHistory, as: 'searchHistories', limit: 10 });
    expect(opts.include[3]).toEqual({ model: RecentlyViewed, as: 'recentlyViewed', limit: 10 });
  });

  test('user không tồn tại → 404 đúng message', async () => {
    User.findByPk.mockResolvedValueOnce(null);
    const { err } = await invoke(service.getUserById, {
      params: { id: '9999' },
      user: { id: 1, role: 'admin' },
    });
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Không tìm thấy người dùng');
  });

  test('tìm thấy → 200 status success + data.user', async () => {
    const row = makeUserRow({ id: 5 });
    User.findByPk.mockResolvedValueOnce(row);
    const { res } = await invoke(service.getUserById, {
      params: { id: '5' },
      user: { id: 1, role: 'admin' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.payload.status).toBe('success');
    expect(res.payload.data.user).toBe(row);
  });
});
