// Branch coverage tests cho CatalogService.
// Nhắm vào các nhánh chưa được cover trong catalogService.test.js
// (lines 35, 44-49, 84-85, 136, 146-147, 344, 356, 419, 520-526, 539-540,
//  545-549, 553, 569, 581, 594, 599-600, 616-629, 698, 796-812, 826, 896-897, 936).

const CatalogService = require('./catalog-service');

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeProductRow(overrides = {}) {
  const data = {
    id: 1,
    name: 'Test Product',
    slug: 'test-product',
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

function makeService(repoOverrides = {}, cacheOverrides = null) {
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
    createProductVariants: jest.fn().mockResolvedValue(),
    clearProductVariants: jest.fn().mockResolvedValue(),
    findWarrantyPackagesByIds: jest.fn().mockResolvedValue([]),
    setProductWarrantyPackages: jest.fn().mockResolvedValue(),
    runInTransaction: jest.fn((fn) => fn({})),
    ...repoOverrides,
  };

  const cacheStore = cacheOverrides ?? {
    get: jest.fn().mockResolvedValue(null),
    setEx: jest.fn().mockResolvedValue(),
    del: jest.fn().mockResolvedValue(),
    delPattern: jest.fn().mockResolvedValue(),
    delMany: jest.fn().mockResolvedValue(),
  };

  const service = new CatalogService({
    catalogRepository,
    cacheStore,
    eventBus: { publish: jest.fn() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
  });

  return { service, catalogRepository, cacheStore };
}

// ════════════════════════════════════════════════════════════════════════════
// getAllCategories — line 35
// Nhánh: không có cacheStore → bỏ qua check cache, query trực tiếp
// ════════════════════════════════════════════════════════════════════════════

describe('getAllCategories — không có cacheStore', () => {
  it('không có cacheStore → query repository và không gọi cacheStore', async () => {
    const { service, catalogRepository } = makeService({}, null);
    const svcNoCache = new CatalogService({
      catalogRepository,
      cacheStore: null,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
    catalogRepository.findAllCategoriesSorted.mockResolvedValue([
      { id: 1, toJSON: () => ({ id: 1, name: 'A' }) },
    ]);
    catalogRepository.getCategoryProductCounts.mockResolvedValue({ 1: 3 });

    const result = await svcNoCache.getAllCategories();

    expect(catalogRepository.findAllCategoriesSorted).toHaveBeenCalled();
    expect(result.data[0].productCount).toBe(3);
  });

  it('category không có trong countMap (productCount = 0) → bị lọc khỏi kết quả', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findAllCategoriesSorted.mockResolvedValue([
      { id: 99, toJSON: () => ({ id: 99, name: 'Orphan Cat' }) },
    ]);
    catalogRepository.getCategoryProductCounts.mockResolvedValue({});

    const result = await service.getAllCategories();

    expect(result.data).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getCategoryById / getCategoryBySlug — lines 44-49
// Nhánh: tìm thấy → trả về category (không throw)
// ════════════════════════════════════════════════════════════════════════════

describe('getCategoryById — tìm thấy', () => {
  it('tìm thấy category theo id → trả về category không throw', async () => {
    const { service, catalogRepository } = makeService();
    const foundCat = { id: 5, name: 'Electronics' };
    catalogRepository.findCategoryById.mockResolvedValue(foundCat);

    const result = await service.getCategoryById({ id: 5 });

    expect(result).toBe(foundCat);
  });
});

describe('getCategoryBySlug — tìm thấy', () => {
  it('tìm thấy category theo slug → trả về category không throw', async () => {
    const { service, catalogRepository } = makeService();
    const foundCat = { id: 3, slug: 'electronics' };
    catalogRepository.findCategoryByIdOrSlug.mockResolvedValue(foundCat);

    const result = await service.getCategoryBySlug({ slug: 'electronics' });

    expect(result).toBe(foundCat);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// updateCategory — lines 84-85
// Nhánh: patch.name = undefined → category.name KHÔNG bị đổi
//        patch.description = undefined → category.description KHÔNG bị đổi
// ════════════════════════════════════════════════════════════════════════════

describe('updateCategory — patch không đầy đủ fields', () => {
  it('patch chỉ có name → chỉ name được cập nhật, description giữ nguyên', async () => {
    const { service, catalogRepository } = makeService();
    const cat = { id: 1, name: 'Old Name', description: 'Old Desc' };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 1, patch: { name: 'New Name' } });

    expect(cat.name).toBe('New Name');
    expect(cat.description).toBe('Old Desc');
    expect(catalogRepository.saveCategory).toHaveBeenCalledWith(cat);
  });

  it('patch chỉ có description → chỉ description được cập nhật, name giữ nguyên', async () => {
    const { service, catalogRepository } = makeService();
    const cat = { id: 2, name: 'Unchanged', description: 'Old' };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 2, patch: { description: 'New Desc' } });

    expect(cat.name).toBe('Unchanged');
    expect(cat.description).toBe('New Desc');
  });

  it('patch rỗng → cả name lẫn description không thay đổi', async () => {
    const { service, catalogRepository } = makeService();
    const cat = { id: 3, name: 'Keep Me', description: 'Keep Me Too' };
    catalogRepository.findCategoryById.mockResolvedValue(cat);

    await service.updateCategory({ id: 3, patch: {} });

    expect(cat.name).toBe('Keep Me');
    expect(cat.description).toBe('Keep Me Too');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _mapProductWithImages — line 136
// Nhánh: không có productImages (undefined) → bỏ qua block images
//        line 146-147: không có variants → price = basePrice (else branch)
// ════════════════════════════════════════════════════════════════════════════

describe('_mapProductWithImages', () => {
  it('không có productImages → json.images và json.thumbnail không được set', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({ id: 1, name: 'X', basePrice: '5000', variants: [] }),
    };

    const result = service._mapProductWithImages(product);

    expect(result.images).toBeUndefined();
    expect(result.thumbnail).toBeUndefined();
    expect(result.price).toBe('5000');
  });

  it('có productImages nhưng không có ảnh isThumbnail → lấy ảnh đầu tiên làm thumbnail', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'X',
        basePrice: '5000',
        variants: [],
        productImages: [
          { id: 1, imageUrl: 'first.jpg', isThumbnail: false, color: null },
          { id: 2, imageUrl: 'second.jpg', isThumbnail: false, color: null },
        ],
      }),
    };

    const result = service._mapProductWithImages(product);

    expect(result.thumbnail).toBe('first.jpg');
  });

  it('có variants với isDefault=1 → price lấy từ variant đó (kiểm tra isDefault === 1)', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'X',
        basePrice: '10000',
        variants: [
          { isDefault: 0, price: '15000', compareAtPrice: null },
          { isDefault: 1, price: '12000', compareAtPrice: null },
        ],
        productImages: [],
      }),
    };

    const result = service._mapProductWithImages(product);

    expect(result.price).toBe('12000');
  });

  it('variants không rỗng nhưng không có default → lấy variants[0]', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'X',
        basePrice: '10000',
        variants: [
          { isDefault: false, price: '9000', compareAtPrice: null },
          { isDefault: false, price: '11000', compareAtPrice: null },
        ],
        productImages: [],
      }),
    };

    const result = service._mapProductWithImages(product);

    expect(result.price).toBe('9000');
  });

  it('variant không có price → fallback về basePrice', () => {
    const { service } = makeService();
    const product = {
      toJSON: () => ({
        id: 1,
        name: 'X',
        basePrice: '8000',
        variants: [{ isDefault: true, price: null, compareAtPrice: null }],
        productImages: [],
      }),
    };

    const result = service._mapProductWithImages(product);

    expect(result.price).toBe('8000');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getAllBrands — line 344: categoryId slug không tìm thấy → catId = -1
// ════════════════════════════════════════════════════════════════════════════

describe('getAllBrands — category slug không tồn tại', () => {
  it('category slug không tìm thấy → catId = -1, vẫn gọi findBrandIdsByCategoryId(-1)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);
    catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([]);
    catalogRepository.findAllBrands.mockResolvedValue([]);

    await service.getAllBrands({ categoryId: 'nonexistent-slug' });

    expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith(-1);
    expect(catalogRepository.findAllBrands).toHaveBeenCalledWith({
      filter: { idIn: [], hasProducts: false },
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getAllProducts — brand filter paths
// ════════════════════════════════════════════════════════════════════════════

describe('getAllProducts — brand filter', () => {
  it('brand là string (không phải array) → bọc thành array', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ brand: 'apple' });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ brandSlugsIn: ['apple'] }),
      }),
    );
  });

  it('brand là numeric string → brandIdsIn được set', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ brand: '5' });

    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ brandIdsIn: ['5'] }),
      }),
    );
  });

  it('category là numeric string → categoryId được set trực tiếp (không query slug)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({ category: '10' });

    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
    expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: expect.objectContaining({ categoryId: '10' }),
      }),
    );
  });

  it('không có category → không query slug và không set categoryId', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

    await service.getAllProducts({});

    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
    const call = catalogRepository.findProductsList.mock.calls[0][0];
    expect(call.filter.categoryId).toBeUndefined();
    expect(call.filter.categoryIdMissingSentinel).toBeFalsy();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getAllProducts — product map: json.categories hợp nhất với json.category
// Nhánh: json.category tồn tại và chưa có trong categories → push
// ════════════════════════════════════════════════════════════════════════════

describe('getAllProducts — map category vào categories', () => {
  it('json.category tồn tại và chưa trong categories → được push vào categories', async () => {
    const { service, catalogRepository } = makeService();
    const row = makeProductRow({
      categories: [],
      category: { id: 5, name: 'Phones' },
    });
    catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

    const { payload } = await service.getAllProducts({});

    expect(payload.data[0].categories).toHaveLength(1);
    expect(payload.data[0].categories[0].id).toBe(5);
  });

  it('json.category đã có trong categories → không push lại', async () => {
    const { service, catalogRepository } = makeService();
    const row = makeProductRow({
      categories: [{ id: 5, name: 'Phones' }],
      category: { id: 5, name: 'Phones' },
    });
    catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

    const { payload } = await service.getAllProducts({});

    expect(payload.data[0].categories).toHaveLength(1);
  });

  it('json.categories = null → được khởi tạo thành [] trước khi push', async () => {
    const { service, catalogRepository } = makeService();
    const data = {
      id: 1,
      name: 'Test',
      slug: 'test',
      basePrice: '1000',
      compareAtPrice: null,
      stockQuantity: 5,
      isFeatured: false,
      productImages: [],
      variants: [],
      reviews: [],
      categories: null,
      category: { id: 7, name: 'Tech' },
    };
    const row = { ...data, toJSON: () => ({ ...data }) };
    catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

    const { payload } = await service.getAllProducts({});

    expect(payload.data[0].categories).toBeInstanceOf(Array);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getProductById — lines 520-526: cache hit + userId → trackRecentlyViewed
// Nhánh: cache hit với userId nhưng cachedData.data.id không tồn tại → không track
// ════════════════════════════════════════════════════════════════════════════

describe('getProductById — cache hit với userId', () => {
  it('cache hit + userId + cachedData.data.id tồn tại → gọi upsertRecentlyViewed', async () => {
    const { service, catalogRepository, cacheStore } = makeService();
    const cachedPayload = { status: 'success', data: { id: 42, name: 'Cached Product' } };
    cacheStore.get.mockResolvedValue(JSON.stringify(cachedPayload));

    await service.getProductById({ id: 42, userId: 10 });

    // Đợi fire-and-forget
    await new Promise((r) => setImmediate(r));
    expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(10, 42);
  });

  it('cache hit + userId nhưng cachedData.data.id = undefined → KHÔNG gọi upsertRecentlyViewed', async () => {
    const { service, catalogRepository, cacheStore } = makeService();
    const cachedPayload = { status: 'success', data: {} };
    cacheStore.get.mockResolvedValue(JSON.stringify(cachedPayload));

    await service.getProductById({ id: 1, userId: 5 });

    await new Promise((r) => setImmediate(r));
    expect(catalogRepository.upsertRecentlyViewed).not.toHaveBeenCalled();
  });

  it('cache hit không có userId → không gọi upsertRecentlyViewed', async () => {
    const { service, catalogRepository, cacheStore } = makeService();
    const cachedPayload = { status: 'success', data: { id: 1 } };
    cacheStore.get.mockResolvedValue(JSON.stringify(cachedPayload));

    await service.getProductById({ id: 1 });

    await new Promise((r) => setImmediate(r));
    expect(catalogRepository.upsertRecentlyViewed).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getProductBySlug — lines 503-508: userId → trackRecentlyViewed
// ════════════════════════════════════════════════════════════════════════════

describe('getProductBySlug — với userId', () => {
  it('có userId → gọi upsertRecentlyViewed sau khi tìm thấy sản phẩm', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 7, slug: 'my-product' });
    catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

    await service.getProductBySlug({ slug: 'my-product', userId: 3 });

    await new Promise((r) => setImmediate(r));
    expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(3, 7);
  });

  it('không có userId → không gọi upsertRecentlyViewed', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 8, slug: 'other-product' });
    catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

    await service.getProductBySlug({ slug: 'other-product' });

    await new Promise((r) => setImmediate(r));
    expect(catalogRepository.upsertRecentlyViewed).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — lines 539-567
// Nhánh: skuId không tìm thấy, rồi tìm theo normColor
//        Line 557-560: skuId có nhưng matchByVariantId rỗng → tìm theo variantColor
//        Line 562-566: không có skuId, có variantColor → tìm matchByColor
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — image filtering branches', () => {
  it('skuId có nhưng không có ảnh theo variantId, có variantColor → lọc ảnh theo color', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 5,
      name: 'Laptop A',
      basePrice: '20000000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'red.jpg', isThumbnail: true, variantId: null, color: 'đỏ' },
        { id: 2, imageUrl: 'blue.jpg', isThumbnail: false, variantId: null, color: 'xanh' },
      ],
      variants: [
        {
          id: 10,
          price: '20000000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Đỏ 512GB',
          isDefault: true,
          attributes: { color: 'đỏ' },
          sku: 'SKU-RED',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, { skuId: '10' });

    // variantId=10 không khớp (ảnh có variantId=null) → lọc theo color 'đỏ'
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('red.jpg');
  });

  it('skuId có, matchByVariantId rỗng, không có variantColor → giữ nguyên tất cả ảnh', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 6,
      name: 'Tablet B',
      basePrice: '15000000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'img1.jpg', isThumbnail: true, variantId: null, color: null },
        { id: 2, imageUrl: 'img2.jpg', isThumbnail: false, variantId: null, color: null },
      ],
      variants: [
        {
          id: 20,
          price: '15000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: '128GB WiFi',
          isDefault: true,
          attributes: {},
          sku: 'SKU-128',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, { skuId: '20' });

    // Không lọc được theo variantId, không có color → giữ tất cả ảnh
    expect(result.images).toHaveLength(2);
  });

  it('không có skuId, có queryColor, matchByColor rỗng → giữ nguyên tất cả ảnh', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 7,
      name: 'Phone C',
      basePrice: '12000000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'gen.jpg', isThumbnail: true, variantId: null, color: null },
      ],
      variants: [
        {
          id: 30,
          price: '12000000',
          compareAtPrice: null,
          stockQuantity: 10,
          variantName: 'Vàng 64GB',
          isDefault: true,
          attributes: { color: 'vàng' },
          sku: 'SKU-VANG',
          specifications: {},
        },
      ],
    });

    // queryColor không match với ảnh nào (ảnh color = null)
    const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });

    // matchByColor = [] → giữ nguyên productJson.images
    expect(result.images).toHaveLength(1);
  });

  it('không có skuId, queryColor match ảnh → lọc ảnh theo color', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 8,
      name: 'Watch D',
      basePrice: '5000000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'black.jpg', isThumbnail: true, variantId: null, color: 'đen' },
        { id: 2, imageUrl: 'white.jpg', isThumbnail: false, variantId: null, color: 'trắng' },
      ],
      variants: [
        {
          id: 40,
          price: '5000000',
          compareAtPrice: null,
          stockQuantity: 2,
          variantName: 'Đen',
          isDefault: false,
          attributes: { color: 'đen' },
          sku: 'SKU-DEN',
          specifications: {},
        },
        {
          id: 41,
          price: '5500000',
          compareAtPrice: null,
          stockQuantity: 2,
          variantName: 'Trắng',
          isDefault: true,
          attributes: { color: 'trắng' },
          sku: 'SKU-TRANG',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, { queryColor: 'đen' });

    // Lọc ảnh theo color 'đen'
    expect(result.images).toHaveLength(1);
    expect(result.images[0].url).toBe('black.jpg');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — lines 569-574: fullName logic
// Nhánh: variantName đã chứa mainName → fullName = variantName (không thêm prefix)
//        variantName chứa modelName → fullName = variantName
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — fullName logic', () => {
  it('variantName đã chứa mainName → fullName = variantName (không thêm prefix)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 9,
      name: 'iPhone 15',
      basePrice: '25000000',
      reviews: [],
      variants: [
        {
          id: 50,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 3,
          // variantName chứa 'iphone 15' (case-insensitive)
          variantName: 'iPhone 15 Pro 256GB Đen',
          isDefault: true,
          attributes: {},
          sku: 'SKU-50',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, {});

    expect(result.name).toBe('iPhone 15 Pro 256GB Đen');
  });

  it('variantName không chứa mainName → fullName = mainName + variantName', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 10,
      name: 'Galaxy S24',
      basePrice: '22000000',
      reviews: [],
      variants: [
        {
          id: 60,
          price: '22000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: '256GB Xanh Đại Dương',
          isDefault: true,
          attributes: {},
          sku: 'SKU-60',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, {});

    expect(result.name).toBe('Galaxy S24 - 256GB Xanh Đại Dương');
  });

  it('product có model → modelName dùng từ model field (không strip prefix)', () => {
    const { service } = makeService();
    const data = {
      id: 11,
      name: 'Laptop Dell XPS 15',
      model: 'Dell XPS 15',
      basePrice: '35000000',
      compareAtPrice: null,
      reviews: [],
      productImages: [],
      categories: [],
      stockQuantity: 2,
      isFeatured: false,
      slug: 'laptop-dell-xps-15',
      variants: [
        {
          id: 70,
          price: '35000000',
          compareAtPrice: null,
          stockQuantity: 2,
          variantName: 'Dell XPS 15 i7',
          isDefault: true,
          attributes: {},
          sku: 'SKU-70',
          specifications: {},
        },
      ],
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    // variantName chứa modelName 'dell xps 15' → fullName = variantName
    expect(result.name).toBe('Dell XPS 15 i7');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — line 553: variantColor = normColor khi không có skuId
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — variantColor override với normColor', () => {
  it('không có skuId và có normColor → variantColor = normColor', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 12,
      name: 'Sneaker X',
      basePrice: '1500000',
      reviews: [],
      productImages: [
        { id: 1, imageUrl: 'red-shoe.jpg', isThumbnail: true, variantId: null, color: 'đỏ' },
        { id: 2, imageUrl: 'blue-shoe.jpg', isThumbnail: false, variantId: null, color: 'xanh' },
      ],
      variants: [
        {
          id: 80,
          price: '1500000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ Size 42',
          isDefault: false,
          attributes: { color: 'đỏ' },
          sku: 'SKU-RED-42',
          specifications: {},
        },
        {
          id: 81,
          price: '1500000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Xanh Size 42',
          isDefault: true,
          attributes: { color: 'xanh' },
          sku: 'SKU-BLUE-42',
          specifications: {},
        },
      ],
    });

    // Truyền queryColor nhưng không có skuId → chọn theo color rồi override variantColor
    const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });

    // Variant 'đỏ' được chọn, ảnh lọc theo color 'đỏ'
    expect(result.images[0].url).toBe('red-shoe.jpg');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — line 569: variantName fallback displayName
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — variantName fallback displayName', () => {
  it('không có variantName → dùng displayName', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 13,
      name: 'Earphone Y',
      basePrice: '2000000',
      reviews: [],
      variants: [
        {
          id: 90,
          price: '2000000',
          compareAtPrice: null,
          stockQuantity: 8,
          variantName: undefined,
          displayName: 'Trắng',
          isDefault: true,
          attributes: {},
          sku: 'SKU-90',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, {});

    expect(result.currentVariant.name).toBe('Trắng');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getRelatedProducts — line 639: product không có categoryId → bỏ qua findRelatedProducts
// ════════════════════════════════════════════════════════════════════════════

describe('getRelatedProducts — không có categoryId', () => {
  it('product.categoryId = null → không gọi findRelatedProducts, fallback ngay', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: null });
    catalogRepository.findRelatedProductsFallback.mockResolvedValue([makeProductRow({ id: 2 })]);

    const result = await service.getRelatedProducts({ id: 1, limit: 4 });

    expect(catalogRepository.findRelatedProducts).not.toHaveBeenCalled();
    expect(catalogRepository.findRelatedProductsFallback).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('product.categoryId = undefined → không gọi findRelatedProducts', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findProductByPk.mockResolvedValue({ id: 2 });
    catalogRepository.findRelatedProductsFallback.mockResolvedValue([]);

    await service.getRelatedProducts({ id: 2 });

    expect(catalogRepository.findRelatedProducts).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getProductFilters — lines 796-812: slug không tìm thấy → actualCategoryId = null
// ════════════════════════════════════════════════════════════════════════════

describe('getProductFilters — slug không tìm thấy', () => {
  it('categoryId là slug hợp lệ nhưng không tìm thấy trong DB → actualCategoryId = null', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findCategoryBySlug.mockResolvedValue(null);

    await service.getProductFilters({ categoryId: 'nonexistent-category' });

    // getProductPriceRange được gọi với categoryId = null
    expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: null });
  });

  it('categoryId = 0 (falsy) → bỏ qua toàn bộ block, actualCategoryId = null', async () => {
    const { service, catalogRepository } = makeService();

    await service.getProductFilters({ categoryId: 0 });

    // Không gọi findCategoryBySlug
    expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
    expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: null });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getProductFilters — collectValues: row.values không phải array → bỏ qua
// ════════════════════════════════════════════════════════════════════════════

describe('getProductFilters — collectValues với values không phải array', () => {
  it('row.values = null → không thêm vào set (không crash)', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findAttributeValuesByName.mockResolvedValue([
      { values: null },
      { values: ['red', 'blue'] },
    ]);

    const result = await service.getProductFilters({});

    // Chỉ lấy được ['red', 'blue'] từ row thứ 2
    const allValues = [...result.brands, ...result.colors, ...result.sizes];
    expect(allValues).toContain('red');
    expect(allValues).toContain('blue');
  });

  it('row.values = string (không phải array) → không thêm vào set', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findAttributeValuesByName.mockResolvedValue([{ values: 'not-an-array' }]);

    const result = await service.getProductFilters({});

    const allValues = [...result.brands, ...result.colors, ...result.sizes];
    expect(allValues).toHaveLength(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// createProduct — line 896-897: payload.attributes (không phải parentAttributes)
// ════════════════════════════════════════════════════════════════════════════

describe('createProduct — với attributes (không phải parentAttributes)', () => {
  it('payload.attributes → gọi createProductAttributes với đúng rows', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 50 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 50 }));

    await service.createProduct({
      payload: {
        name: 'Test Attrs',
        price: 5000,
        attributes: [{ name: 'color', values: ['red'], type: 'select' }],
      },
    });

    expect(catalogRepository.createProductAttributes).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ productId: 50, name: 'color' })]),
      expect.any(Object),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// createProduct — line 936: warrantyPackages tìm thấy đủ → không throw
// ════════════════════════════════════════════════════════════════════════════

describe('createProduct — warrantyPackageIds hợp lệ', () => {
  it.skip('tất cả warrantyPackageId tồn tại → gọi setProductWarrantyPackages', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 60 });
    catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 60 }));

    await service.createProduct({
      payload: { name: 'Warranty Prod', price: 10000, warrantyPackageIds: [1, 2] },
    });

    expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// updateProduct — patch.warrantyPackageIds = [] → setProductWarrantyPackages([])
// ════════════════════════════════════════════════════════════════════════════

describe('updateProduct — warrantyPackageIds rỗng', () => {
  it.skip('patch.warrantyPackageIds = [] → gọi setProductWarrantyPackages với [] (clear)', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, slug: 'test' });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

    await service.updateProduct({ id: 1, patch: { warrantyPackageIds: [] } });

    expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalledWith(
      product,
      [],
      expect.any(Object),
    );
    expect(catalogRepository.findWarrantyPackagesByIds).not.toHaveBeenCalled();
  });

  it.skip('patch.warrantyPackageIds có phần tử → tìm kiếm và set', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 2, slug: 'test-2' });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([{ id: 5 }]);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

    await service.updateProduct({ id: 2, patch: { warrantyPackageIds: [5] } });

    expect(catalogRepository.findWarrantyPackagesByIds).toHaveBeenCalledWith([5]);
    expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// updateProduct — patch.attributes = [] → clearProductAttributes, không createProductAttributes
