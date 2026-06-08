/**
 * @file SequelizeAiRepository.js
 * @layer Repository
 * @module ai
 * @description Data access layer cho ai
 */
const IAIRepository = require('@modules/ai/repositories/i-ai-repository');
const { AppError } = require('@shared/errors');
const logger = require('@utils/logger');

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

  async createAnalyticsEvent({ event, userId, sessionId, productId, value, metadata }) {
    // Analytics events lưu vào chat_messages với messageType='support_chat' (phân biệt với chatbot messages thật)
    const { ChatMessage } = require('@models');
    // Không có inner .catch() — lỗi được xử lý bởi caller (ai-service.js fire-and-forget .catch())
    return ChatMessage.create({
      sessionId: sessionId || `anon_${Date.now()}`,
      userId: userId || null,
      content: JSON.stringify({ event, productId, value, metadata }),
      role: 'user',
      messageType: 'support_chat', // dùng support_chat để phân biệt với chat messages thật
      intent: event,
    });
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
      // SELECT FOR UPDATE: ngăn TOCTOU — stock check và CartItem write trong cùng transaction
      const product = await this.Product.findByPk(productId, {
        attributes: { include: ['basePrice'] },
        include: [
          {
            model: this.ProductVariant,
            as: 'variants',
            attributes: ['id', 'stockQuantity'],
            required: false,
          },
        ],
        lock: transaction.LOCK.UPDATE,
        transaction,
      });
      if (!product) throw new AppError('ai.productNotFound', 404);
      const variants = product.variants || [];
      const totalStock = variants.reduce((s, v) => s + (v.stockQuantity || 0), 0);
      // Tách 2 cases: SP có variant dùng totalStock; SP không có variant dùng stockQuantity
      if (product.status !== 'active') throw new AppError('ai.productInactive', 400);
      if (variants.length > 0 && totalStock <= 0) throw new AppError('ai.productOutOfStock', 400);
      if (variants.length === 0 && product.stockQuantity <= 0)
        throw new AppError('ai.productOutOfStock', 400);
      if (variantId) {
        const targetVariant = (product.variants || []).find(
          (v) => String(v.id) === String(variantId),
        );
        if (!targetVariant) throw new AppError('ai.variantNotFound', 400);
        if (targetVariant.stockQuantity <= 0) throw new AppError('ai.variantOutOfStock', 400);
      }

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
          lock: transaction.LOCK.UPDATE,
        });
        if (defaultVariant) {
          resolvedVariantId = defaultVariant.id;
          // Kiểm tra stock của default variant — product.variants đã có stockQuantity từ SELECT FOR UPDATE
          const resolvedVariantData = (product.variants || []).find(
            (v) => String(v.id) === String(resolvedVariantId),
          );
          if (!resolvedVariantData || resolvedVariantData.stockQuantity <= 0) {
            throw new AppError('ai.defaultVariantOutOfStock', 400);
          }
        }
      }
      const variant = resolvedVariantId
        ? await this.ProductVariant.findByPk(resolvedVariantId, {
            attributes: ['price'],
            transaction,
            lock: transaction.LOCK.UPDATE,
          })
        : null;
      const unitPrice = variant ? variant.price : (product.basePrice ?? 0);
      // findOrCreate atomic: tránh race condition tạo duplicate active cart (khớp pattern cart module)
      const [cart] = await Cart.findOrCreate({
        where: { userId, status: 'active' },
        defaults: { userId },
        transaction,
      });
      // Nếu đã có item cùng product+variant → tăng quantity thay vì tạo mới
      const existing = await CartItem.findOne({
        where: { cartId: cart.id, productId, variantId: resolvedVariantId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing) {
        // Kiểm tra quantity tích lũy không vượt stockQuantity
        const resolvedVariantForStock = (product.variants || []).find(
          (v) => String(v.id) === String(resolvedVariantId),
        );
        if (
          resolvedVariantForStock &&
          existing.quantity + quantity > resolvedVariantForStock.stockQuantity
        ) {
          throw new AppError('ai.cartQuantityExceedsStock', 400);
        } else if (!resolvedVariantId && existing.quantity + quantity > product.stockQuantity) {
          // SP không có variant: dùng product.stockQuantity làm giới hạn
          throw new AppError('ai.cartQuantityExceedsStock', 400);
        }
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
