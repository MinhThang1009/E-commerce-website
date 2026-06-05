// Phase 45b — Unit tests bổ sung cho SequelizeCatalogRepository.
// Nhắm vào các nhánh/method chưa được cover bởi catalogRepository.test.js.

const { Op } = require('sequelize');
const SequelizeCatalogRepository = require('./sequelize-catalog-repository');

// ─── Helpers (copy từ test chính) ────────────────────────────────────────────

function makeModel(defaults = {}) {
  return {
    findAll: jest.fn().mockResolvedValue(defaults.findAll ?? []),
    findOne: jest.fn().mockResolvedValue(defaults.findOne ?? null),
    findByPk: jest.fn().mockResolvedValue(defaults.findByPk ?? null),
    findAndCountAll: jest
      .fn()
      .mockResolvedValue(defaults.findAndCountAll ?? { count: 0, rows: [] }),
    create: jest.fn().mockResolvedValue(defaults.create ?? {}),
    count: jest.fn().mockResolvedValue(defaults.count ?? 0),
    destroy: jest.fn().mockResolvedValue(defaults.destroy ?? 1),
    bulkCreate: jest.fn().mockResolvedValue(defaults.bulkCreate ?? []),
    upsert: jest.fn().mockResolvedValue([{}, true]),
    update: jest.fn().mockResolvedValue([1]),
  };
}

function makeSequelize() {
  return {
    query: jest.fn().mockResolvedValue([]),
    fn: jest.fn((...args) => ({ fn: args[0], col: args[1] })),
    col: jest.fn((c) => ({ col: c })),
    literal: jest.fn((s) => ({ literal: s })),
    where: jest.fn((col, cond) => ({ col, cond })),
    transaction: jest.fn(async (work) => work({ transaction: 'txn' })),
  };
}

function makeRepo(modelOverrides = {}, seqOverride = null) {
  const sequelize = seqOverride ?? makeSequelize();
  const deps = {
    Category: makeModel(),
    Brand: makeModel(),
    Product: makeModel(),
    ProductAttribute: makeModel(),
    ProductVariant: makeModel(),
    ProductSpecification: makeModel(),
    Review: makeModel(),
    RecentlyViewed: makeModel(),
    sequelize,
    ...modelOverrides,
  };
  return { repo: new SequelizeCatalogRepository(deps), deps, sequelize };
}

// ─── findProductVariantsByProductId — happy path ──────────────────────────────

describe('findProductVariantsByProductId — happy path', () => {
  it('gọi ProductVariant.findAll với where productId', async () => {
    const { repo, deps } = makeRepo();
    const variants = [
      { id: 1, productId: 5 },
      { id: 2, productId: 5 },
    ];
    deps.ProductVariant.findAll.mockResolvedValue(variants);

    const result = await repo.findProductVariantsByProductId(5);

    expect(deps.ProductVariant.findAll).toHaveBeenCalledWith({ where: { productId: 5 } });
    expect(result).toBe(variants);
  });

  it('trả về [] khi sản phẩm không có variant', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductVariant.findAll.mockResolvedValue([]);

    const result = await repo.findProductVariantsByProductId(99);

    expect(result).toEqual([]);
  });
});

// ─── findProductRatingsRows — happy path ─────────────────────────────────────

describe('findProductRatingsRows — happy path', () => {
  it('gọi Review.findAll với where productId và attributes rating', async () => {
    const { repo, deps } = makeRepo();
    const reviews = [{ rating: 5 }, { rating: 4 }];
    deps.Review.findAll.mockResolvedValue(reviews);

    const result = await repo.findProductRatingsRows(3);

    expect(deps.Review.findAll).toHaveBeenCalledWith({
      where: { productId: 3 },
      attributes: ['rating'],
    });
    expect(result).toBe(reviews);
  });
});

// ─── getProductPriceRange — với categoryId ────────────────────────────────────

describe('getProductPriceRange — khi có categoryId', () => {
  it('build include với association category + where id khi truyền categoryId', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ min: '50.00', max: '200.00' }]);

    const result = await repo.getProductPriceRange({ categoryId: 3 });

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.include).toHaveLength(1);
    expect(call.include[0].association).toBe('category');
    expect(call.include[0].where).toEqual({ id: 3 });
    expect(result).toEqual({ min: 50, max: 200 });
  });

  it('không có categoryId → include rỗng', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ min: '10.00', max: '100.00' }]);

    await repo.getProductPriceRange({});

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.include).toHaveLength(0);
  });
});

// ─── findAttributeValuesByName — với categoryId ───────────────────────────────

