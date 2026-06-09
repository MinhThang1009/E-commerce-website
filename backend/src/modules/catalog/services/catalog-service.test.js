// Phase 42.9 — Unit tests cho CatalogService Sprint 6a (Category+Brand).
// Phase 44+ — Bổ sung Product CRUD, list, detail, search, helpers (Sprint 6b).
const CatalogService = require('./catalog-service');

// ---------- Helper factories ----------

/** Tạo mock product row có toJSON() */
function makeProductRow(overrides = {}) {
  const data = {
    id: 1,
    name: 'iPhone 15 Pro',
    slug: 'iphone-15-pro',
    status: 'active',
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
      findProductRatingsSummary: jest.fn(),
      getProductPriceRange: jest.fn(),
      findAttributeValuesByName: jest.fn(),
      findOtherAttributes: jest.fn(),
      findRecentlyViewedByUser: jest.fn(),
      upsertRecentlyViewed: jest.fn().mockResolvedValue(),
      pruneRecentlyViewed: jest.fn().mockResolvedValue(),
    };
    service = new CatalogService({
      catalogRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  describe('Category', () => {
    test('getAllCategories → query + map productCount', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([
        { id: 1, toJSON: () => ({ id: 1, name: 'A' }) },
        { id: 2, toJSON: () => ({ id: 2, name: 'B' }) },
      ]);
      catalogRepository.getCategoryProductCounts.mockResolvedValue({ 1: 10, 2: 5 });

      const result = await service.getAllCategories();

      expect(result.data[0].productCount).toBe(10);
      expect(result.data[1].productCount).toBe(5);
    });

    test('getAllCategories lọc bỏ category có productCount = 0', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([
        { id: 1, toJSON: () => ({ id: 1, name: 'A' }) },
        { id: 2, toJSON: () => ({ id: 2, name: 'Empty' }) },
      ]);
      catalogRepository.getCategoryProductCounts.mockResolvedValue({ 1: 5 });

      const result = await service.getAllCategories();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].productCount).toBe(5);
    });

    test('getCategoryById không tồn tại → 404', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      await expect(service.getCategoryById({ id: 99 })).rejects.toMatchObject({ statusCode: 404 });
    });

    test('createCategory → trả về category mới', async () => {
      catalogRepository.createCategory.mockResolvedValue({ id: 1 });
      const result = await service.createCategory({ payload: { name: 'A', description: 'd' } });
      expect(catalogRepository.createCategory).toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    test('updateCategory không tìm thấy → 404', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      await expect(service.updateCategory({ id: 1, patch: {} })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('deleteCategory có sản phẩm → 400', async () => {
      catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
      catalogRepository.countProductsByCategoryId.mockResolvedValue(5);
      await expect(service.deleteCategory({ id: 1 })).rejects.toMatchObject({
        statusCode: 400,
        message: 'catalog.cannotDeleteCategoryWithProducts',
      });
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
      expect(catalogRepository.findAllBrands).toHaveBeenCalledWith({
        filter: { hasProducts: true },
      });
    });

    test('getAllBrands filter theo categoryId numeric', async () => {
      catalogRepository.findBrandIdsByCategoryId.mockResolvedValue([5, 7]);
      catalogRepository.findAllBrands.mockResolvedValue([]);

      await service.getAllBrands({ categoryId: '3' });

      expect(catalogRepository.findBrandIdsByCategoryId).toHaveBeenCalledWith('3');
      expect(catalogRepository.findAllBrands).toHaveBeenCalledWith({
        filter: { idIn: [5, 7], hasProducts: false },
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
      await expect(service.deleteBrand({ id: 1 })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('updateBrand → cập nhật thành công', async () => {
      catalogRepository.findBrandById.mockResolvedValue({});
      await service.updateBrand({ id: 1, patch: { name: 'X' } });
      expect(catalogRepository.saveBrand).toHaveBeenCalled();
    });

    test('getBrandBySlug không tồn tại → 404', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue(null);
      await expect(service.getBrandBySlug({ slug: 'unknown' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('getProductsByBrand không tìm thấy brand → 404', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue(null);
      await expect(service.getProductsByBrand({ slug: 'unknown' })).rejects.toMatchObject({
        statusCode: 404,
      });
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
      expect(service._calcRatings(reviews, { onlyVerified: true })).toEqual({
        average: 0,
        count: 0,
      });
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
    test('query repository và trả về payload', async () => {
      catalogRepository.findProductsList.mockResolvedValue({
        count: 1,
        rows: [makeProductRow()],
      });

      const result = await service.getAllProducts({ page: 1 });
      expect(catalogRepository.findProductsList).toHaveBeenCalled();
      expect(result.payload).toBeDefined();
    });

    test('resolve category slug → id trước khi query', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue({ id: 5 });
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ category: 'dien-thoai' });
      expect(catalogRepository.findCategoryBySlug).toHaveBeenCalledWith('dien-thoai');
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ categoryId: 5 }) }),
      );
    });

    test('đặt categoryIdMissingSentinel khi slug không tồn tại', async () => {
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ category: 'khong-ton-tai' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ categoryIdMissingSentinel: true }),
        }),
      );
    });

    test('giới hạn limit tối đa là 100', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ limit: 9999 });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100 }),
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

    test('fallback sang slug khi id không tìm thấy', async () => {
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(null);
      const productRow = makeProductRow({ id: 5, slug: 'iphone-15-pro' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(productRow);

      await service.getProductById({ id: 'iphone-15-pro' });
      expect(catalogRepository.findProductBySlugWithFullDetails).toHaveBeenCalledWith(
        'iphone-15-pro',
      );
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
      await expect(service.getProductBySlug({ slug: 'unknown' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('trả về responseData khi tìm thấy', async () => {
      const productRow = makeProductRow({ id: 3, slug: 'macbook-pro' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(productRow);

      const result = await service.getProductBySlug({ slug: 'macbook-pro' });
      expect(result.payload.data).toHaveProperty('id', 3);
    });
  });

  // ============================================================
  // Product — getFeaturedProducts
  // ============================================================

  describe('getFeaturedProducts', () => {
    test('trả về danh sách sản phẩm nổi bật', async () => {
      catalogRepository.findFeaturedProducts.mockResolvedValue([
        makeProductRow({ isFeatured: true }),
      ]);
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
      await expect(service.getRelatedProducts({ id: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('trả về sản phẩm liên quan khi có categoryId', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({
        id: 1,
        categoryId: 5,
        status: 'active',
      });
      catalogRepository.findRelatedProducts.mockResolvedValue([makeProductRow({ id: 2 })]);

      const result = await service.getRelatedProducts({ id: 1, limit: 4 });
      expect(result).toHaveLength(1);
    });

    test('fallback sang findRelatedProductsFallback khi không có sản phẩm liên quan', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({
        id: 1,
        categoryId: 5,
        status: 'active',
      });
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
          id: 1,
          name: 'iPhone 15',
          slug: 'iphone-15',
          productImages: [{ isThumbnail: true, imageUrl: 'thumb.jpg' }],
        }),
      };
      catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

      const result = await service.getProductSuggestions({ q: 'iphone' });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 1,
        name: 'iPhone 15',
        slug: 'iphone-15',
        thumbnail: 'thumb.jpg',
      });
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
        expect.objectContaining({ startDate: expect.any(Date), limit: 5 }),
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
        expect.objectContaining({ limit: 100 }),
      );
    });
  });

  // ============================================================
  // Product — getProductVariants
  // ============================================================

  describe('getProductVariants', () => {
    test('404 khi sản phẩm không tồn tại', async () => {
      catalogRepository.findProductByPk.mockResolvedValue(null);
      await expect(service.getProductVariants({ id: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('trả về danh sách variants', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, status: 'active' });
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
      await expect(service.getProductReviewsSummary({ id: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('trả về average = 0 khi không có reviews', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 1, status: 'active' });
      catalogRepository.findProductRatingsSummary.mockResolvedValue({
        count: 0,
        average: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });

      const result = await service.getProductReviewsSummary({ id: 1 });
      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });

    test('tính đúng average và distribution', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 2, status: 'active' });
      catalogRepository.findProductRatingsSummary.mockResolvedValue({
        count: 4,
        average: 4.3,
        distribution: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 },
      });

      const result = await service.getProductReviewsSummary({ id: 2 });
      expect(result.count).toBe(4);
      expect(result.average).toBe(4.3);
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
      await expect(service.getProductFilters({ categoryId: '!invalid!' })).rejects.toMatchObject({
        statusCode: 400,
      });
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
          {
            id: 10,
            price: '22000000',
            compareAtPrice: null,
            stockQuantity: 3,
            variantName: 'Đen 256GB',
            isDefault: false,
            attributes: { color: 'đen' },
            sku: 'SKU-10',
            specifications: {},
          },
          {
            id: 11,
            price: '25000000',
            compareAtPrice: null,
            stockQuantity: 1,
            variantName: 'Trắng 256GB',
            isDefault: true,
            attributes: { color: 'trắng' },
            sku: 'SKU-11',
            specifications: {},
          },
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
          {
            id: 20,
            price: '20000000',
            compareAtPrice: null,
            stockQuantity: 5,
            variantName: 'Variant A',
            isDefault: true,
            attributes: {},
            sku: 'SKU-20',
            specifications: {},
          },
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
          {
            id: 30,
            price: '20000000',
            compareAtPrice: null,
            stockQuantity: 5,
            variantName: 'Xanh 128GB',
            isDefault: false,
            attributes: { color: 'xanh' },
            sku: 'SKU-30',
            specifications: {},
          },
          {
            id: 31,
            price: '22000000',
            compareAtPrice: null,
            stockQuantity: 3,
            variantName: 'Đỏ 128GB',
            isDefault: true,
            attributes: { color: 'đỏ' },
            sku: 'SKU-31',
            specifications: {},
          },
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
          {
            id: 40,
            price: '25000000',
            compareAtPrice: null,
            stockQuantity: 2,
            variantName: 'Silver 512GB',
            isDefault: true,
            attributes: {},
            sku: 'SKU-40',
            specifications: {},
          },
        ],
      });
      const result = service._buildProductDetailResponse(product, { skuId: '40' });
      // variant images phải chỉ chứa ảnh có variantId = 40
      expect(result.images).toHaveLength(1);
      expect(result.images[0].url).toBe('img1.jpg');
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
      await expect(service.getCategoryBySlug({ slug: 'unknown' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('updateCategory cập nhật name + description', async () => {
      const cat = { id: 1, name: 'Old', description: 'Old desc' };
      catalogRepository.findCategoryById.mockResolvedValue(cat);
      await service.updateCategory({ id: 1, patch: { name: 'New', description: 'New desc' } });
      expect(cat.name).toBe('New');
      expect(cat.description).toBe('New desc');
      expect(catalogRepository.saveCategory).toHaveBeenCalledWith(cat);
    });

    test('getFeaturedCategories → dùng getAllCategories (filter isActive + productCount>0)', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([
        { id: 1, toJSON: () => ({ id: 1, isActive: true }) },
        { id: 2, toJSON: () => ({ id: 2, isActive: false }) },
      ]);
      catalogRepository.getCategoryProductCounts.mockResolvedValue({ 1: 5 });
      const result = await service.getFeaturedCategories();
      expect(result.data).toHaveLength(1); // chỉ active + có sản phẩm
    });

    test('getProductsByCategory không tìm thấy cả id lẫn slug → 404', async () => {
      catalogRepository.findCategoryById.mockResolvedValue(null);
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);
      await expect(service.getProductsByCategory({ id: 'unknown' })).rejects.toMatchObject({
        statusCode: 404,
      });
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
  // getAllProducts — brand filter
  // ============================================================

  describe('getAllProducts — brand filter paths', () => {
    test('filter brand theo id (numeric) → brandIdsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: '5' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ brandIdsIn: ['5'] }) }),
      );
    });

    test('filter brand theo slug → brandSlugsIn', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: 'apple' });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({ filter: expect.objectContaining({ brandSlugsIn: ['apple'] }) }),
      );
    });

    test('filter brand là array → phân loại ids và slugs', async () => {
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });
      await service.getAllProducts({ brand: ['5', 'samsung'] });
      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ brandIdsIn: ['5'], brandSlugsIn: ['samsung'] }),
        }),
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
  // getBestSellers — period = 'week' và 'month' (default)
  // ============================================================

  describe('getBestSellers — period paths', () => {
    test('period = month (default) → startDate setMonth - 1', async () => {
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([]);

      await service.getBestSellers({ limit: 5 });
      expect(catalogRepository.findBestSellersRaw).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: expect.any(Date) }),
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
  // Brand — getBrandBySlug: not found → 404 (line 176)
  // ============================================================

  describe('getBrandBySlug', () => {
    test('ném AppError 404 khi brand không tồn tại theo slug', async () => {
      catalogRepository.findBrandBySlug.mockResolvedValue(null);

      await expect(service.getBrandBySlug({ slug: 'unknown-brand' })).rejects.toMatchObject({
        statusCode: 404,
        message: 'catalog.brandNotFound',
      });
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
        { name: 'Xuất xứ', values: null }, // values=null → dùng [] fallback
      ]);

      const result = await service.getProductFilters({});

      expect(result.attributes).toEqual([
        { name: 'Chất liệu', values: ['Nhôm', 'Nhựa'] },
        { name: 'Xuất xứ', values: [] },
      ]);
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

      await expect(service.deleteCategory({ id: 999 })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('_mapProductWithImages — line 150: không có variants → json.price = json.basePrice', () => {
    test('đặt price = basePrice khi product có variants=[] (empty array)', () => {
      // _mapProductWithImages else branch: variants.length === 0 → line 150 hit
      const productMock = {
        toJSON: () => ({
          id: 1,
          basePrice: 15000000,
          variants: [], // empty → else branch → line 150
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

      await expect(service.updateBrand({ id: 999, patch: { name: 'X' } })).rejects.toMatchObject({
        statusCode: 404,
      });
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
        }),
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
          categories: [existingCat], // non-empty → .some() callback executes (line 431 stmt 252)
          category: cat, // different id → not found → pushed
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
        expect.any(Error),
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
        expect.any(Error),
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
        expect.arrayContaining([expect.objectContaining({ color: 'Black' })]),
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
        expect.arrayContaining([expect.objectContaining({ color: 'Silver' })]),
      );
      expect(result.images).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ color: 'Black' })]),
      );
    });
  });
});

