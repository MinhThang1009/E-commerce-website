/**
 * @file catalogProductMethods.js
 * @layer Service
 * @module catalog
 * @description Product domain methods + shared helpers cho CatalogService (mixin)
 */
const { AppError } = require('@shared/errors');

const MAX_SUGGESTIONS = 10;
const DEFAULT_LIST_LIMIT = 8;
const DEFAULT_BESTSELLERS_LIMIT = 10;
const DEFAULT_DEALS_LIMIT = 12;
const MAX_QUERY_LIMIT = 100;
const DEFAULT_MIN_DISCOUNT_PERCENT = 5;
const DEFAULT_PAGE_SIZE = 20;

module.exports = {
  // ---- Shared helpers ----

  _mapProductImages(productJson) {
    if (productJson.productImages && productJson.productImages.length > 0) {
      productJson.images = productJson.productImages.map((img) => ({
        id: img.id,
        url: img.imageUrl,
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
  },

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
  },

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
  },

  _mapProductForList(product) {
    const json = product.toJSON();
    json.price = json.basePrice;
    this._mapProductImages(json);
    const ratings = this._calcRatings(json.reviews);
    delete json.reviews;
    const displayPrice = this._pickDisplayPrice(json);
    const compareAtPrice = parseFloat(json.compareAtPrice) || null;
    return { ...json, price: displayPrice, compareAtPrice, ratings };
  },

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
      const normColor = queryColor?.toString().normalize('NFC').toLowerCase().trim();
      let selectedVariant = null;

      if (skuId) {
        selectedVariant = productJson.variants.find((v) => String(v.id) === String(skuId));
      }
      if (!selectedVariant && normColor) {
        selectedVariant = productJson.variants.find((v) => {
          const vAttrs = v.attributes || {};
          const vColorRaw = vAttrs.color ?? vAttrs['Màu sắc'] ?? vAttrs['màu sắc'];
          const vColor = vColorRaw?.toString().normalize('NFC').toLowerCase().trim();
          return vColor === normColor;
        });
      }
      if (!selectedVariant) {
        selectedVariant =
          productJson.variants.find((v) => v.isDefault === true || v.isDefault === 1) ??
          productJson.variants[0];
      }

      {
        const attrs = selectedVariant.attributes || {};
        const variantColorRaw = attrs.color ?? attrs['Màu sắc'] ?? attrs['màu sắc'];
        let variantColor = variantColorRaw?.toString().normalize('NFC').toLowerCase().trim();
        if (!skuId && normColor) variantColor = normColor;

        let variantImages = productJson.images;
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

        const variantName = selectedVariant.variantName || selectedVariant.displayName;
        const mainName = productJson.name;
        const modelName =
          productJson.model ||
          mainName.replace(
            /^(Laptop|Điện thoại|Máy tính bảng|Đồng hồ|Tai nghe|Loa|Phụ kiện)\s+/i,
            '',
          );
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
          price: selectedVariant.price != null ? selectedVariant.price : productJson.basePrice,
          compareAtPrice:
            selectedVariant.compareAtPrice != null
              ? selectedVariant.compareAtPrice
              : productJson.compareAtPrice,
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
            price: selectedVariant.price != null ? selectedVariant.price : productJson.basePrice,
            compareAtPrice:
              selectedVariant.compareAtPrice != null
                ? selectedVariant.compareAtPrice
                : productJson.compareAtPrice,
          },
          availableVariants: productJson.variants.map((v) => ({
            ...v,
            name: v.variantName || v.displayName,
            price: v.price != null ? v.price : productJson.basePrice,
            compareAtPrice:
              v.compareAtPrice != null ? v.compareAtPrice : productJson.compareAtPrice,
          })),
          specifications: { ...productJson.specifications, ...selectedVariant.attributes },
        };
      }
    }

    return responseData;
  },

  async _trackRecentlyViewed(userId, productId) {
    await this.catalogRepository.upsertRecentlyViewed(userId, productId);
    await this.catalogRepository.pruneRecentlyViewed(userId, this.RECENTLY_VIEWED_MAX);
  },

  // ---- Public methods ----

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
  }) {
    const lim = Math.min(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, MAX_QUERY_LIMIT);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const off = (pageNum - 1) * lim;

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

    // Public endpoint — luôn filter status='active', không để user truyền status tuỳ ý
    const filter = { search, minPrice, maxPrice, inStock, featured, status: 'active' };
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
      page: pageNum,
      limit: lim,
    };

    return { payload };
  },

  async getProductById({ id, skuId, queryColor, userId }) {
    let product = await this.catalogRepository.findProductByIdWithFullDetails(id);
    if (!product) {
      product = await this.catalogRepository.findProductBySlugWithFullDetails(id);
    }
    if (!product) throw new AppError('catalog.productNotFound', 404);
    if (product.status !== 'active') throw new AppError('catalog.productNotFound', 404);

    const responseData = this._buildProductDetailResponse(product, { skuId, queryColor });
    const payload = { status: 'success', data: responseData };

    if (userId) {
      this._trackRecentlyViewed(userId, product.id).catch((err) => {
        this.logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      });
    }

    return { payload };
  },

  async getProductBySlug({ slug, skuId, queryColor, userId }) {
    const product = await this.catalogRepository.findProductBySlugWithFullDetails(slug);
    if (!product) throw new AppError('catalog.productNotFound', 404);
    if (product.status !== 'active') throw new AppError('catalog.productNotFound', 404);

    const responseData = this._buildProductDetailResponse(product, { skuId, queryColor });

    if (userId) {
      this._trackRecentlyViewed(userId, product.id).catch((err) => {
        this.logger.error('Lỗi ghi lịch sử xem sản phẩm:', err);
      });
    }

    return { payload: { status: 'success', data: responseData } };
  },

  async getFeaturedProducts({ limit = DEFAULT_LIST_LIMIT }) {
    const productsRaw = await this.catalogRepository.findFeaturedProducts(
      Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_QUERY_LIMIT),
    );
    return productsRaw.map((p) => this._mapProductForList(p));
  },

  async getRelatedProducts({ id, limit = 4 }) {
    const numId = parseInt(id, 10);
    if (!numId) throw new AppError('catalog.productNotFound', 404);
    const product = await this.catalogRepository.findProductByPk(numId);
    if (!product || product.status !== 'active') throw new AppError('catalog.productNotFound', 404);

    const lim = Math.min(parseInt(limit, 10) || 4, MAX_QUERY_LIMIT);
    let related = [];
    if (product.categoryId) {
      related = await this.catalogRepository.findRelatedProducts(numId, lim, product.categoryId);
    }
    if (related.length === 0) {
      this.logger.info(
        `Không tìm thấy sản phẩm liên quan cho sản phẩm ${numId}. Trả về sản phẩm gần đây thay thế.`,
      );
      related = await this.catalogRepository.findRelatedProductsFallback(numId, lim);
    }

    return related.map((p) => {
      const json = p.toJSON();
      this._mapProductImages(json);
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      return { ...json, ratings };
    });
  },

  async searchProducts({ q, page = 1, limit = 10 }) {
    if (!q) throw new AppError('catalog.searchKeywordRequired', 400);

    const lim = Math.min(parseInt(limit, 10) || 10, MAX_QUERY_LIMIT);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const off = (pageNum - 1) * lim;

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
      page: pageNum,
      limit: lim,
    };
  },

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
  },

  async getNewArrivals({ limit = DEFAULT_LIST_LIMIT }) {
    const productsRaw = await this.catalogRepository.findNewArrivals(
      Math.min(Math.max(parseInt(limit, 10) || DEFAULT_LIST_LIMIT, 1), MAX_QUERY_LIMIT),
    );
    return productsRaw.map((product) => {
      const json = product.toJSON();
      json.price = json.basePrice;
      this._mapProductImages(json);
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      return { ...json, ratings };
    });
  },

  async getBestSellers({ limit = DEFAULT_BESTSELLERS_LIMIT, period = 'month' }) {
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

    const lim = Math.min(
      Math.max(parseInt(limit, 10) || DEFAULT_BESTSELLERS_LIMIT, 1),
      MAX_QUERY_LIMIT,
    );
    const bestSellers = await this.catalogRepository.findBestSellersRaw({ startDate, limit: lim });

    if (bestSellers.length === 0) {
      return this.getNewArrivals({ limit: lim });
    }

    const ids = bestSellers.map((p) => p.id);
    const productsRaw = await this.catalogRepository.findProductsByIdsOrdered(ids);

    return productsRaw.map((product) => this._mapProductForList(product));
  },

  async getDeals({ limit, minDiscount, sort = 'discount_desc' }) {
    const parsedLimit = Math.min(parseInt(limit, 10) || DEFAULT_DEALS_LIMIT, MAX_QUERY_LIMIT);
    const parsedMinDiscount = parseFloat(minDiscount) || DEFAULT_MIN_DISCOUNT_PERCENT;

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
    return data;
  },

  async getProductVariants({ id }) {
    const numId = parseInt(id, 10);
    if (!numId) throw new AppError('catalog.productNotFound', 404);
    const product = await this.catalogRepository.findProductByPk(numId);
    if (!product || product.status !== 'active') throw new AppError('catalog.productNotFound', 404);

    const variants = await this.catalogRepository.findProductVariantsByProductId(numId);
    return { variants };
  },

  async getProductReviewsSummary({ id }) {
    const numId = parseInt(id, 10);
    if (!numId) throw new AppError('catalog.productNotFound', 404);
    const product = await this.catalogRepository.findProductByPk(numId);
    if (!product || product.status !== 'active') throw new AppError('catalog.productNotFound', 404);

    const reviews = await this.catalogRepository.findProductRatingsRows(numId);
    const count = reviews.length;
    const average = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviews.forEach((r) => {
      distribution[r.rating]++;
    });

    return { average, count, distribution };
  },

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
  },

  async getRecentlyViewed({ userId, limit = 10 }) {
    const recentlyViewed = await this.catalogRepository.findRecentlyViewedByUser(
      userId,
      Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50),
    );
    return recentlyViewed.map((rv) => {
      const product = rv.Product;
      const json = product.toJSON();
      this._mapProductImages(json);
      delete json.productImages;
      const ratings = this._calcRatings(json.reviews);
      delete json.reviews;
      const displayPrice = this._pickDisplayPrice(json);
      const compareAtPrice = parseFloat(json.compareAtPrice) || null;
      return { ...json, price: displayPrice, compareAtPrice, ratings, viewedAt: rv.viewedAt };
    });
  },
};
