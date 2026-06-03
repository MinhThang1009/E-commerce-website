/**
 * catalog-service.mutation-kill-2.test.js
 * Vòng 2: kill thêm survivors từ lần chạy mutation test thứ 2.
 */
const CatalogService = require('./catalog-service');

function makeProductRow(overrides = {}) {
  const data = {
    id: 1,
    name: 'Product',
    slug: 'product',
    status: 'active',
    basePrice: '10000000',
    compareAtPrice: null,
    stockQuantity: 10,
    isFeatured: false,
    productImages: [],
    variants: [],
    categories: [],
    reviews: [],
    ...overrides,
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

function makeService(repoOverrides = {}) {
  const catalogRepository = {
    findAllCategoriesSorted: jest.fn().mockResolvedValue([]),
    getCategoryProductCounts: jest.fn().mockResolvedValue({}),
    findCategoryById: jest.fn().mockResolvedValue(null),
    findCategoryByIdOrSlug: jest.fn().mockResolvedValue(null),
    findCategoryBySlug: jest.fn().mockResolvedValue(null),
    createCategory: jest.fn().mockResolvedValue({ id: 1 }),
    saveCategory: jest.fn().mockResolvedValue(),
    deleteCategory: jest.fn().mockResolvedValue(),
    countProductsByCategoryId: jest.fn().mockResolvedValue(0),
    findProductsByCategoryId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findAllBrands: jest.fn().mockResolvedValue([]),
    findBrandIdsByCategoryId: jest.fn().mockResolvedValue([]),
    findBrandById: jest.fn().mockResolvedValue(null),
    findBrandBySlug: jest.fn().mockResolvedValue(null),
    createBrand: jest.fn().mockResolvedValue({ id: 1 }),
    saveBrand: jest.fn().mockResolvedValue(),
    deleteBrand: jest.fn().mockResolvedValue(),
    countProductsByBrandId: jest.fn().mockResolvedValue(0),
    findProductsByBrandId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductsList: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductByIdWithFullDetails: jest.fn().mockResolvedValue(null),
    findProductBySlugWithFullDetails: jest.fn().mockResolvedValue(null),
    findProductByPk: jest.fn().mockResolvedValue(null),
    findProductByName: jest.fn().mockResolvedValue(null),
    findProductBySlug: jest.fn().mockResolvedValue(null),
    findFeaturedProducts: jest.fn().mockResolvedValue([]),
    findRelatedProducts: jest.fn().mockResolvedValue([]),
    findRelatedProductsFallback: jest.fn().mockResolvedValue([]),
    searchProducts: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductSuggestions: jest.fn().mockResolvedValue([]),
    findNewArrivals: jest.fn().mockResolvedValue([]),
    findBestSellersRaw: jest.fn().mockResolvedValue([]),
    findProductsByIdsOrdered: jest.fn().mockResolvedValue([]),
    findDeals: jest.fn().mockResolvedValue([]),
    findProductVariantsByProductId: jest.fn().mockResolvedValue([]),
    findProductRatingsRows: jest.fn().mockResolvedValue([]),
    getProductPriceRange: jest.fn().mockResolvedValue({ min: 0, max: 0 }),
    findAttributeValuesByName: jest.fn().mockResolvedValue([]),
    findOtherAttributes: jest.fn().mockResolvedValue([]),
    findRecentlyViewedByUser: jest.fn().mockResolvedValue([]),
    upsertRecentlyViewed: jest.fn().mockResolvedValue(),
    pruneRecentlyViewed: jest.fn().mockResolvedValue(),
    createProduct: jest.fn().mockResolvedValue({ id: 1 }),
    saveProduct: jest.fn().mockResolvedValue(),
    deleteProduct: jest.fn().mockResolvedValue(),
    findCategoriesByIds: jest.fn().mockResolvedValue([]),
    setProductCategories: jest.fn().mockResolvedValue(),
    createProductSpecifications: jest.fn().mockResolvedValue(),
    createProductAttributes: jest.fn().mockResolvedValue(),
    clearProductAttributes: jest.fn().mockResolvedValue(),
    createProductVariants: jest.fn().mockResolvedValue([]),
    clearProductVariants: jest.fn().mockResolvedValue(),
    clearProductImages: jest.fn().mockResolvedValue(),
    createProductImages: jest.fn().mockResolvedValue(),
    runInTransaction: jest.fn((fn) => fn({})),
    ...repoOverrides,
  };
  const service = new CatalogService({
    catalogRepository,
    eventBus: { publish: jest.fn() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });
  return { service, catalogRepository };
}

// ═══════════════════════════════════════════════════════════════════════════
// updateCategory — `if (patch.X !== undefined)` survivors (L58-61)
// Kill: test khi patch không có field → field KHÔNG bị thay đổi
// ═══════════════════════════════════════════════════════════════════════════

describe('updateCategory — chỉ cập nhật field được cung cấp trong patch', () => {
  it('patch không có image → category.image giữ nguyên (L58 !== undefined check)', async () => {
    const { service, catalogRepository } = makeService();
    const cat = {
      id: 1,
      name: 'Cat',
      image: 'old-image.jpg',
      parentId: null,
      isActive: true,
      sortOrder: 0,
    };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 1, patch: { name: 'New Name' } });

    // image phải giữ nguyên 'old-image.jpg' không bị set thành undefined
    expect(cat.image).toBe('old-image.jpg');
  });

  it('patch không có parentId → category.parentId giữ nguyên (L59)', async () => {
    const { service, catalogRepository } = makeService();
    const cat = { id: 1, name: 'Cat', image: null, parentId: 5, isActive: true, sortOrder: 0 };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 1, patch: { name: 'Updated' } });

    expect(cat.parentId).toBe(5);
  });

  it('patch không có isActive → category.isActive giữ nguyên (L60)', async () => {
    const { service, catalogRepository } = makeService();
    const cat = { id: 1, name: 'Cat', image: null, parentId: null, isActive: false, sortOrder: 0 };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 1, patch: { name: 'Updated' } });

    expect(cat.isActive).toBe(false);
  });

  it('patch không có sortOrder → category.sortOrder giữ nguyên (L61)', async () => {
    const { service, catalogRepository } = makeService();
    const cat = { id: 1, name: 'Cat', image: null, parentId: null, isActive: true, sortOrder: 10 };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 1, patch: { name: 'Updated' } });

    expect(cat.sortOrder).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _calcRatings — reviews.length === 0 check (L41)
// Kill: reviews.length === 0 mutated to false → `if (!reviews || false)`
// Test: reviews=[] → `!reviews=false`, `false=false` → doesn't return early → NaN
// ═══════════════════════════════════════════════════════════════════════════

describe('_calcRatings — empty array check (L41: reviews.length === 0)', () => {
  it('reviews = [] → trả về {average:0, count:0} (L41: length === 0 guard)', () => {
    const { service } = makeService();
    const result = service._calcRatings([]);
    // Nếu mutant `false` thì [] không early return → tính average của rỗng = NaN
    expect(result).toEqual({ average: 0, count: 0 });
    expect(typeof result.average).toBe('number');
    expect(isNaN(result.average)).toBe(false);
  });

  it('reviews có đúng 1 phần tử → tính đúng (length !== 0, không early return)', () => {
    const { service } = makeService();
    const result = service._calcRatings([{ rating: 4 }]);
    expect(result.average).toBe(4.0);
    expect(result.count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — onlyVerified: true (L81:65)
// Kill: { onlyVerified: true } → { onlyVerified: false }
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — ratings.average dùng onlyVerified=true (L81)', () => {
  it('ratings.average chỉ tính từ verified reviews (onlyVerified=true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [
        { rating: 5, isVerified: true },
        { rating: 1, isVerified: false }, // không được tính
        { rating: 3, isVerified: true },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    // Nếu onlyVerified=false: (5+1+3)/3 = 3.0
    // Nếu onlyVerified=true:  (5+3)/2   = 4.0
    expect(result.ratings.average).toBe(4.0);
  });

  it('ratings.totalCount = tổng tất cả reviews (kể cả unverified)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [
        { rating: 5, isVerified: true },
        { rating: 2, isVerified: false },
        { rating: 4, isVerified: true },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.ratings.totalCount).toBe(3); // kể cả unverified
    expect(result.ratings.count).toBe(2); // chỉ verified
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — skuId conditional (L96, L97)
// Kill: L96 `if (skuId)` → `if (true)`, L97 `find((v) => true)`
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — skuId selection (L96, L97)', () => {
  it('skuId = null → không tìm theo skuId, dùng variant default (L96: if(skuId) false branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 10,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'First',
          isDefault: false,
          attributes: {},
          sku: 'SKU-10',
          specifications: {},
        },
        {
          id: 11,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Default',
          isDefault: true,
          attributes: {},
          sku: 'SKU-11',
          specifications: {},
        },
      ],
    });
    // skuId = null → không tìm theo id → chọn isDefault = true (variant id=11)
    const result = service._buildProductDetailResponse(product, { skuId: null });
    expect(result.sku).toBe('SKU-11'); // default variant
  });

  it('skuId = "10" → chọn đúng variant có id=10 (L97 find)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 10,
          price: '15000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Variant 10',
          isDefault: false,
          attributes: {},
          sku: 'SKU-10',
          specifications: {},
        },
        {
          id: 11,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Variant 11',
          isDefault: true,
          attributes: {},
          sku: 'SKU-11',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { skuId: '10' });
    expect(result.sku).toBe('SKU-10'); // phải là variant 10
  });

  it('skuId không tìm thấy → fallback về variant isDefault (L97 find falsy result)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 10,
          price: '15000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V10',
          isDefault: false,
          attributes: {},
          sku: 'SKU-10',
          specifications: {},
        },
        {
          id: 11,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'V11',
          isDefault: true,
          attributes: {},
          sku: 'SKU-11',
          specifications: {},
        },
      ],
    });
    // skuId=99 không có variant nào → selectedVariant = undefined → normColor = null → fallback isDefault
    const result = service._buildProductDetailResponse(product, { skuId: '99' });
    expect(result.sku).toBe('SKU-11');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — v.isDefault === 1 (L109)
