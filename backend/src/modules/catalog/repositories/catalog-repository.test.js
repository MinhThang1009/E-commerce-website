// Phase 45 — Unit tests cho SequelizeCatalogRepository (36 test cases).
// Mock toàn bộ Sequelize models và sequelize instance — không chạm DB.
const { Op, QueryTypes } = require('sequelize');
const SequelizeCatalogRepository = require('./sequelize-catalog-repository');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Tạo mock Sequelize model với các static method thường dùng */
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

/** Tạo mock sequelize instance */
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

/** Khởi tạo repository với mock models */
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
// 1. CATEGORY
// ════════════════════════════════════════════════════════════════════════════

describe('Category methods', () => {
  test('TC-01 findAllCategoriesSorted — gọi findAll với order ASC', async () => {
    const { repo, deps } = makeRepo();
    const cats = [
      { id: 1, name: 'A' },
      { id: 2, name: 'B' },
    ];
    deps.Category.findAll.mockResolvedValue(cats);

    const result = await repo.findAllCategoriesSorted();

    expect(deps.Category.findAll).toHaveBeenCalledWith({
      order: [
        ['sortOrder', 'ASC'],
        ['nameVi', 'ASC'],
      ],
    });
    expect(result).toBe(cats);
  });

  test('TC-02 getCategoryProductCounts — raw SQL trả về map category_id → count', async () => {
    const seq = makeSequelize();
    seq.query.mockResolvedValue([
      { category_id: 1, product_count: '5' },
      { category_id: 3, product_count: '12' },
    ]);
    const { repo } = makeRepo({}, seq);

    const result = await repo.getCategoryProductCounts();

    expect(seq.query).toHaveBeenCalledWith(expect.stringContaining('product_categories'), {
      type: QueryTypes.SELECT,
    });
    expect(result).toEqual({ 1: 5, 3: 12 });
  });

  test('TC-03 getCategoryProductCounts — kết quả rỗng → map rỗng', async () => {
    const seq = makeSequelize();
    seq.query.mockResolvedValue([]);
    const { repo } = makeRepo({}, seq);

    const result = await repo.getCategoryProductCounts();
    expect(result).toEqual({});
  });

  test('TC-04 findCategoryById — delegate tới findByPk', async () => {
    const { repo, deps } = makeRepo();
    const cat = { id: 7, name: 'X' };
    deps.Category.findByPk.mockResolvedValue(cat);

    const result = await repo.findCategoryById(7);

    expect(deps.Category.findByPk).toHaveBeenCalledWith(7);
    expect(result).toBe(cat);
  });

  test('TC-05 findCategoryBySlug — gọi findOne với where slug', async () => {
    const { repo, deps } = makeRepo();
    const cat = { id: 1, slug: 'phones' };
    deps.Category.findOne.mockResolvedValue(cat);

    const result = await repo.findCategoryBySlug('phones');

    expect(deps.Category.findOne).toHaveBeenCalledWith({ where: { slug: 'phones' } });
    expect(result).toBe(cat);
  });

  test('TC-06 findCategoryByIdOrSlug — slug dạng string → Op.or chỉ có slug', async () => {
    const { repo, deps } = makeRepo();
    deps.Category.findOne.mockResolvedValue({ id: 2, slug: 'laptops' });

    await repo.findCategoryByIdOrSlug('laptops');

    const call = deps.Category.findOne.mock.calls[0][0];
    // where clause có Op.or
    expect(call.where[Op.or]).toBeDefined();
    // Phần tử đầu là { slug: 'laptops' }
    expect(call.where[Op.or][0]).toEqual({ slug: 'laptops' });
  });

  test('TC-07 findCategoryByIdOrSlug — numeric string → Op.or có cả id và slug', async () => {
    const { repo, deps } = makeRepo();
    deps.Category.findOne.mockResolvedValue({ id: 5 });

    await repo.findCategoryByIdOrSlug('5');

    const call = deps.Category.findOne.mock.calls[0][0];
    const orClause = call.where[Op.or];
    expect(orClause.some((c) => c.id !== undefined)).toBe(true);
    expect(orClause.some((c) => c.slug !== undefined)).toBe(true);
  });

  test('TC-08 createCategory — gọi Category.create với payload', async () => {
    const { repo, deps } = makeRepo();
    const payload = { name: 'Gaming', slug: 'gaming' };
    const created = { id: 10, ...payload };
    deps.Category.create.mockResolvedValue(created);

    const result = await repo.createCategory(payload);

    expect(deps.Category.create).toHaveBeenCalledWith(payload);
    expect(result).toBe(created);
  });

  test('TC-09 saveCategory / deleteCategory — delegate tới instance method', async () => {
    const { repo } = makeRepo();
    const cat = {
      save: jest.fn().mockResolvedValue('saved'),
      destroy: jest.fn().mockResolvedValue('destroyed'),
    };

    const saved = await repo.saveCategory(cat);
    const deleted = await repo.deleteCategory(cat);

    expect(cat.save).toHaveBeenCalled();
    expect(cat.destroy).toHaveBeenCalled();
    expect(saved).toBe('saved');
    expect(deleted).toBe('destroyed');
  });

  test('TC-10 countProductsByCategoryId — Product.count với where categoryId', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.count.mockResolvedValue(42);

    const result = await repo.countProductsByCategoryId(3);

    expect(deps.Product.count).toHaveBeenCalledWith({ where: { categoryId: 3 } });
    expect(result).toBe(42);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. BRAND
// ════════════════════════════════════════════════════════════════════════════

describe('Brand methods', () => {
  test('TC-11 findAllBrands — không filter → findAll order ASC', async () => {
    const { repo, deps } = makeRepo();
    deps.Brand.findAll.mockResolvedValue([{ id: 1 }]);

    const result = await repo.findAllBrands();

    expect(deps.Brand.findAll).toHaveBeenCalledWith({
      where: {},
      order: [['nameVi', 'ASC']],
    });
    expect(result).toHaveLength(1);
  });

  test('TC-12 findAllBrands — filter.idIn → where id Op.in', async () => {
    const { repo, deps } = makeRepo();
    deps.Brand.findAll.mockResolvedValue([]);

    await repo.findAllBrands({ filter: { idIn: [2, 3] } });

    const call = deps.Brand.findAll.mock.calls[0][0];
    expect(call.where.id[Op.in]).toEqual([2, 3]);
  });

  test('TC-12b findAllBrands — filter.hasProducts=true → include Product với required:true', async () => {
    const { repo, deps } = makeRepo();
    deps.Brand.findAll.mockResolvedValue([{ id: 1 }]);

    await repo.findAllBrands({ filter: { hasProducts: true } });

    const call = deps.Brand.findAll.mock.calls[0][0];
    expect(call.include).toBeDefined();
    expect(call.include[0].required).toBe(true);
    expect(call.distinct).toBe(true);
  });

  test('TC-13 findBrandById — delegate tới Brand.findByPk', async () => {
    const { repo, deps } = makeRepo();
    const brand = { id: 5, name: 'Apple' };
    deps.Brand.findByPk.mockResolvedValue(brand);

    const result = await repo.findBrandById(5);

    expect(deps.Brand.findByPk).toHaveBeenCalledWith(5);
    expect(result).toBe(brand);
  });

  test('TC-14 findBrandBySlug — gọi findOne với slug', async () => {
    const { repo, deps } = makeRepo();
    const brand = { id: 1, slug: 'samsung' };
    deps.Brand.findOne.mockResolvedValue(brand);

    const result = await repo.findBrandBySlug('samsung');

    expect(deps.Brand.findOne).toHaveBeenCalledWith({ where: { slug: 'samsung' } });
    expect(result).toBe(brand);
  });

  test('TC-15 createBrand / saveBrand / deleteBrand', async () => {
    const { repo, deps } = makeRepo();
    const payload = { name: 'Sony', slug: 'sony' };
    const created = { id: 9, ...payload };
    deps.Brand.create.mockResolvedValue(created);

    const r1 = await repo.createBrand(payload);
    expect(r1).toBe(created);

    const brandInst = {
      save: jest.fn().mockResolvedValue(created),
      destroy: jest.fn().mockResolvedValue(1),
    };
    await repo.saveBrand(brandInst);
    await repo.deleteBrand(brandInst);
    expect(brandInst.save).toHaveBeenCalled();
    expect(brandInst.destroy).toHaveBeenCalled();
  });

  test('TC-16 countProductsByBrandId — Product.count với where brandId', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.count.mockResolvedValue(7);

    const result = await repo.countProductsByBrandId(2);

    expect(deps.Product.count).toHaveBeenCalledWith({ where: { brandId: 2 } });
    expect(result).toBe(7);
  });

  test('TC-17 findProductsByBrandId — truyền pagination và sort', async () => {
    const { repo, deps } = makeRepo();
    const rows = { count: 3, rows: [] };
    deps.Product.findAndCountAll.mockResolvedValue(rows);

    const result = await repo.findProductsByBrandId(4, {
      sort: 'basePrice',
      order: 'ASC',
      limit: 10,
      offset: 0,
    });

    expect(deps.Product.findAndCountAll).toHaveBeenCalledWith({
      where: { brandId: 4 },
      limit: 10,
      offset: 0,
      order: [['basePrice', 'ASC']],
    });
    expect(result).toBe(rows);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. PRODUCT FILTERING / SORTING (_buildProductWhereConditions)
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductWhereConditions', () => {
  test('TC-25 filter rỗng → where rỗng {}', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({});
    expect(where).toEqual({});
  });

  test('TC-26 filter.search → Op.or với 3 LOWER LIKE', () => {
    const { repo, sequelize } = makeRepo();
    const where = repo._buildProductWhereConditions({ search: 'iPhone' });
    // Op.or phải tồn tại
    expect(where[Op.or]).toBeDefined();
    expect(where[Op.or]).toHaveLength(4);
    // sequelize.fn được gọi với 'LOWER'
    expect(sequelize.fn).toHaveBeenCalledWith('LOWER', expect.anything());
  });

  test('TC-27 filter.minPrice / filter.maxPrice → basePrice Op.gte / Op.lte', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ minPrice: '100', maxPrice: '500' });
    expect(where.basePrice[Op.gte]).toBe(100);
    expect(where.basePrice[Op.lte]).toBe(500);
  });

  test('TC-28 filter.featured=true (string) → isFeatured true', () => {
    const { repo } = makeRepo();
    expect(repo._buildProductWhereConditions({ featured: 'true' }).isFeatured).toBe(true);
    expect(repo._buildProductWhereConditions({ featured: true }).isFeatured).toBe(true);
  });

  test('TC-29 filter.status → where.status', () => {
    const { repo } = makeRepo();
    expect(repo._buildProductWhereConditions({ status: 'active' }).status).toBe('active');
  });

  test('TC-30 filter.brandIdsIn → where.brandId Op.in', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ brandIdsIn: [1, 2, 3] });
    expect(where.brandId[Op.in]).toEqual([1, 2, 3]);
  });

  test('TC-31 filter.categoryIdMissingSentinel → where.id = -1', () => {
    const { repo } = makeRepo();
    const where = repo._buildProductWhereConditions({ categoryIdMissingSentinel: true });
    expect(where.id).toBe(-1);
  });

  test('TC-32 filter.inStock=true → Op.in subquery', () => {
    const { repo, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__literal__');

    const where = repo._buildProductWhereConditions({ inStock: 'true' });

    expect(where.id[Op.in]).toBe('__literal__');
    expect(sequelize.literal).toHaveBeenCalledWith(
      expect.stringContaining('product_variants WHERE stock_quantity > 0'),
    );
  });

  test('TC-33 filter.inStock=false → Op.notIn subquery', () => {
    const { repo, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__lit__');

    const where = repo._buildProductWhereConditions({ inStock: 'false' });

    expect(where.id[Op.notIn]).toBe('__lit__');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. _buildProductOrderClause
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductOrderClause', () => {
  const { repo } = makeRepo();

  test('TC-34 price_asc → COALESCE(min variant price, basePrice) ASC', () => {
    const result = repo._buildProductOrderClause('price_asc');
    expect(result).toHaveLength(1);
    expect(result[0][1]).toBe('ASC');
    expect(result[0][0]).toMatchObject({ literal: expect.stringContaining('COALESCE') });
    expect(result[0][0].literal).toContain('basePrice');
  });

  test('TC-34b price_desc → COALESCE(min variant price, basePrice) DESC', () => {
    const result = repo._buildProductOrderClause('price_desc');
    expect(result).toHaveLength(1);
    expect(result[0][1]).toBe('DESC');
    expect(result[0][0]).toMatchObject({ literal: expect.stringContaining('COALESCE') });
    expect(result[0][0].literal).toContain('basePrice');
  });

  test('TC-34c newest → [[createdAt, DESC]]', () => {
    expect(repo._buildProductOrderClause('newest')).toEqual([['createdAt', 'DESC']]);
  });

  test('TC-34d bestselling / popular → [[soldCount, DESC]]', () => {
    expect(repo._buildProductOrderClause('bestselling')).toEqual([['soldCount', 'DESC']]);
    expect(repo._buildProductOrderClause('popular')).toEqual([['soldCount', 'DESC']]);
  });

  test('TC-34e custom sort+order → [[sort, order]]', () => {
    expect(repo._buildProductOrderClause('name', 'ASC')).toEqual([['name', 'ASC']]);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. PRODUCT FETCHING
// ════════════════════════════════════════════════════════════════════════════

describe('Product fetching methods', () => {
  test('TC-35 findProductsList — gọi findAndCountAll với đúng include', async () => {
    const { repo, deps } = makeRepo();
    const mockResult = { count: 2, rows: [{ id: 1 }, { id: 2 }] };
    deps.Product.findAndCountAll.mockResolvedValue(mockResult);

    const result = await repo.findProductsList({
      filter: {},
      sort: 'createdAt',
      order: 'DESC',
      limit: 10,
      offset: 0,
    });

    expect(deps.Product.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({
        distinct: true,
        limit: 10,
        offset: 0,
      }),
    );
    expect(result).toBe(mockResult);
  });

  test('TC-35b findProductsList — filter.brandSlugsIn → include brand required:true', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });

    await repo.findProductsList({ filter: { brandSlugsIn: ['apple', 'samsung'] } });

    const call = deps.Product.findAndCountAll.mock.calls[0][0];
    const brandInclude = call.include.find((inc) => inc.association === 'brand');
    expect(brandInclude).toBeDefined();
    expect(brandInclude.required).toBe(true);
  });

  test('TC-37 findProductBySlugWithFullDetails — findOne với slug', async () => {
    const { repo, deps } = makeRepo();
    const product = { id: 2, slug: 'iphone-15' };
    deps.Product.findOne.mockResolvedValue(product);

    const result = await repo.findProductBySlugWithFullDetails('iphone-15');

    expect(deps.Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'iphone-15' } }),
    );
    expect(result).toBe(product);
  });

  test('TC-38 findProductByPk — delegate Product.findByPk', async () => {
    const { repo, deps } = makeRepo();
    const product = { id: 5 };
    deps.Product.findByPk.mockResolvedValue(product);

    const result = await repo.findProductByPk(5);

    expect(deps.Product.findByPk).toHaveBeenCalledWith(5);
    expect(result).toBe(product);
  });

  test('TC-39 findFeaturedProducts — where isFeatured:true + limit', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ id: 1, isFeatured: true }]);

    const result = await repo.findFeaturedProducts(5);

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isFeatured: true, status: 'active' },
        limit: 5,
      }),
    );
    expect(result).toHaveLength(1);
  });

  test('TC-40 findFeaturedProducts — default limit = 8', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findFeaturedProducts();

    expect(deps.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 8 }));
  });

  test('TC-41 findRelatedProducts — exclude id, limit', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ id: 2 }, { id: 3 }]);

    const result = await repo.findRelatedProducts(1, 2);

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.where.id[Op.ne]).toBe(1);
    expect(call.limit).toBe(2);
    expect(result).toHaveLength(2);
  });

  test('TC-42 findNewArrivals — order createdAt DESC, default limit 8', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findNewArrivals();

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 8,
        order: [['createdAt', 'DESC']],
      }),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. SEARCH
