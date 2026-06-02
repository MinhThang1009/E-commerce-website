// Catalog service — branch coverage cho:
// Line 1363: createProduct — createdVariants[i]?.id falsy khi variant có images
// Line 1483: updateProduct — createdVariants[i]?.id falsy khi variant có images

const CatalogService = require('./catalog-service');

describe('CatalogService — variant images branch coverage', () => {
  let catalogRepository;
  let service;

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
      findProductByName: jest.fn().mockResolvedValue(null),
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
      createProduct: jest.fn().mockResolvedValue({ id: 1 }),
      saveProduct: jest.fn(async (p) => p),
      deleteProduct: jest.fn().mockResolvedValue(),
      findCategoriesByIds: jest.fn(),
      setProductCategories: jest.fn().mockResolvedValue(),
      createProductSpecifications: jest.fn().mockResolvedValue(),
      clearProductSpecifications: jest.fn().mockResolvedValue(),
      clearProductAttributes: jest.fn().mockResolvedValue(),
      createProductAttributes: jest.fn().mockResolvedValue(),
      clearProductVariants: jest.fn().mockResolvedValue(),
      createProductVariants: jest.fn(),
      clearProductImages: jest.fn().mockResolvedValue(),
      createProductImages: jest.fn().mockResolvedValue(),
      runInTransaction: jest.fn(async (work) => work({})),
    };
    service = new CatalogService({
      catalogRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
    });
  });

  // ── Line 1363: createProduct — createdVariants[i] undefined (id falsy) ──

  describe('createProduct — variant có images nhưng createdVariants[i] không có id', () => {
    test('bỏ qua tạo ảnh variant khi createdVariants trả về phần tử không có id', async () => {
      catalogRepository.createProductVariants.mockResolvedValue([{ id: 10 }, undefined]);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue({ id: 1 });

      await service.createProduct({
        payload: {
          name: 'P',
          price: 0,
          variants: [
            { name: 'V1', price: 90, attributes: {}, images: ['v1.jpg'] },
            { name: 'V2', price: 100, attributes: {}, images: ['v2.jpg'] },
          ],
        },
      });

      expect(catalogRepository.createProductImages).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ variantId: 10, imageUrl: 'v1.jpg' })]),
        expect.any(Object),
      );
      const imageRows = catalogRepository.createProductImages.mock.calls[0][0];
      const hasV2 = imageRows.some((r) => r.imageUrl === 'v2.jpg');
      expect(hasV2).toBe(false);
    });
  });

  // ── Line 1483: updateProduct — createdVariants[i] undefined (id falsy) ──

  describe('updateProduct — variant có images nhưng createdVariants[i] không có id', () => {
    test('bỏ qua tạo ảnh variant khi createdVariants trả về phần tử không có id', async () => {
      const product = { id: 1, slug: 'p', save: jest.fn() };
      catalogRepository.findProductByPk.mockResolvedValue(product);
      catalogRepository.findProductByIdWithFullDetails.mockResolvedValue(product);
      catalogRepository.createProductVariants.mockResolvedValue([undefined, { id: 20 }]);

      await service.updateProduct({
        id: 1,
        patch: {
          variants: [
            { name: 'V1', price: 90, attributes: {}, images: ['v1.jpg'] },
            { name: 'V2', price: 100, attributes: {}, images: ['v2.jpg'] },
          ],
        },
      });

      expect(catalogRepository.createProductImages).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ variantId: 20, imageUrl: 'v2.jpg' })]),
        expect.any(Object),
      );
      const imageRows = catalogRepository.createProductImages.mock.calls[0][0];
      const hasV1 = imageRows.some((r) => r.imageUrl === 'v1.jpg');
      expect(hasV1).toBe(false);
    });
  });
});
