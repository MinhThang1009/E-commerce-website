require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Product, ProductVariant, Category, Brand, InventoryLog, User } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let product, variant, admin;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_Inv_Cat_${TS}`,
    nameEn: `__INT_Inv_Cat_${TS}`,
    slug: `int-inv-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Inv_Brand_${TS}`,
    nameEn: `__INT_Inv_Brand_${TS}`,
    slug: `int-inv-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_Inv_Product_${TS}`,
    nameEn: `__INT_Inv_Product_${TS}`,
    baseName: `__INT_Inv_Product_${TS}`,
    slug: `int-inv-product-${TS}`,
    basePrice: 3_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 0,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-INV-${TS}`,
    variantName: 'Base',
    price: 3_000_000,
    stockQuantity: 0,
    isDefault: true,
  });
  admin = await User.create({
    firstName: '__INT_Inv',
    lastName: 'Admin',
    email: `__int_inv_${TS}@t.com`,
    password: 'Inv123!',
    role: 'admin',
  });
});

afterAll(async () => {
  await InventoryLog.destroy({ where: { productId: product?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (admin) await admin.destroy({ force: true });
});

describe('Inventory Integration', () => {
  test('Restock: tăng stock + ghi log', async () => {
    const before = variant.stockQuantity;
    await variant.increment('stockQuantity', { by: 50 });
    await InventoryLog.create({
      productId: product.id,
      variantId: variant.id,
      createdBy: admin.id,
      changeType: 'restock',
      changeAmount: 50,
      previousStock: before,
      newStock: before + 50,
      note: 'Nhập kho lần 1',
    });
    await variant.reload();
    expect(variant.stockQuantity).toBe(50);
  });

  test('Sale: giảm stock + ghi log', async () => {
    const before = variant.stockQuantity;
    const sold = 3;
    await variant.decrement('stockQuantity', { by: sold });
    await InventoryLog.create({
      productId: product.id,
      variantId: variant.id,
      createdBy: admin.id,
      changeType: 'sale',
      changeAmount: -sold,
      previousStock: before,
      newStock: before - sold,
      note: 'Bán hàng',
    });
    await variant.reload();
    expect(variant.stockQuantity).toBe(47);
  });

  test('Lịch sử log theo variantId', async () => {
    const logs = await InventoryLog.findAll({
      where: { variantId: variant.id },
      order: [['createdAt', 'ASC']],
    });
    expect(logs).toHaveLength(2);
    expect(logs[0].changeType).toBe('restock');
    expect(logs[1].changeType).toBe('sale');
  });

  test('Tính net stock từ logs = stockQuantity hiện tại', async () => {
    const logs = await InventoryLog.findAll({ where: { variantId: variant.id } });
    const net = logs.reduce((sum, l) => sum + l.changeAmount, 0);
    await variant.reload();
    expect(net).toBe(variant.stockQuantity);
  });

  test('Adjustment: điều chỉnh stock + ghi log', async () => {
    const before = variant.stockQuantity;
    await variant.update({ stockQuantity: 100 });
    await InventoryLog.create({
      productId: product.id,
      variantId: variant.id,
      createdBy: admin.id,
      changeType: 'adjustment',
      changeAmount: 100 - before,
      previousStock: before,
      newStock: 100,
      note: 'Kiểm kê điều chỉnh',
    });
    await variant.reload();
    expect(variant.stockQuantity).toBe(100);
  });

  test('Return: hoàn trả stock khi cancel order', async () => {
    const before = variant.stockQuantity;
    const returned = 5;
    await variant.increment('stockQuantity', { by: returned });
    await InventoryLog.create({
      productId: product.id,
      variantId: variant.id,
      createdBy: admin.id,
      changeType: 'return',
      changeAmount: returned,
      previousStock: before,
      newStock: before + returned,
      note: 'Hoàn trả do hủy đơn',
    });
    await variant.reload();
    expect(variant.stockQuantity).toBe(105);
  });

  test('Log filter theo changeType', async () => {
    const restockLogs = await InventoryLog.findAll({
      where: { variantId: variant.id, changeType: 'restock' },
    });
    expect(restockLogs).toHaveLength(1);
    const saleLogs = await InventoryLog.findAll({
      where: { variantId: variant.id, changeType: 'sale' },
    });
    expect(saleLogs).toHaveLength(1);
  });

  test('Stock không được âm khi dùng SELECT FOR UPDATE', async () => {
    await variant.update({ stockQuantity: 1 });
    const result = await sequelize.transaction(async (t) => {
      const v = await ProductVariant.findByPk(variant.id, { lock: t.LOCK.UPDATE, transaction: t });
      if (v.stockQuantity < 5) return 'INSUFFICIENT';
      await v.decrement('stockQuantity', { by: 5, transaction: t });
      return 'OK';
    });
    expect(result).toBe('INSUFFICIENT');
    await variant.reload();
    expect(variant.stockQuantity).toBe(1);
  });
});