// Kill: `v.isDefault === 1` → `false`
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — isDefault = 1 (integer) (L109)', () => {
  it('isDefault = 1 (số nguyên) → được coi là default variant (L109)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 10,
          price: '15000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V10',
          isDefault: 0,
          attributes: {},
          sku: 'SKU-10',
          specifications: {},
        },
        {
          id: 11,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'V11',
          isDefault: 1,
          attributes: {},
          sku: 'SKU-11',
          specifications: {},
        }, // isDefault = 1
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.sku).toBe('SKU-11'); // isDefault = 1 phải được chọn
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// String defaults (L63, L83-85, L195-196)
// Kill: sort = "" thay vì 'createdAt', order = "" thay vì 'DESC'
// ═══════════════════════════════════════════════════════════════════════════

describe('getProductsByBrand — default sort và order (L63)', () => {
  it('sort mặc định = "createdAt" khi không truyền (L63 StringLiteral)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandBySlug.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 0, rows: [] });

    await service.getProductsByBrand({ slug: 'brand' });

    expect(catalogRepository.findProductsByBrandId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ sort: 'createdAt' }),
    );
  });

  it('order mặc định = "DESC" khi không truyền (L63 StringLiteral)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandBySlug.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 0, rows: [] });

    await service.getProductsByBrand({ slug: 'brand' });

    expect(catalogRepository.findProductsByBrandId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ order: 'DESC' }),
    );
  });
});

describe('getProductsByCategory — default sort, order, status (L83-85)', () => {
  it('sort mặc định = "createdAt" khi không truyền (L83)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 0, rows: [] });

    await service.getProductsByCategory({ id: 1 });

    expect(catalogRepository.findProductsByCategoryId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ sort: 'createdAt' }),
    );
  });

  it('order mặc định = "DESC" khi không truyền (L84)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 0, rows: [] });

    await service.getProductsByCategory({ id: 1 });

    expect(catalogRepository.findProductsByCategoryId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ order: 'DESC' }),
    );
  });

  it('status mặc định = "active" khi không truyền (L85)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 0, rows: [] });

    await service.getProductsByCategory({ id: 1 });

    expect(catalogRepository.findProductsByCategoryId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ status: 'active' }),
    );
  });
});

describe('getAllProducts — default sort và order (L195, L196)', () => {
  it('sort mặc định = "createdAt" khi không truyền (L195)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'createdAt' }),
    );
  });

  it('order mặc định = "DESC" khi không truyền (L196)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ order: 'DESC' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MethodExpression .trim() survivors
// L93: queryColor?.toString().normalize('NFC').toLowerCase() → missing .trim()
// L103: vColorRaw?.toString().normalize('NFC').toLowerCase() → missing .trim()
// L116: variantColorRaw?.toString().normalize('NFC').toLowerCase() → missing .trim()
// Kill: test với queryColor có trailing spaces
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — .trim() trong color matching (L93, L103, L116)', () => {
  it('queryColor có trailing spaces vẫn match variant (L93: normalize+toLowerCase+trim)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 10,
          price: '15000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen',
          isDefault: false,
          attributes: { color: 'đen' },
          sku: 'SKU-10',
          specifications: {},
        },
        {
          id: 11,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Trắng',
          isDefault: true,
          attributes: { color: 'trắng' },
          sku: 'SKU-11',
          specifications: {},
        },
      ],
    });
    // queryColor có trailing space → .trim() sẽ xử lý
    const result = service._buildProductDetailResponse(product, { queryColor: ' đen ' });
    // Với .trim(): 'đen' match variant id=10
    // Không .trim(): ' đen ' ≠ 'đen' → không match → dùng default (id=11)
    expect(result.sku).toBe('SKU-10');
  });

  it('variant color có trailing spaces vẫn match queryColor (L103)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 20,
          price: '15000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Xanh',
          isDefault: false,
          attributes: { color: ' xanh ' }, // có spaces
          sku: 'SKU-20',
          specifications: {},
        },
        {
          id: 21,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Đỏ',
          isDefault: true,
          attributes: { color: 'đỏ' },
          sku: 'SKU-21',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { queryColor: 'xanh' });
    // variant color ' xanh '.trim() = 'xanh' → match
    expect(result.sku).toBe('SKU-20');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — if(!skuId && normColor) variantColor=normColor (L117)
// Kill: `false` → variantColor không bao giờ override
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — variantColor override (L117)', () => {
  it('không có skuId, có normColor → variantColor được override = normColor (L117 TRUE branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'red.jpg', isThumbnail: true, variantId: null, color: 'đỏ' },
        { id: 2, imageUrl: 'blue.jpg', isThumbnail: false, variantId: null, color: 'xanh' },
      ],
      variants: [
        {
          id: 30,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: true,
          attributes: { color: 'đỏ' },
          sku: 'SKU-30',
          specifications: {},
        },
      ],
    });
    // Không có skuId, queryColor='đỏ'
    // variantColor từ attrs = 'đỏ' → override với normColor 'đỏ'
    // matchByColor = [red.jpg]
    const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('red.jpg');
  });

  it('có skuId → variantColor KHÔNG override bởi normColor (L117 FALSE branch: !skuId=false)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'red.jpg', isThumbnail: true, variantId: null, color: 'đỏ' },
      ],
      variants: [
        {
          id: 30,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: true,
          attributes: { color: 'đỏ' },
          sku: 'SKU-30',
          specifications: {},
        },
      ],
    });
    // có skuId → !skuId = false → variantColor không override
    const result = service._buildProductDetailResponse(product, {
      skuId: '30',
      queryColor: 'xanh',
    });
    // Dù queryColor = 'xanh', nhưng variantColor = attrs.color = 'đỏ' → không override
    expect(result).toBeDefined();
    expect(result.sku).toBe('SKU-30');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — skuId + matchByVariantId (L120)
// Kill: `if (skuId && selectedVariant)` → `if (true && selectedVariant)`
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — image filtering khi không có skuId (L120)', () => {
  it('không có skuId → không lọc theo variantId (L120: skuId falsy → else if branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'img1.jpg', isThumbnail: true, variantId: 50, color: 'đen' },
        { id: 2, imageUrl: 'img2.jpg', isThumbnail: false, variantId: null, color: 'đen' },
      ],
      variants: [
        {
          id: 50,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen',
          isDefault: true,
          attributes: { color: 'đen' },
          sku: 'SKU-50',
          specifications: {},
        },
      ],
    });
    // Không có skuId → không vào if(skuId && selectedVariant) → vào else if variantColor
    const result = service._buildProductDetailResponse(product, { queryColor: 'đen' });
    // variantColor = 'đen', matchByColor = [img1, img2]
    expect(result.images).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — variantImages.length conditions (L125, L130, L134, L160, L161, L167-168)
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — variantImages length conditions (L125, L160)', () => {
  it('matchByVariantId không rỗng → variantImages = matchByVariantId (L125 true branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'v1.jpg', isThumbnail: true, variantId: 60, color: null },
        { id: 2, imageUrl: 'gen.jpg', isThumbnail: false, variantId: null, color: null },
      ],
      variants: [
        {
          id: 60,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V60',
          isDefault: true,
          attributes: {},
          sku: 'SKU-60',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { skuId: '60' });
    // matchByVariantId = [img với variantId=60] không rỗng → variantImages = [v1.jpg]
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('v1.jpg');
  });

  it('variantImages rỗng → images = productJson.images (L160 false → L161)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'gen.jpg', isThumbnail: true, variantId: null, color: null },
      ],
      variants: [
        {
          id: 70,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V70',
          isDefault: true,
          attributes: {},
          sku: 'SKU-70',
          specifications: {},
        },
      ],
    });
    // skuId=70, không có ảnh với variantId=70, không có color → variantImages = all images = [gen.jpg]
    const result = service._buildProductDetailResponse(product, { skuId: '70' });
    // Vì không match variantId và không có color → giữ nguyên productJson.images
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('gen.jpg');
    expect(result.thumbnail).toBe('gen.jpg');
  });

  it('thumbnail = variantImages[0].url khi variantImages không rỗng (L161 currentVariant)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'v-thumb.jpg', isThumbnail: true, variantId: 80, color: null },
        { id: 2, imageUrl: 'v-other.jpg', isThumbnail: false, variantId: 80, color: null },
      ],
      variants: [
        {
          id: 80,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V80',
          isDefault: true,
          attributes: {},
          sku: 'SKU-80',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { skuId: '80' });
    expect(result.thumbnail).toBe('v-thumb.jpg');
    expect(result.currentVariant.thumbnail).toBe('v-thumb.jpg');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// currentVariant.price + compareAtPrice (L169, L167, L168)
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — currentVariant price/compareAtPrice (L169, L157)', () => {
  it('currentVariant.price = selectedVariant.price (L169)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '15000',
          compareAtPrice: '20000',
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'SKU-1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.currentVariant.price).toBe('15000');
    expect(result.currentVariant.compareAtPrice).toBe('20000');
  });

  it('currentVariant.price fallback về productJson.basePrice khi price = null (L169 false)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: null,
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'SKU-1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.currentVariant.price).toBe('10000'); // fallback basePrice
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// specifications merge (L178)
// Kill: {} → không merge productJson.specifications với selectedVariant.attributes
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — specifications merge (L178)', () => {
  it('specifications = merge productJson.specs + selectedVariant.attributes (L178)', () => {
    const { service } = makeService();
    const product = {
      id: 1,
      name: 'P',
      slug: 'p',
      status: 'active',
      basePrice: '10000',
      compareAtPrice: null,
      stockQuantity: 5,
      isFeatured: false,
      productImages: [],
      categories: [],
      reviews: [],
      specifications: { CPU: 'A17 Pro', RAM: '8GB' },
      variants: [
        {
          id: 1,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          specifications: {},
          attributes: { color: 'đen', storage: '256GB' },
          sku: 'SKU-1',
        },
      ],
      toJSON() {
        const { toJSON, ...rest } = this;
        return { ...rest };
      },
    };
    const result = service._buildProductDetailResponse(product, {});
    // specifications = { CPU, RAM, color, storage }
    expect(result.specifications).toMatchObject({
      CPU: 'A17 Pro',
      RAM: '8GB',
      color: 'đen',
      storage: '256GB',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// String defaults: getProductsByBrand, getAllProducts
// L63:65 sort='createdAt', L63:86 order='DESC', L195, L196
// Also: getProductSuggestions MAX_SUGGESTIONS=10
// ═══════════════════════════════════════════════════════════════════════════

describe('getProductSuggestions — MAX_SUGGESTIONS = 10 (L371)', () => {
  it('truyền đúng MAX_SUGGESTIONS = 10 vào findProductSuggestions', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductSuggestions.mockResolvedValue([]);
    await service.getProductSuggestions({ q: 'phone' });
    expect(catalogRepository.findProductSuggestions).toHaveBeenCalledWith('phone', 10);
  });
});

describe('getBestSellers — findBestSellersRaw limit (L416)', () => {
  it('limit được truyền đúng (L416)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getBestSellers({ limit: 7 });

    expect(catalogRepository.findBestSellersRaw).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 7 }),
    );
  });
});

