// Unit tests cho SequelizeAiRepository (src/modules/ai/repositories/SequelizeAiRepository.js)
// Mock toàn bộ Sequelize models — không chạm DB
const { Op, literal } = require('sequelize');
const SequelizeAiRepository = require('./sequelize-ai-repository');

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
// findActiveDeals
// ════════════════════════════════════════════════════════════════════════════

describe('SequelizeAiRepository.findActiveDeals', () => {
  test('gọi Product.findAll với status=active và compareAtPrice > basePrice', async () => {
    const { repo, deps } = makeRepo();
    await repo.findActiveDeals(5);

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'active',
          compareAtPrice: expect.objectContaining({ [Op.gt]: literal('`Product`.`base_price`') }),
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
