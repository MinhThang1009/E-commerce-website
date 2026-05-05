const { AppError } = require('../../../shared/errors');
const InventoryAggregate = require('../domain/aggregates/InventoryAggregate');
const { validateRestockQuantity } = require('../domain/policies/InventoryPolicy');
const StockRestockedEvent = require('../domain/events/StockRestockedEvent');

// Inventory Service — admin restock + view inventory log. Mọi state mutation
// qua InventoryAggregate (deductStock/restoreStock/restock) enforce invariant
// stockQuantity >= 0.
class InventoryService {
  constructor({ inventoryRepository, eventBus, logger }) {
    this.repo = inventoryRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // POST /api/inventory/products/:productId/restock — admin nhập hàng.
  async restockProduct({ productId, variantId, quantity, note, adminId }) {
    const validated = validateRestockQuantity(quantity);
    if (!validated.valid) throw new AppError(validated.reason, 400);
    const qty = validated.quantity;

    const product = await this.repo.findProductById(productId);
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    let stockable;
    let kind;
    if (variantId) {
      const variant = await this.repo.findVariantByIdAndProductId(variantId, productId);
      if (!variant) throw new AppError('Không tìm thấy biến thể', 404);
      stockable = variant;
      kind = 'variant';
    } else {
      stockable = product;
      kind = 'product';
    }

    const aggregate = new InventoryAggregate(stockable, kind);
    const { previous, current, change } = aggregate.restock(qty);

    if (kind === 'variant') {
      stockable.isAvailable = true;
      await this.repo.saveStockable(stockable);

      // Sync tổng stock + inStock của parent product
      const total = await this.repo.sumVariantStockByProductId(productId);
      product.stockQuantity = total || 0;
      product.inStock = (total || 0) > 0;
      await this.repo.saveStockable(product);
    } else {
      stockable.inStock = true;
      await this.repo.saveStockable(stockable);
    }

    const log = await this.repo.createInventoryLog({
      productId: parseInt(productId, 10),
      variantId: variantId ? parseInt(variantId, 10) : null,
      changeType: 'restock',
      changeAmount: change,
      previousStock: previous,
      newStock: current,
      note: note || null,
      createdBy: adminId,
    });

    await this.eventBus.publish(StockRestockedEvent({
      productId: parseInt(productId, 10),
      variantId: variantId ? parseInt(variantId, 10) : null,
      quantity: qty,
      previousStock: previous,
      newStock: current,
      adminId,
    }));

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