describe('getDeals — sort và limit truyền đến repository (L460, L468)', () => {
  it('sort default = "discount_desc" khi không truyền', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findDeals.mockResolvedValue([]);
    await service.getDeals({});
    expect(catalogRepository.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'discount_desc' }),
    );
  });

  it('limit default = 12 khi không truyền (L460 DEFAULT_DEALS_LIMIT)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findDeals.mockResolvedValue([]);
    await service.getDeals({});
    expect(catalogRepository.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12 }),
    );
  });

  it('sort tùy chỉnh được truyền đúng (L460)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findDeals.mockResolvedValue([]);
    await service.getDeals({ sort: 'price_asc' });
    expect(catalogRepository.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'price_asc' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAllProducts — default limit = 20 (L207 DEFAULT_PAGE_SIZE)
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllProducts — default limit (L207)', () => {
  it('limit mặc định = 20 khi không truyền (L207: DEFAULT_PAGE_SIZE)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _mapProductWithImages — variants conditions (L131, L133)
// ═══════════════════════════════════════════════════════════════════════════

describe('_mapProductWithImages — variant selection detail (L131, L133)', () => {
  it('variants rỗng → else branch → price = basePrice (L131 length > 0 = false)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({ id: 1, name: 'P', basePrice: '5000', productImages: [], variants: [] }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.price).toBe('5000');
  });

  it('fallback về variants[0] khi không có variant isDefault (L133)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '5000',
        productImages: [],
        variants: [
          { isDefault: false, price: '7000', compareAtPrice: null },
          { isDefault: false, price: '9000', compareAtPrice: null },
        ],
      }),
    };
    const result = service._mapProductWithImages(product);
    // variants[0] = 7000
    expect(result.price).toBe('7000');
  });

  it('defaultVariant?.price null → fallback về basePrice (L134 Optional Chaining)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '5000',
        productImages: [],
        variants: [{ isDefault: true, price: null, compareAtPrice: null }],
      }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.price).toBe('5000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getBestSellers — period = 'case year' string (L404 case 'year')
// ═══════════════════════════════════════════════════════════════════════════

describe('getBestSellers — period string không phải week cũng không phải year (L404)', () => {
  it('period = "xyz" → default case (month) → startDate khoảng 30 ngày trước', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = Date.now();
    await service.getBestSellers({ limit: 5, period: 'xyz' });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const diffMs = before - callArgs.startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(20);
    expect(diffDays).toBeLessThan(45);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateProduct — setIfPresent 'featured' → 'isFeatured' (L677)
// Nhiều StringLiteral survivors ở L680-L693
// ═══════════════════════════════════════════════════════════════════════════

describe('updateProduct — setIfPresent các field (L680-L693)', () => {
  it('patch.description → product.description được cập nhật (L680)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, description: 'Old' });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({ id: 1, patch: { description: 'New Desc' } });

    expect(product.description).toBe('New Desc');
  });

  it('patch.status → product.status được cập nhật (L686)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, status: 'active' });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({ id: 1, patch: { status: 'inactive' } });

    expect(product.status).toBe('inactive');
  });

  it('patch.tags → product.tags được cập nhật (L690)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, tags: [] });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({ id: 1, patch: { tags: ['new', 'tag'] } });

    expect(product.tags).toEqual(['new', 'tag']);
  });

  it('không cập nhật field không có trong patch (setIfPresent false branch)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, stockQuantity: 100 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    // Chỉ truyền name, không truyền stockQuantity
    await service.updateProduct({ id: 1, patch: { name: 'New Name' } });

    expect(product.stockQuantity).toBe(100); // không thay đổi
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateProduct — hasOwnProperty check (L705, L713, L726)
// Kill: `if (true)` → luôn chạy clear/create kể cả khi patch không có field
// ═══════════════════════════════════════════════════════════════════════════

describe('updateProduct — hasOwnProperty guards (L705, L713, L726)', () => {
  it('patch không có attributes → không gọi clearProductAttributes (L705)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({ id: 1, patch: { name: 'X' } });

    expect(catalogRepository.clearProductAttributes).not.toHaveBeenCalled();
  });

  it('patch không có images → không gọi clearProductImages (L713)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({ id: 1, patch: { name: 'X' } });

    expect(catalogRepository.clearProductImages).not.toHaveBeenCalled();
  });

  it('patch không có variants → không gọi clearProductVariants (L726)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({ id: 1, patch: { name: 'X' } });

    expect(catalogRepository.clearProductVariants).not.toHaveBeenCalled();
  });

  it('patch.attributes = undefined (not in patch) → không gọi clearProductAttributes (L705)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 2 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    // Tường minh: patch có `attributes` key
    await service.updateProduct({ id: 2, patch: { attributes: [] } });

    expect(catalogRepository.clearProductAttributes).toHaveBeenCalledWith(2, expect.any(Object));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateProduct — isThumbnail: i === 0 (L719)
// Kill: `isThumbnail: true` instead of `i === 0`
// ═══════════════════════════════════════════════════════════════════════════

describe('updateProduct — images isThumbnail (L719)', () => {
  it('ảnh đầu tiên → isThumbnail=true, ảnh thứ 2 → isThumbnail=false (L719: i === 0)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({
      id: 1,
      patch: { images: ['img1.jpg', 'img2.jpg', 'img3.jpg'] },
    });

    const imageRows = catalogRepository.createProductImages.mock.calls[0][0];
    expect(imageRows[0].isThumbnail).toBe(true);
    expect(imageRows[1].isThumbnail).toBe(false);
    expect(imageRows[2].isThumbnail).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateProduct — variants rows arrow function (L730)
// Kill: `() => undefined` thay vì spread variant
// ═══════════════════════════════════════════════════════════════════════════

describe('updateProduct — variants map arrow function (L730)', () => {
  it('variant rows chứa đúng sku, price, productId từ patch.variants (L730)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1 });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await service.updateProduct({
      id: 1,
      patch: { variants: [{ sku: 'NEW-V1', price: 15000, stockQuantity: 3 }] },
    });

    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sku: 'NEW-V1', productId: 1, images: undefined }),
      ]),
      expect.any(Object),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getRecentlyViewed — limit parsed correctly
// ═══════════════════════════════════════════════════════════════════════════

describe('getRecentlyViewed — limit truyền đúng', () => {
  it('truyền parseInt(limit) = 5 đến repository', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findRecentlyViewedByUser.mockResolvedValue([]);

    await service.getRecentlyViewed({ userId: 1, limit: 5 });

    expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(1, 5);
  });

  it('truyền parseInt(limit) = 10 (mặc định)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findRecentlyViewedByUser.mockResolvedValue([]);

    await service.getRecentlyViewed({ userId: 1 });

    expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(1, 10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getFeaturedProducts — _mapProductForList
// ═══════════════════════════════════════════════════════════════════════════

describe('getFeaturedProducts — map qua _mapProductForList', () => {
  it('trả về products đã được map (ratings, price, compareAtPrice)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      compareAtPrice: '15000',
      reviews: [{ rating: 4 }, { rating: 5 }],
    });
    catalogRepository.findFeaturedProducts.mockResolvedValue([product]);

    const result = await service.getFeaturedProducts({ limit: 5 });

    expect(result).toHaveLength(1);
    expect(result[0].ratings).toBeDefined();
    expect(result[0].ratings.average).toBe(4.5);
    expect(result[0].compareAtPrice).toBe(15000);
  });

  it('gọi findFeaturedProducts với parseInt(limit) đúng', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findFeaturedProducts.mockResolvedValue([]);

    await service.getFeaturedProducts({ limit: 6 });

    expect(catalogRepository.findFeaturedProducts).toHaveBeenCalledWith(6);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getNewArrivals — limit tùy chỉnh
// ═══════════════════════════════════════════════════════════════════════════

describe('getNewArrivals — truyền limit tùy chỉnh', () => {
  it('gọi findNewArrivals với parseInt(limit) = 4', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getNewArrivals({ limit: 4 });

    expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(4);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createProduct — variant compareAtPrice = null vs value (L631)
// ═══════════════════════════════════════════════════════════════════════════

describe('createProduct — variant compareAtPrice (L631)', () => {
  it('v.compareAtPrice = null → null trong row (L631 false branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: { name: 'P', variants: [{ sku: 'V1', price: 5000, compareAtPrice: null }] },
    });

    const variantsArg = catalogRepository.createProductVariants.mock.calls[0][0];
    expect(variantsArg[0].compareAtPrice).toBeNull();
  });

  it('v.compareAtPrice = 10000 → parseFloat(10000) trong row (L631 true branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: { name: 'P', variants: [{ sku: 'V1', price: 5000, compareAtPrice: 10000 }] },
    });

    const variantsArg = catalogRepository.createProductVariants.mock.calls[0][0];
    expect(variantsArg[0].compareAtPrice).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getProductById/Slug — status check (L280, L297)
// ═══════════════════════════════════════════════════════════════════════════

describe('getProductBySlug — status active check (L297)', () => {
  it('status = "inactive" → throw 404 (L297)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, slug: 'p', status: 'inactive' });
    catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

    await expect(service.getProductBySlug({ slug: 'p' })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
      statusCode: 404,
    });
  });

  it('status = "active" → trả về data (L297)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, slug: 'p', status: 'active' });
    catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

    const result = await service.getProductBySlug({ slug: 'p' });
    expect(result.id).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _mapProductForList — compareAtPrice = null
// ═══════════════════════════════════════════════════════════════════════════

describe('_mapProductForList — compareAtPrice = null (L72 || null branch)', () => {
  it('compareAtPrice = null → trả về null (L72 false branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: null, reviews: [] });
    const result = service._mapProductForList(product);
    expect(result.compareAtPrice).toBeNull();
  });

  it('compareAtPrice = "0" → parseFloat("0") = 0, falsy → null', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: '0', reviews: [] });
    const result = service._mapProductForList(product);
    // parseFloat("0") = 0 → 0 || null = null (falsy)
    expect(result.compareAtPrice).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAllProducts — compareAtPrice = null (L258 || null)
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllProducts — compareAtPrice null (L258)', () => {
  it('compareAtPrice = null → null trong result (L258 || null)', async () => {
    const { service, catalogRepository } = makeService();
    const row = makeProductRow({ basePrice: '10000', compareAtPrice: null });
    catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

    const { payload } = await service.getAllProducts({ page: 1 });
    expect(payload.data[0].compareAtPrice).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getRecentlyViewed — compareAtPrice null (L538)
// ═══════════════════════════════════════════════════════════════════════════

describe('getRecentlyViewed — compareAtPrice null (L538)', () => {
  it('compareAtPrice = null → null (L538 || null)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({
      id: 1,
      basePrice: '10000',
      compareAtPrice: null,
      reviews: [],
    });
    catalogRepository.findRecentlyViewedByUser.mockResolvedValue([
      {
        viewedAt: new Date('2024-01-01'),
        Product: product,
      },
    ]);

    const result = await service.getRecentlyViewed({ userId: 1, limit: 10 });
    expect(result[0].compareAtPrice).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — compareAtPrice = null (L89)
// Kill: `null → null` (L89 false branch)
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — compareAtPrice = null → null (L89)', () => {
  it('compareAtPrice = null → response.compareAtPrice = null', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: null, reviews: [] });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.compareAtPrice).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createProduct — payload.specifications là Array (L584, L586)
// ═══════════════════════════════════════════════════════════════════════════

describe('createProduct — specifications Array check (L584, L586)', () => {
  it('specifications là Array không rỗng → gọi createProductSpecifications (L584 true)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        specifications: [{ name: 'CPU', value: 'A17' }],
      },
    });

    expect(catalogRepository.createProductSpecifications).toHaveBeenCalled();
  });

  it('specifications là {} (Object, không phải Array) → không gọi createProductSpecifications (L584 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 2 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    await service.createProduct({
      payload: { name: 'P2', specifications: { CPU: 'A17' } }, // Object, not Array
    });

    expect(catalogRepository.createProductSpecifications).not.toHaveBeenCalled();
  });

  it('specifications là Array rỗng → không gọi createProductSpecifications (L586: length > 0 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 3 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 3 }));

    await service.createProduct({
      payload: { name: 'P3', specifications: [] }, // empty Array
    });

    expect(catalogRepository.createProductSpecifications).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createProduct — parentAttributes length check (L598)
// ═══════════════════════════════════════════════════════════════════════════

describe('createProduct — parentAttributes (L598)', () => {
  it('parentAttributes không rỗng → gọi createProductAttributes (L598 true)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        parentAttributes: [{ name: 'Color', type: 'color', values: ['red'], required: false }],
      },
    });

    expect(catalogRepository.createProductAttributes).toHaveBeenCalled();
    const rows = catalogRepository.createProductAttributes.mock.calls[0][0];
    expect(rows[0].sortOrder).toBe(0);
    expect(rows[0].name).toBe('Color');
  });

  it('parentAttributes rỗng → không gọi createProductAttributes (L598 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 2 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    await service.createProduct({ payload: { name: 'P2', parentAttributes: [] } });

    // parentAttributes.length > 0 = false → không gọi
    expect(catalogRepository.createProductAttributes).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// createProduct — images length check (L615)
// ═══════════════════════════════════════════════════════════════════════════

describe('createProduct — images length check (L615)', () => {
  it('images không rỗng → gọi createProductImages (L615 true)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', images: ['img.jpg'] } });

    expect(catalogRepository.createProductImages).toHaveBeenCalled();
  });

  it('images rỗng → không gọi createProductImages (L615 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 2 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    await service.createProduct({ payload: { name: 'P2', images: [] } });

    expect(catalogRepository.createProductImages).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// isDefault = i === 0 (L633: i !== 0 mutant)
// Kill: test với i !== 0 nhưng isDefault explicit true
// ═══════════════════════════════════════════════════════════════════════════

describe('createProduct — isDefault explicit (L633: i === 0 vs explicit)', () => {
  it('i=1, không có isDefault set → isDefault = false (L633: i === 0 = false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        variants: [
          { sku: 'V0', price: 5000 }, // i=0 → isDefault = true
          { sku: 'V1', price: 6000 }, // i=1, không có isDefault → false
        ],
      },
    });

    const variantsArg = catalogRepository.createProductVariants.mock.calls[0][0];
    expect(variantsArg[0].isDefault).toBe(true); // i=0 → true
    expect(variantsArg[1].isDefault).toBe(false); // i=1, no explicit → false
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAllBrands — categoryId '' edge case (L13)
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllBrands — isNumericId xử lý trim (L13 StringLiteral)', () => {
  it('categoryId là số với spaces " 5 " → isNumericId = true (String(x).trim() = "5" !== "")', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([]);
    catalogRepository.findAllBrands.mockResolvedValue([]);

    await service.getAllBrands({ categoryId: ' 5 ' });

    // " 5 " → !isNaN = true, trim = "5" !== "" → isNumericId = true → không gọi slug
    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
    expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalled();
  });

  it('categoryId " " (chỉ spaces) → isNumericId = false → gọi findCategoryBySlug (L13)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([]);
    catalogRepository.findAllBrands.mockResolvedValue([]);

    // " " → !isNaN(" ") = true, String(" ").trim() = "" === "" → isNumericId = false → slug lookup
    await service.getAllBrands({ categoryId: ' ' });

    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// attrs.color ?? attrs['Màu sắc'] ?? attrs['màu sắc'] — L115 StringLiteral
// Kill: attrs[""] thay vì attrs['màu sắc']
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — attrs màu sắc lowercase (L115)', () => {
  it('attrs["màu sắc"] (lowercase) match queryColor', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: false,
          // Dùng 'màu sắc' lowercase key
          attributes: { 'màu sắc': 'đỏ' },
          sku: 'SKU-1',
          specifications: {},
        },
        {
          id: 2,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Xanh',
          isDefault: true,
          attributes: { 'màu sắc': 'xanh' },
          sku: 'SKU-2',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });
    expect(result.sku).toBe('SKU-1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Regex survivors L142
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — regex modelName (L142 Regex survivors)', () => {
  it('tên bắt đầu bằng "Tai nghe " → regex strip prefix → modelName đúng (L142 Regex)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 1,
      name: 'Tai nghe Sony WH-1000XM5',
      basePrice: '8000000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '8000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Sony WH-1000XM5 Trắng',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    // variantName 'Sony WH-1000XM5 Trắng' chứa modelName 'Sony WH-1000XM5'
    expect(result.name).toBe('Sony WH-1000XM5 Trắng');
  });

  it('tên không bắt đầu bằng prefix đặc biệt → modelName = mainName → không strip (L142 Regex)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 2,
      name: 'Apple Watch Ultra',
      basePrice: '20000000',
      reviews: [],
      variants: [
        {
          id: 2,
          price: '20000000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: '49mm Titanium',
          isDefault: true,
          attributes: {},
          sku: 'S2',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    // modelName = 'Apple Watch Ultra' (không bị strip)
    // variantName '49mm Titanium' không chứa modelName
    expect(result.name).toBe('Apple Watch Ultra - 49mm Titanium');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Vòng 3 — kill survivors còn lại
// ═══════════════════════════════════════════════════════════════════════════

// ─── L331 BlockStatement: getRelatedProducts map (L331, L336) ─────────────

describe('getRelatedProducts — content của kết quả (L331, L336)', () => {
  it('mỗi sản phẩm liên quan có id, ratings, images (L331 BlockStatement)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5 });
    catalogRepository.findRelatedProducts.mockResolvedValue([
      makeProductRow({ id: 2, basePrice: '10000', reviews: [{ rating: 4 }] }),
    ]);

    const result = await service.getRelatedProducts({ id: 1, limit: 4 });

    expect(result[0]).toHaveProperty('id', 2);
    expect(result[0].ratings).toBeDefined();
    expect(result[0].ratings.average).toBe(4.0);
    expect(result[0].images).toBeDefined(); // mapped images
  });
});

// ─── L352 BlockStatement: searchProducts map ─────────────────────────────

describe('searchProducts — content của result (L352 BlockStatement)', () => {
  it('mỗi item trong data có id và price = basePrice (L352 BlockStatement)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.searchProducts.mockResolvedValue({
      count: 1,
      rows: [makeProductRow({ id: 5, basePrice: '20000', name: 'Product 5' })],
    });

    const result = await service.searchProducts({ q: 'product', page: 1, limit: 5 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toHaveProperty('id', 5);
    expect(result.data[0].name).toBe('Product 5');
  });
});

// ─── L422 BlockStatement: getBestSellers map ─────────────────────────────

describe('getBestSellers — content của kết quả (L422 BlockStatement)', () => {
  it('mỗi bestseller có id, name (L422 BlockStatement)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([{ id: 7 }]);
    catalogRepository.findProductsByIdsOrdered.mockResolvedValue([
      makeProductRow({ id: 7, name: 'BestSeller' }),
    ]);

    const result = await service.getBestSellers({ limit: 5 });

    expect(result[0]).toHaveProperty('id', 7);
    expect(result[0].name).toBe('BestSeller');
  });
});