// ════════════════════════════════════════════════════════════════════════════

describe('Search methods', () => {
  test('TC-43 searchProducts — Op.or 4 LOWER LIKE fields', async () => {
    const { repo, deps, sequelize } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 1, rows: [{ id: 1 }] });

    const result = await repo.searchProducts({ q: 'Samsung', limit: 20, offset: 0 });

    const call = deps.Product.findAndCountAll.mock.calls[0][0];
    expect(call.where[Op.or]).toHaveLength(5);
    // sequelize.fn được gọi với 'LOWER' nhiều lần
    expect(sequelize.fn).toHaveBeenCalledWith('LOWER', expect.anything());
    expect(result.count).toBe(1);
  });

  test('TC-44 searchProducts — lowercase query truyền vào LIKE', async () => {
    const { repo, deps, sequelize } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 0, rows: [] });
    // Spy sequelize.where để capture cond
    const conditions = [];
    sequelize.where.mockImplementation((col, cond) => {
      conditions.push(cond);
      return { col, cond };
    });

    await repo.searchProducts({ q: 'iPHONE', limit: 10, offset: 0 });

    // LIKE pattern phải lowercase
    expect(conditions.some((c) => c[Op.like] === '%iphone%')).toBe(true);
  });

  test('TC-45 findProductSuggestions — prefix match, limit, order name ASC', async () => {
    const { repo, deps, sequelize } = makeRepo();
    const suggestions = [{ id: 1, name: 'Samsung A52', slug: 'samsung-a52' }];
    deps.Product.findAll.mockResolvedValue(suggestions);
    sequelize.where.mockReturnValue({});

    const result = await repo.findProductSuggestions('sam', 5);

    expect(deps.Product.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: ['id', 'nameVi', 'nameEn', 'slug'],
        limit: 5,
        order: [['nameVi', 'ASC']],
      }),
    );
    expect(result).toBe(suggestions);
  });

  test('TC-45b findProductSuggestions — default limit = 10', async () => {
    const { repo, deps, sequelize } = makeRepo();
    deps.Product.findAll.mockResolvedValue([]);
    sequelize.where.mockReturnValue({});

    await repo.findProductSuggestions('test');

    expect(deps.Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  test('TC-46 findBestSellersRaw — raw SQL với replacements', async () => {
    const { repo, sequelize } = makeRepo();
    const startDate = new Date('2025-01-01');
    sequelize.query.mockResolvedValue([{ id: 1, name: 'A', units_sold: '50' }]);

    const result = await repo.findBestSellersRaw({ startDate, limit: 5 });

    expect(sequelize.query).toHaveBeenCalledWith(expect.stringContaining('order_items'), {
      replacements: { startDate, limit: 5 },
      type: QueryTypes.SELECT,
    });
    expect(result).toHaveLength(1);
  });

  test('TC-47 findProductsByIdsOrdered — lọc non-numeric, order CASE', async () => {
    const { repo, deps, sequelize } = makeRepo();
    const products = [{ id: 1 }, { id: 3 }];
    deps.Product.findAll.mockResolvedValue(products);
    sequelize.literal.mockReturnValue('__case__');

    const result = await repo.findProductsByIdsOrdered([1, 'abc', 3]);

    const call = deps.Product.findAll.mock.calls[0][0];
    // 'abc' bị lọc
    expect(call.where.id[Op.in]).toEqual([1, 3]);
    expect(result).toBe(products);
  });

  test('TC-47b findProductsByIdsOrdered — ids rỗng → trả [] ngay', async () => {
    const { repo, deps } = makeRepo();

    const result = await repo.findProductsByIdsOrdered([]);

    expect(result).toEqual([]);
    expect(deps.Product.findAll).not.toHaveBeenCalled();
  });

  test('TC-47c findProductsByIdsOrdered — tất cả ids không hợp lệ → trả []', async () => {
    const { repo, deps } = makeRepo();

    const result = await repo.findProductsByIdsOrdered(['abc', 'xyz']);

    expect(result).toEqual([]);
    expect(deps.Product.findAll).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. PRODUCT CRUD + EDGE CASES
// ════════════════════════════════════════════════════════════════════════════

describe('Product CRUD', () => {
  test('TC-49 createProduct — Product.create với payload và options', async () => {
    const { repo, deps } = makeRepo();
    const payload = { name: 'New Product', slug: 'new-product', basePrice: 99 };
    const created = { id: 20, ...payload };
    deps.Product.create.mockResolvedValue(created);

    const result = await repo.createProduct(payload, { transaction: 'tx' });

    expect(deps.Product.create).toHaveBeenCalledWith(payload, { transaction: 'tx' });
    expect(result).toBe(created);
  });

  test('TC-50 saveProduct / deleteProduct — delegate tới instance method', async () => {
    const { repo } = makeRepo();
    const product = {
      save: jest.fn().mockResolvedValue('saved-product'),
      destroy: jest.fn().mockResolvedValue('deleted'),
    };

    const saved = await repo.saveProduct(product, { transaction: 'tx' });
    const deleted = await repo.deleteProduct(product);

    expect(product.save).toHaveBeenCalledWith({ transaction: 'tx' });
    expect(product.destroy).toHaveBeenCalled();
    expect(saved).toBe('saved-product');
    expect(deleted).toBe('deleted');
  });

  test('TC-51 findCategoriesByIds — Category.findAll với Op.in', async () => {
    const { repo, deps } = makeRepo();
    const cats = [{ id: 1 }, { id: 2 }];
    deps.Category.findAll.mockResolvedValue(cats);

    const result = await repo.findCategoriesByIds([1, 2]);

    expect(deps.Category.findAll).toHaveBeenCalledWith({ where: { id: { [Op.in]: [1, 2] } } });
    expect(result).toBe(cats);
  });

  test('TC-53 setProductCategories — product.setCategories với options', async () => {
    const { repo } = makeRepo();
    const product = { setCategories: jest.fn().mockResolvedValue() };
    const cats = [{ id: 1 }];

    await repo.setProductCategories(product, cats, { transaction: 'tx' });

    expect(product.setCategories).toHaveBeenCalledWith(cats, { transaction: 'tx' });
  });

  test('TC-54 createProductSpecifications — ProductSpecification.bulkCreate', async () => {
    const { repo, deps } = makeRepo();
    const rows = [{ productId: 1, name: 'RAM', value: '8GB' }];
    deps.ProductSpecification.bulkCreate.mockResolvedValue(rows);

    const result = await repo.createProductSpecifications(rows, { transaction: 'tx' });

    expect(deps.ProductSpecification.bulkCreate).toHaveBeenCalledWith(rows, { transaction: 'tx' });
    expect(result).toBe(rows);
  });

  test('TC-55 clearProductAttributes / createProductAttributes — thứ tự đúng', async () => {
    const { repo, deps } = makeRepo();
    const attrs = [{ productId: 1, name: 'color', values: ['red'] }];

    await repo.clearProductAttributes(1, { transaction: 'tx' });
    await repo.createProductAttributes(attrs, { transaction: 'tx' });

    expect(deps.ProductAttribute.destroy).toHaveBeenCalledWith({
      where: { productId: 1 },
      transaction: 'tx',
    });
    expect(deps.ProductAttribute.bulkCreate).toHaveBeenCalledWith(attrs, { transaction: 'tx' });
  });

  test('TC-56 clearProductVariants / createProductVariants', async () => {
    const { repo, deps } = makeRepo();
    const variants = [{ productId: 1, sku: 'SKU-RED', stockQuantity: 5 }];

    await repo.clearProductVariants(1, { transaction: 'tx' });
    await repo.createProductVariants(variants, { transaction: 'tx' });

    expect(deps.ProductVariant.destroy).toHaveBeenCalledWith({
      where: { productId: 1 },
      transaction: 'tx',
    });
    expect(deps.ProductVariant.bulkCreate).toHaveBeenCalledWith(variants, { transaction: 'tx' });
  });

  test('TC-57 runInTransaction — gọi work với transaction object', async () => {
    const { repo, sequelize } = makeRepo();
    const work = jest.fn().mockResolvedValue('done');

    const result = await repo.runInTransaction(work);

    expect(sequelize.transaction).toHaveBeenCalledWith(work);
    expect(result).toBe('done');
  });
});

describe('Recently viewed', () => {
  test('TC-58 findRecentlyViewedByUser — findAll với userId và limit', async () => {
    const { repo, deps } = makeRepo();
    const rows = [{ id: 1, productId: 5 }];
    deps.RecentlyViewed.findAll.mockResolvedValue(rows);

    const result = await repo.findRecentlyViewedByUser(42, 5);

    expect(deps.RecentlyViewed.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 42 },
        limit: 5,
        order: [['viewedAt', 'DESC']],
      }),
    );
    expect(result).toBe(rows);
  });

  test('TC-59 upsertRecentlyViewed — RecentlyViewed.upsert với viewedAt', async () => {
    const { repo, deps } = makeRepo();

    await repo.upsertRecentlyViewed(10, 20);

    expect(deps.RecentlyViewed.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 10, productId: 20 }),
    );
  });

  test('TC-60 pruneRecentlyViewed — destroy stale records khi có stale', async () => {
    const { repo, deps } = makeRepo();
    deps.RecentlyViewed.findAll.mockResolvedValue([{ id: 5 }, { id: 6 }]);

    await repo.pruneRecentlyViewed(1, 3);

    expect(deps.RecentlyViewed.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 1 },
        offset: 3,
      }),
    );
    expect(deps.RecentlyViewed.destroy).toHaveBeenCalledWith({
      where: { id: [5, 6] },
    });
  });

  test('TC-60b pruneRecentlyViewed — không có stale → KHÔNG gọi destroy', async () => {
    const { repo, deps } = makeRepo();
    deps.RecentlyViewed.findAll.mockResolvedValue([]);

    await repo.pruneRecentlyViewed(1, 10);

    expect(deps.RecentlyViewed.destroy).not.toHaveBeenCalled();
  });
});

