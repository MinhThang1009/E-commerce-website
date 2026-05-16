const { col } = require('sequelize');
const IOrdersRepository = require('./IOrdersRepository');

// Sequelize impl của IOrdersRepository — duy nhất layer truy cập Order/OrderItem
// + cross-models (Cart/CartItem/Product/Variant/User/DiscountCode/Loyalty/Inventory).
//
// Cross-module read shortcut (Cart/Product/Variant) sẽ được refactor khi
// inventory module DDD-lite hoàn tất Phase 5.
class SequelizeOrdersRepository extends IOrdersRepository {
  constructor({
    Order,
    OrderItem,
    Cart,
    CartItem,
    Product,
    ProductVariant,
    User,
    DiscountCode,
    LoyaltyHistory,
    InventoryLog,
    WarrantyPackage,
    sequelize,
  }) {
    super();
    if (!Order) throw new Error('SequelizeOrdersRepository: Order model bắt buộc');
    this.Order = Order;
    this.OrderItem = OrderItem;
    this.Cart = Cart;
    this.CartItem = CartItem;
    this.Product = Product;
    this.ProductVariant = ProductVariant;
    this.User = User;
    this.DiscountCode = DiscountCode;
    this.LoyaltyHistory = LoyaltyHistory;
    this.InventoryLog = InventoryLog;
    this.WarrantyPackage = WarrantyPackage;
    this.sequelize = sequelize;
  }

  // -------- Order --------

  async findOrderByPkBasic(id, options = {}) {
    return this.Order.findByPk(id, options);
  }

  async findOrderByIdAndUserId(id, userId, options = {}) {
    return this.Order.findOne({ where: { id, userId }, ...options });
  }