// ─── L416 ObjectLiteral: getNewArrivals limit (L416) ─────────────────────

describe('getBestSellers — fallback getNewArrivals với limit đúng (L416)', () => {
  it('gọi findNewArrivals với limit=lim khi không có bestsellers (L416)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getBestSellers({ limit: 8, period: 'week' });

    expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(8);
  });
});

// ─── L369 q.trim() not called (MethodExpression survivor) ─────────────────

describe('getProductSuggestions — q.trim() length check (L369 MethodExpression)', () => {
  it('q = " " → không gọi findProductSuggestions (L369: trim length < 1)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductSuggestions({ q: ' ' });
    expect(catalogRepository.findProductSuggestions).not.toHaveBeenCalled();
  });

  it('q = "a" (1 char) → gọi findProductSuggestions (L369: trim length >= 1)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductSuggestions.mockResolvedValue([]);
    await service.getProductSuggestions({ q: 'a' });
    expect(catalogRepository.findProductSuggestions).toHaveBeenCalled();
  });
});

// ─── L397 StringLiteral period = "" default ──────────────────────────────

describe('getBestSellers — period default = "month" không phải "" (L397)', () => {
  it('không truyền period → dùng switch default case (month), không phải year/week (L397)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = Date.now();
    await service.getBestSellers({ limit: 5 });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const diffMs = before - callArgs.startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Default = month: khoảng 28-35 ngày
    // year: khoảng 365 ngày
    // "" không match case → default = month → 28-35 ngày
    expect(diffDays).toBeGreaterThan(25);
    expect(diffDays).toBeLessThan(40);
  });
});

