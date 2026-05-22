/**
 * @file catalogService.js
 * @layer Service
 * @module catalog
 * @description Business logic layer cho catalog — gộp 3 sub-domain: Category, Brand, Product.
 *   - Category: CRUD + phân trang sản phẩm theo danh mục
 *   - Brand: CRUD + phân trang sản phẩm theo thương hiệu
 *   - Product: danh sách, chi tiết, tìm kiếm, CRUD, featured, best-sellers, deals
 * @depends-on sequelize-catalog-repository, cacheStore (Redis), eventBus, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const { AppError } = require('@shared/errors');

// ---------------------------------------------------------------------------
// Hằng số module — tập trung ở đây để dễ chỉnh khi cần
// ---------------------------------------------------------------------------

/** Số gợi ý tối đa trả về từ endpoint /suggestions */
const MAX_SUGGESTIONS = 10;

/** Số sản phẩm mặc định cho các endpoint list (featured, new-arrivals, ...) */
const DEFAULT_LIST_LIMIT = 8;

/** Số sản phẩm mặc định cho best-sellers */
const DEFAULT_BESTSELLERS_LIMIT = 10;

/** Số sản phẩm mặc định cho deals */
const DEFAULT_DEALS_LIMIT = 12;

/** Giới hạn tối đa bất kỳ query list nào được phép trả về (tránh dump DB) */
const MAX_QUERY_LIMIT = 100;

/** Phần trăm giảm giá tối thiểu để được hiển thị trong trang deals */
const DEFAULT_MIN_DISCOUNT_PERCENT = 5;

/** Số sản phẩm mặc định trên mỗi trang (endpoint getAllProducts) */
const DEFAULT_PAGE_SIZE = 20;

// Catalog Service — gộp 3 sub-domain (Category, Brand, Product).
// Sprint 6a triển khai use case cho Category/Brand. Sprint 6b mở rộng Product
// (search, featured, related, CRUD ...).
//
// Cache key:
//   - categories:all (TTL 30 phút)
//   - cache:brands:* (pattern, dùng invalidate)
class CatalogService {
  /**
   * Khởi tạo CatalogService với các dependency được inject từ module.js.
   *
   * @param {object} deps - Các dependency
   * @param {object} deps.catalogRepository - Repository truy cập DB cho catalog
   * @param {object|null} deps.cacheStore - Redis cache store; null nếu Redis không available
   * @param {object} deps.eventBus - Event bus dùng cho giao tiếp giữa modules
   * @param {object} deps.logger - Winston logger
   */
  constructor({ catalogRepository, cacheStore, eventBus, logger }) {
    this.catalogRepository = catalogRepository;
    this.cacheStore = cacheStore;
    this.eventBus = eventBus;
    this.logger = logger;

    // TTL Redis (giây) — mỗi loại dữ liệu có TTL riêng phù hợp với tần suất thay đổi
    this.CACHE_TTL_CATEGORIES = 30 * 60; // 30 phút — categories ít thay đổi
    this.CACHE_TTL_BRANDS = 30 * 60; // 30 phút — brands ít thay đổi
    this.CACHE_TTL_FEATURED = 10 * 60; // 10 phút — featured có thể thay đổi thường hơn
    this.CACHE_TTL_BESTSELLERS = 30 * 60; // 30 phút — best-sellers tính theo tuần/tháng
    this.CACHE_TTL_DEALS = 10 * 60; // 10 phút — deals có thể thay đổi giá bất kỳ lúc
  }

  /**
   * Xóa một cache key cụ thể. Không throw nếu Redis lỗi — chỉ log warning.
   *
   * @param {string} key - Cache key cần xóa
   * @returns {Promise<void>}
   */
  async _invalidateCacheKey(key) {
    if (!this.cacheStore) return;
    try {
      await this.cacheStore.del(key);
    } catch (err) {
      this.logger.warn(`Xóa cache ${key} thất bại:`, err.message);
    }
  }

  /**
   * Xóa tất cả cache keys khớp với pattern glob (ví dụ: `brands:*`).
   * Chỉ hoạt động khi cacheStore hỗ trợ `delPattern` — không throw nếu method không tồn tại.
   *
   * @param {string} pattern - Glob pattern, ví dụ: `products:list:*`
   * @returns {Promise<void>}
   */
  async _invalidateCachePattern(pattern) {
    if (!this.cacheStore || typeof this.cacheStore.delPattern !== 'function') return;
    try {
      await this.cacheStore.delPattern(pattern);
    } catch (err) {
      this.logger.warn(`Xóa cache pattern ${pattern} thất bại:`, err.message);
    }
  }

  // ---------- Category ----------

