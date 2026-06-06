/**
 * catalog-service.mutation-kill.test.js
 * Bổ sung tests để kill các LIKELY-KILLABLE mutants còn sống sót.
 * Mỗi test assert OUTCOME thực tế (giá trị trả về, error key, tham số call).
 */
const CatalogService = require('./catalog-service');

// ─── Helper factories ───────────────────────────────────────────────────────

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
    findProductRatingsSummary: jest.fn().mockResolvedValue([]),
    getProductPriceRange: jest.fn().mockResolvedValue({ min: 0, max: 0 }),
    findAttributeValuesByName: jest.fn().mockResolvedValue([]),
    findOtherAttributes: jest.fn().mockResolvedValue([]),
    findRecentlyViewedByUser: jest.fn().mockResolvedValue([]),
    upsertRecentlyViewed: jest.fn().mockResolvedValue(),
    pruneRecentlyViewed: jest.fn().mockResolvedValue(),
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
// Brand methods — StringLiteral survivors
// catalog-brand-methods.js: L33, L38, L44, L52, L56, L63, L65, L68
// ═══════════════════════════════════════════════════════════════════════════

describe('createBrand — tạo brand với đúng fields (L33)', () => {
  it('truyền đúng name, logoUrl, description, website đến repository', async () => {
    const { service, catalogRepository } = makeService();
    const payload = {
      name: 'Apple',
      logoUrl: 'logo.png',
      description: 'Tech',
      website: 'apple.com',
    };
    await service.createBrand({ payload });
    expect(catalogRepository.createBrand).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Apple',
        logoUrl: 'logo.png',
        description: 'Tech',
        website: 'apple.com',
      }),
    );
  });

  it('isActive mặc định là true khi payload.isActive = undefined (L38)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createBrand({ payload: { name: 'Brand X' } });
    expect(catalogRepository.createBrand).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it('isActive = false khi payload.isActive = false (L38 - không phải default)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createBrand({ payload: { name: 'Brand Y', isActive: false } });
    expect(catalogRepository.createBrand).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });
});

describe('updateBrand — error key đúng khi không tìm thấy (L44)', () => {
  it('throw error với message key catalog.brandNotFound khi brand không tồn tại', async () => {
    const { service } = makeService();
    await expect(service.updateBrand({ id: 99, patch: { name: 'X' } })).rejects.toMatchObject({
      statusCode: 404,
      message: 'catalog.brandNotFound',
    });
  });
});

describe('deleteBrand — error keys đúng (L52, L56)', () => {
  it('throw catalog.brandNotFound khi brand không tìm thấy (L52)', async () => {
    const { service } = makeService();
    await expect(service.deleteBrand({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.brandNotFound',
    });
  });

  it('throw catalog.cannotDeleteBrandWithProducts khi brand có sản phẩm (L56)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandById.mockResolvedValue({ id: 1 });
    catalogRepository.countProductsByBrandId.mockResolvedValue(5);
    await expect(service.deleteBrand({ id: 1 })).rejects.toMatchObject({
      message: 'catalog.cannotDeleteBrandWithProducts',
    });
  });
});

describe('getProductsByBrand — pagination đúng (L63, L65, L68)', () => {
  it('tính offset đúng: page=3, limit=5 → offset=10 (L68: (page-1)*lim)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandBySlug.mockResolvedValue({ id: 2 });
    catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 30, rows: [] });

    await service.getProductsByBrand({ slug: 'apple', page: 3, limit: 5 });

    expect(catalogRepository.findProductsByBrandId).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ limit: 5, offset: 10 }),
    );
  });

  it('throw catalog.brandNotFound khi brand không tồn tại (L65)', async () => {
    const { service } = makeService();
    await expect(service.getProductsByBrand({ slug: 'unknown' })).rejects.toMatchObject({
      message: 'catalog.brandNotFound',
    });
  });

  it('trả về pages = ceil(count / lim) đúng (L63 sort/order forwarded)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandBySlug.mockResolvedValue({ id: 3 });
    catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 31, rows: [] });

    const result = await service.getProductsByBrand({ slug: 'brand', page: 1, limit: 10 });
    expect(result.pages).toBe(4); // ceil(31/10) = 4
    expect(result.total).toBe(31);
    expect(result.currentPage).toBe(1);
  });

  it('truyền đúng sort và order đến repository (L63)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandBySlug.mockResolvedValue({ id: 4 });
    catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 0, rows: [] });

    await service.getProductsByBrand({ slug: 'brand', sort: 'price', order: 'ASC' });

    expect(catalogRepository.findProductsByBrandId).toHaveBeenCalledWith(
      4,
      expect.objectContaining({ sort: 'price', order: 'ASC' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Category methods — StringLiteral survivors + createCategory defaults
// catalog-category-methods.js
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllCategories — filter isActive đúng (L19)', () => {
  it('lọc bỏ category có isActive = false dù có productCount > 0', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findAllCategoriesSorted.mockResolvedValue([
      { id: 1, toJSON: () => ({ id: 1, name: 'Active', isActive: true }) },
      { id: 2, toJSON: () => ({ id: 2, name: 'Inactive', isActive: false }) },
    ]);
    catalogRepository.getCategoryProductCounts.mockResolvedValue({ 1: 5, 2: 10 });

    const result = await service.getAllCategories();
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Active');
  });

  it('trả về status = success (L21)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findAllCategoriesSorted.mockResolvedValue([]);
    catalogRepository.getCategoryProductCounts.mockResolvedValue({});

    const result = await service.getAllCategories();
    expect(result.status).toBe('success');
  });
});

