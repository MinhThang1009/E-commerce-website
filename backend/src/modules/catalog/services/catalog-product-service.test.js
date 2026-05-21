// Phase 42.10 — Unit tests cho CatalogService Sprint 6b (Product extension).
const CatalogService = require('./catalog-service');

describe('CatalogService — Product (Sprint 6b)', () => {
  let catalogRepository;
  let cacheStore;
  let service;

  // Helper: build product mock với Sequelize-like toJSON
  const mkProduct = (overrides = {}) => ({
    id: 1,
    name: 'P',
    basePrice: 100,
    compareAtPrice: 150,
    productImages: [],
    variants: [],
    reviews: [],
    ...overrides,
    toJSON() {
      const { toJSON, ...rest } = this;
      return JSON.parse(JSON.stringify(rest));
    },
  });

  beforeEach(() => {
    catalogRepository = {
      findAllCategoriesSorted: jest.fn(),
      getCategoryProductCounts: jest.fn(),
      findCategoryById: jest.fn(),
      findCategoryByIdOrSlug: jest.fn(),
      findCategoryBySlug: jest.fn(),
      findProductsList: jest.fn(),
      findProductByIdWithFullDetails: jest.fn(),
      findProductBySlugWithFullDetails: jest.fn(),
      findProductByPk: jest.fn(),
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
      findAttributeValuesByName: jest.fn().mockResolvedValue([]),
      findOtherAttributes: jest.fn().mockResolvedValue([]),
      findRecentlyViewedByUser: jest.fn(),
      upsertRecentlyViewed: jest.fn().mockResolvedValue(),
      pruneRecentlyViewed: jest.fn().mockResolvedValue(),
      createProduct: jest.fn(),
      saveProduct: jest.fn(async (p) => p),
      deleteProduct: jest.fn().mockResolvedValue(),
      findCategoriesByIds: jest.fn(),
      findWarrantyPackagesByIds: jest.fn(),
      setProductCategories: jest.fn().mockResolvedValue(),
      setProductWarrantyPackages: jest.fn().mockResolvedValue(),
      createProductSpecifications: jest.fn().mockResolvedValue(),
      clearProductAttributes: jest.fn().mockResolvedValue(),
      createProductAttributes: jest.fn().mockResolvedValue(),
      clearProductVariants: jest.fn().mockResolvedValue(),
      createProductVariants: jest.fn().mockResolvedValue(),
      runInTransaction: jest.fn(async (work) => work({})),
    };
    cacheStore = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
      delPattern: jest.fn().mockResolvedValue(),
      delMany: jest.fn().mockResolvedValue(),
    };
    service = new CatalogService({
      catalogRepository,
      cacheStore,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('Pure helpers', () => {
    test('_calcRatings empty reviews → 0/0', () => {
      expect(service._calcRatings([])).toEqual({ average: 0, count: 0 });
      expect(service._calcRatings(null)).toEqual({ average: 0, count: 0 });
    });

    test('_calcRatings tính average + count', () => {
      const reviews = [{ rating: 5 }, { rating: 4 }, { rating: 3 }];
      const result = service._calcRatings(reviews);
      expect(result.count).toBe(3);
      expect(result.average).toBe(4);
    });

    test('_calcRatings onlyVerified filter', () => {
      const reviews = [
        { rating: 5, isVerified: true },
        { rating: 1, isVerified: false }, // skip
      ];
      const result = service._calcRatings(reviews, { onlyVerified: true });
      expect(result.count).toBe(1);
      expect(result.average).toBe(5);
    });

    test('_pickDisplayPrice: variants chọn lowest, không có variant fallback basePrice', () => {
      expect(service._pickDisplayPrice({ basePrice: '100', variants: [] })).toBe(100);
      expect(
        service._pickDisplayPrice({
          basePrice: '100',
          variants: [{ price: '90' }, { price: '80' }, { price: '95' }],
        }),
      ).toBe(80);
    });

    test('_mapProductImages: thumbnail từ isThumbnail flag, fallback first image', () => {
      const json = {
        productImages: [
          { id: 1, imageUrl: 'a.jpg' },
          { id: 2, imageUrl: 'b.jpg', isThumbnail: true },
        ],
      };
      service._mapProductImages(json);
      expect(json.thumbnail).toBe('b.jpg');
      expect(json.images).toHaveLength(2);
    });

    test('_mapProductImages: không có productImages → empty + null thumbnail', () => {
      const json = {};
      service._mapProductImages(json);
      expect(json.images).toEqual([]);
      expect(json.thumbnail).toBeNull();
    });
  });

  describe('getAllProducts', () => {
    test('cache hit → trả từ cache không query DB', async () => {
      cacheStore.get.mockResolvedValue(JSON.stringify({ data: ['cached'] }));
      const result = await service.getAllProducts({ cacheUrl: '/test' });
      expect(result.cacheHit).toBe(true);
      expect(catalogRepository.findProductsList).not.toHaveBeenCalled();
    });

    test('cache miss → query repo + setEx cache', async () => {
      catalogRepository.findProductsList.mockResolvedValue({
        count: 0,
        rows: [],
      });
      const result = await service.getAllProducts({ cacheUrl: '/test' });
      expect(result.cacheHit).toBe(false);
      expect(cacheStore.setEx).toHaveBeenCalled();
    });

    test('category slug resolve → categoryId numeric', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 5 });
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ category: 'phones', cacheUrl: '/x' });
      expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('phones');
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ categoryId: 5 }) }),
      );
    });

    test('category slug not found → categoryIdMissingSentinel=true', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ category: 'unknown', cacheUrl: '/x' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ categoryIdMissingSentinel: true }),
        }),
      );
    });

    test('brand multiple split numeric vs slug', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: ['1', 'apple'], cacheUrl: '/x' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({
            brandIdsIn: ['1'],
            brandSlugsIn: ['apple'],
          }),
        }),
      );
    });

    test('limit cap tại 100', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ limit: '500', cacheUrl: '/x' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });
  });

  describe('getProductById', () => {
    test('không tồn tại theo id và slug → 404', async () => {
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(null);
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(null);
      await expect(service.getProductById({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cache hit → track recently viewed nếu có user', async () => {
      cacheStore.get.mockResolvedValue(JSON.stringify({ data: { id: 5 } }));
      await service.getProductById({ id: 5, userId: 1 });
      // Wait for fire-and-forget upsert
      await new Promise((r) => setImmediate(r));
      expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(1, 5);
    });

    test('fallback từ id sang slug khi findById fail', async () => {
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(null);
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(mkProduct({ id: 7 }));
      const result = await service.getProductById({ id: 'phone-pro' });
      expect(catalogRepository.findProductBySlugWithFullDetails).toHaveBeenCalledWith('phone-pro');
      expect(result.payload.data.id).toBe(7);
    });

    test('variant resolution theo skuId', async () => {
      const product = mkProduct({
        id: 1,
        basePrice: 100,
        name: 'iPhone',
        variants: [
          {
            id: 10,
            price: 100,
            variantName: 'Black',
            isDefault: false,
            attributes: { color: 'Black' },
          },
          {
            id: 20,
            price: 120,
            variantName: 'White',
            isDefault: true,
            attributes: { color: 'White' },
          },
        ],
      });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

      const result = await service.getProductById({ id: 1, skuId: '10' });
      expect(result.payload.data.isVariantProduct).toBe(true);
      expect(result.payload.data.currentVariant.id).toBe(10);
    });
  });

  describe('getProductBySlug', () => {
    test('không tồn tại → 404', async () => {
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(null);
      await expect(service.getProductBySlug({ slug: 'unknown' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  describe('getRelatedProducts', () => {
    test('product không tồn tại → 404', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.getRelatedProducts({ id: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('có category → query findRelatedProducts trước', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5 });
      catalogRepository.findRelatedProducts.mockResolvedValue([mkProduct({ id: 2 })]);
      await service.getRelatedProducts({ id: 1 });
      expect(catalogRepository.findRelatedProducts).toHaveBeenCalled();
      expect(catalogRepository.findRelatedProductsFallback).not.toHaveBeenCalled();
    });

    test('không có category → fallback về newest', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: null });
      catalogRepository.findRelatedProductsFallback.mockResolvedValue([mkProduct({ id: 2 })]);
      await service.getRelatedProducts({ id: 1 });
      expect(catalogRepository.findRelatedProductsFallback).toHaveBeenCalled();
    });

    test('related rỗng + category → fallback', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, categoryId: 5 });
      catalogRepository.findRelatedProducts.mockResolvedValue([]);
      catalogRepository.findRelatedProductsFallback.mockResolvedValue([mkProduct({ id: 2 })]);
      await service.getRelatedProducts({ id: 1 });
      expect(catalogRepository.findRelatedProductsFallback).toHaveBeenCalled();
    });
  });

  describe('searchProducts', () => {
    test('thiếu q → 400', async () => {
      await expect(service.searchProducts({})).rejects.toMatchObject({ statusCode: 400 });
    });

    test('có q → trả pagination', async () => {
      catalogRepository.searchProducts.mockResolvedValue({
        count: 10,
        rows: [mkProduct(), mkProduct()],
      });
      const result = await service.searchProducts({ q: 'iphone', page: 1, limit: 5 });
      expect(result.total).toBe(10);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getProductSuggestions', () => {
    test('q rỗng → []', async () => {
      const result = await service.getProductSuggestions({ q: '' });
      expect(result).toEqual([]);
    });

    test('q có giá trị → query repo + map thumbnail', async () => {
      catalogRepository.findProductSuggestions.mockResolvedValue([
        {
          toJSON: () => ({
            id: 1,
            name: 'A',
            slug: 'a',
            productImages: [{ imageUrl: 'a.jpg', isThumbnail: true }],
          }),
        },
      ]);
      const result = await service.getProductSuggestions({ q: 'a' });
      expect(result[0].thumbnail).toBe('a.jpg');
    });
  });

  describe('getBestSellers', () => {
    test('không có data → fallback newest', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([mkProduct()]);
      const result = await service.getBestSellers({ limit: 5 });
      expect(catalogRepository.findNewArrivals).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    test('period=week → startDate 7 ngày trước', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([{ id: 1 }]);
      catalogRepository.findProductsByIdsOrdered.mockResolvedValue([mkProduct({ id: 1 })]);
      await service.getBestSellers({ period: 'week' });
      const callArg = catalogRepository.findBestSellersRaw.mock.calls[0][0];
      const daysDiff = Math.round((Date.now() - callArg.startDate.getTime()) / 86400000);
      expect(daysDiff).toBeGreaterThanOrEqual(7);
      expect(daysDiff).toBeLessThanOrEqual(8);
    });
  });

  describe('getDeals', () => {
    test('parsedLimit cap 100', async () => {
      catalogRepository.findDeals.mockResolvedValue([]);
      await service.getDeals({ limit: 999 });
      expect(catalogRepository.findDeals).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
      );
    });

    test('default minDiscount=5', async () => {
      catalogRepository.findDeals.mockResolvedValue([]);
      await service.getDeals({});
      expect(catalogRepository.findDeals).toHaveBeenCalledWith(
        expect.objectContaining({ minDiscount: 5 }),
      );
    });

    test('tính discountPercentage đúng', async () => {
      const product = {
        compareAtPrice: '200',
        basePrice: '150',
        reviews: [],
        toJSON: function () {
          return { ...this, productImages: [] };
        },
      };
      catalogRepository.findDeals.mockResolvedValue([product]);
      const result = await service.getDeals({ minDiscount: 10 });
      expect(result[0].discountPercentage).toBe(25);
    });
  });

  describe('getProductVariants / getProductReviewsSummary', () => {
    test('getProductVariants: 404 nếu product không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.getProductVariants({ id: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('getProductReviewsSummary: distribution + average', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1 });
      catalogRepository.findProductRatingsRows.mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
      ]);
      const result = await service.getProductReviewsSummary({ id: 1 });
      expect(result.count).toBe(3);
      expect(result.distribution[5]).toBe(2);
      expect(result.distribution[4]).toBe(1);
    });
  });

  describe('getProductFilters', () => {
    test('categoryId không hợp lệ → 400', async () => {
      await expect(service.getProductFilters({ categoryId: '!@#$' })).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    test('categoryId numeric → resolved', async () => {
      catalogRepository.getProductPriceRange.mockResolvedValue({ min: 100, max: 5000 });
      const result = await service.getProductFilters({ categoryId: '5' });
      expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: 5 });
      expect(result.priceRange).toEqual({ min: 100, max: 5000 });
    });

    test('collectValues unique từ multi rows', async () => {
      catalogRepository.findAttributeValuesByName
        .mockResolvedValueOnce([{ values: ['Apple', 'Samsung'] }, { values: ['Apple', 'Xiaomi'] }]) // brand
        .mockResolvedValueOnce([]) // color
        .mockResolvedValueOnce([]); // size
      catalogRepository.getProductPriceRange.mockResolvedValue({ min: 0, max: 0 });
      const result = await service.getProductFilters({});
      expect(result.brands).toEqual(expect.arrayContaining(['Apple', 'Samsung', 'Xiaomi']));
      expect(result.brands).toHaveLength(3);
    });
  });

  describe('createProduct', () => {
    test('isVariantProduct=true → basePrice=0', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 1 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue({ id: 1 });
      await service.createProduct({
        payload: {
          name: 'P',
          price: 100,
          variants: [{ name: 'V1', price: 90, attributes: {} }],
        },
      });
      expect(catalogRepository.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ basePrice: 0, isVariantProduct: true }),
        expect.any(Object),
      );
    });

    test('không có variants → basePrice=price', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 1 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue({ id: 1 });
      await service.createProduct({ payload: { name: 'P', price: 200 } });
      expect(catalogRepository.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({ basePrice: 200, isVariantProduct: false }),
        expect.any(Object),
      );
    });

    test('categoryIds không match → 400', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 1 });
      catalogRepository.findCategoriesByIds.mockResolvedValue([{ id: 1 }]); // 1 found
      await expect(
        service.createProduct({ payload: { name: 'P', price: 100, categoryIds: [1, 99] } }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'catalog.categoriesNotExist' });
    });

    test('warrantyPackageIds không match → 400', async () => {
      catalogRepository.createProduct.mockResolvedValue({ id: 1 });
      catalogRepository.findWarrantyPackagesByIds.mockResolvedValue([]);
      await expect(
        service.createProduct({ payload: { name: 'P', price: 100, warrantyPackageIds: [1] } }),
      ).rejects.toMatchObject({ statusCode: 400, message: 'catalog.warrantyPackagesNotExist' });
    });
  });

  describe('updateProduct', () => {
    test('không tồn tại → 404', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.updateProduct({ id: 99, patch: {} })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('chỉ cập nhật field cung cấp (Object.hasOwnProperty)', async () => {
      const product = { id: 1, name: 'Old', price: 50, slug: 'old', save: jest.fn() };
      catalogRepository.findProductByPk.mockResolvedValue(product);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

      await service.updateProduct({ id: 1, patch: { name: 'New' } });

      expect(product.name).toBe('New');
      expect(product.price).toBe(50); // không touch
    });

    test('warrantyPackageIds=[] → setProductWarrantyPackages([])', async () => {
      const product = { id: 1, slug: 'x', save: jest.fn() };
      catalogRepository.findProductByPk.mockResolvedValue(product);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

      await service.updateProduct({ id: 1, patch: { warrantyPackageIds: [] } });

      expect(catalogRepository.setProductWarrantyPackages).toHaveBeenCalledWith(
        product,
        [],
        expect.any(Object),
      );
    });

    test('variants=[...] → clearProductVariants + createProductVariants', async () => {
      const product = { id: 1, slug: 'x', save: jest.fn() };
      catalogRepository.findProductByPk.mockResolvedValue(product);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

      await service.updateProduct({
        id: 1,
        patch: { variants: [{ name: 'V', price: 100, attributes: {} }] },
      });

      expect(catalogRepository.clearProductVariants).toHaveBeenCalled();
      expect(catalogRepository.createProductVariants).toHaveBeenCalled();
    });
  });

  describe('deleteProduct', () => {
    test('không tồn tại → 404', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.deleteProduct({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('xóa thành công + cache busting', async () => {
      const product = { id: 1, slug: 'x' };
      catalogRepository.findProductByPk.mockResolvedValue(product);
      const result = await service.deleteProduct({ id: 1 });
      expect(result.message).toBe('catalog.productDeleted');
      expect(catalogRepository.deleteProduct).toHaveBeenCalledWith(product);
    });
  });
});
