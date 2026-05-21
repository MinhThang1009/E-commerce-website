require('module-alias/register');
const sequelize = require('@config/sequelize');
const { WarrantyPackage } = require('@models');

const TS = Date.now();
let wpNew, wpUpdate;

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  if (wpNew) await wpNew.destroy({ force: true });
  if (wpUpdate) await wpUpdate.destroy({ force: true });
});

describe('WarrantyPackage Integration — Extra', () => {
  test('Tạo warranty package → có id, name, price, duration', async () => {
    wpNew = await WarrantyPackage.create({
      name: `__INT_WPX_New_${TS}`,
      price: 750_000,
      durationMonths: 18,
    });

    expect(wpNew.id).toBeDefined();
    expect(wpNew.name).toBe(`__INT_WPX_New_${TS}`);
    expect(Number(wpNew.price)).toBe(750_000);
    expect(wpNew.durationMonths).toBe(18);
  });

  test('Cập nhật warranty package → giá mới được lưu', async () => {
    wpUpdate = await WarrantyPackage.create({
      name: `__INT_WPX_Upd_${TS}`,
      price: 400_000,
      durationMonths: 6,
    });

    await wpUpdate.update({ price: 450_000 });
    await wpUpdate.reload();

    expect(Number(wpUpdate.price)).toBe(450_000);
    // Các field khác không bị thay đổi
    expect(wpUpdate.durationMonths).toBe(6);
  });
});
