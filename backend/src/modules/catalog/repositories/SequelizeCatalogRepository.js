const { Op, QueryTypes } = require('sequelize');
const ICatalogRepository = require('./ICatalogRepository');

// Sequelize impl của ICatalogRepository — duy nhất layer truy cập Category/
// Brand/Collection/ProductCollection/Product model.
//
// Sprint 6a triển khai 25 method cho 3 sub-domain (Category, Brand, Collection
// + product reads kèm theo). Sprint 6b mở rộng cho Product CRUD + search.
class SequelizeCatalogRepository extends ICatalogRepository {
  constructor({ Category, Brand, Collection, ProductCollection, Product, sequelize }) {
    super();
    this.Category = Category;
    this.Brand = Brand;
    this.Collection = Collection;
    this.ProductCollection = ProductCollection;
    this.Product = Product;
    this.sequelize = sequelize;
  }

  // ---------- Category ----------

  async findAllCategoriesSorted() {
    return this.Category.findAll({ order: [['name', 'ASC']] });
  }

  // Đếm sản phẩm theo category_id qua raw SQL (nhanh hơn N+1 model.count).
  async getCategoryProductCounts() {
    const rows = await this.sequelize.query(
      `SELECT category_id, COUNT(*) as product_count FROM products WHERE category_id IS NOT NULL GROUP BY category_id`,
      { type: QueryTypes.SELECT }
    );
    const map = {};
    rows.forEach((r) => { map[r.category_id] = parseInt(r.product_count, 10); });
    return map;
  }

  async findCategoryById(id) {
    return this.Category.findByPk(id);
  }

  async findCategoryBySlug(slug) {
    return this.Category.findOne({ where: { slug } });
  }

  // Tìm category bằng slug HOẶC numeric id — tiện cho API public dùng /:slug
  // chấp nhận cả 2 dạng input.
  async findCategoryByIdOrSlug(idOrSlug) {
    const isNumericId = !isNaN(idOrSlug) && String(idOrSlug).trim() !== '';
    return this.Category.findOne({
      where: {
        [Op.or]: [
          { slug: idOrSlug },
          isNumericId ? { id: idOrSlug } : null,
        ].filter(Boolean),
      },
    });
  }

  async createCategory(payload) {
    return this.Category.create(payload);
  }

  async saveCategory(category) {
    return category.save();
  }

  async deleteCategory(category) {
    return category.destroy();
  }

  async countProductsByCategoryId(categoryId) {
    return this.Product.count({ where: { categoryId } });
  }

  async findProductsByCategoryId(categoryId, { status, sort = 'createdAt', order = 'DESC', limit, offset } = {}) {
    const where = { categoryId };
    if (status) where.status = status;
    return this.Product.findAndCountAll({
      where,
      include: [
        { association: 'brand', attributes: ['id', 'name', 'slug', 'logoUrl'] },
        { association: 'productAttributes' },
        { association: 'variants' },
        { association: 'productImages' },
        { association: 'reviews' },
      ],
      distinct: true,
      limit, offset,
      order: [[sort, order]],
    });
  }

  // ---------- Brand ----------

  async findAllBrands({ filter } = {}) {
    const where = {};
    if (filter && filter.idIn) where.id = { [Op.in]: filter.idIn };
    return this.Brand.findAll({ where, order: [['name', 'ASC']] });
  }

  // Lấy danh sách brandId của products thuộc category (DISTINCT).
  async findBrandIdsByCategoryId(categoryId) {
    const products = await this.Product.findAll({
      where: { categoryId },
      attributes: [[this.sequelize.fn('DISTINCT', this.sequelize.col('brand_id')), 'brandId']],
      raw: true,
    });
    return products.map((p) => p.brandId).filter((id) => !!id);
  }

  async findBrandById(id) {
    return this.Brand.findByPk(id);
  }

  async findBrandBySlug(slug) {
    return this.Brand.findOne({ where: { slug } });
  }

  async createBrand(payload) {
    return this.Brand.create(payload);
  }

  async saveBrand(brand) {
    return brand.save();
  }

  async deleteBrand(brand) {
    return brand.destroy();
  }

  async countProductsByBrandId(brandId) {
    return this.Product.count({ where: { brandId } });
  }

  async findProductsByBrandId(brandId, { sort = 'createdAt', order = 'DESC', limit, offset } = {}) {
    return this.Product.findAndCountAll({
      where: { brandId },
      limit, offset,
      order: [[sort, order]],
    });
  }

  // ---------- Collection ----------

  async findAllCollections({ filter } = {}) {
    const where = {};
    if (filter && filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.Collection.findAll({ where, order: [['name', 'ASC']] });
  }

  async findCollectionById(id) {
    return this.Collection.findByPk(id);
  }

  async findCollectionBySlug(slug) {
    return this.Collection.findOne({ where: { slug } });
  }

  async createCollection(payload) {
    return this.Collection.create(payload);
  }

  async saveCollection(collection) {
    return collection.save();
  }

  async deleteCollection(collection) {
    return collection.destroy();
  }

  // Replace toàn bộ products của collection bằng productIds mới.
  async setCollectionProducts(collectionId, productIds, options = {}) {
    await this.ProductCollection.destroy({ where: { collectionId }, ...options });
    if (productIds && productIds.length > 0) {
      const rows = productIds.map((productId) => ({ productId, collectionId }));
      await this.ProductCollection.bulkCreate(rows, options);
    }
  }

  async destroyCollectionProducts(collectionId, options = {}) {
    return this.ProductCollection.destroy({ where: { collectionId }, ...options });
  }

  async findProductsByCollectionId(collectionId, { sort = 'createdAt', order = 'DESC', limit, offset } = {}) {
    return this.Product.findAndCountAll({
      include: [
        {
          association: 'collections',
          where: { id: collectionId },
          through: { attributes: [] },
        },
      ],
      where: { status: 'active' },
      distinct: true,
      limit, offset,
      order: [[sort, order]],
    });
  }
}

module.exports = SequelizeCatalogRepository;
