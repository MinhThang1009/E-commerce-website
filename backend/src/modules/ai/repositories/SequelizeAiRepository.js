const { Op, literal } = require('sequelize');
const IAiRepository = require('./IAiRepository');

// Sequelize impl của IAiRepository — wrap Product/Category access cho AI
// product search + deals/trending. Repo build LIKE conditions internal.
class SequelizeAiRepository extends IAiRepository {
  constructor({ Product, ProductVariant, Category, sequelize }) {
    super();
    this.Product = Product;
    this.ProductVariant = ProductVariant;
    this.Category = Category;
    this.sequelize = sequelize;
  }

  async searchProducts({ keyword, minPrice, maxPrice, categoryName, limit } = {}) {
    const where = { status: 'active' };

    if (keyword) {
      const keywordMapping = {
        giày: ['shoes', 'shoe', 'sneaker', 'nike', 'adidas'],
        'giày thể thao': ['shoes', 'sneaker', 'running shoes', 'nike', 'adidas'],
        'thể thao': ['sport', 'sports', 'running', 'nike', 'adidas'],
        áo: ['shirt', 'tshirt', 't-shirt'],
        'áo thun': ['tshirt', 't-shirt', 'shirt'],
        quần: ['pants', 'jeans', 'trousers'],
        túi: ['bag', 'backpack'],
        balo: ['backpack', 'bag'],
        'phụ kiện': ['accessories', 'accessory'],
        'đồng hồ': ['watch', 'watches'],
        kính: ['glasses', 'sunglasses'],
        mũ: ['hat', 'cap'],
      };
      const original = keyword.toLowerCase();
      let terms = [original];
      Object.keys(keywordMapping).forEach((vi) => {
        if (original.includes(vi)) terms = [...terms, ...keywordMapping[vi]];
      });
      const conditions = [];
      terms.forEach((term) => {
        conditions.push(
          { name: { [Op.like]: `%${term}%` } },
          { description: { [Op.like]: `%${term}%` } }
        );
      });
      where[Op.or] = conditions;
    }

    if (minPrice) where.basePrice = { [Op.gte]: minPrice };
    if (maxPrice) where.basePrice = { ...where.basePrice, [Op.lte]: maxPrice };

    const categoryInclude = {
      model: this.Category, as: 'categories', through: { attributes: [] },
    };
    if (categoryName) {
      categoryInclude.where = { name: { [Op.like]: `%${categoryName}%` } };
      categoryInclude.required = true;
    }

    return this.Product.findAll({
      where,
      include: [
        categoryInclude,
        { model: this.ProductVariant, as: 'variants', attributes: ['stockQuantity'], required: false },
      ],
      limit: limit || 20,
      order: [['createdAt', 'DESC']],
    });
  }

  async findActiveDeals(limit = 10) {
    return this.Product.findAll({
      where: { status: 'active', compareAtPrice: { [Op.gt]: 0 } },
      include: [
        { model: this.ProductVariant, as: 'variants', attributes: ['stockQuantity'], required: false },
      ],
      order: [
        [literal('((compare_at_price - base_price) / compare_at_price) DESC')],
      ],
      limit,
    });
  }

  async findFeaturedProducts(limit = 10) {
    return this.Product.findAll({
      where: { status: 'active', isFeatured: true },
      include: [
        { model: this.ProductVariant, as: 'variants', attributes: ['stockQuantity'], required: false },
      ],
      limit, order: [['createdAt', 'DESC']],
    });
  }
}

module.exports = SequelizeAiRepository;