describe('getCategoryById — error key đúng (L30)', () => {
  it('throw catalog.categoryNotFound khi không tìm thấy (L30)', async () => {
    const { service } = makeService();
    await expect(service.getCategoryById({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.categoryNotFound',
    });
  });
});

describe('getCategoryBySlug — error key đúng (L36)', () => {
  it('throw catalog.categoryNotFound khi không tìm thấy (L36)', async () => {
    const { service } = makeService();
    await expect(service.getCategoryBySlug({ slug: 'unknown' })).rejects.toMatchObject({
      message: 'catalog.categoryNotFound',
    });
  });
});

describe('createCategory — defaults đúng (L41, L45, L46, L47)', () => {
  it('parentId mặc định là null khi không truyền (L45)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Cat' } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: null }),
    );
  });

  it('isActive mặc định là true khi không truyền (L46)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Cat' } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it('isActive = false khi truyền false (L46)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Cat', isActive: false } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
  });

  it('sortOrder mặc định là 0 khi không truyền (L47)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Cat' } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 0 }),
    );
  });

  it('sortOrder = 5 khi truyền sortOrder=5 (L47)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Cat', sortOrder: 5 } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 5 }),
    );
  });
});

describe('updateCategory — error key đúng (L54)', () => {
  it('throw catalog.categoryNotFound khi không tìm thấy (L54)', async () => {
    const { service } = makeService();
    await expect(service.updateCategory({ id: 99, patch: {} })).rejects.toMatchObject({
      message: 'catalog.categoryNotFound',
    });
  });
});

describe('deleteCategory — error keys đúng (L68, L83, L84)', () => {
  it('throw catalog.categoryNotFound khi không tìm thấy (L68)', async () => {
    const { service } = makeService();
    await expect(service.deleteCategory({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.categoryNotFound',
    });
  });

  it('throw catalog.cannotDeleteCategoryWithProducts khi có sản phẩm (L83)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.countProductsByCategoryId.mockResolvedValue(3);
    await expect(service.deleteCategory({ id: 1 })).rejects.toMatchObject({
      message: 'catalog.cannotDeleteCategoryWithProducts',
    });
  });

  it('trả về message catalog.categoryDeleted khi xóa thành công (L84)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.countProductsByCategoryId.mockResolvedValue(0);
    const result = await service.deleteCategory({ id: 1 });
    expect(result.message).toBe('catalog.categoryDeleted');
  });
});

describe('getProductsByCategory — pagination và error key (L94)', () => {
  it('tính offset đúng: page=2, limit=5 → offset=5 (L94)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 20, rows: [] });

    await service.getProductsByCategory({ id: 1, page: 2, limit: 5 });

    expect(catalogRepository.findProductsByCategoryId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 5, offset: 5 }),
    );
  });

  it('tính pages = ceil(count/lim) đúng (L107)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 21, rows: [] });

    const result = await service.getProductsByCategory({ id: 1, page: 1, limit: 10 });
    expect(result.pages).toBe(3); // ceil(21/10) = 3
  });

  it('throw catalog.categoryNotFound khi không tìm thấy cả id lẫn slug (L85)', async () => {
    const { service } = makeService();
    await expect(service.getProductsByCategory({ id: 'not-exist' })).rejects.toMatchObject({
      message: 'catalog.categoryNotFound',
    });
  });
});

