/**
 * Integration tests — Discount code edge cases với real DB.
 * Kiểm tra: mã hết hạn, concurrent usageLimit, cap maxDiscountAmount, fixed > subtotal.
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { DiscountCode } = require('@models');
const { Op } = require('sequelize');

const { applyDiscountCode } = require('@modules/discount-code/services/discount-code-service');

const TS = Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await DiscountCode.destroy({
    where: { code: { [Op.like]: `INT_DC_EDGE_${TS}%` } },
    force: true,
  });
});

describe('Discount edge cases — mã hết hạn', () => {
  test('Apply mã giảm giá đã hết hạn → throw lỗi', async () => {
    const expiredCode = await DiscountCode.create({
      code: `INT_DC_EDGE_${TS}_EXP`,
      type: 'percent',
      value: 10,
      minOrderAmount: 0,
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 2 * 86_400_000), // 2 ngày trước
      endDate: new Date(Date.now() - 86_400_000), // hết hạn hôm qua
    });

    await expect(applyDiscountCode(expiredCode.code, 500_000)).rejects.toThrow(
      'Mã giảm giá đã hết hạn',
    );
  });
});

describe('Discount edge cases — concurrent usageLimit', () => {
  test('Concurrent apply vượt usageLimit=1 → chỉ 1 request thành công', async () => {
    const limitedCode = await DiscountCode.create({
      code: `INT_DC_EDGE_${TS}_LIMIT`,
      type: 'fixed',
      value: 50_000,
      minOrderAmount: 0,
      usageLimit: 1, // Chỉ 1 lượt dùng
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    });

    // Simulate concurrent apply: đọc code + tăng usedCount trong transaction riêng
    const attemptApply = () =>
      sequelize.transaction(async (t) => {
        const dc = await DiscountCode.findOne({
          where: { code: limitedCode.code, isActive: true },
          lock: t.LOCK.UPDATE,
          transaction: t,
        });
        if (!dc) throw new Error('INVALID');
        if (dc.usageLimit !== null && dc.usedCount >= dc.usageLimit) {
          throw new Error('LIMIT_REACHED');
        }
        await dc.increment('usedCount', { transaction: t });
        return dc;
      });

    const results = await Promise.allSettled([attemptApply(), attemptApply(), attemptApply()]);

    const succeeded = results.filter((r) => r.status === 'fulfilled');
    const failed = results.filter(
      (r) => r.status === 'rejected' && r.reason.message === 'LIMIT_REACHED',
    );

    // Đúng 1 thành công, 2 bị reject vì vượt limit
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(2);

    await limitedCode.reload();
    expect(limitedCode.usedCount).toBe(1);
  });
});

describe('Discount edge cases — tính toán số tiền giảm', () => {
  test('Giảm giá percent không vượt maxDiscountAmount', async () => {
    const percentCode = await DiscountCode.create({
      code: `INT_DC_EDGE_${TS}_PCT_CAP`,
      type: 'percent',
      value: 50, // Giảm 50%
      minOrderAmount: 0,
      maxDiscountAmount: 50_000, // Tối đa 50.000
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    });

    // Subtotal = 500.000 → 50% = 250.000 nhưng bị cap ở 50.000
    const result = await applyDiscountCode(percentCode.code, 500_000);

    expect(result.discountAmount).toBe(50_000);
    expect(result.discountAmount).toBeLessThanOrEqual(50_000);
  });

  test('Giảm giá fixed lớn hơn subtotal → giá không âm (cap theo orderAmount)', async () => {
    const fixedCode = await DiscountCode.create({
      code: `INT_DC_EDGE_${TS}_FIX_OVER`,
      type: 'fixed',
      value: 500_000, // Giảm 500.000
      minOrderAmount: 0,
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86_400_000),
      endDate: new Date(Date.now() + 86_400_000),
    });

    // Subtotal = 100.000 nhưng fixed = 500.000 → phải cap về 100.000
    const orderAmount = 100_000;
    const result = await applyDiscountCode(fixedCode.code, orderAmount);

    // discountAmount không được vượt orderAmount → total không âm
    expect(result.discountAmount).toBeLessThanOrEqual(orderAmount);
    expect(result.discountAmount).toBeGreaterThan(0);
  });
});
