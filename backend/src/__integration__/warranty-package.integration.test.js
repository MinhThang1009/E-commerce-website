require('module-alias/register');
const sequelize = require('@config/sequelize');
const { WarrantyPackage, Product, ProductWarranty, Category, Brand } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let product, wp1, wp2;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_WP_Cat_${TS}`,
    nameEn: `__INT_WP_Cat_${TS}`,
    slug: `int-wp-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_WP_Brand_${TS}`,
    nameEn: `__INT_WP_Brand_${TS}`,
    slug: `int-wp-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_WP_Product_${TS}`,
    nameEn: `__INT_WP_Product_${TS}`,
    baseName: `__INT_WP_Product_${TS}`,
    slug: `int-wp-product-${TS}`,
    basePrice: 5_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
  });
});

afterAll(async () => {
  await ProductWarranty.destroy({ where: { productId: product?.id }, force: true });
  if (wp1) await wp1.destroy({ force: true });
  if (wp2) await wp2.destroy({ force: true });
  if (product) await product.destroy({ force: true });
});

describe('WarrantyPackage Integration', () => {
  test('Tạo gói bảo hành 12 tháng', async () => {
    wp1 = await WarrantyPackage.create({
      name: `__INT_WP_12M_${TS}`,
      price: 500_000,
      durationMonths: 12,
    });
    expect(wp1.id).toBeDefined();
    expect(wp1.durationMonths).toBe(12);
  });

  test('Tạo gói bảo hành 24 tháng', async () => {
    wp2 = await WarrantyPackage.create({
      name: `__INT_WP_24M_${TS}`,
      price: 900_000,
      durationMonths: 24,
    });
    expect(wp2.durationMonths).toBe(24);
  });

  test('Gán 2 gói bảo hành cho product', async () => {
    await ProductWarranty.create({ productId: product.id, warrantyPackageId: wp1.id });
    await ProductWarranty.create({ productId: product.id, warrantyPackageId: wp2.id });
    const count = await ProductWarranty.count({ where: { productId: product.id } });
    expect(count).toBe(2);
  });

  test('Lấy warranties của product qua association', async () => {
    const p = await Product.findByPk(product.id, {
      include: [{ association: 'warrantyPackages' }],
    });
    expect(p.warrantyPackages).toHaveLength(2);
    const months = p.warrantyPackages.map((w) => w.durationMonths).sort((a, b) => a - b);
    expect(months).toEqual([12, 24]);
  });

  test('Update giá gói', async () => {
    await wp1.update({ price: 550_000 });
    await wp1.reload();
    expect(Number(wp1.price)).toBe(550_000);
  });

  test('Xóa gán — ProductWarranty', async () => {
    await ProductWarranty.destroy({
      where: { productId: product.id, warrantyPackageId: wp1.id },
      force: true,
    });
    const count = await ProductWarranty.count({ where: { productId: product.id } });
    expect(count).toBe(1);
  });
});