describe('_mapProductWithImages — logic variants (L121-L135)', () => {
  it('map productImages thành images array với đúng url field (L121)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '5000',
        productImages: [{ id: 1, imageUrl: 'img.jpg', isThumbnail: true, color: 'red' }],
        variants: [],
      }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.images[0].url).toBe('img.jpg');
    expect(result.images[0].id).toBe(1);
  });

  it('thumbnail lấy từ ảnh isThumbnail=true (L127)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '5000',
        productImages: [
          { id: 1, imageUrl: 'not-thumb.jpg', isThumbnail: false, color: null },
          { id: 2, imageUrl: 'thumb.jpg', isThumbnail: true, color: null },
        ],
        variants: [],
      }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.thumbnail).toBe('thumb.jpg');
  });

  it('variant isDefault=true → price từ variant đó (L133)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '10000',
        productImages: [],
        variants: [
          { isDefault: false, price: '15000', compareAtPrice: null },
          { isDefault: true, price: '12000', compareAtPrice: null },
        ],
      }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.price).toBe('12000');
  });

  it('variant isDefault=false, fallback về variants[0] (L133)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '10000',
        productImages: [],
        variants: [
          { isDefault: false, price: '9000', compareAtPrice: null },
          { isDefault: false, price: '11000', compareAtPrice: null },
        ],
      }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.price).toBe('9000'); // variants[0]
  });

  it('compareAtPrice từ variant khi có defaultVariant (L135)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'P',
        basePrice: '10000',
        compareAtPrice: '20000',
        productImages: [],
        variants: [{ isDefault: true, price: '12000', compareAtPrice: '18000' }],
      }),
    };
    const result = service._mapProductWithImages(product);
    expect(result.compareAtPrice).toBe('18000');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Product methods — _mapProductImages helper
// catalog-product-methods.js L25
// ═══════════════════════════════════════════════════════════════════════════

