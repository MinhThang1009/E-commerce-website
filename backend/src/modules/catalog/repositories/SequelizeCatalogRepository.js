const { Op, QueryTypes, col } = require('sequelize');
const ICatalogRepository = require('./ICatalogRepository');

// Sequelize impl của ICatalogRepository — duy nhất layer truy cập Category/
// Brand/Collection/ProductCollection/Product model.
//
// Sprint 6a triển khai 25 method cho 3 sub-domain (Category, Brand, Collection
// + product reads kèm theo). Sprint 6b mở rộng cho Product CRUD + search.
class SequelizeCatalogRepository extends ICatalogRepository {
  constructor({
    Category,
    Brand,
    Collection,
    ProductCollection,
    Product,
    ProductAttribute,
    ProductVariant,
    ProductSpecification,
    Review,
    RecentlyViewed,
    WarrantyPackage,
    sequelize,
  }) {
    super();
    this.Category = Category;
    this.Brand = Brand;
    this.Collection = Collection;
    this.ProductCollection = ProductCollection;
    this.Product = Product;
    this.ProductAttribute = ProductAttribute;
    this.ProductVariant = ProductVariant;
    this.ProductSpecification = ProductSpecification;
    this.Review = Review;
    this.RecentlyViewed = RecentlyViewed;
    this.WarrantyPackage = WarrantyPackage;
    this.sequelize = sequelize;
  }

  // ---------- Category ----------

  async findAllCategoriesSorted() {
    return this.Category.findAll({ order: [['nameVi', 'ASC']] });
  }

