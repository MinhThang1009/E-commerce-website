require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Product, ProductVariant, Category, Brand, InventoryLog, User } = require('@models');

const TS = Date.now();
let product, variant, admin;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_InvX_Cat_${TS}`,
    nameEn: `__INT_InvX_Cat_${TS}`,
    slug: `int-invx-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_InvX_Brand_${TS}`,
    nameEn: `__INT_InvX_Brand_${TS}`,
    slug: `int-invx-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_InvX_Product_${TS}`,
    nameEn: `__INT_InvX_Product_${TS}`,
    baseName: `__INT_InvX_Product_${TS}`,
    slug: `int-invx-product-${TS}`,
    basePrice: 2_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 0,
  });
  variant = await ProductVariant.create({
    productId: product.id,
    sku: `INT-INVX-${TS}`,
    variantName: 'Base',
    price: 2_000_000,
    stockQuantity: 0,
    isDefault: true,
  });
  admin = await User.create({
    firstName: '__INT_InvX',
    lastName: 'Admin',
    email: `__int_invx_${TS}@t.com`,
    password: 'InvX123!',
    role: 'admin',
  });
});

afterAll(async () => {
  await InventoryLog.destroy({ where: { productId: product?.id }, force: true });
  if (variant) await variant.destroy({ force: true });
  if (product) await product.destroy({ force: true });
  if (admin) await admin.destroy({ force: true });
});

describe('Inventory Integration — Extra', () => {
  test('Restock sản phẩm → stockQuantity tăng đúng số lượng', async () => {
    const stockBefore = variant.stockQuantity; // 0
    const restockQty = 30;

    await variant.increment('stockQuantity', { by: restockQty });
    await variant.reload();

    expect(variant.stockQuantity).toBe(stockBefore + restockQty);
  });

  test('Restock tạo InventoryLog record', async () => {
    const countBefore = await InventoryLog.count({ where: { productId: product.id } });

    await InventoryLog.create({
      productId: product.id,
      variantId: variant.id,
      createdBy: admin.id,
      changeType: 'restock',
      changeAmount: 30,
      previousStock: 0,
      newStock: 30,
      note: 'Nhập kho test',
    });

    const countAfter = await InventoryLog.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore + 1);
  });

  test('InventoryLog có đúng changeType=restock', async () => {
    const log = await InventoryLog.findOne({
      where: { productId: product.id, variantId: variant.id },
      order: [['createdAt', 'DESC']],
    });

    expect(log).not.toBeNull();
    expect(log.changeType).toBe('restock');
    expect(log.changeAmount).toBe(30);
  });

  test('Lấy danh sách logs theo productId → đúng sản phẩm', async () => {
    // Tạo thêm 1 log để có ít nhất 2
    await InventoryLog.create({
      productId: product.id,
      variantId: variant.id,
      createdBy: admin.id,
      changeType: 'adjustment',
      changeAmount: 5,
      previousStock: 30,
      newStock: 35,
      note: 'Điều chỉnh thủ công',
    });

    const logs = await InventoryLog.findAll({
      where: { productId: product.id },
      order: [['createdAt', 'ASC']],
    });

    expect(logs.length).toBeGreaterThanOrEqual(2);
    // Tất cả logs phải thuộc đúng productId
    logs.forEach((log) => {
      expect(log.productId).toBe(product.id);
    });
  });
});
