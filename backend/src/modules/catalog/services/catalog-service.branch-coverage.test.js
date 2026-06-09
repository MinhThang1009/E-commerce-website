jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('@middlewares/rate-limiter', () => ({
  chatbotLimiter: (_r, _s, n) => n(),
  apiLimiter: (_r, _s, n) => n(),
  authLimiter: (_r, _s, n) => n(),
  otpLimiter: (_r, _s, n) => n(),
}));
const logger = require('@utils/logger');
const CatalogService = require('./catalog-service');

function makeCatalogRepo(overrides = {}) {
  return {
    findAllCategoriesSorted: jest.fn(),
    getCategoryProductCounts: jest.fn().mockResolvedValue({}),
    findCategoryById: jest.fn(),
    findCategoryBySlug: jest.fn(),
    createCategory: jest.fn(),
    saveCategory: jest.fn(),
    deleteCategory: jest.fn(),
    countProductsByCategoryId: jest.fn(),
    findProductsByCategoryId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
    findAllBrands: jest.fn().mockResolvedValue([]),
    findBrandIdsByCategoryId: jest.fn().mockResolvedValue([]),
    findBrandById: jest.fn(),
    findBrandBySlug: jest.fn(),
    createBrand: jest.fn(),
    saveBrand: jest.fn(),
    deleteBrand: jest.fn(),
    countProductsByBrandId: jest.fn(),
    findProductsByBrandId: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
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
    findProductRatingsSummary: jest
      .fn()
      .mockResolvedValue({ average: 0, count: 0, distribution: {} }),
    getProductPriceRange: jest.fn(),
    findAttributeValuesByName: jest.fn().mockResolvedValue([]),
    findOtherAttributes: jest.fn().mockResolvedValue([]),
    findRecentlyViewedByUser: jest.fn(),
    upsertRecentlyViewed: jest.fn().mockResolvedValue(),
    pruneRecentlyViewed: jest.fn().mockResolvedValue(),
    findCategoryByIdOrSlug: jest.fn(),
    countProductsByBrand: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('CatalogService — branch coverage (product)', () => {
  let svc, repo;
  beforeEach(() => {
    repo = makeCatalogRepo();
    svc = new CatalogService({ catalogRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  test('getProductBySlug: variant without variantName/displayName → fullName = mainName', async () => {
    const data = {
      id: 1,
      name: 'iPhone 15 Pro',
      slug: 'iphone-15-pro',
      status: 'active',
      basePrice: '29990000',
      compareAtPrice: '33000000',
      stockQuantity: 5,
      productImages: [
        { id: 1, imageUrl: 'a.jpg', isThumbnail: true, variantId: null, color: null },
      ],
      variants: [
        {
          id: 10,
          isDefault: true,
          price: 100,
          compareAtPrice: null,
          stockQuantity: 5,
          sku: 'S1',
          variantName: null,
          displayName: null,
          attributes: {},
        },
      ],
      categories: [],
      reviews: [],
      model: null,
    };
    const product = { ...data, toJSON: () => ({ ...data }) };
    repo.findProductBySlugWithFullDetails.mockResolvedValue(product);
    const result = await svc.getProductBySlug({ slug: 'iphone-15-pro' });
    expect(result.payload.data.name).toBe('iPhone 15 Pro');
    expect(result.payload.data.currentVariant.name).toBe('');
  });

  test('getFeaturedProducts: NaN limit → fallback 8', async () => {
    repo.findFeaturedProducts.mockResolvedValue([]);
    await svc.getFeaturedProducts({ limit: 'abc' });
    expect(repo.findFeaturedProducts).toHaveBeenCalledWith(8);
  });

  test('getRelatedProducts: NaN id → throw 404', async () => {
    await expect(svc.getRelatedProducts({ id: 'abc' })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getRelatedProducts: NaN limit → fallback 4', async () => {
    repo.findProductByPk.mockResolvedValue({ id: 1, status: 'active', categoryId: 5 });
    repo.findRelatedProducts.mockResolvedValue([]);
    repo.findRelatedProductsFallback.mockResolvedValue([]);
    await svc.getRelatedProducts({ id: '1', limit: 'abc' });
    expect(repo.findRelatedProducts).toHaveBeenCalledWith(1, 4, 5);
  });

  test('searchProducts: NaN limit/page → fallback 10/1', async () => {
    repo.searchProducts.mockResolvedValue({ count: 0, rows: [] });
    await svc.searchProducts({ q: 'test', page: 'x', limit: 'y' });
    expect(repo.searchProducts).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 0 }),
    );
  });

  test('getNewArrivals: NaN limit → fallback 8', async () => {
    repo.findNewArrivals.mockResolvedValue([]);
    await svc.getNewArrivals({ limit: 'abc' });
    expect(repo.findNewArrivals).toHaveBeenCalledWith(8);
  });

  test('getBestSellers: NaN limit → fallback 10', async () => {
    repo.findBestSellersRaw.mockResolvedValue([]);
    repo.findNewArrivals.mockResolvedValue([]);
    await svc.getBestSellers({ limit: 'abc' });
    expect(repo.findBestSellersRaw).toHaveBeenCalledWith(expect.objectContaining({ limit: 10 }));
  });

  test('getProductVariants: NaN id → throw 404', async () => {
    await expect(svc.getProductVariants({ id: 'abc' })).rejects.toMatchObject({ statusCode: 404 });
  });

  test('getProductReviewsSummary: NaN id → throw 404', async () => {
    await expect(svc.getProductReviewsSummary({ id: 'abc' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test('getRecentlyViewed: NaN limit → fallback 10', async () => {
    repo.findRecentlyViewedByUser.mockResolvedValue([]);
    await svc.getRecentlyViewed({ userId: 1, limit: 'abc' });
    expect(repo.findRecentlyViewedByUser).toHaveBeenCalledWith(1, 10);
  });
});

describe('CatalogService — branch coverage (brand)', () => {
  let svc, repo;
  beforeEach(() => {
    repo = makeCatalogRepo();
    svc = new CatalogService({ catalogRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  test('getAllBrands: no args → default empty obj', async () => {
    await svc.getAllBrands();
    expect(repo.findAllBrands).toHaveBeenCalledWith({ filter: { hasProducts: true } });
  });

  test('getProductsByBrand: NaN limit → fallback 10', async () => {
    repo.findBrandBySlug.mockResolvedValue({ id: 1 });
    await svc.getProductsByBrand({ slug: 'apple', limit: 'abc', page: 'x' });
    expect(repo.findProductsByBrandId).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ limit: 10 }),
    );
  });
});

describe('CatalogService — branch coverage (category)', () => {
  let svc, repo;
  beforeEach(() => {
    repo = makeCatalogRepo();
    svc = new CatalogService({ catalogRepository: repo, eventBus: { publish: jest.fn() }, logger });
  });

  test('getProductsByCategory: NaN limit → fallback 10', async () => {
    repo.findCategoryById.mockResolvedValue({ id: 5 });
    await svc.getProductsByCategory({ id: 5, limit: 'abc', page: 'x' });
    expect(repo.findProductsByCategoryId).toHaveBeenCalledWith(
      5,
      expect.objectContaining({ limit: 10 }),
    );
  });

  test('updateCategory: parentId === id → throw', async () => {
    repo.findCategoryById.mockResolvedValue({ id: 5, save: jest.fn() });
    await expect(svc.updateCategory({ id: 5, patch: { parentId: 5 } })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
