// Unit tests cho SequelizeAiRepository (src/modules/ai/repositories/SequelizeAiRepository.js)
// Mock toàn bộ Sequelize models — không chạm DB
const { Op, literal } = require('sequelize');
const SequelizeAiRepository = require('./SequelizeAiRepository');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
  };
}

function makeRepo(overrides = {}) {
  const deps = {
    Product: makeModel(),
    ProductVariant: makeModel(),
    Category: makeModel(),
    sequelize: { fn: jest.fn(), col: jest.fn(), literal: jest.fn((s) => s) },
    ...overrides,
  };
  return { repo: new SequelizeAiRepository(deps), deps };
}

// ════════════════════════════════════════════════════════════════════════════
// searchProducts
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.searchProducts', () => {
  test('gọi Product.findAll với where status=active (không có filters)', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({});

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'active' }),
      }),
    );
  });

  test('dùng limit được truyền vào', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ limit: 5 });

    expect(deps.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 5 }));
  });

  test('dùng default limit=20 khi limit không được truyền', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({});

    expect(deps.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  test('thêm Op.or condition khi có keyword', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ keyword: 'laptop' });

    const callArgs = deps.Product.findAll.mock.calls[0][0];
    expect(callArgs.where[Op.or]).toBeDefined();
    expect(callArgs.where[Op.or].length).toBeGreaterThan(0);
  });

  test('keyword tiếng Việt "giày" mở rộng sang ["shoes", "sneaker", ...]', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ keyword: 'giày' });

    const callArgs = deps.Product.findAll.mock.calls[0][0];
    const orConditions = callArgs.where[Op.or];
    // Phải bao gồm term mở rộng như 'sneaker'
    const flatTerms = orConditions.filter((c) => c.name).map((c) => c.name[Op.like]);
    expect(flatTerms.some((t) => t.includes('sneaker'))).toBe(true);
  });

  test('thêm basePrice filter khi có minPrice', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ minPrice: 100000 });

    const callArgs = deps.Product.findAll.mock.calls[0][0];
    expect(callArgs.where.basePrice).toMatchObject({ [Op.gte]: 100000 });
  });

  test('thêm basePrice filter khi có maxPrice', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ maxPrice: 500000 });

    const callArgs = deps.Product.findAll.mock.calls[0][0];
    expect(callArgs.where.basePrice).toMatchObject({ [Op.lte]: 500000 });
  });

  test('kết hợp minPrice và maxPrice', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ minPrice: 100000, maxPrice: 500000 });

    const callArgs = deps.Product.findAll.mock.calls[0][0];
    expect(callArgs.where.basePrice[Op.gte]).toBe(100000);
    expect(callArgs.where.basePrice[Op.lte]).toBe(500000);
  });

  test('thêm categoryName where và required=true vào include khi có categoryName', async () => {
    const { repo, deps } = makeRepo();
    await repo.searchProducts({ categoryName: 'Giày dép' });

    const callArgs = deps.Product.findAll.mock.calls[0][0];
    const categoryInclude = callArgs.include.find((i) => i.model === deps.Category);
    expect(categoryInclude.required).toBe(true);
    expect(categoryInclude.where).toBeDefined();
  });

  test('trả kết quả từ Product.findAll', async () => {
    const products = [{ id: 1, name: 'Nike Air Max' }];
    const { repo } = makeRepo({ Product: makeModel({ findAll: products }) });

    const result = await repo.searchProducts({});

    expect(result).toBe(products);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findActiveDeals
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.findActiveDeals', () => {
  test('gọi Product.findAll với status=active và compareAtPrice > 0', async () => {
    const { repo, deps } = makeRepo();
    await repo.findActiveDeals(5);

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          compareAtPrice: expect.objectContaining({ [Op.gt]: 0 }),
        }),
        limit: 5,
      }),
    );
  });

  test('dùng default limit=10 khi không truyền', async () => {
    const { repo, deps } = makeRepo();
    await repo.findActiveDeals();

    expect(deps.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findFeaturedProducts
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.findFeaturedProducts', () => {
  test('gọi Product.findAll với status=active và isFeatured=true', async () => {
    const { repo, deps } = makeRepo();
    await repo.findFeaturedProducts(8);

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active', isFeatured: true },
        limit: 8,
      }),
    );
  });

  test('dùng default limit=10 khi không truyền', async () => {
    const { repo, deps } = makeRepo();
    await repo.findFeaturedProducts();

    expect(deps.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findProductForCart
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.findProductForCart', () => {
  test('gọi Product.findByPk với productId và include variants', async () => {
    const mockProd = { id: 3, name: 'Adidas NMD' };
    const { repo, deps } = makeRepo({ Product: makeModel({ findByPk: mockProd }) });

    const result = await repo.findProductForCart(3);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ model: deps.ProductVariant, as: 'variants' }),
        ]),
      }),
    );
    expect(result).toBe(mockProd);
  });

  test('trả null khi sản phẩm không tồn tại', async () => {
    const { repo } = makeRepo({ Product: makeModel({ findByPk: null }) });

    const result = await repo.findProductForCart(9999);

    expect(result).toBeNull();
  });
});