// ─── L404 StringLiteral case "" (không hit year path) ────────────────────

describe('getBestSellers — case "year" phải hit setFullYear (L404)', () => {
  it('period = "year" → startDate gần 365 ngày trước (L404 case year)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = Date.now();
    await service.getBestSellers({ limit: 5, period: 'year' });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const diffMs = before - callArgs.startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Phải ~365 ngày, không phải 30 ngày (default month)
    expect(diffDays).toBeGreaterThan(300);
    expect(diffDays).toBeLessThan(400);
  });

  it('period = "" → không match case year → default (month) → ~30 ngày (L404 StringLiteral "")', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = Date.now();
    await service.getBestSellers({ limit: 5, period: '' });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const diffMs = before - callArgs.startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // "" không match case 'year' → default month → ~30 ngày
    expect(diffDays).toBeGreaterThan(25);
    expect(diffDays).toBeLessThan(40);
  });
});

// ─── L485/486 MethodExpression trim: categoryId với spaces ────────────────

describe('getProductFilters — categoryId với spaces (L485 trim)', () => {
  it('categoryId = " 5 " (spaces) → trim → "5" là số nguyên → parseInt(5) (L485)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductFilters({ categoryId: ' 5 ' });
    // " 5 ".trim() = "5" → /^\d+$/.test("5") = true → parseInt("5") = 5
    expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 5 });
  });

  it('categoryId = " dien-thoai " → trim → slug → findCategoryBySlug (L486)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    await service.getProductFilters({ categoryId: ' dien-thoai ' });
    // " dien-thoai ".trim() = "dien-thoai" → slug regex match
    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalled();
  });
});

// ─── L485 Regex `^\d$` (single digit only) vs `^\d+$` (multiple digits) ──

describe('getProductFilters — regex nhiều chữ số (L485 Regex)', () => {
  it('categoryId = "123" → isStrictInt = true (L485: /^\\d+$/ match 3 digits)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductFilters({ categoryId: '123' });
    // /^\d+$/ match "123" = true → parseInt(123)
    expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 123 });
    // Không gọi findCategoryBySlug
    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
  });
});

// ─── L548 isVariantProduct = Boolean(variants && true) ─────────────────────

describe('createProduct — isVariantProduct khi variants = [] (L548)', () => {
  it('variants = [] → isVariantProduct = false (L548: length > 0 false branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', price: 5000, variants: [] } });

    expect(catalogRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ isVariantProduct: false, basePrice: 5000 }),
      expect.any(Object),
    );
  });
});

// ─── L555 baseName logic ─────────────────────────────────────────────────

describe('createProduct — baseName field (L555)', () => {
  it('payload.baseName = "Base" → baseName = "Base" (L555: payload.baseName truthy)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: { name: 'Full Name', baseName: 'Base Name', price: 5000 },
    });

    expect(catalogRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ baseName: 'Base Name' }),
      expect.any(Object),
    );
  });

  it('payload.baseName không có → baseName = payload.name (L555: false branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 2 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    await service.createProduct({ payload: { name: 'Product Name', price: 5000 } });

    expect(catalogRepository.createProduct).toHaveBeenCalledWith(
      expect.objectContaining({ baseName: 'Product Name' }),
      expect.any(Object),
    );
  });
});

// ─── L584 LogicalOperator payload.specifications || Array.isArray ──────────

describe('createProduct — specifications || check (L584 LogicalOperator)', () => {
  it('specifications = null → không gọi createProductSpecifications (L584: null && Array.isArray = false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', specifications: null } });

    expect(catalogRepository.createProductSpecifications).not.toHaveBeenCalled();
  });

  it('specifications = "invalid" (string) → không gọi createProductSpecifications (L584: truthy but not Array)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 2 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    // specifications = "str" → truthy, but Array.isArray("str") = false
    // With original && logic: "str" && Array.isArray("str") = "str" && false = false
    // With mutant || logic: "str" || Array.isArray("str") = "str" (truthy) → enters if
    await service.createProduct({ payload: { name: 'P', specifications: 'not-array' } });

    // Original: không gọi
    expect(catalogRepository.createProductSpecifications).not.toHaveBeenCalled();
  });
});

// ─── L636 displayName field in variant ────────────────────────────────────

describe('createProduct — variant displayName field (L636)', () => {
  it('v.displayName truthy → displayName = v.displayName (L636 true branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        variants: [
          {
            sku: 'V1',
            price: 5000,
            displayName: 'My Display',
            name: 'My Name',
            variantName: 'My Variant',
          },
        ],
      },
    });

    const variantsArg = catalogRepository.createProductVariants.mock.calls[0][0];
    expect(variantsArg[0].displayName).toBe('My Display');
  });

  it('v.displayName falsy, v.name truthy → displayName = v.name (L636 false || true)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 2 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    await service.createProduct({
      payload: {
        name: 'P2',
        variants: [
          {
            sku: 'V2',
            price: 5000,
            displayName: null,
            name: 'Only Name',
            variantName: 'Variant Name',
          },
        ],
      },
    });

    const variantsArg = catalogRepository.createProductVariants.mock.calls[0][0];
    expect(variantsArg[0].displayName).toBe('Only Name');
  });

  it('v.displayName và v.name đều falsy → displayName = v.variantName (L636 false || false || true)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 3 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 3 }));

    await service.createProduct({
      payload: {
        name: 'P3',
        variants: [
          { sku: 'V3', price: 5000, displayName: null, name: null, variantName: 'Variant Only' },
        ],
      },
    });

    const variantsArg = catalogRepository.createProductVariants.mock.calls[0][0];
    expect(variantsArg[0].displayName).toBe('Variant Only');
  });
});

