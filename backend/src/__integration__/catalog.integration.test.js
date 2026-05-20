/**
 * Integration tests — Catalog module với database thật (test_db).
 * Verify: CRUD sản phẩm, sort theo giá, filter theo category/brand.
 */
require('module-alias/register');
const sequelize = require('@config/sequelize');
const { Product, Category, Brand, ProductVariant } = require('@models');

let testCategory, testBrand;

beforeAll(async () => {
  await sequelize.authenticate();

  // Tạo category và brand dùng cho test
  testCategory = await Category.create({
    nameVi: '__Test Category INT__',
    nameEn: '__Test Category INT__',
    slug: `test-category-int-${Date.now()}`,
    isActive: true,
  });

  testBrand = await Brand.create({
    nameVi: '__Test Brand INT__',
    nameEn: '__Test Brand INT__',
    slug: `test-brand-int-${Date.now()}`,
  });
});

afterAll(async () => {
  // Dọn dẹp data test
  await Product.destroy({
    where: { nameVi: { [require('sequelize').Op.like]: '__INT_TEST_%' } },
    force: true,
  });
  if (testCategory) await testCategory.destroy({ force: true });
  if (testBrand) await testBrand.destroy({ force: true });
});

describe('Catalog Integration — Product CRUD', () => {
  let product;

  test('Tạo sản phẩm với variant', async () => {
    product = await Product.create(
      {
        nameVi: '__INT_TEST_Laptop A',
        nameEn: '__INT_TEST_Laptop A EN',
        baseName: '__INT_TEST_Laptop A',
        slug: `int-test-laptop-a-${Date.now()}`,
        basePrice: 15_000_000,
        compareAtPrice: 18_000_000,
        categoryId: testCategory.id,
        brandId: testBrand.id,
        status: 'active',
        stockQuantity: 0,
        variants: [
          {
            sku: `INT-A1-${Date.now()}`,
            variantName: '8GB/256GB',
            price: 15_000_000,
            stockQuantity: 10,
            isDefault: true,
          },
          {
            sku: `INT-A2-${Date.now()}`,
            variantName: '16GB/512GB',
            price: 20_000_000,
            stockQuantity: 5,
            isDefault: false,
          },
        ],
      },
      { include: [{ association: 'variants' }] },
    );

    expect(product.id).toBeDefined();
    expect(product.nameVi).toBe('__INT_TEST_Laptop A');
    expect(Number(product.basePrice)).toBe(15_000_000);
  });

  test('Đọc sản phẩm với variants', async () => {
    const found = await Product.findByPk(product.id, {
      include: [{ association: 'variants' }],
    });

    expect(found).not.toBeNull();
    expect(found.variants).toHaveLength(2);
    const prices = found.variants.map((v) => Number(v.price)).sort((a, b) => a - b);
    expect(prices).toEqual([15_000_000, 20_000_000]);
  });

  test('Cập nhật giá sản phẩm', async () => {
    await product.update({ basePrice: 14_500_000 });
    await product.reload();
    expect(Number(product.basePrice)).toBe(14_500_000);
  });
});

describe('Catalog Integration — Sort theo giá', () => {
  let products = [];

  beforeAll(async () => {
    // Tạo 3 sản phẩm với giá khác nhau
    const data = [
      { nameVi: '__INT_TEST_Sort_A', basePrice: 5_000_000, slug: `int-sort-a-${Date.now()}` },
      { nameVi: '__INT_TEST_Sort_B', basePrice: 1_000_000, slug: `int-sort-b-${Date.now()}-1` },
      { nameVi: '__INT_TEST_Sort_C', basePrice: 10_000_000, slug: `int-sort-c-${Date.now()}-2` },
    ];

    for (const d of data) {
      const p = await Product.create({
        ...d,
        nameEn: d.nameVi,
        baseName: d.nameVi,
        categoryId: testCategory.id,
        brandId: testBrand.id,
        status: 'active',
        stockQuantity: 10,
        compareAtPrice: null,
      });
      products.push(p);
    }
  });

  afterAll(async () => {
    for (const p of products) await p.destroy({ force: true });
    products = [];
  });

  test('Sort ASC theo basePrice — rẻ nhất lên đầu', async () => {
    const { Op } = require('sequelize');
    const results = await Product.findAll({
      where: {
        nameVi: { [Op.like]: '__INT_TEST_Sort_%' },
        status: 'active',
      },
      order: [['basePrice', 'ASC']],
    });

    const prices = results.map((p) => Number(p.basePrice));
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(prices[0]).toBe(1_000_000);
  });

  test('Sort DESC theo basePrice — đắt nhất lên đầu', async () => {
    const { Op } = require('sequelize');
    const results = await Product.findAll({
      where: {
        nameVi: { [Op.like]: '__INT_TEST_Sort_%' },
        status: 'active',
      },
      order: [['basePrice', 'DESC']],
    });

    const prices = results.map((p) => Number(p.basePrice));
    expect(prices[0]).toBe(10_000_000);
  });

  test('Sort ASC với COALESCE min(variant.price) — khớp với logic FE', async () => {
    // Tạo sản phẩm có variant giá thấp hơn basePrice
    const { Op, literal } = require('sequelize');
    const pWithVariant = await Product.create(
      {
        nameVi: '__INT_TEST_Sort_D_Variant',
        nameEn: '__INT_TEST_Sort_D_Variant',
        baseName: '__INT_TEST_Sort_D_Variant',
        slug: `int-sort-d-${Date.now()}`,
        basePrice: 8_000_000, // basePrice cao
        categoryId: testCategory.id,
        brandId: testBrand.id,
        status: 'active',
        stockQuantity: 0,
        compareAtPrice: null,
        variants: [
          {
            sku: `INT-D1-${Date.now()}`,
            variantName: 'Budget',
            price: 500_000,
            stockQuantity: 5,
            isDefault: true,
          },
        ],
      },
      { include: [{ association: 'variants' }] },
    );
    products.push(pWithVariant);

    const results = await Product.findAll({
      where: {
        nameVi: { [Op.like]: '__INT_TEST_Sort_%' },
        status: 'active',
      },
      order: [
        [
          literal(
            'COALESCE((SELECT MIN(pv.price) FROM product_variants pv WHERE pv.product_id = `Product`.`id`), `Product`.`base_price`)',
          ),
          'ASC',
        ],
      ],
    });

    const effectivePrices = results.map((p) => Number(p.basePrice));
    // Product D có variant 500k — phải đứng đầu
    expect(results[0].nameVi).toBe('__INT_TEST_Sort_D_Variant');
  });
});

describe('Catalog Integration — Filter theo Category', () => {
  test('Filter sản phẩm theo categoryId', async () => {
    const { Op } = require('sequelize');
    const results = await Product.findAll({
      where: {
        categoryId: testCategory.id,
        nameVi: { [Op.like]: '__INT_TEST_%' },
      },
    });

    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.categoryId).toBe(testCategory.id);
    }
  });

  test('Filter theo brandId', async () => {
    const { Op } = require('sequelize');
    const results = await Product.findAll({
      where: {
        brandId: testBrand.id,
        nameVi: { [Op.like]: '__INT_TEST_%' },
      },
    });

    expect(results.length).toBeGreaterThan(0);
    for (const p of results) {
      expect(p.brandId).toBe(testBrand.id);
    }
  });
});