describe('_mapProductImages — alt field và thumbnail (L25)', () => {
  it('alt field = product.name khi có tên (L25)', () => {
    const { service } = makeService();
    const json = {
      name: 'iPhone 15',
      productImages: [
        { id: 1, imageUrl: 'img.jpg', isThumbnail: true, variantId: null, color: null },
      ],
    };
    service._mapProductImages(json);
    expect(json.images[0].alt).toBe('iPhone 15');
  });

  it('alt = empty string khi name = undefined (L25 || branch)', () => {
    const { service } = makeService();
    const json = {
      productImages: [
        { id: 1, imageUrl: 'img.jpg', isThumbnail: false, variantId: null, color: null },
      ],
    };
    service._mapProductImages(json);
    expect(json.images[0].alt).toBe('');
  });

  it('images bao gồm đủ fields: id, url, alt, isThumbnail, variantId, color (L22)', () => {
    const { service } = makeService();
    const json = {
      name: 'Test',
      productImages: [{ id: 5, imageUrl: 'x.jpg', isThumbnail: true, variantId: 10, color: 'red' }],
    };
    service._mapProductImages(json);
    expect(json.images[0]).toMatchObject({
      id: 5,
      url: 'x.jpg',
      alt: 'Test',
      isThumbnail: true,
      variantId: 10,
      color: 'red',
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _calcRatings — onlyVerified conditional (L41)
// ═══════════════════════════════════════════════════════════════════════════

describe('_calcRatings — conditional logic (L41)', () => {
  it('reviews.length === 0 → trả về {average:0, count:0} không tính gì (L41 false branch)', () => {
    const { service } = makeService();
    // length === 0 not length >= 0: phải verify exact result
    const result = service._calcRatings([]);
    expect(result).toEqual({ average: 0, count: 0 });
  });

  it('reviews không rỗng → tính bình quân đúng (L41 true path)', () => {
    const { service } = makeService();
    const result = service._calcRatings([{ rating: 3 }, { rating: 5 }]);
    expect(result.average).toBe(4.0);
    expect(result.count).toBe(2);
  });

  it('onlyVerified=true + tất cả filtered out → count=0, average=0 (L45)', () => {
    const { service } = makeService();
    const result = service._calcRatings([{ rating: 5, isVerified: false }], { onlyVerified: true });
    expect(result).toEqual({ average: 0, count: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _pickDisplayPrice — conditional logic (L60)
// ═══════════════════════════════════════════════════════════════════════════

describe('_pickDisplayPrice — logic lowestPrice (L60)', () => {
  it('lowestPrice = 5000 (truthy, !=0) → trả về 5000 (L60 true branch)', () => {
    const { service } = makeService();
    const price = service._pickDisplayPrice({
      basePrice: '10000',
      variants: [{ price: '5000' }, { price: '8000' }],
    });
    expect(price).toBe(5000);
  });

  it('lowestPrice = 0 → fallback về basePrice (L60: lowestPrice !== 0 false)', () => {
    const { service } = makeService();
    const price = service._pickDisplayPrice({
      basePrice: '10000',
      variants: [{ price: '0' }, { price: '5000' }],
    });
    expect(price).toBe(10000);
  });

  it('lowestPrice = NaN → fallback về basePrice (L60: NaN falsy)', () => {
    const { service } = makeService();
    const price = service._pickDisplayPrice({
      basePrice: '10000',
      variants: [{ price: null }, { price: '5000' }],
    });
    expect(price).toBe(10000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — compareAtPrice logic (L81, L89, L157)
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — compareAtPrice (L89)', () => {
  it('compareAtPrice = truthy number → parseFloat (L89 truthy branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: '15000', reviews: [] });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.compareAtPrice).toBe(15000);
  });

  it('compareAtPrice = null → null (L89 falsy branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: null, reviews: [] });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.compareAtPrice).toBeNull();
  });

  it('compareAtPrice = "0" → null (L89: "0" falsy branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: '0', reviews: [] });
    const result = service._buildProductDetailResponse(product, {});
    // parseFloat('0') = 0 → falsy → null? No, truthy check: '0' !== '' → truthy → parseFloat('0') = 0
    // Actually: `productJson.compareAtPrice ? parseFloat(...) : null`
    // '0' is truthy string → parseFloat('0') = 0
    expect(result.compareAtPrice).toBe(0);
  });
});

describe('_buildProductDetailResponse — selectedVariant.compareAtPrice (L157)', () => {
  it('selectedVariant.compareAtPrice truthy → dùng variant compareAtPrice (L157 true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      compareAtPrice: '20000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '12000',
          compareAtPrice: '18000',
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.compareAtPrice).toBe('18000');
  });

  it('selectedVariant.compareAtPrice = null → fallback về productJson.compareAtPrice (L157 false)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      compareAtPrice: '20000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '12000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.compareAtPrice).toBe('20000');
  });
});

describe('_buildProductDetailResponse — selectedVariant.price (L169)', () => {
  it('selectedVariant.price truthy → dùng variant price (L169 true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '12000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.price).toBe('12000');
  });

  it('selectedVariant.price = falsy → fallback về productJson.basePrice (L169 false)', () => {
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
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.price).toBe('10000');
  });
});

describe('_buildProductDetailResponse — variantImages logic (L160, L161)', () => {
  it('variantImages không rỗng → images = variantImages (L160 true branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'v1.jpg', isThumbnail: true, variantId: 10, color: null },
        { id: 2, imageUrl: 'other.jpg', isThumbnail: false, variantId: 99, color: null },
      ],
      variants: [
        {
          id: 10,
          price: '12000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { skuId: '10' });
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('v1.jpg');
    expect(result.thumbnail).toBe('v1.jpg');
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
          id: 20,
          price: '12000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'V2',
          isDefault: true,
          attributes: {},
          sku: 'S2',
          specifications: {},
        },
      ],
    });
    // skuId=20, nhưng variantId=null cho ảnh → matchByVariantId rỗng, không có color → giữ nguyên tất cả
    const result = service._buildProductDetailResponse(product, { skuId: '20' });
    expect(result.images).toHaveLength(1);
    expect(result.thumbnail).toBe('gen.jpg'); // dùng productJson.images[0].url
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — availableVariants (L174-L175)
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — availableVariants price fallback (L175)', () => {
  it('v.price truthy → dùng v.price trong availableVariants (L175 true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '8000',
          compareAtPrice: '12000',
          stockQuantity: 5,
          variantName: 'V1',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.availableVariants[0].price).toBe('8000');
  });

  it('v.price = null → fallback về productJson.basePrice (L175 false)', () => {
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
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.availableVariants[0].price).toBe('10000');
  });

  it('availableVariants name = v.variantName khi có (L174 true)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '8000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Black 256GB',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.availableVariants[0].name).toBe('Black 256GB');
  });

  it('availableVariants name = v.displayName khi variantName = null (L174 false → L174 displayName)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [],
      variants: [
        {
          id: 1,
          price: '8000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: null,
          displayName: 'DisplayName',
          isDefault: true,
          attributes: {},
          sku: 'S1',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.availableVariants[0].name).toBe('DisplayName');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAllProducts — StringLiteral errors + pagination (L195, L196)
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllProducts — pagination offset đúng (L344)', () => {
  it('page=3, limit=10 → offset=20 (L344: (page-1)*lim)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ page: 3, limit: 10 });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 20 }),
    );
  });

  it('page=1, limit=20 → offset=0', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ page: 1, limit: 20 });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0 }),
    );
  });

  it('payload trả về đúng total, page, limit (L195, L196)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 50, rows: [] });

    const { payload } = await service.getAllProducts({ page: 2, limit: 10 });

    expect(payload.total).toBe(50);
    expect(payload.page).toBe(2);
    expect(payload.limit).toBe(10);
    expect(payload.status).toBe('success');
  });

  it('default limit = 20 khi không truyền (L207)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 20 }),
    );
  });
});

describe('searchProducts — pagination offset đúng (L341, L344)', () => {
  it('page=2, limit=10 → offset=10 (L344)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.searchProducts.mockResolvedValue({ count: 0, rows: [] });

    await service.searchProducts({ q: 'iphone', page: 2, limit: 10 });

    expect(catalogRepository.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 10 }),
    );
  });

  it('throw error key catalog.searchKeywordRequired khi q rỗng (L341)', async () => {
    const { service } = makeService();
    await expect(service.searchProducts({ q: '' })).rejects.toMatchObject({
      message: 'catalog.searchKeywordRequired',
    });
  });

  it('trả về đúng data, total, page, limit (L326)', async () => {
    const { service, catalogRepository } = makeService();
    const row = makeProductRow({ id: 1 });
    catalogRepository.searchProducts.mockResolvedValue({ count: 1, rows: [row] });

    const result = await service.searchProducts({ q: 'iphone', page: 1, limit: 5 });
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(5);
  });
});

