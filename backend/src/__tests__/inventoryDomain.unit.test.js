// Phase 42.13 — Unit tests cho Inventory domain (InventoryAggregate + Policy).
const InventoryAggregate = require('../modules/inventory/domain/aggregates/InventoryAggregate');
const { canDeduct, validateRestockQuantity } = require('../modules/inventory/domain/policies/InventoryPolicy');

describe('Inventory Domain', () => {
  describe('InventoryPolicy', () => {
    test('canDeduct stock đủ → true', () => {
      expect(canDeduct(10, 5)).toBe(true);
      expect(canDeduct(10, 10)).toBe(true);
    });

    test('canDeduct stock không đủ → false', () => {
      expect(canDeduct(5, 10)).toBe(false);
      expect(canDeduct(0, 1)).toBe(false);
    });

    test('validateRestockQuantity số dương → valid', () => {
      expect(validateRestockQuantity(5)).toEqual({ valid: true, quantity: 5 });
      expect(validateRestockQuantity('10')).toEqual({ valid: true, quantity: 10 });
    });

    test('validateRestockQuantity 0/âm/non-number → invalid', () => {
      expect(validateRestockQuantity(0).valid).toBe(false);
      expect(validateRestockQuantity(-5).valid).toBe(false);
      expect(validateRestockQuantity('abc').valid).toBe(false);
      expect(validateRestockQuantity(null).valid).toBe(false);
    });
  });

  describe('InventoryAggregate', () => {
    test('throw nếu thiếu stockable', () => {
      expect(() => new InventoryAggregate(null)).toThrow();
    });

    test('throw nếu kind không phải product/variant', () => {
      expect(() => new InventoryAggregate({}, 'invalid')).toThrow();
    });

    test('default kind = product', () => {
      const agg = new InventoryAggregate({ stockQuantity: 10 });
      expect(agg.kind).toBe('product');
    });

    test('deductStock đủ → giảm + trả {previous, current, change}', () => {
      const stockable = { stockQuantity: 10 };
      const result = new InventoryAggregate(stockable).deductStock(3);
      expect(stockable.stockQuantity).toBe(7);
      expect(result).toEqual({ previous: 10, current: 7, change: -3 });
    });

    test('deductStock vượt stock → DomainError INSUFFICIENT_STOCK', () => {
      const stockable = { stockQuantity: 5 };
      expect(() => new InventoryAggregate(stockable).deductStock(10)).toThrow();
      try {
        new InventoryAggregate(stockable).deductStock(10);
      } catch (err) {
        expect(err.domainCode).toBe('INSUFFICIENT_STOCK');
        expect(err.statusCode).toBe(422);
      }
    });

    test('deductStock số âm/0 → DomainError INVALID_QUANTITY', () => {
      const stockable = { stockQuantity: 10 };
      expect(() => new InventoryAggregate(stockable).deductStock(0)).toThrow();
      expect(() => new InventoryAggregate(stockable).deductStock(-5)).toThrow();
    });

    test('restoreStock cộng + trả change=qty', () => {
      const stockable = { stockQuantity: 5 };
      const result = new InventoryAggregate(stockable).restoreStock(3);
      expect(stockable.stockQuantity).toBe(8);
      expect(result).toEqual({ previous: 5, current: 8, change: 3 });
    });

    test('restock alias của restoreStock', () => {
      const stockable = { stockQuantity: 0 };
      new InventoryAggregate(stockable).restock(20);
      expect(stockable.stockQuantity).toBe(20);
    });

    test('isAvailable: stock > 0 → true', () => {
      expect(new InventoryAggregate({ stockQuantity: 5 }).isAvailable()).toBe(true);
      expect(new InventoryAggregate({ stockQuantity: 0 }).isAvailable()).toBe(false);
    });

    test('toJSON: trả {kind, id, stockQuantity}', () => {
      const stockable = { id: 7, stockQuantity: 10 };
      const json = new InventoryAggregate(stockable, 'variant').toJSON();
      expect(json).toEqual({ kind: 'variant', id: 7, stockQuantity: 10 });
    });
  });
});
