/**
 * @file inventory-service.property.test.js
 * @layer Test (property-based)
 * @description Property test cho restockProduct + getInventoryLogs — kiểm INVARIANT
 *   tồn kho với HÀNG NGÀN tổ hợp previous/qty/page/limit random (fast-check). Oracle
 *   độc lập = công thức nghiệp vụ, so với giá trị service tính & ghi vào InventoryLog.
 *   Map invariants.ecommerce.md (GATE-A) §I Stock:
 *     INV-STK (restock): newStock = previousStock + parseInt(qty)  — cộng THUẦN, bảo toàn
 *       (đối ngẫu của INV-STK-1 hoàn kho `stock += quantity`)
 *     changeAmount === parseInt(qty); previousStock === stock cũ (delta khớp log)
 *     Validate: qty ≤ 0 / không parse được số nguyên dương → 400 (KHÔNG ghi log)
 *     Variant: product.stockQuantity = Σ(tất cả variant) (sync), result.newStock theo variant
 *     Phân trang: offset = (page−1) × min(limit,100); limit luôn ≤ 100
 */
const fc = require('fast-check');

const InventoryService = require('./inventory-service');

// Harness: inject sequelize + repo giả (transaction chạy callback ngay, không DB thật).
function buildService() {
  const sequelize = { transaction: jest.fn(async (work) => work({})) };
  const repo = {
    findProductById: jest.fn(),
    findVariantByIdAndProductId: jest.fn(),
    sumVariantStockByProductId: jest.fn(),
    createInventoryLog: jest.fn(async (data) => ({ id: 1, ...data })),
    findInventoryLogs: jest.fn(),
  };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  const service = new InventoryService({ inventoryRepository: repo, sequelize, logger });
  return { service, repo };
}

describe('restockProduct — property invariant cộng tồn kho (GATE-A §I Stock)', () => {
  it('product-only: newStock = previous + qty; changeAmount = qty; previousStock = previous (bảo toàn)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1_000_000 }), // previous stock
        fc.integer({ min: 1, max: 100_000 }), // qty (số nguyên dương)
        async (previous, qty) => {
          const { service, repo } = buildService();
          const product = { id: 1, stockQuantity: previous, save: jest.fn() };
          repo.findProductById.mockResolvedValue(product);

          const result = await service.restockProduct({ productId: 1, quantity: qty, adminId: 9 });

          // Bảo toàn: restock là phép cộng thuần
          expect(result.previousStock).toBe(previous);
          expect(result.newStock).toBe(previous + qty);
          expect(result.quantity).toBe(qty);
          expect(product.stockQuantity).toBe(previous + qty);

          // Delta ghi vào log phải khớp (audit trail tài chính)
          const logArg = repo.createInventoryLog.mock.calls[0][0];
          expect(logArg.changeType).toBe('restock');
          expect(logArg.changeAmount).toBe(qty);
          expect(logArg.previousStock).toBe(previous);
          expect(logArg.newStock).toBe(previous + qty);
          // newStock − previousStock === changeAmount (bất biến delta)
          expect(logArg.newStock - logArg.previousStock).toBe(logArg.changeAmount);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('qty chuỗi số / số thực → parse đúng theo parseInt (cắt phần thập phân)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }), // previous
        fc.integer({ min: 1, max: 9999 }), // phần nguyên qty
        fc.integer({ min: 0, max: 99 }), // phần thập phân (parseInt cắt bỏ)
        async (previous, intQty, frac) => {
          const { service, repo } = buildService();
          const product = { id: 1, stockQuantity: previous, save: jest.fn() };
          repo.findProductById.mockResolvedValue(product);

          // "123.45" → parseInt = 123 (cắt thập phân, không làm tròn)
          const qtyStr = `${intQty}.${String(frac).padStart(2, '0')}`;
          const result = await service.restockProduct({
            productId: 1,
            quantity: qtyStr,
            adminId: 1,
          });

          expect(result.quantity).toBe(intQty);
          expect(result.newStock).toBe(previous + intQty);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('qty ≤ 0 hoặc không parse được số nguyên dương → luôn 400, KHÔNG ghi log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.integer({ min: -100_000, max: 0 }), // ≤ 0
          // parseInt(x,10) = NaN cho mọi giá trị dưới (không có chữ số ở đầu)
          fc.constantFrom('abc', '', '   ', 'NaN', 'x12', null, undefined, false),
        ),
        async (badQty) => {
          const { service, repo } = buildService();
          repo.findProductById.mockResolvedValue({ id: 1, stockQuantity: 5, save: jest.fn() });

          await expect(
            service.restockProduct({ productId: 1, quantity: badQty, adminId: 1 }),
          ).rejects.toMatchObject({ statusCode: 400 });
          // Validate fail trước mọi side-effect → tuyệt đối không ghi log
          expect(repo.createInventoryLog).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('variant restock: variant cộng thuần; product.stockQuantity = Σ(variant) (sync); result theo variant', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100_000 }), // tồn variant trước
        fc.integer({ min: 1, max: 100_000 }), // qty
        fc.integer({ min: 0, max: 5_000_000 }), // tổng tất cả variant (repo trả)
        async (variantPrev, qty, sum) => {
          const { service, repo } = buildService();
          const product = { id: 1, stockQuantity: 0, save: jest.fn() };
          const variant = { id: 5, stockQuantity: variantPrev, save: jest.fn() };
          repo.findProductById.mockResolvedValue(product);
          repo.findVariantByIdAndProductId.mockResolvedValue(variant);
          repo.sumVariantStockByProductId.mockResolvedValue(sum);

          const result = await service.restockProduct({
            productId: 1,
            variantId: 5,
            quantity: qty,
            adminId: 1,
          });

          expect(variant.stockQuantity).toBe(variantPrev + qty); // variant cộng thuần
          expect(variant.isAvailable).toBe(true);
          expect(product.stockQuantity).toBe(sum); // product = tổng variant (đồng bộ)
          expect(result.newStock).toBe(variantPrev + qty); // result theo variant vừa nhập
          expect(result.previousStock).toBe(variantPrev);
          expect(result.variantId).toBe(5);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('getInventoryLogs — property invariant phân trang', () => {
  it('offset = (page−1) × min(limit,100); limit luôn ≤ 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000 }), // page
        fc.integer({ min: 1, max: 5_000 }), // limit (gồm > 100 để test cap)
        async (page, limit) => {
          const { service, repo } = buildService();
          repo.findInventoryLogs.mockResolvedValue({ count: 0, rows: [] });

          await service.getInventoryLogs({ page, limit });

          const arg = repo.findInventoryLogs.mock.calls[0][0];
          const expectedLim = Math.min(limit, 100);
          expect(arg.limit).toBe(expectedLim);
          expect(arg.limit).toBeLessThanOrEqual(100);
          expect(arg.offset).toBe((page - 1) * expectedLim);
        },
      ),
      { numRuns: 200 },
    );
  });
});
