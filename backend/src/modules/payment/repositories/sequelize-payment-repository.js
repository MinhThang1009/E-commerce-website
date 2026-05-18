/**
 * @file SequelizePaymentRepository.js
 * @layer Repository
 * @module payment
 * @description Data access layer cho payment
 */
const IPaymentRepository = require('@modules/payment/repositories/i-payment-repository');

class SequelizePaymentRepository extends IPaymentRepository {
  constructor({
    Order, OrderItem, User, Cart, CartItem, DiscountCode,
    sequelize,
  }) {
    super();
    this.Order = Order;
    this.OrderItem = OrderItem;
    this.User = User;
    this.Cart = Cart;
    this.CartItem = CartItem;
    this.DiscountCode = DiscountCode;
    this.sequelize = sequelize;
  }

  // -------- Order --------

  async findOrderByPk(id, options = {}) {
    return this.Order.findByPk(id, options);
  }

  async findOrderByNumber(number) {
    return this.Order.findOne({ where: { number } });
  }

  async findOrderByPkWithItemsAndUser(id) {
    return this.Order.findByPk(id, {
      include: [
        {
          model: this.OrderItem, as: 'items',
          attributes: ['name', 'quantity', 'unitPrice', 'subtotal'],
        },
        { model: this.User, attributes: ['email'] },
      ],
    });
  }

  async lockOrder(id, transaction) {
    return this.Order.findByPk(id, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
  }

  async updateOrderPayment(orderId, patch, options = {}) {
    return this.Order.update(patch, { where: { id: orderId }, ...options });
  }

  async saveOrder(order, options = {}) {
    return order.save(options);
  }

  // -------- User --------

  async findUserById(id, options = {}) {
    return this.User.findByPk(id, options);
  }

  async saveUser(user, options = {}) {
    return user.save(options);
  }

  // -------- DiscountCode --------

  // Lấy discountCode liên quan order (qua orders.discountCodeId).
  async findOrderDiscountCode(orderId, options = {}) {
    const order = await this.Order.findByPk(orderId, {
      attributes: ['id', 'discountCodeId'],
      ...options,
    });
    if (!order || !order.discountCodeId) return null;
    return this.DiscountCode.findByPk(order.discountCodeId, options);
  }

  async incrementDiscountCodeUsedCount(codeId, options = {}) {
    const code = await this.DiscountCode.findByPk(codeId, options);
    if (!code) return null;
    return code.increment('usedCount', options);
  }

  // -------- Cart --------

  async findActiveCartsByUser(userId) {
    return this.Cart.findAll({ where: { userId, status: 'active' } });
  }

  async saveCart(cart, options = {}) {
    return cart.save(options);
  }

  async clearCartItems(cartId) {
    return this.CartItem.destroy({ where: { cartId } });
  }

  // -------- Transaction --------

  async runInTransaction(work) {
    return this.sequelize.transaction(work);
  }
}

module.exports = SequelizePaymentRepository;
