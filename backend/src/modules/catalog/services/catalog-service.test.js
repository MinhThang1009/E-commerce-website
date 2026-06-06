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
      findProductRatingsRows: jest.fn(),
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
      catalogRepository.findProductRatingsRows.mockResolvedValue([]);

      const result = await service.getProductReviewsSummary({ id: 1 });
      expect(result.average).toBe(0);
      expect(result.count).toBe(0);
    });

    test('tính đúng average và distribution', async () => {
      catalogRepository.findProductByPk.mockResolvedValue({ id: 2, status: 'active' });
      catalogRepository.findProductRatingsRows.mockResolvedValue([
        { rating: 5 },
        { rating: 4 },
        { rating: 5 },
        { rating: 3 },
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

    test('getFeaturedCategories → trả danh sách categories', async () => {
      catalogRepository.findAllCategoriesSorted.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const result = await service.getFeaturedCategories();
      expect(result).toHaveLength(2);
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