  async findOrderByPkWithItemsAndUser(id) {
    return this.Order.findByPk(id, {
      include: [
        { model: this.User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        {
          association: 'items',
          include: [
            {
              model: this.Product,
              attributes: ['id', 'name', 'slug'],
              include: [
                {
                  association: 'productImages',
                  attributes: ['id', 'imageUrl', 'isThumbnail'],
                },
              ],
            },
            {
              model: this.ProductVariant,
              attributes: ['id', [col('variant_name'), 'name'], 'sku', 'price'],
            },
          ],
        },
      ],
    });
  }

  async findOrderByNumberAndUserId(number, userId) {
    return this.Order.findOne({
      where: { number, userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: this.Product,
              attributes: ['id', 'name', 'slug'],
              include: [
                { association: 'productImages', attributes: ['id', 'imageUrl', 'isThumbnail'] },
              ],
            },
            {
              model: this.ProductVariant,
              attributes: ['id', [col('variant_name'), 'name'], 'sku', 'price'],
            },
          ],
        },
      ],
    });
  }

  async findOrderByNumberWithUserEmail(number) {
    return this.Order.findOne({
      where: { number },
      include: [{ model: this.User, attributes: ['email'] }],
    });
  }

  async findUserOrdersWithItems(userId, { limit, offset } = {}) {
    return this.Order.findAndCountAll({
      where: { userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: this.Product,
              attributes: ['id', 'name', 'basePrice', 'slug'],
              include: [
                { association: 'productImages', attributes: ['id', 'imageUrl', 'isThumbnail'] },
              ],
            },
            {
              model: this.ProductVariant,
              attributes: ['id', [col('variant_name'), 'name'], 'sku', 'price'],
            },
          ],
        },
      ],
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });
  }

  async findAllOrdersWithUser({ where = {}, limit, offset } = {}) {
    return this.Order.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });
  }

  async findOrderForCancel(id, userId) {
    return this.Order.findOne({
      where: { id, userId },
      include: [
        {
          association: 'items',
          include: [{ model: this.Product }, { model: this.ProductVariant }],
        },
      ],
    });
  }

  async createOrder(payload, options = {}) {
    return this.Order.create(payload, options);
  }

  async createOrderItem(payload, options = {}) {
    return this.OrderItem.create(payload, options);
  }

  async saveOrder(order, options = {}) {
    return order.save(options);
  }

  async cancelPendingOrdersByUser(userId, options = {}) {
    return this.Order.update(
      { status: 'cancelled' },
      { where: { userId, status: 'pending' }, ...options },
    );
  }

  // -------- Cart --------

  async findOrCreateActiveCart(userId, options = {}) {
    const [cart] = await this.Cart.findOrCreate({
      where: { userId, status: 'active' },
      defaults: { userId },
      ...options,
    });
    return cart;
  }

  async findActiveCartBySessionId(sessionId, options = {}) {
    return this.Cart.findOne({
      where: { sessionId, status: 'active', userId: null },
      include: [{ model: this.CartItem, as: 'items' }],
      ...options,
    });
  }

  async findCartByPkWithItemsDetails(cartId, options = {}) {
    return this.Cart.findByPk(cartId, {
      include: [
        {
          association: 'items',
          include: [
            {
              model: this.Product,
              attributes: ['id', 'name', 'slug', 'basePrice', 'status'],
              include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity'] }],
            },
            {
              model: this.ProductVariant,
              attributes: ['id', [col('variant_name'), 'name'], 'price', 'stockQuantity', 'sku'],
            },
          ],
        },
      ],
      ...options,
    });
  }

  async findCartItemMatching(query, options = {}) {
    return this.CartItem.findOne({ where: query, ...options });
  }

  async saveCartItem(item, options = {}) {
    return item.save(options);
  }

  async deleteCartItem(item, options = {}) {
    return item.destroy(options);
  }

  async saveCart(cart, options = {}) {
    return cart.save(options);
  }

  async findActiveCartsByUser(userId) {
    return this.Cart.findAll({ where: { userId, status: 'active' } });
  }

  async clearCartItems(cartId) {
    return this.CartItem.destroy({ where: { cartId } });
  }

  // -------- Product / Variant --------

  async findProductWithDefaultVariant(id, options = {}) {
    return this.Product.findByPk(id, {
      attributes: ['id', 'name', 'slug', 'basePrice', 'status'],
      include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity'] }],
      ...options,
    });
  }

  async findVariantBasic(id, options = {}) {
    return this.ProductVariant.findByPk(id, {
      attributes: ['id', [col('variant_name'), 'name'], 'price', 'stockQuantity', 'sku'],
      ...options,
    });
  }

  async lockProduct(id, transaction) {
    return this.Product.findByPk(id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
  }

  async lockVariant(id, transaction) {
    return this.ProductVariant.findByPk(id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
  }

  async decrementProductStock(product, by, options = {}) {
    return product.decrement('stockQuantity', { by, ...options });
  }

  async decrementVariantStock(variant, by, options = {}) {
    return variant.decrement('stockQuantity', { by, ...options });
  }

  async restoreProductStock(product, by, options = {}) {
    product.stockQuantity = product.stockQuantity + by;
    return product.save(options);
  }

  async restoreVariantStock(variant, by, options = {}) {
    variant.stockQuantity = variant.stockQuantity + by;
    return variant.save(options);
  }

  // -------- Warranty --------

  async findActiveWarrantyPackagesByIds(ids, options = {}) {
    return this.WarrantyPackage.findAll({
      where: { id: ids, isActive: true },
      ...options,
    });
  }

  // -------- DiscountCode --------

  async findActiveDiscountCode(code, options = {}) {
    return this.DiscountCode.findOne({
      where: { code, isActive: true },
      ...options,
    });
  }

  async incrementDiscountCodeUsage(code, options = {}) {
    return code.increment('usedCount', options);
  }

  // -------- User / Loyalty --------

  async findUserById(id, options = {}) {
    return this.User.findByPk(id, options);
  }

  async updateUserPoints(user, points, options = {}) {
    user.loyaltyPoints = points;
    return user.save(options);
  }

  async createLoyaltyHistory(payload, options = {}) {
    return this.LoyaltyHistory.create(payload, options);
  }

  async updateLoyaltyHistoryOrderId(filter, orderId, options = {}) {
    return this.LoyaltyHistory.update({ orderId }, { where: filter, ...options });
  }

  // -------- InventoryLog --------

  async createInventoryLogs(rows, options = {}) {
    if (!rows || rows.length === 0) return [];
    return this.InventoryLog.bulkCreate(rows, options);
  }

  // -------- Transaction --------

  async runInTransaction(work) {
    return this.sequelize.transaction(work);
  }
}

module.exports = SequelizeOrdersRepository;