// ─── L213 category isNumericId với spaces ────────────────────────────────

describe('getAllProducts — category isNumericId check (L213)', () => {
  it('category = " " (spaces only) → isNumericId = false → gọi findCategoryBySlug (L213)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ category: ' ' });

    // " ".trim() = "" → isNumericId = false → gọi findCategoryBySlug
    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith(' ');
  });

  it('category = " 5 " (spaces around number) → isNumericId = true → không gọi slug (L213)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ category: ' 5 ' });

    // " 5 ".trim() = "5" !== "" → isNumericId = true
    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
  });
});

// ─── L229/L230 brand filter với spaces ───────────────────────────────────

describe('getAllProducts — brand filter với khoảng trắng (L229, L230)', () => {
  it('brand = " " (spaces) → isNaN = true, trim = "" → không vào brandIds (L229)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ brand: ' ' });

    // " " → !isNaN(" ") = true, " ".trim() = "" === "" → isNaN = true (NaN check fails) → slug
    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ brandSlugsIn: [' '] }),
      }),
    );
  });

  it('brand = "5 " (trailing space) → trim = "5" → brandIdsIn (L229)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ brand: '5 ' });

    // "5 ".trim() = "5" !== "" && !isNaN("5 ") = true → brandIds includes "5 "
    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ brandIdsIn: ['5 '] }),
      }),
    );
  });
});

// ─── L224 `if (categoryId !== undefined)` → `if (true)` ─────────────────

describe('getAllProducts — categoryId = undefined → không set filter.categoryId (L224)', () => {
  it('không có category → categoryId = undefined → không set filter.categoryId (L224)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    const call = catalogRepository.findProductsList.mock.calls[0][0];
    expect(call.filter).not.toHaveProperty('categoryId');
  });
});

// ─── L227 `if (brand)` → `if (true)` ─────────────────────────────────────

describe('getAllProducts — brand = undefined → không set brandFilter (L227)', () => {
  it('không có brand → không set brandIdsIn/brandSlugsIn (L227)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    const call = catalogRepository.findProductsList.mock.calls[0][0];
    expect(call.filter).not.toHaveProperty('brandIdsIn');
    expect(call.filter).not.toHaveProperty('brandSlugsIn');
  });
});

// ─── L299 ObjectLiteral: getProductById forward skuId/queryColor ──────────

describe('getProductById — forward skuId và queryColor đúng (L299)', () => {
  it('truyền skuId và queryColor cho _buildProductDetailResponse (L299)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    const result = await service.getProductById({ id: 1, skuId: 10, queryColor: 'đen' });

    // Dù không có variants, response vẫn valid
    expect(result.payload.data).toBeDefined();
    expect(result.payload.data.id).toBe(1);
  });
});

// ─── L375 ArrowFunction: suggestion thumbnail from isThumbnail ────────────

describe('getProductSuggestions — thumbnail từ isThumbnail (L375 ArrowFunction)', () => {
  it('productImages có ảnh isThumbnail → dùng ảnh đó làm thumbnail (L375)', async () => {
    const { service, catalogRepository } = makeService();
    const mockProduct = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        slug: 'p',
        productImages: [
          { isThumbnail: false, imageUrl: 'not-thumb.jpg' },
          { isThumbnail: true, imageUrl: 'thumb.jpg' },
        ],
      }),
    };
    catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

    const result = await service.getProductSuggestions({ q: 'test' });

    expect(result[0].thumbnail).toBe('thumb.jpg');
  });

  it('productImages không có isThumbnail → dùng phần tử đầu (L375 fallback [0])', async () => {
    const { service, catalogRepository } = makeService();
    const mockProduct = {
      toJSON: () => ({
        id: 2,
        name: 'P2',
        slug: 'p2',
        productImages: [
          { isThumbnail: false, imageUrl: 'first.jpg' },
          { isThumbnail: false, imageUrl: 'second.jpg' },
        ],
      }),
    };
    catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

    const result = await service.getProductSuggestions({ q: 'test' });

    expect(result[0].thumbnail).toBe('first.jpg');
  });
});

// ─── L223 ObjectLiteral: getAllProducts filter object ─────────────────────

describe('getAllProducts — filter object truyền đúng fields (L223)', () => {
  it('filter chứa search, minPrice, maxPrice, inStock, featured, status khi có input (L223)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({
      search: 'phone',
      minPrice: 5000,
      maxPrice: 50000,
      inStock: true,
      featured: false,
      status: 'active',
    });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({
          search: 'phone',
          minPrice: 5000,
          maxPrice: 50000,
          inStock: true,
          featured: false,
          status: 'active',
        }),
      }),
    );
  });
});

// ─── L231/L232 brandIds/brandSlugs length check ──────────────────────────

describe('getAllProducts — brand filter length checks (L231, L232)', () => {
  it('brandIds rỗng → không set filter.brandIdsIn (L231: length > 0 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    // Chỉ có slug brand, không có numeric brand
    await service.getAllProducts({ brand: 'apple' });

    const call = catalogRepository.findProductsList.mock.calls[0][0];
    expect(call.filter).not.toHaveProperty('brandIdsIn');
    expect(call.filter).toHaveProperty('brandSlugsIn');
  });

  it('brandSlugs rỗng → không set filter.brandSlugsIn (L232: length > 0 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    // Chỉ có numeric brand
    await service.getAllProducts({ brand: '5' });

    const call = catalogRepository.findProductsList.mock.calls[0][0];
    expect(call.filter).toHaveProperty('brandIdsIn');
    expect(call.filter).not.toHaveProperty('brandSlugsIn');
  });
});

// ─── L625 payload.variants length check ──────────────────────────────────

describe('createProduct — không gọi createProductVariants khi variants = [] (L625)', () => {
  it('variants = [] → không gọi createProductVariants (L625 length > 0 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', variants: [] } });

    expect(catalogRepository.createProductVariants).not.toHaveBeenCalled();
  });
});

// ─── L575 payload.categoryIds length check ───────────────────────────────

describe('createProduct — không gọi findCategoriesByIds khi categoryIds = [] (L575)', () => {
  it('categoryIds = [] → không gọi findCategoriesByIds (L575 length > 0 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', categoryIds: [] } });

    expect(catalogRepository.findCategoriesByIds).not.toHaveBeenCalled();
  });
});

// ─── L610 payload.attributes length check ────────────────────────────────

describe('createProduct — không gọi createProductAttributes khi attributes = [] (L610)', () => {
  it('attributes = [] → không gọi createProductAttributes (L610 length > 0 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 1 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', attributes: [] } });

    expect(catalogRepository.createProductAttributes).not.toHaveBeenCalled();
  });
});

// ─── L160 variantImages.length check ────────────────────────────────────

describe('_buildProductDetailResponse — variantImages empty → fallback productJson.images (L160)', () => {
  it('variantImages rỗng → images = productJson.images, không rỗng → images = variantImages (L160)', () => {
    const { service } = makeService();
    // Case 1: variantImages không rỗng
    const product1 = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'v.jpg', isThumbnail: true, variantId: 10, color: null },
        { id: 2, imageUrl: 'gen.jpg', isThumbnail: false, variantId: null, color: null },
      ],
      variants: [
        {
          id: 10,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const r1 = service._buildProductDetailResponse(product1, { skuId: '10' });
    // variantImages = [v.jpg] (matched by variantId) → không rỗng → images = [v.jpg]
    expect(r1.images).toHaveLength(1);
    expect(r1.images[0].url).toBe('v.jpg');
  });

  it('thumbnail = variantImages[0].url khi không rỗng (L161)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'v-thumb.jpg', isThumbnail: true, variantId: 20, color: null },
      ],
      variants: [
        {
          id: 20,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { skuId: '20' });
    expect(result.thumbnail).toBe('v-thumb.jpg');
  });
});

// ─── L117 BooleanLiteral: `if (skuId && normColor)` ─────────────────────

describe('_buildProductDetailResponse — L117 BooleanLiteral skuId (L117)', () => {
  it('có skuId → variantColor KHÔNG override bởi normColor (L117: !skuId=false → skip)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'den.jpg', isThumbnail: true, variantId: null, color: 'đen' },
        { id: 2, imageUrl: 'xanh.jpg', isThumbnail: false, variantId: null, color: 'xanh' },
      ],
      variants: [
        {
          id: 10,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen',
          isDefault: true,
          attributes: { color: 'đen' },
          sku: 'SKU-10',
          specifications: {},
        },
      ],
    });
    // skuId='10', queryColor='xanh' → !skuId=false → không override variantColor = 'đen'
    // filter by color 'đen' → [den.jpg]
    const result = service._buildProductDetailResponse(product, {
      skuId: '10',
      queryColor: 'xanh',
    });
    // variantColor remains 'đen' (from attrs.color), filter → [den.jpg]
    expect(result.currentVariant.sku).toBe('SKU-10');
  });
});