describe('findAttributeValuesByName — với categoryId', () => {
  it('build where productId Op.in subquery khi có categoryId', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__subquery__');
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findAttributeValuesByName('color', { categoryId: 5 });

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where.productId[Op.in]).toBe('__subquery__');
    expect(sequelize.literal).toHaveBeenCalledWith(
      expect.stringContaining('product_categories WHERE category_id = 5'),
    );
  });

  it('không có categoryId → where chỉ có name', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findAttributeValuesByName('size');

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where).toEqual({ name: 'size' });
  });

  it('trả về kết quả từ ProductAttribute.findAll', async () => {
    const { repo, deps } = makeRepo();
    const rows = [{ values: ['red', 'blue'] }, { values: ['green'] }];
    deps.ProductAttribute.findAll.mockResolvedValue(rows);

    const result = await repo.findAttributeValuesByName('color');

    expect(result).toBe(rows);
  });
});

// ─── findOtherAttributes — với categoryId ─────────────────────────────────────

describe('findOtherAttributes — với categoryId', () => {
  it('build where productId Op.in khi có categoryId', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__sub__');
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findOtherAttributes({ categoryId: 7 });

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where.productId[Op.in]).toBe('__sub__');
  });

  it('không có categoryId → where chỉ có name notIn brand/color/size', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findOtherAttributes({});

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where.name[Op.notIn]).toEqual(['brand', 'color', 'size']);
    expect(call.where.productId).toBeUndefined();
  });

  it('gọi với group và limit 500', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findOtherAttributes({});

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.group).toEqual(['name', 'values']);
    expect(call.limit).toBe(500);
  });
});

// ─── findDeals — sort price_desc ──────────────────────────────────────────────

describe('findDeals — sort price_desc', () => {
  it('sort price_desc → orderClause [[basePrice, DESC]]', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__expr__');
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findDeals({ minDiscount: 5, sort: 'price_desc', limit: 3 });

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.order).toEqual([['basePrice', 'DESC']]);
  });
});

// ─── _buildProductWhereConditions — filter.categoryId ────────────────────────

describe('_buildProductWhereConditions — filter.categoryId', () => {
  it('filter.categoryId → where.categoryId được set', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ categoryId: 10 });
    expect(where.categoryId).toBe(10);
  });

  it('filter.featured false (boolean) → isFeatured false', () => {
    const { repo } = makeRepo();
    expect(repo._buildProductWhereConditions({ featured: false }).isFeatured).toBe(false);
    expect(repo._buildProductWhereConditions({ featured: 'false' }).isFeatured).toBe(false);
  });
});

// ─── findRecentlyViewedByUser — line 680: RecentlyViewed thiếu → throw ────────

describe('findRecentlyViewedByUser — line 680: thiếu RecentlyViewed model', () => {
  it('throw khi RecentlyViewed không được inject vào constructor', async () => {
    // Tạo repo không có RecentlyViewed
    const { repo } = makeRepo({ RecentlyViewed: undefined });

    await expect(repo.findRecentlyViewedByUser(1, 10)).rejects.toThrow(
      'RecentlyViewed model bắt buộc trong constructor',
    );
  });
});

// ─── upsertRecentlyViewed — guard: RecentlyViewed null → return early (line 697) ──

describe('upsertRecentlyViewed — guard: RecentlyViewed null → return sớm (line 697)', () => {
  it('không throw và return sớm khi RecentlyViewed là undefined (line 697)', async () => {
    const { repo } = makeRepo({ RecentlyViewed: undefined });

    // Không throw, không gọi upsert — trả về undefined
    const result = await repo.upsertRecentlyViewed(1, 5);
    expect(result).toBeUndefined();
  });
});

// ─── pruneRecentlyViewed — guard: RecentlyViewed null → return early (line 702) ──

describe('pruneRecentlyViewed — guard: RecentlyViewed null → return sớm (line 702)', () => {
  it('không throw và return sớm khi RecentlyViewed là undefined (line 702)', async () => {
    const { repo } = makeRepo({ RecentlyViewed: undefined });

    // Không throw, không gọi findAll — trả về undefined
    const result = await repo.pruneRecentlyViewed(1, 5);
    expect(result).toBeUndefined();
  });
});

// ─── findProductByIdWithFullDetails — line 309 ────────────────────────────────

describe('findProductByIdWithFullDetails', () => {
  it('gọi Product.findByPk với id và đầy đủ associations', async () => {
    const { repo, deps } = makeRepo();
    const fakeProduct = { id: 5, name: 'iPhone 15' };
    deps.Product.findByPk.mockResolvedValue(fakeProduct);

    const result = await repo.findProductByIdWithFullDetails(5);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        include: expect.arrayContaining([
          expect.objectContaining({ association: 'category' }),
          expect.objectContaining({ association: 'variants' }),
          expect.objectContaining({ association: 'reviews' }),
        ]),
      }),
    );
    expect(result).toBe(fakeProduct);
  });

  it('trả về null khi sản phẩm không tồn tại', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findByPk.mockResolvedValue(null);

    const result = await repo.findProductByIdWithFullDetails(999);

    expect(result).toBeNull();
  });
});
