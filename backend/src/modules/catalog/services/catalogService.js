const { AppError } = require('../../../shared/errors');

// Catalog Service — gộp 4 sub-domain (Category, Brand, Collection, Product).
// Sprint 6a triển khai 21 use case cho Category/Brand/Collection. Sprint 6b
// mở rộng Product (search, featured, related, CRUD ...).
//
// Cache key:
//   - categories:all (TTL 30 phút)
//   - cache:brands:* (pattern, dùng invalidate)
class CatalogService {
  constructor({ catalogRepository, cacheStore, eventBus, logger }) {
    this.catalogRepository = catalogRepository;
    this.cacheStore = cacheStore;
    this.eventBus = eventBus;
    this.logger = logger;
    this.CACHE_TTL_CATEGORIES = 30 * 60;
  }

  async _invalidateCacheKey(key) {
    if (!this.cacheStore) return;
    try { await this.cacheStore.del(key); }
    catch (err) { this.logger.warn(`Xóa cache ${key} thất bại:`, err.message); }
  }

  async _invalidateCachePattern(pattern) {
    if (!this.cacheStore || typeof this.cacheStore.delPattern !== 'function') return;
    try { await this.cacheStore.delPattern(pattern); }
    catch (err) { this.logger.warn(`Xóa cache pattern ${pattern} thất bại:`, err.message); }
  }

  // ---------- Category ----------

