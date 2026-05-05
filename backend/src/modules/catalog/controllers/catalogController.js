// Catalog Controller — Sprint 6a: Category + Brand + Collection (21 handler).
// Sprint 6b: Product (16 handler nữa).
class CatalogController {
  constructor({ catalogService }) {
    this.catalogService = catalogService;
  }

  // ---------- Category ----------

  getAllCategories = async (req, res, next) => {
    try {
      const payload = await this.catalogService.getAllCategories();
      res.status(200).json(payload);
    } catch (err) { next(err); }
  };

  getCategoryTree = async (req, res, next) => {
    try {
      const data = await this.catalogService.getCategoryTree();
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getCategoryById = async (req, res, next) => {
    try {
      const data = await this.catalogService.getCategoryById({ id: req.params.id });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getCategoryBySlug = async (req, res, next) => {
    try {
      const data = await this.catalogService.getCategoryBySlug({ slug: req.params.slug });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  createCategory = async (req, res, next) => {
    try {
      const data = await this.catalogService.createCategory({ payload: req.body });
      res.status(201).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  updateCategory = async (req, res, next) => {
    try {
      const data = await this.catalogService.updateCategory({ id: req.params.id, patch: req.body });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  deleteCategory = async (req, res, next) => {
    try {
      const result = await this.catalogService.deleteCategory({ id: req.params.id });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  getProductsByCategory = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductsByCategory({ id: req.params.id, ...req.query });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getFeaturedCategories = async (req, res, next) => {
    try {
      const data = await this.catalogService.getFeaturedCategories();
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  // ---------- Brand ----------

  getAllBrands = async (req, res, next) => {
    try {
      const data = await this.catalogService.getAllBrands(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getBrandBySlug = async (req, res, next) => {
    try {
      const data = await this.catalogService.getBrandBySlug({ slug: req.params.slug });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  createBrand = async (req, res, next) => {
    try {
      const data = await this.catalogService.createBrand({ payload: req.body });
      res.status(201).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  updateBrand = async (req, res, next) => {
    try {
      const data = await this.catalogService.updateBrand({ id: req.params.id, patch: req.body });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  deleteBrand = async (req, res, next) => {
    try {
      const result = await this.catalogService.deleteBrand({ id: req.params.id });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  getProductsByBrand = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductsByBrand({ slug: req.params.slug, ...req.query });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  // ---------- Collection ----------

  getAllCollections = async (req, res, next) => {
    try {
      const data = await this.catalogService.getAllCollections(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getCollectionBySlug = async (req, res, next) => {
    try {
      const data = await this.catalogService.getCollectionBySlug({ slug: req.params.slug });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  createCollection = async (req, res, next) => {
    try {
      const data = await this.catalogService.createCollection({ payload: req.body });
      res.status(201).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  updateCollection = async (req, res, next) => {
    try {
      const data = await this.catalogService.updateCollection({ id: req.params.id, patch: req.body });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  deleteCollection = async (req, res, next) => {
    try {
      const result = await this.catalogService.deleteCollection({ id: req.params.id });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  getProductsByCollection = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductsByCollection({ slug: req.params.slug, ...req.query });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  // ---------- Product (Sprint 6b) ----------

  getAllProducts = async (req, res, next) => {
    try {
      const { payload, cacheHit } = await this.catalogService.getAllProducts({
        ...req.query, cacheUrl: req.url,
      });
      res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
      res.status(200).json(payload);
    } catch (err) { next(err); }
  };

  getProductById = async (req, res, next) => {
    try {
      const { payload, cacheHit } = await this.catalogService.getProductById({
        id: req.params.id,
        skuId: req.query.skuId,
        queryColor: req.query.color || req.query['Màu sắc'],
        userId: req.user?.id,
      });
      res.setHeader('X-Cache', cacheHit ? 'HIT' : 'MISS');
      res.status(200).json(payload);
    } catch (err) { next(err); }
  };

  getProductBySlug = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductBySlug({
        slug: req.params.slug,
        skuId: req.query.skuId,
        queryColor: req.query.color || req.query['Màu sắc'],
        userId: req.user?.id,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getRecentlyViewed = async (req, res, next) => {
    try {
      const data = await this.catalogService.getRecentlyViewed({
        userId: req.user.id, ...req.query,
      });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getFeaturedProducts = async (req, res, next) => {
    try {
      const data = await this.catalogService.getFeaturedProducts(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getRelatedProducts = async (req, res, next) => {
    try {
      const data = await this.catalogService.getRelatedProducts({ id: req.params.id, ...req.query });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  searchProducts = async (req, res, next) => {
    try {
      const result = await this.catalogService.searchProducts(req.query);
      res.status(200).json({ status: 'success', ...result });
    } catch (err) { next(err); }
  };

  getProductSuggestions = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductSuggestions(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getNewArrivals = async (req, res, next) => {
    try {
      const data = await this.catalogService.getNewArrivals(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getBestSellers = async (req, res, next) => {
    try {
      const data = await this.catalogService.getBestSellers(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getDeals = async (req, res, next) => {
    try {
      const data = await this.catalogService.getDeals(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getProductVariants = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductVariants({ id: req.params.id });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getProductReviewsSummary = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductReviewsSummary({ id: req.params.id });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  getProductFilters = async (req, res, next) => {
    try {
      const data = await this.catalogService.getProductFilters(req.query);
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  createProduct = async (req, res, next) => {
    try {
      const data = await this.catalogService.createProduct({ payload: req.body });
      res.status(201).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  updateProduct = async (req, res, next) => {
    try {
      const data = await this.catalogService.updateProduct({ id: req.params.id, patch: req.body });
      res.status(200).json({ status: 'success', data });
    } catch (err) { next(err); }
  };

  deleteProduct = async (req, res, next) => {
    try {
      const result = await this.catalogService.deleteProduct({ id: req.params.id });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };
}

module.exports = CatalogController;
