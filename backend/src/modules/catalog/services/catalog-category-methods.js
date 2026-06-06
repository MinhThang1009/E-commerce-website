/**
 * @file catalogCategoryMethods.js
 * @layer Service
 * @module catalog
 * @description Category domain methods cho CatalogService (mixin)
 */
const { AppError } = require('@shared/errors');

module.exports = {
  async getAllCategories() {
    const categories = await this.catalogRepository.findAllCategoriesSorted();
    const countMap = await this.catalogRepository.getCategoryProductCounts();
    const data = categories
      .map((c) => {
        const json = c.toJSON();
        json.productCount = countMap[c.id] || 0;
        return json;
      })
      .filter((c) => c.productCount > 0 && c.isActive !== false);

    return { status: 'success', data };
  },

  async getCategoryTree() {
    return this.catalogRepository.findAllCategoriesSorted();
  },

  async getCategoryById({ id }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);
    return category;
  },

  async getCategoryBySlug({ slug }) {
    const category = await this.catalogRepository.findCategoryByIdOrSlug(slug);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);
    return category;
  },

  async createCategory({ payload }) {
    const category = await this.catalogRepository.createCategory({
      name: payload.name,
      description: payload.description,
      image: payload.image,
      parentId: payload.parentId ?? null,
      isActive: payload.isActive ?? true,
      sortOrder: payload.sortOrder ?? 0,
    });
    return category;
  },

  async updateCategory({ id, patch }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);

    if (patch.name !== undefined) category.name = patch.name;
    if (patch.description !== undefined) category.description = patch.description;
    if (patch.image !== undefined) category.image = patch.image;
    if (patch.parentId !== undefined) category.parentId = patch.parentId;
    if (patch.isActive !== undefined) category.isActive = patch.isActive;
    if (patch.sortOrder !== undefined) category.sortOrder = patch.sortOrder;
    await this.catalogRepository.saveCategory(category);
    return category;
  },

  async deleteCategory({ id }) {
    const category = await this.catalogRepository.findCategoryById(id);
    if (!category) throw new AppError('catalog.categoryNotFound', 404);

    const productCount = await this.catalogRepository.countProductsByCategoryId(id);
    if (productCount > 0) {
      throw new AppError('catalog.cannotDeleteCategoryWithProducts', 400);
    }

    await this.catalogRepository.deleteCategory(category);
    return { message: 'catalog.categoryDeleted' };
  },

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
    const off = Math.max((parseInt(page, 10) - 1) * lim, 0);

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
  },

  async getFeaturedCategories() {
    return this.catalogRepository.findAllCategoriesSorted();
  },

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
  },
};
