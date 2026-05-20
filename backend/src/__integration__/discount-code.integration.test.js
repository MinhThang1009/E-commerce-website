require('module-alias/register');
const sequelize = require('@config/sequelize');
const { DiscountCode } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await DiscountCode.destroy({ where: { code: { [Op.like]: `INT_DC_${TS}%` } }, force: true });
});

describe('DiscountCode Integration', () => {
  let dcPercent, dcFixed, dcExpired;

  test('Tạo mã giảm % hợp lệ', async () => {
    dcPercent = await DiscountCode.create({
      code: `INT_DC_${TS}_PCT`,
      type: 'percent',
      value: 10,
      minOrderAmount: 200_000,
      usageLimit: 5,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });
    expect(dcPercent.id).toBeDefined();
    expect(dcPercent.type).toBe('percent');
  });

  test('Tạo mã giảm fixed hợp lệ', async () => {
    dcFixed = await DiscountCode.create({
      code: `INT_DC_${TS}_FIX`,
      type: 'fixed',
      value: 50_000,
      minOrderAmount: 0,
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });
    expect(dcFixed.type).toBe('fixed');
  });

  test('Tạo mã đã hết hạn', async () => {
    dcExpired = await DiscountCode.create({
      code: `INT_DC_${TS}_EXP`,
      type: 'percent',
      value: 5,
      minOrderAmount: 0,
      usageLimit: 10,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 172800000),
      endDate: new Date(Date.now() - 86400000), // hết hạn hôm qua
    });
  });

  test('Apply mã hợp lệ — tăng usedCount', async () => {
    const now = new Date();
    const valid = await DiscountCode.findOne({
      where: {
        code: dcPercent.code,
        isActive: true,
        startDate: { [Op.lte]: now },
        endDate: { [Op.gte]: now },
      },
    });
    expect(valid).not.toBeNull();
    expect(valid.usedCount).toBeLessThan(valid.usageLimit);
    await valid.increment('usedCount');
    await valid.reload();
    expect(valid.usedCount).toBe(1);
  });

  test('Mã hết hạn — query không trả về', async () => {
    const now = new Date();
    const expired = await DiscountCode.findOne({
      where: {
        code: dcExpired.code,
        isActive: true,
        endDate: { [Op.gte]: now },
      },
    });
    expect(expired).toBeNull();
  });

  test('Mã unique — duplicate bị reject', async () => {
    await expect(
      DiscountCode.create({
        code: dcPercent.code,
        type: 'percent',
        value: 5,
        minOrderAmount: 0,
        usageLimit: 1,
        usedCount: 0,
        isActive: true,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      }),
    ).rejects.toThrow();
  });
});
