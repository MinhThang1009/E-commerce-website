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

  // ---------- Product (Sprint 6b) ----------

  RECENTLY_VIEWED_MAX = 20;
  CACHE_TTL_PRODUCT_LIST = 10 * 60;
  CACHE_TTL_PRODUCT_DETAIL = 10 * 60;

  // Helper: map productImages → images, set thumbnail. Mutates productJson.
  _mapProductImages(productJson) {
    if (productJson.productImages && productJson.productImages.length > 0) {
      productJson.images = productJson.productImages.map((img) => ({
        id: img.id,
        url: img.imageUrl,
        alt: img.altText,
        isThumbnail: img.isThumbnail,
        displayOrder: img.displayOrder,
        variantId: img.variantId,
        color: img.color,
      }));
      const primary = productJson.productImages.find((img) => img.isThumbnail) || productJson.productImages[0];
      productJson.thumbnail = primary.imageUrl;
    } else {
      productJson.images = [];
      productJson.thumbnail = null;
    }
    return productJson;
  }

  // Helper: tính ratings (average + count) từ reviews — chỉ verified review.
  _calcRatings(reviews, { onlyVerified = false } = {}) {
    if (!reviews || reviews.length === 0) {
      return { average: 0, count: 0 };
    }
    const filtered = onlyVerified ? reviews.filter((r) => r.isVerified) : reviews;
    if (filtered.length === 0) return { average: 0, count: 0 };
    const total = filtered.reduce((sum, r) => sum + r.rating, 0);
    return {
      average: parseFloat((total / filtered.length).toFixed(1)),
      count: filtered.length,
    };
  }

  // Helper: pick display price từ variants (lowest) hoặc basePrice fallback.
  _pickDisplayPrice(productJson) {
    const basePrice = parseFloat(productJson.basePrice) || 0;
    if (productJson.variants && productJson.variants.length > 0) {
      const sorted = [...productJson.variants].sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
      return parseFloat(sorted[0].price) || basePrice;
    }
    return basePrice;
  }

  // Cache busting cho product
  async _clearProductCache(productId, productSlug) {
    if (!this.cacheStore || typeof this.cacheStore.delMany !== 'function') return;
    const keys = [];
    if (this.cacheStore.delPattern) {
      try {
        await this.cacheStore.delPattern('products:list:*');
        await this.cacheStore.delPattern('chatbot:*');
      } catch (err) {
        this.logger.warn('clearProductCache pattern thất bại:', err.message);
      }
    }
    if (productId) keys.push(`product:detail:${productId}`);
    if (productSlug) keys.push(`product:detail:${productSlug}`);
    for (const k of keys) {
      try { await this.cacheStore.del(k); } catch { /* ignore */ }
    }
  }

  // GET /api/products — list với cache + faceted filter
  async getAllProducts({ page = 1, sort = 'createdAt', order = 'DESC',
    category, search, minPrice, maxPrice, inStock, featured, status, brand, collection,
    limit, cacheUrl }) {
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const off = (parseInt(page, 10) - 1) * lim;

    // Cache check
    const cacheKey = cacheUrl ? `products:list:${cacheUrl}` : null;
    if (cacheKey && this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) {
        return { payload: JSON.parse(cached), cacheHit: true };
      }
    }

    // Resolve category slug → id
    let categoryId;
    let categoryIdMissingSentinel = false;
    if (category) {
      const isNumericId = !isNaN(category) && String(category).trim() !== '';
      if (isNumericId) {
        categoryId = category;
      } else {
        const cat = await this.catalogRepository.findCategoryBySlug(category);
        if (cat) categoryId = cat.id;
        else categoryIdMissingSentinel = true;
      }
    }

    // Resolve brand: array of ids vs slugs
    const filter = { search, minPrice, maxPrice, inStock, featured, status };
    if (categoryId !== undefined) filter.categoryId = categoryId;
    if (categoryIdMissingSentinel) filter.categoryIdMissingSentinel = true;

    if (brand) {
      const brands = Array.isArray(brand) ? brand : [brand];
      const brandIds = brands.filter((b) => !isNaN(b) && String(b).trim() !== '');
      const brandSlugs = brands.filter((b) => isNaN(b) || String(b).trim() === '');
      if (brandIds.length > 0) filter.brandIdsIn = brandIds;
      if (brandSlugs.length > 0) filter.brandSlugsIn = brandSlugs;
    }

    if (collection) {
      const collections = Array.isArray(collection) ? collection : [collection];
      const cIds = collections.filter((c) => !isNaN(c) && String(c).trim() !== '');
      const cSlugs = collections.filter((c) => isNaN(c) || String(c).trim() === '');
      if (cIds.length > 0) filter.collectionIdsIn = cIds;
      else if (cSlugs.length > 0) filter.collectionSlugsIn = cSlugs;
    }

    const { count, rows: productsRaw } = await this.catalogRepository.findProductsList({
      filter, sort, order, limit: lim, offset: off,
    });

    const products = productsRaw.map((product) => {
      const json = product.toJSON();
      json.price = json.basePrice;

      if (!json.categories) json.categories = [];
      if (json.category && !json.categories.some((c) => c.id === json.category.id)) {
        json.categories.push(json.category);
      }

      this._mapProductImages(json);

      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;

      const displayPrice = this._pickDisplayPrice(json);
      const compareAtPrice = parseFloat(json.compareAtPrice) || null;

      return { ...json, price: displayPrice, compareAtPrice, ratings };
    });

    const payload = {
      status: 'success',
      data: products,
      total: count,
      page: parseInt(page, 10),
      limit: lim,
    };

    if (cacheKey && this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_PRODUCT_LIST, JSON.stringify(payload));
    }
    return { payload, cacheHit: false };
  }

  // GET /api/products/:id — detail với variant resolution + recently-viewed track
  async getProductById({ id, skuId, queryColor, userId }) {
    const isBaseRequest = !skuId && !queryColor;
    const detailCacheKey = isBaseRequest ? `product:detail:${id}` : null;

    if (detailCacheKey && this.cacheStore) {
      const cached = await this.cacheStore.get(detailCacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (userId && cachedData?.data?.id) {
          this._trackRecentlyViewed(userId, cachedData.data.id).catch(() => {});
        }
        return { payload: cachedData, cacheHit: true };
      }
    }

    let product = await this.catalogRepository.findProductByIdWithFullDetails(id);
    if (!product) {
      product = await this.catalogRepository.findProductBySlugWithFullDetails(id);
    }
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const responseData = this._buildProductDetailResponse(product, { skuId, queryColor });
    const payload = { status: 'success', data: responseData };

    if (userId) {
      this._trackRecentlyViewed(userId, product.id).catch((err) => {
        this.logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      });
    }

    if (detailCacheKey && this.cacheStore) {
      await this.cacheStore.setEx(detailCacheKey, this.CACHE_TTL_PRODUCT_DETAIL, JSON.stringify(payload));
    }
    return { payload, cacheHit: false };
  }

  // GET /api/products/slug/:slug
  async getProductBySlug({ slug, skuId, queryColor, userId }) {
    const product = await this.catalogRepository.findProductBySlugWithFullDetails(slug);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const responseData = this._buildProductDetailResponse(product, { skuId, queryColor });

    if (userId) {
      this._trackRecentlyViewed(userId, product.id).catch((err) => {
        this.logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      });
    }

    return responseData;
  }

  // Helper: build product detail response với variant resolution + image filtering
  _buildProductDetailResponse(product, { skuId, queryColor }) {
    const productJson = product.toJSON();
    this._mapProductImages(productJson);

    const ratings = {
      ...this._calcRatings(productJson.reviews, { onlyVerified: true }),
      totalCount: productJson.reviews ? productJson.reviews.length : 0,
    };

    let responseData = {
      ...productJson,
      ratings,
      price: parseFloat(productJson.basePrice) || 0,
      compareAtPrice: parseFloat(productJson.compareAtPrice) || null,
    };

    if (productJson.variants && productJson.variants.length > 0) {
      const normColor = queryColor?.toString().normalize('NFC').toLowerCase().trim();
      let selectedVariant = null;

      if (skuId) {
        selectedVariant = productJson.variants.find((v) => String(v.id) === String(skuId));
      }
      if (!selectedVariant && normColor) {
        selectedVariant = productJson.variants.find((v) => {
          const vAttrs = v.attributes || {};
          const vColor = (vAttrs.color || vAttrs['Màu sắc'] || vAttrs['màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();
          return vColor === normColor;
        });
      }
      if (!selectedVariant) {
        selectedVariant = productJson.variants.find((v) => v.isDefault === true || v.isDefault === 1) || productJson.variants[0];
      }

      if (selectedVariant) {
        const attrs = selectedVariant.attributes || {};
        let variantColor = (attrs.color || attrs['Màu sắc'] || attrs['màu sắc'])?.toString().normalize('NFC').toLowerCase().trim();
        if (!skuId && normColor) variantColor = normColor;

        let variantImages = (productJson.images || []);
        if (skuId && selectedVariant) {
          const matchByVariantId = variantImages.filter((img) => img.variantId === selectedVariant.id);
          if (matchByVariantId.length > 0) variantImages = matchByVariantId;
          else if (variantColor) {
            variantImages = variantImages.filter((img) =>
              img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor
            );
          }
        } else if (variantColor) {
          const matchByColor = variantImages.filter((img) =>
            img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor
          );
          if (matchByColor.length > 0) variantImages = matchByColor;
        }

        const variantName = selectedVariant.variantName || selectedVariant.displayName;
        const mainName = productJson.name;
        const modelName = productJson.model || mainName.replace(/^(Laptop|Điện thoại|Máy tính bảng|Đồng hồ|Tai nghe|Loa|Phụ kiện)\s+/i, '');
        const fullName = (variantName.toLowerCase().includes(mainName.toLowerCase()) || variantName.toLowerCase().includes(modelName.toLowerCase()))
          ? variantName
          : `${mainName} - ${variantName}`;

        responseData = {
          ...productJson,
          ratings,
          isVariantProduct: true,
          name: fullName,
          price: selectedVariant.price || productJson.basePrice,
          compareAtPrice: selectedVariant.compareAtPrice || productJson.compareAtPrice,
          stockQuantity: selectedVariant.stockQuantity,
          sku: selectedVariant.sku,
          images: variantImages.length > 0 ? variantImages : productJson.images,
          thumbnail: variantImages.length > 0 ? variantImages[0].url : productJson.thumbnail,
          currentVariant: {
            ...selectedVariant,
            ...attrs,
            name: variantName,
            fullName,
            images: variantImages.length > 0 ? variantImages : productJson.images,
            thumbnail: variantImages.length > 0 ? variantImages[0].url : productJson.thumbnail,
            price: selectedVariant.price || productJson.basePrice,
            compareAtPrice: selectedVariant.compareAtPrice || productJson.compareAtPrice,
          },
          availableVariants: productJson.variants.map((v) => ({
            ...v,
            name: v.variantName || v.displayName,
            price: v.price || productJson.basePrice,
            compareAtPrice: v.compareAtPrice || productJson.compareAtPrice,
          })),
          specifications: { ...productJson.specifications, ...selectedVariant.attributes },
        };
      }
    }

    return responseData;
  }

  async _trackRecentlyViewed(userId, productId) {
    await this.catalogRepository.upsertRecentlyViewed(userId, productId);
    await this.catalogRepository.pruneRecentlyViewed(userId, this.RECENTLY_VIEWED_MAX);
  }

  async getFeaturedProducts({ limit = 8 }) {
    const productsRaw = await this.catalogRepository.findFeaturedProducts(parseInt(limit, 10));
    return productsRaw.map((p) => this._mapProductForList(p));
  }

  // Helper: map product cho list endpoints (featured/new-arrivals/related/...)
  _mapProductForList(product) {
    const json = product.toJSON();
    json.price = json.basePrice;
    this._mapProductImages(json);
    const ratings = this._calcRatings(json.reviews);
    delete json.reviews;
    const displayPrice = this._pickDisplayPrice(json);
    const compareAtPrice = parseFloat(json.compareAtPrice) || null;
    return { ...json, price: displayPrice, compareAtPrice, ratings };
  }

  async getRelatedProducts({ id, limit = 4 }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const lim = parseInt(limit, 10);
    let related = [];
    if (product.categoryId) {
      related = await this.catalogRepository.findRelatedProducts(id, lim);
    }
    if (related.length === 0) {
      this.logger.info(`Không tìm thấy sản phẩm liên quan cho sản phẩm ${id}. Trả về sản phẩm gần đây thay thế.`);
      related = await this.catalogRepository.findRelatedProductsFallback(id, lim);
    }

    return related.map((p) => {
      const json = p.toJSON();
      this._mapProductImages(json);
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      return { ...json, ratings };
    });
  }

  async searchProducts({ q, page = 1, limit = 10 }) {
    if (!q) throw new AppError('Từ khóa tìm kiếm là bắt buộc', 400);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows: productsRaw } = await this.catalogRepository.searchProducts({
      q, limit: lim, offset: off,
    });

    const products = productsRaw.map((product) => {
      const json = product.toJSON();
      json.price = json.basePrice;
      this._mapProductImages(json);
      delete json.productImages;
      return json;
    });

    return {
      data: products,
      total: count,
      page: parseInt(page, 10),
      limit: lim,
    };
  }

  async getProductSuggestions({ q }) {
    if (!q || q.trim().length < 1) return [];

    const products = await this.catalogRepository.findProductSuggestions(q.trim(), 10);
    return products.map((p) => {
      const json = p.toJSON();
      const primary = json.productImages?.find((img) => img.isThumbnail) || json.productImages?.[0];
      return {
        id: json.id,
        name: json.name,
        slug: json.slug,
        thumbnail: primary?.imageUrl || null,
      };
    });
  }

  async getNewArrivals({ limit = 8 }) {
    const productsRaw = await this.catalogRepository.findNewArrivals(parseInt(limit, 10));
    return productsRaw.map((product) => {
      const json = product.toJSON();
      json.price = json.basePrice;
      this._mapProductImages(json);
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      return { ...json, ratings };
    });
  }

  async getBestSellers({ limit = 10, period = 'month' }) {
    const now = new Date();
    let startDate;
    switch (period) {
      case 'week': startDate = new Date(now.setDate(now.getDate() - 7)); break;
      case 'year': startDate = new Date(now.setFullYear(now.getFullYear() - 1)); break;
      default: startDate = new Date(now.setMonth(now.getMonth() - 1)); break;
    }

    const lim = parseInt(limit, 10);
    const bestSellers = await this.catalogRepository.findBestSellersRaw({ startDate, limit: lim });

    if (bestSellers.length === 0) {
      // Fallback newest
      return this.getNewArrivals({ limit: lim });
    }

    const ids = bestSellers.map((p) => p.id);
    const productsRaw = await this.catalogRepository.findProductsByIdsOrdered(ids);

    return productsRaw.map((product) => {
      const json = product.toJSON();
      json.price = json.basePrice;
      this._mapProductImages(json);
      delete json.productImages;
      return json;
    });
  }

  async getDeals({ limit, minDiscount, sort = 'discount_desc' }) {
    const parsedLimit = Math.min(parseInt(limit, 10) || 12, 100);
    const parsedMinDiscount = parseFloat(minDiscount) || 5;

    const products = await this.catalogRepository.findDeals({
      minDiscount: parsedMinDiscount, sort, limit: parsedLimit,
    });

    return products.map((product) => {
      const compareAtPrice = parseFloat(product.compareAtPrice);
      const basePrice = parseFloat(product.basePrice);
      const discountPercentage = ((compareAtPrice - basePrice) / compareAtPrice) * 100;

      const ratings = this._calcRatings(product.reviews);

      const json = product.toJSON();
      json.price = basePrice;
      this._mapProductImages(json);
      delete json.productImages;
      delete json.reviews;
      return { ...json, discountPercentage, ratings };
    });
  }

  async getProductVariants({ id }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const variants = await this.catalogRepository.findProductVariantsByProductId(id);
    return { variants };
  }

  async getProductReviewsSummary({ id }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const reviews = await this.catalogRepository.findProductRatingsRows(id);
    const count = reviews.length;
    const average = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => { distribution[r.rating]++; });

    return { average, count, distribution };
  }

  async getProductFilters({ categoryId }) {
    let actualCategoryId = null;
    if (categoryId) {
      const isStrictInt = /^\d+$/.test(String(categoryId).trim());
      const isSlug = /^[a-z0-9-]+$/.test(String(categoryId).trim());
      if (!isStrictInt && !isSlug) {
        throw new AppError('categoryId không hợp lệ', 400);
      }
      if (isStrictInt) actualCategoryId = parseInt(categoryId, 10);
      else {
        const category = await this.catalogRepository.findCategoryBySlug(categoryId);
        if (category) actualCategoryId = category.id;
      }
    }

    const priceRange = await this.catalogRepository.getProductPriceRange({ categoryId: actualCategoryId });

    const [brands, colors, sizes, others] = await Promise.all([
      this.catalogRepository.findAttributeValuesByName('brand', { categoryId: actualCategoryId }),
      this.catalogRepository.findAttributeValuesByName('color', { categoryId: actualCategoryId }),
      this.catalogRepository.findAttributeValuesByName('size', { categoryId: actualCategoryId }),
      this.catalogRepository.findOtherAttributes({ categoryId: actualCategoryId }),
    ]);

    const collectValues = (rows) => {
      const set = new Set();
      rows.forEach((r) => {
        if (r.values && Array.isArray(r.values)) r.values.forEach((v) => set.add(v));
      });
      return Array.from(set);
    };

    return {
      priceRange,
      brands: collectValues(brands),
      colors: collectValues(colors),
      sizes: collectValues(sizes),
      attributes: others.map((a) => ({ name: a.name, values: a.values || [] })),
    };
  }

  async getRecentlyViewed({ userId, limit = 10 }) {
    const recentlyViewed = await this.catalogRepository.findRecentlyViewedByUser(userId, parseInt(limit, 10));
    return recentlyViewed.map((rv) => {
      const product = rv.Product;
      const json = product.toJSON();
      this._mapProductImages(json);
      delete json.productImages;
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      return { ...json, ratings, viewedAt: rv.viewedAt };
    });
  }

  async createProduct({ payload }) {
    const isVariantProduct = Boolean(payload.variants && payload.variants.length > 0);
    let createdProduct;

    await this.catalogRepository.runInTransaction(async (transaction) => {
      const product = await this.catalogRepository.createProduct({
        name: payload.name,
        baseName: payload.baseName || payload.name,
        description: payload.description,
        shortDescription: payload.shortDescription,
        basePrice: isVariantProduct ? 0 : payload.price,
        compareAtPrice: isVariantProduct ? null : payload.compareAtPrice,
        images: payload.images || [],
        thumbnail: payload.thumbnail,
        stockQuantity: isVariantProduct ? 0 : payload.stockQuantity,
        isFeatured: payload.featured,
        tags: payload.tags || [],
        seoTitle: payload.seoTitle,
        seoDescription: payload.seoDescription,
        seoKeywords: payload.seoKeywords || [],
        isVariantProduct,
        specifications: payload.specifications || {},
      }, { transaction });

      if (payload.categoryIds && payload.categoryIds.length > 0) {
        const categories = await this.catalogRepository.findCategoriesByIds(payload.categoryIds);
        if (categories.length !== payload.categoryIds.length) {
          throw new AppError('Một hoặc nhiều danh mục không tồn tại', 400);
        }
        await this.catalogRepository.setProductCategories(product, categories, { transaction });
      }

      if (payload.specifications && Array.isArray(payload.specifications) && payload.specifications.length > 0) {
        const rows = payload.specifications.map((spec, i) => ({
          productId: product.id,
          name: spec.name, value: spec.value, category: spec.category || 'General', sortOrder: i,
        }));
        await this.catalogRepository.createProductSpecifications(rows, { transaction });
      }

      if (payload.parentAttributes && payload.parentAttributes.length > 0) {
        const rows = payload.parentAttributes.map((attr, i) => ({
          productId: product.id,
          name: attr.name, type: attr.type, values: attr.values, required: attr.required, sortOrder: i,
        }));
        await this.catalogRepository.createProductAttributes(rows, { transaction });
      }

      if (payload.attributes && payload.attributes.length > 0) {
        const rows = payload.attributes.map((attr) => ({ ...attr, productId: product.id }));
        await this.catalogRepository.createProductAttributes(rows, { transaction });
      }

      if (payload.variants && payload.variants.length > 0) {
        const rows = payload.variants.map((v, i) => ({
          productId: product.id,
          sku: v.sku || `${product.id}-VAR-${i + 1}`,
          name: v.name || v.variantName || v.displayName,
          price: parseFloat(v.price) || 0,
          compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : null,
          stockQuantity: parseInt(v.stockQuantity || v.stock, 10) || 0,
          isDefault: v.isDefault || i === 0,
          isAvailable: v.isAvailable !== false,
          attributes: v.attributes || {},
          attributeValues: v.attributeValues || {},
          specifications: v.specifications || {},
          images: v.images || [],
          displayName: v.displayName || v.name || v.variantName,
          sortOrder: v.sortOrder || i,
        }));
        await this.catalogRepository.createProductVariants(rows, { transaction });
      }

      if (payload.warrantyPackageIds && payload.warrantyPackageIds.length > 0) {
        const warranties = await this.catalogRepository.findWarrantyPackagesByIds(payload.warrantyPackageIds);
        if (warranties.length !== payload.warrantyPackageIds.length) {
          throw new AppError('Một hoặc nhiều gói bảo hành không tồn tại', 400);
        }
        await this.catalogRepository.setProductWarrantyPackages(product, warranties, { transaction });
      }

      createdProduct = product;
    });

    const fullProduct = await this.catalogRepository.findProductByIdWithFullDetails(createdProduct.id);
    await this._clearProductCache(null);
    return fullProduct;
  }

  async updateProduct({ id, patch }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const originalSlug = product.slug;

    await this.catalogRepository.runInTransaction(async (transaction) => {
      const updateData = {};
      const setIfPresent = (key, value) => {
        if (Object.prototype.hasOwnProperty.call(patch, key)) updateData[key === 'featured' ? 'isFeatured' : key] = value;
      };
      setIfPresent('name', patch.name);
      setIfPresent('description', patch.description);
      setIfPresent('shortDescription', patch.shortDescription);
      setIfPresent('price', patch.price);
      setIfPresent('compareAtPrice', patch.compareAtPrice);
      setIfPresent('images', patch.images);
      setIfPresent('thumbnail', patch.thumbnail);
      setIfPresent('inStock', patch.inStock);
      setIfPresent('stockQuantity', patch.stockQuantity);
      setIfPresent('featured', patch.featured);
      setIfPresent('tags', patch.tags);
      setIfPresent('seoTitle', patch.seoTitle);
      setIfPresent('seoDescription', patch.seoDescription);
      setIfPresent('seoKeywords', patch.seoKeywords);
      Object.assign(product, updateData);
      await this.catalogRepository.saveProduct(product, { transaction });

      if (Object.prototype.hasOwnProperty.call(patch, 'categoryIds') && patch.categoryIds) {
        const categories = await this.catalogRepository.findCategoriesByIds(patch.categoryIds);
        if (categories.length !== patch.categoryIds.length) {
          throw new AppError('Một hoặc nhiều danh mục không tồn tại', 400);
        }
        await this.catalogRepository.setProductCategories(product, categories, { transaction });
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'attributes')) {
        await this.catalogRepository.clearProductAttributes(id, { transaction });
        if (patch.attributes && patch.attributes.length > 0) {
          const rows = patch.attributes.map((attr) => ({ ...attr, productId: id }));
          await this.catalogRepository.createProductAttributes(rows, { transaction });
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'variants')) {
        await this.catalogRepository.clearProductVariants(id, { transaction });
        if (patch.variants && patch.variants.length > 0) {
          const rows = patch.variants.map((v) => ({ ...v, productId: id }));
          await this.catalogRepository.createProductVariants(rows, { transaction });
        }
      }

      if (Object.prototype.hasOwnProperty.call(patch, 'warrantyPackageIds')) {
        if (patch.warrantyPackageIds && patch.warrantyPackageIds.length > 0) {
          const warranties = await this.catalogRepository.findWarrantyPackagesByIds(patch.warrantyPackageIds);
          if (warranties.length !== patch.warrantyPackageIds.length) {
            throw new AppError('Một hoặc nhiều gói bảo hành không tồn tại', 400);
          }
          await this.catalogRepository.setProductWarrantyPackages(product, warranties, { transaction });
        } else {
          await this.catalogRepository.setProductWarrantyPackages(product, [], { transaction });
        }
      }
    });

    const updatedProduct = await this.catalogRepository.findProductByIdWithFullDetails(id);
    await this._clearProductCache(id, originalSlug);
    return updatedProduct;
  }

  async deleteProduct({ id }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const productSlug = product.slug;
    await this.catalogRepository.deleteProduct(product);
    await this._clearProductCache(id, productSlug);
    return { message: 'Xóa sản phẩm thành công' };
  }
}

module.exports = CatalogService;