describe('getProductSuggestions — q.trim() logic (L369)', () => {
  it('q.trim() để kiểm tra length (L369): q = " " (whitespace) → trim = "" → length < 1 → trả []', async () => {
    const { service } = makeService();
    const result = await service.getProductSuggestions({ q: ' ' });
    expect(result).toEqual([]);
  });

  it('q.trim() gọi trim trước khi truyền vào findProductSuggestions (L371)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductSuggestions.mockResolvedValue([]);
    await service.getProductSuggestions({ q: ' phone ' });
    expect(catalogRepository.findProductSuggestions).toHaveBeenCalledWith('phone', 10);
  });

  it('giới hạn tối đa 10 suggestions (MAX_SUGGESTIONS = 10)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductSuggestions.mockResolvedValue([]);
    await service.getProductSuggestions({ q: 'test' });
    expect(catalogRepository.findProductSuggestions).toHaveBeenCalledWith('test', 10);
  });
});

describe('getBestSellers — period branches (L404, L405, L408)', () => {
  it('period = year → startDate khoảng 1 năm trước (L405: getFullYear - 1)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = new Date();
    await service.getBestSellers({ limit: 5, period: 'year' });
    const after = new Date();

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const startDate = callArgs.startDate;
    // startDate phải khoảng 1 năm trước (không phải +1 năm)
    expect(startDate.getFullYear()).toBeLessThanOrEqual(before.getFullYear() - 1 + 1);
    expect(startDate.getFullYear()).toBeGreaterThanOrEqual(before.getFullYear() - 1 - 1);
  });

  it('period = week → startDate khoảng 7 ngày trước (L408: getDate - 7)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = Date.now();
    await service.getBestSellers({ limit: 5, period: 'week' });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const startDate = callArgs.startDate;
    const diffMs = before - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Phải khoảng 7 ngày, không phải +7 ngày
    expect(diffDays).toBeGreaterThan(5);
    expect(diffDays).toBeLessThan(10);
  });

  it('period = month (default) → startDate khoảng 1 tháng trước (L408: getMonth - 1)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    const before = Date.now();
    await service.getBestSellers({ limit: 5 });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const startDate = callArgs.startDate;
    const diffMs = before - startDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // khoảng 28-31 ngày trước, không phải +1 tháng
    expect(diffDays).toBeGreaterThan(25);
    expect(diffDays).toBeLessThan(40);
  });

  it('limit được truyền đúng vào findBestSellersRaw (L416)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getBestSellers({ limit: 7 });

    expect(catalogRepository.findBestSellersRaw).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 7 }),
    );
  });
});

describe('getDeals — default minDiscount và limit (L431, L460, L468)', () => {
  it('minDiscount mặc định = 5 khi không truyền (L431: DEFAULT_MIN_DISCOUNT_PERCENT)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findDeals.mockResolvedValue([]);
    await service.getDeals({});
    expect(catalogRepository.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ minDiscount: 5 }),
    );
  });

  it('truyền sort đến repository (L460)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findDeals.mockResolvedValue([]);
    await service.getDeals({ sort: 'price_asc' });
    expect(catalogRepository.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ sort: 'price_asc' }),
    );
  });

  it('default limit = DEFAULT_DEALS_LIMIT = 12 khi không truyền (L460)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findDeals.mockResolvedValue([]);
    await service.getDeals({});
    expect(catalogRepository.findDeals).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12 }),
    );
  });
});

