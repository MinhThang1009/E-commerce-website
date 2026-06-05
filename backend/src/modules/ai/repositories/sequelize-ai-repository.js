/**
 * @file SequelizeAiRepository.js
 * @layer Repository
 * @module ai
 * @description Data access layer cho ai
 */
const IAIRepository = require('@modules/ai/repositories/i-ai-repository');

// Sequelize impl của IAIRepository — wrap Product/Category access cho AI
// product search + add-to-cart + analytics. Repo build LIKE conditions internal.
class SequelizeAIRepository extends IAIRepository {
  constructor({ Product, ProductVariant, Category, sequelize }) {
    super();
    this.Product = Product;
    this.ProductVariant = ProductVariant;
    this.Category = Category;
    this.sequelize = sequelize;
  }

  async createAnalyticsEvent({ event, userId, sessionId, productId, value, metadata, timestamp }) {
    // Analytics events lưu vào chat_messages với messageType='ai_chatbot' để tracking
    const { ChatMessage } = require('@models');
    return ChatMessage.create({
      sessionId: sessionId || `anon_${Date.now()}`,
      userId: userId || null,
      content: JSON.stringify({ event, productId, value, metadata }),
      role: 'user',
      messageType: 'support_chat', // dùng support_chat để phân biệt với chat messages thật
      intent: event,
    }).catch(() => null); // Non-blocking — analytics failure không fail request
  }

  async findProductForCart(productId) {
    return this.Product.findByPk(productId, {
      include: [
        {
          model: this.ProductVariant,
          as: 'variants',
          attributes: ['id', 'stockQuantity'],
          required: false,
        },
      ],
    });
  }

  async addToCart({ userId, productId, variantId, quantity }) {
    const { Cart, CartItem } = require('@models');
    return this.sequelize.transaction(async (transaction) => {
      // Resolve variantId nếu không được truyền vào — ưu tiên isDefault=true, fallback về variant đầu tiên
      let resolvedVariantId = variantId;
      if (!resolvedVariantId) {
        const defaultVariant = await this.ProductVariant.findOne({
          where: { productId },
          order: [
            ['isDefault', 'DESC'],
            ['id', 'ASC'],
          ],
          attributes: ['id', 'price'],
          transaction,
        });
        if (defaultVariant) resolvedVariantId = defaultVariant.id;
      }
      const variant = resolvedVariantId
        ? await this.ProductVariant.findByPk(resolvedVariantId, {
            attributes: ['price'],
            transaction,
          })
        : null;
      const unitPrice = variant ? variant.price : 0;
      let cart = await Cart.findOne({ where: { userId, status: 'active' }, transaction });
      if (!cart) cart = await Cart.create({ userId, status: 'active' }, { transaction });
      // Nếu đã có item cùng product+variant → tăng quantity thay vì tạo mới
      const existing = await CartItem.findOne({
        where: { cartId: cart.id, productId, variantId: resolvedVariantId },
        transaction,
      });
      if (existing) {
        return existing.update({ quantity: existing.quantity + quantity }, { transaction });
      }
      return CartItem.create(
        { cartId: cart.id, productId, variantId: resolvedVariantId, quantity, unitPrice },
        { transaction },
      );
    });
  }
}

module.exports = SequelizeAIRepository;