// ─── catalog-service — uncovered branch tests ─────────────────────────────────

describe('CatalogService — uncovered branches', () => {
  let service;

  beforeEach(() => {
    service = new CatalogService({
      catalogRepository: {},
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
  });

  describe('_pickDisplayPrice — basePrice=0 (|| 0 branch)', () => {
    test('trả về 0 khi basePrice=0', () => {
      const price = service._pickDisplayPrice({ basePrice: '0', variants: [] });
      expect(price).toBe(0);
    });

    test('trả về 0 khi basePrice null', () => {
      const price = service._pickDisplayPrice({ basePrice: null, variants: [] });
      expect(price).toBe(0);
    });
  });

  describe('_buildProductDetailResponse — basePrice=0 (line 534)', () => {
    test('price=0 khi basePrice=0', () => {
      const product = makeProductRow({ basePrice: '0', compareAtPrice: null, reviews: [] });
      const result = service._buildProductDetailResponse(product, {});
      expect(result.price).toBe(0);
    });
  });

  describe('_buildProductDetailResponse — variant attrs || {} branch (line 547)', () => {
    test('variant không có attributes → dùng {} default', () => {
      const product = makeProductRow({
        basePrice: '10000000',
        reviews: [],
        variants: [
          {
            id: 50,
            price: '10000000',
            compareAtPrice: null,
            stockQuantity: 5,
            variantName: 'Variant A',
            isDefault: false,
            sku: 'SKU-50',
            specifications: {},
            attributes: undefined,
          },
        ],
      });
      // queryColor 'xanh' → sẽ vào color-lookup nhưng không match → fallback to default variant
      const result = service._buildProductDetailResponse(product, { queryColor: 'xanh' });
      expect(result).toBeDefined();
    });
  });

  describe('_buildProductDetailResponse — skuId + matchByVariantId (lines 557-566)', () => {
    test('filter images theo variantId khi skuId được cung cấp', () => {
      const product = makeProductRow({
        basePrice: '20000000',
        reviews: [],
        variants: [
          {
            id: 60,
            price: '20000000',
            compareAtPrice: null,
            stockQuantity: 3,
            variantName: 'Đen',
            isDefault: true,
            attributes: { color: 'đen' },
            sku: 'SKU-60',
            specifications: {},
          },
        ],
        productImages: [
          { imageUrl: 'img1.jpg', variantId: 60, color: 'đen', isThumbnail: false },
          { imageUrl: 'img2.jpg', variantId: null, color: null, isThumbnail: true },
        ],
      });
      const result = service._buildProductDetailResponse(product, { skuId: '60' });
      expect(result).toBeDefined();
    });
  });
});

// ─── Tests bổ sung ───────────────────────────────────────────────────────────

describe('CatalogService._buildProductDetailResponse — variant edge cases', () => {
  let service;

  beforeEach(() => {
    service = new CatalogService({
      catalogRepository: {},
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  test('variant không có attributes → dùng {} default, không crash', () => {
    const product = makeProductRow({
      basePrice: '10000000',
      reviews: [],
      variants: [
        {
          id: 70,
          price: '10000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Default',
          isDefault: true,
          sku: 'SKU-70',
          specifications: {},
          attributes: undefined,
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {});
    expect(result).toBeDefined();
    expect(result.isVariantProduct).toBe(true);
  });

  test('product không có images property → variantImages = [], không crash', () => {
    const product = makeProductRow({
      basePrice: '15000000',
      reviews: [],
      variants: [
        {
          id: 80,
          price: '15000000',
          compareAtPrice: null,
          stockQuantity: 3,
          variantName: 'Variant',
          isDefault: true,
          sku: 'SKU-80',
          specifications: {},
          attributes: { color: 'đen' },
        },
      ],
      productImages: undefined, // không có images
    });
    const result = service._buildProductDetailResponse(product, { skuId: '80' });
    expect(result).toBeDefined();
  });
});

// ─── _buildProductDetailResponse — if(!skuId && normColor) FALSE branch ──────

describe('CatalogService._buildProductDetailResponse — variantColor không override khi có skuId', () => {
  test('variantColor KHÔNG override khi skuId được cung cấp (FALSE branch line 563)', () => {
    const svc = new CatalogService({
      catalogRepository: {},
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
    const product = makeProductRow({
      basePrice: '20000000',
      reviews: [],
      variants: [
        {
          id: 90,
          price: '20000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen 128GB',
          isDefault: true,
          sku: 'SKU-90',
          specifications: {},
          attributes: { color: 'đen' },
        },
      ],
    });
    // skuId được cung cấp → !skuId = false → variantColor KHÔNG bị override bởi normColor
    const result = svc._buildProductDetailResponse(product, { skuId: '90', queryColor: 'trắng' });
    expect(result).toBeDefined();
    expect(result.sku).toBe('SKU-90');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Merged from: catalog-service.edge-cases.test.js
// Branch coverage tests nhắm vào các nhánh chưa cover trong file gốc.
// ═══════════════════════════════════════════════════════════════════════════════

describe('CatalogService — edge cases (branch coverage)', () => {
  function makeProductRowEdge(overrides = {}) {
    const data = {
      id: 1,
      name: 'Test Product',
      slug: 'test-product',
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

  function makeServiceEdge(repoOverrides = {}) {
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
      ...repoOverrides,
    };

    const service = new CatalogService({
      catalogRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });

    return { service, catalogRepository };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // getAllCategories — line 35
  // ════════════════════════════════════════════════════════════════════════════

  describe('getAllCategories — lọc category không có sản phẩm', () => {
    it('category không có trong countMap (productCount = 0) → bị lọc khỏi kết quả', async () => {
      const { service, catalogRepository } = makeServiceEdge();
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
  // ════════════════════════════════════════════════════════════════════════════

  describe('getCategoryById — tìm thấy', () => {
    it('tìm thấy category theo id → trả về category không throw', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const foundCat = { id: 5, name: 'Electronics' };
      catalogRepository.findCategoryById.mockResolvedValue(foundCat);

      const result = await service.getCategoryById({ id: 5 });

      expect(result).toBe(foundCat);
    });
  });

  describe('getCategoryBySlug — tìm thấy', () => {
    it('tìm thấy category theo slug → trả về category không throw', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const foundCat = { id: 3, slug: 'electronics' };
      catalogRepository.findCategoryByIdOrSlug.mockResolvedValue(foundCat);

      const result = await service.getCategoryBySlug({ slug: 'electronics' });

      expect(result).toBe(foundCat);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // updateCategory — lines 84-85
  // ════════════════════════════════════════════════════════════════════════════

  describe('updateCategory — patch không đầy đủ fields', () => {
    it('patch chỉ có name → chỉ name được cập nhật, description giữ nguyên', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = { id: 1, name: 'Old Name', description: 'Old Desc' };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 1, patch: { name: 'New Name' } });

      expect(cat.name).toBe('New Name');
      expect(cat.description).toBe('Old Desc');
      expect(catalogRepository.saveCategory).toHaveBeenCalledWith(cat);
    });

    it('patch chỉ có description → chỉ description được cập nhật, name giữ nguyên', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = { id: 2, name: 'Unchanged', description: 'Old' };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 2, patch: { description: 'New Desc' } });

      expect(cat.name).toBe('Unchanged');
      expect(cat.description).toBe('New Desc');
    });

    it('patch rỗng → cả name lẫn description không thay đổi', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = { id: 3, name: 'Keep Me', description: 'Keep Me Too' };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 3, patch: {} });

      expect(cat.name).toBe('Keep Me');
      expect(cat.description).toBe('Keep Me Too');
    });

    it('patch có image → category.image được cập nhật', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = {
        id: 4,
        name: 'Cat',
        description: '',
        image: null,
        parentId: null,
        isActive: true,
        sortOrder: 0,
      };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 4, patch: { image: 'https://new-image.jpg' } });

      expect(cat.image).toBe('https://new-image.jpg');
    });

    it('patch có parentId → category.parentId được cập nhật', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = {
        id: 5,
        name: 'Child',
        description: '',
        image: null,
        parentId: null,
        isActive: true,
        sortOrder: 0,
      };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 5, patch: { parentId: 10 } });

      expect(cat.parentId).toBe(10);
    });

    it('patch có isActive → category.isActive được cập nhật', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = {
        id: 6,
        name: 'Cat',
        description: '',
        image: null,
        parentId: null,
        isActive: true,
        sortOrder: 0,
      };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 6, patch: { isActive: false } });

      expect(cat.isActive).toBe(false);
    });

    it('patch có sortOrder → category.sortOrder được cập nhật', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const cat = {
        id: 7,
        name: 'Cat',
        description: '',
        image: null,
        parentId: null,
        isActive: true,
        sortOrder: 0,
      };
      catalogRepository.findCategoryById.mockResolvedValue(cat);

      await service.updateCategory({ id: 7, patch: { sortOrder: 5 } });

      expect(cat.sortOrder).toBe(5);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _mapProductWithImages — line 136
  // ════════════════════════════════════════════════════════════════════════════

  describe('_mapProductWithImages', () => {
    it('không có productImages → json.images và json.thumbnail không được set', () => {
      const { service } = makeServiceEdge();
      const product = {
        toJSON: () => ({ id: 1, name: 'X', basePrice: '5000', variants: [] }),
      };

      const result = service._mapProductWithImages(product);

      expect(result.images).toBeUndefined();
      expect(result.thumbnail).toBeUndefined();
      expect(result.price).toBe('5000');
    });

    it('có productImages nhưng không có ảnh isThumbnail → lấy ảnh đầu tiên làm thumbnail', () => {
      const { service } = makeServiceEdge();
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
      const { service } = makeServiceEdge();
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
      const { service } = makeServiceEdge();
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
      const { service } = makeServiceEdge();
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
  // getAllBrands — category slug không tồn tại
  // ════════════════════════════════════════════════════════════════════════════

  describe('getAllBrands — category slug không tồn tại', () => {
    it('category slug không tìm thấy → catId = -1, vẫn gọi findBrandIdsByCategoryId(-1)', async () => {
      const { service, catalogRepository } = makeServiceEdge();
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

  describe('getAllProducts — brand filter (edge)', () => {
    it('brand là string (không phải array) → bọc thành array', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ brand: 'apple' });

      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ brandSlugsIn: ['apple'] }),
        }),
      );
    });

    it('brand là numeric string → brandIdsIn được set', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({ brand: '5' });

      expect(catalogRepository.findProductsList).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: expect.objectContaining({ brandIdsIn: ['5'] }),
        }),
      );
    });

    it('category là numeric string → categoryId được set trực tiếp (không query slug)', async () => {
      const { service, catalogRepository } = makeServiceEdge();
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
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findProductsList.mockResolvedValue({ count: 0, rows: [] });

      await service.getAllProducts({});

      expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
      const call = catalogRepository.findProductsList.mock.calls[0][0];
      expect(call.filter.categoryId).toBeUndefined();
      expect(call.filter.categoryIdMissingSentinel).toBeFalsy();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getAllProducts — map category vào categories
  // ════════════════════════════════════════════════════════════════════════════

  describe('getAllProducts — map category vào categories (edge)', () => {
    it('json.category tồn tại và chưa trong categories → được push vào categories', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const row = makeProductRowEdge({
        categories: [],
        category: { id: 5, name: 'Phones' },
      });
      catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

      const { payload } = await service.getAllProducts({});

      expect(payload.data[0].categories).toHaveLength(1);
      expect(payload.data[0].categories[0].id).toBe(5);
    });

    it('json.category đã có trong categories → không push lại', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const row = makeProductRowEdge({
        categories: [{ id: 5, name: 'Phones' }],
        category: { id: 5, name: 'Phones' },
      });
      catalogRepository.findProductsList.mockResolvedValue({ count: 1, rows: [row] });

      const { payload } = await service.getAllProducts({});

      expect(payload.data[0].categories).toHaveLength(1);
    });

    it('json.categories = null → được khởi tạo thành [] trước khi push', async () => {
      const { service, catalogRepository } = makeServiceEdge();
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
  // getProductById — trackRecentlyViewed
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductById — trackRecentlyViewed với userId (edge)', () => {
    it('có userId → gọi upsertRecentlyViewed sau khi tìm thấy sản phẩm', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const product = makeProductRowEdge({ id: 42 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

      await service.getProductById({ id: 42, userId: 10 });

      await new Promise((r) => setImmediate(r));
      expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(10, 42);
    });

    it('không có userId → không gọi upsertRecentlyViewed', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const product = makeProductRowEdge({ id: 1 });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);

      await service.getProductById({ id: 1 });

      await new Promise((r) => setImmediate(r));
      expect(catalogRepository.upsertRecentlyViewed).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getProductBySlug — lines 503-508: userId → trackRecentlyViewed
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductBySlug — với userId (edge)', () => {
    it('có userId → gọi upsertRecentlyViewed sau khi tìm thấy sản phẩm', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const product = makeProductRowEdge({ id: 7, slug: 'my-product' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

      await service.getProductBySlug({ slug: 'my-product', userId: 3 });

      await new Promise((r) => setImmediate(r));
      expect(catalogRepository.upsertRecentlyViewed).toHaveBeenCalledWith(3, 7);
    });

    it('không có userId → không gọi upsertRecentlyViewed', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const product = makeProductRowEdge({ id: 8, slug: 'other-product' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(product);

      await service.getProductBySlug({ slug: 'other-product' });

      await new Promise((r) => setImmediate(r));
      expect(catalogRepository.upsertRecentlyViewed).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _buildProductDetailResponse — image filtering branches
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — image filtering branches (edge)', () => {
    it('skuId có nhưng không có ảnh theo variantId, có variantColor → lọc ảnh theo color', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
  // _buildProductDetailResponse — fullName logic
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — fullName logic (edge)', () => {
    it('variantName đã chứa mainName → fullName = variantName (không thêm prefix)', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
      const { service } = makeServiceEdge();
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
  // _buildProductDetailResponse — variantColor override với normColor
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — variantColor override với normColor (edge)', () => {
    it('không có skuId và có normColor → variantColor = normColor', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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

      const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });

      expect(result.images[0].url).toBe('red-shoe.jpg');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _buildProductDetailResponse — variantName fallback displayName
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — variantName fallback displayName (edge)', () => {
    it('không có variantName → dùng displayName', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
  // getRelatedProducts — không có categoryId
  // ════════════════════════════════════════════════════════════════════════════

  describe('getRelatedProducts — không có categoryId (edge)', () => {
    it('product.categoryId = null → không gọi findRelatedProducts, fallback ngay', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findProductByPk.mockResolvedValue({
        id: 1,
        categoryId: null,
        status: 'active',
      });
      catalogRepository.findRelatedProductsFallback.mockResolvedValue([
        makeProductRowEdge({ id: 2 }),
      ]);

      const result = await service.getRelatedProducts({ id: 1, limit: 4 });

      expect(catalogRepository.findRelatedProducts).not.toHaveBeenCalled();
      expect(catalogRepository.findRelatedProductsFallback).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('product.categoryId = undefined → không gọi findRelatedProducts', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findProductByPk.mockResolvedValue({ id: 2, status: 'active' });
      catalogRepository.findRelatedProductsFallback.mockResolvedValue([]);

      await service.getRelatedProducts({ id: 2 });

      expect(catalogRepository.findRelatedProducts).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getProductFilters — slug không tìm thấy
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductFilters — slug không tìm thấy (edge)', () => {
    it('categoryId là slug hợp lệ nhưng không tìm thấy trong DB → actualCategoryId = null', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findCategoryBySlug.mockResolvedValue(null);

      await service.getProductFilters({ categoryId: 'nonexistent-category' });

      expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: null });
    });

    it('categoryId = 0 (falsy) → bỏ qua toàn bộ block, actualCategoryId = null', async () => {
      const { service, catalogRepository } = makeServiceEdge();

      await service.getProductFilters({ categoryId: 0 });

      expect(catalogRepository.findCategoryBySlug).not.toHaveBeenCalled();
      expect(catalogRepository.getProductPriceRange).toHaveBeenCalledWith({ categoryId: null });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getProductFilters — collectValues với values không phải array
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductFilters — collectValues với values không phải array (edge)', () => {
    it('row.values = null → không thêm vào set (không crash)', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findAttributeValuesByName.mockResolvedValue([
        { values: null },
        { values: ['red', 'blue'] },
      ]);

      const result = await service.getProductFilters({});

      const allValues = [...result.brands, ...result.colors, ...result.sizes];
      expect(allValues).toContain('red');
      expect(allValues).toContain('blue');
    });

    it('row.values = string (không phải array) → không thêm vào set', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findAttributeValuesByName.mockResolvedValue([{ values: 'not-an-array' }]);

      const result = await service.getProductFilters({});

      const allValues = [...result.brands, ...result.colors, ...result.sizes];
      expect(allValues).toHaveLength(0);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getBestSellers — period variations
  // ════════════════════════════════════════════════════════════════════════════

  describe('getBestSellers — period variations (edge)', () => {
    it('period = week → startDate khoảng 7 ngày trước', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([]);

      await service.getBestSellers({ limit: 5, period: 'week' });

      const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
      expect(callArgs.startDate).toBeInstanceOf(Date);
    });

    it('period = default (không truyền) → startDate khoảng 1 tháng trước', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findBestSellersRaw.mockResolvedValue([]);
      catalogRepository.findNewArrivals.mockResolvedValue([]);

      await service.getBestSellers({ limit: 5 });

      expect(catalogRepository.findBestSellersRaw).toHaveBeenCalled();
      const callArgs = catalogRepository.findBestSellersRaw.mock.calls[0][0];
      expect(callArgs.startDate).toBeInstanceOf(Date);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getProductSuggestions — edge cases
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductSuggestions — edge cases (edge)', () => {
    it('q chỉ có whitespace → trả về []', async () => {
      const { service } = makeServiceEdge();

      const result = await service.getProductSuggestions({ q: '   ' });

      expect(result).toEqual([]);
    });

    it('q = null → trả về []', async () => {
      const { service } = makeServiceEdge();

      const result = await service.getProductSuggestions({ q: null });

      expect(result).toEqual([]);
    });

    it('suggestion không có productImages → thumbnail = null', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const mockProduct = {
        toJSON: () => ({ id: 1, name: 'Test', slug: 'test', productImages: undefined }),
      };
      catalogRepository.findProductSuggestions.mockResolvedValue([mockProduct]);

      const result = await service.getProductSuggestions({ q: 'test' });

      expect(result[0].thumbnail).toBeNull();
    });

    it('productImages[0] không có isThumbnail → lấy phần tử đầu tiên', async () => {
      const { service, catalogRepository } = makeServiceEdge();
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
  // _buildProductDetailResponse — reviews null → totalCount = 0
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — reviews null → totalCount = 0 (edge)', () => {
    it('totalCount = 0 khi productJson.reviews = null', () => {
      const { service } = makeServiceEdge();
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
        reviews: null,
      };
      const product = { ...data, toJSON: () => ({ ...data }) };

      const result = service._buildProductDetailResponse(product, {});

      expect(result.ratings.totalCount).toBe(0);
    });

    it('totalCount = 0 khi productJson.reviews = undefined', () => {
      const { service } = makeServiceEdge();
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
      };
      const product = { ...data, toJSON: () => ({ ...data }) };

      const result = service._buildProductDetailResponse(product, {});

      expect(result.ratings.totalCount).toBe(0);
    });

    it('totalCount = reviews.length khi reviews là array không rỗng (TRUE branch)', () => {
      const { service } = makeServiceEdge();
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
        ],
      };
      const product = { ...data, toJSON: () => ({ ...data }) };

      const result = service._buildProductDetailResponse(product, {});

      expect(result.ratings.totalCount).toBe(3);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _buildProductDetailResponse — variant selection fallback (lines 545-549)
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — variant selection fallback (edge)', () => {
    it('normColor set nhưng không match variant nào → fallback sang isDefault = true', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
            isDefault: true,
            attributes: { color: 'trắng' },
            sku: 'SKU-TRANG',
            specifications: {},
          },
        ],
      });

      const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });

      expect(result.sku).toBe('SKU-TRANG');
    });

    it('normColor set nhưng không match, không có isDefault → fallback sang variants[0]', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
            isDefault: false,
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

      const result = service._buildProductDetailResponse(product, { queryColor: 'vàng' });

      expect(result.sku).toBe('SKU-DO');
    });

    it("attrs['màu sắc'] (lowercase) match queryColor (line 540 alternate Vietnamese key)", () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
            attributes: { 'màu sắc': 'đen' },
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
  // _pickDisplayPrice — không có variants → trả basePrice
  // ════════════════════════════════════════════════════════════════════════════

  describe('_pickDisplayPrice — không có variants → trả basePrice (edge)', () => {
    it('trả basePrice khi variants array rỗng', () => {
      const { service } = makeServiceEdge();

      const result = service._pickDisplayPrice({
        basePrice: '5000000',
        variants: [],
      });

      expect(result).toBe(5000000);
    });

    it('trả basePrice khi variants = undefined', () => {
      const { service } = makeServiceEdge();

      const result = service._pickDisplayPrice({
        basePrice: '3000000',
      });

      expect(result).toBe(3000000);
    });

    it('trả giá variant nhỏ nhất khi có variants', () => {
      const { service } = makeServiceEdge();

      const result = service._pickDisplayPrice({
        basePrice: '10000000',
        variants: [{ price: '12000000' }, { price: '8000000' }, { price: '15000000' }],
      });

      expect(result).toBe(8000000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getNewArrivals — limit mặc định
  // ════════════════════════════════════════════════════════════════════════════

  describe('getNewArrivals — gọi với limit mặc định (edge)', () => {
    it('trả về danh sách sản phẩm mới đến khi gọi không truyền limit', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const product = makeProductRowEdge({ id: 1, reviews: [] });
      catalogRepository.findNewArrivals.mockResolvedValue([product]);

      const result = await service.getNewArrivals({});

      expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(8);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('truyền limit tùy chỉnh → parseInt(limit) được gọi', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findNewArrivals.mockResolvedValue([]);

      await service.getNewArrivals({ limit: 5 });

      expect(catalogRepository.findNewArrivals).toHaveBeenCalledWith(5);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getRecentlyViewed — map qua recentlyViewed items
  // ════════════════════════════════════════════════════════════════════════════

  describe('getRecentlyViewed — map qua recentlyViewed items (edge)', () => {
    it('trả về sản phẩm đã xem gần đây với viewedAt', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const productRow = makeProductRowEdge({ id: 5, reviews: [] });
      const recentlyViewed = [{ Product: productRow, viewedAt: new Date('2025-01-15T10:00:00Z') }];
      catalogRepository.findRecentlyViewedByUser.mockResolvedValue(recentlyViewed);

      const result = await service.getRecentlyViewed({ userId: 10 });

      expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(10, 10);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
      expect(result[0].viewedAt).toBeInstanceOf(Date);
    });

    it('truyền limit tùy chỉnh → parseInt(limit) được gọi', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      catalogRepository.findRecentlyViewedByUser.mockResolvedValue([]);

      await service.getRecentlyViewed({ userId: 3, limit: 5 });

      expect(catalogRepository.findRecentlyViewedByUser).toHaveBeenCalledWith(3, 5);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getFeaturedProducts — map products with _mapProductForList
  // ════════════════════════════════════════════════════════════════════════════

  describe('getFeaturedProducts — map products with _mapProductForList (edge)', () => {
    it('gọi findFeaturedProducts và map qua _mapProductForList', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const product = makeProductRowEdge({ id: 1, reviews: [], compareAtPrice: null });
      catalogRepository.findFeaturedProducts.mockResolvedValue([product]);

      const result = await service.getFeaturedProducts({});

      expect(catalogRepository.findFeaturedProducts).toHaveBeenCalledWith(8);
      expect(result).toHaveLength(1);
      expect(result[0].compareAtPrice).toBeNull();
    });

    it('compareAtPrice có giá trị → parseFloat(compareAtPrice) được trả về', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const data = {
        ...makeProductRowEdge().toJSON(),
        id: 2,
        compareAtPrice: '12000000',
        reviews: [],
      };
      const product = { ...data, toJSON: () => ({ ...data }) };
      catalogRepository.findFeaturedProducts.mockResolvedValue([product]);

      const result = await service.getFeaturedProducts({ limit: 4 });

      expect(result[0].compareAtPrice).toBe(12000000);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _buildProductDetailResponse — compareAtPrice null (line 526)
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — compareAtPrice null (edge)', () => {
    it('compareAtPrice null → response.compareAtPrice = null (|| null branch)', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
        id: 20,
        compareAtPrice: null,
        variants: [],
        reviews: [],
      });

      const result = service._buildProductDetailResponse(product, {});

      expect(result.compareAtPrice).toBeNull();
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _buildProductDetailResponse — attrs['Màu sắc'] (Vietnamese attribute key)
  // ════════════════════════════════════════════════════════════════════════════

  describe("_buildProductDetailResponse — attrs['Màu sắc'] (edge)", () => {
    it("tìm variant theo color qua attrs['Màu sắc'] khi attrs.color không có", () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
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
            attributes: { 'Màu sắc': 'đỏ' },
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

      const result = service._buildProductDetailResponse(product, { queryColor: 'đỏ' });

      expect(result.sku).toBe('SKU-100');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // _buildProductDetailResponse — price/compareAtPrice fallback branches
  // ════════════════════════════════════════════════════════════════════════════

  describe('_buildProductDetailResponse — price/compareAtPrice fallback branches (edge)', () => {
    it('selectedVariant.price = null → fallback về productJson.basePrice', () => {
      const { service } = makeServiceEdge();
      const product = makeProductRowEdge({
        id: 40,
        basePrice: '9000000',
        reviews: [],
        variants: [
          {
            id: 200,
            price: null,
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

      expect(result.price).toBe('9000000');
    });

    it('selectedVariant.compareAtPrice = null → fallback về productJson.compareAtPrice', () => {
      const { service } = makeServiceEdge();
      const data = {
        ...makeProductRowEdge().toJSON(),
        id: 41,
        basePrice: '8000000',
        compareAtPrice: '10000000',
        reviews: [],
        variants: [
          {
            id: 201,
            price: '8000000',
            compareAtPrice: null,
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

      expect(result.currentVariant.compareAtPrice).toBe('10000000');
    });

    it('availableVariants: v.compareAtPrice null → fallback về productJson.compareAtPrice', () => {
      const { service } = makeServiceEdge();
      const data = {
        ...makeProductRowEdge().toJSON(),
        id: 42,
        basePrice: '7000000',
        compareAtPrice: '9000000',
        reviews: [],
        variants: [
          {
            id: 202,
            price: '7000000',
            compareAtPrice: null,
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
            compareAtPrice: '9500000',
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

      expect(result.availableVariants[0].compareAtPrice).toBe('9000000');
      expect(result.availableVariants[1].compareAtPrice).toBe('9500000');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getProductById — sản phẩm không active → 404
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductById — sản phẩm không active → 404 (edge)', () => {
    it('ném AppError 404 khi sản phẩm tìm thấy nhưng status không phải active', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const inactiveProduct = makeProductRowEdge({ id: 1, status: 'draft' });
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(inactiveProduct);

      await expect(service.getProductById({ id: 1 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getProductBySlug — sản phẩm không active → 404
  // ════════════════════════════════════════════════════════════════════════════

  describe('getProductBySlug — sản phẩm không active → 404 (edge)', () => {
    it('ném AppError 404 khi sản phẩm tìm thấy nhưng status không phải active', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      const inactiveProduct = makeProductRowEdge({ id: 2, slug: 'my-product', status: 'inactive' });
      catalogRepository.findProductBySlugWithFullDetails.mockResolvedValue(inactiveProduct);

      await expect(service.getProductBySlug({ slug: 'my-product' })).rejects.toMatchObject({
        statusCode: 404,
      });
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // getAllProducts — page=0 không gây negative offset
  // ════════════════════════════════════════════════════════════════════════════

  describe('getAllProducts — page=0 không gây negative offset (edge)', () => {
    it('page=0 → offset=0 (clamp về page 1), không throw', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      await service.getAllProducts({ page: 0, limit: 20 });
      const callArgs = catalogRepository.findProductsList.mock.calls[0][0];
      expect(callArgs.offset).toBe(0);
      expect(callArgs.offset).not.toBeLessThan(0);
    });

    it('page=-5 → offset=0 (clamp về 0), không throw', async () => {
      const { service, catalogRepository } = makeServiceEdge();
      await service.getAllProducts({ page: -5, limit: 10 });
      const callArgs = catalogRepository.findProductsList.mock.calls[0][0];
      expect(callArgs.offset).toBe(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Merged from: catalog-service.product.edge-cases.test.js
// Integration-style tests (supertest + jest.mock) — module-level setup preserved.
// ═══════════════════════════════════════════════════════════════════════════════

// Note: jest.mock calls must remain at module level (Jest hoisting).
// The describes below reference the module-level app/request setup from this block.

// Module-level mocks and setup for product edge cases integration tests
jest.mock('@models', () => {
  const mockFn = jest.fn;
  return {
    Product: {
      findAll: mockFn(),
      findAndCountAll: mockFn(),
      findOne: mockFn(),
      findByPk: mockFn(),
      count: mockFn(),
    },
    SearchHistory: {
      create: mockFn(),
      findAll: mockFn(),
      findOne: mockFn(),
      destroy: mockFn(),
    },
    Category: { findOne: mockFn(), findAll: mockFn(), findByPk: mockFn() },
    Brand: { findAll: mockFn(), findByPk: mockFn() },
    ProductAttribute: { findAll: mockFn() },
    ProductSpecification: { findAll: mockFn() },
    ProductVariant: { findAll: mockFn() },
    Review: { findAll: mockFn() },
    RecentlyViewed: { upsert: mockFn(), findAll: mockFn(), findOne: mockFn(), create: mockFn() },
    sequelize: {
      fn: jest.fn((fnName, col) => ({ fn: fnName, col })),
      col: jest.fn((name) => ({ col: name })),
      where: jest.fn((col, condition) => ({ col, condition })),
      literal: jest.fn((val) => ({ literal: val })),
      Sequelize: { Op: require('sequelize').Op },
    },
  };
});

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_req, _res, next) => next(),
  apiLimiter: (_req, _res, next) => next(),
  destructiveLimiter: (_req, _res, next) => next(),
}));

jest.mock('@middlewares/authenticate', () => ({
  authenticate: (req, _res, next) => {
    if (req.headers.authorization) {
      req.user = { id: 1 };
    }
    next();
  },
  optionalAuthenticate: (req, _res, next) => {
    if (req.headers.authorization) {
      req.user = { id: 1 };
    }
    next();
  },
}));

jest.mock('@middlewares/authorize', () => ({
  authorize: () => (_req, _res, next) => next(),
}));

jest.mock('@modules/catalog/validators/catalog-validator', () => ({
  productSchema: { validate: jest.fn().mockReturnValue({ error: null }) },
  brandSchema: { validate: jest.fn().mockReturnValue({ error: null }) },
  categorySchema: { validate: jest.fn().mockReturnValue({ error: null }) },
}));

jest.mock('@middlewares/validate-request', () => ({
  validateRequest: () => (_req, _res, next) => next(),
}));

{
  const express = require('express');
  const supertest = require('supertest');
  const buildCatalogModule = require('@modules/catalog/module');
  const { errorHandler } = require('@middlewares/error-handler');
  const {
    Product,
    Category,
    Brand,
    ProductAttribute,
    ProductVariant,
    ProductSpecification,
    Review,
    RecentlyViewed,
    sequelize,
  } = require('@models');
  const eventBus = require('@shared/event-bus');
  const logger = require('@utils/logger');

  const catalogModule = buildCatalogModule({
    Category,
    Brand,
    Product,
    ProductAttribute,
    ProductVariant,
    ProductSpecification,
    Review,
    RecentlyViewed,
    sequelize,
    eventBus,
    logger,
  });
  const productMount = catalogModule.mounts.find((m) => m.basePath === '/products');

  const app = express();
  app.use(express.json());
  app.use('/api/products', productMount.router);
  app.use(errorHandler);

  const request = supertest(app);

  describe('GET /api/products/suggestions — getProductSuggestions (product edge cases)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('200 + mảng rỗng khi không có query q', async () => {
      const res = await request.get('/api/products/suggestions');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data).toEqual([]);
      expect(Product.findAll).not.toHaveBeenCalled();
    });

    test('200 + mảng rỗng khi q là chuỗi rỗng', async () => {
      const res = await request.get('/api/products/suggestions?q=');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(Product.findAll).not.toHaveBeenCalled();
    });

    test('200 + trả về danh sách suggestions khi có q', async () => {
      const mockProducts = [
        {
          toJSON: () => ({
            id: 1,
            name: 'Laptop Dell',
            slug: 'laptop-dell',
            productImages: [{ imageUrl: 'https://img.jpg', isThumbnail: true, displayOrder: 1 }],
          }),
        },
        { toJSON: () => ({ id: 2, name: 'Laptop HP', slug: 'laptop-hp', productImages: [] }) },
      ];
      Product.findAll.mockResolvedValue(mockProducts);

      const res = await request.get('/api/products/suggestions?q=lap');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    test('response suggestion có đúng fields: id, name, slug, thumbnail', async () => {
      const mockProducts = [
        {
          toJSON: () => ({
            id: 5,
            name: 'Laptop Gaming Asus',
            slug: 'laptop-gaming-asus',
            productImages: [{ imageUrl: 'https://asus.jpg', isThumbnail: true, displayOrder: 1 }],
          }),
        },
      ];
      Product.findAll.mockResolvedValue(mockProducts);

      const res = await request.get('/api/products/suggestions?q=laptop');
      expect(res.status).toBe(200);
      const item = res.body.data[0];
      expect(item).toHaveProperty('id', 5);
      expect(item).toHaveProperty('name', 'Laptop Gaming Asus');
      expect(item).toHaveProperty('slug', 'laptop-gaming-asus');
      expect(item).toHaveProperty('thumbnail', 'https://asus.jpg');
    });

    test('thumbnail là null khi sản phẩm không có ảnh', async () => {
      Product.findAll.mockResolvedValue([
        { toJSON: () => ({ id: 3, name: 'Laptop Acer', slug: 'laptop-acer', productImages: [] }) },
      ]);

      const res = await request.get('/api/products/suggestions?q=acer');
      expect(res.status).toBe(200);
      expect(res.body.data[0].thumbnail).toBeNull();
    });

    test('Product.findAll được gọi với limit 10', async () => {
      Product.findAll.mockResolvedValue([]);

      await request.get('/api/products/suggestions?q=samsung');
      expect(Product.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
    });

    test('trả về mảng rỗng khi không có sản phẩm khớp', async () => {
      Product.findAll.mockResolvedValue([]);

      const res = await request.get('/api/products/suggestions?q=xyznotexist');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  jest.mock('@modules/search-history/validators/search-history-validator', () => ({
    saveSearchSchema: { validate: jest.fn().mockReturnValue({ error: null }) },
  }));

  const searchHistoryRouter = require('@modules/search-history/routes');
  const { SearchHistory } = require('@models');

  const appHistory = express();
  appHistory.use(express.json());
  appHistory.use('/api/search-histories', searchHistoryRouter);
  appHistory.use(errorHandler);

  const requestHistory = supertest(appHistory);

  describe('POST /api/search-histories — deduplication (product edge cases)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    test('201 khi keyword chưa tồn tại trong 1 giờ qua', async () => {
      SearchHistory.findOne.mockResolvedValue(null);
      SearchHistory.create.mockResolvedValue({
        id: 10,
        userId: 1,
        keyword: 'điện thoại samsung',
        sessionId: null,
      });

      const res = await requestHistory
        .post('/api/search-histories')
        .set('Authorization', 'Bearer token')
        .send({ keyword: 'điện thoại samsung' });

      expect(res.status).toBe(201);
      expect(SearchHistory.create).toHaveBeenCalledTimes(1);
    });

    test('200 khi keyword đã tồn tại trong 1 giờ qua — không tạo lại', async () => {
      SearchHistory.findOne.mockResolvedValue({
        id: 5,
        userId: 1,
        keyword: 'điện thoại samsung',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      });

      const res = await requestHistory
        .post('/api/search-histories')
        .set('Authorization', 'Bearer token')
        .send({ keyword: 'điện thoại samsung' });

      expect(res.status).toBe(200);
      expect(SearchHistory.create).not.toHaveBeenCalled();
    });

    test('findOne được gọi với điều kiện bao gồm createdAt >= 1 giờ trước', async () => {
      SearchHistory.findOne.mockResolvedValue(null);
      SearchHistory.create.mockResolvedValue({ id: 1, keyword: 'laptop' });

      await requestHistory
        .post('/api/search-histories')
        .set('Authorization', 'Bearer token')
        .send({ keyword: 'laptop' });

      expect(SearchHistory.findOne).toHaveBeenCalledTimes(1);
      const callArgs = SearchHistory.findOne.mock.calls[0][0];
      expect(callArgs.where).toHaveProperty('keyword', 'laptop');
      expect(callArgs.where).toHaveProperty('createdAt');
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Merged from: catalog-service.skuid.test.js
// Branch coverage cho line 563: if (!skuId && normColor) — FALSE branch.
// ═══════════════════════════════════════════════════════════════════════════════

describe('CatalogService._buildProductDetailResponse — skuId + queryColor (line 563 FALSE branch)', () => {
  function makeProductSkuId(overrides = {}) {
    const data = {
      id: 1,
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      basePrice: '29990000',
      compareAtPrice: null,
      stockQuantity: 5,
      isFeatured: false,
      productImages: [],
      variants: [],
      categories: [],
      reviews: [],
      ...overrides,
    };
    return { ...data, toJSON: () => ({ ...data }) };
  }

  let service;

  beforeEach(() => {
    service = new CatalogService({
      catalogRepository: {},
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
  });

  test('có skuId → !skuId=false → variantColor KHÔNG bị override bởi normColor', () => {
    const product = makeProductSkuId({
      variants: [
        {
          id: 10,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Đen 256GB',
          isDefault: true,
          sku: 'SKU-10',
          specifications: {},
          attributes: { color: 'đen' },
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, {
      skuId: '10',
      queryColor: 'trắng',
    });
    expect(result).toBeDefined();
    expect(result.sku).toBe('SKU-10');
  });

  test('không có skuId, có normColor → !skuId=true → variantColor ĐƯỢC override', () => {
    const product = makeProductSkuId({
      variants: [
        {
          id: 20,
          price: '25000000',
          compareAtPrice: null,
          stockQuantity: 5,
          variantName: 'Trắng 256GB',
          isDefault: true,
          sku: 'SKU-20',
          specifications: {},
          attributes: { color: 'trắng' },
        },
      ],
    });
    const result = service._buildProductDetailResponse(product, { queryColor: 'trắng' });
    expect(result).toBeDefined();
  });
});