// ─── L130 else if (variantColor) → else if (true) ─────────────────────────

describe('_buildProductDetailResponse — L130 else if variantColor (L130)', () => {
  it('variantColor = null → không filter by color (L130 false branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'img1.jpg', isThumbnail: true, variantId: null, color: null },
        { id: 2, imageUrl: 'img2.jpg', isThumbnail: false, variantId: null, color: null },
      ],
      variants: [
        {
          id: 10,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Variant',
          isDefault: true,
          attributes: {},
          sku: 'SKU-10',
          specifications: {},
        },
      ],
    });
    // Không có skuId, queryColor = null → normColor = undefined → variantColor = undefined
    // else if (variantColor) = false → không filter → giữ nguyên 2 ảnh
    const result = service._buildProductDetailResponse(product, {});
    expect(result.images).toHaveLength(2);
  });

  it('variantColor truthy → filter images by color (L130 true branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'red.jpg', isThumbnail: true, variantId: null, color: 'đỏ' },
        { id: 2, imageUrl: 'blue.jpg', isThumbnail: false, variantId: null, color: 'xanh' },
      ],
      variants: [
        {
          id: 20,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: true,
          attributes: { color: 'đỏ' },
          sku: 'SKU-20',
          specifications: {},
        },
      ],
    });
    // queryColor='đỏ' → normColor='đỏ' → variantColor='đỏ' (from attrs)
    // else if (variantColor) = true → filter → [red.jpg]
    const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('red.jpg');
  });
});

// ─── L134 matchByColor.length (L134) ─────────────────────────────────────

describe('_buildProductDetailResponse — matchByColor length check (L134)', () => {
  it('matchByColor không rỗng → variantImages = matchByColor (L134 true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'red.jpg', isThumbnail: true, variantId: null, color: 'đỏ' },
        { id: 2, imageUrl: 'blue.jpg', isThumbnail: false, variantId: null, color: 'xanh' },
      ],
      variants: [
        {
          id: 30,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: true,
          attributes: { color: 'đỏ' },
          sku: 'SKU-30',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });
    // matchByColor = [red.jpg] không rỗng → variantImages = [red.jpg] → images = [red.jpg]
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('red.jpg');
  });

  it('matchByColor rỗng → variantImages giữ nguyên productJson.images (L134 false)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'gen.jpg', isThumbnail: true, variantId: null, color: null },
      ],
      variants: [
        {
          id: 40,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Vàng',
          isDefault: true,
          attributes: { color: 'vàng' },
          sku: 'SKU-40',
          specifications: {},
        },
      ],
    });
    // queryColor='vàng' → filter images với color='vàng' → matchByColor=[] (no match, img color=null)
    // matchByColor.length > 0 = false → giữ nguyên productJson.images = [gen.jpg]
    const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('gen.jpg');
  });
});

// ─── L167/168 currentVariant images (L167, L168) ─────────────────────────

describe('_buildProductDetailResponse — currentVariant images (L167, L168)', () => {
  it('variantImages không rỗng → currentVariant.images = variantImages (L167 true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'v.jpg', isThumbnail: true, variantId: 50, color: null },
        { id: 2, imageUrl: 'gen.jpg', isThumbnail: false, variantId: null, color: null },
      ],
      variants: [
        {
          id: 50,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V',
          isDefault: true,
          attributes: {},
          sku: 'S',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { skuId: '50' });
    expect(result.currentVariant.images).toHaveLength(1);
    expect(result.currentVariant.images[0].url).toBe('v.jpg');
    expect(result.currentVariant.thumbnail).toBe('v.jpg');
  });

  it('variantImages rỗng → currentVariant.images = productJson.images (L167 false → L168)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'gen.jpg', isThumbnail: true, variantId: null, color: null },
      ],
      variants: [
        {
          id: 60,
          price: '10000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V',
          isDefault: true,
          attributes: {},
          sku: 'S',
          specifications: {},
        },
      ],
    });
    // skuId=60, không có ảnh với variantId=60, không có color → variantImages không được filter
    // variantImages = productJson.images (initial)
    const result = service._buildProductDetailResponse(product, { skuId: '60' });
    expect(result.currentVariant.images).toHaveLength(1);
    expect(result.currentVariant.thumbnail).toBe('gen.jpg');
  });
});

// ─── L146 MethodExpression: variantName.toUpperCase/mainName.toUpperCase ──

describe('_buildProductDetailResponse — fullName case-insensitive check (L146)', () => {
  it('variantName.toLowerCase() chứa mainName.toLowerCase() → fullName = variantName (L146)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 1,
      name: 'MacBook Pro',
      basePrice: '35000000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '35000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'MACBOOK PRO 16 M4',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    // 'macbook pro 16 m4'.includes('macbook pro') = true → fullName = variantName
    expect(result.name).toBe('MACBOOK PRO 16 M4');
  });

  it('variantName và mainName đều uppercase không thay đổi logic (case-insensitive) (L146 both lower)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 2,
      name: 'iPhone 15',
      basePrice: '25000000',
      reviews: [],
      variants: [
        {
          id: 2,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: '256GB Storage',
          isDefault: true,
          attributes: {},
          sku: 'S2',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    // '256gb storage'.includes('iphone 15') = false → fullName = 'iPhone 15 - 256GB Storage'
    expect(result.name).toBe('iPhone 15 - 256GB Storage');
  });
});

// ─── L826 (regex in getProductFilters) ─────────────────────────────────

describe('getProductFilters — regex /^\\d+$/ multi-char (L485 Regex survivor)', () => {
  it('categoryId = "10" → isStrictInt true → parseInt(10) (L485 /^\\d+$/)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductFilters({ categoryId: '10' });
    expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 10 });
  });

  it('categoryId = "abc" → không phải số → gọi slug lookup (L485 false)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    await service.getProductFilters({ categoryId: 'abc' });
    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('abc');
  });
});

// ─── L486 /^[a-z0-9-]+$/ slug regex ────────────────────────────────────

describe('getProductFilters — slug regex (L486 Regex)', () => {
  it('categoryId = "dien-thoai" → isSlug true → findCategoryBySlug (L486)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    await service.getProductFilters({ categoryId: 'dien-thoai' });
    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('dien-thoai');
  });

  it('categoryId = "Điện Thoại" → không phải slug (uppercase) → throw 400 (L486 false)', async () => {
    const { service } = makeService();
    await expect(service.getProductFilters({ categoryId: 'Điện Thoại' })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Vòng 4 — Transaction-arg killers
// Mục tiêu: kill mutant `{ transaction }` → `{}` trong createProduct/updateProduct
// Kỹ thuật: capture transaction object từ runInTransaction mock và assert nó
//           được truyền chính xác vào từng repo call bên trong transaction.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * makeServiceWithTxCapture — giống makeService nhưng runInTransaction capture
 * transaction object thực sự và expose nó để test có thể assert.
 */
function makeServiceWithTxCapture(repoOverrides = {}) {
  let _capturedTx = null;
  const catalogRepository = {
    findAllCategoriesSorted: jest.fn().mockResolvedValue([]),
    getCategoryProductCounts: jest.fn().mockResolvedValue({}),
    findCategoryById: jest.fn().mockResolvedValue(null),
    findCategoryByIdOrSlug: jest.fn().mockResolvedValue(null),
    findCategoryBySlug: jest.fn().mockResolvedValue(null),
    createCategory: jest.fn().mockResolvedValue({ id: 1 }),
    saveCategory: jest.fn().mockResolvedValue(),
    deleteCategory: jest.fn().mockResolvedValue(),
    countProductsByCategoryId: jest.fn().mockResolvedValue(0),
    findProductsByCategoryId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findAllBrands: jest.fn().mockResolvedValue([]),
    findBrandIdsByCategoryId: jest.fn().mockResolvedValue([]),
    findBrandById: jest.fn().mockResolvedValue(null),
    findBrandBySlug: jest.fn().mockResolvedValue(null),
    createBrand: jest.fn().mockResolvedValue({ id: 1 }),
    saveBrand: jest.fn().mockResolvedValue(),
    deleteBrand: jest.fn().mockResolvedValue(),
    countProductsByBrandId: jest.fn().mockResolvedValue(0),
    findProductsByBrandId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductsList: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductByIdWithFullDetails: jest.fn().mockResolvedValue(null),
    findProductBySlugWithFullDetails: jest.fn().mockResolvedValue(null),
    findProductByPk: jest.fn().mockResolvedValue(null),
    findProductByName: jest.fn().mockResolvedValue(null),
    findProductBySlug: jest.fn().mockResolvedValue(null),
    findFeaturedProducts: jest.fn().mockResolvedValue([]),
    findRelatedProducts: jest.fn().mockResolvedValue([]),
    findRelatedProductsFallback: jest.fn().mockResolvedValue([]),
    searchProducts: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findProductSuggestions: jest.fn().mockResolvedValue([]),
    findNewArrivals: jest.fn().mockResolvedValue([]),
    findBestSellersRaw: jest.fn().mockResolvedValue([]),
    findProductsByIdsOrdered: jest.fn().mockResolvedValue([]),
    findDeals: jest.fn().mockResolvedValue([]),
    findProductVariantsByProductId: jest.fn().mockResolvedValue([]),
    findProductRatingsRows: jest.fn().mockResolvedValue([]),
    getProductPriceRange: jest.fn().mockResolvedValue({ min: 0, max: 0 }),
    findAttributeValuesByName: jest.fn().mockResolvedValue([]),
    findOtherAttributes: jest.fn().mockResolvedValue([]),
    findRecentlyViewedByUser: jest.fn().mockResolvedValue([]),
    upsertRecentlyViewed: jest.fn().mockResolvedValue(),
    pruneRecentlyViewed: jest.fn().mockResolvedValue(),
    createProduct: jest.fn().mockResolvedValue({ id: 1 }),
    saveProduct: jest.fn().mockResolvedValue(),
    deleteProduct: jest.fn().mockResolvedValue(),
    findCategoriesByIds: jest.fn().mockResolvedValue([]),
    setProductCategories: jest.fn().mockResolvedValue(),
    createProductSpecifications: jest.fn().mockResolvedValue(),
    createProductAttributes: jest.fn().mockResolvedValue(),
    clearProductAttributes: jest.fn().mockResolvedValue(),
    createProductVariants: jest.fn().mockResolvedValue([]),
    clearProductVariants: jest.fn().mockResolvedValue(),
    clearProductImages: jest.fn().mockResolvedValue(),
    createProductImages: jest.fn().mockResolvedValue(),
    // runInTransaction: capture tx object, truyền vào callback
    runInTransaction: jest.fn(async (fn) => {
      _capturedTx = { __txMarker: 'captured-transaction' };
      return fn(_capturedTx);
    }),
    ...repoOverrides,
  };

  const service = new CatalogService({
    catalogRepository,
    eventBus: { publish: jest.fn() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });

  const getCapturedTx = () => _capturedTx;
  return { service, catalogRepository, getCapturedTx };
}

// ─── createProduct transaction args ──────────────────────────────────────

describe('createProduct — createProduct repo call nhận { transaction } (L572)', () => {
  it('createProduct được gọi với { transaction } là object từ runInTransaction (L572)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture();
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({ payload: { name: 'P', price: 5000 } });

    const tx = getCapturedTx();
    // Mutant { transaction } → {} sẽ truyền {} thay vì { transaction: tx }
    expect(catalogRepository.createProduct).toHaveBeenCalledWith(expect.any(Object), {
      transaction: tx,
    });
  });
});

describe('createProduct — setProductCategories nhận { transaction } (L580)', () => {
  it('setProductCategories được gọi với { transaction } đúng (L580)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findCategoriesByIds: jest.fn().mockResolvedValue([{ id: 1 }]),
    });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: { name: 'P', categoryIds: [1] },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.setProductCategories).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      { transaction: tx },
    );
  });
});