  // Đếm sản phẩm theo category_id qua raw SQL (nhanh hơn N+1 model.count).
  async getCategoryProductCounts() {
    const rows = await this.sequelize.query(
      `SELECT pc.category_id, COUNT(DISTINCT pc.product_id) as product_count
       FROM product_categories pc
       JOIN products p ON p.id = pc.product_id AND p.deleted_at IS NULL AND p.status = 'active'
       GROUP BY pc.category_id`,
      { type: QueryTypes.SELECT },
    );
    const map = {};
    rows.forEach((r) => {
      map[r.category_id] = parseInt(r.product_count, 10);
    });
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
        [Op.or]: [{ slug: idOrSlug }, isNumericId ? { id: idOrSlug } : null].filter(Boolean),
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

  async findProductsByCategoryId(
    categoryId,
    { status, sort = 'createdAt', order = 'DESC', limit, offset } = {},
  ) {
    const where = { categoryId };
    if (status) where.status = status;
    return this.Product.findAndCountAll({
      where,
      include: [
        { association: 'brand', attributes: ['id', 'name', 'nameVi', 'nameEn', 'slug', 'logoUrl'] },
        { association: 'productAttributes' },
        { association: 'variants' },
        { association: 'productImages' },
        { association: 'reviews' },
      ],
      distinct: true,
      limit,
      offset,
      order: [[sort, order]],
    });
  }

  // ---------- Brand ----------

  async findAllBrands({ filter } = {}) {
    const where = {};
    if (filter && filter.idIn) where.id = { [Op.in]: filter.idIn };
    return this.Brand.findAll({ where, order: [['nameVi', 'ASC']] });
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
      limit,
      offset,
      order: [[sort, order]],
    });
  }

  // ---------- Collection ----------

  async findAllCollections({ filter } = {}) {
    const where = {};
    if (filter && filter.isActive !== undefined) where.isActive = filter.isActive;
    return this.Collection.findAll({ where, order: [['nameVi', 'ASC']] });
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

  async findProductsByCollectionId(
    collectionId,
    { sort = 'createdAt', order = 'DESC', limit, offset } = {},
  ) {
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
      limit,
      offset,
      order: [[sort, order]],
    });
  }

  // ---------- Product (Sprint 6b) ----------

  // Helper internal — build where conditions từ filter object plain (service không touch Op).
  _buildProductWhereConditions(filter = {}) {
    const where = {};
    if (filter.search) {
      const lower = filter.search.toLowerCase();
      where[Op.or] = [
        this.sequelize.where(this.sequelize.fn('LOWER', this.sequelize.col('Product.name')), {
          [Op.like]: `%${lower}%`,
        }),
        this.sequelize.where(
          this.sequelize.fn('LOWER', this.sequelize.col('Product.description')),
          { [Op.like]: `%${lower}%` },
        ),
        this.sequelize.where(
          this.sequelize.fn('LOWER', this.sequelize.col('Product.short_description')),
          { [Op.like]: `%${lower}%` },
        ),
      ];
    }
    if (filter.minPrice) {
      where.basePrice = { ...where.basePrice, [Op.gte]: parseFloat(filter.minPrice) };
    }
    if (filter.maxPrice) {
      where.basePrice = { ...where.basePrice, [Op.lte]: parseFloat(filter.maxPrice) };
    }
    if (filter.featured !== undefined) {
      where.isFeatured = filter.featured === 'true' || filter.featured === true;
    }
    if (filter.status !== undefined) {
      where.status = filter.status;
    }
    if (filter.categoryId !== undefined) {
      where.categoryId = filter.categoryId;
    } else if (filter.categoryIdMissingSentinel) {
      where.id = -1; // category slug không match
    }
    if (filter.brandIdsIn && filter.brandIdsIn.length > 0) {
      where.brandId = { [Op.in]: filter.brandIdsIn };
    }
    if (filter.inStock !== undefined) {
      const wantInStock = filter.inStock === 'true' || filter.inStock === true;
      // Stock thực nằm ở variant level — dùng subquery check variant stock thay vì product.stockQuantity
      if (wantInStock) {
        where.id = {
          ...where.id,
          [Op.in]: this.sequelize.literal(
            '(SELECT DISTINCT product_id FROM product_variants WHERE stock_quantity > 0)',
          ),
        };
      } else {
        where.id = {
          ...where.id,
          [Op.notIn]: this.sequelize.literal(
            '(SELECT DISTINCT product_id FROM product_variants WHERE stock_quantity > 0)',
          ),
        };
      }
    }
    return where;
  }

  // Build orderClause từ sort/order plain string.
  _buildProductOrderClause(sort, order) {
    if (sort === 'price_asc') return [['basePrice', 'ASC']];
    if (sort === 'price_desc') return [['basePrice', 'DESC']];
    if (sort === 'newest') return [['createdAt', 'DESC']];
    if (sort === 'bestselling' || sort === 'popular') return [['soldCount', 'DESC']];
    return [[sort, order]];
  }

  // Filter: { search, minPrice, maxPrice, featured, status, categoryId, categoryIdMissingSentinel, brandIdsIn, brandSlugsIn, collectionIdsIn, collectionSlugsIn }
  async findProductsList({ filter = {}, sort = 'createdAt', order = 'DESC', limit, offset } = {}) {
    const include = [
      { association: 'category', required: false },
      { association: 'categories', through: { attributes: [] }, required: false },
      { association: 'productAttributes', required: false },
      { association: 'variants', required: false },
      { association: 'productImages', required: false },
      { association: 'reviews', required: false, where: { isVerified: true } },
    ];

    if (filter.brandSlugsIn && filter.brandSlugsIn.length > 0) {
      include.push({
        association: 'brand',
        where: { slug: { [Op.in]: filter.brandSlugsIn } },
        required: true,
      });
    } else {
      include.push({ association: 'brand', required: false });
    }

    if (filter.collectionIdsIn && filter.collectionIdsIn.length > 0) {
      include.push({
        association: 'collections',
        where: { id: { [Op.in]: filter.collectionIdsIn } },
        required: true,
      });
    } else if (filter.collectionSlugsIn && filter.collectionSlugsIn.length > 0) {
      include.push({
        association: 'collections',
        where: { slug: { [Op.in]: filter.collectionSlugsIn } },
        required: true,
      });
    }

    return this.Product.findAndCountAll({
      where: this._buildProductWhereConditions(filter),
      include,
      distinct: true,
      limit,
      offset,
      order: this._buildProductOrderClause(sort, order),
    });
  }

  async findProductByIdWithFullDetails(id) {
    return this.Product.findByPk(id, {
      include: [
        { association: 'category' },
        {
          association: 'productAttributes',
          order: [
            ['sortOrder', 'ASC'],
            ['id', 'ASC'],
          ],
        },
        { association: 'variants', required: false, order: [['id', 'ASC']] },
        { association: 'productImages', required: false },
        { association: 'productSpecifications' },
        {
          association: 'reviews',
          include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName', 'avatar'] }],
        },
        {
          association: 'warrantyPackages',
          through: { attributes: ['isDefault'], as: 'productWarranty' },
          required: false,
        },
      ],
    });
  }

  async findProductBySlugWithFullDetails(slug) {
    return this.Product.findOne({
      where: { slug },
      include: [
        { association: 'category' },
        {
          association: 'productAttributes',
          order: [
            ['sortOrder', 'ASC'],
            ['id', 'ASC'],
          ],
        },
        { association: 'variants', required: false, order: [['id', 'ASC']] },
        { association: 'productImages', required: false },
        { association: 'productSpecifications' },
        {
          association: 'reviews',
          include: [{ association: 'user', attributes: ['id', 'firstName', 'lastName', 'avatar'] }],
        },
        {
          association: 'warrantyPackages',
          through: { attributes: ['isDefault'], as: 'productWarranty' },
          required: false,
        },
      ],
    });
  }

  async findProductByPk(id) {
    return this.Product.findByPk(id);
  }

  async findFeaturedProducts(limit = 8) {
    return this.Product.findAll({
      where: { isFeatured: true },
      include: [
        { association: 'category', required: false },
        { association: 'brand', required: false },
        { association: 'reviews', required: false },
        { association: 'variants', required: false },
        { association: 'productImages', required: false },
      ],
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  async findRelatedProducts(excludeId, limit = 4) {
    return this.Product.findAll({
      include: [
        { association: 'category' },
        { association: 'reviews' },
        { association: 'productImages' },
        { association: 'variants' },
      ],
      where: { id: { [Op.ne]: excludeId } },
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  async findRelatedProductsFallback(excludeId, limit = 4) {
    return this.Product.findAll({
      include: [{ association: 'reviews' }],
      where: { id: { [Op.ne]: excludeId }, status: 'active' },
      limit,
      order: [
        ['isFeatured', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });
  }

  async searchProducts({ q, limit, offset }) {
    const lower = q.toLowerCase();
    return this.Product.findAndCountAll({
      where: {
        [Op.or]: [
          this.sequelize.where(this.sequelize.fn('LOWER', this.sequelize.col('Product.name')), {
            [Op.like]: `%${lower}%`,
          }),
          this.sequelize.where(
            this.sequelize.fn('LOWER', this.sequelize.col('Product.description')),
            { [Op.like]: `%${lower}%` },
          ),
          this.sequelize.where(
            this.sequelize.fn('LOWER', this.sequelize.col('Product.short_description')),
            { [Op.like]: `%${lower}%` },
          ),
          this.sequelize.where(this.sequelize.fn('LOWER', this.sequelize.col('Product.tags')), {
            [Op.like]: `%${lower}%`,
          }),
        ],
      },
      include: [{ association: 'category' }, { association: 'productImages', required: false }],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async findProductSuggestions(prefix, limit = 10) {
    const lower = prefix.toLowerCase();
    return this.Product.findAll({
      where: this.sequelize.where(this.sequelize.fn('LOWER', this.sequelize.col('name')), {
        [Op.like]: `${lower}%`,
      }),
      attributes: ['id', 'name', 'slug'],
      include: [
        {
          association: 'productImages',
          attributes: ['imageUrl', 'isThumbnail'],
          required: false,
        },
      ],
      limit,
      order: [['nameVi', 'ASC']],
    });
  }

  async findNewArrivals(limit = 8) {
    return this.Product.findAll({
      include: [
        { association: 'category' },
        { association: 'reviews' },
        { association: 'productImages' },
        { association: 'variants' },
      ],
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  async findBestSellersRaw({ startDate, limit }) {
    return this.sequelize.query(
      `
      SELECT
        p.id, p.name, p.slug,
        p.base_price as price, p.compare_at_price,
        p.is_featured as isFeatured,
        COUNT(oi.product_id) as sales_count,
        SUM(oi.quantity) as units_sold
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled'
      AND o.created_at >= :startDate
      GROUP BY p.id
      ORDER BY units_sold DESC
      LIMIT :limit
      `,
      {
        replacements: { startDate, limit },
        type: QueryTypes.SELECT,
      },
    );
  }

  async findProductsByIdsOrdered(ids) {
    const safeIds = ids.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
    if (safeIds.length === 0) return [];
    return this.Product.findAll({
      where: { id: { [Op.in]: safeIds } },
      include: [
        { association: 'category' },
        { association: 'productImages' },
        { association: 'variants' },
      ],
      order: [
        [
          this.sequelize.literal(
            `CASE ${safeIds.map((id, i) => `WHEN id = ${id} THEN ${i}`).join(' ')} END`,
          ),
        ],
      ],
    });
  }

  async findDeals({ minDiscount, sort = 'discount_desc', limit }) {
    let orderClause;
    if (sort === 'price_asc') orderClause = [['basePrice', 'ASC']];
    else if (sort === 'price_desc') orderClause = [['basePrice', 'DESC']];
    else {
      // Khi có JOIN, MySQL yêu cầu qualifier table name. Dùng alias `Product` (Sequelize default).
      orderClause = [
        [
          this.sequelize.literal(
            '(`Product`.`compare_at_price` - `Product`.`base_price`) / `Product`.`compare_at_price`',
          ),
          'DESC',
        ],
      ];
    }

    // subQuery: false để ORDER BY literal expression không bị wrap trong subquery (gây lỗi
    // "Unknown column 'Product.compare_at_price' in order clause" với MySQL underscore mode).
    return this.Product.findAll({
      where: {
        compareAtPrice: { [Op.ne]: null },
        status: 'active',
        [Op.and]: [
          this.sequelize.where(
            this.sequelize.literal(
              '(`Product`.`compare_at_price` - `Product`.`base_price`) / `Product`.`compare_at_price` * 100',
            ),
            { [Op.gte]: minDiscount },
          ),
        ],
      },
      include: [
        { association: 'category', required: false, attributes: ['id', 'name', 'slug'] },
        {
          association: 'reviews',
          required: false,
          where: { isVerified: true },
          attributes: ['rating'],
        },
        {
          association: 'productImages',
          required: false,
          attributes: ['id', 'imageUrl', 'isThumbnail', 'variantId'],
        },
        {
          association: 'variants',
          required: false,
          attributes: ['id', 'price', 'stockQuantity', 'sku', 'attributes'],
        },
      ],
      order: orderClause,
      limit,
      subQuery: false,
    });
  }

  async findProductVariantsByProductId(productId) {
    if (!this.ProductVariant) {
      throw new Error('ProductVariant model bắt buộc trong constructor');
    }
    return this.ProductVariant.findAll({ where: { productId } });
  }

  async findProductRatingsRows(productId) {
    if (!this.Review) {
      throw new Error('Review model bắt buộc trong constructor');
    }
    return this.Review.findAll({ where: { productId }, attributes: ['rating'] });
  }

  async getProductPriceRange({ categoryId } = {}) {
    const include = [];
    if (categoryId) {
      include.push({
        association: 'category',
        where: { id: categoryId },
        required: false,
      });
    }
    const rows = await this.Product.findAll({
      attributes: [
        [this.sequelize.fn('MIN', this.sequelize.col('base_price')), 'min'],
        [this.sequelize.fn('MAX', this.sequelize.col('base_price')), 'max'],
      ],
      include,
      raw: true,
    });
    return { min: parseFloat(rows[0]?.min || 0), max: parseFloat(rows[0]?.max || 0) };
  }

  async findAttributeValuesByName(name, { categoryId } = {}) {
    if (!this.ProductAttribute) {
      throw new Error('ProductAttribute model bắt buộc trong constructor');
    }
    const where = { name };
    if (categoryId) {
      where.productId = {
        [Op.in]: this.sequelize.literal(
          `(SELECT product_id FROM product_categories WHERE category_id = ${parseInt(categoryId, 10)})`,
        ),
      };
    }
    return this.ProductAttribute.findAll({ attributes: ['values'], where, limit: 500, raw: true });
  }

  async findOtherAttributes({ categoryId } = {}) {
    if (!this.ProductAttribute) {
      throw new Error('ProductAttribute model bắt buộc trong constructor');
    }
    const where = { name: { [Op.notIn]: ['brand', 'color', 'size'] } };
    if (categoryId) {
      where.productId = {
        [Op.in]: this.sequelize.literal(
          `(SELECT product_id FROM product_categories WHERE category_id = ${parseInt(categoryId, 10)})`,
        ),
      };
    }
    return this.ProductAttribute.findAll({
      attributes: ['name', 'values'],
      where,
      group: ['name', 'values'],
      limit: 500,
      raw: true,
    });
  }

  async findRecentlyViewedByUser(userId, limit = 10) {
    if (!this.RecentlyViewed) {
      throw new Error('RecentlyViewed model bắt buộc trong constructor');
    }
    return this.RecentlyViewed.findAll({
      where: { userId },
      limit,
      order: [['viewedAt', 'DESC']],
      include: [
        {
          model: this.Product,
          attributes: ['id', 'name', 'slug', [col('base_price'), 'price'], 'compareAtPrice'],
          include: [{ association: 'reviews' }, { association: 'productImages', required: false }],
        },
      ],
    });
  }

  async upsertRecentlyViewed(userId, productId) {
    if (!this.RecentlyViewed) return;
    await this.RecentlyViewed.upsert({ userId, productId, viewedAt: new Date() });
  }

  async pruneRecentlyViewed(userId, maxKeep) {
    if (!this.RecentlyViewed) return;
    const stale = await this.RecentlyViewed.findAll({
      where: { userId },
      order: [['viewedAt', 'DESC']],
      attributes: ['id'],
      offset: maxKeep,
    });
    if (stale.length > 0) {
      await this.RecentlyViewed.destroy({ where: { id: stale.map((r) => r.id) } });
    }
  }

  async createProduct(payload, options = {}) {
    return this.Product.create(payload, options);
  }

  async saveProduct(product, options = {}) {
    return product.save(options);
  }

  async deleteProduct(product) {
    return product.destroy();
  }

  async findCategoriesByIds(ids) {
    return this.Category.findAll({ where: { id: { [Op.in]: ids } } });
  }

  async findWarrantyPackagesByIds(ids) {
    if (!this.WarrantyPackage) {
      throw new Error('WarrantyPackage model bắt buộc trong constructor');
    }
    return this.WarrantyPackage.findAll({ where: { id: { [Op.in]: ids } } });
  }

  async setProductCategories(product, categories, options = {}) {
    return product.setCategories(categories, options);
  }

  async setProductWarrantyPackages(product, warranties, options = {}) {
    return product.setWarrantyPackages(warranties, options);
  }

  async createProductSpecifications(rows, options = {}) {
    if (!this.ProductSpecification) {
      throw new Error('ProductSpecification model bắt buộc trong constructor');
    }
    return this.ProductSpecification.bulkCreate(rows, options);
  }

  async clearProductAttributes(productId, options = {}) {
    if (!this.ProductAttribute) return;
    return this.ProductAttribute.destroy({ where: { productId }, ...options });
  }

  async createProductAttributes(rows, options = {}) {
    if (!this.ProductAttribute) {
      throw new Error('ProductAttribute model bắt buộc trong constructor');
    }
    return this.ProductAttribute.bulkCreate(rows, options);
  }

  async clearProductVariants(productId, options = {}) {
    if (!this.ProductVariant) return;
    return this.ProductVariant.destroy({ where: { productId }, ...options });
  }

  async createProductVariants(rows, options = {}) {
    if (!this.ProductVariant) {
      throw new Error('ProductVariant model bắt buộc trong constructor');
    }
    return this.ProductVariant.bulkCreate(rows, options);
  }

  async runInTransaction(work) {
    return this.sequelize.transaction(work);
  }
}

module.exports = SequelizeCatalogRepository;
