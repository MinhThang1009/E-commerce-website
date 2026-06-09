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
    expect(result.payload.data.id).toBe(1);
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
    catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5, status: 'active' });
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
