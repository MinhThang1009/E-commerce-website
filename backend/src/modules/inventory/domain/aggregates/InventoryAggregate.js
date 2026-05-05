const { DomainError } = require('../../../../shared/errors');
const { canDeduct } = require('../policies/InventoryPolicy');

// InventoryAggregate — wrap Product/Variant stock domain. Enforce invariant:
// stockQuantity >= 0 sau mọi mutation.
//
// Aggregate KHÔNG persist — service gọi repo.saveStock(stockable, options).
// Stockable = Product (parent) HOẶC ProductVariant. Method check kind qua
// _kind metadata.
class InventoryAggregate {
  constructor(stockable, kind = 'product') {
    if (!stockable) throw new Error('InventoryAggregate: stockable bắt buộc');
    if (!['product', 'variant'].includes(kind)) {
      throw new Error(`InventoryAggregate: kind phải là 'product' hoặc 'variant', got ${kind}`);
    }
    this.stockable = stockable;
    this.kind = kind;
  }

  get stockQuantity() {
    return this.stockable.stockQuantity || 0;
  }

  // deductStock: trừ stock theo qty. Throw DomainError nếu vượt invariant.
  deductStock(qty) {
    const required = Number(qty);
    if (!Number.isFinite(required) || required <= 0) {
      throw new DomainError('Số lượng phải là số dương', 'INVALID_QUANTITY');
    }
    if (!canDeduct(this.stockQuantity, required)) {
      throw new DomainError(
        `Không đủ tồn kho (hiện có ${this.stockQuantity}, yêu cầu ${required})`,
        'INSUFFICIENT_STOCK'
      );
    }
    const previous = this.stockQuantity;
    this.stockable.stockQuantity = previous - required;
    return { previous, current: this.stockable.stockQuantity, change: -required };
  }

  // restoreStock: cộng stock (vd hủy đơn). Idempotent đến khi gọi.
  restoreStock(qty) {
    const amount = Number(qty);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new DomainError('Số lượng phải là số dương', 'INVALID_QUANTITY');
    }
    const previous = this.stockQuantity;
    this.stockable.stockQuantity = previous + amount;
    return { previous, current: this.stockable.stockQuantity, change: amount };
  }

  // restock: admin nhập hàng — same as restoreStock semantically nhưng
  // event/log type khác (restock vs return).
  restock(qty) {
    return this.restoreStock(qty);
  }

  // Trả flag isAvailable bật khi stockQuantity > 0.
  isAvailable() {
    return this.stockQuantity > 0;
  }

  toJSON() {
    return {
      kind: this.kind,
      id: this.stockable.id,
      stockQuantity: this.stockQuantity,
    };
  }
}

module.exports = InventoryAggregate;
