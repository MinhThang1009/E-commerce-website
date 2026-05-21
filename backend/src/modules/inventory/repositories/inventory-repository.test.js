/**
 * Unit tests cho SequelizeInventoryRepository
 * Pattern: buildRepo() factory — inject mock models, kiểm tra Sequelize calls.
 */

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const SequelizeInventoryRepository = require('./sequelize-inventory-repository');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildRepo(overrides = {}) {
  const Product = {
    findByPk: jest.fn(),
    ...overrides.Product,
  };
  const ProductVariant = {
    findOne: jest.fn(),
    sum: jest.fn(),
    ...overrides.ProductVariant,
  };
  const InventoryLog = {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    ...overrides.InventoryLog,
  };
  const User = {
    ...overrides.User,
  };

  const repo = new SequelizeInventoryRepository({ Product, ProductVariant, InventoryLog, User });
  return { repo, Product, ProductVariant, InventoryLog, User };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── createInventoryLog ───────────────────────────────────────────────────────

describe('createInventoryLog', () => {
  test('truyền payload và opts vào InventoryLog.create', async () => {
    const { repo, InventoryLog } = buildRepo();
    const payload = { productId: 1, changeType: 'restock', changeAmount: 10 };
    const opts = { transaction: { id: 'tx-1' } };
    const fakeLog = { id: 99, ...payload };
    InventoryLog.create.mockResolvedValue(fakeLog);

    const result = await repo.createInventoryLog(payload, opts);

    expect(InventoryLog.create).toHaveBeenCalledWith(payload, opts);
    expect(result).toBe(fakeLog);
  });

  test('opts mặc định = {} khi không truyền', async () => {
    const { repo, InventoryLog } = buildRepo();
    const payload = { productId: 2, changeType: 'sale', changeAmount: -1 };
    InventoryLog.create.mockResolvedValue({ id: 1, ...payload });

    await repo.createInventoryLog(payload);

    // Phải được gọi với opts = {}
    expect(InventoryLog.create).toHaveBeenCalledWith(payload, {});
  });
});

// ─── findInventoryLogs ────────────────────────────────────────────────────────

describe('findInventoryLogs', () => {
  test('truyền where, limit, offset và include đúng models', async () => {
    const { repo, InventoryLog, Product, ProductVariant, User } = buildRepo();
    const fakeResult = { count: 2, rows: [] };
    InventoryLog.findAndCountAll.mockResolvedValue(fakeResult);

    const where = { productId: 5 };
    const result = await repo.findInventoryLogs({ where, limit: 10, offset: 0 });

    expect(InventoryLog.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        limit: 10,
        offset: 0,
        order: [['createdAt', 'DESC']],
        include: expect.arrayContaining([
          expect.objectContaining({ model: Product }),
          expect.objectContaining({ model: ProductVariant }),
          expect.objectContaining({ model: User, as: 'creator' }),
        ]),
      }),
    );
    expect(result).toBe(fakeResult);
  });

  test('không truyền args → dùng defaults (where rỗng)', async () => {
    const { repo, InventoryLog } = buildRepo();
    InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findInventoryLogs();

    expect(InventoryLog.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  test('include Product với attributes đúng', async () => {
    const { repo, InventoryLog, Product } = buildRepo();
    InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findInventoryLogs({ where: {} });

    const call = InventoryLog.findAndCountAll.mock.calls[0][0];
    const productInclude = call.include.find((i) => i.model === Product);
    expect(productInclude).toBeDefined();
    expect(productInclude.attributes).toEqual(['id', 'nameVi', 'nameEn', 'slug']);
    expect(productInclude.required).toBe(false);
  });

  test('include User với as "creator"', async () => {
    const { repo, InventoryLog, User } = buildRepo();
    InventoryLog.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findInventoryLogs({ where: {} });

    const call = InventoryLog.findAndCountAll.mock.calls[0][0];
    const userInclude = call.include.find((i) => i.model === User);
    expect(userInclude).toBeDefined();
    expect(userInclude.as).toBe('creator');
    expect(userInclude.attributes).toEqual(['id', 'firstName', 'lastName']);
  });
});

// ─── findProductById ──────────────────────────────────────────────────────────

describe('findProductById', () => {
  test('trả về product khi tìm thấy', async () => {
    const { repo, Product } = buildRepo();
    const fakeProduct = { id: 10, name: 'Laptop' };
    Product.findByPk.mockResolvedValue(fakeProduct);

    const result = await repo.findProductById(10);

    expect(Product.findByPk).toHaveBeenCalledWith(10);
    expect(result).toBe(fakeProduct);
  });

  test('trả về null khi không tìm thấy', async () => {
    const { repo, Product } = buildRepo();
    Product.findByPk.mockResolvedValue(null);

    const result = await repo.findProductById(999);

    expect(result).toBeNull();
  });
});

// ─── findVariantByIdAndProductId ──────────────────────────────────────────────

describe('findVariantByIdAndProductId', () => {
  test('trả về variant khi tìm thấy với đúng where clause', async () => {
    const { repo, ProductVariant } = buildRepo();
    const fakeVariant = { id: 5, productId: 10, stockQuantity: 20 };
    ProductVariant.findOne.mockResolvedValue(fakeVariant);

    const result = await repo.findVariantByIdAndProductId(5, 10);

    expect(ProductVariant.findOne).toHaveBeenCalledWith({
      where: { id: 5, productId: 10 },
    });
    expect(result).toBe(fakeVariant);
  });

  test('trả về null khi variant không thuộc product', async () => {
    const { repo, ProductVariant } = buildRepo();
    ProductVariant.findOne.mockResolvedValue(null);

    const result = await repo.findVariantByIdAndProductId(99, 1);

    expect(result).toBeNull();
  });
});

// ─── sumVariantStockByProductId ───────────────────────────────────────────────

describe('sumVariantStockByProductId', () => {
  test('trả về tổng stockQuantity của tất cả variants thuộc product', async () => {
    const { repo, ProductVariant } = buildRepo();
    ProductVariant.sum.mockResolvedValue(150);

    const result = await repo.sumVariantStockByProductId(10);

    expect(ProductVariant.sum).toHaveBeenCalledWith('stockQuantity', {
      where: { productId: 10 },
    });
    expect(result).toBe(150);
  });

  test('trả về 0 khi không có variant nào', async () => {
    const { repo, ProductVariant } = buildRepo();
    ProductVariant.sum.mockResolvedValue(0);

    const result = await repo.sumVariantStockByProductId(99);

    expect(result).toBe(0);
  });

  test('trả về null khi Sequelize không có row nào (null sum)', async () => {
    const { repo, ProductVariant } = buildRepo();
    // Sequelize.sum() trả null khi không có row khớp
    ProductVariant.sum.mockResolvedValue(null);

    const result = await repo.sumVariantStockByProductId(42);

    expect(result).toBeNull();
  });
});