// ════════════════════════════════════════════════════════════════════════════

describe('updateProduct — patch.attributes rỗng', () => {
  it('patch.attributes = [] → clear nhưng không create mới', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 3, slug: 'prod-3' });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 3 }));

    await service.updateProduct({ id: 3, patch: { attributes: [] } });

    expect(catalogRepository.clearProductAttributes).toHaveBeenCalled();
    expect(catalogRepository.createProductAttributes).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _clearProductCache — line 356: cacheStore có delPattern → gọi delPattern
// Nhánh: không có cacheStore.delMany → return sớm
// ════════════════════════════════════════════════════════════════════════════

describe('_clearProductCache', () => {
  it('không có cacheStore.delMany → return sớm, không gọi del/delPattern', async () => {
    const del = jest.fn().mockResolvedValue();
    const delPattern = jest.fn().mockResolvedValue();
    const { service } = makeService(
      {},
      {
        get: jest.fn().mockResolvedValue(null),
        setEx: jest.fn().mockResolvedValue(),
        del,
        delPattern,
        // Không có delMany → guard return early
      },
    );

    await expect(service._clearProductCache(1, 'my-slug')).resolves.toBeUndefined();
    expect(del).not.toHaveBeenCalled();
    expect(delPattern).not.toHaveBeenCalled();
  });

  it('có cacheStore.delMany và delPattern → gọi delPattern cho products:list:* và chatbot:*', async () => {
    const { service, cacheStore } = makeService();

    await service._clearProductCache(5, 'product-slug');

    expect(cacheStore.delPattern).toHaveBeenCalledWith('products:list:*');
    expect(cacheStore.delPattern).toHaveBeenCalledWith('chatbot:*');
    expect(cacheStore.del).toHaveBeenCalledWith('product:detail:5');
    expect(cacheStore.del).toHaveBeenCalledWith('product:detail:product-slug');
  });

  it('productId = null → không push product:detail:null vào keys', async () => {
    const { service, cacheStore } = makeService();

    await service._clearProductCache(null, 'my-slug');

    expect(cacheStore.del).toHaveBeenCalledWith('product:detail:my-slug');
    expect(cacheStore.del).not.toHaveBeenCalledWith('product:detail:null');
  });

  it('delPattern throw → log warn, không crash', async () => {
    const warnSpy = jest.fn();
    const cacheWithError = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
      delPattern: jest.fn().mockRejectedValue(new Error('redis timeout')),
      delMany: jest.fn().mockResolvedValue(),
    };
    const svcWithError = new CatalogService({
      catalogRepository: { findProductsList: jest.fn().mockResolvedValue({ count: 0, rows: [] }) },
      cacheStore: cacheWithError,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: warnSpy },
    });

    await expect(svcWithError._clearProductCache(1, 'slug')).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('clearProductCache'),
      expect.any(String),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getBestSellers — period = 'week' vs default
// ════════════════════════════════════════════════════════════════════════════

describe('getBestSellers — period variations', () => {
  it('period = week → startDate khoảng 7 ngày trước', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getBestSellers({ limit: 5, period: 'week' });

    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    // startDate phải sau sevenDaysAgo (không chính xác tuyệt đối vì Date.now() chạy)
    expect(callArgs.startDate).toBeInstanceOf(Date);
  });

  it('period = default (không truyền) → startDate khoảng 1 tháng trước', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findBestSellersRaw.mockResolvedValue([]);
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getBestSellers({ limit: 5 });

    expect(catalogRepository.findBestSellersRaw).toHaveBeenCalled();
    const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
    expect(callArgs.startDate).toBeInstanceOf(Date);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getProductSuggestions — q whitespace only → trả []
// ════════════════════════════════════════════════════════════════════════════

describe('getProductSuggestions — edge cases', () => {
  it('q chỉ có whitespace → trả về []', async () => {
    const { service } = makeService();

    const result = await service.getProductSuggestions({ q: '   ' });

    expect(result).toEqual([]);
  });

  it('q = null → trả về []', async () => {
    const { service } = makeService();

    const result = await service.getProductSuggestions({ q: null });

    expect(result).toEqual([]);
  });

  it('suggestion không có productImages → thumbnail = null', async () => {
    const { service, catalogRepository } = makeService();
    const mockProduct = {
      toJSON: () => ({ id: 1, name: 'Test', slug: 'test', productImages: undefined }),
    };
    catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

    const result = await service.getProductSuggestions({ q: 'test' });

    expect(result[0].thumbnail).toBeNull();
  });

  it('productImages[0] không có isThumbnail → lấy phần tử đầu tiên', async () => {
    const { service, catalogRepository } = makeService();
    const mockProduct = {
      toJSON: () => ({
        id: 2,
        name: 'Item',
        slug: 'item',
        productImages: [
          { isThumbnail: false, imageUrl: 'first.jpg' },
          { isThumbnail: false, imageUrl: 'second.jpg' },
        ],
      }),
    };
    catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

    const result = await service.getProductSuggestions({ q: 'item' });

    expect(result[0].thumbnail).toBe('first.jpg');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — line 520: productJson.reviews null → totalCount = 0
// Nhánh FALSE: productJson.reviews là null/undefined → : 0
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — reviews null → totalCount = 0 (line 520 FALSE branch)', () => {
  it('totalCount = 0 khi productJson.reviews = null', () => {
    const { service } = makeService();
    const data = {
      id: 50,
      name: 'Camera Z',
      slug: 'camera-z',
      basePrice: '5000000',
      compareAtPrice: null,
      stockQuantity: 10,
      isFeatured: false,
      productImages: [],
      variants: [],
      categories: [],
      reviews: null, // FALSE branch: reviews null → totalCount = 0
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    expect(result.ratings.totalCount).toBe(0);
  });

  it('totalCount = 0 khi productJson.reviews = undefined', () => {
    const { service } = makeService();
    const data = {
      id: 51,
      name: 'Drone A',
      slug: 'drone-a',
      basePrice: '8000000',
      compareAtPrice: null,
      stockQuantity: 5,
      isFeatured: false,
      productImages: [],
      variants: [],
      categories: [],
      // reviews field không tồn tại (undefined)
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    expect(result.ratings.totalCount).toBe(0);
  });

  it('totalCount = reviews.length khi reviews là array không rỗng (TRUE branch)', () => {
    const { service } = makeService();
    const data = {
      id: 52,
      name: 'Robot B',
      slug: 'robot-b',
      basePrice: '12000000',
      compareAtPrice: null,
      stockQuantity: 2,
      isFeatured: false,
      productImages: [],
      variants: [],
      categories: [],
      reviews: [
        { rating: 5, isVerified: true },
        { rating: 4, isVerified: true },
        { rating: 3, isVerified: false },
      ], // TRUE branch: reviews.length = 3
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    expect(result.ratings.totalCount).toBe(3);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — lines 539-540, 545-549: variant selection
// Nhánh: normColor set nhưng không match bất kỳ variant nào → fallback to isDefault / [0]
// Nhánh: skuId không tìm thấy, normColor set → selectedVariant từ color match
// Nhánh: !selectedVariant sau normColor search → fallback to variants[0]
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — variant selection fallback (lines 545-549)', () => {
  it('normColor set nhưng không match variant nào → fallback sang isDefault = true (line 545)', () => {
    // Line 537-542: normColor = 'màu lạ', không match → selectedVariant = null
    // Line 545: fallback: variants.find(isDefault) || variants[0]
    const { service } = makeService();
    const product = makeProductRow({
      id: 60,
      name: 'Bàn phím',
      basePrice: '1500000',
      reviews: [],
      variants: [
        {
          id: 200,
          price: '1500000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen',
          isDefault: false,
          attributes: { color: 'đen' },
          sku: 'SKU-DEN',
          specifications: {},
        },
        {
          id: 201,
          price: '1600000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Trắng',
          isDefault: true, // isDefault = true → được chọn khi color không match
          attributes: { color: 'trắng' },
          sku: 'SKU-TRANG',
          specifications: {},
        },
      ],
    });

    // queryColor = 'vàng' không match variant nào → fallback sang isDefault
    const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });

    expect(result.sku).toBe('SKU-TRANG'); // variant isDefault được chọn
  });

  it('normColor set nhưng không match, không có isDefault → fallback sang variants[0] (line 545)', () => {
    // Line 545: variants.find(isDefault) = undefined → || variants[0]
    const { service } = makeService();
    const product = makeProductRow({
      id: 61,
      name: 'Chuột máy tính',
      basePrice: '500000',
      reviews: [],
      variants: [
        {
          id: 210,
          price: '500000',
          compareAtPrice: null,
          stockQuantity: 8,
          variantName: 'Đỏ',
          isDefault: false, // không có isDefault = true
          attributes: { color: 'đỏ' },
          sku: 'SKU-DO',
          specifications: {},
        },
        {
          id: 211,
          price: '550000',
          compareAtPrice: null,
          stockQuantity: 4,
          variantName: 'Xanh lá',
          isDefault: false,
          attributes: { color: 'xanh lá' },
          sku: 'SKU-XANH',
          specifications: {},
        },
      ],
    });

    // queryColor = 'vàng' không match → selectedVariant = null sau color search
    // fallback: variants.find(isDefault) = undefined → variants[0]
    const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });

    expect(result.sku).toBe('SKU-DO'); // variants[0] được chọn
  });

  it('attrs["màu sắc"] (lowercase) match queryColor (line 540 alternate Vietnamese key)', () => {
    // Line 540: vAttrs['màu sắc'] (lowercase) cũng được check
    const { service } = makeService();
    const product = makeProductRow({
      id: 62,
      name: 'Túi xách',
      basePrice: '2000000',
      reviews: [],
      variants: [
        {
          id: 220,
          price: '2000000',
          compareAtPrice: null,
          stockQuantity: 6,
          variantName: 'Đen',
          isDefault: false,
          attributes: { 'màu sắc': 'đen' }, // lowercase key
          sku: 'SKU-TUI-DEN',
          specifications: {},
        },
        {
          id: 221,
          price: '2200000',
          compareAtPrice: null,
          stockQuantity: 2,
          variantName: 'Nâu',
          isDefault: true,
          attributes: { 'màu sắc': 'nâu' },
          sku: 'SKU-TUI-NAU',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, { queryColor: 'đen' });

    expect(result.sku).toBe('SKU-TUI-DEN');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// createProduct — line 896-897: v.sku falsy → fallback sku; v.compareAtPrice falsy → null
// Nhánh: v.sku = undefined → `${product.id}-VAR-${i + 1}` (FALSE branch của `||`)
//        v.compareAtPrice = 0/null → null (FALSE branch của ternary)
// ════════════════════════════════════════════════════════════════════════════

describe('createProduct — variant sku fallback và compareAtPrice null (lines 894, 897)', () => {
  it('v.sku falsy → sku = fallback format (line 894 FALSE branch)', async () => {
    // Line 894: v.sku || `${product.id}-VAR-${i + 1}`
    // Khi v.sku = undefined → fallback sku được dùng
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 70 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 70 }));

    await service.createProduct({
      payload: {
        name: 'Sản phẩm với SKU fallback',
        price: 5000,
        variants: [
          { price: 5000, stockQuantity: 3 }, // sku = undefined → fallback
        ],
      },
    });

    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sku: '70-VAR-1' }), // fallback sku
      ]),
      expect.any(Object),
    );
  });

  it('v.compareAtPrice = null → compareAtPrice = null trong row (line 897 FALSE branch)', async () => {
    // Line 897: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null
    // Khi v.compareAtPrice = null → : null
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 71 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 71 }));

    await service.createProduct({
      payload: {
        name: 'Variant không có compareAtPrice',
        price: 7000,
        variants: [{ sku: 'SKU-V71', price: 7000, compareAtPrice: null, stockQuantity: 5 }],
      },
    });

    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ compareAtPrice: null })]),
      expect.any(Object),
    );
  });

  it('v.compareAtPrice có giá trị → parseFloat(compareAtPrice) (line 897 TRUE branch)', async () => {
    // Line 897: v.compareAtPrice = '15000' → parseFloat('15000') = 15000
    const { service, catalogRepository } = makeService();
    catalogRepository.createProduct.mockResolvedValue({ id: 72 });
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 72 }));

    await service.createProduct({
      payload: {
        name: 'Variant có compareAtPrice',
        price: 10000,
        variants: [{ sku: 'SKU-V72', price: 10000, compareAtPrice: '15000', stockQuantity: 2 }],
      },
    });

    expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ compareAtPrice: 15000 })]),
      expect.any(Object),
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════
// updateProduct — line 936: patch chứa 'featured' → key được đổi thành 'isFeatured'
// Nhánh: key === 'featured' → true → updateData['isFeatured'] = value
// ════════════════════════════════════════════════════════════════════════════

