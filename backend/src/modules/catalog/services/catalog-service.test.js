// Phase 42.9 — Unit tests cho CatalogService Sprint 6a (Category+Brand+Collection).
// Phase 44+ — Bổ sung Product CRUD, list, detail, search, helpers (Sprint 6b).
const CatalogService = require('./catalog-service');

// ---------- Helper factories ----------

/** Tạo mock product row có toJSON() */
function makeProductRow(overrides = {}) {
  const data = {
    id: 1,
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    basePrice: '29990000',
    compareAtPrice: '33000000',
    stockQuantity: 5,
    isFeatured: true,
    productImages: [],
    variants: [],
    categories: [],
    reviews: [],
    ...overrides,
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

describe('CatalogService', () => {
  let catalogRepository;
  let cacheStore;
  let service;

  beforeEach(() => {
    catalogRepository = {
      findAllCategoriesSorted: jest.fn(),
      getCategoryProductCounts: jest.fn().mockResolvedValue({}),
      findCategoryById: jest.fn(),
      findCategoryByIdOrSlug: jest.fn(),
      findCategoryBySlug: jest.fn(),
      createCategory: jest.fn(),
      saveCategory: jest.fn((c) => Promise.resolve(c)),
      deleteCategory: jest.fn().mockResolvedValue(),
      countProductsByCategoryId: jest.fn(),
      findProductsByCategoryId: jest.fn(),
      findAllBrands: jest.fn(),
      findBrandIdsByCategoryId: jest.fn(),
      findBrandById: jest.fn(),
      findBrandBySlug: jest.fn(),
      createBrand: jest.fn(),
      saveBrand: jest.fn((b) => Promise.resolve(b)),
      deleteBrand: jest.fn().mockResolvedValue(),
      countProductsByBrandId: jest.fn(),
      findProductsByBrandId: jest.fn(),
      findAllCollections: jest.fn(),
      findCollectionById: jest.fn(),
      findCollectionBySlug: jest.fn(),
      createCollection: jest.fn(),
      saveCollection: jest.fn((c) => Promise.resolve(c)),
      deleteCollection: jest.fn().mockResolvedValue(),
      setCollectionProducts: jest.fn().mockResolvedValue(),
      findProductsByCollectionId: jest.fn(),
      // Product Sprint 6b
      findProductsList: jest.fn(),
      findProductByIdWithFullDetails: jest.fn(),
      findProductBySlugWithFullDetails: jest.fn(),
      findProductByPk: jest.fn(),
      findProductBySlug: jest.fn(),
      findFeaturedProducts: jest.fn(),
      findRelatedProducts: jest.fn(),
      findRelatedProductsFallback: jest.fn(),
      searchProducts: jest.fn(),
      findProductSuggestions: jest.fn(),
      findNewArrivals: jest.fn(),
      findBestSellersRaw: jest.fn(),
      findProductsByIdsOrdered: jest.fn(),
      findDeals: jest.fn(),
      findProductVariantsByProductId: jest.fn(),
      findProductRatingsRows: jest.fn(),
      getProductPriceRange: jest.fn(),
      findAttributeValuesByName: jest.fn(),
      findOtherAttributes: jest.fn(),
      findRecentlyViewedByUser: jest.fn(),
      upsertRecentlyViewed: jest.fn().mockResolvedValue(),
      pruneRecentlyViewed: jest.fn().mockResolvedValue(),
      createProduct: jest.fn(),
      saveProduct: jest.fn().mockResolvedValue(),
      deleteProduct: jest.fn().mockResolvedValue(),
      findCategoriesByIds: jest.fn(),
      setProductCategories: jest.fn().mockResolvedValue(),
      createProductSpecifications: jest.fn().mockResolvedValue(),
      createProductAttributes: jest.fn().mockResolvedValue(),
      clearProductAttributes: jest.fn().mockResolvedValue(),
      createProductVariants: jest.fn().mockResolvedValue(),
      clearProductVariants: jest.fn().mockResolvedValue(),
      findWarrantyPackagesByIds: jest.fn(),
      setProductWarrantyPackages: jest.fn().mockResolvedValue(),
      runInTransaction: jest.fn((fn) => fn({})),
    };
    cacheStore = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
      delPattern: jest.fn().mockResolvedValue(),
      delMany: jest.fn().mockResolvedValue(),
    };
    service = new CatalogService({
      catalogRepository, cacheStore,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('Category', () => {
    test('getAllCategories cache hit', async () => {
      cacheStore.get.mockResolvedValue(JSON.stringify({ status: 'success', data: ['cached'] }));
      const result = await service.getAllCategories();
      expect(result.data).toEqual(['cached']);
      expect(catalogRepository.findAllCategoriesSorted).not.toHaveBeenCalled();
    });

    test('getAllCategories cache miss → query + map productCount', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([
        { id: 1, toJSON: () => ({ id: 1, name: 'A' }) },
        { id: 2, toJSON: () => ({ id: 2, name: 'B' }) },
      ]);
      catalogRepository.getCategoryProductCounts.mockResolvedValue({ 1: 10, 2: 5 });

      const result = await service.getAllCategories();

      expect(result.data[0].productCount).toBe(10);
      expect(result.data[1].productCount).toBe(5);
      expect(cacheStore.setEx).toHaveBeenCalledWith('categories:all', 1800, expect.any(String));
    });

    test('getCategoryById không tồn tại → 404', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      await expect(service.getCategoryById({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('createCategory → invalidate cache', async () => {
      catalogRepository.createCategory.mockResolvedValue({ id: 1 });
      await service.createCategory({ payload: { name: 'A', description: 'd' } });
      expect(cacheStore.del).toHaveBeenCalledWith('categories:all');
    });

    test('updateCategory không tìm thấy → 404', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      await expect(
        service.updateCategory({ id: 1, patch: {} })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('deleteCategory có sản phẩm → 400', async () => {
      catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
      catalogRepository.countProductsByCategoryId.mockResolvedValue(5);
      await expect(
        service.deleteCategory({ id: 1 })
      ).rejects.toMatchObject({ statusCode: 400, message: 'catalog.cannotDeleteCategoryWithProducts' });
    });

    test('deleteCategory không có sản phẩm → xóa thành công', async () => {
      catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
      catalogRepository.countProductsByCategoryId.mockResolvedValue(0);
      const result = await service.deleteCategory({ id: 1 });
      expect(result.message).toBe('catalog.categoryDeleted');
    });

    test('getProductsByCategory fallback từ slug nếu findById fail', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 1 });
      catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 0, rows: [] });

      await service.getProductsByCategory({ id: 'phones' });
      expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('phones');
    });
  });

  describe('Brand', () => {
    test('getAllBrands không filter → trả tất cả', async () => {
      catalogRepository.findAllBrands.mockResolvedValue([{ id: 1 }]);
      await service.getAllBrands({});
      expect(catalogRepository.findAllBrands).toHaveBeenCalledWith({ filter: {} });
    });

    test('getAllBrands filter theo categoryId numeric', async () => {
      catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([5, 7]);
      catalogRepository.findAllBrands.mockResolvedValue([]);

      await service.getAllBrands({ categoryId: '3' });

      expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith('3');
      expect(catalogRepository.findAllBrands).toHaveBeenCalledWith({
        filter: { idIn: [5, 7] },
      });
    });

    test('getAllBrands filter theo category slug → resolve qua findCategoryBySlug', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 10 });
      catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([1]);
      catalogRepository.findAllBrands.mockResolvedValue([]);

      await service.getAllBrands({ categoryId: 'phones' });

      expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('phones');
      expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith(10);
    });

    test('deleteBrand có sản phẩm → 400', async () => {
      catalogRepository.findBrandById.mockResolvedValue({ id: 1 });
      catalogRepository.countProductsByBrandId.mockResolvedValue(3);
      await expect(
        service.deleteBrand({ id: 1 })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('updateBrand → invalidate cache pattern', async () => {
      catalogRepository.findBrandById.mockResolvedValue({});
      await service.updateBrand({ id: 1, patch: { name: 'X' } });
      expect(cacheStore.delPattern).toHaveBeenCalledWith('cache:brands:*');
    });

    test('getBrandBySlug không tồn tại → 404', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue(null);
      await expect(
        service.getBrandBySlug({ slug: 'unknown' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('getProductsByBrand không tìm thấy brand → 404', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue(null);
      await expect(
        service.getProductsByBrand({ slug: 'unknown' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('Collection', () => {
    test('getAllCollections filter theo isActive=true', async () => {
      catalogRepository.findAllCollections.mockResolvedValue([]);
      await service.getAllCollections({ isActive: 'true' });
      expect(catalogRepository.findAllCollections).toHaveBeenCalledWith({
        filter: { isActive: true },
      });
    });

    test('createCollection có productIds → setCollectionProducts', async () => {
      catalogRepository.createCollection.mockResolvedValue({ id: 7 });
      await service.createCollection({
        payload: { name: 'Hot', productIds: [1, 2, 3] },
      });
      expect(catalogRepository.setCollectionProducts).toHaveBeenCalledWith(7, [1, 2, 3]);
    });

    test('createCollection không có productIds → bỏ qua setProducts', async () => {
      catalogRepository.createCollection.mockResolvedValue({ id: 7 });
      await service.createCollection({
        payload: { name: 'Hot' },
      });
      expect(catalogRepository.setCollectionProducts).not.toHaveBeenCalled();
    });

    test('updateCollection có productIds → replace toàn bộ', async () => {
      catalogRepository.findCollectionById.mockResolvedValue({ id: 1 });
      await service.updateCollection({
        id: 1,
        patch: { name: 'New', productIds: [9, 10] },
      });
      expect(catalogRepository.setCollectionProducts).toHaveBeenCalledWith(1, [9, 10]);
    });

    test('deleteCollection → setProducts([]) trước khi destroy', async () => {
      catalogRepository.findCollectionById.mockResolvedValue({ id: 5 });
      await service.deleteCollection({ id: 5 });
      expect(catalogRepository.setCollectionProducts).toHaveBeenCalledWith(5, []);
      expect(catalogRepository.deleteCollection).toHaveBeenCalled();
    });

    test('getCollectionBySlug không tồn tại → 404', async () => {
      catalogRepository.findCollectionBySlug.mockResolvedValue(null);
      await expect(
        service.getCollectionBySlug({ slug: 'x' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // ============================================================
  // Helper: _mapProductImages
  // ============================================================

  describe('_mapProductImages', () => {
    test('chuyển productImages → images array với đúng fields', () => {
      const productJson = {
        name: 'Test',
        productImages: [
          { id: 1, imageUrl: 'a.jpg', isThumbnail: false, variantId: null, color: 'đen' },
          { id: 2, imageUrl: 'b.jpg', isThumbnail: true, variantId: null, color: null },
        ],
      };
      service._mapProductImages(productJson);
      expect(productJson.images).toHaveLength(2);
      expect(productJson.images[0]).toMatchObject({ id: 1, url: 'a.jpg', isThumbnail: false });
      expect(productJson.images[1]).toMatchObject({ id: 2, url: 'b.jpg', isThumbnail: true });
    });

    test('thumbnail được lấy từ ảnh có isThumbnail = true', () => {
      const productJson = {
        name: 'Test',
        productImages: [
          { id: 1, imageUrl: 'a.jpg', isThumbnail: false },
          { id: 2, imageUrl: 'b.jpg', isThumbnail: true },
        ],
      };
      service._mapProductImages(productJson);
      expect(productJson.thumbnail).toBe('b.jpg');
    });

    test('thumbnail là ảnh đầu tiên khi không có ảnh nào isThumbnail', () => {
      const productJson = {
        name: 'Test',
        productImages: [
          { id: 1, imageUrl: 'first.jpg', isThumbnail: false },
          { id: 2, imageUrl: 'second.jpg', isThumbnail: false },
        ],
      };
      service._mapProductImages(productJson);
      expect(productJson.thumbnail).toBe('first.jpg');
    });

    test('images = [] và thumbnail = null khi productImages rỗng', () => {
      const productJson = { name: 'Test', productImages: [] };
      service._mapProductImages(productJson);
      expect(productJson.images).toEqual([]);
      expect(productJson.thumbnail).toBeNull();
    });

    test('images = [] và thumbnail = null khi không có productImages', () => {
      const productJson = { name: 'Test' };
      service._mapProductImages(productJson);
      expect(productJson.images).toEqual([]);
      expect(productJson.thumbnail).toBeNull();
    });
  });

  // ============================================================
  // Helper: _calcRatings
  // ============================================================

  describe('_calcRatings', () => {
    test('trả về average = 0, count = 0 khi không có reviews', () => {
      expect(service._calcRatings([])).toEqual({ average: 0, count: 0 });
    });

    test('trả về average = 0, count = 0 khi reviews = null', () => {
      expect(service._calcRatings(null)).toEqual({ average: 0, count: 0 });
    });

    test('tính trung bình đúng cho 3 reviews', () => {
      const reviews = [{ rating: 4 }, { rating: 5 }, { rating: 3 }];
      const result = service._calcRatings(reviews);
      expect(result.average).toBe(4.0); // (4+5+3)/3 = 4.0
      expect(result.count).toBe(3);
    });

    test('average được làm tròn đến 1 chữ số thập phân', () => {
      const reviews = [{ rating: 4 }, { rating: 5 }];
      const result = service._calcRatings(reviews);
      expect(result.average).toBe(4.5);
    });

    test('onlyVerified = true chỉ tính review có isVerified = true', () => {
      const reviews = [
        { rating: 5, isVerified: true },
        { rating: 1, isVerified: false },
        { rating: 4, isVerified: true },
      ];
      const result = service._calcRatings(reviews, { onlyVerified: true });
      expect(result.count).toBe(2);
      expect(result.average).toBe(4.5);
    });

    test('average = 0 khi tất cả reviews không verified và onlyVerified = true', () => {
      const reviews = [{ rating: 5, isVerified: false }];
      expect(service._calcRatings(reviews, { onlyVerified: true })).toEqual({ average: 0, count: 0 });
    });
  });

  // ============================================================
  // Helper: _pickDisplayPrice
  // ============================================================

  describe('_pickDisplayPrice', () => {
    test('trả về basePrice khi không có variants', () => {
      const price = service._pickDisplayPrice({ basePrice: '15000000', variants: [] });
      expect(price).toBe(15000000);
    });

    test('trả về giá thấp nhất trong variants', () => {
      const price = service._pickDisplayPrice({
        basePrice: '20000000',
        variants: [{ price: '18000000' }, { price: '22000000' }, { price: '15000000' }],
      });
      expect(price).toBe(15000000);
    });

    test('fallback về basePrice khi variant.price không hợp lệ', () => {
      const price = service._pickDisplayPrice({
        basePrice: '10000000',
        variants: [{ price: null }],
      });
      expect(price).toBe(10000000);
    });
  });

  // ============================================================
  // Product — getAllProducts
  // ============================================================

  describe('getAllProducts', () => {
    test('cache HIT → trả về cached payload và cacheHit = true', async () => {
      const cachedPayload = { status: 'success', data: [], total: 0, page: 1, limit: 20 };
      cacheStore.get.mockResolvedValue(JSON.stringify(cachedPayload));

      const result = await service.getAllProducts({ page: 1, cacheUrl: '/products' });
      expect(result.cacheHit).toBe(true);
      expect(result.payload.total).toBe(0);
      expect(catalogRepository.findProductsList).not.toHaveBeenCalled();
    });

    test('cache MISS → query repository', async () => {
      catalogRepository.findProductsList.mockResolvedValue({
        count: 1,
        rows: [makeProductRow()],
      });

      const result = await service.getAllProducts({ page: 1, cacheUrl: '/products' });
      expect(result.cacheHit).toBe(false);
      expect(catalogRepository.findProductsList).toHaveBeenCalled();
    });

    test('ghi cache sau khi query', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ page: 1, cacheUrl: '/api/products?page=1' });
      expect(cacheStore.setEx).toHaveBeenCalledWith(
        'products:list:/api/products?page=1',
        expect.any(Number),
        expect.any(String)
      );
    });

    test('không ghi cache khi không có cacheUrl', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ page: 1 });
      expect(cacheStore.setEx).not.toHaveBeenCalled();
    });

    test('resolve category slug → id trước khi query', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 5 });
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ category: 'dien-thoai' });
      expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('dien-thoai');
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ categoryId: 5 }) })
      );
    });

    test('đặt categoryIdMissingSentinel khi slug không tồn tại', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ category: 'khong-ton-tai' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ categoryIdMissingSentinel: true }),
        })
      );
    });

    test('giới hạn limit tối đa là 100', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ limit: 9999 });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });

    test('map products: price = basePrice khi không có variants', async () => {
      const row = makeProductRow({ basePrice: '25000000', variants: [] });
      catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

      const { payload } = await service.getAllProducts({ page: 1 });
      expect(payload.data[0].price).toBe(25000000);
    });
  });

  // ============================================================
  // Product — getProductById
  // ============================================================

  describe('getProductById', () => {
    test('404 khi không tìm thấy sản phẩm theo id và slug', async () => {
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(null);
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(null);
      await expect(service.getProductById({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cache HIT → trả về cachedData và cacheHit = true', async () => {
      const cachedPayload = {
        status: 'success',
        data: { id: 1, name: 'iPhone 15 Pro' },
      };
      cacheStore.get.mockResolvedValue(JSON.stringify(cachedPayload));

      const result = await service.getProductById({ id: 1 });
      expect(result.cacheHit).toBe(true);
      expect(result.payload.data.name).toBe('iPhone 15 Pro');
      expect(catalogRepository.findProductByIdWithFullDetails).not.toHaveBeenCalled();
    });

    test('fallback sang slug khi id không tìm thấy', async () => {
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(null);
      const productRow = makeProductRow({ id: 5, slug: 'iphone-15-pro' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(productRow);

      await service.getProductById({ id: 'iphone-15-pro' });
      expect(catalogRepository.findProductBySlugWithFullDetails).toHaveBeenCalledWith('iphone-15-pro');
    });

    test('ghi cache sau khi tìm thấy sản phẩm (base request)', async () => {
      const productRow = makeProductRow();
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(productRow);

      await service.getProductById({ id: 1 });
      expect(cacheStore.setEx).toHaveBeenCalledWith(
        'product:detail:1',
        expect.any(Number),
        expect.any(String)
      );
    });

    test('không ghi cache khi có skuId (variant request)', async () => {
      const productRow = makeProductRow({ variants: [{ id: 10, isDefault: true, price: '29000000', compareAtPrice: null, stockQuantity: 3, variantName: 'Đen 128GB', attributes: {}, sku: 'SKU-1' }] });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(productRow);

      await service.getProductById({ id: 1, skuId: '10' });
      expect(cacheStore.setEx).not.toHaveBeenCalled();
    });

    test('gọi _trackRecentlyViewed khi có userId', async () => {
      const productRow = makeProductRow({ id: 7 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(productRow);

      await service.getProductById({ id: 7, userId: 42 });
      expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(42, 7);
    });
  });

  // ============================================================
  // Product — getProductBySlug
  // ============================================================

  describe('getProductBySlug', () => {
    test('404 khi slug không tồn tại', async () => {
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(null);
      await expect(service.getProductBySlug({ slug: 'unknown' })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('trả về responseData khi tìm thấy', async () => {
      const productRow = makeProductRow({ id: 3, slug: 'macbook-pro' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(productRow);

      const result = await service.getProductBySlug({ slug: 'macbook-pro' });
      expect(result).toHaveProperty('id', 3);
    });
  });

  // ============================================================
  // Product — createProduct
  // ============================================================

  describe('createProduct', () => {
    test('tạo sản phẩm đơn giản (không variant)', async () => {
      const newProduct = { id: 10, slug: 'test-prod' };
      catalogRepository.createProduct.mockResolvedValue(newProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 10 }));

      const result = await service.createProduct({
        payload: { name: 'Test Prod', price: 5000000, description: 'test' },
      });

      expect(catalogRepository.createProduct).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    test('gọi setProductCategories khi có categoryIds', async () => {
      const newProduct = { id: 11, slug: 'test-2' };
      catalogRepository.createProduct.mockResolvedValue(newProduct);
      catalogRepository.findCategoriesByIds.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 11 }));

      await service.createProduct({
        payload: { name: 'Test 2', price: 6000000, categoryIds: [1, 2] },
      });

      expect(catalogRepository.setProductCategories).toHaveBeenCalled();
    });

    test('throw 400 khi một categoryId không tồn tại', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 12 });
      // Chỉ tìm thấy 1 trong 2 categories
      catalogRepository.findCategoriesByIds.mockResolvedValue([{ id: 1 }]);

      await expect(
        service.createProduct({ payload: { name: 'X', price: 1000, categoryIds: [1, 999] } })
      ).rejects.toMatchObject({ statusCode: 400, message: 'catalog.categoriesNotExist' });
    });

    test('gọi createProductVariants khi có variants', async () => {
      const newProduct = { id: 13, slug: 'variant-prod' };
      catalogRepository.createProduct.mockResolvedValue(newProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 13 }));

      await service.createProduct({
        payload: {
          name: 'Variant Prod',
          variants: [
            { sku: 'VAR-1', price: 10000000, stockQuantity: 5, isDefault: true, attributes: { color: 'đen' } },
          ],
        },
      });

      expect(catalogRepository.createProductVariants).toHaveBeenCalled();
    });

    test('gọi createProductAttributes khi có parentAttributes', async () => {
      const newProduct = { id: 14 };
      catalogRepository.createProduct.mockResolvedValue(newProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 14 }));

      await service.createProduct({
        payload: {
          name: 'Attr Prod',
          price: 5000000,
          parentAttributes: [{ name: 'Màu sắc', type: 'color', values: ['đen', 'trắng'], required: true }],
        },
      });

      expect(catalogRepository.createProductAttributes).toHaveBeenCalled();
    });

    test('throw 400 khi warrantyPackageId không tồn tại', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 15 });
      // Chỉ tìm thấy 0 trong 1
      catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([]);

      await expect(
        service.createProduct({ payload: { name: 'X', price: 1000, warrantyPackageIds: [99] } })
      ).rejects.toMatchObject({ statusCode: 400, message: 'catalog.warrantyPackagesNotExist' });
    });

    test('xóa cache sản phẩm sau khi tạo', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 20 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 20 }));

      await service.createProduct({ payload: { name: 'New Prod', price: 5000000 } });
      expect(cacheStore.delPattern).toHaveBeenCalledWith('products:list:*');
    });
  });

  // ============================================================
  // Product — updateProduct
  // ============================================================

  describe('updateProduct', () => {
    test('404 khi sản phẩm không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.updateProduct({ id: 99, patch: { name: 'X' } }))
        .rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật tên và mô tả thành công', async () => {
      const existingProduct = makeProductRow({ id: 1, slug: 'iphone-15-pro' });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 1 }));

      await service.updateProduct({ id: 1, patch: { name: 'iPhone 15 Pro Updated', description: 'Mới' } });
      expect(catalogRepository.saveProduct).toHaveBeenCalled();
    });

    test('gọi setProductCategories khi patch có categoryIds', async () => {
      const existingProduct = makeProductRow({ id: 2, slug: 'test' });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findCategoriesByIds.mockResolvedValue([{ id: 5 }]);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 2 }));

      await service.updateProduct({ id: 2, patch: { categoryIds: [5] } });
      expect(catalogRepository.setProductCategories).toHaveBeenCalled();
    });

    test('throw 400 khi categoryId không tồn tại trong patch', async () => {
      const existingProduct = makeProductRow({ id: 3 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findCategoriesByIds.mockResolvedValue([]);

      await expect(
        service.updateProduct({ id: 3, patch: { categoryIds: [999] } })
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('clear và recreate attributes khi patch có attributes', async () => {
      const existingProduct = makeProductRow({ id: 4 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 4 }));

      await service.updateProduct({
        id: 4,
        patch: { attributes: [{ name: 'Màu', type: 'color' }] },
      });

      expect(catalogRepository.clearProductAttributes).toHaveBeenCalled();
      expect(catalogRepository.createProductAttributes).toHaveBeenCalled();
    });

    test('clear variants khi patch.variants = []', async () => {
      const existingProduct = makeProductRow({ id: 5 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 5 }));

      await service.updateProduct({ id: 5, patch: { variants: [] } });
      expect(catalogRepository.clearProductVariants).toHaveBeenCalled();
      // Không tạo mới vì mảng rỗng
      expect(catalogRepository.createProductVariants).not.toHaveBeenCalled();
    });

    test('xóa cache sản phẩm sau khi update', async () => {
      const existingProduct = makeProductRow({ id: 6, slug: 'product-6' });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 6 }));

      await service.updateProduct({ id: 6, patch: { name: 'Updated' } });
      expect(cacheStore.del).toHaveBeenCalledWith('product:detail:6');
    });
  });

  // ============================================================
  // Product — deleteProduct
  // ============================================================

  describe('deleteProduct', () => {
    test('404 khi sản phẩm không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.deleteProduct({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('gọi deleteProduct và trả về message xóa thành công', async () => {
      const product = makeProductRow({ id: 7, slug: 'del-prod' });
      catalogRepository.findProductByPk.mockResolvedValue(product);

      const result = await service.deleteProduct({ id: 7 });
      expect(catalogRepository.deleteProduct).toHaveBeenCalledWith(product);
      expect(result.message).toBe('catalog.productDeleted');
    });

    test('xóa cache sau khi delete', async () => {
      const product = makeProductRow({ id: 8, slug: 'del-prod-2' });
      catalogRepository.findProductByPk.mockResolvedValue(product);

      await service.deleteProduct({ id: 8 });
      expect(cacheStore.del).toHaveBeenCalledWith('product:detail:8');
      expect(cacheStore.del).toHaveBeenCalledWith('product:detail:del-prod-2');
    });
  });

  // ============================================================
  // Product — getFeaturedProducts
  // ============================================================

  describe('getFeaturedProducts', () => {
    test('trả về danh sách sản phẩm nổi bật', async () => {
      catalogRepository.findFeaturedProducts.mockResolvedValue([makeProductRow({ isFeatured: true })]);
      const result = await service.getFeaturedProducts({ limit: 8 });
      expect(Array.isArray(result)).toBe(true);
      expect(catalogRepository.findFeaturedProducts).toHaveBeenCalledWith(8);
    });

    test('mỗi sản phẩm có field ratings', async () => {
      catalogRepository.findFeaturedProducts.mockResolvedValue([
        makeProductRow({ reviews: [{ rating: 4 }, { rating: 5 }] }),
      ]);
      const result = await service.getFeaturedProducts({ limit: 5 });
      expect(result[0].ratings).toBeDefined();
      expect(result[0].ratings.average).toBe(4.5);
    });
  });

  // ============================================================
  // Product — getRelatedProducts
  // ============================================================

  describe('getRelatedProducts', () => {
    test('404 khi sản phẩm không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.getRelatedProducts({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('trả về sản phẩm liên quan khi có categoryId', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5 });
      catalogRepository.findRelatedProducts.mockResolvedValue([makeProductRow({ id: 2 })]);

      const result = await service.getRelatedProducts({ id: 1, limit: 4 });
      expect(result).toHaveLength(1);
    });

    test('fallback sang findRelatedProductsFallback khi không có sản phẩm liên quan', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5 });
      catalogRepository.findRelatedProducts.mockResolvedValue([]);
      catalogRepository.findRelatedProductsFallback.mockResolvedValue([makeProductRow({ id: 3 })]);

      const result = await service.getRelatedProducts({ id: 1, limit: 4 });
      expect(catalogRepository.findRelatedProductsFallback).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // Product — searchProducts
  // ============================================================

  describe('searchProducts', () => {
    test('throw 400 khi không có từ khóa', async () => {
      await expect(service.searchProducts({ q: '' })).rejects.toMatchObject({ statusCode: 400 });
      await expect(service.searchProducts({})).rejects.toMatchObject({ statusCode: 400 });
    });

    test('trả về kết quả tìm kiếm đúng format', async () => {
      catalogRepository.searchProducts.mockResolvedValue({
        count: 2,
        rows: [makeProductRow({ id: 1 }), makeProductRow({ id: 2 })],
      });

      const result = await service.searchProducts({ q: 'iphone', page: 1, limit: 10 });
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
    });
  });

  // ============================================================
  // Product — getProductSuggestions
  // ============================================================

  describe('getProductSuggestions', () => {
    test('trả về mảng rỗng khi query rỗng', async () => {
      const result = await service.getProductSuggestions({ q: '' });
      expect(result).toEqual([]);
    });

    test('trả về danh sách suggestions đúng format', async () => {
      const mockProduct = {
        toJSON: () => ({
          id: 1, name: 'iPhone 15', slug: 'iphone-15',
          productImages: [{ isThumbnail: true, imageUrl: 'thumb.jpg' }],
        }),
      };
      catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

      const result = await service.getProductSuggestions({ q: 'iphone' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 1, name: 'iPhone 15', slug: 'iphone-15', thumbnail: 'thumb.jpg' });
    });

    test('thumbnail = null khi sản phẩm không có ảnh', async () => {
      const mockProduct = {
        toJSON: () => ({ id: 2, name: 'Test', slug: 'test', productImages: [] }),
      };
      catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

      const result = await service.getProductSuggestions({ q: 'test' });
      expect(result[0].thumbnail).toBeNull();
    });
  });

  // ============================================================
  // Product — getNewArrivals
  // ============================================================

  describe('getNewArrivals', () => {
    test('trả về sản phẩm mới với ratings', async () => {
      catalogRepository.findNewArrivals.mockResolvedValue([
        makeProductRow({ reviews: [{ rating: 5 }] }),
      ]);
      const result = await service.getNewArrivals({ limit: 8 });
      expect(result).toHaveLength(1);
      expect(result[0].ratings).toBeDefined();
    });

    test('gọi findNewArrivals với limit đúng', async () => {
      catalogRepository.findNewArrivals.mockResolvedValue([]);
      await service.getNewArrivals({ limit: 6 });
      expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(6);
    });
  });

  // ============================================================
  // Product — getBestSellers
  // ============================================================

  describe('getBestSellers', () => {
    test('fallback về getNewArrivals khi không có best sellers', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([makeProductRow({ id: 99 })]);

      const result = await service.getBestSellers({ limit: 5, period: 'month' });
      expect(catalogRepository.findNewArrivals).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    test('trả về danh sách best sellers khi có dữ liệu', async () => {
      const bestSeller = { id: 1 };
      catalogRepository.findBestSellersRaw.mockResolvedValue([bestSeller]);
      catalogRepository.findProductsByIdsOrdered.mockResolvedValue([makeProductRow({ id: 1 })]);

      const result = await service.getBestSellers({ limit: 10, period: 'week' });
      expect(result).toHaveLength(1);
      expect(catalogRepository.findProductsByIdsOrdered).toHaveBeenCalledWith([1]);
    });

    test('tính startDate đúng theo period = year', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([]);

      await service.getBestSellers({ limit: 5, period: 'year' });
      expect(catalogRepository.findBestSellersRaw).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: expect.any(Date), limit: 5 })
      );
    });
  });

  // ============================================================
  // Product — getDeals
  // ============================================================

  describe('getDeals', () => {
    test('trả về danh sách deals với discountPercentage', async () => {
      const dealProduct = {
        ...makeProductRow({ basePrice: '18000000', compareAtPrice: '20000000', reviews: [] }),
        reviews: [],
      };
      catalogRepository.findDeals.mockResolvedValue([dealProduct]);

      const result = await service.getDeals({ limit: 12, minDiscount: 5 });
      expect(result).toHaveLength(1);
      // (20M - 18M) / 20M * 100 = 10%
      expect(result[0].discountPercentage).toBeCloseTo(10, 1);
    });

    test('giới hạn limit tối đa 100', async () => {
      catalogRepository.findDeals.mockResolvedValue([]);
      await service.getDeals({ limit: 999 });
      expect(catalogRepository.findDeals).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 })
      );
    });
  });

  // ============================================================
  // Product — getProductVariants
  // ============================================================

  describe('getProductVariants', () => {
    test('404 khi sản phẩm không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.getProductVariants({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('trả về danh sách variants', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1 });
      catalogRepository.findProductVariantsByProductId.mockResolvedValue([{ id: 10 }, { id: 11 }]);

      const result = await service.getProductVariants({ id: 1 });
      expect(result.variants).toHaveLength(2);
    });
  });

  // ============================================================
  // Product — getProductReviewsSummary
  // ============================================================

  describe('getProductReviewsSummary', () => {
    test('404 khi sản phẩm không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.getProductReviewsSummary({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('trả về average = 0 khi không có reviews', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1 });
      catalogRepository.findProductRatingsRows.mockResolvedValue([]);

      const result = await service.getProductReviewsSummary({ id: 1 });
      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });

    test('tính đúng average và distribution', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 2 });
      catalogRepository.findProductRatingsRows.mockResolvedValue([
        { rating: 5 }, { rating: 4 }, { rating: 5 }, { rating: 3 },
      ]);

      const result = await service.getProductReviewsSummary({ id: 2 });
      expect(result.count).toBe(4);
      expect(result.average).toBeCloseTo(4.25, 2);
      expect(result.distribution[5]).toBe(2);
      expect(result.distribution[4]).toBe(1);
      expect(result.distribution[3]).toBe(1);
    });
  });

  // ============================================================
  // Product — getProductFilters
  // ============================================================

  describe('getProductFilters', () => {
    beforeEach(() => {
      catalogRepository.getProductPriceRange.mockResolvedValue({ min: 5000000, max: 50000000 });
      catalogRepository.findAttributeValuesByName.mockResolvedValue([]);
      catalogRepository.findOtherAttributes.mockResolvedValue([]);
    });

    test('trả về priceRange, brands, colors, sizes, attributes', async () => {
      const result = await service.getProductFilters({});
      expect(result).toHaveProperty('priceRange');
      expect(result).toHaveProperty('brands');
      expect(result).toHaveProperty('colors');
      expect(result).toHaveProperty('sizes');
      expect(result).toHaveProperty('attributes');
    });

    test('throw 400 khi categoryId không phải số cũng không phải slug hợp lệ', async () => {
      await expect(service.getProductFilters({ categoryId: '!invalid!' }))
        .rejects.toMatchObject({ statusCode: 400 });
    });

    test('resolve categoryId khi là số', async () => {
      await service.getProductFilters({ categoryId: '5' });
      expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 5 });
    });

    test('resolve categoryId từ slug', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 7 });
      await service.getProductFilters({ categoryId: 'dien-thoai' });
      expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 7 });
    });

    test('collectValues tập hợp giá trị từ nhiều rows', async () => {
      catalogRepository.findAttributeValuesByName.mockResolvedValue([
        { values: ['đen', 'trắng'] },
        { values: ['xanh'] },
      ]);

      const result = await service.getProductFilters({});
      // brands (hoặc colors hoặc sizes) phải chứa 3 giá trị từ 2 rows
      const allValues = [...result.brands, ...result.colors, ...result.sizes];
      expect(allValues.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================
  // Product — getRecentlyViewed
  // ============================================================

  describe('getRecentlyViewed', () => {
    test('trả về danh sách sản phẩm đã xem với viewedAt', async () => {
      const mockRV = {
        viewedAt: new Date('2024-01-01'),
        Product: makeProductRow({ id: 5, reviews: [] }),
      };
      catalogRepository.findRecentlyViewedByUser.mockResolvedValue([mockRV]);

      const result = await service.getRecentlyViewed({ userId: 1, limit: 10 });
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('viewedAt');
      expect(result[0]).toHaveProperty('ratings');
    });

    test('gọi findRecentlyViewedByUser với limit đúng', async () => {
      catalogRepository.findRecentlyViewedByUser.mockResolvedValue([]);
      await service.getRecentlyViewed({ userId: 2, limit: 5 });
      expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(2, 5);
    });
  });

  // ============================================================
  // Product — _buildProductDetailResponse
  // ============================================================

  describe('_buildProductDetailResponse', () => {
    test('trả về responseData với ratings khi không có variants', () => {
      const product = makeProductRow({
        basePrice: '20000000',
        compareAtPrice: null,
        reviews: [{ rating: 4, isVerified: true }],
      });
      const result = service._buildProductDetailResponse(product, {});
      expect(result.ratings).toBeDefined();
      expect(result.ratings.average).toBe(4);
      expect(result.price).toBe(20000000);
    });

    test('chọn variant theo skuId', () => {
      const product = makeProductRow({
        id: 1,
        basePrice: '20000000',
        reviews: [],
        variants: [
          { id: 10, price: '22000000', compareAtPrice: null, stockQuantity: 3, variantName: 'Đen 256GB', isDefault: false, attributes: { color: 'đen' }, sku: 'SKU-10', specifications: {} },
          { id: 11, price: '25000000', compareAtPrice: null, stockQuantity: 1, variantName: 'Trắng 256GB', isDefault: true, attributes: { color: 'trắng' }, sku: 'SKU-11', specifications: {} },
        ],
      });
      const result = service._buildProductDetailResponse(product, { skuId: '10' });
      expect(result.isVariantProduct).toBe(true);
      expect(result.sku).toBe('SKU-10');
      expect(result.price).toBe('22000000');
    });

    test('chọn variant mặc định khi không có skuId và không có queryColor', () => {
      const product = makeProductRow({
        id: 2,
        basePrice: '20000000',
        reviews: [],
        variants: [
          { id: 20, price: '20000000', compareAtPrice: null, stockQuantity: 5, variantName: 'Variant A', isDefault: true, attributes: {}, sku: 'SKU-20', specifications: {} },
        ],
      });
      const result = service._buildProductDetailResponse(product, {});
      expect(result.isVariantProduct).toBe(true);
      expect(result.currentVariant).toBeDefined();
    });

    test('ratings.totalCount = tổng số reviews (kể cả chưa verified)', () => {
      const product = makeProductRow({
        reviews: [
          { rating: 5, isVerified: true },
          { rating: 3, isVerified: false },
        ],
      });
      const result = service._buildProductDetailResponse(product, {});
      expect(result.ratings.totalCount).toBe(2);
    });

    test('chọn variant theo queryColor', () => {
      const product = makeProductRow({
        id: 3,
        basePrice: '20000000',
        reviews: [],
        variants: [
          { id: 30, price: '20000000', compareAtPrice: null, stockQuantity: 5, variantName: 'Xanh 128GB', isDefault: false, attributes: { color: 'xanh' }, sku: 'SKU-30', specifications: {} },
          { id: 31, price: '22000000', compareAtPrice: null, stockQuantity: 3, variantName: 'Đỏ 128GB', isDefault: true, attributes: { color: 'đỏ' }, sku: 'SKU-31', specifications: {} },
        ],
      });
      const result = service._buildProductDetailResponse(product, { queryColor: 'xanh' });
      expect(result.currentVariant.name).toBe('Xanh 128GB');
    });

    test('lọc images theo variantId khi có skuId', () => {
      const product = makeProductRow({
        id: 4,
        name: 'Laptop X',
        basePrice: '25000000',
        reviews: [],
        productImages: [
          { id: 1, imageUrl: 'img1.jpg', isThumbnail: true, variantId: 40, color: null },
          { id: 2, imageUrl: 'img2.jpg', isThumbnail: false, variantId: 41, color: null },
        ],
        variants: [
          { id: 40, price: '25000000', compareAtPrice: null, stockQuantity: 2, variantName: 'Silver 512GB', isDefault: true, attributes: {}, sku: 'SKU-40', specifications: {} },
        ],
      });
      const result = service._buildProductDetailResponse(product, { skuId: '40' });
      // variant images phải chỉ chứa ảnh có variantId = 40
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe('img1.jpg');
    });
  });

  // ============================================================
  // Cache helpers
  // ============================================================

  describe('_invalidateCacheKey', () => {
    test('bỏ qua khi không có cacheStore', async () => {
      const svcNoCache = new CatalogService({
        catalogRepository, cacheStore: null,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      });
      // không ném lỗi
      await expect(svcNoCache._invalidateCacheKey('any-key')).resolves.toBeUndefined();
    });

    test('log warn khi cacheStore.del throw', async () => {
      const warnSpy = jest.fn();
      const svcWarn = new CatalogService({
        catalogRepository, cacheStore: { ...cacheStore, del: jest.fn().mockRejectedValue(new Error('redis down')) },
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: warnSpy },
      });
      await svcWarn._invalidateCacheKey('categories:all');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('categories:all'), expect.any(String));
    });
  });

  describe('_invalidateCachePattern', () => {
    test('bỏ qua khi cacheStore không có delPattern', async () => {
      const storeNoPattern = { get: jest.fn(), setEx: jest.fn(), del: jest.fn(), delMany: jest.fn() };
      const svc2 = new CatalogService({
        catalogRepository, cacheStore: storeNoPattern,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      });
      await expect(svc2._invalidateCachePattern('cache:brands:*')).resolves.toBeUndefined();
    });

    test('log warn khi delPattern throw', async () => {
      const warnSpy = jest.fn();
      const svcWarn = new CatalogService({
        catalogRepository,
        cacheStore: { ...cacheStore, delPattern: jest.fn().mockRejectedValue(new Error('timeout')) },
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: warnSpy },
      });
      await svcWarn._invalidateCachePattern('cache:brands:*');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('cache:brands:*'), expect.any(String));
    });
  });

  // ============================================================
  // Category — uncovered paths
  // ============================================================

  describe('Category — additional paths', () => {
    test('getCategoryTree → gọi findAllCategoriesSorted', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([{ id: 1 }]);
      const result = await service.getCategoryTree();
      expect(catalogRepository.findAllCategoriesSorted).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    test('getCategoryById tìm thấy → trả category', async () => {
      const cat = { id: 5, name: 'Phones' };
      catalogRepository.findCategoryById.mockResolvedValue(cat);
      const result = await service.getCategoryById({ id: 5 });
      expect(result).toBe(cat);
    });

    test('getCategoryBySlug tìm thấy → trả category', async () => {
      const cat = { id: 6, slug: 'phones' };
      catalogRepository.findCategoryByIdOrSlug.mockResolvedValue(cat);
      const result = await service.getCategoryBySlug({ slug: 'phones' });
      expect(result).toBe(cat);
    });

    test('getCategoryBySlug không tồn tại → 404', async () => {
      catalogRepository.findCategoryByIdOrSlug.mockResolvedValue(null);
      await expect(service.getCategoryBySlug({ slug: 'unknown' })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('updateCategory cập nhật name + description', async () => {
      const cat = { id: 1, name: 'Old', description: 'Old desc' };
      catalogRepository.findCategoryById.mockResolvedValue(cat);
      await service.updateCategory({ id: 1, patch: { name: 'New', description: 'New desc' } });
      expect(cat.name).toBe('New');
      expect(cat.description).toBe('New desc');
      expect(catalogRepository.saveCategory).toHaveBeenCalledWith(cat);
    });

    test('getFeaturedCategories → trả danh sách categories', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getFeaturedCategories();
      expect(result).toHaveLength(2);
    });

    test('getProductsByCategory không tìm thấy cả id lẫn slug → 404', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);
      await expect(service.getProductsByCategory({ id: 'unknown' })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('getProductsByCategory trả về products với mapping', async () => {
      const cat = { id: 1 };
      catalogRepository.findCategoryById.mockResolvedValue(cat);
      const row = makeProductRow({
        productImages: [{ id: 1, imageUrl: 'a.jpg', isThumbnail: true, color: null }],
        variants: [{ price: '10000', isDefault: true, compareAtPrice: null }],
      });
      catalogRepository.findProductsByCategoryId.mockResolvedValue({ count: 1, rows: [row] });

      const result = await service.getProductsByCategory({ id: 1, page: 1, limit: 10 });
      expect(result.total).toBe(1);
      expect(result.products).toHaveLength(1);
      expect(result.products[0].thumbnail).toBe('a.jpg');
    });
  });

  // ============================================================
  // Brand — additional paths
  // ============================================================

  describe('Brand — additional paths', () => {
    test('getAllBrands filter theo category slug không tồn tại → idIn = [-1]', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);
      catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([]);
      catalogRepository.findAllBrands.mockResolvedValue([]);

      await service.getAllBrands({ categoryId: 'nonexistent-slug' });
      expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith(-1);
    });

    test('createBrand → trả về brand mới', async () => {
      const newBrand = { id: 5, name: 'Apple', logoUrl: 'logo.png' };
      catalogRepository.createBrand.mockResolvedValue(newBrand);
      const result = await service.createBrand({ payload: { name: 'Apple', logoUrl: 'logo.png' } });
      expect(result).toBe(newBrand);
      expect(cacheStore.delPattern).toHaveBeenCalledWith('cache:brands:*');
    });

    test('deleteBrand không có sản phẩm → xóa thành công', async () => {
      catalogRepository.findBrandById.mockResolvedValue({ id: 1 });
      catalogRepository.countProductsByBrandId.mockResolvedValue(0);
      const result = await service.deleteBrand({ id: 1 });
      expect(catalogRepository.deleteBrand).toHaveBeenCalled();
      expect(result.message).toBe('catalog.brandDeleted');
    });

    test('deleteBrand không tồn tại → 404', async () => {
      catalogRepository.findBrandById.mockResolvedValue(null);
      await expect(service.deleteBrand({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('getProductsByBrand trả về phân trang đúng', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue({ id: 3 });
      catalogRepository.findProductsByBrandId.mockResolvedValue({ count: 25, rows: [] });

      const result = await service.getProductsByBrand({ slug: 'apple', page: 2, limit: 10 });
      expect(result.total).toBe(25);
      expect(result.pages).toBe(3);
      expect(result.currentPage).toBe(2);
    });
  });

  // ============================================================
  // Collection — additional paths
  // ============================================================

  describe('Collection — additional paths', () => {
    test('getAllCollections không filter → trả tất cả', async () => {
      catalogRepository.findAllCollections.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getAllCollections({});
      expect(catalogRepository.findAllCollections).toHaveBeenCalledWith({ filter: {} });
      expect(result).toHaveLength(2);
    });

    test('getAllCollections filter isActive=false', async () => {
      catalogRepository.findAllCollections.mockResolvedValue([]);
      await service.getAllCollections({ isActive: 'false' });
      expect(catalogRepository.findAllCollections).toHaveBeenCalledWith({ filter: { isActive: false } });
    });

    test('getCollectionBySlug tìm thấy → trả collection', async () => {
      const col = { id: 7, slug: 'summer' };
      catalogRepository.findCollectionBySlug.mockResolvedValue(col);
      const result = await service.getCollectionBySlug({ slug: 'summer' });
      expect(result).toBe(col);
    });

    test('updateCollection không tồn tại → 404', async () => {
      catalogRepository.findCollectionById.mockResolvedValue(null);
      await expect(service.updateCollection({ id: 99, patch: {} })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('updateCollection không có productIds → bỏ qua setProducts', async () => {
      catalogRepository.findCollectionById.mockResolvedValue({ id: 1 });
      await service.updateCollection({ id: 1, patch: { name: 'Updated' } });
      expect(catalogRepository.setCollectionProducts).not.toHaveBeenCalled();
    });

    test('deleteCollection không tồn tại → 404', async () => {
      catalogRepository.findCollectionById.mockResolvedValue(null);
      await expect(service.deleteCollection({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('getProductsByCollection không tìm thấy → 404', async () => {
      catalogRepository.findCollectionBySlug.mockResolvedValue(null);
      await expect(service.getProductsByCollection({ slug: 'missing' })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('getProductsByCollection trả về phân trang đúng', async () => {
      catalogRepository.findCollectionBySlug.mockResolvedValue({ id: 5 });
      catalogRepository.findProductsByCollectionId.mockResolvedValue({ count: 15, rows: [] });

      const result = await service.getProductsByCollection({ slug: 'hot', page: 1, limit: 5 });
      expect(result.total).toBe(15);
      expect(result.pages).toBe(3);
    });
  });

  // ============================================================
  // Product — createProduct additional paths
  // ============================================================

  describe('createProduct — additional paths', () => {
    test('gọi createProductSpecifications khi specifications là mảng', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 50 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 50 }));

      await service.createProduct({
        payload: {
          name: 'Spec Prod',
          price: 5000000,
          specifications: [
            { name: 'CPU', value: 'A17 Pro', category: 'Hardware' },
            { name: 'RAM', value: '8GB' },
          ],
        },
      });

      expect(catalogRepository.createProductSpecifications).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'CPU', value: 'A17 Pro', category: 'Hardware', sortOrder: 0 }),
          expect.objectContaining({ name: 'RAM', value: '8GB', category: 'General', sortOrder: 1 }),
        ]),
        expect.any(Object)
      );
    });

    test('gọi createProductAttributes khi có attributes (không phải parentAttributes)', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 51 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 51 }));

      await service.createProduct({
        payload: {
          name: 'Attr Prod2',
          price: 5000000,
          attributes: [{ name: 'Màu', value: 'Đen' }, { name: 'Size', value: 'L' }],
        },
      });

      expect(catalogRepository.createProductAttributes).toHaveBeenCalled();
    });

    test('gọi setProductWarrantyPackages khi warrantyPackageIds hợp lệ', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 52 });
      catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([{ id: 10 }, { id: 11 }]);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 52 }));

      await service.createProduct({
        payload: { name: 'Warranty Prod', price: 5000000, warrantyPackageIds: [10, 11] },
      });

      expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalled();
    });

    test('variant tạo với auto-generated SKU khi không có sku', async () => {
      const newProduct = { id: 53, slug: 'test-auto-sku' };
      catalogRepository.createProduct.mockResolvedValue(newProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 53 }));

      await service.createProduct({
        payload: {
          name: 'Auto SKU Prod',
          variants: [{ price: 5000000, stockQuantity: 10 }], // không có sku
        },
      });

      expect(catalogRepository.createProductVariants).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ sku: expect.stringContaining('53-VAR-') }),
        ]),
        expect.any(Object)
      );
    });
  });

  // ============================================================
  // Product — updateProduct additional paths
  // ============================================================

  describe('updateProduct — additional paths', () => {
    test('update warrantyPackageIds = [] → setProductWarrantyPackages với []', async () => {
      const existingProduct = makeProductRow({ id: 10 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 10 }));

      await service.updateProduct({ id: 10, patch: { warrantyPackageIds: [] } });
      expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalledWith(
        existingProduct, [], expect.any(Object)
      );
    });

    test('update với warrantyPackageIds hợp lệ → setProductWarrantyPackages với packages', async () => {
      const existingProduct = makeProductRow({ id: 11 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([{ id: 20 }]);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 11 }));

      await service.updateProduct({ id: 11, patch: { warrantyPackageIds: [20] } });
      expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalledWith(
        existingProduct, [{ id: 20 }], expect.any(Object)
      );
    });

    test('throw 400 khi warrantyPackageId không tồn tại trong patch', async () => {
      const existingProduct = makeProductRow({ id: 12 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([]);

      await expect(
        service.updateProduct({ id: 12, patch: { warrantyPackageIds: [999] } })
      ).rejects.toMatchObject({ statusCode: 400, message: 'catalog.warrantyPackagesNotExist' });
    });

    test('clear attributes khi patch.attributes = []', async () => {
      const existingProduct = makeProductRow({ id: 13 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 13 }));

      await service.updateProduct({ id: 13, patch: { attributes: [] } });
      expect(catalogRepository.clearProductAttributes).toHaveBeenCalled();
      expect(catalogRepository.createProductAttributes).not.toHaveBeenCalled();
    });

    test('clear và recreate variants khi patch có variants không rỗng', async () => {
      const existingProduct = makeProductRow({ id: 14 });
      catalogRepository.findProductByPk.mockResolvedValue(existingProduct);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(makeProductRow({ id: 14 }));

      await service.updateProduct({
        id: 14,
        patch: { variants: [{ sku: 'V1', price: 5000000 }] },
      });

      expect(catalogRepository.clearProductVariants).toHaveBeenCalled();
      expect(catalogRepository.createProductVariants).toHaveBeenCalled();
    });
  });

  // ============================================================
  // getAllProducts — brand và collection filter
  // ============================================================

  describe('getAllProducts — brand/collection filter paths', () => {
    test('filter brand theo id (numeric) → brandIdsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: '5' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ brandIdsIn: ['5'] }) })
      );
    });

    test('filter brand theo slug → brandSlugsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: 'apple' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ brandSlugsIn: ['apple'] }) })
      );
    });

    test('filter brand là array → phân loại ids và slugs', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: ['5', 'samsung'] });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ brandIdsIn: ['5'], brandSlugsIn: ['samsung'] }),
        })
      );
    });

    test('filter collection theo id → collectionIdsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ collection: '3' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ collectionIdsIn: ['3'] }) })
      );
    });

    test('filter collection theo slug → collectionSlugsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ collection: 'summer-sale' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ collectionSlugsIn: ['summer-sale'] }) })
      );
    });

    test('map product: thêm category vào categories nếu chưa có', async () => {
      const row = makeProductRow({
        category: { id: 10, name: 'Phones' },
        categories: [],
        basePrice: '5000000',
      });
      catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

      const { payload } = await service.getAllProducts({ page: 1 });
      expect(payload.data[0].categories).toContainEqual(expect.objectContaining({ id: 10 }));
    });
  });

  // ============================================================
  // getProductById — cache hit với userId
  // ============================================================

  describe('getProductById — cache hit với userId', () => {
    test('cache HIT + userId → vẫn gọi _trackRecentlyViewed', async () => {
      const cachedPayload = { status: 'success', data: { id: 5, name: 'Cached Product' } };
      cacheStore.get.mockResolvedValue(JSON.stringify(cachedPayload));

      await service.getProductById({ id: 5, userId: 10 });

      expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(10, 5);
    });
  });

  // ============================================================
  // getBestSellers — period = 'week' và 'month' (default)
  // ============================================================

  describe('getBestSellers — period paths', () => {
    test('period = month (default) → startDate setMonth - 1', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([]);

      await service.getBestSellers({ limit: 5 });
      expect(catalogRepository.findBestSellersRaw).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: expect.any(Date) })
      );
    });

    test('period = week → fallback sang getNewArrivals khi không có best sellers', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([makeProductRow({ id: 100 })]);

      const result = await service.getBestSellers({ limit: 5, period: 'week' });
      expect(catalogRepository.findNewArrivals).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  // ============================================================
  // _clearProductCache — no delMany / no productId / no productSlug
  // ============================================================

  describe('_clearProductCache', () => {
    test('bỏ qua khi cacheStore không có delMany', async () => {
      const storeNoDelMany = { get: jest.fn(), setEx: jest.fn(), del: jest.fn(), delPattern: jest.fn() };
      const svc3 = new CatalogService({
        catalogRepository, cacheStore: storeNoDelMany,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      });
      await expect(svc3._clearProductCache(1, 'slug')).resolves.toBeUndefined();
      expect(storeNoDelMany.del).not.toHaveBeenCalled();
    });

    test('delPattern throw → log warn và tiếp tục', async () => {
      const warnSpy = jest.fn();
      const brokenCache = {
        get: jest.fn(), setEx: jest.fn(),
        del: jest.fn().mockResolvedValue(),
        delPattern: jest.fn().mockRejectedValue(new Error('pattern error')),
        delMany: jest.fn().mockResolvedValue(),
      };
      const svc4 = new CatalogService({
        catalogRepository, cacheStore: brokenCache,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: warnSpy },
      });
      await svc4._clearProductCache(1, 'slug');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('pattern'), expect.any(String));
    });

    test('không del product keys khi productId và slug đều null', async () => {
      await service._clearProductCache(null, null);
      // delPattern gọi được, nhưng del không gọi với product key nào
      expect(cacheStore.del).not.toHaveBeenCalledWith(expect.stringContaining('product:detail:'));
    });
  });

  // ============================================================
  // Brand — getBrandBySlug: not found → 404 (line 176)
  // ============================================================

  describe('getBrandBySlug', () => {
    test('ném AppError 404 khi brand không tồn tại theo slug', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue(null);

      await expect(service.getBrandBySlug({ slug: 'unknown-brand' }))
        .rejects.toMatchObject({ statusCode: 404, message: 'catalog.brandNotFound' });
    });

    test('trả về brand khi tồn tại', async () => {
      const brand = { id: 5, name: 'Apple', slug: 'apple' };
      catalogRepository.findBrandBySlug.mockResolvedValue(brand);

      const result = await service.getBrandBySlug({ slug: 'apple' });

      expect(result).toBe(brand);
    });
  });

  // ============================================================
  // getProductFilters — line 822: attributes: others.map(...)
  // Khi findOtherAttributes trả về các row có name + values
  // ============================================================

  describe('getProductFilters — line 822: others.map với dữ liệu thực', () => {
    test('trả về attributes từ others với values đúng khi findOtherAttributes có dữ liệu', async () => {
      catalogRepository.getProductPriceRange.mockResolvedValue({ min: 1000000, max: 50000000 });
      catalogRepository.findAttributeValuesByName.mockResolvedValue([]);
      catalogRepository.findOtherAttributes.mockResolvedValue([
        { name: 'Chất liệu', values: ['Nhôm', 'Nhựa'] },
        { name: 'Xuất xứ', values: null },  // values=null → dùng [] fallback
      ]);

      const result = await service.getProductFilters({});

      expect(result.attributes).toEqual([
        { name: 'Chất liệu', values: ['Nhôm', 'Nhựa'] },
        { name: 'Xuất xứ', values: [] },
      ]);
    });
  });

  // ============================================================
  // _clearProductCache — line 356: delPattern branch (delMany exists + delPattern exists)
  // ============================================================

  describe('_clearProductCache — line 356: cacheStore có delPattern', () => {
    test('gọi delPattern cho products:list và chatbot khi cacheStore có delPattern', async () => {
      const delPatternSpy = jest.fn().mockResolvedValue();
      const delSpy = jest.fn().mockResolvedValue();
      const cacheWithPattern = {
        delMany: jest.fn().mockResolvedValue(),
        delPattern: delPatternSpy,
        del: delSpy,
      };
      const svc = new CatalogService({
        catalogRepository,
        cacheStore: cacheWithPattern,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
      });

      await svc._clearProductCache(1, 'product-slug');

      expect(delPatternSpy).toHaveBeenCalledWith('products:list:*');
      expect(delPatternSpy).toHaveBeenCalledWith('chatbot:*');
      expect(delSpy).toHaveBeenCalledWith('product:detail:1');
      expect(delSpy).toHaveBeenCalledWith('product:detail:product-slug');
    });

    test('log warn khi delPattern throw', async () => {
      const warnSpy = jest.fn();
      const cacheWithThrowingPattern = {
        delMany: jest.fn().mockResolvedValue(),
        delPattern: jest.fn().mockRejectedValue(new Error('Redis timeout')),
        del: jest.fn().mockResolvedValue(),
      };
      const svc = new CatalogService({
        catalogRepository,
        cacheStore: cacheWithThrowingPattern,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: warnSpy },
      });

      await svc._clearProductCache(2, null);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('clearProductCache pattern thất bại'),
        expect.any(String),
      );
    });
  });

  // ============================================================
  // getAllProducts — lines 415,419: collection là array / cSlugs path
  // ============================================================

  describe('getAllProducts — lines 415,419: collection filter', () => {
    test('collection là array string slug → filter.collectionSlugsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ collection: ['sale', 'hot'] });

      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ collectionSlugsIn: ['sale', 'hot'] }),
        }),
      );
    });

    test('collection là single string slug → filter.collectionSlugsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ collection: 'featured-2024' });

      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ collectionSlugsIn: ['featured-2024'] }),
        }),
      );
    });

    test('collection là array số id → filter.collectionIdsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ collection: ['1', '2'] });

      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ collectionIdsIn: ['1', '2'] }),
        }),
      );
    });
  });

  // ============================================================
  // _buildProductDetailResponse — line 569-573: variantName đã chứa mainName
  // → fullName = variantName (không concatenate)
  // ============================================================

  describe('_buildProductDetailResponse — line 572-573: variantName chứa mainName', () => {
    test('fullName = variantName khi variantName đã chứa mainName', () => {
      const product = makeProductRow({
        id: 1,
        name: 'iPhone 15 Pro',
        basePrice: '29000000',
        reviews: [],
        variants: [
          {
            id: 10,
            price: '29000000',
            compareAtPrice: null,
            stockQuantity: 5,
            // variantName đã chứa 'iPhone 15 Pro' → không concat
            variantName: 'iPhone 15 Pro 256GB Titan Đen',
            displayName: 'iPhone 15 Pro 256GB Titan Đen',
            isDefault: true,
            attributes: { color: 'đen' },
            sku: 'IPH15-256-BLACK',
            specifications: {},
          },
        ],
      });

      const result = service._buildProductDetailResponse(product, {});

      expect(result.name).toBe('iPhone 15 Pro 256GB Titan Đen');
      expect(result.isVariantProduct).toBe(true);
    });

    test('fullName = mainName + variantName khi variantName không chứa mainName', () => {
      const product = makeProductRow({
        id: 2,
        name: 'MacBook Pro',
        basePrice: '35000000',
        reviews: [],
        variants: [
          {
            id: 20,
            price: '35000000',
            compareAtPrice: null,
            stockQuantity: 3,
            variantName: '16GB RAM 512GB SSD',
            displayName: '16GB RAM 512GB SSD',
            isDefault: true,
            attributes: {},
            sku: 'MBP-16-512',
            specifications: {},
          },
        ],
      });

      const result = service._buildProductDetailResponse(product, {});

      expect(result.name).toBe('MacBook Pro - 16GB RAM 512GB SSD');
    });
  });

  // ============================================================
  // Uncovered statements — targeted coverage tests
  // ============================================================

  describe('deleteCategory — line 93: category không tìm thấy → 404', () => {
    test('ném AppError 404 khi category không tồn tại', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);

      await expect(service.deleteCategory({ id: 999 }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('_mapProductWithImages — line 150: không có variants → json.price = json.basePrice', () => {
    test('đặt price = basePrice khi product có variants=[] (empty array)', () => {
      // _mapProductWithImages else branch: variants.length === 0 → line 150 hit
      const productMock = {
        toJSON: () => ({
          id: 1,
          basePrice: 15000000,
          variants: [],      // empty → else branch → line 150
          productImages: [],
        }),
      };
      const result = service._mapProductWithImages(productMock);
      expect(result.price).toBe(15000000);
    });

    test('đặt price = basePrice khi variants là undefined', () => {
      // variants undefined → falsy → else branch
      const productMock = {
        toJSON: () => ({
          id: 2,
          basePrice: 9990000,
          // variants not set → undefined
          productImages: [],
        }),
      };
      const result = service._mapProductWithImages(productMock);
      expect(result.price).toBe(9990000);
    });
  });

  describe('updateBrand — line 189: brand không tìm thấy → 404', () => {
    test('ném AppError 404 khi brand không tồn tại', async () => {
      catalogRepository.findBrandById.mockResolvedValue(null);

      await expect(service.updateBrand({ id: 999, patch: { name: 'X' } }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getProductList — line 393: category là numeric ID → dùng trực tiếp', () => {
    test('dùng categoryId trực tiếp khi category là số nguyên', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ page: 1, category: '5' });

      // findCategoryBySlug should NOT be called (numeric ID used directly)
      expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
      // findProductsList called with categoryId = '5'
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ categoryId: '5' }),
        })
      );
    });
  });

  describe('getProductList — lines 430-431: product.categories null + category push', () => {
    test('đặt categories=[] khi json.categories là undefined', async () => {
      const row = {
        toJSON: () => ({
          id: 1,
          name: 'Test',
          basePrice: '10000000',
          productImages: [],
          variants: [],
          reviews: [],
          // categories NOT set → undefined
          category: null,
        }),
      };
      catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

      const { payload } = await service.getAllProducts({ page: 1 });
      expect(payload.data[0].categories).toEqual([]);
    });

    test('push product.category vào categories khi chưa có trong mảng', async () => {
      // categories has [id:5] but category has id:7 → .some() runs (compares 5 !== 7) → push
      const cat = { id: 7, name: 'Laptops' };
      const existingCat = { id: 5, name: 'Electronics' };
      const row = {
        toJSON: () => ({
          id: 2,
          name: 'Laptop X',
          basePrice: '20000000',
          productImages: [],
          variants: [],
          reviews: [],
          categories: [existingCat],  // non-empty → .some() callback executes (line 431 stmt 252)
          category: cat,              // different id → not found → pushed
        }),
      };
      catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

      const { payload } = await service.getAllProducts({ page: 1 });
      expect(payload.data[0].categories).toContainEqual(expect.objectContaining({ id: 7 }));
      expect(payload.data[0].categories).toHaveLength(2);
    });
  });

  describe('getProductById — line 487: _trackRecentlyViewed error được bắt trong .catch()', () => {
    test('logger.error được gọi khi _trackRecentlyViewed ném lỗi', async () => {
      const productRow = makeProductRow({ id: 42 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(productRow);
      // Make _trackRecentlyViewed reject to hit the .catch handler (line 487)
      catalogRepository.upsertRecentlyViewed.mockRejectedValueOnce(new Error('DB error'));

      await service.getProductById({ id: 42, userId: 10 });

      // Wait for the .catch to run (it's fire-and-forget)
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(service.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Lỗi ghi lịch sử xem sản phẩm'),
        expect.any(Error)
      );
    });
  });

  describe('getProductBySlug — lines 505-507: userId tracking với .catch()', () => {
    test('gọi _trackRecentlyViewed khi có userId', async () => {
      const productRow = makeProductRow({ id: 20, slug: 'test-slug' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(productRow);

      await service.getProductBySlug({ slug: 'test-slug', userId: 15 });

      expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(15, 20);
    });

    test('logger.error gọi khi _trackRecentlyViewed ném lỗi trong getProductBySlug', async () => {
      const productRow = makeProductRow({ id: 21, slug: 'another-slug' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(productRow);
      catalogRepository.upsertRecentlyViewed.mockRejectedValueOnce(new Error('Track error'));

      await service.getProductBySlug({ slug: 'another-slug', userId: 16 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(service.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Lỗi ghi lịch sử xem sản phẩm'),
        expect.any(Error)
      );
    });
  });

  describe('_buildProductDetailResponse — lines 559,564,566: color-based image filtering', () => {
    test('line 559: filter images by variantColor khi matchByVariantId rỗng (skuId + variantColor)', () => {
      // skuId set → enter "if (skuId && selectedVariant)" branch
      // matchByVariantId.length === 0 → enter "else if (variantColor)"
      // → line 559 hit: filter by color
      const product = makeProductRow({
        id: 50,
        name: 'Gaming Laptop',
        variants: [
          {
            id: 'var-1',
            isDefault: true,
            price: 25000000,
            compareAtPrice: null,
            stockQuantity: 3,
            variantName: 'Black Edition',
            displayName: 'Black Edition',
            attributes: { color: 'Black' },
            sku: 'GL-BLK',
            specifications: {},
          },
        ],
        productImages: [
          // No image with variantId 'var-1' → matchByVariantId will be empty
          { id: 1, imageUrl: 'black.jpg', isThumbnail: true, variantId: null, color: 'Black' },
          { id: 2, imageUrl: 'white.jpg', isThumbnail: false, variantId: null, color: 'White' },
        ],
      });

      // skuId='var-1' + selectedVariant has color 'black' → filter images by color
      const result = service._buildProductDetailResponse(product, { skuId: 'var-1' });
      // Images filtered by variantColor 'black' → only black.jpg
      expect(result.images).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: 'Black' })])
      );
    });

    test('line 564,566: filter images by queryColor khi không có skuId (else if variantColor branch)', () => {
      // No skuId → "else if (variantColor)" branch (line 562)
      // matchByColor.length > 0 → variantImages = matchByColor (line 566)
      const product = makeProductRow({
        id: 51,
        name: 'Laptop Pro',
        variants: [
          {
            id: 'var-2',
            isDefault: true,
            price: 30000000,
            compareAtPrice: null,
            stockQuantity: 5,
            variantName: 'Silver',
            displayName: 'Silver',
            attributes: { color: 'Silver' },
            sku: 'LP-SLV',
            specifications: {},
          },
        ],
        productImages: [
          { id: 3, imageUrl: 'silver.jpg', isThumbnail: true, variantId: null, color: 'Silver' },
          { id: 4, imageUrl: 'black.jpg', isThumbnail: false, variantId: null, color: 'Black' },
        ],
      });

      // No skuId, queryColor='silver' → normColor='silver', variantColor='silver'
      // → "else if (variantColor)" branch → matchByColor = [silver.jpg]
      // → matchByColor.length > 0 → variantImages = matchByColor
      const result = service._buildProductDetailResponse(product, { queryColor: 'Silver' });
      expect(result.images).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: 'Silver' })])
      );
      expect(result.images).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ color: 'Black' })])
      );
    });
  });
});
