/**
 * @file inventoryService.js
 * @layer Service
 * @module inventory
 * @description Business logic layer cho inventory
 * @depends-on sequelize-inventory-repository, eventBus, logger
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 */
const { AppError } = require('@shared/errors');

// Quy tắc validate số lượng nhập kho và thao tác tăng/giảm tồn kho
function _validateRestockQty(quantity) {
  const qty = parseInt(quantity, 10);
  if (!qty || qty <= 0) return { valid: false, reason: 'Số lượng nhập phải là số nguyên dương' };
  return { valid: true, quantity: qty };
}
// Trả về { previous, current, change } sau khi cộng stock vào stockable
function _addStock(stockable, qty) {
  const amount = Number(qty);
  const previous = stockable.stockQuantity || 0;
  stockable.stockQuantity = previous + amount;
  return { previous, current: stockable.stockQuantity, change: amount };
}

// Inventory Service — admin restock + view inventory log.
class InventoryService {
  constructor({ inventoryRepository, sequelize, eventBus, logger }) {
    this.repo = inventoryRepository;
    this.sequelize = sequelize;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // POST /api/inventory/products/:productId/restock — admin nhập hàng.
  async restockProduct({ productId, variantId, quantity, note, adminId }) {
    const validated = _validateRestockQty(quantity);
    if (!validated.valid) throw new AppError(validated.reason, 400);
    const qty = validated.quantity;

    const product = await this.repo.findProductById(productId);
    if (!product) throw new AppError('inventory.productNotFound', 404);

    let stockable;
    let kind;
    if (variantId) {
      const variant = await this.repo.findVariantByIdAndProductId(variantId, productId);
      if (!variant) throw new AppError('inventory.variantNotFound', 404);
      stockable = variant;
      kind = 'variant';
    } else {
      stockable = product;
      kind = 'product';
    }

    const { previous, current, change } = _addStock(stockable, qty);

    // Wrap stock updates + log trong transaction để đảm bảo atomicity
    const log = await this.sequelize.transaction(async (tx) => {
      const opts = { transaction: tx };

      if (kind === 'variant') {
        stockable.isAvailable = true;
        await stockable.save(opts);

        const total = await this.repo.sumVariantStockByProductId(productId, opts);
        product.stockQuantity = total || 0;
        await product.save(opts);
      } else {
        await stockable.save(opts);
      }

      return this.repo.createInventoryLog(
        {
          productId: parseInt(productId, 10),
          variantId: variantId ? parseInt(variantId, 10) : null,
          changeType: 'restock',
          changeAmount: change,
          previousStock: previous,
          newStock: current,
          note: note || null,
          createdBy: adminId,
        },
        opts,
      );
    });

    await this.eventBus.publish({
      type: 'inventory.restocked',
      payload: {
        productId: parseInt(productId, 10),
        variantId: variantId ? parseInt(variantId, 10) : null,
        quantity: qty,
        previousStock: previous,
        newStock: current,
        adminId,
      },
      occurredAt: new Date().toISOString(),
    });

    return {
      productId: parseInt(productId, 10),
      variantId: variantId || null,
      previousStock: previous,
      newStock: current,
      quantity: qty,
      log,
    };
  }

  // GET /api/inventory/logs — list inventory logs với filter
  async getInventoryLogs({ page = 1, limit = 20, productId, changeType }) {
    const lim = Math.min(parseInt(limit, 10) || 20, 100);
    const off = (parseInt(page, 10) - 1) * lim;

    const where = {};
    if (productId) where.productId = parseInt(productId, 10);
    if (changeType) where.changeType = changeType;

    const { count, rows } = await this.repo.findInventoryLogs({ where, limit: lim, offset: off });
    return {
      data: rows,
      total: count,
      page: parseInt(page, 10),
      limit: lim,
    };
  }
}

module.exports = InventoryService;