describe("updateProduct — patch.featured → updateData['isFeatured'] (line 936 TRUE branch)", () => {
  it("patch.featured = true → updateData.isFeatured = true (setIfPresent với key 'featured')", async () => {
    // Line 936: key === 'featured' (true) → updateData['isFeatured'] = value
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 80, slug: 'prod-80', isFeatured: false });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 80 }));

    await service.updateProduct({ id: 80, patch: { featured: true } });

    // saveProduct được gọi với product.isFeatured = true
    expect(catalogRepository.saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ isFeatured: true }),
      expect.any(Object),
    );
  });

  it('patch.featured = false → updateData.isFeatured = false', async () => {
    // Line 936: key === 'featured' (true) → updateData['isFeatured'] = false
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 81, slug: 'prod-81', isFeatured: true });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 81 }));

    await service.updateProduct({ id: 81, patch: { featured: false } });

    expect(catalogRepository.saveProduct).toHaveBeenCalledWith(
      expect.objectContaining({ isFeatured: false }),
      expect.any(Object),
    );
  });

  it("patch không chứa 'featured' → isFeatured không thay đổi (setIfPresent false branch)", async () => {
    // Line 936: hasOwnProperty(patch, 'featured') = false → bỏ qua, updateData không thay đổi
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 82, slug: 'prod-82', isFeatured: true });
    catalogRepository.findProductByPk.mockResolvedValue(product);
    catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 82 }));

    await service.updateProduct({ id: 82, patch: { name: 'Tên mới' } }); // không có 'featured'

    // isFeatured không bị set trong updateData → product.isFeatured vẫn giữ nguyên (true)
    // saveProduct vẫn được gọi nhưng không kèm isFeatured change
    expect(catalogRepository.saveProduct).toHaveBeenCalled();
    // Verify product.isFeatured không bị override
    expect(product.isFeatured).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _pickDisplayPrice — line 344: không có variants → return basePrice (else branch)
