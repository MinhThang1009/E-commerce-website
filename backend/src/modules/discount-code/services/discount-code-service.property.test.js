/**
 * @file discount-code-service.property.test.js
 * @layer Test (property-based)
 * @description Property test cho applyDiscountCode — kiểm INVARIANT nghiệp vụ với HÀNG NGÀN
 *   input random (fast-check), bắt outcome người-viết-test-không-nghĩ-tới (FRAMEWORK §7).
 *   Proof-of-wiring tier property của verify-workflow. Map invariants.ecommerce.md:
 *     INV-DSC (cap): discountAmount ≤ orderAmount; percent → ≤ maxDiscountAmount; luôn ≥ 0.
 */
const fc = require('fast-check');
const { Op } = require('sequelize');

jest.mock('@modules/discount-code/repositories/sequelize-discount-code-repository');
const discountCodeRepository = require('@modules/discount-code/repositories/sequelize-discount-code-repository');
discountCodeRepository.getOp = jest.fn().mockReturnValue(Op);

const discountCodeService = require('./discount-code-service');

beforeEach(() => jest.clearAllMocks());

describe('applyDiscountCode — property invariants (INV-DSC)', () => {
  it('percent: discountAmount luôn ≤ orderAmount, ≤ maxDiscountAmount, và ≥ 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 100 }), // value (%)
        fc.integer({ min: 100_000, max: 50_000_000 }), // orderAmount (≥ minOrder)
        fc.integer({ min: 1_000, max: 5_000_000 }), // maxDiscountAmount
        async (value, orderAmount, maxDiscountAmount) => {
          discountCodeRepository.findOne.mockResolvedValue({
            id: 'c1',
            code: 'P',
            type: 'percent',
            value,
            minOrderAmount: 0,
            maxDiscountAmount,
            usageLimit: null,
            usedCount: 0,
            isActive: true,
            startDate: null,
            endDate: null,
          });
          const { discountAmount } = await discountCodeService.applyDiscountCode('P', orderAmount);
          expect(discountAmount).toBeGreaterThanOrEqual(0);
          expect(discountAmount).toBeLessThanOrEqual(orderAmount);
          expect(discountAmount).toBeLessThanOrEqual(maxDiscountAmount);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('fixed: discountAmount không bao giờ vượt orderAmount (cap), ≥ 0', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000_000 }), // value (fixed)
        fc.integer({ min: 0, max: 50_000_000 }), // orderAmount
        async (value, orderAmount) => {
          discountCodeRepository.findOne.mockResolvedValue({
            id: 'c2',
            code: 'F',
            type: 'fixed',
            value,
            minOrderAmount: 0,
            maxDiscountAmount: null,
            usageLimit: null,
            usedCount: 0,
            isActive: true,
            startDate: null,
            endDate: null,
          });
          const { discountAmount } = await discountCodeService.applyDiscountCode('F', orderAmount);
          expect(discountAmount).toBeGreaterThanOrEqual(0);
          expect(discountAmount).toBeLessThanOrEqual(orderAmount);
        },
      ),
      { numRuns: 300 },
    );
  });
});
