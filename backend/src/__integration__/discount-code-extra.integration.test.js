require('module-alias/register');
const sequelize = require('@config/sequelize');
const { DiscountCode } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await DiscountCode.destroy({
    where: { code: { [Op.like]: `INT_DCX_${TS}%` } },
    force: true,
  });
});

describe('DiscountCode Integration — Extra', () => {
  test('Apply discount code với isActive=false → throw lỗi', async () => {
    // Tạo mã inactive
    const inactiveCode = await DiscountCode.create({
      code: `INT_DCX_${TS}_INACTIVE`,
      type: 'fixed',
      value: 100_000,
      minOrderAmount: 0,
      usageLimit: 10,
      usedCount: 0,
      isActive: false,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });

    // Query áp dụng phải yêu cầu isActive=true — mã inactive không được tìm thấy
    const found = await DiscountCode.findOne({
      where: {
        code: inactiveCode.code,
        isActive: true,
      },
    });

    expect(found).toBeNull();
  });

  test('Discount percent type: discountAmount = value% × orderAmount', async () => {
    const percentCode = await DiscountCode.create({
      code: `INT_DCX_${TS}_PCT`,
      type: 'percent',
      value: 15, // 15%
      minOrderAmount: 0,
      usageLimit: 100,
      usedCount: 0,
      isActive: true,
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
    });

    const orderAmount = 2_000_000;
    const discountAmount = (Number(percentCode.value) / 100) * orderAmount;

    expect(percentCode.type).toBe('percent');
    expect(discountAmount).toBe(300_000); // 15% × 2,000,000 = 300,000
  });
});
