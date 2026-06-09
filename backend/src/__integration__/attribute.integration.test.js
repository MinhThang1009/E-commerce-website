require('module-alias/register');
const sequelize = require('@config/sequelize');
const {
  Product,
  Category,
  Brand,
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
} = require('@models');
const { Op } = require('sequelize');

const TS = Date.now();
let product, group1, group2;

beforeAll(async () => {
  await sequelize.authenticate();
  const cat = await Category.create({
    nameVi: `__INT_Attr_Cat_${TS}`,
    nameEn: `__INT_Attr_Cat_${TS}`,
    slug: `int-attr-cat-${TS}`,
    isActive: true,
  });
  const brand = await Brand.create({
    nameVi: `__INT_Attr_Brand_${TS}`,
    nameEn: `__INT_Attr_Brand_${TS}`,
    slug: `int-attr-brand-${TS}`,
  });
  product = await Product.create({
    nameVi: `__INT_Attr_Product_${TS}`,
    nameEn: `__INT_Attr_Product_${TS}`,
    baseName: `__INT_Attr_Product_${TS}`,
    slug: `int-attr-product-${TS}`,
    basePrice: 10_000_000,
    categoryId: cat.id,
    brandId: brand.id,
    status: 'active',
    stockQuantity: 5,
  });
});

afterAll(async () => {
  await ProductAttributeGroup.destroy({ where: { productId: product?.id }, force: true });
  if (group1) {
    await AttributeValue.destroy({ where: { attributeGroupId: group1.id }, force: true });
    await group1.destroy({ force: true });
  }
  if (group2) {
    await AttributeValue.destroy({ where: { attributeGroupId: group2.id }, force: true });
    await group2.destroy({ force: true });
  }
  if (product) await product.destroy({ force: true });
});

describe('Attribute Integration', () => {
  test('Tạo attribute group CPU', async () => {
    group1 = await AttributeGroup.create({
      name: `__INT_CPU_${TS}`,
      description: 'CPU',
      isActive: true,
    });
    expect(group1.id).toBeDefined();
  });

  test('Tạo attribute values cho group CPU', async () => {
    await AttributeValue.create({
      attributeGroupId: group1.id,
      name: 'Intel Core i5-12450H',
      value: 'Intel Core i5-12450H',
    });
    await AttributeValue.create({
      attributeGroupId: group1.id,
      name: 'Intel Core i7-12650H',
      value: 'Intel Core i7-12650H',
    });
    const vals = await AttributeValue.findAll({ where: { attributeGroupId: group1.id } });
    expect(vals.length).toBe(2);
  });

  test('Tạo attribute group RAM', async () => {
    group2 = await AttributeGroup.create({
      name: `__INT_RAM_${TS}`,
      description: 'RAM',
      isActive: true,
    });
  });

  test('Gán groups cho product', async () => {
    await ProductAttributeGroup.create({
      productId: product.id,
      attributeGroupId: group1.id,
      sortOrder: 1,
    });
    await ProductAttributeGroup.create({
      productId: product.id,
      attributeGroupId: group2.id,
      sortOrder: 2,
    });
    const pags = await ProductAttributeGroup.findAll({ where: { productId: product.id } });
    expect(pags.length).toBe(2);
  });

  test('Lấy attribute groups của product', async () => {
    const p = await Product.findByPk(product.id, { include: [{ association: 'attributeGroups' }] });
    expect(p.attributeGroups.length).toBe(2);
  });

  test('Update description của group', async () => {
    await group1.update({ description: 'Bộ vi xử lý' });
    await group1.reload();
    expect(group1.description).toBe('Bộ vi xử lý');
  });
});

describe('Attribute Integration — Extra', () => {
  let groupWithValue, groupToDeactivate;

  beforeAll(async () => {
    await sequelize.authenticate();
  });

  afterAll(async () => {
    if (groupWithValue) {
      await AttributeValue.destroy({ where: { attributeGroupId: groupWithValue.id }, force: true });
      await groupWithValue.destroy({ force: true });
    }
    if (groupToDeactivate) {
      await AttributeValue.destroy({
        where: { attributeGroupId: groupToDeactivate.id },
        force: true,
      });
      await groupToDeactivate.destroy({ force: true });
    }
  });

  test('Tạo attribute value → gắn đúng vào group', async () => {
    groupWithValue = await AttributeGroup.create({
      name: `__INT_AttrX_GPU_${TS}`,
      description: 'Card đồ họa',
      isActive: true,
    });

    const val = await AttributeValue.create({
      attributeGroupId: groupWithValue.id,
      name: 'NVIDIA RTX 4060',
      value: 'NVIDIA RTX 4060',
    });

    expect(val.id).toBeDefined();
    expect(val.attributeGroupId).toBe(groupWithValue.id);

    // Lấy tất cả values của group → phải có đúng value vừa tạo
    const values = await AttributeValue.findAll({
      where: { attributeGroupId: groupWithValue.id },
    });
    expect(values).toHaveLength(1);
    expect(values[0].name).toBe('NVIDIA RTX 4060');
  });

  test('Xóa attribute group → group.isActive=false', async () => {
    groupToDeactivate = await AttributeGroup.create({
      name: `__INT_AttrX_SSD_${TS}`,
      description: 'Ổ cứng SSD',
      isActive: true,
    });

    // Soft-delete bằng cách set isActive=false (không xóa hard ở đây)
    await groupToDeactivate.update({ isActive: false });
    await groupToDeactivate.reload();

    expect(groupToDeactivate.isActive).toBe(false);

    // Query chỉ lấy groups active → group này không xuất hiện
    const activeGroups = await AttributeGroup.findAll({
      where: {
        name: `__INT_AttrX_SSD_${TS}`,
        isActive: true,
      },
    });
    expect(activeGroups).toHaveLength(0);
  });
});
