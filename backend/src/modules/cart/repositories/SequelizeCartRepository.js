const { col } = require('sequelize');
const ICartRepository = require('./ICartRepository');

// Sequelize impl của ICartRepository — duy nhất layer truy cập Cart/CartItem/
// Product/Variant/WarrantyPackage model trong cart module.
//
// findOrCreate options + transaction được forward thẳng sang Sequelize để
// service control biên transaction.
class SequelizeCartRepository extends ICartRepository {
  constructor({ Cart, CartItem, Product, ProductVariant, WarrantyPackage, sequelize }) {
    super();
    if (!Cart) throw new Error('SequelizeCartRepository: Cart model bắt buộc');
    if (!CartItem) throw new Error('SequelizeCartRepository: CartItem model bắt buộc');
    if (!Product) throw new Error('SequelizeCartRepository: Product model bắt buộc');
    if (!ProductVariant) throw new Error('SequelizeCartRepository: ProductVariant model bắt buộc');
    if (!WarrantyPackage)
      throw new Error('SequelizeCartRepository: WarrantyPackage model bắt buộc');
    if (!sequelize) throw new Error('SequelizeCartRepository: sequelize bắt buộc');

    this.Cart = Cart;
    this.CartItem = CartItem;
    this.Product = Product;
    this.ProductVariant = ProductVariant;
    this.WarrantyPackage = WarrantyPackage;
    this.sequelize = sequelize;
  }

  // -------- Cart aggregate --------

  async findActiveCartByUserId(userId) {
    return this.Cart.findOne({ where: { userId, status: 'active' } });
  }

  async findActiveCartBySessionId(sessionId) {
    return this.Cart.findOne({ where: { sessionId, status: 'active', userId: null } });
  }

  async findOrCreateActiveCartByUserId(userId, options = {}) {
    const [cart] = await this.Cart.findOrCreate({
      where: { userId, status: 'active' },
      defaults: { userId },
      ...options,
    });
    return cart;
  }

  async findOrCreateActiveCartBySessionId(sessionId, options = {}) {
    const [cart] = await this.Cart.findOrCreate({
      where: { sessionId, status: 'active' },
      defaults: { sessionId },
      ...options,
    });
    return cart;
  }

  async saveCart(cart, options = {}) {
    return cart.save(options);
  }

  // -------- Cart item --------

  async findCartItemById(id, options = {}) {
    return this.CartItem.findByPk(id, options);
  }

  async findCartItemsByCartId(cartId, options = {}) {
    return this.CartItem.findAll({ where: { cartId }, ...options });
  }

  async findCartItemMatching(query, options = {}) {
    return this.CartItem.findOne({ where: query, ...options });
  }

  async createCartItem(payload, options = {}) {
    return this.CartItem.create(payload, options);
  }

  async saveCartItem(item, options = {}) {
    return item.save(options);
  }

  async deleteCartItem(item, options = {}) {
    return item.destroy(options);
  }

  async clearCartItems(cartId, options = {}) {
    return this.CartItem.destroy({ where: { cartId }, ...options });
  }

  async sumCartItemQuantity(cartId) {
    return this.CartItem.sum('quantity', { where: { cartId } });
  }

  // -------- Catalog (cross-module shortcut) --------

  async findProductById(id) {
    return this.Product.findByPk(id, {
      include: [{ association: 'defaultVariant' }],
    });
  }

  async findVariantByIdAndProductId(variantId, productId) {
    return this.ProductVariant.findOne({ where: { id: variantId, productId } });
  }

  async findActiveWarrantyPackagesByIds(ids) {
    if (!ids || ids.length === 0) return [];
    return this.WarrantyPackage.findAll({ where: { id: ids, isActive: true } });
  }

  // -------- Eager load helpers --------

  async findCartItemsWithDetails(cartId) {
    return this.CartItem.findAll({
      where: { cartId },
      include: [
        {
          model: this.Product,
          attributes: ['id', 'name', 'slug', 'basePrice'],
          include: [
            { association: 'productImages', required: false },
            { association: 'defaultVariant', required: false },
            // Include tất cả variants để tính tổng stock (stock thực ở variant level)
            { association: 'variants', attributes: ['stockQuantity'], required: false },
          ],
        },
        {
          model: this.ProductVariant,
          attributes: ['id', [col('variant_name'), 'name'], 'price', 'stockQuantity', 'attributes'],
        },
      ],
    });
  }

  async findCartItemByIdWithCartAndStock(id) {
    return this.CartItem.findByPk(id, {
      include: [
        { model: this.Cart, attributes: ['id', 'userId', 'sessionId'] },
        {
          model: this.Product,
          attributes: ['id'],
          include: [{ association: 'defaultVariant', attributes: ['stockQuantity'] }],
        },
        { model: this.ProductVariant, attributes: ['id', 'stockQuantity'] },
      ],
    });
  }

  async findCartItemsForValidation(cartId) {
    return this.CartItem.findAll({
      where: { cartId },
      include: [
        {
          model: this.Product,
          attributes: ['id', 'name', 'basePrice'],
          include: [{ association: 'defaultVariant', attributes: ['stockQuantity'] }],
        },
        {
          model: this.ProductVariant,
          attributes: ['id', [col('variant_name'), 'name'], 'price', 'stockQuantity'],
        },
      ],
    });
  }

  async findCartItemsForMerge(cartId, options = {}) {
    return this.CartItem.findAll({
      where: { cartId },
      include: [
        {
          model: this.Product,
          attributes: ['id', 'basePrice'],
          include: [
            { association: 'defaultVariant', attributes: ['id', 'stockQuantity', 'price'] },
          ],
        },
        {
          model: this.ProductVariant,
          attributes: ['id', 'stockQuantity', 'price'],
        },
      ],
      ...options,
    });
  }

  // -------- Transaction --------

  async runInTransaction(work) {
    return this.sequelize.transaction(work);
  }
}

module.exports = SequelizeCartRepository;
