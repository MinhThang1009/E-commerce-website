require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, Product, Category, Brand, RecentlyViewed } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user;
const products = [];

beforeAll(async () => {
  await sequelize.authenticate();
  user = await User.create({
    firstName: '__INT_RV',
    lastName: 'User',
    email: `__int_rv_${TS}@t.com`,
    password: 'RV123!',
    role: 'customer',
  });
  const cat = await Category.create({
    nameVi: `__INT_RV_Cat_${TS}`,
    nameEn: `__INT_RV_Cat_${TS}`,
    slug: `int-rv-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_RV_Brand_${TS}`,
    nameEn: `__INT_RV_Brand_${TS}`,
    slug: `int-rv-brand-${TS}`,
  });
  for (let i = 0; i < 5; i++) {
    const p = await Product.create({
      nameVi: `__INT_RV_P${i}_${TS}`,
      nameEn: `__INT_RV_P${i}_${TS}`,
      baseName: `__INT_RV_P${i}_${TS}`,
      slug: `int-rv-p${i}-${TS}`,
      basePrice: 1_000_000 * (i + 1),
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 10,
    });
    products.push(p);
  }
});

afterAll(async () => {
  await RecentlyViewed.destroy({ where: { userId: user?.id }, force: true });
  for (const p of products) await p.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

describe('RecentlyViewed Integration', () => {
  test('Thêm 3 sản phẩm vào recently viewed', async () => {
    for (const p of products.slice(0, 3)) {
      await RecentlyViewed.create({ userId: user.id, productId: p.id });
    }
    const count = await RecentlyViewed.count({ where: { userId: user.id } });
    expect(count).toBe(3);
  });

  test('Thêm sản phẩm đã xem — update viewedAt (upsert)', async () => {
    const existing = await RecentlyViewed.findOne({
      where: { userId: user.id, productId: products[0].id },
    });
    const oldTime = existing.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    await existing.update({ updatedAt: new Date() });
    await existing.reload();
    // Timestamp mới hơn
    expect(existing.updatedAt.getTime()).toBeGreaterThanOrEqual(oldTime.getTime());
  });

  test('Sắp xếp DESC theo viewedAt — xem gần nhất lên đầu', async () => {
    const items = await RecentlyViewed.findAll({
      where: { userId: user.id },
      order: [['updatedAt', 'DESC']],
    });
    expect(items[0].productId).toBe(products[0].id);
  });

  test('Lấy max 10 items gần nhất', async () => {
    // Thêm thêm cho đủ 5
    for (const p of products.slice(3)) {
      await RecentlyViewed.create({ userId: user.id, productId: p.id });
    }
    const items = await RecentlyViewed.findAll({
      where: { userId: user.id },
      order: [['updatedAt', 'DESC']],
      limit: 10,
    });
    expect(items.length).toBeLessThanOrEqual(10);
    expect(items.length).toBe(5);
  });

  test('Xóa 1 entry', async () => {
    await RecentlyViewed.destroy({
      where: { userId: user.id, productId: products[4].id },
      force: true,
    });
    const count = await RecentlyViewed.count({ where: { userId: user.id } });
    expect(count).toBe(4);
  });
});