  async getAllCategories() {
    const cacheKey = 'categories:all';
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const categories = await this.catalogRepository.findAllCategoriesSorted();
    const countMap = await this.catalogRepository.getCategoryProductCounts();
    const data = categories.map((c) => {
      const json = c.toJSON();
      json.productCount = countMap[c.id] || 0;
      return json;
    });

    const payload = { status: 'success', data };
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_CATEGORIES, JSON.stringify(payload));
    }
    return payload;
  }

  async getCategoryTree() {
    return this.catalogRepository.findAllCategoriesSorted();
  }

  async getCategoryById({ id }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);
    return category;
  }

  async getCategoryBySlug({ slug }) {
    const category = await this.catalogRepository.findCategoryByIdOrSlug(slug);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);
    return category;
  }

  async createCategory({ payload }) {
    const category = await this.catalogRepository.createCategory({
      name: payload.name,
      description: payload.description,
    });
    await this._invalidateCacheKey('categories:all');
    return category;
  }

  async updateCategory({ id, patch }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    if (patch.name !== undefined) category.name = patch.name;
    if (patch.description !== undefined) category.description = patch.description;
    await this.catalogRepository.saveCategory(category);
    await this._invalidateCacheKey('categories:all');
    return category;
  }

  async deleteCategory({ id }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    const productCount = await this.catalogRepository.countProductsByCategoryId(id);
    if (productCount > 0) {
      throw new AppError('Không thể xóa danh mục có sản phẩm', 400);
    }

    await this.catalogRepository.deleteCategory(category);
    await this._invalidateCacheKey('categories:all');
    return { message: 'Xóa danh mục thành công' };
  }

  async getProductsByCategory({ id, page = 1, limit = 10, sort = 'createdAt', order = 'DESC', status = 'active' }) {
    let category = await this.catalogRepository.findCategoryById(id);
    if (!category) {
      category = await this.catalogRepository.findCategoryBySlug(id);
    }
    if (!category) throw new AppError('Không tìm thấy danh mục', 404);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows } = await this.catalogRepository.findProductsByCategoryId(category.id, {
      status, sort, order, limit: lim, offset: off,
    });

    const products = rows.map((p) => this._mapProductWithImages(p));
    return {
      total: count,
      pages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10),
      products,
    };
  }

  async getFeaturedCategories() {
    return this.catalogRepository.findAllCategoriesSorted();
  }

  // Helper: map product với images + price từ default variant
  _mapProductWithImages(product) {
    const json = product.toJSON();

    if (json.productImages) {
      json.images = json.productImages.map((img) => ({
        id: img.id, url: img.imageUrl,
        isThumbnail: img.isThumbnail, color: img.color,
      }));
      const thumb = json.productImages.find((img) => img.isThumbnail) || json.productImages[0];
      json.thumbnail = thumb ? thumb.imageUrl : null;
    }

    if (json.variants && json.variants.length > 0) {
      const def = json.variants.find((v) => v.isDefault === true || v.isDefault === 1) || json.variants[0];
      json.price = def?.price || json.basePrice;
      json.compareAtPrice = def?.compareAtPrice || json.compareAtPrice;
    } else {
      json.price = json.basePrice;
    }

    return json;
  }

  // ---------- Brand ----------

  async getAllBrands({ categoryId }) {
    const filter = {};
    if (categoryId) {
      const isNumericId = !isNaN(categoryId) && String(categoryId).trim() !== '';
      let catId = categoryId;
      if (!isNumericId) {
        const cat = await this.catalogRepository.findCategoryBySlug(categoryId);
        catId = cat ? cat.id : -1;
      }
      const brandIds = await this.catalogRepository.findBrandIdsByCategoryId(catId);
      filter.idIn = brandIds;
    }
    return this.catalogRepository.findAllBrands({ filter });
  }

  async getBrandBySlug({ slug }) {
    const brand = await this.catalogRepository.findBrandBySlug(slug);
    if (!brand) throw new AppError('Không tìm thấy thương hiệu', 404);
    return brand;
  }

  async createBrand({ payload }) {
    const brand = await this.catalogRepository.createBrand({
      name: payload.name, logoUrl: payload.logoUrl,
    });
    await this._invalidateCachePattern('cache:brands:*');
    return brand;
  }

  async updateBrand({ id, patch }) {
    const brand = await this.catalogRepository.findBrandById(id);
    if (!brand) throw new AppError('Không tìm thấy thương hiệu', 404);
    Object.assign(brand, patch);
    await this.catalogRepository.saveBrand(brand);
    await this._invalidateCachePattern('cache:brands:*');
    return brand;
  }

  async deleteBrand({ id }) {
    const brand = await this.catalogRepository.findBrandById(id);
    if (!brand) throw new AppError('Không tìm thấy thương hiệu', 404);

    const count = await this.catalogRepository.countProductsByBrandId(id);
    if (count > 0) {
      throw new AppError('Không thể xóa thương hiệu đang có sản phẩm', 400);
    }

    await this.catalogRepository.deleteBrand(brand);
    await this._invalidateCachePattern('cache:brands:*');
    return { message: 'Xóa thương hiệu thành công' };
  }

  async getProductsByBrand({ slug, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' }) {
    const brand = await this.catalogRepository.findBrandBySlug(slug);
    if (!brand) throw new AppError('Không tìm thấy thương hiệu', 404);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows: products } = await this.catalogRepository.findProductsByBrandId(brand.id, {
      sort, order, limit: lim, offset: off,
    });

    return {
      total: count,
      pages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10),
      products,
    };
  }

  // ---------- Collection ----------

  async getAllCollections({ isActive }) {
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    return this.catalogRepository.findAllCollections({ filter });
  }

  async getCollectionBySlug({ slug }) {
    const collection = await this.catalogRepository.findCollectionBySlug(slug);
    if (!collection) throw new AppError('Không tìm thấy bộ sưu tập', 404);
    return collection;
  }

  async createCollection({ payload }) {
    const { name, description, thumbnail, isActive, productIds } = payload;
    const collection = await this.catalogRepository.createCollection({
      name, description, thumbnail, isActive,
    });

    if (productIds && productIds.length > 0) {
      await this.catalogRepository.setCollectionProducts(collection.id, productIds);
    }
    return collection;
  }

  async updateCollection({ id, patch }) {
    const collection = await this.catalogRepository.findCollectionById(id);
    if (!collection) throw new AppError('Không tìm thấy bộ sưu tập', 404);

    Object.assign(collection, {
      name: patch.name,
      description: patch.description,
      thumbnail: patch.thumbnail,
      isActive: patch.isActive,
    });
    await this.catalogRepository.saveCollection(collection);

    if (patch.productIds !== undefined) {
      await this.catalogRepository.setCollectionProducts(id, patch.productIds);
    }
    return collection;
  }

  async deleteCollection({ id }) {
    const collection = await this.catalogRepository.findCollectionById(id);
    if (!collection) throw new AppError('Không tìm thấy bộ sưu tập', 404);

    await this.catalogRepository.setCollectionProducts(id, []);
    await this.catalogRepository.deleteCollection(collection);
    return { message: 'Xóa bộ sưu tập thành công' };
  }

  async getProductsByCollection({ slug, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' }) {
    const collection = await this.catalogRepository.findCollectionBySlug(slug);
    if (!collection) throw new AppError('Không tìm thấy bộ sưu tập', 404);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows: products } = await this.catalogRepository.findProductsByCollectionId(collection.id, {
      sort, order, limit: lim, offset: off,
    });

    return {
      total: count,
      pages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10),
      products,
    };
  }
}

module.exports = CatalogService;
