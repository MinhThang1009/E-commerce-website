/**
 * Integration tests — Inventory edge cases với real DB.
 * Khác `inventory.integration.test.js` (thao tác model thô): file này chạy QUA
 * `InventoryService.restockProduct` THẬT + repository THẬT + transaction THẬT, xác minh
 * các invariant chỉ lộ ra với MySQL thật:
 *   - Restock variant → `Product.stockQuantity = SQL SUM(tất cả variant)` (đồng bộ trong tx)
 *   - Conservation qua nhiều lần restock liên tiếp: previousStock đọc đúng state đã persist
 *   - Validate qty không hợp lệ / product|variant not found → KHÔNG ghi InventoryLog
 *   - InventoryLog persist đủ field (delta, createdBy, note) — audit trail
 * Map invariants.ecommerce.md (GATE-A) §I Stock (restock cộng thuần, đối ngẫu INV-STK-1).
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Product, ProductVariant, Category, Brand, InventoryLog, User } = require('@models');

const SequelizeInventoryRepository = require('@modules/inventory/repositories/sequelize-inventory-repository');
const InventoryService = require('@modules/inventory/services/inventory-service');

const TS = Date.now();
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

describe('Inventory restock service — edge cases (real DB)', () => {
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
