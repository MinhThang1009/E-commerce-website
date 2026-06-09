// Edge-case tests cho SequelizeCatalogRepository — branch coverage,
// variants, ratings, price range, attributes, deals, recently viewed.

const { Op } = require('sequelize');
const SequelizeCatalogRepository = require('./sequelize-catalog-repository');

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ════════════════════════════════════════════════════════════════════════════
// findProductsByCategoryId — lines 98-101
// Nhánh: khi status KHÔNG được truyền → where chỉ có categoryId (falsy branch)
// ════════════════════════════════════════════════════════════════════════════

describe('findProductsByCategoryId', () => {
  it('không truyền status → where chỉ có categoryId (nhánh else của if(status))', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 2, rows: [] });

    await repo.findProductsByCategoryId(5);

    const call = deps.Product.findAndCountAll.mock.calls[0][0];
    // where không chứa status khi không truyền
    expect(call.where).toEqual({ categoryId: 5 });
    expect(call.where.status).toBeUndefined();
  });

  it('truyền status falsy (undefined) → where không có status', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findProductsByCategoryId(3, { status: undefined });

    const call = deps.Product.findAndCountAll.mock.calls[0][0];
    expect(call.where.status).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findProductsByBrandId — line 160
// Nhánh: gọi không có options → dùng default params
// ════════════════════════════════════════════════════════════════════════════

describe('findProductsByBrandId — gọi không có options', () => {
  it('gọi với default options → order [createdAt, DESC]', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findProductsByBrandId(7);

    expect(deps.Product.findAndCountAll).toHaveBeenCalledWith({
      where: { brandId: 7, status: 'active' },
      limit: undefined,
      offset: undefined,
      order: [['createdAt', 'DESC']],
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findProductsList — line 303
// Nhánh: gọi không có tham số (tất cả defaults)
// ════════════════════════════════════════════════════════════════════════════

describe('findProductsList — gọi không có tham số', () => {
  it('gọi không tham số → filter={}, sort=createdAt, order=DESC', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    const result = await repo.findProductsList();

    expect(deps.Product.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: true,
        limit: undefined,
        offset: undefined,
      }),
    );
    expect(result).toEqual({ count: 0, rows: [] });
  });

  it('findProductsList không có brandSlugsIn → brand include với required: false', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findProductsList({ filter: {} });

    const call = deps.Product.findAndCountAll.mock.calls[0][0];
    const brandInclude = call.include.find((inc) => inc.association === 'brand');
    expect(brandInclude).toBeDefined();
    expect(brandInclude.required).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findRelatedProducts — lines 421-435
// Nhánh: gọi với default limit (4)
// ════════════════════════════════════════════════════════════════════════════

describe('findRelatedProducts — gọi với default limit', () => {
  it('gọi không truyền limit → sử dụng default limit = 4', async () => {
    const { repo, deps } = makeRepo();
    const products = [{ id: 2 }, { id: 3 }];
    deps.Product.findAll.mockResolvedValue(products);

    const result = await repo.findRelatedProducts(1);

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.limit).toBe(4);
    expect(call.where.id[Op.ne]).toBe(1);
    expect(result).toBe(products);
  });

  it('gọi với limit tùy chỉnh → truyền limit đúng', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findRelatedProducts(5, 8);

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.limit).toBe(8);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findDeals — line 552
// Nhánh: sort không phải price_asc và không phải price_desc → literal ORDER BY
// (Nhánh else của 2 điều kiện if/else-if)
// ════════════════════════════════════════════════════════════════════════════

describe('findDeals — branch sort mặc định (discount_desc)', () => {
  it('sort = discount_desc → sử dụng literal expression cho order', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__discount__');
    sequelize.where.mockReturnValue({});
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findDeals({ minDiscount: 10, limit: 5 });

    const call = deps.Product.findAll.mock.calls[0][0];
    // Không phải [['basePrice', ...]] — là literal expression
    expect(call.order).not.toEqual([['basePrice', 'ASC']]);
    expect(call.order).not.toEqual([['basePrice', 'DESC']]);
    // subQuery phải là false để tránh lỗi MySQL
    expect(call.subQuery).toBe(false);
  });

  it('sort = undefined (không truyền) → cũng dùng literal expression', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__discount_expr__');
    sequelize.where.mockReturnValue({});
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findDeals({ minDiscount: 5, limit: 3, sort: undefined });

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.subQuery).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getProductPriceRange — line 622
// Nhánh: không truyền tham số nào (gọi với undefined/no args)
// Nhánh này khác với {} — dùng default destructuring
// ════════════════════════════════════════════════════════════════════════════

describe('getProductPriceRange — gọi không tham số', () => {
  it('gọi không tham số → where chỉ có status=active, không crash', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ min: '0', max: '0' }]);

    const result = await repo.getProductPriceRange();

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.where).toEqual({ status: 'active' });
    expect(result).toEqual({ min: 0, max: 0 });
  });

  it('rows trả về undefined → min/max = 0 (optional chaining fallback)', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);

    const result = await repo.getProductPriceRange({});

    expect(result).toEqual({ min: 0, max: 0 });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findOtherAttributes — line 657
// Nhánh: không truyền categoryId → productId không được thêm vào where
// (Trùng với Extra test nhưng kiểm tra kỹ hơn qua gọi không tham số)
// ════════════════════════════════════════════════════════════════════════════

describe('findOtherAttributes — gọi không có categoryId', () => {
  it('gọi không tham số → where không có productId', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findOtherAttributes();

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where.productId).toBeUndefined();
    expect(call.where.name[Op.notIn]).toEqual(['brand', 'color', 'size']);
  });

  it('gọi với categoryId = 0 (falsy) → productId không được thêm vào where', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findOtherAttributes({ categoryId: 0 });

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where.productId).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findAttributeValuesByName — không truyền categoryId
// ════════════════════════════════════════════════════════════════════════════

describe('findAttributeValuesByName — gọi không tham số thứ 2', () => {
  it('gọi không truyền options → categoryId undefined, where chỉ có name', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);

    await repo.findAttributeValuesByName('color');

    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where).toEqual({ name: 'color' });
    expect(call.where.productId).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductWhereConditions — edge cases
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductWhereConditions — edge cases', () => {
  it('filter.brandIdsIn = [] (rỗng) → brandId không được thêm vào where', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ brandIdsIn: [] });
    expect(where.brandId).toBeUndefined();
  });

  it('filter.inStock = true (boolean) → Op.in subquery', () => {
    const { repo, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__in_stock__');

    const where = repo._buildProductWhereConditions({ inStock: true });

    expect(where.id[Op.in]).toBe('__in_stock__');
  });

  it('filter.inStock = false (boolean) → Op.notIn subquery', () => {
    const { repo, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__not_in_stock__');

    const where = repo._buildProductWhereConditions({ inStock: false });

    expect(where.id[Op.notIn]).toBe('__not_in_stock__');
  });

  it('filter.categoryId = 0 → where.categoryId = 0 (0 là categoryId hợp lệ)', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ categoryId: 0 });
    // categoryId !== undefined nên vẫn set
    expect(where.categoryId).toBe(0);
  });

  it('cả minPrice lẫn maxPrice → basePrice có cả Op.gte và Op.lte', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ minPrice: '200', maxPrice: '800' });
    expect(where.basePrice[Op.gte]).toBe(200);
    expect(where.basePrice[Op.lte]).toBe(800);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductWhereConditions — line 233: gọi không có arguments (default filter = {})
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductWhereConditions — line 233: gọi không có arguments (default {})', () => {
  it('gọi không tham số → trả về where rỗng {}', () => {
    // Line 233: filter = {} (default) → không có điều kiện nào được thêm → where = {}
    const { repo } = makeRepo();

    const where = repo._buildProductWhereConditions();

    // where phải là object rỗng (không có các điều kiện nào)
    expect(where).toEqual({});
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findRelatedProductsFallback — line 435: gọi với default limit = 4
// ════════════════════════════════════════════════════════════════════════════

describe('findRelatedProductsFallback — line 435: gọi với default limit', () => {
  it('gọi không truyền limit → sử dụng default limit = 4', async () => {
    // Line 435: limit = 4 (default)
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findRelatedProductsFallback(10);

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.limit).toBe(4);
    expect(call.where.id[Op.ne]).toBe(10);
    expect(call.where.status).toBe('active');
  });

  it('gọi với limit tùy chỉnh → limit được override', async () => {
    // limit = 8 override default 4
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findRelatedProductsFallback(5, 8);

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.limit).toBe(8);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// findRecentlyViewedByUser — line 678: happy path gọi với userId + limit
// ════════════════════════════════════════════════════════════════════════════

describe('findRecentlyViewedByUser — line 678: happy path với RecentlyViewed model', () => {
  it('gọi findAll với userId, limit và include Product', async () => {
    // Line 678: RecentlyViewed tồn tại → gọi findAll
    const { repo, deps } = makeRepo();
    const rows = [{ userId: 1, productId: 10, viewedAt: new Date() }];
    deps.RecentlyViewed.findAll.mockResolvedValue(rows);

    const result = await repo.findRecentlyViewedByUser(1, 5);

    expect(deps.RecentlyViewed.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        limit: 5,
        order: [['viewedAt', 'DESC']],
      }),
    );
    expect(result).toBe(rows);
  });

  it('gọi với default limit = 10 khi không truyền limit', async () => {
    const { repo, deps } = makeRepo();
    deps.RecentlyViewed.findAll.mockResolvedValue([]);

    await repo.findRecentlyViewedByUser(2);

    const call = deps.RecentlyViewed.findAll.mock.calls[0][0];
    expect(call.limit).toBe(10); // default
  });
});

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
    expect(deps.ProductVariant.findAll).toHaveBeenCalledWith({
      where: { productId: 5, isAvailable: true },
    });
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
      where: { productId: 3, isVerified: true },
      attributes: ['rating'],
    });
    expect(result).toBe(reviews);
  });
});

