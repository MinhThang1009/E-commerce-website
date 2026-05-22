// Unit tests cho CatalogController.
// Chiến lược: mock catalogService hoàn toàn, kiểm tra response shape + status code + header
// từ controller — không test service logic (đã có catalogService.test.js).

const CatalogController = require('./catalog-controller');

// ---------- Helper tạo req/res/next giả ----------

function makeRes() {
  const res = {
    _status: null,
    _body: null,
    _headers: {},
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
    setHeader(key, value) {
      this._headers[key] = value;
      return this;
    },
  };
  return res;
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

// ---------- Setup ----------

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

// ============================================================
// Category
// ============================================================

describe('CatalogController — Category', () => {
  describe('getAllCategories', () => {
    it('trả về 200 với payload từ service', async () => {
      const servicePayload = { status: 'success', data: [{ id: 1, name: 'Điện thoại' }] };
      catalogService.getAllCategories.mockResolvedValue(servicePayload);

      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      await controller.getAllCategories(req, res, next);

      expect(res._status).toBe(200);
      expect(res._body).toEqual(servicePayload);
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      const serviceError = new Error('DB lỗi');
      catalogService.getAllCategories.mockRejectedValue(serviceError);

      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      await controller.getAllCategories(req, res, next);

      expect(next).toHaveBeenCalledWith(serviceError);
    });
  });

  describe('getCategoryTree', () => {
    it('trả về 200 với { status, data } khi thành công', async () => {
      const tree = [{ id: 1, children: [] }];
      catalogService.getCategoryTree.mockResolvedValue(tree);

      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      await controller.getCategoryTree(req, res, next);

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: tree });
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      const error = new Error('tree error');
      catalogService.getCategoryTree.mockRejectedValue(error);

      await controller.getCategoryTree(
        makeReq(),
        makeRes(),
        jest.fn().mockImplementation((err) => {
          expect(err).toBe(error);
        }),
      );
    });
  });

  describe('getCategoryById', () => {
    it('truyền req.params.id vào service và trả 200', async () => {
      const categoryData = { id: '42', name: 'Laptop' };
      catalogService.getCategoryById.mockResolvedValue(categoryData);

      const req = makeReq({ params: { id: '42' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.getCategoryById(req, res, next);

      expect(catalogService.getCategoryById).toHaveBeenCalledWith({ id: '42' });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: categoryData });
    });

    it('gọi next(err) khi service ném lỗi 404', async () => {
      const notFound = Object.assign(new Error('Không tìm thấy'), { statusCode: 404 });
      catalogService.getCategoryById.mockRejectedValue(notFound);

      const next = jest.fn();
      await controller.getCategoryById(makeReq({ params: { id: '99' } }), makeRes(), next);

      expect(next).toHaveBeenCalledWith(notFound);
    });
  });

  describe('getCategoryBySlug', () => {
    it('truyền req.params.slug và trả 200', async () => {
      const data = { id: 3, slug: 'dien-thoai' };
      catalogService.getCategoryBySlug.mockResolvedValue(data);

      const req = makeReq({ params: { slug: 'dien-thoai' } });
      const res = makeRes();

      await controller.getCategoryBySlug(req, res, jest.fn());

      expect(catalogService.getCategoryBySlug).toHaveBeenCalledWith({ slug: 'dien-thoai' });
      expect(res._body).toEqual({ status: 'success', data });
    });
  });

  describe('createCategory', () => {
    it('trả về 201 với data khi tạo thành công', async () => {
      const newCategory = { id: 10, name: 'Máy tính bảng' };
      catalogService.createCategory.mockResolvedValue(newCategory);

      const req = makeReq({ body: { name: 'Máy tính bảng', description: 'Tablet' } });
      const res = makeRes();
      const next = jest.fn();

      await controller.createCategory(req, res, next);

      expect(catalogService.createCategory).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body).toEqual({ status: 'success', data: newCategory });
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.createCategory.mockRejectedValue(new Error('trùng tên'));

      const next = jest.fn();
      await controller.createCategory(makeReq({ body: {} }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateCategory', () => {
    it('truyền id và body đúng vào service, trả 200', async () => {
      const updated = { id: '5', name: 'Phụ kiện mới' };
      catalogService.updateCategory.mockResolvedValue(updated);

      const req = makeReq({ params: { id: '5' }, body: { name: 'Phụ kiện mới' } });
      const res = makeRes();

      await controller.updateCategory(req, res, jest.fn());

      expect(catalogService.updateCategory).toHaveBeenCalledWith({
        id: '5',
        patch: { name: 'Phụ kiện mới' },
      });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: updated });
    });
  });

  describe('deleteCategory', () => {
    it('trích message từ service result và trả 200', async () => {
      catalogService.deleteCategory.mockResolvedValue({ message: 'Xóa danh mục thành công' });

      const req = makeReq({ params: { id: '3' } });
      const res = makeRes();

      await controller.deleteCategory(req, res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', message: 'Xóa danh mục thành công' });
    });
  });

  describe('getProductsByCategory', () => {
    it('merge id và query vào service call', async () => {
      const data = { rows: [], count: 0 };
      catalogService.getProductsByCategory.mockResolvedValue(data);

      const req = makeReq({ params: { id: '7' }, query: { page: '2', limit: '10' } });
      const res = makeRes();

      await controller.getProductsByCategory(req, res, jest.fn());

      expect(catalogService.getProductsByCategory).toHaveBeenCalledWith({
        id: '7',
        page: '2',
        limit: '10',
      });
      expect(res._status).toBe(200);
    });
  });

  describe('getFeaturedCategories', () => {
    it('trả về 200 với list danh mục nổi bật', async () => {
      const featuredList = [{ id: 1, featured: true }];
      catalogService.getFeaturedCategories.mockResolvedValue(featuredList);

      const res = makeRes();
      await controller.getFeaturedCategories(makeReq(), res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: featuredList });
    });
  });
});

// ============================================================
// Brand
// ============================================================

describe('CatalogController — Brand', () => {
  describe('getAllBrands', () => {
    it('truyền req.query vào service và trả 200', async () => {
      const brandList = [{ id: 1, name: 'Samsung' }];
      catalogService.getAllBrands.mockResolvedValue(brandList);

      const req = makeReq({ query: { categoryId: '3' } });
      const res = makeRes();

      await controller.getAllBrands(req, res, jest.fn());

      expect(catalogService.getAllBrands).toHaveBeenCalledWith({ categoryId: '3' });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: brandList });
    });

    it('hoạt động với query rỗng', async () => {
      catalogService.getAllBrands.mockResolvedValue([]);

      const req = makeReq({ query: {} });
      const res = makeRes();

      await controller.getAllBrands(req, res, jest.fn());

      expect(catalogService.getAllBrands).toHaveBeenCalledWith({});
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.getAllBrands.mockRejectedValue(new Error('lỗi brand'));

      const next = jest.fn();
      await controller.getAllBrands(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getBrandBySlug', () => {
    it('truyền slug và trả 200', async () => {
      const brandData = { id: 2, slug: 'samsung', name: 'Samsung' };
      catalogService.getBrandBySlug.mockResolvedValue(brandData);

      const req = makeReq({ params: { slug: 'samsung' } });
      const res = makeRes();

      await controller.getBrandBySlug(req, res, jest.fn());

      expect(catalogService.getBrandBySlug).toHaveBeenCalledWith({ slug: 'samsung' });
      expect(res._body).toEqual({ status: 'success', data: brandData });
    });
  });

  describe('createBrand', () => {
    it('trả về 201 khi tạo thành công', async () => {
      const newBrand = { id: 5, name: 'Apple' };
      catalogService.createBrand.mockResolvedValue(newBrand);

      const req = makeReq({ body: { name: 'Apple', logo: 'apple.png' } });
      const res = makeRes();

      await controller.createBrand(req, res, jest.fn());

      expect(catalogService.createBrand).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body).toEqual({ status: 'success', data: newBrand });
    });
  });

  describe('updateBrand', () => {
    it('truyền id và patch vào service, trả 200', async () => {
      const updatedBrand = { id: '2', name: 'Samsung Updated' };
      catalogService.updateBrand.mockResolvedValue(updatedBrand);

      const req = makeReq({ params: { id: '2' }, body: { name: 'Samsung Updated' } });
      const res = makeRes();

      await controller.updateBrand(req, res, jest.fn());

      expect(catalogService.updateBrand).toHaveBeenCalledWith({
        id: '2',
        patch: { name: 'Samsung Updated' },
      });
      expect(res._status).toBe(200);
    });
  });

  describe('deleteBrand', () => {
    it('trích message từ service result và trả 200', async () => {
      catalogService.deleteBrand.mockResolvedValue({ message: 'Xóa thương hiệu thành công' });

      const req = makeReq({ params: { id: '1' } });
      const res = makeRes();

      await controller.deleteBrand(req, res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body.message).toBe('Xóa thương hiệu thành công');
    });
  });

  describe('getProductsByBrand', () => {
    it('merge slug và query vào service call', async () => {
      const data = { rows: [{ id: 1 }], count: 1 };
      catalogService.getProductsByBrand.mockResolvedValue(data);

      const req = makeReq({ params: { slug: 'apple' }, query: { page: '1' } });
      const res = makeRes();

      await controller.getProductsByBrand(req, res, jest.fn());

      expect(catalogService.getProductsByBrand).toHaveBeenCalledWith({ slug: 'apple', page: '1' });
      expect(res._status).toBe(200);
    });
  });
});

// ============================================================
// Product
// ============================================================

describe('CatalogController — Product', () => {
  describe('getAllProducts', () => {
    it('trả về payload từ service', async () => {
      const productPayload = { data: [{ id: 1 }], total: 1 };
      catalogService.getAllProducts.mockResolvedValue({ payload: productPayload });

      const req = makeReq({ query: { page: '1' }, url: '/products?page=1' });
      const res = makeRes();

      await controller.getAllProducts(req, res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual(productPayload);
    });

    it('trả về payload khi service thành công', async () => {
      catalogService.getAllProducts.mockResolvedValue({ payload: { data: [] } });

      const req = makeReq({ url: '/products' });
      const res = makeRes();

      await controller.getAllProducts(req, res, jest.fn());

      expect(res._status).toBe(200);
    });

    it('truyền query vào service', async () => {
      catalogService.getAllProducts.mockResolvedValue({ payload: {} });

      const req = makeReq({
        query: { brand: 'samsung', sort: 'price' },
        url: '/products?brand=samsung',
      });
      await controller.getAllProducts(req, makeRes(), jest.fn());

      expect(catalogService.getAllProducts).toHaveBeenCalledWith({
        brand: 'samsung',
        sort: 'price',
      });
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.getAllProducts.mockRejectedValue(new Error('query fail'));

      const next = jest.fn();
      await controller.getAllProducts(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getProductById', () => {
    it('truyền id, skuId, color từ query.color, và userId khi có user', async () => {
      const productPayload = { id: '10', name: 'iPhone 15' };
      catalogService.getProductById.mockResolvedValue(productPayload);

      const req = makeReq({
        params: { id: '10' },
        query: { skuId: 'sku_1', color: 'Đen' },
        user: { id: 99 },
      });
      const res = makeRes();

      await controller.getProductById(req, res, jest.fn());

      expect(catalogService.getProductById).toHaveBeenCalledWith({
        id: '10',
        skuId: 'sku_1',
        queryColor: 'Đen',
        userId: 99,
      });
      expect(res._status).toBe(200);
    });

    it('truyền Vietnamese color key "Màu sắc" khi query.color không có', async () => {
      catalogService.getProductById.mockResolvedValue({});

      const viColorKey = 'Màu sắc';
      const req = makeReq({
        params: { id: '5' },
        query: { [viColorKey]: 'Trắng' },
        user: { id: 1 },
      });

      await controller.getProductById(req, makeRes(), jest.fn());

      expect(catalogService.getProductById).toHaveBeenCalledWith(
        expect.objectContaining({ queryColor: 'Trắng' }),
      );
    });

    it('truyền userId = undefined khi request không có user', async () => {
      catalogService.getProductById.mockResolvedValue({});

      const req = makeReq({ params: { id: '1' }, query: {}, user: undefined });

      await controller.getProductById(req, makeRes(), jest.fn());

      expect(catalogService.getProductById).toHaveBeenCalledWith(
        expect.objectContaining({ userId: undefined }),
      );
    });

    it('trả về payload từ service', async () => {
      catalogService.getProductById.mockResolvedValue({});

      const req = makeReq({ params: { id: '1' }, query: {} });
      const res = makeRes();

      await controller.getProductById(req, res, jest.fn());

      expect(res._status).toBe(200);
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.getProductById.mockRejectedValue(new Error('không tìm thấy'));

      const next = jest.fn();
      await controller.getProductById(makeReq({ params: { id: '0' } }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getProductBySlug', () => {
    it('truyền slug, skuId, color và userId vào service', async () => {
      const productData = { id: 1, slug: 'iphone-15' };
      catalogService.getProductBySlug.mockResolvedValue(productData);

      const req = makeReq({
        params: { slug: 'iphone-15' },
        query: { skuId: 'sku_2', color: 'Đỏ' },
        user: { id: 5 },
      });
      const res = makeRes();

      await controller.getProductBySlug(req, res, jest.fn());

      expect(catalogService.getProductBySlug).toHaveBeenCalledWith({
        slug: 'iphone-15',
        skuId: 'sku_2',
        queryColor: 'Đỏ',
        userId: 5,
      });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: productData });
    });
  });

  describe('getRecentlyViewed', () => {
    it('truyền user.id từ req.user', async () => {
      const recentData = [{ id: 1 }, { id: 2 }];
      catalogService.getRecentlyViewed.mockResolvedValue(recentData);

      const req = makeReq({ user: { id: 77 }, query: { limit: '5' } });
      const res = makeRes();

      await controller.getRecentlyViewed(req, res, jest.fn());

      expect(catalogService.getRecentlyViewed).toHaveBeenCalledWith({ userId: 77, limit: '5' });
      expect(res._body).toEqual({ status: 'success', data: recentData });
    });
  });

  describe('getFeaturedProducts', () => {
    it('truyền query và trả 200', async () => {
      const data = [{ id: 3, featured: true }];
      catalogService.getFeaturedProducts.mockResolvedValue(data);

      const req = makeReq({ query: { limit: '8' } });
      const res = makeRes();

      await controller.getFeaturedProducts(req, res, jest.fn());

      expect(catalogService.getFeaturedProducts).toHaveBeenCalledWith({ limit: '8' });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data });
    });
  });

  describe('getRelatedProducts', () => {
    it('merge id với query', async () => {
      const relatedData = [{ id: 4 }];
      catalogService.getRelatedProducts.mockResolvedValue(relatedData);

      const req = makeReq({ params: { id: '10' }, query: { limit: '4' } });
      const res = makeRes();

      await controller.getRelatedProducts(req, res, jest.fn());

      expect(catalogService.getRelatedProducts).toHaveBeenCalledWith({ id: '10', limit: '4' });
      expect(res._body).toEqual({ status: 'success', data: relatedData });
    });
  });

  describe('searchProducts', () => {
    it('spread kết quả từ service vào response body', async () => {
      const serviceResult = { data: [{ id: 1 }], total: 1, page: 1 };
      catalogService.searchProducts.mockResolvedValue(serviceResult);

      const req = makeReq({ query: { keyword: 'samsung', page: '1' } });
      const res = makeRes();

      await controller.searchProducts(req, res, jest.fn());

      expect(res._status).toBe(200);
      // Kết quả spread vào body — kiểm tra status + các field từ service
      expect(res._body.status).toBe('success');
      expect(res._body.data).toEqual(serviceResult.data);
      expect(res._body.total).toBe(1);
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.searchProducts.mockRejectedValue(new Error('search fail'));

      const next = jest.fn();
      await controller.searchProducts(makeReq({ query: { keyword: '' } }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getProductSuggestions', () => {
    it('truyền query và trả 200', async () => {
      const suggestions = [{ id: 1, name: 'iPhone' }];
      catalogService.getProductSuggestions.mockResolvedValue(suggestions);

      const req = makeReq({ query: { q: 'iph' } });
      const res = makeRes();

      await controller.getProductSuggestions(req, res, jest.fn());

      expect(catalogService.getProductSuggestions).toHaveBeenCalledWith({ q: 'iph' });
      expect(res._body).toEqual({ status: 'success', data: suggestions });
    });
  });

  describe('getNewArrivals', () => {
    it('trả 200 với list sản phẩm mới', async () => {
      const newArrivals = [{ id: 100 }];
      catalogService.getNewArrivals.mockResolvedValue(newArrivals);

      const res = makeRes();
      await controller.getNewArrivals(makeReq({ query: { limit: '10' } }), res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: newArrivals });
    });
  });

  describe('getBestSellers', () => {
    it('trả 200 với list best sellers', async () => {
      const bestSellers = [{ id: 5, soldCount: 100 }];
      catalogService.getBestSellers.mockResolvedValue(bestSellers);

      const res = makeRes();
      await controller.getBestSellers(makeReq(), res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: bestSellers });
    });
  });

  describe('getDeals', () => {
    it('trả 200 với danh sách khuyến mãi', async () => {
      const dealsData = [{ id: 7, discount: 30 }];
      catalogService.getDeals.mockResolvedValue(dealsData);

      const res = makeRes();
      await controller.getDeals(makeReq({ query: { minDiscount: '20' } }), res, jest.fn());

      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: dealsData });
    });
  });

  describe('getProductVariants', () => {
    it('truyền id và trả 200', async () => {
      const variants = [{ skuId: 'sku_1', color: 'Đen' }];
      catalogService.getProductVariants.mockResolvedValue(variants);

      const req = makeReq({ params: { id: '15' } });
      const res = makeRes();

      await controller.getProductVariants(req, res, jest.fn());

      expect(catalogService.getProductVariants).toHaveBeenCalledWith({ id: '15' });
      expect(res._body).toEqual({ status: 'success', data: variants });
    });
  });

  describe('getProductReviewsSummary', () => {
    it('truyền id và trả summary', async () => {
      const summary = { averageRating: 4.5, totalReviews: 120 };
      catalogService.getProductReviewsSummary.mockResolvedValue(summary);

      const req = makeReq({ params: { id: '20' } });
      const res = makeRes();

      await controller.getProductReviewsSummary(req, res, jest.fn());

      expect(catalogService.getProductReviewsSummary).toHaveBeenCalledWith({ id: '20' });
      expect(res._body).toEqual({ status: 'success', data: summary });
    });
  });

  describe('getProductFilters', () => {
    it('truyền query filters và trả 200', async () => {
      const filtersData = { priceRange: [0, 50000000], brands: ['Samsung', 'Apple'] };
      catalogService.getProductFilters.mockResolvedValue(filtersData);

      const req = makeReq({ query: { categoryId: '3' } });
      const res = makeRes();

      await controller.getProductFilters(req, res, jest.fn());

      expect(catalogService.getProductFilters).toHaveBeenCalledWith({ categoryId: '3' });
      expect(res._body).toEqual({ status: 'success', data: filtersData });
    });
  });

  describe('createProduct', () => {
    it('trả về 201 khi tạo sản phẩm thành công', async () => {
      const newProduct = { id: 200, name: 'Samsung Galaxy S25' };
      catalogService.createProduct.mockResolvedValue(newProduct);

      const req = makeReq({ body: { name: 'Samsung Galaxy S25', price: 20000000 } });
      const res = makeRes();
      const next = jest.fn();

      await controller.createProduct(req, res, next);

      expect(catalogService.createProduct).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body).toEqual({ status: 'success', data: newProduct });
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.createProduct.mockRejectedValue(new Error('validation fail'));

      const next = jest.fn();
      await controller.createProduct(makeReq({ body: {} }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateProduct', () => {
    it('truyền id và patch vào service, trả 200', async () => {
      const updatedProduct = { id: '50', price: 25000000 };
      catalogService.updateProduct.mockResolvedValue(updatedProduct);

      const req = makeReq({ params: { id: '50' }, body: { price: 25000000 } });
      const res = makeRes();

      await controller.updateProduct(req, res, jest.fn());

      expect(catalogService.updateProduct).toHaveBeenCalledWith({
        id: '50',
        patch: { price: 25000000 },
      });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', data: updatedProduct });
    });

    it('gọi next(err) khi service ném lỗi 404', async () => {
      const notFound = Object.assign(new Error('Sản phẩm không tồn tại'), { statusCode: 404 });
      catalogService.updateProduct.mockRejectedValue(notFound);

      const next = jest.fn();
      await controller.updateProduct(makeReq({ params: { id: '999' } }), makeRes(), next);

      expect(next).toHaveBeenCalledWith(notFound);
    });
  });

  describe('deleteProduct', () => {
    it('trích message từ service result và trả 200', async () => {
      catalogService.deleteProduct.mockResolvedValue({ message: 'Xóa sản phẩm thành công' });

      const req = makeReq({ params: { id: '30' } });
      const res = makeRes();

      await controller.deleteProduct(req, res, jest.fn());

      expect(catalogService.deleteProduct).toHaveBeenCalledWith({ id: '30' });
      expect(res._status).toBe(200);
      expect(res._body).toEqual({ status: 'success', message: 'Xóa sản phẩm thành công' });
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      catalogService.deleteProduct.mockRejectedValue(new Error('xóa thất bại'));

      const next = jest.fn();
      await controller.deleteProduct(makeReq({ params: { id: '1' } }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });
});
