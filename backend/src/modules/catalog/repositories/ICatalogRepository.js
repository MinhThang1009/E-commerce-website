// ICatalogRepository — interface gộp catalog data access (Category, Brand,
// Collection, Product). Sprint 6a triển khai Category+Brand+Collection;
// Sprint 6b mở rộng Product (find/search/CRUD/related/featured/...).
class ICatalogRepository {
  // -------- Category --------
  async findAllCategoriesSorted() { throw new Error('not implemented'); }
  async getCategoryProductCounts() { throw new Error('not implemented'); }
  async findCategoryById(_id) { throw new Error('not implemented'); }
  async findCategoryByIdOrSlug(_idOrSlug) { throw new Error('not implemented'); }
  async findCategoryBySlug(_slug) { throw new Error('not implemented'); }
  async createCategory(_payload) { throw new Error('not implemented'); }
  async saveCategory(_category) { throw new Error('not implemented'); }
  async deleteCategory(_category) { throw new Error('not implemented'); }
  async countProductsByCategoryId(_categoryId) { throw new Error('not implemented'); }
  async findProductsByCategoryId(_categoryId, _options) { throw new Error('not implemented'); }

  // -------- Brand --------
  async findAllBrands(_options) { throw new Error('not implemented'); }
  async findBrandIdsByCategoryId(_categoryId) { throw new Error('not implemented'); }
  async findBrandById(_id) { throw new Error('not implemented'); }
  async findBrandBySlug(_slug) { throw new Error('not implemented'); }
  async createBrand(_payload) { throw new Error('not implemented'); }
  async saveBrand(_brand) { throw new Error('not implemented'); }
  async deleteBrand(_brand) { throw new Error('not implemented'); }
  async countProductsByBrandId(_brandId) { throw new Error('not implemented'); }
  async findProductsByBrandId(_brandId, _options) { throw new Error('not implemented'); }

  // -------- Collection --------
  async findAllCollections(_options) { throw new Error('not implemented'); }
  async findCollectionById(_id) { throw new Error('not implemented'); }
  async findCollectionBySlug(_slug) { throw new Error('not implemented'); }
  async createCollection(_payload) { throw new Error('not implemented'); }
  async saveCollection(_collection) { throw new Error('not implemented'); }
  async deleteCollection(_collection) { throw new Error('not implemented'); }
  async setCollectionProducts(_collectionId, _productIds, _options) { throw new Error('not implemented'); }
  async findProductsByCollectionId(_collectionId, _options) { throw new Error('not implemented'); }

  // -------- Product (Sprint 6b sẽ mở rộng) --------
  // Reserved space — Sprint 6b add: searchProducts, findFeatured, findNewArrivals, ...
}

module.exports = ICatalogRepository;
