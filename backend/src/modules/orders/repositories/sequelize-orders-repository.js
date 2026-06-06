/**
 * @file SequelizeOrdersRepository.js
 * @layer Repository
 * @module orders
 * @description Data access layer cho orders
 */
const { col } = require('sequelize');
const IOrdersRepository = require('@modules/orders/repositories/i-orders-repository');

// Sequelize impl của IOrdersRepository — duy nhất layer truy cập Order/OrderItem
// + cross-models (Cart/CartItem/Product/Variant/User/DiscountCode/Inventory).
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
    InventoryLog,
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
    this.InventoryLog = InventoryLog;
    this.sequelize = sequelize;
  }

  // -------- Order --------

  async findOrderByPkBasic(id, options = {}) {
    return this.Order.findByPk(id, options);
  }

  async findOrderByIdAndUserId(id, userId, options = {}) {
    return this.Order.findOne({ where: { id, userId }, ...options });
  }

  async findOrderByPkWithItemsAndUser(id, options = {}) {
    const { transaction, lock } = options;
    const query = {
      include: [
        { model: this.User, attributes: ['id', 'firstName', 'lastName', 'email', 'phone'] },
        {
          association: 'items',
          include: [
            {
              model: this.Product,
              attributes: ['id', 'nameVi', 'slug'],
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
    };
    // Khóa hàng Order (of: Order) khi cần update trạng thái có hoàn kho — tránh
    // double-restore race với cancelOrder của user chạy đồng thời.
    if (transaction) query.transaction = transaction;
    if (lock) query.lock = { level: lock, of: this.Order };
    return this.Order.findByPk(id, query);
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
              attributes: ['id', 'nameVi', 'slug'],
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
              attributes: ['id', 'nameVi', 'basePrice', 'slug'],
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
      distinct: true, // Đếm đúng số Orders, không bị inflate bởi JOIN với OrderItems
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

  async findOrderForCancel(id, userId, options = {}) {
    const { lock, transaction } = options;
    const query = {
      where: { id, userId },
      include: [
        {
          association: 'items',
          include: [{ model: this.Product }, { model: this.ProductVariant }],
        },
        { association: 'appliedDiscount', required: false },
      ],
    };
    // Đọc trong transaction + khóa hàng đơn (chỉ OF order để tránh deadlock với createOrder
    // vốn khóa product_variants) — chống double-cancel/double-restore tồn kho khi 2 request đồng thời
    if (transaction) query.transaction = transaction;
    if (lock) query.lock = { level: lock, of: this.Order };
    return this.Order.findOne(query);
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
    // Hủy pending orders cũ + HOÀN LẠI tồn kho đã trừ (nếu chỉ set 'cancelled' mà không
    // restore → kho thiếu ảo vĩnh viễn khi user checkout lại). Phải chạy trong transaction
    // của createOrder để atomic.
    const { transaction } = options;
    // SELECT FOR UPDATE trên orders để serialize concurrent createOrder cho cùng user —
    // không có lock → 2 request đồng thời cùng thấy cùng pending order → double-restore stock (phantom).
    const manualMethods = ['cod', 'bank_transfer', 'installment'];
    const pendingOrders = await this.Order.findAll({
      where: { userId, status: 'pending' },
      include: [
        {
          association: 'items',
          include: [{ model: this.Product }, { model: this.ProductVariant }],
        },
        { association: 'appliedDiscount', required: false },
      ],
      transaction,
      lock: transaction?.LOCK?.UPDATE,
    });
    for (const order of pendingOrders) {
      for (const item of order.items) {
        if (item.variantId) {
          await this.restoreVariantStock(item.ProductVariant, item.quantity, { transaction });
        } else {
          await this.restoreProductStock(item.Product, item.quantity, { transaction });
        }
      }
      // Hoàn lại discount.usedCount cho đơn manual-payment đã dùng mã (tránh quota bị tiêu dù đơn bị hủy)
      if (order.appliedDiscount && manualMethods.includes(order.paymentMethod)) {
        await this.decrementDiscountCodeUsage(order.appliedDiscount, { transaction });
      }
      order.status = 'cancelled';
      await order.save({ transaction });
    }
    return pendingOrders.length;
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
              attributes: ['id', 'nameVi', 'slug', 'basePrice', 'status'],
              include: [
                { association: 'defaultVariant', attributes: ['id', 'stockQuantity'] },
                {
                  association: 'productImages',
                  attributes: ['imageUrl', 'isThumbnail'],
                  required: false,
                },
              ],
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

  async findActiveCartsByUser(userId, options = {}) {
    return this.Cart.findAll({ where: { userId, status: 'active' }, ...options });
  }

  async clearCartItems(cartId, options = {}) {
    return this.CartItem.destroy({ where: { cartId }, ...options });
  }

  // -------- Product / Variant --------

  async findProductWithDefaultVariant(id, options = {}) {
    return this.Product.findByPk(id, {
      attributes: ['id', 'nameVi', 'slug', 'basePrice', 'status'],
      include: [
        { association: 'defaultVariant', attributes: ['id', 'stockQuantity'] },
        { association: 'productImages', attributes: ['imageUrl', 'isThumbnail'], required: false },
      ],
      ...options,
    });
  }

  async findVariantBasic(id, productId, options = {}) {
    const where = { id };
    if (productId !== undefined) where.productId = productId;
    return this.ProductVariant.findOne({
      where,
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
    // Atomic increment (UPDATE ... SET stock = stock + by) thay vì read-modify-write,
    // tránh mất cập nhật khi có thao tác tồn kho đồng thời
    return product.increment('stockQuantity', { by, ...options });
  }

  async restoreVariantStock(variant, by, options = {}) {
    return variant.increment('stockQuantity', { by, ...options });
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

  async decrementDiscountCodeUsage(code, options = {}) {
    return code.decrement('usedCount', options);
  }

  // -------- User --------

  async findUserById(id, options = {}) {
    return this.User.findByPk(id, options);
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
