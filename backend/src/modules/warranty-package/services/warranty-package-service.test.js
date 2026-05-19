process.env.NODE_ENV = 'test';

jest.mock('@modules/warranty-package/repositories/sequelize-warranty-package-repository');

const repo = require('@modules/warranty-package/repositories/sequelize-warranty-package-repository');
const {
  getAll,
  getByProduct,
  getById,
  create,
  update,
  remove,
} = require('./warranty-package-service');
const { AppError } = require('@shared/errors');

beforeEach(() => jest.clearAllMocks());

// ─── getAll ───────────────────────────────────────────────────────────────────

describe('getAll', () => {
  it('trả về danh sách với pagination mặc định', async () => {
    repo.findAll.mockResolvedValue({ count: 2, rows: [{ id: 1 }, { id: 2 }] });
    const result = await getAll({});
    expect(result.warrantyPackages).toHaveLength(2);
    expect(result.pagination).toMatchObject({ total: 2, page: 1, limit: 10 });
  });

  it('lọc theo isActive=true khi truyền vào', async () => {
    repo.findAll.mockResolvedValue({ count: 1, rows: [{ id: 1 }] });
    await getAll({ page: 2, limit: 5, isActive: 'true' });
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true }, offset: 5, limit: 5 }),
    );
  });

  it('lọc theo isActive=false', async () => {
    repo.findAll.mockResolvedValue({ count: 0, rows: [] });
    await getAll({ isActive: 'false' });
    expect(repo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: false } }),
    );
  });
});

// ─── getByProduct ─────────────────────────────────────────────────────────────

describe('getByProduct', () => {
  it('throw 404 khi sản phẩm không tồn tại', async () => {
    repo.productExists.mockResolvedValue(null);
    await expect(getByProduct(99)).rejects.toThrow(AppError);
  });

  it('trả về danh sách gói bảo hành của sản phẩm', async () => {
    repo.productExists.mockResolvedValue({ id: 1 });
    repo.findByProduct.mockResolvedValue([
      { isDefault: true, warrantyPackage: { toJSON: () => ({ id: 10, name: 'Cơ bản' }) } },
    ]);
    const result = await getByProduct(1);
    expect(result[0]).toMatchObject({ id: 10, isDefault: true });
  });
});

// ─── getById ─────────────────────────────────────────────────────────────────

describe('getById', () => {
  it('throw 404 khi không tìm thấy gói', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(getById(99)).rejects.toThrow(AppError);
  });

  it('trả về gói khi tìm thấy', async () => {
    const pkg = { id: 1, name: 'Gói 1 năm' };
    repo.findById.mockResolvedValue(pkg);
    await expect(getById(1)).resolves.toBe(pkg);
  });
});

// ─── create ──────────────────────────────────────────────────────────────────

describe('create', () => {
  it('gọi repo.create với data truyền vào', async () => {
    const data = { name: 'Gói mới', durationMonths: 12 };
    repo.create.mockResolvedValue({ id: 5, ...data });
    const result = await create(data);
    expect(repo.create).toHaveBeenCalledWith(data);
    expect(result.id).toBe(5);
  });
});

// ─── update ──────────────────────────────────────────────────────────────────

describe('update', () => {
  it('throw 404 khi gói không tồn tại', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(update(99, {})).rejects.toThrow(AppError);
  });

  it('cập nhật và trả về gói đã sửa', async () => {
    const pkg = { id: 1, update: jest.fn().mockResolvedValue() };
    repo.findById.mockResolvedValue(pkg);
    const result = await update(1, { name: 'Mới' });
    expect(pkg.update).toHaveBeenCalledWith({ name: 'Mới' });
    expect(result).toBe(pkg);
  });
});

// ─── remove ──────────────────────────────────────────────────────────────────

describe('remove', () => {
  it('throw 404 khi gói không tồn tại', async () => {
    repo.findById.mockResolvedValue(null);
    await expect(remove(99)).rejects.toThrow(AppError);
  });

  it('throw 400 khi gói đang được dùng bởi sản phẩm', async () => {
    repo.findById.mockResolvedValue({ id: 1 });
    repo.isUsedByProduct.mockResolvedValue(true);
    await expect(remove(1)).rejects.toThrow(AppError);
  });

  it('xóa gói thành công khi không có sản phẩm dùng', async () => {
    const pkg = { id: 1, destroy: jest.fn().mockResolvedValue() };
    repo.findById.mockResolvedValue(pkg);
    repo.isUsedByProduct.mockResolvedValue(false);
    await remove(1);
    expect(pkg.destroy).toHaveBeenCalled();
  });
});

// ─── getAll — totalPages và string limit ─────────────────────────────────────

describe('getAll — totalPages calculation', () => {
  it('tính đúng totalPages khi count=10, limit=3', async () => {
    repo.findAll.mockResolvedValue({ count: 10, rows: [] });
    const result = await getAll({ limit: 3 });
    expect(result.pagination.totalPages).toBe(4); // Math.ceil(10/3) = 4
  });

  it('tính đúng totalPages khi limit là string từ query param', async () => {
    repo.findAll.mockResolvedValue({ count: 10, rows: [] });
    // limit từ query string luôn là string
    const result = await getAll({ limit: '5' });
    expect(result.pagination.totalPages).toBe(2); // Math.ceil(10/5) = 2 (không phải NaN)
  });

  it('totalPages không là NaN khi limit là string', async () => {
    repo.findAll.mockResolvedValue({ count: 7, rows: [] });
    const result = await getAll({ limit: '3' });
    expect(isNaN(result.pagination.totalPages)).toBe(false);
    expect(result.pagination.totalPages).toBe(3);
  });
});