// ─── getProductPriceRange — với categoryId ────────────────────────────────────

describe('getProductPriceRange — khi có categoryId', () => {
  it('dùng where.categoryId thay vì include để filter đúng products', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ min: '50.00', max: '200.00' }]);
    const result = await repo.getProductPriceRange({ categoryId: 3 });
    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.where).toEqual({ status: 'active', categoryId: 3 });
    expect(result).toEqual({ min: 50, max: 200 });
  });

  it('không có categoryId → where chỉ có status=active', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ min: '10.00', max: '100.00' }]);
    await repo.getProductPriceRange({});
    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.where).toEqual({ status: 'active' });
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
  });

  it('không có categoryId → where chỉ có name', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);
    await repo.findAttributeValuesByName('size');
    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where).toEqual({ name: 'size' });
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

  it('không có categoryId → where chỉ có name notIn', async () => {
    const { repo, deps } = makeRepo();
    deps.ProductAttribute.findAll.mockResolvedValue([]);
    await repo.findOtherAttributes({});
    const call = deps.ProductAttribute.findAll.mock.calls[0][0];
    expect(call.where.name[Op.notIn]).toEqual(['brand', 'color', 'size']);
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
    expect(repo._buildProductWhereConditions({ categoryId: 10 }).categoryId).toBe(10);
  });

  it('filter.featured false → isFeatured false', () => {
    const { repo } = makeRepo();
    expect(repo._buildProductWhereConditions({ featured: false }).isFeatured).toBe(false);
    expect(repo._buildProductWhereConditions({ featured: 'false' }).isFeatured).toBe(false);
  });
});

