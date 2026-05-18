/**
 * @file SequelizeAiRepository.js
 * @layer Repository
 * @module ai
 * @description Data access layer cho ai
 */
const { Op, literal } = require('sequelize');
const IAIRepository = require('@modules/ai/repositories/i-ai-repository');

// Sequelize impl của IAIRepository — wrap Product/Category access cho AI
// product search + deals/trending. Repo build LIKE conditions internal.
class SequelizeAIRepository extends IAIRepository {
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
          { description: { [Op.like]: `%${term}%` } },
        );
      });
      where[Op.or] = conditions;
    }

    if (minPrice) where.basePrice = { [Op.gte]: minPrice };
    if (maxPrice) where.basePrice = { ...where.basePrice, [Op.lte]: maxPrice };

    const categoryInclude = {
      model: this.Category,
      as: 'categories',
      through: { attributes: [] },
    };
    if (categoryName) {
      categoryInclude.where = { nameVi: { [Op.like]: `%${categoryName}%` } };
      categoryInclude.required = true;
    }

    return this.Product.findAll({
      where,
      include: [
        categoryInclude,
        {
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['stockQuantity'],
          required: false,
        },
      ],
      limit: limit || 20,
      order: [['createdAt', 'DESC']],
    });
  }

  async findActiveDeals(limit = 10) {
    return this.Product.findAll({
      where: { status: 'active', compareAtPrice: { [Op.gt]: 0 } },
      include: [
        {
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['stockQuantity'],
          required: false,
        },
      ],
      order: [[literal('((compare_at_price - base_price) / compare_at_price) DESC')]],
      limit,
    });
  }

  async findFeaturedProducts(limit = 10) {
    return this.Product.findAll({
      where: { status: 'active', isFeatured: true },
      include: [
        {
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['stockQuantity'],
          required: false,
        },
      ],
      limit,
      order: [['createdAt', 'DESC']],
    });
  }

  async createAnalyticsEvent({ event, userId, sessionId, productId, value, metadata, timestamp }) {
    // Analytics events lưu vào chat_messages với messageType='ai_chatbot' để tracking
    const { ChatMessage } = require('@models');
    return ChatMessage.create({
      sessionId: sessionId || `anon_${Date.now()}`,
      userId: userId || null,
      content: JSON.stringify({ event, productId, value, metadata }),
      role: 'user',
      messageType: 'ai_chatbot',
      intent: event,
    }).catch(() => null); // Non-blocking — analytics failure không fail request
  }

  async findProductForCart(productId) {
    return this.Product.findByPk(productId, {
      include: [
        {
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['stockQuantity'],
          required: false,
        },
      ],
    });
  }

  async addToCart({ userId, productId, variantId, quantity }) {
    const { Cart, CartItem } = require('@models');
    let cart = await Cart.findOne({ where: { userId } });
    if (!cart) cart = await Cart.create({ userId });
    return CartItem.create({ cartId: cart.id, productId, variantId, quantity });
  }
}

module.exports = SequelizeAIRepository;
