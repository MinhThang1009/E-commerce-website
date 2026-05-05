// Phase 42.9 — Unit tests cho CatalogService Sprint 6a (Category+Brand+Collection).
const CatalogService = require('../modules/catalog/services/catalogService');

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
    };
    cacheStore = {
      get: jest.fn().mockResolvedValue(null),
      setEx: jest.fn().mockResolvedValue(),
      del: jest.fn().mockResolvedValue(),
      delPattern: jest.fn().mockResolvedValue(),
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
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('có sản phẩm') });
    });

    test('deleteCategory không có sản phẩm → xóa thành công', async () => {
      catalogRepository.findCategoryById.mockResolvedValue({ id: 1 });
      catalogRepository.countProductsByCategoryId.mockResolvedValue(0);
      const result = await service.deleteCategory({ id: 1 });
      expect(result.message).toMatch(/Xóa danh mục thành công/);
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
});