// ─── findRecentlyViewedByUser — thiếu RecentlyViewed → throw ────────────────

describe('findRecentlyViewedByUser — thiếu RecentlyViewed model', () => {
  it('throw khi RecentlyViewed không được inject', async () => {
    const { repo } = makeRepo({ RecentlyViewed: undefined });
    await expect(repo.findRecentlyViewedByUser(1, 10)).rejects.toThrow(
      'RecentlyViewed model bắt buộc',
    );
  });
});

// ─── upsertRecentlyViewed — guard null → return early ───────────────────────

describe('upsertRecentlyViewed — guard null', () => {
  it('return sớm khi RecentlyViewed undefined', async () => {
    const { repo } = makeRepo({ RecentlyViewed: undefined });
    const result = await repo.upsertRecentlyViewed(1, 5);
    expect(result).toBeUndefined();
  });
});

// ─── pruneRecentlyViewed — guard null → return early ────────────────────────

describe('pruneRecentlyViewed — guard null', () => {
  it('return sớm khi RecentlyViewed undefined', async () => {
    const { repo } = makeRepo({ RecentlyViewed: undefined });
    const result = await repo.pruneRecentlyViewed(1, 5);
    expect(result).toBeUndefined();
  });
});

// ─── findProductByIdWithFullDetails ─────────────────────────────────────────

describe('findProductByIdWithFullDetails', () => {
  it('gọi Product.findOne với id và đầy đủ associations', async () => {
    const { repo, deps } = makeRepo();
    const fakeProduct = { id: 5, name: 'iPhone 15' };
    deps.Product.findOne.mockResolvedValue(fakeProduct);
    const result = await repo.findProductByIdWithFullDetails(5);
    expect(deps.Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 5 },
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
    deps.Product.findOne.mockResolvedValue(null);
    deps.Product.findByPk.mockResolvedValue(null);
    const result = await repo.findProductByIdWithFullDetails(999);
    expect(result).toBeNull();
  });
});