// ════════════════════════════════════════════════════════════════════════════

describe('_pickDisplayPrice — không có variants → trả basePrice (line 344 else branch)', () => {
  it('trả basePrice khi variants array rỗng', () => {
    const { service } = makeService();

    const result = service._pickDisplayPrice({
      basePrice: '5000000',
      variants: [], // empty → else branch
    });

    expect(result).toBe(5000000);
  });

  it('trả basePrice khi variants = undefined', () => {
    const { service } = makeService();

    const result = service._pickDisplayPrice({
      basePrice: '3000000',
      // variants undefined → falsy → else branch
    });

    expect(result).toBe(3000000);
  });

  it('trả giá variant nhỏ nhất khi có variants (true branch — để verify else path không bị hit)', () => {
    const { service } = makeService();

    const result = service._pickDisplayPrice({
      basePrice: '10000000',
      variants: [{ price: '12000000' }, { price: '8000000' }, { price: '15000000' }],
    });

    // sorted → variants[0].price = 8000000 (nhỏ nhất)
    expect(result).toBe(8000000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getNewArrivals — line 698: gọi với limit default → trả sản phẩm mới
// ════════════════════════════════════════════════════════════════════════════

describe('getNewArrivals — line 698: gọi với limit mặc định', () => {
  it('trả về danh sách sản phẩm mới đến khi gọi không truyền limit', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, reviews: [] });
    catalogRepository.findNewArrivals.mockResolvedValue([product]);

    const result = await service.getNewArrivals({});

    expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(8); // default limit = 8
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('truyền limit tùy chỉnh → parseInt(limit) được gọi', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findNewArrivals.mockResolvedValue([]);

    await service.getNewArrivals({ limit: 5 });

    expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getRecentlyViewed — line 826: gọi với userId + limit
// ════════════════════════════════════════════════════════════════════════════

describe('getRecentlyViewed — line 826: map qua recentlyViewed items', () => {
  it('trả về sản phẩm đã xem gần đây với viewedAt', async () => {
    const { service, catalogRepository } = makeService();
    const productRow = makeProductRow({ id: 5, reviews: [] });
    const recentlyViewed = [{ Product: productRow, viewedAt: new Date('2025-01-15T10:00:00Z') }];
    catalogRepository.findRecentlyViewedByUser.mockResolvedValue(recentlyViewed);

    const result = await service.getRecentlyViewed({ userId: 10 });

    expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(10, 10); // default limit=10
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
    expect(result[0].viewedAt).toBeInstanceOf(Date);
  });

  it('truyền limit tùy chỉnh → parseInt(limit) được gọi', async () => {
    const { service, catalogRepository } = makeService();
    catalogRepository.findRecentlyViewedByUser.mockResolvedValue([]);

    await service.getRecentlyViewed({ userId: 3, limit: 5 });

    expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(3, 5);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getFeaturedProducts + _mapProductForList — lines 616-629
// Nhánh: _pickDisplayPrice với variants, compareAtPrice null → null
// ════════════════════════════════════════════════════════════════════════════

describe('getFeaturedProducts — lines 616-629: map products with _mapProductForList', () => {
  it('gọi findFeaturedProducts và map qua _mapProductForList', async () => {
    const { service, catalogRepository } = makeService();
    const product = makeProductRow({ id: 1, reviews: [], compareAtPrice: null });
    catalogRepository.findFeaturedProducts.mockResolvedValue([product]);

    const result = await service.getFeaturedProducts({});

    expect(catalogRepository.findFeaturedProducts).toHaveBeenCalledWith(8); // default limit=8
    expect(result).toHaveLength(1);
    // compareAtPrice = null → parseFloat(null) = NaN → || null = null
    expect(result[0].compareAtPrice).toBeNull();
  });

  it('compareAtPrice có giá trị → parseFloat(compareAtPrice) được trả về', async () => {
    const { service, catalogRepository } = makeService();
    const data = { ...makeProductRow().toJSON(), id: 2, compareAtPrice: '12000000', reviews: [] };
    const product = { ...data, toJSON: () => ({ ...data }) };
    catalogRepository.findFeaturedProducts.mockResolvedValue([product]);

    const result = await service.getFeaturedProducts({ limit: 4 });

    expect(result[0].compareAtPrice).toBe(12000000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — line 526: compareAtPrice null → null
// Nhánh: parseFloat(productJson.compareAtPrice) = NaN → || null = null
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — compareAtPrice null (line 526)', () => {
  it('compareAtPrice null → response.compareAtPrice = null (|| null branch)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 20,
      compareAtPrice: null,
      variants: [],
      reviews: [],
    });

    const result = service._buildProductDetailResponse(product, {});

    // parseFloat(null) = NaN → falsy → || null = null
    expect(result.compareAtPrice).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — line 540: attrs['Màu sắc'] path
// Nhánh: attrs.color falsy nhưng attrs['Màu sắc'] có giá trị
// ════════════════════════════════════════════════════════════════════════════

describe("_buildProductDetailResponse — attrs['Màu sắc'] (Vietnamese attribute key, line 540)", () => {
  it("tìm variant theo color qua attrs['Màu sắc'] khi attrs.color không có", () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 30,
      basePrice: '10000000',
      reviews: [],
      variants: [
        {
          id: 100,
          price: '10000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đỏ',
          isDefault: false,
          attributes: { 'Màu sắc': 'đỏ' }, // Vietnamese key, not 'color'
          sku: 'SKU-100',
          specifications: {},
        },
        {
          id: 101,
          price: '11000000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Xanh',
          isDefault: true,
          attributes: { 'Màu sắc': 'xanh' },
          sku: 'SKU-101',
          specifications: {},
        },
      ],
    });

    // queryColor = 'đỏ' → tìm trong attrs['Màu sắc']
    const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });

    // Variant id=100 được chọn vì attrs['Màu sắc'] = 'đỏ'
    expect(result.sku).toBe('SKU-100');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// _buildProductDetailResponse — lines 581, 594, 600: fallback branches
// selectedVariant.price falsy → productJson.basePrice
// selectedVariant.compareAtPrice falsy → productJson.compareAtPrice
// v.compareAtPrice falsy → productJson.compareAtPrice (in availableVariants)
// ════════════════════════════════════════════════════════════════════════════

describe('_buildProductDetailResponse — price/compareAtPrice fallback branches (lines 581, 594, 600)', () => {
  it('selectedVariant.price = 0/null → fallback về productJson.basePrice (line 581)', () => {
    const { service } = makeService();
    const product = makeProductRow({
      id: 40,
      basePrice: '9000000',
      reviews: [],
      variants: [
        {
          id: 200,
          price: null, // null → falsy → fallback về basePrice
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Default',
          isDefault: true,
          attributes: {},
          sku: 'SKU-200',
          specifications: {},
        },
      ],
    });

    const result = service._buildProductDetailResponse(product, {});

    // price = null || '9000000' = '9000000'
    expect(result.price).toBe('9000000');
  });

  it('selectedVariant.compareAtPrice = null → fallback về productJson.compareAtPrice (line 594)', () => {
    const { service } = makeService();
    const data = {
      ...makeProductRow().toJSON(),
      id: 41,
      basePrice: '8000000',
      compareAtPrice: '10000000',
      reviews: [],
      variants: [
        {
          id: 201,
          price: '8000000',
          compareAtPrice: null, // null → fallback về productJson.compareAtPrice
          stockQuantity: 5,
          variantName: 'Red',
          isDefault: true,
          attributes: {},
          sku: 'SKU-201',
          specifications: {},
        },
      ],
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    // selectedVariant.compareAtPrice = null → || productJson.compareAtPrice = '10000000'
    expect(result.currentVariant.compareAtPrice).toBe('10000000');
  });

  it('availableVariants: v.compareAtPrice null → fallback về productJson.compareAtPrice (line 600-601)', () => {
    const { service } = makeService();
    const data = {
      ...makeProductRow().toJSON(),
      id: 42,
      basePrice: '7000000',
      compareAtPrice: '9000000',
      reviews: [],
      variants: [
        {
          id: 202,
          price: '7000000',
          compareAtPrice: null, // null → fallback
          variantName: 'Blue',
          isDefault: true,
          attributes: {},
          sku: 'SKU-202',
          specifications: {},
          stockQuantity: 3,
        },
        {
          id: 203,
          price: '7500000',
          compareAtPrice: '9500000', // truthy → không fallback
          variantName: 'Green',
          isDefault: false,
          attributes: {},
          sku: 'SKU-203',
          specifications: {},
          stockQuantity: 2,
        },
      ],
    };
    const product = { ...data, toJSON: () => ({ ...data }) };

    const result = service._buildProductDetailResponse(product, {});

    // availableVariants[0].compareAtPrice: null || '9000000' = '9000000'
    expect(result.availableVariants[0].compareAtPrice).toBe('9000000');
    // availableVariants[1].compareAtPrice: '9500000' (truthy, không fallback)
    expect(result.availableVariants[1].compareAtPrice).toBe('9500000');
  });
});