describe('getProductFilters — categoryId validation (L485, L486, L488)', () => {
  it('throw catalog.invalidCategoryId khi categoryId không phải số cũng không phải slug (L488)', async () => {
    const { service } = makeService();
    await expect(service.getProductFilters({ categoryId: '!invalid!' })).rejects.toMatchObject({
      message: 'catalog.invalidCategoryId',
    });
  });

  it('regex số nguyên: "123" → pass, "123.4" → không pass /^\\d+$/ → throw (L485)', async () => {
    const { service } = makeService();
    await expect(service.getProductFilters({ categoryId: '123.4' })).rejects.toMatchObject({
      message: 'catalog.invalidCategoryId',
    });
  });

  it('regex slug: "phone-123" → pass, gọi findCategoryBySlug (L486)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    await service.getProductFilters({ categoryId: 'phone-123' });
    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('phone-123');
  });

  it('categoryId là số → parseInt và pass đến repository (L490)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductFilters({ categoryId: '5' });
    expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 5 });
  });

  it('findAttributeValuesByName được gọi với "brand", "color", "size" (L502-L504)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductFilters({});
    expect(catalogRepository.findAttributeValuesByName).toHaveBeenCalledWith('brand', {
      categoryId: null,
    });
    expect(catalogRepository.findAttributeValuesByName).toHaveBeenCalledWith('color', {
      categoryId: null,
    });
    expect(catalogRepository.findAttributeValuesByName).toHaveBeenCalledWith('size', {
      categoryId: null,
    });
  });

  it('findOtherAttributes được gọi (L505)', async () => {
    const { service, catalogRepository } = makeService();
    await service.getProductFilters({});
    expect(catalogRepository.findOtherAttributes).toHaveBeenCalledWith({ categoryId: null });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getRecentlyViewed — fields đúng (L538)
// ═══════════════════════════════════════════════════════════════════════════

describe('getRecentlyViewed — compareAtPrice và viewedAt (L538)', () => {
  it('compareAtPrice được tính đúng từ json.compareAtPrice (L538)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({
      id: 1,
      basePrice: '10000',
      compareAtPrice: '15000',
      reviews: [],
    });
    catalogRepository.findRecentlyViewedByUser.mockResolvedValue([
      {
        viewedAt: new Date('2024-01-01'),
        Product: product,
      },
    ]);

    const result = await service.getRecentlyViewed({ userId: 1, limit: 10 });
    expect(result[0].compareAtPrice).toBe(15000);
  });

  it('compareAtPrice = null khi không có compareAtPrice (L538 || null)', async () => {
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

describe('getProductById/BySlug — error keys đúng (L279, L280)', () => {
  it('getProductById → throw catalog.productNotFound khi không tìm thấy (L279)', async () => {
    const { service } = makeService();
    await expect(service.getProductById({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });

  it('getProductById → throw catalog.productNotFound khi status != active (L280)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, status: 'inactive' });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

    await expect(service.getProductById({ id: 1 })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });

  it('getProductBySlug → throw catalog.productNotFound khi status != active (L297)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, status: 'draft' });
    catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

    await expect(service.getProductBySlug({ slug: 'p' })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });

  it('getProductBySlug → throw catalog.productNotFound khi không tìm thấy (L296)', async () => {
    const { service } = makeService();
    await expect(service.getProductBySlug({ slug: 'unknown' })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });
});

describe('getRelatedProducts — error key và logic (L317)', () => {
  it('throw catalog.productNotFound khi không tìm thấy (L317)', async () => {
    const { service } = makeService();
    await expect(service.getRelatedProducts({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });

  it('không gọi findRelatedProducts khi product không có categoryId (L331)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({
      id: 1,
      categoryId: null,
      status: 'active',
    });
    catalogRepository.findRelatedProductsFallback.mockResolvedValue([]);

    await service.getRelatedProducts({ id: 1 });

    expect(catalogRepository.findRelatedProducts).not.toHaveBeenCalled();
    expect(catalogRepository.findRelatedProductsFallback).toHaveBeenCalled();
  });
});

describe('getProductReviewsSummary — error key và distribution (L460, L468)', () => {
  it('throw catalog.productNotFound khi không tìm thấy (L460)', async () => {
    const { service } = makeService();
    await expect(service.getProductReviewsSummary({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });

  it('distribution chứa đúng key từ 1-5 và count đúng (L468)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({ id: 1, status: 'active' });
    catalogRepository.findProductRatingsSummary.mockResolvedValue({
      count: 4,
      average: 3.5,
      distribution: { 1: 1, 2: 0, 3: 1, 4: 0, 5: 2 },
    });

    const result = await service.getProductReviewsSummary({ id: 1 });
    expect(result.distribution[5]).toBe(2);
    expect(result.distribution[3]).toBe(1);
    expect(result.distribution[1]).toBe(1);
    expect(result.distribution[2]).toBe(0);
    expect(result.distribution[4]).toBe(0);
  });
});

describe('getProductVariants — error key đúng (L460)', () => {
  it('throw catalog.productNotFound khi không tìm thấy (L460 variant path)', async () => {
    const { service } = makeService();
    await expect(service.getProductVariants({ id: 99 })).rejects.toMatchObject({
      message: 'catalog.productNotFound',
    });
  });

  it('trả về variants object (L468)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({ id: 1, status: 'active' });
    catalogRepository.findProductVariantsByProductId.mockResolvedValue([{ id: 10 }, { id: 11 }]);

    const result = await service.getProductVariants({ id: 1 });
    expect(result).toHaveProperty('variants');
    expect(result.variants).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// _mapProductForList — compareAtPrice (L72)
// ═══════════════════════════════════════════════════════════════════════════

describe('_mapProductForList — compareAtPrice logic (L72)', () => {
  it('compareAtPrice = truthy → parseFloat (L72)', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: '15000', reviews: [] });
    const result = service._mapProductForList(product);
    expect(result.compareAtPrice).toBe(15000);
  });

  it('compareAtPrice = null → null (L72 || null)', () => {
    const { service } = makeService();
    const product = makeProductRow({ basePrice: '10000', compareAtPrice: null, reviews: [] });
    const result = service._mapProductForList(product);
    expect(result.compareAtPrice).toBeNull();
  });

  it('price = displayPrice từ _pickDisplayPrice (L71)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '20000',
      variants: [{ price: '15000' }, { price: '18000' }],
      reviews: [],
      compareAtPrice: null,
    });
    const result = service._mapProductForList(product);
    expect(result.price).toBe(15000); // giá thấp nhất
  });

  it('ratings được tính đúng trong _mapProductForList', () => {
    const { service } = makeService();
    const product = makeProductRow({
      basePrice: '10000',
      reviews: [{ rating: 4 }, { rating: 5 }],
      compareAtPrice: null,
    });
    const result = service._mapProductForList(product);
    expect(result.ratings.average).toBe(4.5);
    expect(result.ratings.count).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getAllProducts — compareAtPrice cho từng product (L258)
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllProducts — compareAtPrice per product (L258)', () => {
  it('compareAtPrice truthy → parseFloat trong result (L258 true)', async () => {
    const { service, catalogRepository } = makeService();
    const row = makeProductRow({ basePrice: '10000', compareAtPrice: '15000' });
    catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

    const { payload } = await service.getAllProducts({ page: 1 });
    expect(payload.data[0].compareAtPrice).toBe(15000);
  });

  it('compareAtPrice = null → null trong result (L258 false → || null)', async () => {
    const { service, catalogRepository } = makeService();
    const row = makeProductRow({ basePrice: '10000', compareAtPrice: null });
    catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

    const { payload } = await service.getAllProducts({ page: 1 });
    expect(payload.data[0].compareAtPrice).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Regex trong _buildProductDetailResponse — modelName extraction (L142)
// ═══════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — modelName regex (L142)', () => {
  it('tên bắt đầu bằng "Laptop " → regex loại bỏ prefix → modelName = phần sau (L142)', () => {
    const { service } = makeService();
    const product = {
      id: 1,
      name: 'Laptop Dell XPS 15',
      basePrice: '35000000',
      compareAtPrice: null,
      reviews: [],
      productImages: [],
      categories: [],
      variants: [
        {
          id: 1,
          price: '35000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Dell XPS 15 i7',
          displayName: 'Dell XPS 15 i7',
          isDefault: true,
          attributes: {},
          sku: 'S1',
        },
      ],
      toJSON() {
        const { toJSON, ...rest } = this;
        return { ...rest };
      },
    };
    const result = service._buildProductDetailResponse(product, {});
    // variantName 'Dell XPS 15 i7' chứa modelName 'Dell XPS 15' → fullName = variantName
    expect(result.name).toBe('Dell XPS 15 i7');
  });

  it('tên bắt đầu bằng "Điện thoại " → regex loại bỏ prefix (L142)', () => {
    const { service } = makeService();
    const product = {
      id: 2,
      name: 'Điện thoại iPhone 15',
      basePrice: '25000000',
      compareAtPrice: null,
      reviews: [],
      productImages: [],
      categories: [],
      variants: [
        {
          id: 2,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'iPhone 15 256GB',
          displayName: 'iPhone 15 256GB',
          isDefault: true,
          attributes: {},
          sku: 'S2',
        },
      ],
      toJSON() {
        const { toJSON, ...rest } = this;
        return { ...rest };
      },
    };
    const result = service._buildProductDetailResponse(product, {});
    // modelName = 'iPhone 15', variantName chứa 'iPhone 15' → fullName = variantName
    expect(result.name).toBe('iPhone 15 256GB');
  });

  it('variantName không chứa modelName → fullName = mainName + " - " + variantName (L146)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 3,
      name: 'Samsung Galaxy S24',
      basePrice: '22000000',
      reviews: [],
      variants: [
        {
          id: 3,
          price: '22000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: '256GB Tím',
          displayName: '256GB Tím',
          isDefault: true,
          attributes: {},
          sku: 'S3',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result.name).toBe('Samsung Galaxy S24 - 256GB Tím');
  });

  it('variantName lowercase comparison với mainName (L146)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 4,
      name: 'Galaxy S24',
      basePrice: '20000',
      reviews: [],
      variants: [
        {
          id: 4,
          price: '20000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'galaxy s24 ultra',
          isDefault: true,
          attributes: {},
          sku: 'S4',
          specifications: {},
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    // 'galaxy s24 ultra'.toLowerCase() chứa 'galaxy s24'.toLowerCase() → fullName = variantName
    expect(result.name).toBe('galaxy s24 ultra');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getProductsByBrand — offset calculation detail check (L68 arith)
// ═══════════════════════════════════════════════════════════════════════════

describe('getProductsByBrand — offset tính đúng cho page > 1 (L68)', () => {
  it('page=4, limit=5 → offset=15 (L68: (4-1)*5)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandBySlug.mockResolvedValue({ id: 5 });
    catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 100, rows: [] });

    await service.getProductsByBrand({ slug: 'brand', page: 4, limit: 5 });

    expect(catalogRepository.findProductsByBrandId).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ offset: 15 }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// brand numeric vs slug check (L13 catalog-brand-methods.js)
// ═══════════════════════════════════════════════════════════════════════════

describe('getAllBrands — isNumericId check (L13)', () => {
  it('categoryId là số → không gọi findCategoryBySlug (L13 true branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([1, 2]);
    catalogRepository.findAllBrands.mockResolvedValue([]);

    await service.getAllBrands({ categoryId: '5' });

    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
    expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith('5');
  });

  it('categoryId = "" (empty string) → !isNaN("") nhưng trim() = "" → isNumericId false (L13 edge)', async () => {
    // String("").trim() === "" → condition: !isNaN("") && String("").trim() !== ""
    // !isNaN("") = true (NaN is false) BUT String("").trim() !== "" = false → isNumericId = false
    const { service, catalogRepository } = makeService();
    // Với "" → isNumericId = false → gọi findCategoryBySlug
    // Nhưng "" là falsy → if (categoryId) block không vào
    // Vậy với categoryId = '' → filter = { hasProducts: true }
    catalogRepository.findAllBrands.mockResolvedValue([]);
    await service.getAllBrands({ categoryId: '' });
    // categoryId falsy → không enter if block → không call findBrandIdsByCategoryId
    expect(catalogRepository.findBrandIdsByCategoryId).not.toHaveBeenCalled();
  });

  it('categoryId là slug "phones" → gọi findCategoryBySlug (L13 false branch)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 10 });
    catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([]);
    catalogRepository.findAllBrands.mockResolvedValue([]);

    await service.getAllBrands({ categoryId: 'phones' });

    expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('phones');
    expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith(10);
  });

  it('String(categoryId).trim() được gọi để check numeric (L13: MethodExpression survivor)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([]);
    catalogRepository.findAllBrands.mockResolvedValue([]);

    // " 5 " → !isNaN(" 5 ") = true, String(" 5 ").trim() = "5" !== "" → isNumericId = true
    await service.getAllBrands({ categoryId: ' 5 ' });

    // Numeric → không gọi findCategoryBySlug
    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
    expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith(' 5 ');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Nullish coalescing operators (brand methods)
// ═══════════════════════════════════════════════════════════════════════════

describe('createBrand — ?? operator behavior (L38)', () => {
  it('isActive = true khi payload.isActive = null (L38: null ?? true → true)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createBrand({ payload: { name: 'Brand', isActive: null } });
    expect(catalogRepository.createBrand).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });
});

describe('createCategory — ?? operators (L45-L47)', () => {
  it('parentId = 10 khi truyền 10 (không dùng ?? null) (L45)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Sub', parentId: 10 } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 10 }),
    );
  });

  it('parentId = null khi truyền null (L45: null ?? null = null)', async () => {
    const { service, catalogRepository } = makeService();
    await service.createCategory({ payload: { name: 'Root', parentId: null } });
    expect(catalogRepository.createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: null }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// BlockStatement survivors — empty block
// catalog-product-methods.js: L331 (getRelatedProducts empty log block), L352 (searchProducts)
// ═══════════════════════════════════════════════════════════════════════════

describe('getRelatedProducts — fallback với log (L331)', () => {
  it('khi related rỗng → gọi fallback VÀ log thông báo (L331 block nên không empty)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5, status: 'active' });
    catalogRepository.findRelatedProducts.mockResolvedValue([]);
    catalogRepository.findRelatedProductsFallback.mockResolvedValue([makeProductRow({ id: 2 })]);

    const result = await service.getRelatedProducts({ id: 1, limit: 4 });

    // Block statement có logger.info → không empty
    expect(service.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Không tìm thấy sản phẩm liên quan'),
    );
    expect(result).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// getProductsByCategory — offset và sort (L94 arith)
// ═══════════════════════════════════════════════════════════════════════════

describe('getProductsByCategory — sort và order forwarded (L96)', () => {
  it('truyền đúng sort, order, status đến repository (L96 ObjectLiteral)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
    catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 5, rows: [] });

    await service.getProductsByCategory({ id: 1, sort: 'price', order: 'ASC', status: 'active' });

    expect(catalogRepository.findProductsByCategoryId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ sort: 'price', order: 'ASC', status: 'active' }),
    );
  });
});
