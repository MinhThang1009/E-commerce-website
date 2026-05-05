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
}

module.exports = CatalogController;
