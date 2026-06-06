/**
 * @file catalogBrandMethods.js
 * @layer Service
 * @module catalog
 * @description Brand domain methods cho CatalogService (mixin)
 */
const { AppError } = require('@shared/errors');

module.exports = {
  async getAllBrands({ categoryId, hasProducts } = {}) {
    // Parse string 'false' từ query param thành boolean false
    const hasProductsBool = String(hasProducts) !== 'false';
    const filter = { hasProducts: hasProductsBool };
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
    return this.catalogRepository.findAllBrands({ filter });
  },

  async getBrandBySlug({ slug }) {
    const brand = await this.catalogRepository.findBrandBySlug(slug);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);
    return brand;
  },

  async createBrand({ payload }) {
    return this.catalogRepository.createBrand({
      name: payload.name,
      logoUrl: payload.logoUrl,
      description: payload.description,
      website: payload.website,
      isActive: payload.isActive ?? true,
    });
  },

  async updateBrand({ id, patch }) {
    const brand = await this.catalogRepository.findBrandById(id);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);
    Object.assign(brand, patch);
    await this.catalogRepository.saveBrand(brand);
    return brand;
  },

  async deleteBrand({ id }) {
    const brand = await this.catalogRepository.findBrandById(id);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);

    const count = await this.catalogRepository.countProductsByBrandId(id);
    if (count > 0) {
      throw new AppError('catalog.cannotDeleteBrandWithProducts', 400);
    }

    await this.catalogRepository.deleteBrand(brand);
    return { message: 'catalog.brandDeleted' };
  },

  async getProductsByBrand({ slug, page = 1, limit = 10, sort = 'createdAt', order = 'DESC' }) {
    const brand = await this.catalogRepository.findBrandBySlug(slug);
    if (!brand) throw new AppError('catalog.brandNotFound', 404);

    const lim = Math.max(parseInt(limit, 10) || 10, 1);
    const off = Math.max((parseInt(page, 10) - 1) * lim, 0);

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
  },
};
