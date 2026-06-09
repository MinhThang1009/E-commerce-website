require('module-alias/register');
const sequelize = require('@config/sequelize');
const { User, Product, ProductVariant, Category, Brand, Wishlist } = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let user, p1, p2;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_WL_Cat_${TS}`,
    nameEn: `__INT_WL_Cat_${TS}`,
    slug: `int-wl-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_WL_Brand_${TS}`,
    nameEn: `__INT_WL_Brand_${TS}`,
    slug: `int-wl-brand-${TS}`,
  });
  const base = {
    nameEn: 'WL P',
    baseName: 'WL P',
    basePrice: 1_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 10,
  };
  p1 = await Product.create({ ...base, nameVi: `__INT_WL_P1_${TS}`, slug: `int-wl-p1-${TS}` });
  p2 = await Product.create({ ...base, nameVi: `__INT_WL_P2_${TS}`, slug: `int-wl-p2-${TS}` });
  user = await User.create({
    firstName: '__INT_WL',
    lastName: 'User',
    email: `__int_wl_${TS}@t.com`,
    password: 'WL123!',
    role: 'customer',
  });
});

afterAll(async () => {
  await Wishlist.destroy({ where: { userId: user?.id }, force: true });
  if (p1) await p1.destroy({ force: true });
  if (p2) await p2.destroy({ force: true });
  if (user) await user.destroy({ force: true });
});

describe('Wishlist Integration', () => {
  test('Thêm p1 vào wishlist', async () => {
    await Wishlist.create({ userId: user.id, productId: p1.id });
    const wl = await Wishlist.findOne({ where: { userId: user.id, productId: p1.id } });
    expect(wl).not.toBeNull();
  });

  test('Thêm p2 vào wishlist', async () => {
    await Wishlist.create({ userId: user.id, productId: p2.id });
    const count = await Wishlist.count({ where: { userId: user.id } });
    expect(count).toBe(2);
  });

  test('Duplicate p1 bị reject (unique constraint)', async () => {
    await expect(Wishlist.create({ userId: user.id, productId: p1.id })).rejects.toThrow();
  });

  test('Xóa p1 khỏi wishlist', async () => {
    await Wishlist.destroy({ where: { userId: user.id, productId: p1.id }, force: true });
    const count = await Wishlist.count({ where: { userId: user.id } });
    expect(count).toBe(1);
  });

  test('Lấy danh sách wishlist của user', async () => {
    const items = await Wishlist.findAll({ where: { userId: user.id } });
    expect(items).toHaveLength(1);
    expect(items[0].productId).toBe(p2.id);
  });

  test('Xóa toàn bộ wishlist của user', async () => {
    await Wishlist.create({ userId: user.id, productId: p1.id });
    const before = await Wishlist.count({ where: { userId: user.id } });
    expect(before).toBe(2);
    await Wishlist.destroy({ where: { userId: user.id }, force: true });
    const after = await Wishlist.count({ where: { userId: user.id } });
    expect(after).toBe(0);
  });

  test('Wishlist item include product info', async () => {
    await Wishlist.create({ userId: user.id, productId: p1.id });
    const items = await Wishlist.findAll({
      where: { userId: user.id },
      include: [{ model: Product, attributes: ['nameVi', 'basePrice'] }],
    });
    expect(items[0].Product).toBeDefined();
    expect(items[0].Product.nameVi).toContain('__INT_WL');
  });
});

describe('Wishlist Integration — Extra', () => {
  let user, pActive1, pActive2, pInactive;

  beforeAll(async () => {
    await sequelize.authenticate();
    const cat = await Category.create({
      nameVi: `__INT_WLX_Cat_${TS}`,
      nameEn: `__INT_WLX_Cat_${TS}`,
      slug: `int-wlx-cat-${TS}`,
      isActive: true,
    });
    const brand = await Brand.create({
      nameVi: `__INT_WLX_Brand_${TS}`,
      nameEn: `__INT_WLX_Brand_${TS}`,
      slug: `int-wlx-brand-${TS}`,
    });
    const base = {
      nameEn: 'WLX P',
      baseName: 'WLX P',
      basePrice: 1_500_000,
      categoryId: cat.id,
      brandId: brand.id,
      stockQuantity: 10,
    };
    pActive1 = await Product.create({
      ...base,
      nameVi: `__INT_WLX_PA1_${TS}`,
      slug: `int-wlx-pa1-${TS}`,
      status: 'active',
    });
    pActive2 = await Product.create({
      ...base,
      nameVi: `__INT_WLX_PA2_${TS}`,
      slug: `int-wlx-pa2-${TS}`,
      status: 'active',
    });
    pInactive = await Product.create({
      ...base,
      nameVi: `__INT_WLX_PI_${TS}`,
      slug: `int-wlx-pi-${TS}`,
      status: 'inactive',
    });
    user = await User.create({
      firstName: '__INT_WLX',
      lastName: 'User',
      email: `__int_wlx_${TS}@t.com`,
      password: 'WLX123!',
      role: 'customer',
    });
  });

  afterAll(async () => {
    await Wishlist.destroy({ where: { userId: user?.id }, force: true });
    if (pActive1) await pActive1.destroy({ force: true });
    if (pActive2) await pActive2.destroy({ force: true });
    if (pInactive) await pInactive.destroy({ force: true });
    if (user) await user.destroy({ force: true });
  });

  test('Kiểm tra sản phẩm trong wishlist (check) → true sau khi thêm', async () => {
    await Wishlist.create({ userId: user.id, productId: pActive1.id });

    const found = await Wishlist.findOne({
      where: { userId: user.id, productId: pActive1.id },
    });

    expect(found).not.toBeNull();
    expect(found.productId).toBe(pActive1.id);
  });

  test('Xóa 1 sản phẩm → các sản phẩm khác không bị ảnh hưởng', async () => {
    // Thêm pActive2 vào wishlist
    await Wishlist.create({ userId: user.id, productId: pActive2.id });

    // Xóa pActive1
    await Wishlist.destroy({
      where: { userId: user.id, productId: pActive1.id },
      force: true,
    });

    // pActive2 vẫn còn trong wishlist
    const remaining = await Wishlist.findAll({ where: { userId: user.id } });
    expect(remaining.length).toBe(1);
    expect(remaining[0].productId).toBe(pActive2.id);
  });

  test('Wishlist chỉ chứa sản phẩm active', async () => {
    // Thêm sản phẩm inactive vào wishlist (không bị block ở DB level)
    await Wishlist.create({ userId: user.id, productId: pInactive.id });

    // Khi lấy wishlist, join với Product và filter status=active
    const activeItems = await Wishlist.findAll({
      where: { userId: user.id },
      include: [
        {
          association: 'Product',
          where: { status: 'active' },
          required: true,
        },
      ],
    });

    // Chỉ pActive2 còn trong wishlist và có status active
    const productIds = activeItems.map((w) => w.productId);
    expect(productIds).not.toContain(pInactive.id);
    expect(productIds).toContain(pActive2.id);
  });
});
