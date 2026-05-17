// Tests bổ sung cho CatalogController — nhắm vào error paths chưa được cover.
// Tất cả handler có catch(err) → next(err) nhưng chưa có test cho error case.

const CatalogController = require('./catalogController');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  return {
    _status: null,
    _body: null,
    _headers: {},
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
    setHeader(key, value) { this._headers[key] = value; return this; },
  };
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: undefined,
    url: '/products',
    ...overrides,
  };
}

let catalogService;
let controller;

beforeEach(() => {
  catalogService = {
    getAllCategories: jest.fn(),
    getCategoryTree: jest.fn(),
    getCategoryById: jest.fn(),
    getCategoryBySlug: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    getProductsByCategory: jest.fn(),
    getFeaturedCategories: jest.fn(),
    getAllBrands: jest.fn(),
    getBrandBySlug: jest.fn(),
    createBrand: jest.fn(),
    updateBrand: jest.fn(),
    deleteBrand: jest.fn(),
    getProductsByBrand: jest.fn(),
    getAllCollections: jest.fn(),
    getCollectionBySlug: jest.fn(),
    createCollection: jest.fn(),
    updateCollection: jest.fn(),
    deleteCollection: jest.fn(),
    getProductsByCollection: jest.fn(),
    getAllProducts: jest.fn(),
    getProductById: jest.fn(),
    getProductBySlug: jest.fn(),
    getRecentlyViewed: jest.fn(),
    getFeaturedProducts: jest.fn(),
    getRelatedProducts: jest.fn(),
    searchProducts: jest.fn(),
    getProductSuggestions: jest.fn(),
    getNewArrivals: jest.fn(),
    getBestSellers: jest.fn(),
    getDeals: jest.fn(),
    getProductVariants: jest.fn(),
    getProductReviewsSummary: jest.fn(),
    getProductFilters: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    deleteProduct: jest.fn(),
  };
  controller = new CatalogController({ catalogService });
});

// ─── Category — error paths ───────────────────────────────────────────────────

describe('CatalogController error paths — Category', () => {
  it('getCategoryBySlug gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('slug error');
    catalogService.getCategoryBySlug.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getCategoryBySlug(makeReq({ params: { slug: 'bad' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('updateCategory gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('update fail');
    catalogService.updateCategory.mockRejectedValue(err);
    const next = jest.fn();

    await controller.updateCategory(makeReq({ params: { id: '1' }, body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('deleteCategory gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('delete fail');
    catalogService.deleteCategory.mockRejectedValue(err);
    const next = jest.fn();

    await controller.deleteCategory(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductsByCategory gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('category products fail');
    catalogService.getProductsByCategory.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductsByCategory(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getFeaturedCategories gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('featured fail');
    catalogService.getFeaturedCategories.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getFeaturedCategories(makeReq(), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── Brand — error paths ──────────────────────────────────────────────────────

describe('CatalogController error paths — Brand', () => {
  it('getBrandBySlug gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('brand slug error');
    catalogService.getBrandBySlug.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getBrandBySlug(makeReq({ params: { slug: 'bad' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('createBrand gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('create brand fail');
    catalogService.createBrand.mockRejectedValue(err);
    const next = jest.fn();

    await controller.createBrand(makeReq({ body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('updateBrand gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('update brand fail');
    catalogService.updateBrand.mockRejectedValue(err);
    const next = jest.fn();

    await controller.updateBrand(makeReq({ params: { id: '1' }, body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('deleteBrand gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('delete brand fail');
    catalogService.deleteBrand.mockRejectedValue(err);
    const next = jest.fn();

    await controller.deleteBrand(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductsByBrand gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('brand products fail');
    catalogService.getProductsByBrand.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductsByBrand(makeReq({ params: { slug: 'apple' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── Collection — error paths ─────────────────────────────────────────────────

describe('CatalogController error paths — Collection', () => {
  it('getCollectionBySlug gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('collection slug error');
    catalogService.getCollectionBySlug.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getCollectionBySlug(makeReq({ params: { slug: 'bad' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('createCollection gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('create collection fail');
    catalogService.createCollection.mockRejectedValue(err);
    const next = jest.fn();

    await controller.createCollection(makeReq({ body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('updateCollection gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('update collection fail');
    catalogService.updateCollection.mockRejectedValue(err);
    const next = jest.fn();

    await controller.updateCollection(makeReq({ params: { id: '1' }, body: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('deleteCollection gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('delete collection fail');
    catalogService.deleteCollection.mockRejectedValue(err);
    const next = jest.fn();

    await controller.deleteCollection(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductsByCollection gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('collection products fail');
    catalogService.getProductsByCollection.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductsByCollection(makeReq({ params: { slug: 'flash-sale' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── Product — error paths ────────────────────────────────────────────────────

describe('CatalogController error paths — Product', () => {
  it('getProductBySlug gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('slug not found');
    catalogService.getProductBySlug.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductBySlug(makeReq({ params: { slug: 'missing' }, query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getRecentlyViewed gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('recently viewed fail');
    catalogService.getRecentlyViewed.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getRecentlyViewed(makeReq({ user: { id: 1 }, query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getFeaturedProducts gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('featured products fail');
    catalogService.getFeaturedProducts.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getFeaturedProducts(makeReq({ query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getRelatedProducts gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('related fail');
    catalogService.getRelatedProducts.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getRelatedProducts(makeReq({ params: { id: '1' }, query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductSuggestions gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('suggestions fail');
    catalogService.getProductSuggestions.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductSuggestions(makeReq({ query: { q: 'iph' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getNewArrivals gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('new arrivals fail');
    catalogService.getNewArrivals.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getNewArrivals(makeReq({ query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getBestSellers gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('best sellers fail');
    catalogService.getBestSellers.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getBestSellers(makeReq({ query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getDeals gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('deals fail');
    catalogService.getDeals.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getDeals(makeReq({ query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductVariants gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('variants fail');
    catalogService.getProductVariants.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductVariants(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductReviewsSummary gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('reviews summary fail');
    catalogService.getProductReviewsSummary.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductReviewsSummary(makeReq({ params: { id: '1' } }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });

  it('getProductFilters gọi next(err) khi service ném lỗi', async () => {
    const err = new Error('filters fail');
    catalogService.getProductFilters.mockRejectedValue(err);
    const next = jest.fn();

    await controller.getProductFilters(makeReq({ query: {} }), makeRes(), next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