describe('createProduct — createProductSpecifications nhận { transaction } (L595)', () => {
  it('createProductSpecifications được gọi với { transaction } đúng (L595)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture();
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        specifications: [{ name: 'CPU', value: 'A17', category: 'Chip' }],
      },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductSpecifications).toHaveBeenCalledWith(expect.any(Array), {
      transaction: tx,
    });
  });
});

describe('createProduct — createProductAttributes (parentAttributes) nhận { transaction } (L607)', () => {
  it('createProductAttributes với parentAttributes được gọi với { transaction } (L607)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture();
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        parentAttributes: [{ name: 'Color', type: 'color', values: ['red'], required: false }],
      },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductAttributes).toHaveBeenCalledWith(expect.any(Array), {
      transaction: tx,
    });
  });
});

describe('createProduct — createProductAttributes (attributes) nhận { transaction } (L612)', () => {
  it('createProductAttributes với attributes được gọi với { transaction } (L612)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture();
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        attributes: [{ name: 'Color', value: 'Red' }],
      },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductAttributes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Color' })]),
      { transaction: tx },
    );
  });
});

describe('createProduct — createProductImages (product images) nhận { transaction } (L622)', () => {
  it('createProductImages được gọi với { transaction } khi có images (L622)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture();
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: { name: 'P', images: ['img1.jpg', 'img2.jpg'] },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ imageUrl: 'img1.jpg' })]),
      { transaction: tx },
    );
  });
});

describe('createProduct — createProductVariants nhận { transaction } (L639)', () => {
  it('createProductVariants được gọi với { transaction } (L639)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      createProductVariants: jest.fn().mockResolvedValue([{ id: 10 }]),
    });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        variants: [{ sku: 'V1', price: 5000 }],
      },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(expect.any(Array), {
      transaction: tx,
    });
  });
});

describe('createProduct — createProductImages (variant images) nhận { transaction } (L660)', () => {
  it('createProductImages cho variant images được gọi với { transaction } (L660)', async () => {
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      createProductVariants: jest.fn().mockResolvedValue([{ id: 50 }]),
      createProductImages: jest.fn().mockResolvedValue(),
    });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.createProduct({
      payload: {
        name: 'P',
        variants: [{ sku: 'V1', price: 5000, images: ['v1.jpg'] }],
      },
    });

    const tx = getCapturedTx();
    // createProductImages được gọi cho variant images với { transaction }
    expect(catalogRepository.createProductImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ variantId: 50, imageUrl: 'v1.jpg' })]),
      { transaction: tx },
    );
  });
});

// ─── updateProduct transaction args ──────────────────────────────────────

describe('updateProduct — saveProduct nhận { transaction } (L695)', () => {
  it('saveProduct được gọi với { transaction } đúng (L695)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({ id: 1, patch: { name: 'New Name' } });

    const tx = getCapturedTx();
    expect(catalogRepository.saveProduct).toHaveBeenCalledWith(expect.any(Object), {
      transaction: tx,
    });
  });
});

describe('updateProduct — setProductCategories nhận { transaction } (L702)', () => {
  it('setProductCategories được gọi với { transaction } khi patch.categoryIds hợp lệ (L702)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findCategoriesByIds: jest.fn().mockResolvedValue([{ id: 2 }]),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({ id: 1, patch: { categoryIds: [2] } });

    const tx = getCapturedTx();
    expect(catalogRepository.setProductCategories).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Array),
      { transaction: tx },
    );
  });
});

describe('updateProduct — clearProductAttributes nhận { transaction } (L706)', () => {
  it('clearProductAttributes được gọi với { transaction } khi patch có attributes (L706)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({ id: 1, patch: { attributes: [] } });

    const tx = getCapturedTx();
    expect(catalogRepository.clearProductAttributes).toHaveBeenCalledWith(1, { transaction: tx });
  });
});

describe('updateProduct — createProductAttributes nhận { transaction } (L709)', () => {
  it('createProductAttributes được gọi với { transaction } khi patch.attributes không rỗng (L709)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({
      id: 1,
      patch: { attributes: [{ name: 'Color', value: 'Red' }] },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductAttributes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: 'Color' })]),
      { transaction: tx },
    );
  });
});

describe('updateProduct — clearProductImages (product) nhận { transaction } (L714)', () => {
  it('clearProductImages với null scope được gọi với { transaction } khi patch.images (L714)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({ id: 1, patch: { images: [] } });

    const tx = getCapturedTx();
    expect(catalogRepository.clearProductImages).toHaveBeenCalledWith(1, null, { transaction: tx });
  });
});

describe('updateProduct — createProductImages (product images) nhận { transaction } (L722)', () => {
  it('createProductImages cho product images được gọi với { transaction } (L722)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({
      id: 1,
      patch: { images: ['img1.jpg'] },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ imageUrl: 'img1.jpg' })]),
      { transaction: tx },
    );
  });
});

describe('updateProduct — clearProductImages (variants) nhận { transaction } (L727)', () => {
  it('clearProductImages với "variants" scope được gọi với { transaction } khi patch.variants (L727)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({ id: 1, patch: { variants: [] } });

    const tx = getCapturedTx();
    expect(catalogRepository.clearProductImages).toHaveBeenCalledWith(1, 'variants', {
      transaction: tx,
    });
  });
});

describe('updateProduct — clearProductVariants nhận { transaction } (L728)', () => {
  it('clearProductVariants được gọi với { transaction } khi patch.variants (L728)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({ id: 1, patch: { variants: [] } });

    const tx = getCapturedTx();
    expect(catalogRepository.clearProductVariants).toHaveBeenCalledWith(1, { transaction: tx });
  });
});

describe('updateProduct — createProductVariants nhận { transaction } (L735)', () => {
  it('createProductVariants được gọi với { transaction } khi patch.variants không rỗng (L735)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      createProductVariants: jest.fn().mockResolvedValue([{ id: 30 }]),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({
      id: 1,
      patch: { variants: [{ sku: 'V1', price: 5000 }] },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(expect.any(Array), {
      transaction: tx,
    });
  });
});

describe('updateProduct — createProductImages (variant images) nhận { transaction } (L756)', () => {
  it('createProductImages cho variant images được gọi với { transaction } (L756)', async () => {
    const product = makeProductRow({ id: 1 });
    const { service, catalogRepository, getCapturedTx } = makeServiceWithTxCapture({
      findProductByPk: jest.fn().mockResolvedValue(product),
      createProductVariants: jest.fn().mockResolvedValue([{ id: 60 }]),
      createProductImages: jest.fn().mockResolvedValue(),
      findProductByIdWithFullDetails: jest.fn().mockResolvedValue(product),
    });

    await service.updateProduct({
      id: 1,
      patch: { variants: [{ sku: 'V1', price: 5000, images: ['v.jpg'] }] },
    });

    const tx = getCapturedTx();
    expect(catalogRepository.createProductImages).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ variantId: 60, imageUrl: 'v.jpg' })]),
      { transaction: tx },
    );
  });
});
