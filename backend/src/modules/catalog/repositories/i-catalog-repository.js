/**
 * @file ICatalogRepository.js
 * @layer Repository
 * @module catalog
 * @description Data access layer cho catalog
 */
// ICatalogRepository — interface gộp catalog data access (Category, Brand,
// Product). Sprint 6a triển khai Category+Brand; Sprint 6b mở rộng Product
// (find/search/CRUD/related/featured/...).
class ICatalogRepository {
  // -------- Category --------
  async findAllCategoriesSorted() {
    throw new Error('not implemented');
  }
  async getCategoryProductCounts() {
    throw new Error('not implemented');
  }
  async findCategoryById(_id) {
    throw new Error('not implemented');
  }
  async findCategoryByIdOrSlug(_idOrSlug) {
    throw new Error('not implemented');
  }
  async findCategoryBySlug(_slug) {
    throw new Error('not implemented');
  }
  async createCategory(_payload) {
    throw new Error('not implemented');
  }
  async saveCategory(_category) {
    throw new Error('not implemented');
  }
  async deleteCategory(_category) {
    throw new Error('not implemented');
  }
  async countProductsByCategoryId(_categoryId) {
    throw new Error('not implemented');
  }
  async findProductsByCategoryId(_categoryId, _options) {
    throw new Error('not implemented');
  }

  // -------- Brand --------
  async findAllBrands(_options) {
    throw new Error('not implemented');
  }
  async findBrandIdsByCategoryId(_categoryId) {
    throw new Error('not implemented');
  }
  async findBrandById(_id) {
    throw new Error('not implemented');
  }
  async findBrandBySlug(_slug) {
    throw new Error('not implemented');
  }
  async createBrand(_payload) {
    throw new Error('not implemented');
  }
  async saveBrand(_brand) {
    throw new Error('not implemented');
  }
  async deleteBrand(_brand) {
    throw new Error('not implemented');
  }
  async countProductsByBrandId(_brandId) {
    throw new Error('not implemented');
  }
  async findProductsByBrandId(_brandId, _options) {
    throw new Error('not implemented');
  }

  // -------- Product (Sprint 6b) --------
  async findProductsList(_options) {
    throw new Error('not implemented');
  }
  async findProductByIdWithFullDetails(_id) {
    throw new Error('not implemented');
  }
  async findProductBySlugWithFullDetails(_slug) {
    throw new Error('not implemented');
  }
  async findProductByPk(_id) {
    throw new Error('not implemented');
  }
  async findFeaturedProducts(_limit) {
    throw new Error('not implemented');
  }
  async findRelatedProducts(_excludeId, _limit) {
    throw new Error('not implemented');
  }
  async searchProducts(_options) {
    throw new Error('not implemented');
  }
  async findProductSuggestions(_prefix, _limit) {
    throw new Error('not implemented');
  }
  async findNewArrivals(_limit) {
    throw new Error('not implemented');
  }
  async findBestSellersRaw(_options) {
    throw new Error('not implemented');
  }
  async findProductsByIdsOrdered(_ids) {
    throw new Error('not implemented');
  }
  async findDeals(_options) {
    throw new Error('not implemented');
  }
  async findProductVariantsByProductId(_productId) {
    throw new Error('not implemented');
  }
  async findProductRatingsRows(_productId) {
    throw new Error('not implemented');
  }
  async getProductPriceRange(_options) {
    throw new Error('not implemented');
  }
  async findAttributeValuesByName(_name, _options) {
    throw new Error('not implemented');
  }
  async findOtherAttributes(_options) {
    throw new Error('not implemented');
  }
  async findRecentlyViewedByUser(_userId, _limit) {
    throw new Error('not implemented');
  }
  async upsertRecentlyViewed(_userId, _productId) {
    throw new Error('not implemented');
  }
  async pruneRecentlyViewed(_userId, _maxKeep) {
    throw new Error('not implemented');
  }
  async createProduct(_payload, _options) {
    throw new Error('not implemented');
  }
  async saveProduct(_product, _options) {
    throw new Error('not implemented');
  }
  async deleteProduct(_product) {
    throw new Error('not implemented');
  }
  async findCategoriesByIds(_ids) {
    throw new Error('not implemented');
  }

  async setProductCategories(_product, _categories, _options) {
    throw new Error('not implemented');
  }

  async createProductSpecifications(_rows, _options) {
    throw new Error('not implemented');
  }
  async clearProductAttributes(_productId, _options) {
    throw new Error('not implemented');
  }
  async createProductAttributes(_rows, _options) {
    throw new Error('not implemented');
  }
  async clearProductVariants(_productId, _options) {
    throw new Error('not implemented');
  }
  async createProductVariants(_rows, _options) {
    throw new Error('not implemented');
  }
  async runInTransaction(_work) {
    throw new Error('not implemented');
  }
}

module.exports = ICatalogRepository;