  /**
   * Lấy danh sách tất cả danh mục có ít nhất 1 sản phẩm, kèm số lượng sản phẩm.
   *
   * Kết quả được cache 30 phút với key `categories:all`.
   * Các danh mục không có sản phẩm nào bị lọc ra khỏi kết quả.
   *
   * @returns {Promise<{status: string, data: object[]}>} Danh sách danh mục với trường `productCount`
   */
  async getAllCategories() {
    const cacheKey = 'categories:all';
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const categories = await this.catalogRepository.findAllCategoriesSorted();
    const countMap = await this.catalogRepository.getCategoryProductCounts();
    const data = categories
      .map((c) => {
        const json = c.toJSON();
        json.productCount = countMap[c.id] || 0;
        return json;
      })
      .filter((c) => c.productCount > 0);

    const payload = { status: 'success', data };
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_CATEGORIES, JSON.stringify(payload));
    }
    return payload;
  }

  /**
   * Lấy cây danh mục dạng raw (không lọc, không cache).
   * Khác với `getAllCategories`: trả về cả danh mục không có sản phẩm,
   * dùng cho admin hoặc navigation tree.
   *
   * @returns {Promise<object[]>} Mảng danh mục đã sắp xếp
   */
  async getCategoryTree() {
    return this.catalogRepository.findAllCategoriesSorted();
  }

  /**
   * Lấy danh mục theo ID số nguyên.
   *
   * @param {object} params
   * @param {number|string} params.id - ID của danh mục
   * @returns {Promise<object>} Danh mục tìm được
   * @throws {AppError} 404 nếu không tìm thấy danh mục
   */
  async getCategoryById({ id }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);
    return category;
  }

  /**
   * Lấy danh mục theo slug URL (ví dụ: `dien-thoai`).
   *
   * @param {object} params
   * @param {string} params.slug - Slug của danh mục
   * @returns {Promise<object>} Danh mục tìm được
   * @throws {AppError} 404 nếu không tìm thấy danh mục
   */
  async getCategoryBySlug({ slug }) {
    const category = await this.catalogRepository.findCategoryByIdOrSlug(slug);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);
    return category;
  }

  /**
   * Tạo danh mục mới. Sau khi tạo, xóa cache `categories:all`.
   *
   * @param {object} params
   * @param {object} params.payload - Dữ liệu danh mục mới
   * @param {string} params.payload.name - Tên danh mục
   * @param {string} [params.payload.description] - Mô tả danh mục
   * @returns {Promise<object>} Danh mục vừa tạo
   */
  async createCategory({ payload }) {
    const category = await this.catalogRepository.createCategory({
      name: payload.name,
      description: payload.description,
    });
    await this._invalidateCacheKey('categories:all');
    return category;
  }

  /**
   * Cập nhật danh mục theo ID. Chỉ cập nhật các trường có trong `patch` (partial update).
   * Sau khi cập nhật, xóa cache `categories:all`.
   *
   * @param {object} params
   * @param {number|string} params.id - ID danh mục cần cập nhật
   * @param {object} params.patch - Dữ liệu cần cập nhật (name, description)
   * @returns {Promise<object>} Danh mục sau khi cập nhật
   * @throws {AppError} 404 nếu không tìm thấy danh mục
   */
  async updateCategory({ id, patch }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);

    if (patch.name !== undefined) category.name = patch.name;
    if (patch.description !== undefined) category.description = patch.description;
    await this.catalogRepository.saveCategory(category);
    await this._invalidateCacheKey('categories:all');
    return category;
  }

  /**
   * Xóa danh mục theo ID. Không cho xóa nếu danh mục đang có sản phẩm.
   *
   * @param {object} params
   * @param {number|string} params.id - ID danh mục cần xóa
   * @returns {Promise<{message: string}>} Thông báo xóa thành công
   * @throws {AppError} 404 nếu không tìm thấy danh mục
   * @throws {AppError} 400 nếu danh mục còn sản phẩm (không được xóa)
   */
  async deleteCategory({ id }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);

    const productCount = await this.catalogRepository.countProductsByCategoryId(id);
    if (productCount > 0) {
      throw new AppError('catalog.cannotDeleteCategoryWithProducts', 400);
    }

    await this.catalogRepository.deleteCategory(category);
    await this._invalidateCacheKey('categories:all');
    return { message: 'catalog.categoryDeleted' };
  }

  /**
   * Lấy danh sách sản phẩm thuộc một danh mục, có phân trang và sắp xếp.
   * Chấp nhận `id` là ID số hoặc slug — thử tìm theo ID trước, nếu không thấy thì tìm theo slug.
   *
   * @param {object} params
   * @param {string|number} params.id - ID hoặc slug của danh mục
   * @param {number} [params.page=1] - Trang hiện tại
   * @param {number} [params.limit=10] - Số sản phẩm mỗi trang
   * @param {string} [params.sort='createdAt'] - Trường sắp xếp
   * @param {string} [params.order='DESC'] - Chiều sắp xếp: 'ASC' hoặc 'DESC'
   * @param {string} [params.status='active'] - Trạng thái sản phẩm cần lọc
   * @returns {Promise<{total: number, pages: number, currentPage: number, products: object[]}>}
   * @throws {AppError} 404 nếu không tìm thấy danh mục
   */
  async getProductsByCategory({
    id,
    page = 1,
    limit = 10,
    sort = 'createdAt',
    order = 'DESC',
    status = 'active',
  }) {
    let category = await this.catalogRepository.findCategoryById(id);
    if (!category) {
      category = await this.catalogRepository.findCategoryBySlug(id);
    }
    if (!category) throw new AppError('catalog.categoryNotFound', 404);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows } = await this.catalogRepository.findProductsByCategoryId(category.id, {
      status,
      sort,
      order,
      limit: lim,
      offset: off,
    });

    const products = rows.map((p) => this._mapProductWithImages(p));
    return {
      total: count,
      pages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10),
      products,
    };
  }

  /**
   * Lấy danh sách danh mục nổi bật. Hiện tại trả về toàn bộ danh mục đã sắp xếp
   * (chưa phân biệt `isFeatured` riêng — dùng chung với `getCategoryTree`).
   *
   * @returns {Promise<object[]>} Mảng danh mục đã sắp xếp
   */
  async getFeaturedCategories() {
    return this.catalogRepository.findAllCategoriesSorted();
  }

  /**
   * Helper: chuyển đổi Sequelize product instance thành plain object,
   * gắn thêm `images`, `thumbnail`, và `price` từ default variant.
   *
   * Dùng cho các endpoint trả về list sản phẩm đơn giản (category/brand products).
   * Nếu có variants → lấy giá từ variant `isDefault=true`, fallback về `variants[0]`.
   *
   * @param {object} product - Sequelize product instance (có include productImages, variants)
   * @returns {object} Plain object với các trường bổ sung: images, thumbnail, price, compareAtPrice
   */
  _mapProductWithImages(product) {
    const json = product.toJSON();

    if (json.productImages) {
      json.images = json.productImages.map((img) => ({
        id: img.id,
        url: img.imageUrl,
        isThumbnail: img.isThumbnail,
        color: img.color,
      }));
      const thumb = json.productImages.find((img) => img.isThumbnail) || json.productImages[0];
      json.thumbnail = thumb ? thumb.imageUrl : null;
    }

    if (json.variants && json.variants.length > 0) {
      const defaultVariant =
        json.variants.find((v) => v.isDefault === true || v.isDefault === 1) || json.variants[0];
      json.price = defaultVariant?.price || json.basePrice;
      json.compareAtPrice = defaultVariant?.compareAtPrice || json.compareAtPrice;
    } else {
      json.price = json.basePrice;
    }

    return json;
  }

  // ---------- Brand ----------

  /**
   * Lấy danh sách thương hiệu, có thể lọc theo danh mục và trạng thái có sản phẩm.
   *
   * Kết quả được cache 30 phút với key `brands:{categoryId|all}`.
   * Nếu truyền `categoryId` dạng slug, service tự resolve sang ID trước khi query.
   *
   * @param {object} params
   * @param {string|number} [params.categoryId] - ID hoặc slug danh mục để lọc brands
   * @param {boolean} [params.hasProducts=true] - Chỉ lấy brands có sản phẩm active
   * @returns {Promise<object[]>} Danh sách thương hiệu
   */
  async getAllBrands({ categoryId, hasProducts = true }) {
    const cacheKey = `brands:${categoryId || 'all'}`;
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const filter = { hasProducts };
    if (categoryId) {
      const isNumericId = !isNaN(categoryId) && String(categoryId).trim() !== '';
      let resolvedCategoryId = categoryId;
      if (!isNumericId) {
        const cat = await this.catalogRepository.findCategoryBySlug(categoryId);
        resolvedCategoryId = cat ? cat.id : -1;
      }
      const brandIds = await this.catalogRepository.findBrandIdsByCategoryId(resolvedCategoryId);
      filter.idIn = brandIds;
      filter.hasProducts = false;
    }
    const data = await this.catalogRepository.findAllBrands({ filter });
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_BRANDS, JSON.stringify(data));
    }
    return data;
  }

  /**
   * Lấy thông tin thương hiệu theo slug URL.
   *
   * @param {object} params
   * @param {string} params.slug - Slug của thương hiệu (ví dụ: `apple`, `samsung`)
   * @returns {Promise<object>} Thông tin thương hiệu
   * @throws {AppError} 404 nếu không tìm thấy thương hiệu
   */
  async getBrandBySlug({ slug }) {
    const brand = await this.catalogRepository.findBrandBySlug(slug);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);
    return brand;
  }

  /**
   * Tạo thương hiệu mới. Sau khi tạo, xóa toàn bộ cache `brands:*`.
   *
   * @param {object} params
   * @param {object} params.payload - Dữ liệu thương hiệu
   * @param {string} params.payload.name - Tên thương hiệu
   * @param {string} [params.payload.logoUrl] - URL logo thương hiệu
   * @returns {Promise<object>} Thương hiệu vừa tạo
   */
  async createBrand({ payload }) {
    const brand = await this.catalogRepository.createBrand({
      name: payload.name,
      logoUrl: payload.logoUrl,
    });
    await this._invalidateCachePattern('brands:*');
    return brand;
  }

  /**
   * Cập nhật thương hiệu theo ID. Dùng `Object.assign` để merge patch vào instance,
   * chỉ cập nhật các trường có trong patch. Sau khi cập nhật, xóa cache `brands:*`.
   *
   * @param {object} params
   * @param {number|string} params.id - ID thương hiệu cần cập nhật
   * @param {object} params.patch - Dữ liệu cần cập nhật (name, logoUrl, ...)
   * @returns {Promise<object>} Thương hiệu sau khi cập nhật
   * @throws {AppError} 404 nếu không tìm thấy thương hiệu
   */
  async updateBrand({ id, patch }) {
    const brand = await this.catalogRepository.findBrandById(id);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);
    Object.assign(brand, patch);
    await this.catalogRepository.saveBrand(brand);
    await this._invalidateCachePattern('brands:*');
    return brand;
  }

  /**
   * Xóa thương hiệu theo ID. Không cho xóa nếu thương hiệu đang có sản phẩm.
   *
   * @param {object} params
   * @param {number|string} params.id - ID thương hiệu cần xóa
   * @returns {Promise<{message: string}>} Thông báo xóa thành công
   * @throws {AppError} 404 nếu không tìm thấy thương hiệu
   * @throws {AppError} 400 nếu thương hiệu còn sản phẩm
   */
  async deleteBrand({ id }) {
    const brand = await this.catalogRepository.findBrandById(id);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);

    const count = await this.catalogRepository.countProductsByBrandId(id);
    if (count > 0) {
      throw new AppError('catalog.cannotDeleteBrandWithProducts', 400);
    }

    await this.catalogRepository.deleteBrand(brand);
    await this._invalidateCachePattern('brands:*');
    return { message: 'catalog.brandDeleted' };
  }

  /**
   * Lấy danh sách sản phẩm của một thương hiệu, có phân trang và sắp xếp.
   *
   * @param {object} params
   * @param {string} params.slug - Slug thương hiệu
   * @param {number} [params.page=1] - Trang hiện tại
   * @param {number} [params.limit=10] - Số sản phẩm mỗi trang
   * @param {string} [params.sort='createdAt'] - Trường sắp xếp
   * @param {string} [params.order='DESC'] - Chiều sắp xếp
   * @returns {Promise<{total: number, pages: number, currentPage: number, products: object[]}>}
   * @throws {AppError} 404 nếu không tìm thấy thương hiệu
   */
  async getProductsByBrand({ slug, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' }) {
    const brand = await this.catalogRepository.findBrandBySlug(slug);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows: products } = await this.catalogRepository.findProductsByBrandId(brand.id, {
      sort,
      order,
      limit: lim,
      offset: off,
    });

    return {
      total: count,
      pages: Math.ceil(count / lim),
      currentPage: parseInt(page, 10),
      products,
    };
  }

  // ---------- Product (Sprint 6b) ----------

  /** Số sản phẩm tối đa lưu trong lịch sử xem gần đây của 1 user */
  RECENTLY_VIEWED_MAX = 20;
  /** TTL cache (giây) cho endpoint danh sách sản phẩm */
  CACHE_TTL_PRODUCT_LIST = 10 * 60;
  /** TTL cache (giây) cho endpoint chi tiết sản phẩm */
  CACHE_TTL_PRODUCT_DETAIL = 10 * 60;

  /**
   * Helper: gắn `images` và `thumbnail` vào plain object product từ `productImages`.
   * Mutate trực tiếp `productJson` và trả về chính nó.
   *
   * Mỗi ảnh trong `images` có: id, url, alt (tên sản phẩm), isThumbnail, variantId, color.
   * `thumbnail` là ảnh có `isThumbnail=true`, fallback về ảnh đầu tiên nếu không có.
   *
   * @param {object} productJson - Plain object đã qua `.toJSON()` (có trường `productImages`)
   * @returns {object} Chính `productJson` sau khi được gắn thêm `images` và `thumbnail`
   */
  _mapProductImages(productJson) {
    if (productJson.productImages && productJson.productImages.length > 0) {
      productJson.images = productJson.productImages.map((img) => ({
        id: img.id,
        url: img.imageUrl,
        // ProductImage model không có cột altText/displayOrder — fallback từ name/id
        alt: productJson.name || '',
        isThumbnail: img.isThumbnail,
        variantId: img.variantId,
        color: img.color,
      }));
      const primaryImage =
        productJson.productImages.find((img) => img.isThumbnail) || productJson.productImages[0];
      productJson.thumbnail = primaryImage.imageUrl;
    } else {
      productJson.images = [];
      productJson.thumbnail = null;
    }
    return productJson;
  }

  /**
   * Helper: tính điểm đánh giá trung bình và số lượng từ mảng review.
   *
   * Khi `onlyVerified=true`, chỉ tính các review có `isVerified=true`.
   * Trả về `average` làm tròn 1 chữ số thập phân.
   *
   * @param {object[]|null} reviews - Mảng review objects (có trường `rating`, `isVerified`)
   * @param {object} [options={}]
   * @param {boolean} [options.onlyVerified=false] - Chỉ tính review đã verified
   * @returns {{average: number, count: number}} Điểm trung bình và số lượng review
   */
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

  /**
   * Helper: chọn giá hiển thị cho sản phẩm — giá variant thấp nhất hoặc basePrice.
   *
   * Với sản phẩm có variant: `basePrice` thường = 0, giá thực là `variants[].price`.
   * Hàm sắp xếp variants theo giá tăng dần và lấy giá thấp nhất khác 0.
   * Fallback về `basePrice` nếu không có variant hoặc giá thấp nhất = 0.
   *
   * @param {object} productJson - Plain object product (có trường `variants`, `basePrice`)
   * @returns {number} Giá hiển thị (đơn vị: VNĐ)
   */
  _pickDisplayPrice(productJson) {
    const basePrice = parseFloat(productJson.basePrice) || 0;
    if (productJson.variants && productJson.variants.length > 0) {
      const sorted = [...productJson.variants].sort(
        (a, b) => parseFloat(a.price) - parseFloat(b.price),
      );
      const lowestPrice = parseFloat(sorted[0].price);
      return lowestPrice !== 0 && lowestPrice ? lowestPrice : basePrice;
    }
    return basePrice;
  }

  /**
   * Xóa toàn bộ cache liên quan đến product sau khi create/update/delete.
   *
   * Xóa các pattern sau (nếu Redis hỗ trợ `delPattern`):
   *   - `products:list:*`     — cache danh sách sản phẩm (tất cả filter combos)
   *   - `products:featured:*` — cache trang featured
   *   - `products:bestsellers:*` — cache best-sellers (các period/limit khác nhau)
   *   - `products:deals:*`    — cache trang deals
   *   - `chatbot:*`           — chatbot cache có thể reference tên/giá sản phẩm
   * Ngoài ra xóa `product:detail:{id}` và `product:detail:{slug}` nếu có.
   *
   * @param {number|null} productId - ID sản phẩm (null khi tạo mới)
   * @param {string} [productSlug] - Slug sản phẩm (để xóa detail cache theo slug)
   * @returns {Promise<void>}
   */
  async _clearProductCache(productId, productSlug) {
    if (!this.cacheStore || typeof this.cacheStore.delMany !== 'function') return;
    const keys = [];
    if (this.cacheStore.delPattern) {
      try {
        await this.cacheStore.delPattern('products:list:*');
        await this.cacheStore.delPattern('products:featured:*');
        await this.cacheStore.delPattern('products:bestsellers:*');
        await this.cacheStore.delPattern('products:deals:*');
        await this.cacheStore.delPattern('chatbot:*');
      } catch (err) {
        this.logger.warn('clearProductCache pattern thất bại:', err.message);
      }
    }
    if (productId) keys.push(`product:detail:${productId}`);
    if (productSlug) keys.push(`product:detail:${productSlug}`);
    for (const k of keys) {
      try {
        await this.cacheStore.del(k);
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Lấy danh sách sản phẩm có phân trang, lọc đa tiêu chí và cache theo URL.
   *
   * **Filter options:**
   *   - `category`: slug hoặc numeric ID — service tự resolve slug sang ID trước khi query.
   *     Nếu truyền slug không tồn tại → kết quả trả về rỗng (sentinel flag).
   *   - `brand`: string hoặc mảng string, mix giữa slug và numeric ID — service phân loại
   *     và resolve riêng. Hai resolve chạy song song với `Promise.all` để giảm latency.
   *   - `inStock`: lọc chỉ sản phẩm còn hàng (dùng subquery trên `product_variants`)
   *   - `featured`: lọc sản phẩm `isFeatured=true`
   *   - `minPrice`/`maxPrice`: khoảng giá
   *   - `search`: full-text search trên tên sản phẩm
   *   - `status`: trạng thái sản phẩm (`active`, `inactive`, ...)
   *   - `sortBy`: sắp xếp theo `price` dùng `COALESCE(MIN(variant.price), base_price)` (rule cứng)
   *
   * **Cache:** key = `products:list:{cacheUrl}` (TTL 10 phút). Nếu `cacheUrl` không truyền,
   * không cache (thường xảy ra với filter lạ hoặc search).
   *
   * @param {object} params
   * @param {number} [params.page=1] - Trang hiện tại
   * @param {string} [params.sort='createdAt'] - Trường sắp xếp
   * @param {string} [params.order='DESC'] - Chiều sắp xếp
   * @param {string|number} [params.category] - Slug hoặc ID danh mục để lọc
   * @param {string} [params.search] - Từ khoá tìm kiếm
   * @param {number} [params.minPrice] - Giá tối thiểu (VNĐ)
   * @param {number} [params.maxPrice] - Giá tối đa (VNĐ)
   * @param {boolean} [params.inStock] - Chỉ lấy sản phẩm còn hàng
   * @param {boolean} [params.featured] - Chỉ lấy sản phẩm nổi bật
   * @param {string} [params.status] - Trạng thái sản phẩm
   * @param {string|string[]} [params.brand] - Slug hoặc ID thương hiệu (có thể là mảng)
   * @param {number} [params.limit] - Số sản phẩm mỗi trang (tối đa 100, mặc định 20)
   * @param {string} [params.cacheUrl] - URL đầy đủ dùng làm cache key (query string included)
   * @returns {Promise<{payload: object, cacheHit: boolean}>}
   *   `payload` gồm: `status`, `data` (mảng sản phẩm), `total`, `page`, `limit`
   */
  async getAllProducts({
    page = 1,
    sort = 'createdAt',
    order = 'DESC',
    category,
    search,
    minPrice,
    maxPrice,
    inStock,
    featured,
    status,
    brand,
    limit,
    cacheUrl,
  }) {
    const lim = Math.min(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, MAX_QUERY_LIMIT);
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
    // Sentinel: slug hợp lệ nhưng không tồn tại trong DB → query trả về rỗng thay vì bỏ filter
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

    // Resolve brand: tách array → numeric IDs vs slugs
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

    const { count, rows: productsRaw } = await this.catalogRepository.findProductsList({
      filter,
      sort,
      order,
      limit: lim,
      offset: off,
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

  /**
   * Lấy chi tiết sản phẩm theo ID, kèm variant resolution và track recently-viewed.
   *
   * Nếu `id` không tìm thấy theo ID số, thử tìm lại theo slug (backward compatibility).
   * Cache detail với key `product:detail:{id}` (TTL 10 phút), chỉ cache khi request
   * không có `skuId`/`queryColor` vì các request này trả kết quả khác nhau.
   *
   * Sau khi tìm thấy sản phẩm, gọi `_trackRecentlyViewed` fire-and-forget (không block response).
   *
   * @param {object} params
   * @param {string|number} params.id - ID hoặc slug sản phẩm
   * @param {string|number} [params.skuId] - ID variant cụ thể cần chọn sẵn
   * @param {string} [params.queryColor] - Màu sắc để chọn variant (từ query string `?color=...`)
   * @param {number|null} [params.userId] - ID user đang xem (để track recently-viewed)
   * @returns {Promise<{payload: object, cacheHit: boolean}>}
   *   `payload` gồm: `status`, `data` (chi tiết sản phẩm với variant đã chọn)
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm
   */
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
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const responseData = this._buildProductDetailResponse(product, { skuId, queryColor });
    const payload = { status: 'success', data: responseData };

    if (userId) {
      this._trackRecentlyViewed(userId, product.id).catch((err) => {
        this.logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      });
    }

    if (detailCacheKey && this.cacheStore) {
      await this.cacheStore.setEx(
        detailCacheKey,
        this.CACHE_TTL_PRODUCT_DETAIL,
        JSON.stringify(payload),
      );
    }
    return { payload, cacheHit: false };
  }

  /**
   * Lấy chi tiết sản phẩm theo slug URL, kèm variant resolution và track recently-viewed.
   *
   * Khác với `getProductById`: không có cache và không thử fallback sang ID.
   * Track recently-viewed fire-and-forget nếu có `userId`.
   *
   * @param {object} params
   * @param {string} params.slug - Slug URL của sản phẩm
   * @param {string|number} [params.skuId] - ID variant cụ thể cần chọn sẵn
   * @param {string} [params.queryColor] - Màu sắc để chọn variant
   * @param {number|null} [params.userId] - ID user đang xem
   * @returns {Promise<object>} Chi tiết sản phẩm với variant đã chọn
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm
   */
  async getProductBySlug({ slug, skuId, queryColor, userId }) {
    const product = await this.catalogRepository.findProductBySlugWithFullDetails(slug);
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const responseData = this._buildProductDetailResponse(product, { skuId, queryColor });

    if (userId) {
      this._trackRecentlyViewed(userId, product.id).catch((err) => {
        this.logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      });
    }

    return responseData;
  }

  /**
   * Xây dựng response chi tiết sản phẩm, bao gồm 4 bước:
   *
   * **Bước 1 — Tính ratings:** Lấy điểm trung bình từ verified reviews,
   *   kèm `totalCount` là tổng số review (cả unverified).
   *
   * **Bước 2 — Chọn variant (fallback chain 4 cấp):**
   *   1. Nếu có `skuId` → tìm variant theo ID chính xác
   *   2. Nếu có `queryColor` → so sánh với `attributes.color` / `attributes['Màu sắc']`
   *      sau khi normalize Unicode NFC và lowercase (xem giải thích bên dưới)
   *   3. Fallback → variant có `isDefault=true`
   *   4. Fallback cuối → `variants[0]` (luôn non-null nếu mảng không rỗng)
   *
   * **Bước 3 — Lọc ảnh theo variant (`_filterImagesByVariant` logic nội tuyến):**
   *   - Nếu có `skuId`: ưu tiên lọc theo `variantId`, nếu không có → lọc theo màu
   *   - Nếu chỉ có màu: lọc theo color của variant đã chọn
   *   - Nếu không match ảnh nào: dùng toàn bộ ảnh sản phẩm làm fallback
   *
   * **Bước 4 — Ghép tên đầy đủ (`_buildFullProductName` logic nội tuyến):**
   *   Nếu `variantName` đã chứa tên sản phẩm hoặc tên model → dùng `variantName` trực tiếp.
   *   Ngược lại → ghép `"{tên sản phẩm} - {variantName}"`.
   *
   * **Tại sao cần Unicode NFC normalize:**
   *   Chữ có dấu tiếng Việt (ví dụ: "Đỏ") có thể được lưu theo 2 cách trong Unicode:
   *   precomposed (1 code point) và decomposed (2 code points: ký tự + combining mark).
   *   `.normalize('NFC')` chuyển về dạng precomposed để so sánh `===` cho đúng.
   *
   * @param {object} product - Sequelize product instance (từ findProductByIdWithFullDetails)
   * @param {object} query
   * @param {string|number} [query.skuId] - ID variant muốn chọn
   * @param {string} [query.queryColor] - Màu sắc để chọn variant
   * @returns {object} Plain object chi tiết sản phẩm với các trường bổ sung:
   *   `ratings`, `isVariantProduct`, `currentVariant`, `availableVariants`,
   *   `price`, `compareAtPrice`, `sku`, `stockQuantity`, `images`, `thumbnail`, `specifications`
   */
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
      compareAtPrice: productJson.compareAtPrice ? parseFloat(productJson.compareAtPrice) : null,
    };

    if (productJson.variants && productJson.variants.length > 0) {
      // Normalize màu sắc từ query string để so sánh chuẩn Unicode
      const normColor = queryColor?.toString().normalize('NFC').toLowerCase().trim();
      let selectedVariant = null;

      // Bước 2a: chọn variant theo skuId (ID chính xác)
      if (skuId) {
        selectedVariant = productJson.variants.find((v) => String(v.id) === String(skuId));
      }
      // Bước 2b: chọn variant theo màu sắc (NFC normalized)
      if (!selectedVariant && normColor) {
        selectedVariant = productJson.variants.find((v) => {
          const vAttrs = v.attributes || {};
          const vColorRaw = vAttrs.color ?? vAttrs['Màu sắc'] ?? vAttrs['màu sắc'];
          const vColor = vColorRaw?.toString().normalize('NFC').toLowerCase().trim();
          return vColor === normColor;
        });
      }
      // Bước 2c+2d: fallback về isDefault hoặc variants[0]
      if (!selectedVariant) {
        selectedVariant =
          productJson.variants.find((v) => v.isDefault === true || v.isDefault === 1) ??
          productJson.variants[0];
      }

      // selectedVariant luôn non-null ở đây (fallback về variants[0] ở trên)
      {
        const attrs = selectedVariant.attributes || {};
        const variantColorRaw = attrs.color ?? attrs['Màu sắc'] ?? attrs['màu sắc'];
        let variantColor = variantColorRaw?.toString().normalize('NFC').toLowerCase().trim();
        if (!skuId && normColor) variantColor = normColor;

        // Bước 3: lọc ảnh theo variant
        let variantImages = productJson.images; // _mapProductImages luôn set images
        if (skuId && selectedVariant) {
          const matchByVariantId = variantImages.filter(
            (img) => img.variantId === selectedVariant.id,
          );
          if (matchByVariantId.length > 0) variantImages = matchByVariantId;
          else if (variantColor) {
            variantImages = variantImages.filter(
              (img) => img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor,
            );
          }
        } else if (variantColor) {
          const matchByColor = variantImages.filter(
            (img) => img.color?.toString().normalize('NFC').toLowerCase().trim() === variantColor,
          );
          if (matchByColor.length > 0) variantImages = matchByColor;
        }

        // Bước 4: ghép tên đầy đủ
        const variantName = selectedVariant.variantName || selectedVariant.displayName;
        const mainName = productJson.name;
        // Lấy model name: bỏ prefix loại thiết bị (Laptop, Điện thoại, ...) khỏi tên sản phẩm
        const modelName =
          productJson.model ||
          mainName.replace(
            /^(Laptop|Điện thoại|Máy tính bảng|Đồng hồ|Tai nghe|Loa|Phụ kiện)\s+/i,
            '',
          );
        // Nếu variantName đã chứa tên sản phẩm/model → không ghép thêm (tránh lặp)
        const fullName =
          variantName.toLowerCase().includes(mainName.toLowerCase()) ||
          variantName.toLowerCase().includes(modelName.toLowerCase())
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
          // Merge spec chung của sản phẩm với attributes của variant đã chọn
          specifications: { ...productJson.specifications, ...selectedVariant.attributes },
        };
      }
    }

    return responseData;
  }

  /**
   * Ghi lại rằng user vừa xem sản phẩm vào bảng `recently_viewed`.
   * Sau khi upsert, xóa bớt các entry cũ để tối đa `RECENTLY_VIEWED_MAX` entries mỗi user.
   *
   * Hàm này luôn được gọi fire-and-forget (`.catch(() => {})`) — lỗi không ảnh hưởng response.
   *
   * @param {number} userId - ID user
   * @param {number} productId - ID sản phẩm vừa xem
   * @returns {Promise<void>}
   */
  async _trackRecentlyViewed(userId, productId) {
    await this.catalogRepository.upsertRecentlyViewed(userId, productId);
    await this.catalogRepository.pruneRecentlyViewed(userId, this.RECENTLY_VIEWED_MAX);
  }

  /**
   * Lấy danh sách sản phẩm nổi bật (`isFeatured=true`), có cache.
   *
   * Cache key: `products:featured:{limit}` (TTL 10 phút).
   *
   * @param {object} params
   * @param {number} [params.limit=8] - Số sản phẩm tối đa trả về
   * @returns {Promise<object[]>} Mảng sản phẩm với: images, thumbnail, price, ratings
   */
  async getFeaturedProducts({ limit = DEFAULT_LIST_LIMIT }) {
    const cacheKey = `products:featured:${limit}`;
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
    const productsRaw = await this.catalogRepository.findFeaturedProducts(parseInt(limit, 10));
    const data = productsRaw.map((p) => this._mapProductForList(p));
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_FEATURED, JSON.stringify(data));
    }
    return data;
  }

  /**
   * Helper: chuyển đổi Sequelize product instance thành plain object phù hợp
   * cho các endpoint list (featured, new-arrivals, related, recently-viewed).
   *
   * Áp dụng: `_mapProductImages`, `_calcRatings`, `_pickDisplayPrice`.
   * Xóa trường `reviews` ra khỏi kết quả (không cần thiết ở list view).
   *
   * @param {object} product - Sequelize product instance
   * @returns {object} Plain object với: images, thumbnail, price, compareAtPrice, ratings
   */
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

  /**
   * Lấy danh sách sản phẩm liên quan đến một sản phẩm (cùng danh mục).
   *
   * Nếu không tìm được sản phẩm cùng danh mục (ví dụ: sản phẩm không thuộc danh mục nào),
   * fallback về các sản phẩm mới nhất active.
   *
   * @param {object} params
   * @param {number|string} params.id - ID sản phẩm gốc
   * @param {number} [params.limit=4] - Số sản phẩm liên quan tối đa
   * @returns {Promise<object[]>} Mảng sản phẩm liên quan với: images, thumbnail, ratings
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm gốc
   */
  async getRelatedProducts({ id, limit = 4 }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const lim = parseInt(limit, 10);
    let related = [];
    if (product.categoryId) {
      related = await this.catalogRepository.findRelatedProducts(id, lim);
    }
    if (related.length === 0) {
      this.logger.info(
        `Không tìm thấy sản phẩm liên quan cho sản phẩm ${id}. Trả về sản phẩm gần đây thay thế.`,
      );
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

  /**
   * Tìm kiếm sản phẩm theo từ khoá, có phân trang.
   * Tìm kiếm LIKE trên: `name_vi`, `name_en`, `description_vi`, `short_description_vi`, `tags`.
   *
   * @param {object} params
   * @param {string} params.q - Từ khoá tìm kiếm (bắt buộc)
   * @param {number} [params.page=1] - Trang hiện tại
   * @param {number} [params.limit=10] - Số kết quả mỗi trang
   * @returns {Promise<{data: object[], total: number, page: number, limit: number}>}
   * @throws {AppError} 400 nếu không truyền từ khoá
   */
  async searchProducts({ q, page = 1, limit = 10 }) {
    if (!q) throw new AppError('catalog.searchKeywordRequired', 400);

    const lim = parseInt(limit, 10);
    const off = (parseInt(page, 10) - 1) * lim;

    const { count, rows: productsRaw } = await this.catalogRepository.searchProducts({
      q,
      limit: lim,
      offset: off,
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

  /**
   * Lấy danh sách gợi ý tên sản phẩm cho autocomplete (prefix match).
   * Trả về tối đa `MAX_SUGGESTIONS` (10) kết quả, mỗi kết quả chỉ gồm: id, name, slug, thumbnail.
   * Trả về mảng rỗng nếu query rỗng.
   *
   * @param {object} params
   * @param {string} params.q - Chuỗi prefix cần gợi ý (ít nhất 1 ký tự)
   * @returns {Promise<{id: number, name: string, slug: string, thumbnail: string|null}[]>}
   */
  async getProductSuggestions({ q }) {
    if (!q || q.trim().length < 1) return [];

    const products = await this.catalogRepository.findProductSuggestions(q.trim(), MAX_SUGGESTIONS);
    return products.map((p) => {
      const json = p.toJSON();
      const primaryImage =
        json.productImages?.find((img) => img.isThumbnail) || json.productImages?.[0];
      return {
        id: json.id,
        name: json.name,
        slug: json.slug,
        thumbnail: primaryImage?.imageUrl || null,
      };
    });
  }

  /**
   * Lấy danh sách sản phẩm mới nhất (sắp xếp theo `createdAt DESC`), không cache.
   *
   * @param {object} params
   * @param {number} [params.limit=8] - Số sản phẩm tối đa trả về
   * @returns {Promise<object[]>} Mảng sản phẩm với: images, thumbnail, price, ratings
   */
  async getNewArrivals({ limit = DEFAULT_LIST_LIMIT }) {
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

  /**
   * Lấy danh sách sản phẩm bán chạy trong khoảng thời gian nhất định, có cache.
   *
   * Thuật toán: JOIN `order_items` + `orders` (lọc không cancelled), GROUP BY product,
   * ORDER BY tổng số lượng bán. Kết quả raw từ SQL (plain objects, không phải Sequelize instances)
   * được fetch lại bằng `findProductsByIdsOrdered` để có đầy đủ associations.
   *
   * Cache key: `products:bestsellers:{period}:{limit}` (TTL 30 phút).
   * Fallback về `getNewArrivals` nếu không có đơn hàng nào trong khoảng thời gian.
   *
   * @param {object} params
   * @param {number} [params.limit=10] - Số sản phẩm tối đa trả về
   * @param {'week'|'month'|'year'} [params.period='month'] - Khoảng thời gian thống kê
   * @returns {Promise<object[]>} Mảng sản phẩm bán chạy với: images, thumbnail, price
   */
  async getBestSellers({ limit = DEFAULT_BESTSELLERS_LIMIT, period = 'month' }) {
    const cacheKey = `products:bestsellers:${period}:${limit}`;
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
    const now = new Date();
    let startDate;
    switch (period) {
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
    }

    const lim = parseInt(limit, 10);
    const bestSellers = await this.catalogRepository.findBestSellersRaw({ startDate, limit: lim });

    if (bestSellers.length === 0) {
      // Không có đơn hàng trong khoảng thời gian → fallback về sản phẩm mới nhất
      return this.getNewArrivals({ limit: lim });
    }

    const ids = bestSellers.map((p) => p.id);
    const productsRaw = await this.catalogRepository.findProductsByIdsOrdered(ids);

    const data = productsRaw.map((product) => {
      const json = product.toJSON();
      json.price = json.basePrice;
      this._mapProductImages(json);
      delete json.productImages;
      return json;
    });
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_BESTSELLERS, JSON.stringify(data));
    }
    return data;
  }

  /**
   * Lấy danh sách sản phẩm đang giảm giá, có cache.
   *
   * Điều kiện: `compareAtPrice IS NOT NULL` và phần trăm giảm giá >= `minDiscount`.
   * Phần trăm giảm = `(compareAtPrice - basePrice) / compareAtPrice * 100`.
   *
   * Lưu ý: query dùng `subQuery: false` vì MySQL yêu cầu để sort theo computed column
   * (literal expression) — không được xóa flag này.
   *
   * Cache key: `products:deals:{minDiscount}:{sort}:{limit}` (TTL 10 phút).
   *
   * @param {object} params
   * @param {number} [params.limit] - Số sản phẩm tối đa (mặc định 12, tối đa 100)
   * @param {number} [params.minDiscount] - Phần trăm giảm giá tối thiểu (mặc định 5%)
   * @param {string} [params.sort='discount_desc'] - Kiểu sắp xếp
   * @returns {Promise<object[]>} Mảng sản phẩm giảm giá với trường bổ sung `discountPercentage`
   */
  async getDeals({ limit, minDiscount, sort = 'discount_desc' }) {
    const parsedLimit = Math.min(parseInt(limit, 10) || DEFAULT_DEALS_LIMIT, MAX_QUERY_LIMIT);
    const parsedMinDiscount = parseFloat(minDiscount) || DEFAULT_MIN_DISCOUNT_PERCENT;
    const cacheKey = `products:deals:${parsedMinDiscount}:${sort}:${parsedLimit}`;
    if (this.cacheStore) {
      const cached = await this.cacheStore.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const products = await this.catalogRepository.findDeals({
      minDiscount: parsedMinDiscount,
      sort,
      limit: parsedLimit,
    });

    const data = products.map((product) => {
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
    if (this.cacheStore) {
      await this.cacheStore.setEx(cacheKey, this.CACHE_TTL_DEALS, JSON.stringify(data));
    }
    return data;
  }

  /**
   * Lấy danh sách tất cả biến thể (variants) của một sản phẩm.
   *
   * @param {object} params
   * @param {number|string} params.id - ID sản phẩm
   * @returns {Promise<{variants: object[]}>} Mảng variants của sản phẩm
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm
   */
  async getProductVariants({ id }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const variants = await this.catalogRepository.findProductVariantsByProductId(id);
    return { variants };
  }

  /**
   * Lấy tổng hợp đánh giá (rating summary) của một sản phẩm.
   *
   * Trả về: điểm trung bình, tổng số review, và phân bổ từng sao (1-5).
   *
   * @param {object} params
   * @param {number|string} params.id - ID sản phẩm
   * @returns {Promise<{average: number, count: number, distribution: {1: number, 2: number, 3: number, 4: number, 5: number}}>}
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm
   */
  async getProductReviewsSummary({ id }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const reviews = await this.catalogRepository.findProductRatingsRows(id);
    const count = reviews.length;
    const average = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribution[r.rating]++;
    });

    return { average, count, distribution };
  }

  /**
   * Lấy các tùy chọn filter cho trang danh sách sản phẩm, optionally theo danh mục.
   *
   * Trả về:
   *   - `priceRange`: { min, max } — khoảng giá của sản phẩm trong danh mục
   *   - `brands`: mảng tên thương hiệu duy nhất
   *   - `colors`: mảng màu sắc duy nhất
   *   - `sizes`: mảng kích cỡ duy nhất
   *   - `attributes`: mảng { name, values[] } cho các thuộc tính khác (RAM, storage, ...)
   *
   * Bốn query attribute (brands, colors, sizes, others) chạy song song với `Promise.all`
   * để giảm total latency.
   *
   * Nếu `categoryId` là slug → resolve sang ID trước khi query.
   * Nếu slug không tồn tại → trả về filter của toàn bộ sản phẩm (categoryId = null).
   *
   * @param {object} params
   * @param {string|number} [params.categoryId] - ID hoặc slug danh mục để lọc filter options
   * @returns {Promise<{priceRange: object, brands: string[], colors: string[], sizes: string[], attributes: object[]}>}
   * @throws {AppError} 400 nếu `categoryId` không phải số nguyên cũng không phải slug hợp lệ
   */
  async getProductFilters({ categoryId }) {
    let actualCategoryId = null;
    if (categoryId) {
      const isStrictInt = /^\d+$/.test(String(categoryId).trim());
      const isSlug = /^[a-z0-9-]+$/.test(String(categoryId).trim());
      if (!isStrictInt && !isSlug) {
        throw new AppError('catalog.invalidCategoryId', 400);
      }
      if (isStrictInt) actualCategoryId = parseInt(categoryId, 10);
      else {
        const category = await this.catalogRepository.findCategoryBySlug(categoryId);
        if (category) actualCategoryId = category.id;
      }
    }

    const priceRange = await this.catalogRepository.getProductPriceRange({
      categoryId: actualCategoryId,
    });

    // Chạy song song 4 query attribute để tối ưu latency
    const [brands, colors, sizes, others] = await Promise.all([
      this.catalogRepository.findAttributeValuesByName('brand', { categoryId: actualCategoryId }),
      this.catalogRepository.findAttributeValuesByName('color', { categoryId: actualCategoryId }),
      this.catalogRepository.findAttributeValuesByName('size', { categoryId: actualCategoryId }),
      this.catalogRepository.findOtherAttributes({ categoryId: actualCategoryId }),
    ]);

    // Gom tất cả values từ nhiều rows thành 1 Set (loại trùng)
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

  /**
   * Lấy danh sách sản phẩm đã xem gần đây của một user, sắp xếp theo thời gian xem mới nhất.
   *
   * Tối đa `RECENTLY_VIEWED_MAX` (20) entries. Mỗi entry có thêm trường `viewedAt`.
   * Dùng `_pickDisplayPrice` để lấy giá đúng — tránh trả `basePrice=0` cho sản phẩm có variant.
   *
   * @param {object} params
   * @param {number} params.userId - ID user cần lấy lịch sử
   * @param {number} [params.limit=10] - Số sản phẩm tối đa trả về
   * @returns {Promise<object[]>} Mảng sản phẩm với: images, thumbnail, price, ratings, viewedAt
   */
  async getRecentlyViewed({ userId, limit = 10 }) {
    const recentlyViewed = await this.catalogRepository.findRecentlyViewedByUser(
      userId,
      parseInt(limit, 10),
    );
    return recentlyViewed.map((rv) => {
      const product = rv.Product;
      const json = product.toJSON();
      this._mapProductImages(json);
      delete json.productImages;
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      // Dùng _pickDisplayPrice để lấy giá đúng từ variant (tránh trả base_price=0 cho variant product)
      const displayPrice = this._pickDisplayPrice(json);
      const compareAtPrice = parseFloat(json.compareAtPrice) || null;
      return { ...json, price: displayPrice, compareAtPrice, ratings, viewedAt: rv.viewedAt };
    });
  }

  /**
   * Tạo sản phẩm mới cùng tất cả các entity liên quan trong một transaction duy nhất.
   *
   * **6 entity được tạo trong cùng transaction:**
   * 1. **Product** — bản ghi chính (basePrice=0 nếu là variant product, vì giá thực nằm ở variants)
   * 2. **Categories** — gắn nhiều-nhiều qua `product_categories` (validate tất cả IDs tồn tại)
   * 3. **ProductSpecifications** — thông số kỹ thuật dạng bảng (tên, giá trị, nhóm, thứ tự)
   * 4. **ProductAttributes** — thuộc tính filter (màu, size, RAM, ...) — từ `parentAttributes` hoặc `attributes`
   * 5. **ProductVariants** — các biến thể (SKU, giá, stock, attributes, ...) — auto-generate SKU nếu không truyền
   * 6. **WarrantyPackages** — gói bảo hành được gắn kèm sản phẩm (validate tất cả IDs tồn tại)
   *
   * Nếu bất kỳ bước nào fail → toàn bộ transaction rollback, không có entity nào được tạo.
   * Sau khi commit → fetch lại product với full associations để trả về.
   * Sau khi trả về → xóa cache `products:list:*` và các patterns liên quan.
   *
   * @param {object} params
   * @param {object} params.payload - Dữ liệu sản phẩm mới
   * @param {string} params.payload.name - Tên sản phẩm
   * @param {string} [params.payload.baseName] - Tên base (không có attributes) — fallback về `name`
   * @param {string} [params.payload.description] - Mô tả đầy đủ
   * @param {string} [params.payload.shortDescription] - Mô tả ngắn
   * @param {number} [params.payload.price] - Giá bán (chỉ dùng khi không có variants)
   * @param {number} [params.payload.compareAtPrice] - Giá gốc để tính % giảm
   * @param {number} [params.payload.stockQuantity] - Tồn kho (chỉ dùng khi không có variants)
   * @param {boolean} [params.payload.featured] - Đánh dấu sản phẩm nổi bật
   * @param {string[]} [params.payload.tags] - Tags SEO
   * @param {number[]} [params.payload.categoryIds] - Danh sách ID danh mục
   * @param {object[]} [params.payload.specifications] - Thông số kỹ thuật [{name, value, category, sortOrder}]
   * @param {object[]} [params.payload.parentAttributes] - Thuộc tính cha [{name, type, values, required}]
   * @param {object[]} [params.payload.attributes] - Thuộc tính trực tiếp [{name, type, values, ...}]
   * @param {object[]} [params.payload.variants] - Biến thể [{sku, name, price, stockQuantity, attributes, ...}]
   * @param {number[]} [params.payload.warrantyPackageIds] - Danh sách ID gói bảo hành
   * @returns {Promise<object>} Sản phẩm vừa tạo với full associations
   * @throws {AppError} 400 nếu có `categoryIds` không tồn tại trong DB
   * @throws {AppError} 400 nếu có `warrantyPackageIds` không tồn tại trong DB
   */
  async createProduct({ payload }) {
    const isVariantProduct = Boolean(payload.variants && payload.variants.length > 0);
    let createdProduct;

    await this.catalogRepository.runInTransaction(async (transaction) => {
      const product = await this.catalogRepository.createProduct(
        {
          name: payload.name,
          baseName: payload.baseName || payload.name,
          description: payload.description,
          shortDescription: payload.shortDescription,
          basePrice: isVariantProduct ? 0 : payload.price,
          compareAtPrice: isVariantProduct ? null : payload.compareAtPrice,
          images: payload.images || [],
          stockQuantity: isVariantProduct ? 0 : payload.stockQuantity,
          isFeatured: payload.featured,
          tags: payload.tags || [],
          seoTitle: payload.seoTitle,
          seoDescription: payload.seoDescription,
          seoKeywords: payload.seoKeywords || [],
          isVariantProduct,
          specifications: payload.specifications || {},
        },
        { transaction },
      );

      if (payload.categoryIds && payload.categoryIds.length > 0) {
        const categories = await this.catalogRepository.findCategoriesByIds(payload.categoryIds);
        if (categories.length !== payload.categoryIds.length) {
          throw new AppError('catalog.categoriesNotExist', 400);
        }
        await this.catalogRepository.setProductCategories(product, categories, { transaction });
      }

      if (
        payload.specifications &&
        Array.isArray(payload.specifications) &&
        payload.specifications.length > 0
      ) {
        const rows = payload.specifications.map((spec, i) => ({
          productId: product.id,
          name: spec.name,
          value: spec.value,
          category: spec.category || 'General',
          sortOrder: i,
        }));
        await this.catalogRepository.createProductSpecifications(rows, { transaction });
      }

      if (payload.parentAttributes && payload.parentAttributes.length > 0) {
        const rows = payload.parentAttributes.map((attr, i) => ({
          productId: product.id,
          name: attr.name,
          type: attr.type,
          values: attr.values,
          required: attr.required,
          sortOrder: i,
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
          name: v.name ?? v.variantName ?? v.displayName,
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
        const warranties = await this.catalogRepository.findWarrantyPackagesByIds(
          payload.warrantyPackageIds,
        );
        if (warranties.length !== payload.warrantyPackageIds.length) {
          throw new AppError('catalog.warrantyPackagesNotExist', 400);
        }
        await this.catalogRepository.setProductWarrantyPackages(product, warranties, {
          transaction,
        });
      }

      createdProduct = product;
    });

    const fullProduct = await this.catalogRepository.findProductByIdWithFullDetails(
      createdProduct.id,
    );
    await this._clearProductCache(null);
    return fullProduct;
  }

  /**
   * Cập nhật sản phẩm theo ID. Hỗ trợ partial update — chỉ những trường có trong `patch` mới được thay đổi.
   *
   * **Các trường scalar hỗ trợ partial update:**
   *   name, description, shortDescription, price, compareAtPrice, images, stockQuantity,
   *   featured (map sang `isFeatured`), tags, seoTitle, seoDescription, seoKeywords
   *
   * **Các quan hệ replace-all (nếu có trong patch):**
   *   - `categoryIds`: xóa hết rồi gắn lại toàn bộ (validate IDs tồn tại)
   *   - `attributes`: xóa hết rồi tạo lại
   *   - `variants`: xóa hết rồi tạo lại
   *   - `warrantyPackageIds`: xóa hết rồi gắn lại (truyền mảng rỗng → xóa hết)
   *
   * Toàn bộ thao tác trong 1 transaction. Sau khi commit:
   *   - Fetch lại product với full associations để trả về
   *   - Xóa cache `product:detail:{id}`, `product:detail:{slug}`, và các list/featured/deals patterns
   *
   * @param {object} params
   * @param {number|string} params.id - ID sản phẩm cần cập nhật
   * @param {object} params.patch - Dữ liệu cần cập nhật (chỉ trường nào truyền vào mới update)
   * @returns {Promise<object>} Sản phẩm sau khi cập nhật với full associations
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm
   * @throws {AppError} 400 nếu `categoryIds` hoặc `warrantyPackageIds` chứa ID không tồn tại
   */
  async updateProduct({ id, patch }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const originalSlug = product.slug;

    await this.catalogRepository.runInTransaction(async (transaction) => {
      const updateData = {};
      const setIfPresent = (key, value) => {
        if (Object.prototype.hasOwnProperty.call(patch, key))
          updateData[key === 'featured' ? 'isFeatured' : key] = value;
      };
      setIfPresent('name', patch.name);
      setIfPresent('description', patch.description);
      setIfPresent('shortDescription', patch.shortDescription);
      setIfPresent('price', patch.price);
      setIfPresent('compareAtPrice', patch.compareAtPrice);
      setIfPresent('images', patch.images);
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
          throw new AppError('catalog.categoriesNotExist', 400);
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
          const warranties = await this.catalogRepository.findWarrantyPackagesByIds(
            patch.warrantyPackageIds,
          );
          if (warranties.length !== patch.warrantyPackageIds.length) {
            throw new AppError('catalog.warrantyPackagesNotExist', 400);
          }
          await this.catalogRepository.setProductWarrantyPackages(product, warranties, {
            transaction,
          });
        } else {
          await this.catalogRepository.setProductWarrantyPackages(product, [], { transaction });
        }
      }
    });

    const updatedProduct = await this.catalogRepository.findProductByIdWithFullDetails(id);
    await this._clearProductCache(id, originalSlug);
    return updatedProduct;
  }

  /**
   * Xóa sản phẩm theo ID. Sau khi xóa, xóa cache liên quan.
   *
   * @param {object} params
   * @param {number|string} params.id - ID sản phẩm cần xóa
   * @returns {Promise<{message: string}>} Thông báo xóa thành công
   * @throws {AppError} 404 nếu không tìm thấy sản phẩm
   */
  async deleteProduct({ id }) {
    const product = await this.catalogRepository.findProductByPk(id);
    if (!product) throw new AppError('catalog.productNotFound', 404);

    const productSlug = product.slug;
    await this.catalogRepository.deleteProduct(product);
    await this._clearProductCache(id, productSlug);
    return { message: 'catalog.productDeleted' };
  }
}

module.exports = CatalogService;
