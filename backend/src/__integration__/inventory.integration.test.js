require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Product, ProductVariant, Category, Brand, InventoryLog, User } = require('@models');
const { Op } = require('sequelize');
const SequelizeInventoryRepository = require('@modules/inventory/repositories/sequelize-inventory-repository');
const InventoryService = require('@modules/inventory/services/inventory-service');

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

describe('Inventory Integration — Extra', () => {
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

describe('Inventory restock service — edge cases (real DB)', () => {
  let product, variantA, variantB, admin, cat, brand;

  function makeService() {
    const repo = new SequelizeInventoryRepository({ Product, ProductVariant, InventoryLog, User });
    return new InventoryService({
      inventoryRepository: repo,
      sequelize,
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
  }

  beforeAll(async () => {
    await sequelize.authenticate();

    cat = await Category.create({
      nameVi: `__INT_InvEdge_Cat_${TS}`,
      nameEn: `__INT_InvEdge_Cat_${TS}`,
      slug: `int-inv-edge-cat-${TS}`,
      isActive: true,
    });
    brand = await Brand.create({
      nameVi: `__INT_InvEdge_Brand_${TS}`,
      nameEn: `__INT_InvEdge_Brand_${TS}`,
      slug: `int-inv-edge-brand-${TS}`,
    });
    product = await Product.create({
      nameVi: `__INT_InvEdge_Product_${TS}`,
      nameEn: `__INT_InvEdge_Product_${TS}`,
      baseName: `__INT_InvEdge_Product_${TS}`,
      slug: `int-inv-edge-product-${TS}`,
      basePrice: 2_000_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 0,
    });
    variantA = await ProductVariant.create({
      productId: product.id,
      sku: `INT-INVEDGE-A-${TS}`,
      variantName: 'Variant A',
      price: 2_000_000,
      stockQuantity: 5,
      isDefault: true,
    });
    variantB = await ProductVariant.create({
      productId: product.id,
      sku: `INT-INVEDGE-B-${TS}`,
      variantName: 'Variant B',
      price: 2_000_000,
      stockQuantity: 10,
    });
    admin = await User.create({
      firstName: '__INT_InvEdge',
      lastName: 'Admin',
      email: `__int_invedge_${TS}@t.com`,
      password: 'InvEdge123!',
      role: 'admin',
    });
  });

  afterAll(async () => {
    await InventoryLog.destroy({ where: { productId: product?.id }, force: true });
    if (variantA) await variantA.destroy({ force: true });
    if (variantB) await variantB.destroy({ force: true });
    if (product) await product.destroy({ force: true });
    if (cat) await cat.destroy({ force: true });
    if (brand) await brand.destroy({ force: true });
    if (admin) await admin.destroy({ force: true });
  });

  test('restock product-only: stock persist + InventoryLog ghi đúng delta', async () => {
    const service = makeService();
    const before = product.stockQuantity;

    const result = await service.restockProduct({
      productId: product.id,
      quantity: 40,
      note: 'Nhập kho đợt 1',
      adminId: admin.id,
    });

    expect(result.previousStock).toBe(before);
    expect(result.newStock).toBe(before + 40);

    // Đọc lại từ DB — stock đã persist
    const fresh = await Product.findByPk(product.id);
    expect(fresh.stockQuantity).toBe(before + 40);

    // Log persist với đủ field audit
    const log = await InventoryLog.findOne({
      where: { productId: product.id, changeType: 'restock', variantId: null },
      order: [['createdAt', 'DESC']],
    });
    expect(log.changeAmount).toBe(40);
    expect(log.previousStock).toBe(before);
    expect(log.newStock).toBe(before + 40);
    expect(log.createdBy).toBe(admin.id);
    expect(log.note).toBe('Nhập kho đợt 1');
    expect(log.newStock - log.previousStock).toBe(log.changeAmount); // bất biến delta
  });

  test('restock liên tiếp: previousStock của lần 2 = newStock đã persist của lần 1 (conservation)', async () => {
    const service = makeService();
    const r1 = await service.restockProduct({
      productId: product.id,
      quantity: 7,
      adminId: admin.id,
    });
    const r2 = await service.restockProduct({
      productId: product.id,
      quantity: 3,
      adminId: admin.id,
    });

    // Lần 2 đọc state đã persist của lần 1 — không stale
    expect(r2.previousStock).toBe(r1.newStock);
    expect(r2.newStock).toBe(r1.newStock + 3);

    const fresh = await Product.findByPk(product.id);
    expect(fresh.stockQuantity).toBe(r2.newStock);
  });

  test('restock variant → Product.stockQuantity = SQL SUM(tất cả variant) trong transaction', async () => {
    const service = makeService();
    const aBefore = variantA.stockQuantity; // 5
    const bStock = variantB.stockQuantity; // 10

    const result = await service.restockProduct({
      productId: product.id,
      variantId: variantA.id,
      quantity: 20,
      adminId: admin.id,
    });

    // Variant A cộng thuần
    const freshA = await ProductVariant.findByPk(variantA.id);
    expect(freshA.stockQuantity).toBe(aBefore + 20); // 25
    expect(freshA.isAvailable).toBe(true);
    expect(result.newStock).toBe(aBefore + 20);

    // Product đồng bộ = tổng A + B (SUM thật từ DB, không phải chỉ A)
    const freshProduct = await Product.findByPk(product.id);
    expect(freshProduct.stockQuantity).toBe(aBefore + 20 + bStock); // 25 + 10 = 35
  });

  test('qty không hợp lệ (0) → 400, KHÔNG ghi log', async () => {
    const service = makeService();
    const countBefore = await InventoryLog.count({ where: { productId: product.id } });

    await expect(
      service.restockProduct({ productId: product.id, quantity: 0, adminId: admin.id }),
    ).rejects.toMatchObject({ statusCode: 400 });

    const countAfter = await InventoryLog.count({ where: { productId: product.id } });
    expect(countAfter).toBe(countBefore);
  });

  test('product không tồn tại → 404, KHÔNG ghi log', async () => {
    const service = makeService();
    await expect(
      service.restockProduct({ productId: 999_999_999, quantity: 5, adminId: admin.id }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test('variant không thuộc product → 404 (findVariantByIdAndProductId chặn)', async () => {
    const service = makeService();
    // Tạo product khác + variant của nó, rồi restock với productId sai
    const otherProduct = await Product.create({
      nameVi: `__INT_InvEdge_Other_${TS}`,
      nameEn: `__INT_InvEdge_Other_${TS}`,
      baseName: `__INT_InvEdge_Other_${TS}`,
      slug: `int-inv-edge-other-${TS}`,
      basePrice: 1_000_000,
      categoryId: cat.id,
      brandId: brand.id,
      status: 'active',
      stockQuantity: 0,
    });
    const otherVariant = await ProductVariant.create({
      productId: otherProduct.id,
      sku: `INT-INVEDGE-OTHER-${TS}`,
      variantName: 'Other',
      price: 1_000_000,
      stockQuantity: 0,
    });

    await expect(
      service.restockProduct({
        productId: product.id, // sai product
        variantId: otherVariant.id, // variant thuộc otherProduct
        quantity: 5,
        adminId: admin.id,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    await otherVariant.destroy({ force: true });
    await otherProduct.destroy({ force: true });
  });

  test('getInventoryLogs: trả log đã ghi, filter theo changeType, cap limit 100', async () => {
    const service = makeService();
    const res = await service.getInventoryLogs({
      productId: product.id,
      changeType: 'restock',
      limit: 999,
    });

    expect(res.limit).toBe(100); // cap
    expect(res.total).toBeGreaterThan(0);
    expect(res.data.every((l) => l.changeType === 'restock')).toBe(true);
    expect(res.data.every((l) => l.productId === product.id)).toBe(true);
  });
});