describe('Edge cases', () => {
  test('TC-61 findProductVariantsByProductId — throw khi ProductVariant model không có', async () => {
    const { repo } = makeRepo({ ProductVariant: null });

    await expect(repo.findProductVariantsByProductId(1)).rejects.toThrow(
      'ProductVariant model bắt buộc trong constructor',
    );
  });

  test('TC-62 findProductRatingsRows — throw khi Review model không có', async () => {
    const { repo } = makeRepo({ Review: null });

    await expect(repo.findProductRatingsRows(1)).rejects.toThrow(
      'Review model bắt buộc trong constructor',
    );
  });

  test('TC-64 getProductPriceRange — trả min/max đã parse float', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ min: '100.50', max: '999.99' }]);

    const result = await repo.getProductPriceRange({});

    expect(result).toEqual({ min: 100.5, max: 999.99 });
  });

  test('TC-64b getProductPriceRange — kết quả rỗng → min/max = 0', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{}]);

    const result = await repo.getProductPriceRange({});

    expect(result).toEqual({ min: 0, max: 0 });
  });

  test('TC-65 findBrandIdsByCategoryId — lọc falsy brandId', async () => {
    const seq = makeSequelize();
    seq.fn.mockReturnValue({});
    seq.col.mockReturnValue({});
    const { repo, deps } = makeRepo({}, seq);
    deps.Product.findAll.mockResolvedValue([
      { brandId: 1 },
      { brandId: null },
      { brandId: 2 },
      { brandId: undefined },
    ]);

    const result = await repo.findBrandIdsByCategoryId(5);

    expect(result).toEqual([1, 2]);
  });

  test('TC-66 findProductsByCategoryId — truyền status filter và sort options', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAndCountAll.mockResolvedValue({ count: 1, rows: [] });

    await repo.findProductsByCategoryId(3, {
      status: 'active',
      sort: 'basePrice',
      order: 'ASC',
      limit: 5,
      offset: 0,
    });

    const call = deps.Product.findAndCountAll.mock.calls[0][0];
    expect(call.where).toEqual({ categoryId: 3, status: 'active' });
    expect(call.order).toEqual([['basePrice', 'ASC']]);
    expect(call.limit).toBe(5);
    expect(call.distinct).toBe(true);
  });

  test('TC-67 findDeals — sort discount_desc → literal ORDER BY', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__discount_expr__');
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findDeals({ minDiscount: 10, sort: 'discount_desc', limit: 5 });

    const call = deps.Product.findAll.mock.calls[0][0];
    // subQuery phải false
    expect(call.subQuery).toBe(false);
    expect(call.limit).toBe(5);
    expect(call.where.status).toBe('active');
    expect(call.where.compareAtPrice[Op.ne]).toBeNull();
  });

  test('TC-67b findDeals — sort price_asc → [[basePrice, ASC]]', async () => {
    const { repo, deps, sequelize } = makeRepo();
    sequelize.literal.mockReturnValue('__expr__');
    deps.Product.findAll.mockResolvedValue([]);

    await repo.findDeals({ minDiscount: 5, sort: 'price_asc', limit: 3 });

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.order).toEqual([['basePrice', 'ASC']]);
  });

  test('TC-68 findAttributeValuesByName — throw khi ProductAttribute không có', async () => {
    const { repo } = makeRepo({ ProductAttribute: null });

    await expect(repo.findAttributeValuesByName('color')).rejects.toThrow(
      'ProductAttribute model bắt buộc trong constructor',
    );
  });

  test('TC-69 findOtherAttributes — throw khi ProductAttribute không có', async () => {
    const { repo } = makeRepo({ ProductAttribute: null });

    await expect(repo.findOtherAttributes({})).rejects.toThrow(
      'ProductAttribute model bắt buộc trong constructor',
    );
  });

  test('TC-70 findRelatedProductsFallback — where status active + order isFeatured DESC', async () => {
    const { repo, deps } = makeRepo();
    deps.Product.findAll.mockResolvedValue([{ id: 2 }]);

    await repo.findRelatedProductsFallback(1, 4);

    const call = deps.Product.findAll.mock.calls[0][0];
    expect(call.where).toMatchObject({ status: 'active' });
    expect(call.where.id[Op.ne]).toBe(1);
    expect(call.order).toEqual([
      ['isFeatured', 'DESC'],
      ['createdAt', 'DESC'],
    ]);
    expect(call.limit).toBe(4);
  });
});
